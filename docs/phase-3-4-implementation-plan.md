# Phase 3 & 4: SaaS Readiness Implementation Plan

**Version:** 1.0  
**Created:** December 8, 2024  
**Status:** Planning  
**Target Completion:** Jan 20, 2025

---

## Overview

This document outlines the remaining work to complete the SaaS Readiness Build Plan. Phases 1, 2, and 2.5 are complete. This plan covers:

- **Phase 3: Usage Tracking & Enforcement** (1.5 weeks, 11 tasks, ~37 hours)
- **Phase 4: Onboarding Experience** (1 week, 9 tasks, ~31 hours)

**Important:** All changes to existing working code must be discussed and approved before implementation.

---

## Current State (Completed)

| Phase | Name | Status |
|-------|------|--------|
| Phase 1 | Marketing Foundation | Complete |
| Phase 2 | Signup & Stripe | Complete |
| Phase 2.5 | Trial Lifecycle | Complete |

**Already Built:**
- Marketing pages (`/`, `/pricing`, `/features`)
- Signup wizard with 14-day trial
- Stripe subscription checkout (Starter €29/mo, Pro €79/mo)
- Credit-based billing system (`sp_consume_credits`, `sp_grant_credits`)
- Account lifecycle (trial → active → archived)
- Grace periods and dunning emails
- `billingClient.ts` with credit functions
- `CreditBalanceBadge.tsx` component
- `ManageSubscription.tsx` page

---

## Phase 3: Usage Tracking & Enforcement

**Duration:** 1.5 weeks (~37 hours)  
**Goal:** Enforce plan limits, provide usage analytics, and guide upgrades

### Task 3.1: Update Usage Rates in Database

**Type:** Database  
**Risk:** Low  
**Existing Code Impact:** None (additive)

```sql
INSERT INTO public.usage_rates (feature_type, credits_per_use, description, is_active) VALUES
('video_generation', 25, 'Video content generation', true),
('post_generation', 2, 'Social media post per platform', true),
('ai_assistant', 0.5, 'AI chatbot message', true),
('ai_extraction', 10, 'Property detail extraction', true),
('email_send', 0.2, 'Email send', true)
ON CONFLICT (feature_type) DO UPDATE SET 
  credits_per_use = EXCLUDED.credits_per_use,
  updated_at = now();
```

**Discussion Points:**
- Verify these rates match the billing model in replit.md
- Check if `usage_rates` table exists and has correct schema

---

### Task 3.2: Create `usePlanInfo` Hook

**Type:** New Frontend Hook  
**File:** `src/hooks/usePlanInfo.ts`  
**Risk:** Low  
**Existing Code Impact:** None (new file)

**Purpose:** Fetch current organization's plan details (Starter/Pro/Trial)

**Returns:**
- `planName`: 'starter' | 'pro' | 'trial'
- `maxUsers`: number (1 for Starter, 10 for Pro)
- `monthlyCredits`: number (200 for Starter, 500 for Pro)
- `isTrialActive`: boolean
- `trialEndsAt`: Date | null

**Dependencies:**
- `billing_profiles` table
- `plan_definitions` table
- `organizations` table

---

### Task 3.3: Create `useTeamLimit` Hook

**Type:** New Frontend Hook  
**File:** `src/hooks/useTeamLimit.ts`  
**Risk:** Low  
**Existing Code Impact:** None (new file)

**Purpose:** Check if organization can add more users based on plan

**Returns:**
- `canAddUser`: boolean
- `currentUserCount`: number
- `maxUsers`: number
- `isAtLimit`: boolean

**Uses:** `usePlanInfo` hook

---

### Task 3.4: Create `useCreditCheck` Hook

**Type:** New Frontend Hook  
**File:** `src/hooks/useCreditCheck.ts`  
**Risk:** Low  
**Existing Code Impact:** None (new file)

**Purpose:** Pre-check if organization has enough credits before consuming

