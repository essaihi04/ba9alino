-- ============================================================================
-- 006 — RLS helper functions
-- ============================================================================
--
-- Ba9alino uses a custom auth service (NOT Supabase GoTrue). PostgREST passes
-- the JWT claims via the `request.jwt.claims` GUC (JSON). We read the user's
-- `sub` from there, and look up its organization via organization_members.
--
-- The frontend can also explicitly set `app.organization_id` as a session GUC
-- via the helper RPC `set_app_organization_id(uuid)` (see below) when needed.
-- ============================================================================

-- Returns the organization_id of the current user (NULL if not authenticated).
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
  v_setting TEXT;
  v_claims JSONB;
  v_sub TEXT;
BEGIN
  -- 1) Explicit session GUC set by frontend (preferred)
  BEGIN
    v_setting := current_setting('app.organization_id', TRUE);
    IF v_setting IS NOT NULL AND v_setting <> '' THEN
      RETURN v_setting::UUID;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- 2) Lookup via PostgREST JWT claims → sub → organization_members
  BEGIN
    v_setting := current_setting('request.jwt.claims', TRUE);
    IF v_setting IS NOT NULL AND v_setting <> '' THEN
      v_claims := v_setting::JSONB;
      v_sub := v_claims->>'sub';
      IF v_sub IS NOT NULL AND v_sub <> '' THEN
        SELECT organization_id INTO v_org
          FROM organization_members
         WHERE (user_id::TEXT = v_sub OR user_account_id::TEXT = v_sub)
           AND is_active = TRUE
         ORDER BY created_at ASC
         LIMIT 1;
        IF v_org IS NOT NULL THEN RETURN v_org; END IF;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_org_id() TO PUBLIC;

-- Helper RPC for the frontend to set the org context for the current
-- request/transaction. Call this BEFORE other queries when RLS is enabled.
CREATE OR REPLACE FUNCTION public.set_app_organization_id(p_org_id UUID)
RETURNS VOID
LANGUAGE sql
AS $$
  SELECT set_config('app.organization_id', p_org_id::TEXT, FALSE);
$$;

GRANT EXECUTE ON FUNCTION public.set_app_organization_id(UUID) TO PUBLIC;

-- ---------------------------------------------------------------------------
-- is_super_admin: returns TRUE if a session GUC marks the request as
-- coming from a SuperAdmin (set after superadmin_login RPC succeeded).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_setting TEXT;
BEGIN
  BEGIN
    v_setting := current_setting('app.is_super_admin', TRUE);
    IF v_setting = 'true' THEN RETURN TRUE; END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
  END;
  RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO PUBLIC;

-- ---------------------------------------------------------------------------
-- is_org_member(org_id): is the current user a member of this org?
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_org_id() = p_org_id;
$$;

GRANT EXECUTE ON FUNCTION public.is_org_member(UUID) TO PUBLIC;
