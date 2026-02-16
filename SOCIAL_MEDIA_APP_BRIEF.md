# Brief for Social Media App Team: Shared Authentication Changes

## 🎯 Purpose
The CRM app has implemented a super admin impersonation feature that extends the shared authentication system in the `public` schema. This brief explains what changed and how it affects the Social Media app.

---

## 📋 What Changed in Shared Schema (public)

### 1. Extended `app_role` Enum
**Location**: `public.user_roles` table

**New Values Added**:
- `super_admin` - Highest privilege level, can impersonate any organization
- `developer` - For future use (dev tools, debugging features)

**Existing Values** (unchanged):
- `admin`
- `user`

### 2. New Table: `impersonation_sessions`
**Location**: `public.impersonation_sessions`

**Purpose**: Tracks when super admins impersonate organizations for support/debugging

**Schema**:
```sql
CREATE TABLE public.impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  reason text,
  UNIQUE(super_admin_id, organization_id, started_at)
);
```

**RLS Policies**:
- Only super_admins can insert (create impersonation sessions)
- Only super_admins can view their own sessions
- Service role has full access

### 3. New RLS Helper Function: `get_effective_org_ids()`
**Location**: `public.get_effective_org_ids(user_id uuid)`

**Purpose**: Returns organization IDs a user can access (memberships + active impersonation)

**Used In**: RLS policies for the `public.organizations` table

**Impact**: Organizations table RLS now uses this function instead of direct membership checks

### 4. New Helper RPC Functions
All use `auth.uid()` internally (no client parameters for security):

- `is_super_admin()` - Check if current user is super_admin
- `get_active_impersonation()` - Get current user's active impersonation session
- `end_impersonation_session()` - End current user's active session
- `get_impersonatable_organizations()` - List all orgs (super_admin only)

---

## ⚠️ Critical RLS Security Fix

### Organizations Table Policy Updated
**Migration**: `20251109104000_hotfix_organizations_rls_policy.sql`

**Problem Fixed**: The organizations table had a policy that allowed ALL authenticated users to view/modify any organization (intended only for service_role)

**Old Policy** (VULNERABLE):
```sql
CREATE POLICY "Users can view accessible organizations"
  ON organizations FOR ALL
  USING (true);  -- ❌ Allowed everyone!
```

**New Policy** (SECURE):
```sql
-- Regular authenticated users: only see orgs they belong to or are impersonating
CREATE POLICY "Users can view accessible organizations"
  ON organizations FOR ALL
  TO authenticated
  USING (id = ANY(get_effective_org_ids(auth.uid())));

-- Service role: full access (for edge functions, migrations, etc.)
CREATE POLICY "Service role full access"
  ON organizations FOR ALL
  TO service_role
  USING (true);
```

---

## 🔒 Security Considerations

### What's Safe to Use in Social Media App:

✅ **Shared Authentication**: Continue using `public.organizations`, `public.user_roles`, `public.user_organizations`

✅ **Role Checks**: You can check for `super_admin` role in your app (though it's optional)

✅ **RLS Policies**: All policies correctly scoped - your app's data remains isolated

### What NOT to Use:

❌ **Impersonation System**: This is CRM-specific functionality. Social Media app doesn't need to implement impersonation UI.

❌ **Calling Impersonation RPCs**: Only CRM app needs these functions

---

## 🚀 Migration Instructions

### Step 1: Apply Security Hotfix (CRITICAL - Do This First!)
```sql
-- Run in Supabase SQL Editor
-- File: supabase/migrations/20251109104000_hotfix_organizations_rls_policy.sql
```
This fixes the organizations table vulnerability that affected BOTH apps.

### Step 2: Apply Impersonation Feature (Optional)
```sql
-- Run in Supabase SQL Editor  
-- File: supabase/migrations/20251109103804_add_super_admin_impersonation.sql
```
This adds impersonation tables and functions (won't affect Social Media app if you don't use them).

### Step 3: Regenerate TypeScript Types
```bash
npx supabase gen types typescript --project-id sjcfcxjpukgeaxxkffpq --schema public > src/integrations/supabase/types/public.ts
```

---

## 🎨 UI Changes (CRM App Only)

The CRM app now has:
1. **OrganizationSwitcher** - Dialog for super admins to select organizations
2. **ImpersonationBanner** - Yellow banner showing active impersonation with exit button

**Social Media App**: No UI changes needed unless you want to implement similar features.

---

## 📊 Database Impact

### Tables Added:
- `public.impersonation_sessions` (new)

### Tables Modified:
- `public.user_roles` - Extended enum with `super_admin`, `developer`
- `public.organizations` - Updated RLS policies (critical security fix)

### Functions Added:
- `get_effective_org_ids(uuid)` - RLS helper
- `is_super_admin()` - Role check
- `get_active_impersonation()` - Session lookup
- `end_impersonation_session()` - End session
- `get_impersonatable_organizations()` - List orgs

---

## 🧪 Testing Recommendations

After applying migrations, test:

1. ✅ **Login Still Works** - Verify users can log in to both apps
2. ✅ **Organization Access** - Users only see their own org data
3. ✅ **Multi-Org Users** - Users with multiple orgs see correct list
4. ✅ **Role Permissions** - Admin vs. user roles still work correctly

---

## 📞 Questions?

If you have questions about:
- Migration timing
- Database changes
- RLS policy impacts
- TypeScript type regeneration

Feel free to coordinate through shared Replit chat (user can copy/paste messages between apps).

---

## 📝 Summary

**What You MUST Do**:
1. ✅ Run security hotfix migration (`20251109104000_hotfix_organizations_rls_policy.sql`)
2. ✅ Regenerate TypeScript types

**What's Optional**:
- ⚙️ Run impersonation migration (won't break anything if you skip it)
- 🎨 Implement impersonation UI (not needed unless Social app wants this feature)

**Critical**: The security hotfix MUST be applied to both apps to prevent unauthorized org access!
