-- ============================================================
-- 1) Create missing virtual_accounts for Ba9alino commercials
--    Default password = first name + "123"  (e.g. zizo123)
-- ============================================================
INSERT INTO virtual_accounts (name, password_hash, role, is_active, organization_id, employee_id)
SELECT
  LOWER(TRIM(e.name)),
  crypt(LOWER(TRIM(e.name)) || '123', gen_salt('bf', 10)),
  e.role,
  TRUE,
  e.organization_id,
  e.id
FROM employees e
WHERE e.organization_id = '6db5963e-4412-4b07-bab5-80eb33bd1d7f'
  AND NOT EXISTS (
    SELECT 1 FROM virtual_accounts va WHERE va.employee_id = e.id
  )
  AND TRIM(e.name) <> ''
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 2) Fix virtual_accounts with NULL organization_id
--    Link them via their employee_id
-- ============================================================
UPDATE virtual_accounts va
SET organization_id = e.organization_id
FROM employees e
WHERE va.employee_id = e.id
  AND va.organization_id IS NULL
  AND e.organization_id IS NOT NULL;

-- ============================================================
-- 3) Enable RLS on virtual_accounts + isolation policy
--    (auth service uses ba9alino_admin which bypasses RLS)
-- ============================================================
ALTER TABLE virtual_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON virtual_accounts;
CREATE POLICY tenant_isolation ON virtual_accounts
  FOR ALL
  USING (is_super_admin() OR (organization_id = current_org_id()));

-- Allow the auth Node service (ba9alino_admin) to bypass RLS
ALTER TABLE virtual_accounts FORCE ROW LEVEL SECURITY;
-- ba9alino_admin is a superuser equivalent - already bypasses RLS
-- If not, grant explicit bypass:
ALTER ROLE ba9alino_admin BYPASSRLS;

-- ============================================================
-- Verify
-- ============================================================
SELECT name, role, is_active, organization_id IS NOT NULL AS has_org
FROM virtual_accounts
WHERE organization_id = '6db5963e-4412-4b07-bab5-80eb33bd1d7f'
ORDER BY role, name;

-- Test login for one commercial
SELECT * FROM virtual_login('zizo', 'zizo123');