**Parameters:**
- `featureType`: 'video_generation' | 'post_generation' | 'ai_assistant' | 'ai_extraction' | 'email_send'
- `quantity`: number (default 1)

**Returns:**
- `hasEnoughCredits`: boolean
- `currentBalance`: number
- `requiredCredits`: number
- `shortfall`: number

---

### Task 3.5: Add Team Size Check to AdminUsers.tsx

**Type:** Modify Existing Component  
**File:** `src/pages/AdminUsers.tsx`  
**Risk:** Medium  
**Existing Code Impact:** YES - requires discussion

**Changes Required:**
1. Import `useTeamLimit` hook
2. Disable "Invite User" and "Add User" buttons when `isAtLimit` is true
3. Show upgrade prompt when limit reached

**Discussion Points:**
- Review current AdminUsers.tsx implementation
- Identify exact insertion points for new logic
- Ensure no breaking changes to existing functionality

---

### Task 3.6: Create TeamLimitBanner Component

**Type:** New Component  
**File:** `src/components/billing/TeamLimitBanner.tsx`  
**Risk:** Low  
**Existing Code Impact:** None (new file)

**Purpose:** Show "Upgrade to Pro for more team members" banner

**Props:**
- `currentUsers`: number
- `maxUsers`: number
- `onUpgrade`: () => void

**Display Conditions:**
- Show when `currentUsers >= maxUsers - 1` (approaching limit)
- Different styling when at limit vs approaching

---

### Task 3.7: Create UsageDashboard Component

**Type:** New Component  
**File:** `src/components/billing/UsageDashboard.tsx`  
**Risk:** Low  
**Existing Code Impact:** None (new file)

**Purpose:** Full usage analytics dashboard showing:
- Current balance
- Monthly usage by feature type (pie chart)
- Usage trend (line chart)
- Top consuming features

**Dependencies:**
- `credit_transactions` table queries
- `recharts` library (already installed)

---

### Task 3.8: Create WeeklySpendChart Component

**Type:** New Component  
**File:** `src/components/billing/WeeklySpendChart.tsx`  
**Risk:** Low  
**Existing Code Impact:** None (new file)

**Purpose:** Bar chart showing daily/weekly credit consumption

**Data Source:** `credit_transactions` aggregated by day

---

### Task 3.9: Update CreditBalanceBadge with Tooltip

**Type:** Modify Existing Component  
**File:** `src/components/billing/CreditBalanceBadge.tsx`  
**Risk:** Medium  
**Existing Code Impact:** YES - requires discussion

**Changes Required:**
1. Add Radix Tooltip wrapper
2. Show breakdown: "Video: X, Posts: Y, AI: Z" on hover
3. Keep existing click-to-purchase behavior

**Discussion Points:**
- Review current CreditBalanceBadge implementation
- Ensure tooltip doesn't break existing functionality

---

### Task 3.10: Add Team Size Validation to create-org-user Edge Function

**Type:** Modify Existing Edge Function  
**File:** `supabase/functions/create-org-user/index.ts` (or similar)  
**Risk:** Medium  
**Existing Code Impact:** YES - requires discussion

**Changes Required:**
1. Before creating user, check current team size
2. Look up organization's plan
3. Reject if at limit with clear error message

**Discussion Points:**
- Identify which edge function handles user creation
- Review current implementation
- Determine error response format

---

### Task 3.11: Add Low Credit Warnings

**Type:** New Component + Logic  
**File:** `src/components/billing/LowCreditWarning.tsx`  
**Risk:** Low  
**Existing Code Impact:** Minimal (add to layout)

**Purpose:** Show warning when credits < 20% of monthly allocation

**Behavior:**
- Toast notification when crossing threshold
- Persistent banner in billing section
- "Buy Credits" CTA

---

## Phase 4: Onboarding Experience

**Duration:** 1 week (~31 hours)  
**Goal:** Guide new users through initial setup

### Task 4.1: Create Onboarding Progress Table

