# Setting Up Your Admin Account

## Quick Start Guide

Follow these steps to create an admin account and access the Bridge Auctioneers CRM dashboard:

### Step 1: Create a User Account

**Option A: Through the App (Recommended)**
1. Open your Replit preview/webview
2. Look for a "Sign Up" or "Login" button
3. Create an account with your email

**Option B: Through Supabase Dashboard**
1. Go to your Supabase project: https://supabase.com/dashboard/project/sjcfcxjpukgeaxxkffpq
2. Navigate to **Authentication** → **Users**
3. Click **Add User** → **Create new user**
4. Enter your email and password
5. Click **Create user**
6. **Copy the User ID (UUID)** - you'll need this!

### Step 2: Get Your Organization ID

1. In Supabase Dashboard, go to **SQL Editor**
2. Run this query:
   ```sql
   SELECT id, business_name, slug 
   FROM crm.organizations 
   WHERE slug = 'bridge-auctioneers';
   ```
3. **Copy the Organization ID** from the results

### Step 3: Link Your Account to Organization

1. Open the `setup_admin_user.sql` file in this project
2. Replace `YOUR_USER_ID_HERE` with your User ID (from Step 1)
3. Replace `YOUR_ORG_ID_HERE` with your Organization ID (from Step 2)
4. Run the modified SQL in Supabase SQL Editor

### Step 4: Test Your Access

1. Go back to your Replit preview
2. Log in with your email/password
3. You should now see the Bridge Auctioneers dashboard! 🎉

## What This Does

The setup script:
- ✅ Adds you to the `user_roles` table as an **admin**
- ✅ Links you to Bridge Auctioneers in `user_organizations`
- ✅ Gives you full access to manage listings, CRM, email sequences, AI assistant, etc.

## Troubleshooting

**Problem: "Organization not found" error**
- Make sure you created the organization record in `crm.organizations` table
- Verify the slug is exactly `bridge-auctioneers`

**Problem: "No access" after logging in**
- Check that you ran the SQL script with correct IDs
- Verify with Step 5 in `setup_admin_user.sql`

**Problem: Can't find my User ID**
- In Supabase Dashboard → Authentication → Users
- Click on your user
- The ID is shown at the top

## Need Help?

If you're stuck, check the browser console (F12) for error messages and share them in the chat.
