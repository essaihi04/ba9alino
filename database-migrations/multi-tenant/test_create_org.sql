-- Test superadmin_create_organization
SELECT public.superadmin_create_organization(
  'zouhair','1989Gr@04',
  'TestShop2','testshop2',
  'testadmin2','admin123',
  'Test Admin 2',NULL,NULL
);

-- Test virtual_login returns organization_id
SELECT id, role, name, employee_id, organization_id
FROM public.virtual_login('testadmin2','admin123');

-- Verify organization was created
SELECT id, name, slug, is_active FROM organizations WHERE slug = 'testshop2';

-- Verify organization_members
SELECT organization_id, username, role FROM organization_members WHERE username = 'testadmin2';

-- Verify virtual_accounts has organization_id set
SELECT name, role, organization_id FROM virtual_accounts WHERE name = 'testadmin2';
