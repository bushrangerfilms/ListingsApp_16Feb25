/**
 * Seed Stripe Products for Subscription Plans
 * 
 * This script creates the Starter and Pro subscription products in Stripe.
 * Run with: npx tsx scripts/seed-stripe-plans.ts
 * 
 * Following the Stripe integration guide - products are created via Stripe API,
 * and webhooks automatically sync them to the database.
 */

import Stripe from 'stripe';

async function getStripeClient(): Promise<Stripe> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  const connectorName = 'stripe';
  const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
  const targetEnvironment = isProduction ? 'production' : 'development';

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set('include_secrets', 'true');
  url.searchParams.set('connector_names', connectorName);
  url.searchParams.set('environment', targetEnvironment);

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'X_REPLIT_TOKEN': xReplitToken
    }
  });

  const data = await response.json();
  const connectionSettings = data.items?.[0];

  if (!connectionSettings?.settings?.secret) {
    throw new Error(`Stripe ${targetEnvironment} connection not found`);
  }

  return new Stripe(connectionSettings.settings.secret, {
    apiVersion: '2025-08-27.basil' as any,
  });
}

async function seedSubscriptionPlans() {
  console.log('Seeding Stripe subscription plans...');
  
  const stripe = await getStripeClient();

  const plans = [
    {
      name: 'starter',
      displayName: 'AutoListing.io Starter',
      description: 'Perfect for solo agents getting started. Includes 200 credits/month.',
      priceCents: 2900,
      currency: 'eur',
      monthlyCredits: 200,
      maxUsers: 1,
    },
    {
      name: 'pro',
      displayName: 'AutoListing.io Pro',
      description: 'For growing teams and agencies. Includes 500 credits/month and up to 10 users.',
      priceCents: 7900,
      currency: 'eur',
      monthlyCredits: 500,
      maxUsers: 10,
    },
  ];

  for (const plan of plans) {
    console.log(`\nProcessing ${plan.displayName}...`);

    const existingProducts = await stripe.products.search({
      query: `name:'${plan.displayName}'`,
    });

    if (existingProducts.data.length > 0) {
      console.log(`  Product already exists: ${existingProducts.data[0].id}`);
      
      const existingPrices = await stripe.prices.list({
        product: existingProducts.data[0].id,
        active: true,
      });
      
      if (existingPrices.data.length > 0) {
        console.log(`  Price already exists: ${existingPrices.data[0].id}`);
        console.log(`  Stripe Product ID: ${existingProducts.data[0].id}`);
        console.log(`  Stripe Price ID: ${existingPrices.data[0].id}`);
        continue;
      }
    }

    const product = await stripe.products.create({
      name: plan.displayName,
      description: plan.description,
      metadata: {
        plan_name: plan.name,
        monthly_credits: plan.monthlyCredits.toString(),
        max_users: plan.maxUsers.toString(),
        app: 'autolisting',
      },
    });

    console.log(`  Created product: ${product.id}`);

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.priceCents,
      currency: plan.currency,
      recurring: {
        interval: 'month',
      },
      metadata: {
        plan_name: plan.name,
      },
    });

    console.log(`  Created price: ${price.id}`);
    console.log(`  Stripe Product ID: ${product.id}`);
    console.log(`  Stripe Price ID: ${price.id}`);
  }

  console.log('\n\nNow seed credit packs...');

  const creditPacks = [
    { name: '100 Credits', credits: 100, priceCents: 2500 },
    { name: '500 Credits', credits: 500, priceCents: 11000 },
    { name: '2000 Credits', credits: 2000, priceCents: 40000 },
    { name: '5000 Credits', credits: 5000, priceCents: 90000 },
  ];

  for (const pack of creditPacks) {
    console.log(`\nProcessing ${pack.name}...`);

    const existingProducts = await stripe.products.search({
      query: `name:'AutoListing.io ${pack.name}'`,
    });

    if (existingProducts.data.length > 0) {
      console.log(`  Product already exists: ${existingProducts.data[0].id}`);
      continue;
    }

    const product = await stripe.products.create({
      name: `AutoListing.io ${pack.name}`,
      description: `${pack.credits} credits for AutoListing.io platform`,
      metadata: {
        type: 'credit_pack',
        credits: pack.credits.toString(),
        app: 'autolisting',
      },
    });

    console.log(`  Created product: ${product.id}`);

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: pack.priceCents,
      currency: 'eur',
      metadata: {
        type: 'credit_pack',
        credits: pack.credits.toString(),
      },
    });

    console.log(`  Created price: ${price.id}`);
  }

  console.log('\n\nDone! Products and prices have been created in Stripe.');
  console.log('Webhooks will automatically sync them to the database.');
}

seedSubscriptionPlans().catch(console.error);
