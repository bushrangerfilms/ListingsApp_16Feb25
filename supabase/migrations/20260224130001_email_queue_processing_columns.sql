-- H4: Add processing support columns to profile_email_queue
-- Enables: batch locking (processing status), retry tracking, dead-letter (failed status)

-- Add new columns
ALTER TABLE crm.profile_email_queue
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;

-- Extend status check to include 'processing' and 'failed'
ALTER TABLE crm.profile_email_queue DROP CONSTRAINT IF EXISTS profile_email_queue_status_check;
ALTER TABLE crm.profile_email_queue ADD CONSTRAINT profile_email_queue_status_check
  CHECK (status IN ('pending', 'processing', 'sent', 'cancelled', 'completed', 'failed'));

-- Index for picking up stale processing items
CREATE INDEX IF NOT EXISTS idx_email_queue_processing
  ON crm.profile_email_queue(status, processing_started_at)
  WHERE status = 'processing';
