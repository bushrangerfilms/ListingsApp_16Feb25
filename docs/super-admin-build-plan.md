# Super Admin Portal - Comprehensive Build Plan

## Overview

This document outlines the complete build plan for implementing the Super Admin Portal as protected routes (`/internal/*`) within the existing AutoListing.io application.

**Total Estimated Duration:** 9-10 weeks  
**Architecture:** Protected routes within main app at `/internal/*`  
**Access:** `super_admin` and `developer` roles only  
**Backend:** All data access via secured `internal-admin-api` Edge Function

---

## Current Implementation Status

### Completed Infrastructure
- **Route Guard**: `SuperAdminRouteGuard` in `src/components/admin/SuperAdminRouteGuard.tsx`
- **Layout**: `SuperAdminLayout` in `src/components/admin/SuperAdminLayout.tsx`
- **Sidebar**: `SuperAdminSidebar` in `src/components/admin/SuperAdminSidebar.tsx`
- **Permission Hook**: `useSuperAdminPermissions` in `src/hooks/useSuperAdminPermissions.ts`
- **Admin API**: `adminApi` in `src/lib/admin/adminApi.ts`
- **Edge Function**: `internal-admin-api` in `supabase/functions/internal-admin-api/index.ts`

### Database Tables (Verified)
- `admin_audit_log` - Immutable action logging
- `admin_notes` - Internal notes on orgs/users
- `admin_alert_rules` - Alert configuration
- `admin_alert_history` - Alert trigger history
- `discount_codes` - Promo code system
- `feature_flags` - Feature toggles
- `feature_flag_overrides` - Per-org overrides

### Existing Pages
| Page | Path | Status |
|------|------|--------|
| Dashboard | `/internal` | Complete |
| Organizations | `/internal/organizations` | Complete (needs Edge Function migration) |
| Users | `/internal/users` | Complete (needs Edge Function migration) |
| Billing | `/internal/billing` | Complete |
| Discount Codes | `/internal/discounts` | Complete |
| Feature Flags | `/internal/feature-flags` | Complete |
| Support Tools | `/internal/support` | Partial |
| Analytics | `/internal/analytics` | Complete |
| GDPR | `/internal/gdpr` | Partial |
| Alerts | `/internal/alerts` | Complete |
| Audit Log | `/internal/audit-log` | Complete |

---

## Phase 0: Alignment & Verification (CURRENT)
**Status:** In Progress  
**Goal:** Ensure documentation matches implementation, verify database state

### Tasks
| # | Task | Status |
|---|------|--------|
| 0.1 | Update build plan to `/internal/*` architecture | Complete |
| 0.2 | Verify alert table migrations in Supabase | Complete |
| 0.3 | Clean up legacy components if present | Pending |

---

## Phase 1: Security & Data Access Hardening
**Goal:** Route all admin data access through secured Edge Function

### 1.1 Edge Function Handlers
| Task | Description | Priority |
|------|-------------|----------|
| Add organizations list handler | Return paginated orgs with counts | High |
| Add users list handler | Return paginated users with org memberships | High |
| Add organizations search handler | Search by name/slug/email | High |
| Add users search handler | Search by ID/email | High |

### 1.2 Frontend Migration
| Task | Description | Priority |
|------|-------------|----------|
| Update OrganizationsPage | Use adminApi instead of Supabase client | High |
| Update UsersPage | Use adminApi instead of Supabase client | High |
| Add analytics role-based redaction | Hide sensitive metrics from developers | Medium |

### 1.3 Rate Limiting
| Task | Description | Priority |
|------|-------------|----------|
| Add rate limiting to alert test | Prevent abuse | Medium |
| Add rate limiting to bulk operations | Prevent abuse | Medium |

---

## Phase 2: Backend Capability Coverage
**Goal:** Implement all missing Edge Function handlers

### 2.1 Bulk Operations
| Task | Endpoint | Description |
|------|----------|-------------|
| Bulk user suspend | POST /bulk/users/suspend | Suspend multiple users |
| Bulk user email | POST /bulk/users/email | Send email to multiple users |
| Bulk org credits | POST /bulk/orgs/credits | Grant credits to multiple orgs |

### 2.2 Admin Notes
| Task | Endpoint | Description |
|------|----------|-------------|
| List notes | GET /notes | List notes for entity |
| Create note | POST /notes | Add note to org/user |
| Update note | PATCH /notes/:id | Edit note |
| Delete note | DELETE /notes/:id | Remove note |

