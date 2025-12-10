-- DDL for `patients` table (Supabase/Postgres)
-- Exécuter dans Supabase SQL Editor ou via migration

-- Enable extension if available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table patients
CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  birth_date date,
  gender varchar(16),
  phone varchar(32),
  email varchar(254),
  medical_history text,
  allergies text[],
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes utiles
CREATE INDEX IF NOT EXISTS idx_patients_email ON patients (lower(email));
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients (phone);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_updated_at ON patients;
CREATE TRIGGER trg_set_updated_at
BEFORE UPDATE ON patients
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
