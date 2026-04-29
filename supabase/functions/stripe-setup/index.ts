import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-key',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Plan definitions matching the DB plan_definitions table
const PLAN_CONFIGS = [
  { name: 'essentials', displayName: 'AutoListing Essentials', description: 'Up to 10 listings with automated social posting', priceCents: 4000, interval: 'week' as const },
  { name: 'growth', displayName: 'AutoListing Growth', description: 'Up to 25 listings with automated social posting', priceCents: 7000, interval: 'week' as const },
  { name: 'professional', displayName: 'AutoListing Professional', description: 'Up to 50 listings with automated social posting', priceCents: 13000, interval: 'week' as const },
  { name: 'multi_branch_s', displayName: 'AutoListing Multi-Branch S', description: 'Up to 80 listings across 2 social hubs', priceCents: 17000, interval: 'week' as const },
  { name: 'multi_branch_m', displayName: 'AutoListing Multi-Branch M', description: 'Up to 200 listings across 5 social hubs', priceCents: 25000, interval: 'week' as const },
  { name: 'multi_branch_l', displayName: 'AutoListing Multi-Branch L', description: 'Up to 400 listings across 10 social hubs', priceCents: 35000, interval: 'week' as const },
];

const CREDIT_PACK_CONFIGS = [
  { name: '100 Credits', credits: 100, priceCents: 2500 },
  { name: '500 Credits', credits: 500, priceCents: 11000 },
  { name: '2000 Credits', credits: 2000, priceCents: 40000 },
  { name: '5000 Credits', credits: 5000, priceCents: 90000 },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check
  if (req.method === 'GET') {
    return jsonResponse({ status: 'ok', description: 'Stripe setup endpoint — POST to run setup' });
  }

  try {
    // Auth: internal key
    const internalKey = Deno.env.get('INTERNAL_API_KEY');
    const providedKey = req.headers.get('x-internal-key');
    if (!internalKey || providedKey !== internalKey) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      return jsonResponse({ error: 'STRIPE_SECRET_KEY not configured' }, 500);
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;

    const results: Record<string, unknown> = { dry_run: dryRun };
    const planResults: Record<string, { productId: string; priceId: string }>  = {};
    const creditPackResults: Record<number, { productId: string; priceId: string }> = {};

    // ─── 1. Create subscription products + weekly prices ───
    console.log('[stripe-setup] Creating subscription products...');
    for (const plan of PLAN_CONFIGS) {
      console.log(`  Processing: ${plan.displayName}`);

      // Check for existing product
      const existing = await stripe.products.search({
        query: `name:'${plan.displayName}'`,
      });

      let product: Stripe.Product;
      if (existing.data.length > 0) {
        product = existing.data[0];
        console.log(`  Product exists: ${product.id}`);
      } else if (dryRun) {
        console.log(`  [DRY RUN] Would create product: ${plan.displayName}`);
        planResults[plan.name] = { productId: 'dry_run', priceId: 'dry_run' };
        continue;
      } else {
        product = await stripe.products.create({
          name: plan.displayName,
          description: plan.description,
          metadata: {
            plan_name: plan.name,
            app: 'autolisting',
          },
        });
        console.log(`  Created product: ${product.id}`);
      }

      // Check for existing matching price
      const existingPrices = await stripe.prices.list({
        product: product.id,
        active: true,
      });

      const matchingPrice = existingPrices.data.find(p =>
        p.unit_amount === plan.priceCents &&
        p.currency === 'eur' &&
        p.recurring?.interval === plan.interval
      );

      let price: Stripe.Price;
      if (matchingPrice) {
        price = matchingPrice;
        console.log(`  Price exists: ${price.id}`);
      } else if (dryRun) {
        console.log(`  [DRY RUN] Would create price: EUR ${plan.priceCents / 100}/${plan.interval}`);
        planResults[plan.name] = { productId: product.id, priceId: 'dry_run' };
        continue;
      } else {
        price = await stripe.prices.create({
          product: product.id,
          unit_amount: plan.priceCents,
          currency: 'eur',
          recurring: { interval: plan.interval },
          metadata: { plan_name: plan.name },
        });
        console.log(`  Created price: ${price.id}`);
      }

      planResults[plan.name] = { productId: product.id, priceId: price.id };
    }
    results.plans = planResults;

    // ─── 2. Create credit pack products + one-time prices ───
    console.log('[stripe-setup] Creating credit pack products...');
    for (const pack of CREDIT_PACK_CONFIGS) {
      const productName = `AutoListing ${pack.name}`;
      console.log(`  Processing: ${productName}`);

      const existing = await stripe.products.search({
        query: `name:'${productName}'`,
      });

      let product: Stripe.Product;
      if (existing.data.length > 0) {
        product = existing.data[0];
        console.log(`  Product exists: ${product.id}`);
      } else if (dryRun) {
        console.log(`  [DRY RUN] Would create product: ${productName}`);
        creditPackResults[pack.credits] = { productId: 'dry_run', priceId: 'dry_run' };
        continue;
      } else {
        product = await stripe.products.create({
          name: productName,
          description: `${pack.credits} credits for AutoListing.io`,
          metadata: {
            type: 'credit_pack',
            credits: pack.credits.toString(),
            app: 'autolisting',
          },
        });
        console.log(`  Created product: ${product.id}`);
      }

      const existingPrices = await stripe.prices.list({
        product: product.id,
        active: true,
      });

      const matchingPrice = existingPrices.data.find(p =>
        p.unit_amount === pack.priceCents &&
        p.currency === 'eur' &&
        !p.recurring
      );

      let price: Stripe.Price;
      if (matchingPrice) {
        price = matchingPrice;
        console.log(`  Price exists: ${price.id}`);
      } else if (dryRun) {
        console.log(`  [DRY RUN] Would create price: EUR ${pack.priceCents / 100}`);
        creditPackResults[pack.credits] = { productId: product.id, priceId: 'dry_run' };
        continue;
      } else {
        price = await stripe.prices.create({
          product: product.id,
          unit_amount: pack.priceCents,
          currency: 'eur',
          metadata: { type: 'credit_pack', credits: pack.credits.toString() },
        });
        console.log(`  Created price: ${price.id}`);
      }

      creditPackResults[pack.credits] = { productId: product.id, priceId: price.id };
    }
    results.credit_packs = creditPackResults;

    // ─── 3. Configure Customer Portal ───
    console.log('[stripe-setup] Configuring Customer Portal...');
    const portalPriceIds = Object.values(planResults)
      .filter(p => p.priceId !== 'dry_run')
      .map(p => p.priceId);

    if (dryRun) {
      console.log(`  [DRY RUN] Would configure portal with ${portalPriceIds.length} prices`);
      results.portal = { status: 'dry_run' };
    } else if (portalPriceIds.length > 0) {
      // List existing portal configs
      const existingConfigs = await stripe.billingPortal.configurations.list({ limit: 1 });

      const portalProducts = Object.values(planResults)
        .filter(p => p.priceId !== 'dry_run')
        .map(p => ({
          product: p.productId,
          prices: [p.priceId],
        }));

      const portalConfig = {
        business_profile: {
          headline: 'AutoListing.io — Manage your subscription',
        },
        features: {
          customer_update: {
            enabled: true,
            allowed_updates: ['email', 'address', 'phone'] as Stripe.BillingPortal.ConfigurationCreateParams.Features.CustomerUpdate.AllowedUpdate[],
          },
          invoice_history: { enabled: true },
          payment_method_update: { enabled: true },
          subscription_cancel: {
            enabled: true,
            mode: 'at_period_end' as const,
          },
          subscription_update: {
            enabled: true,
            default_allowed_updates: ['price'] as Stripe.BillingPortal.ConfigurationCreateParams.Features.SubscriptionUpdate.DefaultAllowedUpdate[],
            proration_behavior: 'create_prorations' as const,
            products: portalProducts,
          },
        },
        default_return_url: 'https://app.autolisting.io/admin/billing/manage',
      };

      if (existingConfigs.data.length > 0) {
        // Update existing config
        const configId = existingConfigs.data[0].id;
        await stripe.billingPortal.configurations.update(configId, portalConfig);
        console.log(`  Updated existing portal config: ${configId}`);
        results.portal = { status: 'updated', config_id: configId };
      } else {
        const config = await stripe.billingPortal.configurations.create(portalConfig);
        console.log(`  Created portal config: ${config.id}`);
        results.portal = { status: 'created', config_id: config.id };
      }
    } else {
      results.portal = { status: 'skipped', reason: 'no prices created' };
    }

    // ─── 4. Verify webhook endpoint ───
    console.log('[stripe-setup] Checking webhook endpoint...');
    const webhookUrl = 'https://sjcfcxjpukgeaxxkffpq.supabase.co/functions/v1/stripe-webhook';
    const requiredEvents = [
      'checkout.session.completed',
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.payment_succeeded',
      'invoice.payment_failed',
      'charge.refunded',
      'charge.dispute.created',
    ];

    const webhooks = await stripe.webhookEndpoints.list({ limit: 100 });
    const existingWebhook = webhooks.data.find(wh => wh.url === webhookUrl);

    if (existingWebhook) {
      const missingEvents = requiredEvents.filter(e => !existingWebhook.enabled_events.includes(e as Stripe.WebhookEndpoint.EnabledEvent));
      if (missingEvents.length > 0) {
        if (!dryRun) {
          await stripe.webhookEndpoints.update(existingWebhook.id, {
            enabled_events: requiredEvents as Stripe.WebhookEndpoint.EnabledEvent[],
          });
          console.log(`  Updated webhook with missing events: ${missingEvents.join(', ')}`);
        }
        results.webhook = { status: 'updated', added_events: missingEvents };
      } else {
        console.log(`  Webhook exists and has all required events`);
        results.webhook = { status: 'ok', id: existingWebhook.id };
      }
    } else {
      console.log(`  No webhook found at ${webhookUrl}`);
      results.webhook = {
        status: 'missing',
        message: 'Webhook endpoint not found. It may be configured as an Event Destination instead (Stripe Dashboard > Developers > Event Destinations).',
        url: webhookUrl,
      };
    }

    // ─── 5. Update DB with Stripe IDs ───
    if (!dryRun) {
      console.log('[stripe-setup] Updating plan_definitions in DB...');
      for (const [planName, ids] of Object.entries(planResults)) {
        if (ids.priceId === 'dry_run') continue;
        const { error } = await supabase
          .from('plan_definitions')
          .update({
            stripe_monthly_price_id: ids.priceId,
            updated_at: new Date().toISOString(),
          })
          .eq('name', planName);

        if (error) {
          console.error(`  Failed to update plan ${planName}:`, error.message);
        } else {
          console.log(`  Updated ${planName}: stripe_monthly_price_id = ${ids.priceId}`);
        }
      }

      console.log('[stripe-setup] Updating credit_packs in DB...');
      for (const [credits, ids] of Object.entries(creditPackResults)) {
        if (ids.priceId === 'dry_run') continue;
        const { error } = await supabase
          .from('credit_packs')
          .update({
            stripe_price_id: ids.priceId,
            stripe_product_id: ids.productId,
            updated_at: new Date().toISOString(),
          })
          .eq('credits', parseInt(credits));

        if (error) {
          console.error(`  Failed to update credit pack ${credits}:`, error.message);
        } else {
          console.log(`  Updated ${credits} credits: stripe_price_id = ${ids.priceId}`);
        }
      }
      results.db_updates = 'completed';
    } else {
      results.db_updates = 'skipped (dry run)';
    }

    console.log('[stripe-setup] Setup complete!');
    return jsonResponse({ success: true, ...results });

  } catch (error) {
    console.error('[stripe-setup] Error:', error);
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, 500);
  }
});
