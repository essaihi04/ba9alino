-- ============================================================================
-- 002 — Default organization "Ba9alino"
-- All existing data will be reassigned to this org in step 004.
-- ============================================================================

INSERT INTO organizations (name, slug, is_active, is_default, plan)
VALUES ('Ba9alino', 'ba9alino', TRUE, TRUE, 'pro')
ON CONFLICT (slug) DO UPDATE
  SET is_default = TRUE,
      is_active  = TRUE;

-- Sanity check
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM organizations WHERE is_default = TRUE;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 default organization, found %', v_count;
  END IF;
END $$;
