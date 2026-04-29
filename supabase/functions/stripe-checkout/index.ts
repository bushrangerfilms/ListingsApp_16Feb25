import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CheckoutRequest {
  priceId?: string;
  planName?: string;
  mode?: 'subscription' | 'payment';
  organizationId: string;
  successUrl?: string;
  cancelUrl?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      console.error('STRIPE_SECRET_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Stripe not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: CheckoutRequest = await req.json();
    let { priceId, planName, mode, organizationId: requestedOrgId, successUrl, cancelUrl } = body;

    if (!requestedOrgId) {
      return new Response(
        JSON.stringify({ error: 'organizationId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If planName provided without priceId, look up the Stripe price by org currency.
    // Org currency in {EUR, GBP, USD, CAD, AUD, NZD}; corresponding column is
    // stripe_monthly_price_id (canonical, EUR) or stripe_monthly_price_id_<lower>.
    if (!priceId && planName) {
      // Pre-fetch org currency so we know which Stripe price column to read.
      // Need requestedOrgId at this point; the membership-validation block below
      // happens after this — but we trust the org_id here only to read currency,
      // and the membership check still gates the actual checkout.
      const { data: orgRow } = await supabase
        .from('organizations')
        .select('currency')
        .eq('id', requestedOrgId)
        .single();
      const orgCurrency = (orgRow?.currency ?? 'EUR').toUpperCase();
      const priceColumn =
        orgCurrency === 'EUR'
          ? 'stripe_monthly_price_id'
          : `stripe_monthly_price_id_${orgCurrency.toLowerCase()}`;

      const { data: planDef, error: planError } = await supabase
        .from('plan_definitions')
        .select(`name, stripe_monthly_price_id, ${priceColumn}`)
        .eq('name', planName)
        .eq('is_active', true)
        .single();

      if (planError || !planDef) {
        console.error('Plan not found:', planName, planError);
        return new Response(
          JSON.stringify({ error: `Plan '${planName}' not found` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Prefer the currency-specific column; fall back to EUR canonical if not seeded yet.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currencySpecific = (planDef as any)[priceColumn] as string | null | undefined;
      priceId = currencySpecific || planDef.stripe_monthly_price_id || null;

      if (!priceId) {
        console.error(`Plan '${planName}' has no Stripe price for ${orgCurrency} or EUR`);
        return new Response(
          JSON.stringify({
            error: 'pricing_unavailable',
            message: `Plan '${planName}' isn't yet available in ${orgCurrency}. Please contact support.`,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      mode = mode || 'subscription';
      const billedIn = currencySpecific ? orgCurrency : `EUR (no ${orgCurrency} pricing yet)`;
      console.log(`[STRIPE] Resolved plan '${planName}' (org currency ${orgCurrency}) to price ${priceId} — billed in ${billedIn}`);
    }

    if (!priceId) {
      return new Response(
        JSON.stringify({ error: 'Either priceId or planName is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default mode to subscription
    mode = mode || 'subscription';

    const { data: membershipData, error: membershipError } = await supabase
      .from('user_organizations')
      .select('organization_id, role, organizations(id, business_name, slug)')
      .eq('user_id', user.id)
      .eq('organization_id', requestedOrgId)
      .single();

    if (membershipError || !membershipData) {
      console.error('User not a member of requested organization:', membershipError);
      return new Response(
        JSON.stringify({ error: 'Access denied: not a member of this organization' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const targetOrgId = membershipData.organization_id;
    const organization = membershipData.organizations as { id: string; business_name: string; slug: string };

    // Validate the price exists in our system
    if (mode === 'payment') {
      const { data: creditPack, error: packError } = await supabase
        .from('credit_packs')
        .select('id, stripe_price_id')
        .eq('stripe_price_id', priceId)
        .eq('is_active', true)
        .single();

      if (packError || !creditPack) {
        console.error('Invalid price ID for credit pack:', priceId);
        return new Response(
          JSON.stringify({ error: 'Invalid credit pack price' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (mode === 'subscription') {
      // Validate price exists in plan_definitions across ALL currency columns.
      // The price-resolution block above already picked the right column for
      // the org's currency, but a caller can also pass `priceId` directly —
      // in which case the price might match any of EUR / GBP / USD / CAD / AUD / NZD.
      const { data: planDef, error: planError } = await supabase
        .from('plan_definitions')
        .select('name, stripe_monthly_price_id, stripe_monthly_price_id_gbp, stripe_monthly_price_id_usd, stripe_monthly_price_id_cad, stripe_monthly_price_id_aud, stripe_monthly_price_id_nzd')
        .or(
          [
            `stripe_monthly_price_id.eq.${priceId}`,
            `stripe_monthly_price_id_gbp.eq.${priceId}`,
            `stripe_monthly_price_id_usd.eq.${priceId}`,
            `stripe_monthly_price_id_cad.eq.${priceId}`,
            `stripe_monthly_price_id_aud.eq.${priceId}`,
            `stripe_monthly_price_id_nzd.eq.${priceId}`,
          ].join(','),
        )
        .eq('is_active', true)
        .single();

      if (planError || !planDef) {
        console.error('Invalid subscription price ID (no per-currency match):', priceId);
        return new Response(
          JSON.stringify({ error: 'Invalid subscription price' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Use the plan name from the DB if not provided
      if (!planName) {
        planName = planDef.name;
      }

      console.log(`[STRIPE] Valid subscription plan: ${planDef.name}`);
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    let { data: billingProfile } = await supabase
      .from('billing_profiles')
      .select('*')
      .eq('organization_id', targetOrgId)
      .single();

    let stripeCustomerId = billingProfile?.stripe_customer_id;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: organization.business_name,
        metadata: {
          organization_id: targetOrgId,
          organization_slug: organization.slug,
          supabase_user_id: user.id,
        },
      });
      stripeCustomerId = customer.id;

      if (billingProfile) {
        await supabase
          .from('billing_profiles')
          .update({ stripe_customer_id: stripeCustomerId, updated_at: new Date().toISOString() })
          .eq('organization_id', targetOrgId);
      } else {
        await supabase
          .from('billing_profiles')
          .insert({
            organization_id: targetOrgId,
            stripe_customer_id: stripeCustomerId,
          });
      }
    }

    const baseUrl = Deno.env.get('APP_URL') || 'https://app.autolisting.io';
    const checkoutMode = mode === 'subscription' ? 'subscription' : 'payment';

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: checkoutMode,
      automatic_tax: { enabled: true },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      success_url: successUrl || `${baseUrl}/admin/billing/manage?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${baseUrl}/admin/billing/manage?canceled=true`,
      metadata: {
        organization_id: targetOrgId,
        organization_slug: organization.slug,
        user_id: user.id,
        plan_name: planName || '',
      },
      ...(checkoutMode === 'subscription' ? {
        subscription_data: {
          metadata: {
            organization_id: targetOrgId,
            organization_slug: organization.slug,
            plan_name: planName || '',
          },
        },
      } : {}),
    });

    console.log(`[STRIPE] Created checkout session ${session.id} for org ${targetOrgId} (plan: ${planName || 'credit_pack'})`);

    return new Response(
      JSON.stringify({
        url: session.url,
        sessionId: session.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Checkout error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
