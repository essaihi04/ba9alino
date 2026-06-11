-- Link admin virtual account to the default Ba9alino organization
UPDATE virtual_accounts
SET organization_id = '6db5963e-4412-4b07-bab5-80eb33bd1d7f'
WHERE name = 'admin';

-- Verify
SELECT id, name, role, organization_id FROM virtual_accounts WHERE name = 'admin';

-- Confirm products count for that org
SELECT COUNT(*) AS products_in_org FROM products WHERE organization_id = '6db5963e-4412-4b07-bab5-80eb33bd1d7f';
