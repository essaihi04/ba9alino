-- ============================================================================
-- 010 — SuperAdmin RPC functions
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- superadmin_login(username, password) -> { success, super_admin_id, full_name, token }
-- The "token" is a random opaque string that the frontend stores and sends
-- back as a header to subsequent RPCs (`superadmin_*`) for authorization.
-- For now, we keep it stateless: the front simply remembers username+hash and
-- re-validates per call. This is acceptable for a 1-user admin console.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.superadmin_login(p_username TEXT, p_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row super_admins%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM super_admins
   WHERE LOWER(username) = LOWER(p_username) AND is_active = TRUE
   LIMIT 1;

  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_credentials');
  END IF;

  IF v_row.password_hash <> crypt(p_password, v_row.password_hash) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_credentials');
  END IF;

  UPDATE super_admins SET last_login_at = NOW() WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'success',        TRUE,
    'super_admin_id', v_row.id,
    'username',       v_row.username,
    'full_name',      v_row.full_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.superadmin_login(TEXT, TEXT) TO PUBLIC;

-- ---------------------------------------------------------------------------
-- Internal helper: validate that the call carries valid SuperAdmin creds.
-- We require the front to pass username+password on each privileged call.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._assert_super_admin(p_username TEXT, p_password TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row super_admins%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM super_admins
   WHERE LOWER(username) = LOWER(p_username) AND is_active = TRUE
   LIMIT 1;
  IF v_row.id IS NULL OR v_row.password_hash <> crypt(p_password, v_row.password_hash) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
  END IF;
  -- Mark this transaction as super-admin so RLS bypass works for the rest of the call
  PERFORM set_config('app.is_super_admin', 'true', TRUE);
  RETURN v_row.id;
END;
$$;

REVOKE ALL ON FUNCTION public._assert_super_admin(TEXT, TEXT) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- superadmin_list_organizations
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.superadmin_list_organizations(p_username TEXT, p_password TEXT)
RETURNS TABLE (
  id            UUID,
  name          TEXT,
  slug          TEXT,
  is_active     BOOLEAN,
  is_default    BOOLEAN,
  plan          TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  created_at    TIMESTAMPTZ,
  members_count BIGINT,
  products_count BIGINT,
  orders_count  BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._assert_super_admin(p_username, p_password);

  RETURN QUERY
  SELECT
    o.id, o.name, o.slug, o.is_active, o.is_default, o.plan,
    o.contact_email, o.contact_phone, o.created_at,
    COALESCE((SELECT COUNT(*) FROM organization_members m WHERE m.organization_id = o.id), 0)::BIGINT,
    COALESCE((SELECT COUNT(*) FROM products p WHERE p.organization_id = o.id), 0)::BIGINT,
    COALESCE((SELECT COUNT(*) FROM orders r WHERE r.organization_id = o.id), 0)::BIGINT
  FROM organizations o
  ORDER BY o.is_default DESC, o.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.superadmin_list_organizations(TEXT, TEXT) TO PUBLIC;

-- ---------------------------------------------------------------------------
-- superadmin_create_organization
-- Creates a new org + an initial admin (stored as a virtual_account-like row
-- in user_accounts) + an organization_member entry.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.superadmin_create_organization(
  p_username        TEXT,
  p_password        TEXT,
  p_org_name        TEXT,
  p_org_slug        TEXT,
  p_admin_username  TEXT,
  p_admin_password  TEXT,
  p_admin_full_name TEXT DEFAULT NULL,
  p_contact_email   TEXT DEFAULT NULL,
  p_contact_phone   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id     UUID;
  v_account_id UUID;
  v_email      TEXT;
BEGIN
  PERFORM public._assert_super_admin(p_username, p_password);

  IF EXISTS (SELECT 1 FROM organizations WHERE slug = LOWER(p_org_slug)) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'slug_exists');
  END IF;

  IF EXISTS (
    SELECT 1 FROM organization_members WHERE LOWER(username) = LOWER(p_admin_username)
  ) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'admin_username_exists');
  END IF;

  -- 1) Organization
  INSERT INTO organizations (name, slug, is_active, plan, contact_email, contact_phone)
  VALUES (p_org_name, LOWER(p_org_slug), TRUE, 'free', p_contact_email, p_contact_phone)
  RETURNING id INTO v_org_id;

  -- 2) Initial admin in user_accounts (custom auth)
  v_email := LOWER(p_admin_username) || '@' || LOWER(p_org_slug) || '.local';

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_accounts') THEN
    -- Compatible with the existing user_accounts schema. password_hash via bcrypt.
    INSERT INTO user_accounts (username, email, full_name, role, is_active, organization_id)
    VALUES (
      LOWER(p_admin_username),
      v_email,
      COALESCE(p_admin_full_name, p_admin_username),
      'admin',
      TRUE,
      v_org_id
    )
    RETURNING id INTO v_account_id;
  END IF;

  -- 3) virtual_accounts (used by virtual_login RPC) — bcrypt password
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='virtual_accounts') THEN
    INSERT INTO virtual_accounts (name, password_hash, role, is_active, organization_id)
    VALUES (
      LOWER(p_admin_username),
      crypt(p_admin_password, gen_salt('bf', 12)),
      'admin',
      TRUE,
      v_org_id
    )
    ON CONFLICT (name) DO UPDATE
      SET password_hash = EXCLUDED.password_hash,
          organization_id = EXCLUDED.organization_id,
          is_active = TRUE;
  END IF;

  -- 4) Membership
  INSERT INTO organization_members (organization_id, user_account_id, username, role, is_active)
  VALUES (v_org_id, v_account_id, LOWER(p_admin_username), 'admin', TRUE)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'success',         TRUE,
    'organization_id', v_org_id,
    'admin_username',  LOWER(p_admin_username)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.superadmin_create_organization(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO PUBLIC;

-- ---------------------------------------------------------------------------
-- superadmin_toggle_organization
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.superadmin_toggle_organization(
  p_username TEXT,
  p_password TEXT,
  p_org_id   UUID,
  p_active   BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._assert_super_admin(p_username, p_password);

  IF (SELECT is_default FROM organizations WHERE id = p_org_id) AND p_active = FALSE THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'cannot_disable_default');
  END IF;

  UPDATE organizations SET is_active = p_active, updated_at = NOW() WHERE id = p_org_id;
  RETURN jsonb_build_object('success', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.superadmin_toggle_organization(TEXT,TEXT,UUID,BOOLEAN) TO PUBLIC;

-- ---------------------------------------------------------------------------
-- superadmin_delete_organization (soft delete = is_active=false)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.superadmin_delete_organization(
  p_username TEXT,
  p_password TEXT,
  p_org_id   UUID,
  p_hard     BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._assert_super_admin(p_username, p_password);

  IF (SELECT is_default FROM organizations WHERE id = p_org_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'cannot_delete_default');
  END IF;

  IF p_hard THEN
    DELETE FROM organizations WHERE id = p_org_id;
  ELSE
    UPDATE organizations SET is_active = FALSE, updated_at = NOW() WHERE id = p_org_id;
  END IF;

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.superadmin_delete_organization(TEXT,TEXT,UUID,BOOLEAN) TO PUBLIC;

-- ---------------------------------------------------------------------------
-- resolve_organization_for_user(username)
-- Used by the front after login to fetch the user's organization_id.
-- Public read is fine: it only reveals which org a username belongs to.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_organization_for_user(p_username TEXT)
RETURNS TABLE (organization_id UUID, organization_name TEXT, role TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.organization_id, o.name, m.role
  FROM organization_members m
  JOIN organizations o ON o.id = m.organization_id
  WHERE LOWER(m.username) = LOWER(p_username) AND m.is_active = TRUE AND o.is_active = TRUE
  ORDER BY m.created_at ASC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_organization_for_user(TEXT) TO PUBLIC;
