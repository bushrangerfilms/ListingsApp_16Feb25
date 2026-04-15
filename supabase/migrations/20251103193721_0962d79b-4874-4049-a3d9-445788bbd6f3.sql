-- Phase 2.1a: Add developer to app_role enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t 
                 JOIN pg_enum e ON t.oid = e.enumtypid  
                 WHERE t.typname = 'app_role' AND e.enumlabel = 'developer') THEN
    ALTER TYPE public.app_role ADD VALUE 'developer';
  END IF;
END $$;