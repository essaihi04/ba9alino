-- All organizations
SELECT id, name, slug, is_active, created_at FROM organizations ORDER BY created_at;

-- Members per organization
SELECT 
  o.name AS org,
  o.id AS org_id,
  COUNT(DISTINCT va.id) AS virtual_members,
  COUNT(DISTINCT ua.id) AS user_account_members,
  (SELECT COUNT(*) FROM products p WHERE p.organization_id = o.id) AS products,
  (SELECT COUNT(*) FROM invoices i WHERE i.organization_id = o.id) AS invoices
FROM organizations o
LEFT JOIN virtual_accounts va ON va.organization_id = o.id
LEFT JOIN user_accounts ua ON ua.organization_id = o.id
GROUP BY o.id, o.name
ORDER BY o.created_at;

-- The Ba9alino org id we used
SELECT name, id FROM organizations WHERE id = '6db5963e-4412-4b07-bab5-80eb33bd1d7f';
