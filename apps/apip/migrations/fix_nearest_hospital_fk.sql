-- ============================================================================
-- FIX : Rendre nearest_hospital_id nullable dans triage_reports
-- Problème : La colonne génère automatiquement un UUID qui n'existe pas
-- Solution : Permettre NULL et supprimer le DEFAULT gen_random_uuid()
-- ============================================================================

BEGIN;

-- 1. Supprimer la valeur par défaut qui génère un UUID aléatoire
ALTER TABLE public.triage_reports
  ALTER COLUMN nearest_hospital_id DROP DEFAULT;

-- 2. Rendre la colonne nullable (au cas où elle ne l'est pas)
ALTER TABLE public.triage_reports
  ALTER COLUMN nearest_hospital_id DROP NOT NULL;

-- 3. Vérification
DO $$
BEGIN
  RAISE NOTICE '✅ Fix appliqué !';
  RAISE NOTICE 'nearest_hospital_id ne génère plus de UUID automatique';
  RAISE NOTICE 'La colonne est maintenant nullable';
END $$;

COMMIT;

-- ============================================================================
-- VÉRIFICATION
-- ============================================================================

SELECT
  column_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'triage_reports'
  AND column_name = 'nearest_hospital_id';

-- Devrait montrer is_nullable = 'YES' et column_default = NULL
