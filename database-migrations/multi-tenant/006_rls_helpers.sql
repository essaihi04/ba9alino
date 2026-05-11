-- ============================================================================
-- 006 — RLS helper functions
-- ============================================================================

-- Returns the organization_id of the current user, looked up via
-- organization_members. Falls back to NULL when no membership.
-- IMPORTANT: this relies on auth.uid() (Supabase JWT). For our custom
-- 'virtual_login' / 'user_accounts_login' flows that don't go through GoTrue,
-- we'll set a per-request session GUC `app.organization_id` from the front,
-- and read it here as a secondary source.
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
BEGIN
  -- 1) Explicit session GUC (set by the frontend via SET LOCAL or by a wrapper RPC)
  BEGIN
    v_setting := current_setting('app.organization_id', TRUE);
    IF v_setting IS NOT NULL AND v_setting <> '' THEN
      RETURN v_setting::UUID;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- ignore
  END;

  -- 2) Lookup via Supabase auth user
  IF auth.uid() IS NOT NULL THEN
    SELECT organization_id INTO v_org
    FROM organization_members
    WHERE user_id = auth.uid() AND is_active = TRUE
    ORDER BY created_at ASC
    LIMIT 1;
    IF v_org IS NOT NULL THEN RETURN v_org; END IF;
  END IF;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated, anon;

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

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, anon;

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

GRANT EXECUTE ON FUNCTION public.is_org_member(UUID) TO authenticated, anon;
