-- ============================================================================
-- 009 — Link existing users to the Ba9alino organization
-- All rows in user_accounts are assumed to belong to the default org.
-- ============================================================================

DO $$
DECLARE
  v_org UUID;
  v_inserted BIGINT := 0;
BEGIN
  SELECT id INTO v_org FROM organizations WHERE is_default = TRUE LIMIT 1;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'No default organization found';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_accounts') THEN
    INSERT INTO organization_members (organization_id, user_id, user_account_id, username, role, is_active)
    SELECT
      v_org,
      ua.auth_user_id,
      ua.id,
      ua.username,
      COALESCE(ua.role, 'employee'),
      COALESCE(ua.is_active, TRUE)
    FROM user_accounts ua
    LEFT JOIN organization_members m
      ON m.user_account_id = ua.id AND m.organization_id = v_org
    WHERE m.id IS NULL;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    RAISE NOTICE 'Linked % user_accounts to Ba9alino', v_inserted;
  END IF;

  -- Also link any virtual_accounts (custom auth used in the codebase)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='virtual_accounts') THEN
    INSERT INTO organization_members (organization_id, user_account_id, username, role, is_active)
    SELECT
      v_org,
      va.id,
      va.name,
      COALESCE(va.role, 'employee'),
      COALESCE(va.is_active, TRUE)
    FROM virtual_accounts va
    LEFT JOIN organization_members m
      ON m.user_account_id = va.id AND m.organization_id = v_org
    WHERE m.id IS NULL;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    RAISE NOTICE 'Linked % virtual_accounts to Ba9alino', v_inserted;
  END IF;
END $$;
