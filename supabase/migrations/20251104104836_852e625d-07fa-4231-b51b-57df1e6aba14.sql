-- Add missing columns to webhook_logs for retry tracking
ALTER TABLE webhook_logs 
ADD COLUMN IF NOT EXISTS attempt_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- Add index for monitoring queries
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status 
ON webhook_logs(response_status, created_at DESC);