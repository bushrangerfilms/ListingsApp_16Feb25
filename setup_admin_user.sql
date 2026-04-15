-- ============================================================================
-- ADMIN USER SETUP FOR BRIDGE AUCTIONEERS
-- ============================================================================
-- This script sets up an admin user account for the CRM app
-- 
-- PREREQUISITES:
-- 1. Create a user account first through Supabase Auth Dashboard or app signup
-- 2. Get the user's UUID from auth.users table
-- 3. Get the organization ID for Bridge Auctioneers
--
-- USAGE:
-- 1. Replace YOUR_USER_ID_HERE with the actual user UUID
-- 2. Replace YOUR_ORG_ID_HERE with the Bridge Auctioneers org ID  
-- 3. Run this SQL in Supabase SQL Editor
-- ============================================================================

-- Step 1: Find your user ID (run this first to get YOUR_USER_ID)
SELECT id, email, created_at 
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;

-- Step 2: Find Bridge Auctioneers organization ID (run this to get YOUR_ORG_ID)
SELECT id, business_name, slug 
FROM crm.organizations 
WHERE slug = 'bridge-auctioneers';

-- Step 3: Add user to admin role (REPLACE YOUR_USER_ID_HERE)
INSERT INTO crm.user_roles (user_id, role)
VALUES ('YOUR_USER_ID_HERE', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Step 4: Link user to Bridge Auctioneers organization (REPLACE BOTH IDs)
INSERT INTO crm.user_organizations (user_id, organization_id, role)
VALUES ('YOUR_USER_ID_HERE', 'YOUR_ORG_ID_HERE', 'admin')
ON CONFLICT (user_id, organization_id) DO NOTHING;

-- Step 5: Verify setup (REPLACE YOUR_USER_ID_HERE)
SELECT 
  u.email,
  ur.role as user_role,
  o.business_name,
  uo.role as org_role
FROM auth.users u
LEFT JOIN crm.user_roles ur ON ur.user_id = u.id
LEFT JOIN crm.user_organizations uo ON uo.user_id = u.id
LEFT JOIN crm.organizations o ON o.id = uo.organization_id
WHERE u.id = 'YOUR_USER_ID_HERE';
