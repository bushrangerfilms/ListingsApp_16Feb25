/**
 * scripts/seed-stripe-prices.ts — Seed Stripe Price objects from
 * /locale-config/pricing.yaml.
 *
 * Reads pricing.yaml.  For every plan × currency row whose `stripe_id` is
 * null, finds the existing Stripe Product (by `name === plan.name`) and
 * creates a new Stripe Price under it for that currency.  Writes the
 * resulting `price_xxxxx` ID back into the yaml file.  Then syncs
 * `plan_definitions.price_cents_<currency>` and `stripe_monthly_price_id_<currency>`
 * columns so `stripe-checkout` can find them.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_live_… SUPABASE_SERVICE_ROLE_KEY=… \
 *   npx tsx scripts/seed-stripe-prices.ts
 *
 *   --dry-run   Preview the prices that would be created; don't call Stripe API.
 *   --currency CURRENCY  Limit to one currency (e.g. --currency USD).
 *
 * Idempotent: rows with `stripe_id` already populated are skipped.  Re-run
 * after editing pricing.yaml to activate additional currencies.
 *
 * The script never modifies the EUR rows — those are the canonical pricing
 * already wired into plan_definitions.monthly_price_cents and
 * stripe_monthly_price_id.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const PRICING_YAML_PATH = resolve(REPO_ROOT, 'locale-config/pricing.yaml');

interface CliFlags {
  dryRun: boolean;
  currencyFilter?: string;
}

function parseFlags(): CliFlags {
  const argv = process.argv.slice(2);
  const flags: CliFlags = { dryRun: argv.includes('--dry-run') };
  const currencyIdx = argv.indexOf('--currency');
  if (currencyIdx !== -1 && argv[currencyIdx + 1]) {
    flags.currencyFilter = argv[currencyIdx + 1].toUpperCase();
  }
  return flags;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`❌ ${name} env var required`);
    process.exit(2);
  }
  return v;
}

const PLAN_DISPLAY_NAMES: Record<string, string> = {
  essentials: 'AutoListing Essentials',
  growth: 'AutoListing Growth',
  professional: 'AutoListing Professional',
  multi_branch_s: 'AutoListing Multi-Branch S',
  multi_branch_m: 'AutoListing Multi-Branch M',
  multi_branch_l: 'AutoListing Multi-Branch L',
};

async function findOrCreateProduct(stripe: Stripe, planName: string): Promise<string> {
  // Find by exact metadata match — name is more idiomatic for a unique key
  const existing = await stripe.products.search({ query: `metadata['plan_name']:'${planName}' AND active:'true'` });
  if (existing.data.length > 0) return existing.data[0].id;

  // Fallback: search by display name
  const byName = await stripe.products.list({ active: true, limit: 100 });
  const byNameMatch = byName.data.find((p) => p.name === PLAN_DISPLAY_NAMES[planName]);
  if (byNameMatch) {
    // Backfill plan_name metadata on the existing product so future lookups
    // are O(1) by metadata
    if (byNameMatch.metadata?.plan_name !== planName) {
      await stripe.products.update(byNameMatch.id, { metadata: { plan_name: planName } });
    }
    return byNameMatch.id;
  }

  // Create
  const product = await stripe.products.create({
    name: PLAN_DISPLAY_NAMES[planName] ?? planName,
    metadata: { plan_name: planName },
  });
  return product.id;
}

async function main() {
  const flags = parseFlags();
  const stripeKey = requireEnv('STRIPE_SECRET_KEY');
  const supabaseUrl = requireEnv('VITE_SUPABASE_URL') || requireEnv('SUPABASE_URL');
  const supabaseKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  // apiVersion intentionally omitted — let the Stripe SDK pick its default
  // (current SDK uses 2025-08-27.basil); the Price-create call doesn't depend
  // on a specific API version, and pinning forces SDK version coupling.
  const stripe = new Stripe(stripeKey);
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(flags.dryRun ? '🔍 DRY RUN — no Stripe API calls or DB writes\n' : '🚀 LIVE — will call Stripe API and write DB\n');

  const yamlText = readFileSync(PRICING_YAML_PATH, 'utf8');
  const doc = parseDocument(yamlText);
  const plans = doc.get('plans') as ReturnType<typeof doc.get>;
  if (!plans || typeof plans !== 'object') {
    console.error('❌ pricing.yaml: no `plans` map found');
    process.exit(2);
  }

  const billingInterval = (doc.get('billing_interval') as string) ?? 'week';
  const planNames: string[] = (plans as { items: { key: { value: string } }[] }).items.map((p) => p.key.value);

  let created = 0;
  let skipped = 0;
  let dbUpdates = 0;

  for (const planName of planNames) {
    const plan = (plans as ReturnType<typeof doc.get> & { get: (k: string) => unknown }).get(planName) as
      | (ReturnType<typeof doc.get> & { items: { key: { value: string }; value: { get: (k: string) => unknown; set: (k: string, v: unknown) => void } }[] })
      | null;
    if (!plan) continue;

    let productId: string | null = null;

    for (const entry of plan.items) {
      const currency = entry.key.value;
      if (flags.currencyFilter && currency !== flags.currencyFilter) continue;
      if (currency === 'EUR') {
        // EUR is canonical and pre-populated; never overwrite
        continue;
      }

      const cell = entry.value;
      const stripeId = cell.get('stripe_id') as string | null;
      const priceCents = cell.get('price_cents') as number | null;

      if (stripeId) {
        skipped++;
        continue;
      }
      if (priceCents == null || priceCents <= 0) {
        console.warn(`⚠️  ${planName}/${currency}: price_cents not set, skipping`);
        skipped++;
        continue;
      }

      // Resolve product lazily (only if we have at least one currency to seed for this plan)
      if (!productId) {
        if (flags.dryRun) {
          productId = '<would-resolve>';
        } else {
          productId = await findOrCreateProduct(stripe, planName);
        }
      }

      console.log(`  + ${planName.padEnd(16)} ${currency}  ${(priceCents / 100).toFixed(2)} ${currency}/${billingInterval}`);

      if (flags.dryRun) {
        created++;
        continue;
      }

      const price = await stripe.prices.create({
        product: productId,
        unit_amount: priceCents,
        currency: currency.toLowerCase(),
        recurring: { interval: billingInterval as 'week' | 'month' | 'year' },
        metadata: { plan_name: planName, source: 'seed-stripe-prices' },
      });

      cell.set('stripe_id', price.id);
      created++;

      // Sync to DB
      const dbColumn = `stripe_monthly_price_id_${currency.toLowerCase()}`;
      const centsColumn = `price_cents_${currency.toLowerCase()}`;
      const { error } = await supabase
        .from('plan_definitions')
        .update({ [dbColumn]: price.id, [centsColumn]: priceCents })
        .eq('name', planName);
      if (error) {
        console.error(`  ❌ DB update failed for ${planName}/${currency}: ${error.message}`);
      } else {
        dbUpdates++;
      }
    }
  }

  if (!flags.dryRun && created > 0) {
    writeFileSync(PRICING_YAML_PATH, doc.toString());
    console.log(`\n✏️  Wrote ${created} new stripe_id(s) back to ${PRICING_YAML_PATH.replace(REPO_ROOT + '/', '')}`);
  }

  console.log(`\n${flags.dryRun ? 'WOULD CREATE' : 'created'} ${created}  skipped ${skipped}  db updates ${dbUpdates}`);

  if (!flags.dryRun && created > 0) {
    console.log('\n📝 Next: commit the updated pricing.yaml so the new IDs are versioned alongside the canonical config.');
  }
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
