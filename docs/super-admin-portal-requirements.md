# Super Admin Portal Requirements
## AutoListing.io Internal Operations Console

**Document Version:** 1.0  
**Last Updated:** December 2024  
**Status:** Planning Phase

---

## 1. Overview

The Super Admin Portal is an internal operations console for the AutoListing.io management and development teams. It provides centralized control over all tenant organizations, billing, feature management, and support operations.

### 1.1 Access Model
- **URL:** `app.autolisting.io/internal/*` (protected routes within main app)
- **Authentication:** Supabase Auth with role validation
- **Security:** Role-based access control, audit logging on all actions
- **Note:** Using same-project approach for AI context retention and simpler maintenance
- **Route prefix:** `/internal` chosen to avoid conflict with existing `/admin` customer-facing routes

### 1.2 Role Permissions

| Capability | super_admin | developer |
|------------|:-----------:|:---------:|
| View all dashboards & data | Yes | Yes |
| View audit logs | Yes | Yes |
| Impersonate users | Yes | No |
| Process refunds | Yes | No |
| Grant credits > 100 | Yes | Requires approval |
| Create/edit discount codes | Yes | No |
| Modify feature flags | Yes | Yes (non-production) |
| Suspend/delete organizations | Yes | No |
| Access billing data | Yes | Read-only |
| Manage support tickets | Yes | Yes |
| Export GDPR data | Yes | No |

---

## 2. Module Breakdown

### 2.1 Dashboard (Home)

**Purpose:** At-a-glance view of platform health and key metrics

| Widget | Description |
|--------|-------------|
| MRR Chart | Monthly recurring revenue trend |
| Active Organizations | Total orgs, trials, paid, churned |
| Trial Conversions | Trial-to-paid conversion rate this month |
| Credit Usage | Platform-wide credit consumption |
| Recent Signups | Latest organization registrations |
| Active Incidents | Any ongoing issues or alerts |
| Quick Actions | Common tasks (create discount, impersonate, etc.) |

---

### 2.2 Organizations Module

**Purpose:** View and manage all tenant organizations

#### Features:
- **Organization Directory**
  - Searchable/filterable list of all organizations
  - Status indicators (trial, active, expired, churned)
  - Quick stats (users, listings, credits used)
  
- **Organization Detail View**
  - Business info (name, domain, contact)
  - Subscription status and billing history
  - User list with roles
  - Credit balance and usage
  - Activity timeline
  - Admin notes (internal only)

- **Organization Actions**
  - Extend trial period
  - Grant bonus credits
  - Change plan (upgrade/downgrade)
  - Suspend/reactivate account
  - Delete organization (with safeguards)
  - Apply discount code

---

### 2.3 User Management Module

**Purpose:** Manage individual users across all organizations

#### Features:
- **User Directory**
  - Search by email, name, organization
  - Filter by role, status, last login
  
- **User Detail View**
  - Profile information
  - Organization membership(s)
  - Login history
  - Activity log

- **User Actions**
  - Force password reset
  - Verify/unverify email
  - Impersonate user (with audit trail)
  - Suspend/reactivate
  - Transfer to another organization

- **Impersonation System**
  - One-click "View as this user" 
  - Visible banner during impersonation
  - Auto-expire after 30 minutes
  - Full audit log of all actions taken
  - Easy exit back to admin

---

### 2.4 Billing & Revenue Module

**Purpose:** Complete visibility and control over financials

#### Features:
- **Revenue Dashboard**
  - MRR, ARR, growth rate
  - Revenue by plan (Starter vs Pro)
  - Churn rate and reasons
  - LTV calculations
  - Cohort analysis

- **Subscription Management**
  - View all active subscriptions
  - Sync with Stripe data
  - Process refunds
  - Apply credits/adjustments
  - Handle failed payments

- **Discount Codes**
  - Create new codes (% or fixed amount)
  - Set usage limits (per code, per org)
  - Set validity period
  - Track usage and revenue impact
  - Deactivate codes

- **Credit Management**
  - View credit ledger across platform
  - Grant bonus credits
  - Credit consumption analytics
  - Low balance alerts

---

### 2.5 Feature Flags Module

**Purpose:** Control feature rollout without deployments

#### Features:
- **Flag Management**
  - Create/edit feature flags
  - Global on/off toggle
  - Percentage rollout (e.g., 10% of orgs)
  - Per-organization overrides
  - Beta tester groups

- **Flag Types**
  - Boolean (on/off)
  - Percentage (gradual rollout)
  - Allowlist (specific orgs only)
  - Plan-based (Pro features)

- **Common Flags**
  - `social_media_automation` (Coming Soon feature)
  - `ai_assistant_v2`
  - `advanced_analytics`
  - `custom_domains`
  - `white_label`

