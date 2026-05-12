-- Recent invoices: check org_id is being set
SELECT id, invoice_number, organization_id, created_at, total_amount
FROM invoices
ORDER BY created_at DESC
LIMIT 10;

-- Check if invoices table has the auto-org trigger
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'invoices';

-- Check RLS policies on invoices
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'invoices';

-- Check GRANTs on invoices for ba9alino_anon
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'invoices' AND grantee = 'ba9alino_anon';

-- Same for invoice_items
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'invoice_items' AND grantee = 'ba9alino_anon';
