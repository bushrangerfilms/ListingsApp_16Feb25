-- Grant permissions on crm schema to service_role and authenticated roles
-- This ensures edge functions (using service role) can access crm schema tables

-- Grant usage on crm schema
GRANT USAGE ON SCHEMA crm TO service_role;
GRANT USAGE ON SCHEMA crm TO authenticated;
GRANT USAGE ON SCHEMA crm TO anon;

-- Grant all privileges on all tables in crm schema to service_role
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA crm TO service_role;

-- Grant select on all tables to authenticated (for logged-in users)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA crm TO authenticated;

-- Grant select on public-facing tables to anon (for public website)
GRANT SELECT ON crm.listings TO anon;

-- Grant all privileges on all sequences in crm schema
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA crm TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA crm TO authenticated;

-- Set default privileges for future tables (when new tables are created)
ALTER DEFAULT PRIVILEGES IN SCHEMA crm GRANT ALL PRIVILEGES ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA crm GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA crm GRANT ALL PRIVILEGES ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA crm GRANT USAGE ON SEQUENCES TO authenticated;
