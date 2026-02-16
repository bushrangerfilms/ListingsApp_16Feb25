import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CheckoutRequest {
  priceId: string;
  mode: 'subscription' | 'payment';
  organizationId: string;
  planName?: 'starter' | 'pro';
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
    const { priceId, mode, organizationId: requestedOrgId, planName, successUrl, cancelUrl } = body;

    if (!priceId) {
      return new Response(
        JSON.stringify({ error: 'priceId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!requestedOrgId) {
      return new Response(
        JSON.stringify({ error: 'organizationId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
      const { data: planDef, error: planError } = await supabase
        .from('plan_definitions')
        .select('stripe_price_id, name')
        .eq('stripe_price_id', priceId)
        .eq('is_active', true)
        .single();
      
      if (planError || !planDef) {
        console.error('Invalid subscription price ID:', priceId);
        return new Response(
          JSON.stringify({ error: 'Invalid subscription price' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: checkoutMode,
      success_url: successUrl || `${baseUrl}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${baseUrl}/billing?canceled=true`,
      metadata: {
        organization_id: targetOrgId,
        organization_slug: organization.slug,
        user_id: user.id,
        plan_name: planName || 'starter',
      },
      ...(checkoutMode === 'subscription' ? {
        subscription_data: {
          metadata: {
            organization_id: targetOrgId,
            organization_slug: organization.slug,
            plan_name: planName || 'starter',
          },
        },
      } : {}),
    });

    console.log(`[STRIPE] Created checkout session ${session.id} for org ${targetOrgId}`);

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
