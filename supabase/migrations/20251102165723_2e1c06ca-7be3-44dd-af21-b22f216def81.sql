-- Create knowledge documents table for uploaded content
CREATE TABLE knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  document_type text NOT NULL CHECK (document_type IN ('market_report', 'faq', 'company_info', 'custom')),
  file_url text,
  tokens_count integer DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('active', 'processing', 'archived', 'failed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create AI assistant configuration table
CREATE TABLE ai_assistant_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  personality text DEFAULT 'professional' CHECK (personality IN ('professional', 'friendly', 'casual', 'expert')),
  system_prompt text,
  enabled_capabilities jsonb DEFAULT '["property_recommendations", "faq_answering"]'::jsonb,
  response_length text DEFAULT 'balanced' CHECK (response_length IN ('concise', 'balanced', 'detailed')),
  max_recommendations integer DEFAULT 3 CHECK (max_recommendations BETWEEN 1 AND 5),
  model_name text DEFAULT 'google/gemini-2.5-flash',
  include_active_listings boolean DEFAULT true,
  include_sold_listings boolean DEFAULT false,
  include_buyer_preferences boolean DEFAULT true,
  widget_enabled boolean DEFAULT false,
  widget_color text DEFAULT '#2563eb',
  welcome_message text DEFAULT 'Hi! I can help you find the perfect property.',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Create AI training metrics table
CREATE TABLE ai_training_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  properties_count integer DEFAULT 0,
  documents_count integer DEFAULT 0,
  total_tokens integer DEFAULT 0,
  training_status text DEFAULT 'ready' CHECK (training_status IN ('ready', 'training', 'error', 'needs_update')),
  error_message text,
  last_trained_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Create AI test conversations table
CREATE TABLE ai_test_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  messages jsonb NOT NULL,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_assistant_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_training_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_test_conversations ENABLE ROW LEVEL SECURITY;

-- RLS policies for knowledge_documents
CREATE POLICY "Admins can manage their knowledge documents"
ON knowledge_documents
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for ai_assistant_config
CREATE POLICY "Admins can manage their AI config"
ON ai_assistant_config
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for ai_training_metrics
CREATE POLICY "Admins can view their training metrics"
ON ai_training_metrics
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for ai_test_conversations
CREATE POLICY "Admins can manage their test conversations"
ON ai_test_conversations
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add updated_at trigger for knowledge_documents
CREATE TRIGGER update_knowledge_documents_updated_at
BEFORE UPDATE ON knowledge_documents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add updated_at trigger for ai_assistant_config
CREATE TRIGGER update_ai_assistant_config_updated_at
BEFORE UPDATE ON ai_assistant_config
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();