import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const internalKey = Deno.env.get('INTERNAL_API_KEY');
  const providedKey = req.headers.get('x-internal-key');
  if (!internalKey || !providedKey || providedKey !== internalKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  });

  try {
    const url = new URL(req.url);
    const productId = url.searchParams.get('product');

    const params: Record<string, unknown> = { active: true, limit: 50 };
    if (productId) params.product = productId;

    const prices = await stripe.prices.list(params as any);

    const results = prices.data.map((p: any) => ({
      id: p.id,
      product: p.product,
      unit_amount: p.unit_amount,
      currency: p.currency,
      recurring: p.recurring ? {
        interval: p.recurring.interval,
        interval_count: p.recurring.interval_count,
      } : null,
      nickname: p.nickname,
    }));

    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
