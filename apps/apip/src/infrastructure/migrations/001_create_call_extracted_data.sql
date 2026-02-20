-- Migration: Create call_extracted_data table for AI-extracted structured data
-- Part of SAÉ S6 AI Evolution: Structured Data Extraction & Smart Triage

CREATE TABLE IF NOT EXISTS call_extracted_data (
  extraction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES emergency_calls(call_id) ON DELETE CASCADE,
  patient_age INTEGER,
  patient_gender VARCHAR(10) DEFAULT 'unknown',
  symptoms TEXT[] DEFAULT '{}',
  medical_history TEXT[] DEFAULT '{}',
  is_conscious BOOLEAN,
  is_breathing BOOLEAN,
  has_bleeding BOOLEAN,
  extraction_confidence DECIMAL(3,2) DEFAULT 0,
  extracted_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(call_id)
);

-- Index for fast lookups by call_id
CREATE INDEX IF NOT EXISTS idx_call_extracted_data_call_id ON call_extracted_data(call_id);

-- Comment
COMMENT ON TABLE call_extracted_data IS 'AI-extracted structured data from call transcriptions for smart triage';