---

### 2.6 Content & Widgets Module

**Purpose:** Manage platform-wide content and configurations

#### Features:
- **Email Templates**
  - System email templates
  - Preview and edit
  - Version history

- **Widget Controls**
  - Public chatbot widget settings
  - Embeddable listing widgets
  - Branding defaults

- **Knowledge Base**
  - AI assistant knowledge articles
  - FAQ management

---

### 2.7 Support Tools Module

**Purpose:** Tools for customer support operations

#### Features:
- **Email Operations**
  - Resend verification emails
  - Resend password resets
  - View email delivery status
  - Email queue management

- **Data Fixes**
  - Merge duplicate contacts
  - Fix data inconsistencies
  - Bulk operations

- **Support Notes**
  - Add internal notes to orgs/users
  - Tag support tickets
  - Track support history

---

### 2.8 Reports & Analytics Module

**Purpose:** Deep analytics and exportable reports

#### Features:
- **Usage Reports**
  - Feature adoption by organization
  - API usage and limits
  - Storage consumption

- **Financial Reports**
  - Revenue by period
  - Churn analysis
  - Discount code performance

- **Compliance Reports**
  - GDPR data exports
  - Audit log exports
  - User consent tracking

---

### 2.9 Audit & Compliance Module

**Purpose:** Track all administrative actions

#### Features:
- **Audit Log**
  - All admin actions logged
  - Before/after snapshots
  - Actor, timestamp, reason
  - Filterable/searchable
  - Export capability

- **Compliance Tools**
  - GDPR data subject requests
  - Data deletion workflows
  - Consent management

---

## 3. Database Schema Additions

### 3.1 New Tables Required

