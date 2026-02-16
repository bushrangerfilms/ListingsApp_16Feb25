-- Check for and drop any unique index that might be causing this
DROP INDEX IF EXISTS unique_single_admin;

-- Also check for a constraint by this name on the table
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'unique_single_admin'
    ) THEN
        ALTER TABLE public.user_roles DROP CONSTRAINT unique_single_admin;
    END IF;
END $$;