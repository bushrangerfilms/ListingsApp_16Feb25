-- Create signup_requests table for tracking signup flow and UTM sources
CREATE TABLE IF NOT EXISTS signup_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  plan_name VARCHAR(50) NOT NULL DEFAULT 'starter',
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  stripe_checkout_session_id VARCHAR(255),
  utm_source VARCHAR(255),
  utm_medium VARCHAR(255),
  utm_campaign VARCHAR(255),
  utm_term VARCHAR(255),
  utm_content VARCHAR(255),
  referrer TEXT,
  landing_page TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signup_requests_email ON signup_requests(email);
CREATE INDEX IF NOT EXISTS idx_signup_requests_status ON signup_requests(status);
CREATE INDEX IF NOT EXISTS idx_signup_requests_organization_id ON signup_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_signup_requests_created_at ON signup_requests(created_at);

ALTER TABLE signup_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to signup_requests"
  ON signup_requests
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users can view their own signup requests"
  ON signup_requests
  FOR SELECT
  USING (user_id = auth.uid());

COMMENT ON TABLE signup_requests IS 'Tracks signup requests for analytics and UTM attribution';