### 2.3 GDPR Processing
| Task | Endpoint | Description |
|------|----------|-------------|
| Export user data | POST /gdpr/export | Generate data export |
| Delete user data | POST /gdpr/delete | Process deletion request |

### 2.4 Support Tools
| Task | Endpoint | Description |
|------|----------|-------------|
| Password reset | POST /support/password-reset | Trigger reset email |
| Verification resend | POST /support/verify-resend | Resend verification |

### 2.5 Alert Notifications
| Task | Endpoint | Description |
|------|----------|-------------|
| Send alert notification | POST /alerts/send | Dispatch via Resend |

---

## Phase 3: Navigation & Frontend Wiring
**Goal:** Complete sidebar navigation and wire to backend

### 3.1 Sidebar Updates
| Task | Description |
|------|-------------|
| Add Support Tools sublinks | Password reset, verification resend |
| Add Communications section | Email queue viewer |
| Gate items by permission | Hide super_admin-only from developers |
| Add breadcrumbs | Show current location |
| Add global search | Search across entities |

### 3.2 New Pages
| Page | Path | Description |
|------|------|-------------|
| Email Queue | `/internal/email-queue` | View pending/sent emails |
| Impersonation Approvals | `/internal/approvals` | Approval queue |

---

## Phase 4: Feature Completion
**Goal:** Complete all partial implementations

### 4.1 Admin Notes UI
- Wire notes component to backend
- Show in org/user detail drawers
- Add create/edit/delete functionality

### 4.2 GDPR Execution
- Process data export requests
- Process deletion requests
- Generate downloadable exports

### 4.3 Dashboard KPIs
- Add summary cards on main dashboard
- Real-time metrics

### 4.4 Predictive Analytics
- Churn prediction
- Growth forecasting

---

## Phase 5: Testing & Resilience
**Goal:** Production readiness

### 5.1 Authorization Tests
- Verify all endpoints enforce correct roles
- Regression test suite

### 5.2 Integration Health
- Verify Resend connectivity
- Verify Stripe connectivity

### 5.3 Documentation
- Update replit.md
- API documentation

---

## File Structure

```
src/
├── components/
│   └── admin/
│       ├── SuperAdminRouteGuard.tsx
│       ├── SuperAdminLayout.tsx
│       ├── SuperAdminSidebar.tsx
│       ├── OrganizationDetailDrawer.tsx
│       ├── ImpersonationBanner.tsx
│       └── ...
├── pages/
│   └── internal/
│       ├── SuperAdminDashboard.tsx
│       ├── OrganizationsPage.tsx
│       ├── UsersPage.tsx
│       ├── BillingDashboardPage.tsx
│       ├── DiscountCodesPage.tsx
│       ├── FeatureFlagsPage.tsx
│       ├── SupportToolsPage.tsx
│       ├── AnalyticsPage.tsx
│       ├── GdprCompliancePage.tsx
│       ├── AlertsPage.tsx
│       └── AuditLogPage.tsx
├── hooks/
│   ├── useSuperAdminPermissions.ts
│   └── admin/
│       └── useAdminPermissions.ts
└── lib/
    └── admin/
        ├── adminApi.ts
        ├── permissions.ts
        └── types.ts

supabase/
└── functions/
    └── internal-admin-api/
        └── index.ts
```

---

## Permission Matrix

| Feature | super_admin | developer |
|---------|-------------|-----------|
| View organizations | Yes | Yes |
| View users | Yes | Yes |
| Impersonate users | Yes | No |
| Grant credits (any amount) | Yes | No |
| Grant credits (≤€100) | Yes | Yes |
| Manage discount codes | Yes | Yes |
| Manage feature flags | Yes | Yes |
| Process GDPR requests | Yes | No |
| Create/edit alert rules | Yes | No |
| Test alerts | Yes | No |
| View audit log | Yes | Yes |
| Bulk operations | Yes | No |

---

## Security Requirements

1. **All data access through Edge Function** - No direct Supabase queries from internal pages
2. **Server-side role validation** - Every mutation checks role before executing
3. **Audit logging** - All mutations logged with before/after state
4. **Rate limiting** - Prevent abuse of sensitive endpoints
5. **Impersonation tracking** - Full audit trail of impersonation sessions

---

*Last Updated: December 2024*
