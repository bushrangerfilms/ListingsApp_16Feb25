# Database Migration Guide

## Quick Setup (5 minutes)

### Step 1: Apply All Migrations

1. Open the **Supabase SQL Editor**: 
   https://supabase.com/dashboard/project/sjcfcxjpukgeaxxkffpq/sql/new

2. Copy the entire contents of `APPLY_MIGRATIONS.sql` (in this project root)

3. Paste into the SQL Editor and click **Run**

This will create all necessary tables in both `public` and `crm` schemas.

### Step 2: Link Your User Account

Once migrations are applied, run this SQL to give yourself admin access:

```sql
-- Grant admin role
INSERT INTO public.user_roles (user_id, role)
VALUES ('b3201c8e-a10c-4fe1-8fa7-6dd97f65dfd1', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Link to Bridge Auctioneers organization
INSERT INTO public.user_organizations (user_id, organization_id, role)
VALUES ('b3201c8e-a10c-4fe1-8fa7-6dd97f65dfd1', 'b3d49735-1a04-42e0-a73d-a06b5f54de62', 'admin')
ON CONFLICT (user_id, organization_id) DO NOTHING;
```

### Step 3: Log In

1. Go to your Replit webview URL
2. Log in with: `peter@streamlinedai.tech`
3. You should now have full admin access to the Bridge Auctioneers CRM!

---

## What Gets Created

### Public Schema Tables
- `user_roles` - User permission roles
- `user_organizations` - Organization memberships
- `rate_limits` - API rate limiting
- `valuation_requests` - Property valuation requests
- Storage buckets for photos/logos

### CRM Schema Tables
- `organizations` - Multi-tenant organizations
- `listings` - Property listings (sales, rentals, holidays)
- `buyer_profiles` - Buyer/tenant CRM
- `seller_profiles` - Seller/landlord CRM
- `crm_activities` - Activity timeline
- `email_sequences` - Email automation
- `email_templates` - Reusable email templates
- `ai_assistant_config` - AI assistant settings
- `ai_training_content` - Custom knowledge base
- `ai_conversations` - Chat history
- `webhook_logs` - Webhook delivery logs
- And 20+ more tables...

---

## Troubleshooting

### If you get "relation already exists" errors:
This means some tables were already created. The script uses `CREATE TABLE IF NOT EXISTS` so it should be safe to run multiple times.

### If you get permission errors:
Make sure you're logged in to Supabase with the correct account that owns this project.

### If the SQL Editor times out:
The script is large (2,292 lines). Try:
1. Refresh the page and try again
2. Or contact Supabase support to increase query timeout

---

## Next Steps After Migration

1. ✅ Verify tables exist: Check the Supabase Table Editor
2. ✅ Deploy Edge Functions: Run `supabase functions deploy --project-ref sjcfcxjpukgeaxxkffpq`
3. ✅ Test listing creation with AI extraction
4. ✅ Set up email sequences
5. ✅ Train AI assistant with your content
