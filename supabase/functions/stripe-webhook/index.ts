import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  // Try the new webhook secret first (for new event destination), fall back to original
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET_2') || Deno.env.get('STRIPE_WEBHOOK_SECRET');

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

  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    let event: Stripe.Event;

    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET not configured - rejecting webhook');
      return new Response(
        JSON.stringify({ error: 'Webhook secret not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!signature) {
      console.error('Missing stripe-signature header');
      return new Response(
        JSON.stringify({ error: 'Missing signature' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret,
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[WEBHOOK] Received event: ${event.type} (${event.id})`);

    // H8: Global event deduplication — prevents retries from causing duplicate side effects
    const { data: alreadyProcessed } = await supabase
      .from('processed_stripe_events')
      .select('event_id')
      .eq('event_id', event.id)
      .maybeSingle();

    if (alreadyProcessed) {
      console.log(`[WEBHOOK] Event ${event.id} already processed, returning 200`);
      return new Response(
        JSON.stringify({ received: true, duplicate: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Record event as being processed (before handling, to prevent concurrent retries)
    await supabase.from('processed_stripe_events').insert({
      event_id: event.id,
      event_type: event.type,
    });

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(supabase, stripe, session, event.id);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(supabase, subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCanceled(supabase, subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription && invoice.billing_reason === 'subscription_cycle') {
          await handleSubscriptionRenewal(supabase, stripe, invoice, event.id);
        }
        // Phase 2.5: Also handle payment recovery (after previous failure)
        if (invoice.subscription) {
          await handlePaymentRecovery(supabase, stripe, invoice);
        }
        break;
      }

      // Phase 2.5: Handle payment failures
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          await handlePaymentFailed(supabase, stripe, invoice);
        }
        break;
      }

      // M11: Handle refunds — reverse previously granted credits
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        await handleChargeRefunded(supabase, charge, event.id);
        break;
      }

      // M11: Handle disputes — alert and disable spending
      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute;
        await handleDisputeCreated(supabase, dispute, event.id);
        break;
      }

      default:
        console.log(`[WEBHOOK] Unhandled event type: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleCheckoutCompleted(
  supabase: ReturnType<typeof createClient>,
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  eventId: string
) {
  const organizationId = session.metadata?.organization_id;
  if (!organizationId) {
    console.error('[WEBHOOK] No organization_id in session metadata');
    return;
  }

  console.log(`[WEBHOOK] Processing checkout for org ${organizationId}`);

  if (session.mode === 'subscription') {
    const subscriptionId = session.subscription as string;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const planName = session.metadata?.plan_name || 'starter';

    const { data: planDef } = await supabase
      .from('plan_definitions')
      .select('monthly_credits')
      .eq('name', planName)
      .single();

    const monthlyCredits = planDef?.monthly_credits || 200;

    await supabase
      .from('billing_profiles')
      .upsert({
        organization_id: organizationId,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: subscriptionId,
        subscription_status: subscription.status,
        subscription_plan: planName,
        subscription_started_at: new Date(subscription.start_date * 1000).toISOString(),
        subscription_ends_at: subscription.current_period_end 
          ? new Date(subscription.current_period_end * 1000).toISOString() 
          : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id' });

    const { data: existingGrant, error: checkError } = await supabase
      .from('credit_transactions')
      .select('id')
      .eq('stripe_event_id', eventId)
      .maybeSingle();

    if (existingGrant) {
      console.log(`[WEBHOOK] Credits already granted for event ${eventId}, skipping`);
    } else {
      const { data: grantResult, error: grantError } = await supabase.rpc('sp_grant_credits', {
        p_organization_id: organizationId,
        p_amount: monthlyCredits,
        p_source: 'subscription',
        p_description: `Monthly ${planName} subscription credits (${monthlyCredits} credits)`,
        p_stripe_event_id: eventId,
        p_stripe_checkout_session_id: session.id,
        p_source_app: 'crm',
      });

      if (grantError) {
        console.error('[WEBHOOK] Error granting subscription credits:', grantError);
      } else {
        console.log(`[WEBHOOK] Granted ${monthlyCredits} subscription credits to org ${organizationId} (${planName} plan)`);
      }
    }

    // Phase 2.5: Transition organization to 'active' status
    await transitionToActive(supabase, organizationId, 'subscription_started');

  } else if (session.mode === 'payment') {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
    const priceId = lineItems.data[0]?.price?.id;

    if (priceId) {
      const { data: creditPack } = await supabase
        .from('credit_packs')
        .select('credits, name')
        .eq('stripe_price_id', priceId)
        .single();

      if (creditPack) {
        const { data: grantResult, error: grantError } = await supabase.rpc('sp_grant_credits', {
          p_organization_id: organizationId,
          p_amount: creditPack.credits,
          p_source: 'purchase',
          p_description: `Credit pack purchase: ${creditPack.name}`,
          p_stripe_event_id: eventId,
          p_stripe_checkout_session_id: session.id,
          p_stripe_payment_intent_id: session.payment_intent as string,
          p_source_app: 'crm',
        });

        if (grantError) {
          console.error('[WEBHOOK] Error granting credit pack:', grantError);
        } else {
          console.log(`[WEBHOOK] Granted ${creditPack.credits} credits from pack "${creditPack.name}" to org ${organizationId}`);
        }
      } else {
        console.warn(`[WEBHOOK] No credit pack found for price ${priceId}`);
      }
    }
  }
}

async function handleSubscriptionChange(
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription
) {
  const organizationId = subscription.metadata?.organization_id;
  if (!organizationId) {
    console.log('[WEBHOOK] No organization_id in subscription metadata, looking up by customer');
    
    const { data: profile } = await supabase
      .from('billing_profiles')
      .select('organization_id')
      .eq('stripe_customer_id', subscription.customer as string)
      .single();

    if (!profile) {
      console.error('[WEBHOOK] Could not find organization for subscription');
      return;
    }

    await updateSubscriptionStatus(supabase, profile.organization_id, subscription);
  } else {
    await updateSubscriptionStatus(supabase, organizationId, subscription);
  }
}

async function updateSubscriptionStatus(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  subscription: Stripe.Subscription
) {
  await supabase
    .from('billing_profiles')
    .upsert({
      organization_id: organizationId,
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      subscription_plan: 'base',
      subscription_started_at: new Date(subscription.start_date * 1000).toISOString(),
      subscription_ends_at: subscription.current_period_end 
        ? new Date(subscription.current_period_end * 1000).toISOString() 
        : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id' });

  console.log(`[WEBHOOK] Updated subscription status to "${subscription.status}" for org ${organizationId}`);
}

async function handleSubscriptionCanceled(
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription
) {
  const { data: profile } = await supabase
    .from('billing_profiles')
    .select('organization_id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (!profile) {
    console.error('[WEBHOOK] Could not find organization for canceled subscription');
    return;
  }

  const now = new Date();
  const graceEnds = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30-day grace period

  // Update billing profile
  await supabase
    .from('billing_profiles')
    .update({
      subscription_status: 'canceled',
      unsubscribed_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('organization_id', profile.organization_id);

  // Phase 2.5: Transition to unsubscribed state with 30-day grace
  await supabase
    .from('organizations')
    .update({
      account_status: 'unsubscribed',
      credit_spending_enabled: false,
      read_only_reason: 'Subscription canceled. You have 30 days to reactivate before your account is archived.',
      grace_period_ends_at: graceEnds.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('id', profile.organization_id);

  // Log the transition
  await supabase
    .from('account_lifecycle_log')
    .insert({
      organization_id: profile.organization_id,
      previous_status: 'active',
      new_status: 'unsubscribed',
      reason: 'Subscription canceled by user or Stripe',
      triggered_by: 'webhook',
      metadata: {
        subscription_id: subscription.id,
        grace_period_ends_at: graceEnds.toISOString(),
        grace_period_days: 30,
      },
    });

  console.log(`[WEBHOOK] Subscription canceled for org ${profile.organization_id} - 30-day grace period started`);
}

async function handleSubscriptionRenewal(
  supabase: ReturnType<typeof createClient>,
  stripe: Stripe,
  invoice: Stripe.Invoice,
  eventId: string
) {
  const subscriptionId = invoice.subscription as string;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const organizationId = subscription.metadata?.organization_id;
  const planName = subscription.metadata?.plan_name;

  if (!organizationId) {
    const { data: profile } = await supabase
      .from('billing_profiles')
      .select('organization_id, subscription_plan')
      .eq('stripe_subscription_id', subscriptionId)
      .single();

    if (!profile) {
      console.error('[WEBHOOK] Could not find organization for subscription renewal');
      return;
    }

    await grantRenewalCredits(supabase, profile.organization_id, eventId, profile.subscription_plan || planName);
  } else {
    await grantRenewalCredits(supabase, organizationId, eventId, planName);
  }
}

async function grantRenewalCredits(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  eventId: string,
  planName?: string
) {
  const { data: existingGrant } = await supabase
    .from('credit_ledger')
    .select('id')
    .eq('stripe_event_id', eventId)
    .maybeSingle();

  if (existingGrant) {
    console.log(`[WEBHOOK] Renewal credits already granted for event ${eventId}, skipping`);
    return;
  }

  const effectivePlanName = planName || 'starter';
  
  const { data: planDef } = await supabase
    .from('plan_definitions')
    .select('monthly_credits')
    .eq('name', effectivePlanName)
    .single();

  const monthlyCredits = planDef?.monthly_credits || 200;

  const { data: grantResult, error: grantError } = await supabase.rpc('sp_grant_credits', {
    p_organization_id: organizationId,
    p_amount: monthlyCredits,
    p_source: 'subscription',
    p_description: `Monthly ${effectivePlanName} subscription renewal credits (${monthlyCredits} credits)`,
    p_stripe_event_id: eventId,
    p_source_app: 'system',
  });

  if (grantError) {
    console.error('[WEBHOOK] Error granting renewal credits:', grantError);
  } else {
    console.log(`[WEBHOOK] Granted ${monthlyCredits} renewal credits to org ${organizationId} (${effectivePlanName} plan)`);
  }
}

// ============================================================================
// Phase 2.5: Account Lifecycle Helper Functions
// ============================================================================

async function transitionToActive(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  reason: string
) {
  // Get current status for the lifecycle log
  const { data: org } = await supabase
    .from('organizations')
    .select('account_status')
    .eq('id', organizationId)
    .single();

  const previousStatus = org?.account_status || 'trial';
  const now = new Date();

  // Update organization to active status
  await supabase
    .from('organizations')
    .update({
      account_status: 'active',
      credit_spending_enabled: true,
      read_only_reason: null,
      grace_period_ends_at: null,
      updated_at: now.toISOString(),
    })
    .eq('id', organizationId);

  // Log the transition
  await supabase
    .from('account_lifecycle_log')
    .insert({
      organization_id: organizationId,
      previous_status: previousStatus,
      new_status: 'active',
      reason: reason,
      triggered_by: 'webhook',
      metadata: {
        transitioned_at: now.toISOString(),
      },
    });

  console.log(`[WEBHOOK] Organization ${organizationId} transitioned to 'active' from '${previousStatus}'`);
}

async function handlePaymentFailed(
  supabase: ReturnType<typeof createClient>,
  stripe: Stripe,
  invoice: Stripe.Invoice
) {
  const subscriptionId = invoice.subscription as string;
  
  // Find the organization
  const { data: profile } = await supabase
    .from('billing_profiles')
    .select('organization_id, payment_failure_count')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (!profile) {
    console.error('[WEBHOOK] Could not find organization for failed payment');
    return;
  }

  const now = new Date();
  const graceEnds = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14-day grace period
  const failureCount = (profile.payment_failure_count || 0) + 1;

  // Update billing profile
  await supabase
    .from('billing_profiles')
    .update({
      last_payment_failed_at: now.toISOString(),
      payment_failure_count: failureCount,
      updated_at: now.toISOString(),
    })
    .eq('organization_id', profile.organization_id);

  // Get current org status
  const { data: org } = await supabase
    .from('organizations')
    .select('account_status')
    .eq('id', profile.organization_id)
    .single();

  // Only transition if currently active (not already in a failed/archived state)
  if (org?.account_status === 'active') {
    await supabase
      .from('organizations')
      .update({
        account_status: 'payment_failed',
        credit_spending_enabled: false,
        read_only_reason: 'Payment failed. Please update your payment method within 14 days to restore access.',
        grace_period_ends_at: graceEnds.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', profile.organization_id);

    // Log the transition
    await supabase
      .from('account_lifecycle_log')
      .insert({
        organization_id: profile.organization_id,
        previous_status: 'active',
        new_status: 'payment_failed',
        reason: `Payment failed (attempt #${failureCount})`,
        triggered_by: 'webhook',
        metadata: {
          invoice_id: invoice.id,
          failure_count: failureCount,
          grace_period_ends_at: graceEnds.toISOString(),
          grace_period_days: 14,
        },
      });

    console.log(`[WEBHOOK] Payment failed for org ${profile.organization_id} - 14-day grace period started (attempt #${failureCount})`);
  } else {
    console.log(`[WEBHOOK] Payment failed for org ${profile.organization_id} (attempt #${failureCount}) - already in '${org?.account_status}' status`);
  }
}

async function handlePaymentRecovery(
  supabase: ReturnType<typeof createClient>,
  stripe: Stripe,
  invoice: Stripe.Invoice
) {
  const subscriptionId = invoice.subscription as string;
  
  // Find the organization
  const { data: profile } = await supabase
    .from('billing_profiles')
    .select('organization_id')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (!profile) {
    return; // No org found, nothing to recover
  }

  // Get current org status
  const { data: org } = await supabase
    .from('organizations')
    .select('account_status')
    .eq('id', profile.organization_id)
    .single();

  // Only recover if in payment_failed state
  if (org?.account_status === 'payment_failed') {
    const now = new Date();

    // Reset payment failure count
    await supabase
      .from('billing_profiles')
      .update({
        last_payment_failed_at: null,
        payment_failure_count: 0,
        updated_at: now.toISOString(),
      })
      .eq('organization_id', profile.organization_id);

    // Transition back to active
    await transitionToActive(supabase, profile.organization_id, 'Payment recovered successfully');

    console.log(`[WEBHOOK] Payment recovered for org ${profile.organization_id} - restored to active status`);
  }
}

// M11: Handle charge refunds — debit the previously granted credits
async function handleChargeRefunded(
  supabase: ReturnType<typeof createClient>,
  charge: Stripe.Charge,
  eventId: string
) {
  const amountRefunded = (charge.amount_refunded || 0) / 100; // Stripe uses cents

  // Find the organization via payment intent
  const { data: originalTx } = await supabase
    .from('credit_transactions')
    .select('organization_id, amount')
    .eq('stripe_payment_intent_id', charge.payment_intent as string)
    .eq('transaction_type', 'credit')
    .maybeSingle();

  if (!originalTx) {
    console.warn(`[WEBHOOK] No credit transaction found for refunded charge ${charge.id}`);
    return;
  }

  // Grant a negative adjustment (debit) to reverse the credits
  const { error: debitError } = await supabase.rpc('sp_grant_credits', {
    p_organization_id: originalTx.organization_id,
    p_amount: -amountRefunded, // Negative to debit — but sp_grant_credits rejects <= 0
  });

  // Since sp_grant_credits rejects negative amounts, insert the reversal directly
  const { data: balanceData } = await supabase.rpc('sp_get_credit_balance', {
    p_organization_id: originalTx.organization_id,
  });

  const currentBalance = balanceData?.[0]?.balance ?? 0;
  const creditsToReverse = Math.min(originalTx.amount, currentBalance); // Don't go below zero
  const newBalance = currentBalance - creditsToReverse;

  if (creditsToReverse > 0) {
    await supabase.from('credit_transactions').insert({
      organization_id: originalTx.organization_id,
      transaction_type: 'debit',
      amount: creditsToReverse,
      balance_after: newBalance,
      source: null,
      feature_type: null,
      description: `Credit reversal due to refund (charge: ${charge.id})`,
      stripe_event_id: eventId,
      stripe_payment_intent_id: charge.payment_intent as string,
      source_app: 'system',
    });

    // Update cached balance
    await supabase
      .from('organization_credit_balances')
      .update({ balance: newBalance, last_transaction_at: new Date().toISOString() })
      .eq('organization_id', originalTx.organization_id);
  }

  // Log the event
  await supabase.from('account_lifecycle_log').insert({
    organization_id: originalTx.organization_id,
    previous_status: 'active',
    new_status: 'active',
    reason: `Charge refunded: ${charge.id} (${creditsToReverse} credits reversed)`,
    triggered_by: 'webhook',
    metadata: {
      charge_id: charge.id,
      amount_refunded: amountRefunded,
      credits_reversed: creditsToReverse,
    },
  });

  console.log(`[WEBHOOK] Refund processed for org ${originalTx.organization_id}: ${creditsToReverse} credits reversed`);
}

// M11: Handle charge disputes — disable spending and alert
async function handleDisputeCreated(
  supabase: ReturnType<typeof createClient>,
  dispute: Stripe.Dispute,
  eventId: string
) {
  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;

  // Find the organization via the payment intent on the original charge
  const { data: originalTx } = await supabase
    .from('credit_transactions')
    .select('organization_id')
    .eq('stripe_payment_intent_id', dispute.payment_intent as string)
    .eq('transaction_type', 'credit')
    .maybeSingle();

  if (!originalTx) {
    console.warn(`[WEBHOOK] No credit transaction found for disputed charge ${chargeId}`);
    return;
  }

  const now = new Date();

  // Disable credit spending immediately
  await supabase
    .from('organizations')
    .update({
      credit_spending_enabled: false,
      read_only_reason: 'Account suspended due to payment dispute. Please contact support.',
      updated_at: now.toISOString(),
    })
    .eq('id', originalTx.organization_id);

  // Log the event
  await supabase.from('account_lifecycle_log').insert({
    organization_id: originalTx.organization_id,
    previous_status: 'active',
    new_status: 'active',
    reason: `Payment dispute created (charge: ${chargeId})`,
    triggered_by: 'webhook',
    metadata: {
      dispute_id: dispute.id,
      charge_id: chargeId,
      amount: dispute.amount,
      reason: dispute.reason,
    },
  });

  console.log(`[WEBHOOK] Dispute created for org ${originalTx.organization_id} — spending disabled`);
}