```sql
-- Audit log for all admin actions
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  action_type VARCHAR(100) NOT NULL,
  target_type VARCHAR(50), -- 'organization', 'user', 'subscription', etc.
  target_id UUID,
  before_state JSONB,
  after_state JSONB,
  reason TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discount codes
CREATE TABLE discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  discount_type VARCHAR(20) NOT NULL, -- 'percentage' or 'fixed'
  discount_value NUMERIC(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'EUR',
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  max_uses_per_org INTEGER DEFAULT 1,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  applicable_plans TEXT[], -- ['starter', 'pro'] or null for all
  min_months INTEGER DEFAULT 1, -- minimum subscription commitment
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discount code usage tracking
CREATE TABLE discount_code_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_code_id UUID REFERENCES discount_codes(id),
  organization_id UUID NOT NULL,
  applied_by UUID REFERENCES auth.users(id),
  stripe_coupon_id VARCHAR(100),
  amount_saved NUMERIC(10,2),
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feature flags
CREATE TABLE feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  flag_type VARCHAR(20) DEFAULT 'boolean', -- 'boolean', 'percentage', 'allowlist'
  default_state BOOLEAN DEFAULT false,
  rollout_percentage INTEGER, -- for percentage type
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feature flag overrides per organization
CREATE TABLE feature_flag_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_flag_id UUID REFERENCES feature_flags(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  state BOOLEAN NOT NULL,
  expires_at TIMESTAMPTZ,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(feature_flag_id, organization_id)
);

-- Impersonation sessions
CREATE TABLE impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id),
  target_user_id UUID NOT NULL REFERENCES auth.users(id),
  target_org_id UUID NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  actions_taken JSONB DEFAULT '[]',
  ip_address INET,
  reason TEXT
);

-- Admin notes on organizations/users
CREATE TABLE admin_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type VARCHAR(20) NOT NULL, -- 'organization' or 'user'
  target_id UUID NOT NULL,
  note TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. Security Requirements

### 4.1 Authentication & Authorization
- Supabase Auth with role claim validation
- MFA required for all super admin accounts
- Session timeout after 4 hours of inactivity
- IP allowlisting for production access

### 4.2 Audit Requirements
- Every mutation must log to `admin_audit_log`
- Include before/after state snapshots
- Capture actor, timestamp, IP, and reason
- Immutable logs (no delete/update)

### 4.3 Impersonation Safety
- Visible banner showing "Viewing as [user]"
- Auto-expire after 30 minutes
- Log all actions taken during session
- Require reason/ticket number to start

### 4.4 Dangerous Actions
- Require confirmation modal with typed confirmation
- Irreversible actions need secondary approval
- Rate limiting on bulk operations

### 4.5 Approval Workflows

High-risk actions require secondary approval from a super_admin:

| Action | Threshold | Approval Required |
|--------|-----------|-------------------|
| Refunds | > €100 | Yes |
| Credit grants | > 100 credits | Yes |
| Plan downgrades | Any | Yes |
| Organization deletion | Any | Yes + 48hr cooling period |
| Bulk user operations | > 10 users | Yes |
| Feature flag (production) | Any | Yes (for developers) |

**Workflow:**
1. Requester initiates action with reason/ticket reference
2. System creates pending approval record
3. Notification sent to super_admins (Slack + email)
4. Approver reviews and approves/rejects with comment
5. Action executes (or expires after 72 hours)
6. Full audit trail maintained

### 4.6 Audit Log Retention

Following industry standards for SaaS/fintech:

| Log Type | Retention Period |
|----------|------------------|
| Financial transactions (refunds, credits) | 7 years |
| Billing & subscription changes | 7 years |
| User data access (GDPR) | 6 years |
| Authentication events | 2 years |
| General admin actions | 2 years |
| Impersonation sessions | 3 years |

Logs are immutable and stored in append-only tables with automated archival to cold storage after 1 year.

---

## 5. UI/UX Structure

### 5.1 Navigation
```
Sidebar:
├── Dashboard
├── Organizations
│   ├── All Organizations
│   └── Pending Trials
├── Users
│   ├── All Users
│   └── Impersonation Log
├── Billing
│   ├── Revenue Dashboard
│   ├── Subscriptions
│   ├── Discount Codes
│   └── Credits
├── Feature Flags
├── Content
│   ├── Email Templates
│   └── Widgets
├── Support Tools
├── Reports
└── Audit Log
```

### 5.2 Key UI Patterns
- **Data Tables:** Paginated, sortable, filterable
- **Detail Views:** Slide-out drawers for quick view
- **Action Modals:** Confirmation for all mutations
- **Search:** Global search bar for orgs/users
- **Breadcrumbs:** Clear navigation hierarchy

---

## 6. Phased Implementation

### Phase 0: Foundation (Week 1-2)
- [ ] Finalize requirements with stakeholders
- [ ] Create `/admin/*` route structure with role guard
- [ ] Create admin portal layout (separate sidebar/navigation)
- [ ] Implement super_admin/developer role validation
- [ ] Set up audit log table and basic logging

### Phase 1: Core Views (Week 3-4)
- [ ] Organization directory with search/filter
- [ ] Organization detail view (read-only)
- [ ] User directory with search
- [ ] Basic revenue dashboard (read from Stripe)
- [ ] Audit log viewer

### Phase 2: Actions & Management (Week 5-6)
- [ ] Organization actions (extend trial, grant credits)
- [ ] User actions (password reset, suspend)
- [ ] Impersonation system with audit
- [ ] Discount code CRUD
- [ ] Feature flag management

### Phase 3: Advanced Features (Week 7-8)
- [ ] Content/widget management
- [ ] Support tools (email resend, data fixes)
- [ ] Advanced analytics and reports
- [ ] GDPR compliance tools

### Phase 4: Polish & Automation (Week 9-10)
- [ ] Alerting system (trial expiring, payment failed)
- [ ] Bulk operations
- [ ] Cross-app integrations (Socials app)
- [ ] Performance optimization

---

## 7. Integration Points

### 7.1 Existing Systems
- **Supabase Auth:** Role claims, session management
- **Stripe:** Subscription data, payment processing
- **Credit Ledger:** Existing credit balance system
- **Organizations Table:** Existing tenant structure

### 7.2 New Integrations Needed
- **Stripe Coupons API:** For discount codes
- **Email Service:** For admin-triggered emails
- **Alerting:** Slack/email for critical events
- **Ticketing System:** Integration with support platform (Zendesk, Intercom, or Crisp)
  - Link tickets to organizations/users
  - View ticket history in org/user detail views
  - Create tickets directly from admin portal
  - Auto-attach context (org name, plan, recent actions)

---

## 8. Success Metrics

| Metric | Target |
|--------|--------|
| Time to resolve support issues | < 10 minutes |
| Audit log coverage | 100% of admin actions |
| Impersonation usage | Track for optimization |
| Discount code conversion | Monitor effectiveness |

---

## 9. Confirmed Decisions

| Question | Decision |
|----------|----------|
| Developer access level | Limited (see Section 1.2 for permission matrix) |
| Approval workflows | Yes, for high-risk actions (see Section 4.5) |
| Ticketing integration | Yes, to be selected (Zendesk, Intercom, or Crisp) |
| Audit log retention | Industry standard (see Section 4.6) |
| Architecture | Protected routes (`app.autolisting.io/internal/*`) |

---

## 10. Next Steps

1. **Review this document** and add any missing requirements
2. **Prioritize Phase 1 features** based on immediate needs
3. **Design database migrations** for new tables
4. **Create UI wireframes** for key screens
5. **Begin Phase 0 implementation** when ready

---

*This document will be updated as requirements evolve.*
