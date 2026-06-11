-- All employees in Ba9alino org
SELECT e.id, e.name, e.role, e.is_active,
  va.name AS va_name, va.is_active AS va_active,
  va.password_hash IS NOT NULL AS va_has_hash,
  va.organization_id AS va_org_id
FROM employees e
LEFT JOIN virtual_accounts va ON va.employee_id = e.id
WHERE e.organization_id = '6db5963e-4412-4b07-bab5-80eb33bd1d7f'
ORDER BY e.role, e.name;

-- Virtual accounts with no org
SELECT id, name, role, is_active, employee_id, organization_id FROM virtual_accounts
WHERE organization_id IS NULL;
