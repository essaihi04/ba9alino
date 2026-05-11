-- ============================================================================
-- 011 — Fix superadmin_create_organization + data isolation
--
-- Changes:
--   1. superadmin_create_organization: wrap user_accounts insert in EXCEPTION
--      block so any constraint error doesn't bubble as a 400; also skip
--      password_hash check on user_accounts (not required — virtual_accounts
--      is the auth source).
--   2. virtual_login: return organization_id column from virtual_accounts so
--      the auth service can embed it in the JWT.
--   3. current_org_id(): also read organization_id directly from JWT claims
--      (before falling back to sub lookup) so PostgREST RLS works immediately
--      once the auth service embeds the claim.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Fix superadmin_create_organization
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

  -- 2) user_accounts row (best-effort — wrapped so unique/check violations don't abort)
  BEGIN
    v_email := LOWER(p_admin_username) || '@' || LOWER(p_org_slug) || '.local';

    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'user_accounts'
    ) THEN
      INSERT INTO user_accounts (username, email, full_name, role, is_active, organization_id)
      VALUES (
        LOWER(p_admin_username),
        v_email,
        COALESCE(p_admin_full_name, p_admin_username),
        'admin',
        TRUE,
        v_org_id
      )
      ON CONFLICT DO NOTHING
      RETURNING id INTO v_account_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- user_accounts insert failed (e.g. unique violation on username/email).
    -- Not fatal — virtual_accounts is the real auth source.
    v_account_id := NULL;
  END;

  -- 3) virtual_accounts (the actual auth entry, bcrypt password)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'virtual_accounts'
  ) THEN
    INSERT INTO virtual_accounts (name, password_hash, role, is_active, organization_id)
    VALUES (
      LOWER(p_admin_username),
      crypt(p_admin_password, gen_salt('bf', 12)),
      'admin',
      TRUE,
      v_org_id
    )
    ON CONFLICT (name) DO UPDATE
      SET password_hash   = EXCLUDED.password_hash,
          organization_id = EXCLUDED.organization_id,
          is_active       = TRUE;
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
EXCEPTION WHEN OTHERS THEN
  -- Top-level catch: return the real error instead of letting PostgREST 400.
  RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.superadmin_create_organization(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO PUBLIC;

-- ---------------------------------------------------------------------------
-- 2. virtual_login — add organization_id to return columns
-- (DROP + CREATE because return type changes; REPLACE alone would fail)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.virtual_login(TEXT, TEXT);
CREATE FUNCTION public.virtual_login(p_name TEXT, p_password TEXT)
RETURNS TABLE(id UUID, role TEXT, name TEXT, employee_id UUID, organization_id UUID)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    va.employee_id   AS id,
    va.role,
    va.name,
    va.employee_id,
    va.organization_id
  FROM public.virtual_accounts va
  WHERE va.name = LOWER(TRIM(p_name))
    AND va.is_active = TRUE
    AND va.password_hash = crypt(p_password, va.password_hash);
END;
$$;

GRANT EXECUTE ON FUNCTION public.virtual_login(TEXT, TEXT) TO ba9alino_anon, PUBLIC;

-- ---------------------------------------------------------------------------
-- 3. current_org_id() — read organization_id directly from JWT claims first
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org      UUID;
  v_setting  TEXT;
  v_claims   JSONB;
  v_sub      TEXT;
BEGIN
  -- 1) Explicit session GUC set by frontend (highest priority)
  BEGIN
    v_setting := current_setting('app.organization_id', TRUE);
    IF v_setting IS NOT NULL AND v_setting <> '' THEN
      RETURN v_setting::UUID;
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 2) JWT claims from PostgREST
  BEGIN
    v_setting := current_setting('request.jwt.claims', TRUE);
    IF v_setting IS NOT NULL AND v_setting <> '' THEN
      v_claims := v_setting::JSONB;

      -- 2a) Direct organization_id claim (set by auth service)
      IF v_claims->>'organization_id' IS NOT NULL AND v_claims->>'organization_id' <> '' THEN
        RETURN (v_claims->>'organization_id')::UUID;
      END IF;

      -- 2b) Fallback: lookup via sub -> organization_members
      v_sub := v_claims->>'sub';
      IF v_sub IS NOT NULL AND v_sub <> '' THEN
        SELECT om.organization_id INTO v_org
          FROM organization_members om
         WHERE (om.user_id::TEXT = v_sub OR om.user_account_id::TEXT = v_sub)
           AND om.is_active = TRUE
         ORDER BY om.created_at ASC
         LIMIT 1;
        IF v_org IS NOT NULL THEN RETURN v_org; END IF;

        -- 2c) Fallback: lookup via virtual_accounts.id = sub
        SELECT va.organization_id INTO v_org
          FROM virtual_accounts va
         WHERE va.id::TEXT = v_sub
            OR va.employee_id::TEXT = v_sub
         LIMIT 1;
        IF v_org IS NOT NULL THEN RETURN v_org; END IF;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_org_id() TO PUBLIC;
