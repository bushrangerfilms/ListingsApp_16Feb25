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

    // If planName provided without priceId, look up the Stripe price from plan_definitions
    if (!priceId && planName) {
      const { data: planDef, error: planError } = await supabase
        .from('plan_definitions')
        .select('stripe_monthly_price_id, name')
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

      if (!planDef.stripe_monthly_price_id) {
        console.error('Plan has no Stripe price configured:', planName);
        return new Response(
          JSON.stringify({ error: `Plan '${planName}' is not yet available for purchase` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      priceId = planDef.stripe_monthly_price_id;
      mode = mode || 'subscription';
      console.log(`[STRIPE] Resolved plan '${planName}' to price ${priceId}`);
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
      // Validate price exists in plan_definitions (check both column names for compatibility)
      const { data: planDef, error: planError } = await supabase
        .from('plan_definitions')
        .select('stripe_monthly_price_id, name')
        .eq('stripe_monthly_price_id', priceId)
        .eq('is_active', true)
        .single();

      if (planError || !planDef) {
        console.error('Invalid subscription price ID:', priceId);
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
