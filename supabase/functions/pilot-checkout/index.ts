import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-key',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // --- GET: Health check ---
  if (req.method === 'GET') {
    const stripeConfigured = !!Deno.env.get('STRIPE_SECRET_KEY');
    const internalKeyConfigured = !!Deno.env.get('INTERNAL_API_KEY');
    return jsonResponse({
      status: 'ok',
      stripe_configured: stripeConfigured,
      internal_key_configured: internalKeyConfigured,
      timestamp: new Date().toISOString(),
    });
  }

  // --- POST: Create checkout session ---
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // Auth: require x-internal-key header
  const internalKey = Deno.env.get('INTERNAL_API_KEY');
  if (!internalKey) {
    console.error('INTERNAL_API_KEY not configured');
    return jsonResponse({ error: 'Server misconfigured: missing internal key' }, 500);
  }

  const providedKey = req.headers.get('x-internal-key');
  if (!providedKey || providedKey !== internalKey) {
    return jsonResponse({ error: 'Unauthorized: invalid or missing x-internal-key' }, 401);
  }

  // Stripe key
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeSecretKey) {
    console.error('STRIPE_SECRET_KEY not configured');
    return jsonResponse({ error: 'Stripe not configured' }, 500);
  }

  try {
    const body = await req.json();
    const {
      priceId,
      customerEmail,
      trialDays = 0,
      clientRef,
      quantity = 1,
    } = body as {
      priceId?: string;
      customerEmail?: string;
      trialDays?: number;
      clientRef?: string;
      quantity?: number;
    };

    // Validate required fields
    if (!priceId || typeof priceId !== 'string' || !priceId.startsWith('price_')) {
      return jsonResponse({ error: 'priceId is required and must be a valid Stripe Price ID (price_...)' }, 400);
    }

    if (trialDays < 0 || trialDays > 730) {
      return jsonResponse({ error: 'trialDays must be between 0 and 730' }, 400);
    }

    if (quantity < 1 || quantity > 100) {
      return jsonResponse({ error: 'quantity must be between 1 and 100' }, 400);
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const appBaseUrl = Deno.env.get('APP_URL') || 'https://app.autolisting.io';

    // Build checkout session params
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity }],
      automatic_tax: { enabled: true },
      success_url: `${appBaseUrl}/admin/billing/manage?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBaseUrl}/admin/billing/manage?canceled=true`,
      metadata: {
        clientRef: clientRef || '',
        priceId,
        trialDays: String(trialDays),
        source: 'pilot-checkout',
      },
    };

    // Customer email
    if (customerEmail) {
      sessionParams.customer_email = customerEmail;
    }

    // Trial period
    if (trialDays > 0) {
      sessionParams.subscription_data = {
        trial_period_days: trialDays,
        metadata: {
          clientRef: clientRef || '',
          source: 'pilot-checkout',
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log(`[PILOT-CHECKOUT] Created session ${session.id} | email=${customerEmail || 'none'} | trial=${trialDays}d | ref=${clientRef || 'none'}`);

    return jsonResponse({
      url: session.url,
      sessionId: session.id,
      trialDays,
      customerEmail: customerEmail || null,
      clientRef: clientRef || null,
    });

  } catch (error) {
    console.error('[PILOT-CHECKOUT] Error:', error);

    // Return safe error messages
    if (error instanceof Stripe.errors.StripeError) {
      return jsonResponse({
        error: `Stripe error: ${error.message}`,
        type: error.type,
      }, 400);
    }

    return jsonResponse({
      error: error instanceof Error ? error.message : 'Unknown error creating checkout session',
    }, 500);
  }
});
