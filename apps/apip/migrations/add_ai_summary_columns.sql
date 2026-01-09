-- ============================================================================
-- MIGRATION : Ajouter colonnes pour résumés IA dans triage_reports
-- Date : 2026-01-05
-- Objectif : Permettre sauvegarde résumés IA + classification P0-P3
-- ============================================================================

BEGIN;

-- 1. Ajouter colonnes pour résumés IA et classification
ALTER TABLE public.triage_reports
  ADD COLUMN IF NOT EXISTS priority_classification varchar(3)
    CHECK (priority_classification IN ('P0', 'P1', 'P2', 'P3')),
  ADD COLUMN IF NOT EXISTS ai_explanation text,
  ADD COLUMN IF NOT EXISTS classification_confidence real
    CHECK (classification_confidence BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS classification_source varchar(20) DEFAULT 'ai_agent'
    CHECK (classification_source IN ('ai_agent', 'arm', 'medecin')),
  ADD COLUMN IF NOT EXISTS ai_model_version varchar(50) DEFAULT 'groq/compound',
  ADD COLUMN IF NOT EXISTS validated_by_doctor boolean DEFAULT false;

-- 2. Créer index pour performance
CREATE INDEX IF NOT EXISTS idx_triage_reports_call
  ON public.triage_reports(call_id);

CREATE INDEX IF NOT EXISTS idx_triage_reports_priority
  ON public.triage_reports(priority_classification);

-- 3. Afficher résumé migration
DO $$
BEGIN
  RAISE NOTICE '✅ Migration terminée avec succès !';
  RAISE NOTICE 'Colonnes ajoutées : priority_classification, ai_explanation, classification_confidence';
  RAISE NOTICE 'Index créés : idx_triage_reports_call, idx_triage_reports_priority';
END $$;

COMMIT;

-- ============================================================================
-- VÉRIFICATION POST-MIGRATION
-- ============================================================================

-- Vérifier que les colonnes existent
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'triage_reports'
  AND column_name IN (
    'priority_classification',
    'ai_explanation',
    'classification_confidence',
    'classification_source',
    'ai_model_version',
    'validated_by_doctor'
  );

-- Devrait retourner 6 lignes si tout est OK
