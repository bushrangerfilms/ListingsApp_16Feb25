/**
 * Stripe Product Seeding Script
 * 
 * Creates the subscription plan and credit packs in Stripe:
 * - Base subscription: €49/month (includes 200 credits)
 * - Credit packs: 100/€25, 500/€110, 2000/€400, 5000/€900
 * 
 * Run with: npx tsx scripts/seed-stripe-products.ts
 * 
 * After running, update the credit_packs table in Supabase with the generated price IDs.
 */

import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error('ERROR: STRIPE_SECRET_KEY environment variable is required');
  console.error('Set it in your .env file or environment');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2025-08-27.basil',
});

interface ProductConfig {
  name: string;
  description: string;
  metadata: Record<string, string>;
  price: {
    unit_amount: number;
    currency: string;
    recurring?: { interval: 'month' | 'year' };
  };
}

const products: ProductConfig[] = [
  {
    name: 'AutoListing Pro - Monthly',
    description: 'Base subscription for AutoListing.io - includes 200 credits per month',
    metadata: {
      type: 'subscription',
      credits_included: '200',
      app: 'autolisting',
    },
    price: {
      unit_amount: 4900,
      currency: 'eur',
      recurring: { interval: 'month' },
    },
  },
  {
    name: '100 Credits Pack',
    description: '100 credits for social media automation - €0.25 per credit',
    metadata: {
      type: 'credit_pack',
      credits: '100',
      app: 'autolisting',
    },
    price: {
      unit_amount: 2500,
      currency: 'eur',
    },
  },
  {
    name: '500 Credits Pack',
    description: '500 credits for social media automation - €0.22 per credit (12% savings)',
    metadata: {
      type: 'credit_pack',
      credits: '500',
      discount_percentage: '12',
      app: 'autolisting',
    },
    price: {
      unit_amount: 11000,
      currency: 'eur',
    },
  },
  {
    name: '2000 Credits Pack',
    description: '2000 credits for social media automation - €0.20 per credit (20% savings)',
    metadata: {
      type: 'credit_pack',
      credits: '2000',
      discount_percentage: '20',
      app: 'autolisting',
    },
    price: {
      unit_amount: 40000,
      currency: 'eur',
    },
  },
  {
    name: '5000 Credits Pack',
    description: '5000 credits for social media automation - €0.18 per credit (28% savings)',
    metadata: {
      type: 'credit_pack',
      credits: '5000',
      discount_percentage: '28',
      app: 'autolisting',
    },
    price: {
      unit_amount: 90000,
      currency: 'eur',
    },
  },
];

async function createProducts() {
  console.log('🚀 Starting Stripe product creation...\n');

  const results: { product: string; productId: string; priceId: string }[] = [];

  for (const config of products) {
    console.log(`Creating: ${config.name}`);

    const existingProducts = await stripe.products.search({
      query: `name:'${config.name}'`,
    });

    let product: Stripe.Product;

    if (existingProducts.data.length > 0) {
      product = existingProducts.data[0];
      console.log(`  ⚡ Product already exists: ${product.id}`);
    } else {
      product = await stripe.products.create({
        name: config.name,
        description: config.description,
        metadata: config.metadata,
      });
      console.log(`  ✅ Created product: ${product.id}`);
    }

    const existingPrices = await stripe.prices.list({
      product: product.id,
      active: true,
    });

    let price: Stripe.Price;

    const matchingPrice = existingPrices.data.find(p => 
      p.unit_amount === config.price.unit_amount &&
      p.currency === config.price.currency &&
      (config.price.recurring 
        ? p.recurring?.interval === config.price.recurring.interval
        : !p.recurring)
    );

    if (matchingPrice) {
      price = matchingPrice;
      console.log(`  ⚡ Price already exists: ${price.id}`);
    } else {
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: config.price.unit_amount,
        currency: config.price.currency,
        ...(config.price.recurring ? { recurring: config.price.recurring } : {}),
      });
      console.log(`  ✅ Created price: ${price.id}`);
    }

    results.push({
      product: config.name,
      productId: product.id,
      priceId: price.id,
    });

    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('📋 STRIPE PRODUCT/PRICE IDs - Save these!\n');
  
  for (const result of results) {
    console.log(`${result.product}:`);
    console.log(`  Product ID: ${result.productId}`);
    console.log(`  Price ID:   ${result.priceId}`);
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('\n📝 SQL to update credit_packs table:\n');

  const creditPacks = results.filter(r => r.product.includes('Credits Pack'));
  
  for (const pack of creditPacks) {
    const credits = pack.product.match(/(\d+)/)?.[1];
    console.log(`UPDATE public.credit_packs 
SET stripe_price_id = '${pack.priceId}', 
    stripe_product_id = '${pack.productId}',
    updated_at = now()
WHERE credits = ${credits};
`);
  }

  const subscription = results.find(r => r.product.includes('Monthly'));
  if (subscription) {
    console.log(`-- Subscription price ID for frontend: ${subscription.priceId}`);
  }

  console.log('\n✅ Done! Copy the SQL above to update your credit_packs table.');
}

createProducts().catch(console.error);
