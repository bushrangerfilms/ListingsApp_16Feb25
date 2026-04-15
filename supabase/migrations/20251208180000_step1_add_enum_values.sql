-- Phase 3.1 Step 1: Add new enum values to feature_type
-- RUN THIS FIRST, then run Step 2

-- Add property_extraction if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'property_extraction' AND enumtypid = 'public.feature_type'::regtype) THEN
    ALTER TYPE public.feature_type ADD VALUE 'property_extraction';
  END IF;
END $$;

-- Add email_send if it doesn't exist  
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'email_send' AND enumtypid = 'public.feature_type'::regtype) THEN
    ALTER TYPE public.feature_type ADD VALUE 'email_send';
  END IF;
END $$;

-- Verify the enum values
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'public.feature_type'::regtype ORDER BY enumsortorder;
