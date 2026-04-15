# Phase 2.5: Trial Lifecycle & Account States

**Version:** 1.0  
**Created:** December 8, 2024  
**Status:** Implemented (Dec 8, 2024)

---

## Executive Summary

This plan implements a comprehensive account lifecycle system for AutoListing.io with:
- 14-day free trial (no credit card required)
- Master switch for credit spending (`credit_spending_enabled`)
- Grace periods for various account states
- Dunning email sequences
- Automatic account state transitions
- 6-month data retention before deletion

---

## Key Decisions

| Decision | Value |
|----------|-------|
| Trial Duration | 14 days |
| Trial Credits | 100 (don't carry over) |
| Plan Selection | After trial ends |
| Trial Extension | Not allowed |
| Trial Expired Grace | 14 days |
| Payment Failed Grace | 14 days |
| Unsubscribed Grace | 30 days |
| Archived Data Retention | 6 months (then deleted) |
| Archive Warning Email | Yes (30 days and 7 days before) |
| Cron Frequency | Daily |
| Archived Reactivation | Restore existing org |
| Dunning Emails | Platform-wide (not org-customizable) |

---

## Account States

| State | Credit Spending | Can Login | Website Active | Duration |
|-------|----------------|-----------|----------------|----------|
| `trial` | Yes | Yes | Yes | 14 days |
| `trial_expired` | No (read-only) | Yes | Yes | 14 days grace |
| `active` | Yes | Yes | Yes | Ongoing |
| `payment_failed` | No (read-only) | Yes | Yes | 14 days grace |
| `unsubscribed` | No (read-only) | Yes | Yes | 30 days grace |
| `archived` | No | No | No | 6 months then deleted |

---

## State Transition Diagram

```
SIGNUP
   │
   ▼
┌──────────────────────────────────────────────────────────────┐
│ TRIAL (14 days)                                              │
│ • credit_spending_enabled = true                             │
│ • 100 trial credits (don't carry over)                       │
│ • Full feature access                                        │
└─────────────────────────┬────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │ subscribes    │ trial_ends_at │
          │ during trial  │ passes        │
          ▼               ▼               
┌────────────────┐  ┌──────────────────┐  
│    ACTIVE      │  │  TRIAL_EXPIRED   │  
│                │  │  (14-day grace)  │  
│ • Credits=true │  │  • Credits=false │  
│ • Subscription │  │  • Read-only     │  
│   credits      │  │  • Website stays │  
└───────┬────────┘  └────────┬─────────┘  
        │                    │             
        │             ┌──────┴──────┐      
        │             │ subscribes  │ grace
        │             │             │ expires
        │             ▼             ▼      
        │      ┌──────────┐  ┌──────────┐  
        │      │  ACTIVE  │  │ ARCHIVED │  
        │      └──────────┘  └──────────┘  
        │                                  
 ┌──────┴──────────────────────┐           
 │                             │           
 │ invoice.payment_failed      │ customer. 
 │                             │ subscription
 ▼                             ▼ .deleted  
┌─────────────────┐  ┌──────────────────┐  
│ PAYMENT_FAILED  │  │  UNSUBSCRIBED    │  
│ (14-day grace)  │  │  (30-day grace)  │  
│ • Credits=false │  │  • Credits=false │  
│ • Read-only     │  │  • Read-only     │  
└────────┬────────┘  └────────┬─────────┘  
         │                    │             
  ┌──────┴──────┐      ┌──────┴──────┐     
  │ fixes       │      │ reactivates │ grace
  │ payment     │      │             │ expires
  ▼             │      ▼             ▼     
┌──────────┐    │  ┌──────────┐  ┌──────────┐
│  ACTIVE  │    │  │  ACTIVE  │  │ ARCHIVED │
└──────────┘    │  └──────────┘  └──────────┘
                │                            
                └──► ARCHIVED (if grace expires)
```

---

## Database Schema Changes

### A1. Extend `organizations` table

```sql
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS 
  account_status TEXT DEFAULT 'trial' 
  CHECK (account_status IN ('trial', 'trial_expired', 'active', 'payment_failed', 'unsubscribed', 'archived'));

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (now() + interval '14 days');
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS credit_spending_enabled BOOLEAN DEFAULT true;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS read_only_reason TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
```

### A2. Extend `billing_profiles` table

```sql
ALTER TABLE billing_profiles ADD COLUMN IF NOT EXISTS last_payment_failed_at TIMESTAMPTZ;
ALTER TABLE billing_profiles ADD COLUMN IF NOT EXISTS payment_failure_count INTEGER DEFAULT 0;
ALTER TABLE billing_profiles ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ;
ALTER TABLE billing_profiles ADD COLUMN IF NOT EXISTS card_expires_at TIMESTAMPTZ;
```

### A3. Create `dunning_emails` table

```sql
CREATE TABLE IF NOT EXISTS dunning_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  email_number INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_dunning_emails_org ON dunning_emails(organization_id);
CREATE INDEX idx_dunning_emails_type ON dunning_emails(email_type);
```

### A4. Create `account_lifecycle_log` table

```sql
CREATE TABLE IF NOT EXISTS account_lifecycle_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  reason TEXT,
  triggered_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lifecycle_log_org ON account_lifecycle_log(organization_id);
CREATE INDEX idx_lifecycle_log_created ON account_lifecycle_log(created_at);
```

---

## Master Switch Implementation

The `credit_spending_enabled` column in `organizations` is the **single checkpoint** that gates ALL credit spending.

### Modify `sp_consume_credits` function:

```sql
-- At the very START of sp_consume_credits function, add:
SELECT credit_spending_enabled INTO v_spending_enabled 
FROM organizations WHERE id = p_organization_id;

IF NOT v_spending_enabled THEN
  RAISE EXCEPTION 'CREDIT_SPENDING_DISABLED: Account is in read-only mode. Please subscribe or update payment method.';
END IF;

-- ... rest of existing logic
```

**Benefits:**
- No changes needed to individual edge functions
- All credit-consuming features automatically gated
- Frontend `billingClient.ts` already handles errors

---

## Edge Function Changes

### C1. `create-organization/index.ts`

Add to organization insert:
```typescript
account_status: 'trial',
trial_started_at: new Date().toISOString(),
trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
credit_spending_enabled: true,
```

### C2. `stripe-webhook/index.ts`

Handle additional events:
- `invoice.payment_failed` → Set `account_status='payment_failed'`, `credit_spending_enabled=false`, grace 14 days
- `invoice.payment_succeeded` (after failure) → Restore to `active`, re-enable credits
- `customer.subscription.deleted` → Set `account_status='unsubscribed'`, `credit_spending_enabled=false`, grace 30 days

### C3. NEW: `account-lifecycle/index.ts` (Daily Cron)

Daily tasks:
1. Check trials ending in 3 days, 1 day → Send warning emails
2. Check expired trials → Transition to `trial_expired`, disable credits, set 14-day grace
3. Check expired grace periods → Transition to `archived`
4. Check cards expiring in 30/14/7 days → Send pre-dunning emails
5. Check archived accounts > 6 months old → Delete data, send notification

---

## Dunning Email Templates

| Template Key | When Sent | Email Number |
|--------------|-----------|--------------|
| `trial_ending_3days` | 3 days before trial ends | 1 |
| `trial_ending_1day` | 1 day before trial ends | 2 |
| `trial_expired` | Day trial ends | 3 |
| `trial_grace_7days` | 7 days into grace period | 4 |
| `trial_archived` | Account archived | 5 |
| `payment_failed_1` | First payment failure | 1 |
| `payment_failed_2` | 5 days after failure | 2 |
| `payment_failed_3` | 10 days after failure | 3 |
| `payment_failed_final` | 13 days after failure | 4 |
| `card_expiring_30days` | Card expires in 30 days | 1 |
| `card_expiring_7days` | Card expires in 7 days | 2 |
| `subscription_canceled` | User unsubscribed | 1 |
| `archive_warning_30days` | 30 days before data deletion | 1 |
| `archive_warning_7days` | 7 days before data deletion | 2 |
| `data_deleted` | Account data deleted | 3 |

---

## Frontend UI Changes

### D1. `SignupWizard.tsx`
- Remove plan selection step (all signups start with trial)
- Update messaging: "Start your 14-day free trial"
- Add "No credit card required" and "100 free credits"
- Add note: "Trial credits don't carry over to paid plans"

### D2. NEW: `AccountStatusBanner.tsx`
Shows at top of admin area when not in normal state:
- **Trial**: "Your trial ends in X days. Upgrade now to continue."
- **Trial Expired**: "Your trial has ended. Subscribe to restore full access."
- **Payment Failed**: "Payment failed. Update your payment method to restore access."
- **Unsubscribed**: "Your subscription has been canceled. Reactivate to continue."

### D3. NEW: `TrialCountdown.tsx`
Sidebar component showing:
- Remaining trial days
- Credit usage during trial
- CTA to upgrade

### D4. `ManageSubscription.tsx`
- Show current account status
- Show grace period countdown if applicable
- Show subscription/reactivation options

### D5. NEW: Post-trial plan selection flow
- When trial ends, users choose Starter or Pro
- Redirect to Stripe checkout
- On success, transition to `active`

---

## Implementation Order

| Step | Description | Risk | Dependencies |
|------|-------------|------|--------------|
| F1 | Database migration - organizations columns | Medium | None |
| F2 | Database migration - billing_profiles columns | Medium | None |
| F3 | Create dunning_emails table | Low | None |
| F4 | Create account_lifecycle_log table | Low | None |
| F5 | Update sp_consume_credits with master switch | **High** | F1 |
| F6 | Update create-organization for trial setup | Low | F1 |
| F7 | Update stripe-webhook for state transitions | Medium | F1, F2 |
| F8 | Create account-lifecycle cron function | Medium | F1-F4 |
| F9 | Add dunning email templates to database | Low | None |
| F10 | Update SignupWizard UI | Low | F6 |
| F11 | Create AccountStatusBanner component | Low | F1 |
| F12 | Create TrialCountdown component | Low | F1 |
| F13 | Update ManageSubscription page | Low | F1, F7 |
| F14 | Create post-trial plan selection flow | Medium | F7 |
| F15 | Add archive cleanup cron (6 month) | Low | F1, F8 |

---

## Stripe Configuration Required

1. **Enable Account Updater** in Stripe Dashboard → Billing → Automatic collection
2. **Configure Smart Retries** (Stripe handles automatically for subscriptions)
3. **Register webhook events:**
   - `checkout.session.completed`
   - `invoice.payment_failed`
   - `invoice.payment_succeeded`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`

---

## Testing Checklist

- [ ] New signup creates org with `account_status='trial'` and correct dates
- [ ] Trial credits (100) are granted on signup
- [ ] `sp_consume_credits` rejects when `credit_spending_enabled=false`
- [ ] Trial expiration triggers state change and disables credits
- [ ] Subscribing during trial transitions to `active`
- [ ] Payment failure triggers state change and disables credits
- [ ] Fixing payment restores `active` state
- [ ] Unsubscribing triggers state change with 30-day grace
- [ ] Grace period expiration triggers archive
- [ ] Archived accounts can be reactivated
- [ ] Data deletion after 6 months works correctly
- [ ] All dunning emails send at correct intervals
- [ ] Pre-dunning (card expiry) emails work
- [ ] UI banners show correct status
- [ ] Trial countdown displays correctly
