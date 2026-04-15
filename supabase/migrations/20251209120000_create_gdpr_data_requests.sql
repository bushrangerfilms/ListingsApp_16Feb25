-- GDPR Data Requests Table for Super Admin Portal
-- Tracks data export and deletion requests for GDPR compliance

CREATE TABLE IF NOT EXISTS gdpr_data_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_type VARCHAR(50) NOT NULL CHECK (request_type IN ('data_export', 'data_deletion', 'access_request')),
  target_type VARCHAR(50) NOT NULL CHECK (target_type IN ('user', 'organization')),
  target_id UUID,
  target_email VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected')),
  notes TEXT,
  rejection_reason TEXT,
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT target_identifier_check CHECK (target_id IS NOT NULL OR target_email IS NOT NULL)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_status ON gdpr_data_requests(status);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_target_type ON gdpr_data_requests(target_type);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_created_at ON gdpr_data_requests(created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_gdpr_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gdpr_requests_updated_at ON gdpr_data_requests;
CREATE TRIGGER gdpr_requests_updated_at
  BEFORE UPDATE ON gdpr_data_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_gdpr_requests_updated_at();

-- RLS Policies
ALTER TABLE gdpr_data_requests ENABLE ROW LEVEL SECURITY;

-- Only super_admin and developer can view GDPR requests
CREATE POLICY "Super admins and developers can view GDPR requests"
  ON gdpr_data_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'developer')
    )
  );

-- Only super_admin can insert GDPR requests
CREATE POLICY "Super admins can create GDPR requests"
  ON gdpr_data_requests
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

-- Only super_admin can update GDPR requests
CREATE POLICY "Super admins can update GDPR requests"
  ON gdpr_data_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

-- Note: INSERT/UPDATE operations are performed via Edge Function using service role
-- RLS policies restrict direct access to super_admin/developer roles only
-- No broad GRANT statements - service role bypasses RLS for Edge Function operations

COMMENT ON TABLE gdpr_data_requests IS 'Tracks GDPR data export and deletion requests for compliance';
