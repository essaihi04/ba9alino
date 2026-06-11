-- Employees in Ba9alino + virtual_account status
SELECT e.id, e.name, e.role,
  va.name AS va_name,
  va.is_active AS va_active,
  va.password_hash IS NOT NULL AS va_has_hash,
  va.organization_id AS va_org_id
FROM employees e
LEFT JOIN virtual_accounts va ON va.employee_id = e.id
WHERE e.organization_id = '6db5963e-4412-4b07-bab5-80eb33bd1d7f'
ORDER BY e.role, e.name;