**Type:** Database Migration  
**Risk:** Low  
**Existing Code Impact:** None (new table)

```sql
CREATE TABLE public.onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  tasks_completed JSONB DEFAULT '{}',
  dismissed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_onboarding_org ON onboarding_progress(organization_id);

-- RLS Policy
ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org onboarding" ON onboarding_progress
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update own org onboarding" ON onboarding_progress
  FOR UPDATE USING (organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
  ));
```

---

### Task 4.2: Create WelcomeModal Component

**Type:** New Component  
**File:** `src/components/onboarding/WelcomeModal.tsx`  
**Risk:** Low  
**Existing Code Impact:** Minimal (add to dashboard)

**Purpose:** First-login welcome modal

**Content:**
- Welcome message with org name
- Trial info (14 days, 100 credits)
- Quick overview of key features
- "Let's Get Started" CTA

**Display Logic:**
- Show once on first login
- Track in `onboarding_progress.tasks_completed.welcome_seen`

---

### Task 4.3: Create OnboardingChecklist Component

**Type:** New Component  
**File:** `src/components/onboarding/OnboardingChecklist.tsx`  
**Risk:** Low  
**Existing Code Impact:** Minimal (add to dashboard)

**Purpose:** Setup progress widget for dashboard sidebar

**Tasks to Track:**
1. Upload organization logo
2. Create first listing
3. Add first client/contact
4. Configure AI assistant knowledge base
5. Connect first social account (Socials app)
6. Set up email settings
7. (Pro only) Invite team member

**Features:**
- Collapsible widget
- Progress bar (X of Y complete)
- Click to navigate to relevant page
- Dismiss option

---

### Task 4.4: Create TaskItem Component

**Type:** New Component  
**File:** `src/components/onboarding/TaskItem.tsx`  
**Risk:** Low  
**Existing Code Impact:** None (new file)

**Purpose:** Individual task display within checklist

**Props:**
- `title`: string
- `description`: string
- `isComplete`: boolean
- `href`: string (navigation target)
- `icon`: LucideIcon

---

### Task 4.5: Create useOnboarding Hook

**Type:** New Hook  
**File:** `src/hooks/useOnboarding.ts`  
**Risk:** Low  
**Existing Code Impact:** None (new file)

**Purpose:** Manage onboarding state

**Returns:**
- `tasks`: OnboardingTask[]
- `completedCount`: number
- `totalCount`: number
- `percentComplete`: number
- `isDismissed`: boolean
- `markTaskComplete`: (taskId: string) => void
- `dismissOnboarding`: () => void

---

### Task 4.6: Create TrialBanner Component

**Type:** New Component  
**File:** `src/components/onboarding/TrialBanner.tsx`  
**Risk:** Low  
**Existing Code Impact:** Check for overlap with TrialCountdown.tsx

**Note:** We already have `TrialCountdown.tsx`. This task may be redundant.

**Discussion Points:**
- Review existing `TrialCountdown.tsx`
- Determine if separate TrialBanner is needed or if TrialCountdown covers this

---

### Task 4.7: Add Onboarding Widget to Dashboard

**Type:** Modify Dashboard Layout  
**File:** TBD (likely `src/pages/Dashboard.tsx` or similar)  
**Risk:** Medium  
**Existing Code Impact:** YES - requires discussion

**Changes Required:**
1. Import OnboardingChecklist component
2. Add to dashboard layout (sidebar or main content)
3. Only show for orgs that haven't dismissed

**Discussion Points:**
- Identify dashboard component
- Determine placement (sidebar vs main content)

---

### Task 4.8: Auto-detect Task Completion

**Type:** Logic across multiple components  
**Risk:** Medium  
**Existing Code Impact:** YES - requires discussion

**Implementation:**
When certain actions happen, mark corresponding onboarding task complete:

