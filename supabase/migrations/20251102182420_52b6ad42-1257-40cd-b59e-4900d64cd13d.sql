-- Add CRM configuration columns to ai_assistant_config table
ALTER TABLE ai_assistant_config 
ADD COLUMN IF NOT EXISTS crm_auto_capture boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS agent_notification_email text,
ADD COLUMN IF NOT EXISTS required_lead_fields jsonb DEFAULT '["name", "email"]'::jsonb,
ADD COLUMN IF NOT EXISTS lead_capture_style text DEFAULT 'balanced';

-- Add comment for documentation
COMMENT ON COLUMN ai_assistant_config.crm_auto_capture IS 'Enable automatic CRM lead capture from AI conversations';
COMMENT ON COLUMN ai_assistant_config.agent_notification_email IS 'Email address to notify when leads request agent contact';
COMMENT ON COLUMN ai_assistant_config.required_lead_fields IS 'Fields required before saving to CRM (e.g., ["name", "email"])';
COMMENT ON COLUMN ai_assistant_config.lead_capture_style IS 'How aggressive to be in gathering info: subtle, balanced, or aggressive';