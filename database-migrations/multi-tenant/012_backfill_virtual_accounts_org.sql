-- ============================================================================
-- 012 — Backfill virtual_accounts.organization_id + add legacy admin account
--
-- After RLS is enabled, every login must include organization_id in the JWT.
-- virtual_login() now returns organization_id, so the auth service can embed
-- it. But existing virtual_accounts rows from the Ba9alino era have NULL
-- organization_id. This script backfills them with the default org.
--
-- It also upserts the legacy hardcoded 'admin' user into virtual_accounts
-- so that supabase.auth.signInWithPassword('admin@local', 'admin123') works
-- through the auth service and returns a JWT with organization_id.
-- ============================================================================

-- Backfill all NULL organization_id in virtual_accounts with the default org
UPDATE virtual_accounts
SET organization_id = (
  SELECT id FROM organizations WHERE is_default = TRUE LIMIT 1
)
WHERE organization_id IS NULL;

-- Backfill all NULL organization_id in user_accounts with the default org
UPDATE user_accounts
SET organization_id = (
  SELECT id FROM organizations WHERE is_default = TRUE LIMIT 1
)
WHERE organization_id IS NULL;

-- Upsert the legacy 'admin' virtual account linked to the default Ba9alino org
INSERT INTO virtual_accounts (name, password_hash, role, is_active, organization_id)
SELECT
  'admin',
  crypt('admin123', gen_salt('bf', 10)),
  'admin',
  TRUE,
  (SELECT id FROM organizations WHERE is_default = TRUE LIMIT 1)
ON CONFLICT (name) DO UPDATE
  SET organization_id = EXCLUDED.organization_id,
      is_active       = TRUE;

-- Fix virtual_login: return COALESCE(employee_id, id) so JWT sub is never NULL
-- for accounts not linked to an employee (e.g. the admin account).
DROP FUNCTION IF EXISTS public.virtual_login(TEXT, TEXT);
CREATE FUNCTION public.virtual_login(p_name TEXT, p_password TEXT)
RETURNS TABLE(id UUID, role TEXT, name TEXT, employee_id UUID, organization_id UUID)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(va.employee_id, va.id) AS id,
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

-- Verify
SELECT
  COUNT(*) FILTER (WHERE organization_id IS NULL) AS null_org_count,
  COUNT(*)                                        AS total
FROM virtual_accounts;