| Action | Task to Complete |
|--------|------------------|
| Logo uploaded | `upload_logo` |
| Listing created | `create_listing` |
| Contact added | `add_contact` |
| AI config saved | `configure_ai` |
| Email settings saved | `setup_email` |
| Team member invited | `invite_member` |

**Discussion Points:**
- Identify where each action happens
- Determine best way to trigger completion (event emitter, direct call, etc.)

---

### Task 4.9: Add Dismiss/Complete Flow

**Type:** Onboarding Logic  
**File:** Various  
**Risk:** Low  

**Features:**
- "Skip for now" option on each task
- "Dismiss checklist" option
- Auto-complete when all tasks done
- Celebration animation on completion

---

## Files That Will NOT Be Modified

These core files should remain untouched unless absolutely necessary:

| File | Reason |
|------|--------|
| `src/contexts/AuthContext.tsx` | Existing auth logic preserved |
| `src/contexts/OrganizationContext.tsx` | Existing org logic preserved |
| `src/lib/billing/billingClient.ts` | Existing credit functions preserved |
| `src/lib/billing/types.ts` | Only ADD new types, not modify existing |
| Existing CRM pages | Existing functionality preserved |
| Existing listing management | Existing functionality preserved |
| Existing email automation | Existing functionality preserved |
| Existing webhook system | Existing functionality preserved |

---

## Files Requiring Modification (Discussion Needed)

| File | Task | Change Type |
|------|------|-------------|
| `src/pages/AdminUsers.tsx` | 3.5 | Add team limit check |
| `src/components/billing/CreditBalanceBadge.tsx` | 3.9 | Add tooltip |
| Edge function for user creation | 3.10 | Add team validation |
| Dashboard component | 4.7 | Add onboarding widget |
| Various action handlers | 4.8 | Trigger task completion |

---

## Implementation Order

```
Phase 3.1 → Update usage_rates (database)
    ↓
Phase 3.2-3.4 → Create hooks (usePlanInfo, useTeamLimit, useCreditCheck)
    ↓
Phase 3.6-3.8 → Create new components (TeamLimitBanner, UsageDashboard, WeeklySpendChart)
    ↓
Phase 3.11 → Low credit warnings
    ↓
Phase 3.5, 3.9, 3.10 → Modifications to existing code (DISCUSS FIRST)
    ↓
Phase 4.1 → Create onboarding_progress table
    ↓
Phase 4.2-4.5 → Create onboarding components and hooks
    ↓
Phase 4.6 → Review TrialBanner vs TrialCountdown overlap
    ↓
Phase 4.7-4.9 → Dashboard integration (DISCUSS FIRST)
```

---

## Success Criteria

### Phase 3 Complete When:
- [ ] Usage rates populated in database
- [ ] Starter plan limited to 1 user
- [ ] Pro plan limited to 10 users
- [ ] Usage dashboard shows credit consumption
- [ ] Low credit warnings appear at 20% threshold
- [ ] Upgrade prompts appear when limits reached

### Phase 4 Complete When:
- [ ] Welcome modal shows on first login
- [ ] Onboarding checklist visible in dashboard
- [ ] Tasks auto-complete when actions taken
- [ ] Users can dismiss checklist
- [ ] Celebration on completion

---

## Estimated Timeline

| Week | Tasks |
|------|-------|
| Week 1 | Phase 3.1-3.8 (new code only) |
| Week 2 (3 days) | Phase 3.5, 3.9-3.11 (modifications + testing) |
| Week 2-3 | Phase 4.1-4.5 (new code only) |
| Week 3 | Phase 4.6-4.9 (integration + testing) |

---

## Next Steps

1. **Review this plan** and confirm task list is complete
2. **Identify existing files** that need modification
3. **Begin with Task 3.1** (database update) - no code changes needed
4. **Create new hooks and components** (Tasks 3.2-3.4, 3.6-3.8)
5. **Discuss modifications** before touching AdminUsers.tsx, etc.

---

*Document created by AI Assistant. All modifications to existing code require explicit approval before implementation.*
