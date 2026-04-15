-- Run this FIRST to check your actual email_templates table structure
-- Copy the results and share them so I can create the correct INSERT statements

-- Check if the table exists and get its columns
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'email_templates' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Also check existing templates
SELECT template_key, template_name, is_active 
FROM public.email_templates
LIMIT 10;
