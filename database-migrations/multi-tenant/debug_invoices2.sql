SELECT invoice_number, created_at, client_id, organization_id
FROM invoices
ORDER BY id DESC
LIMIT 5;

-- Check schema of invoices.created_at
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'invoices' AND column_name IN ('created_at', 'date', 'invoice_date');

-- Check if recent invoices have client (might be filtered out by RLS join with clients)
SELECT i.invoice_number, i.client_id, c.id AS client_found, c.organization_id AS client_org
FROM invoices i
LEFT JOIN clients c ON c.id = i.client_id
ORDER BY i.id DESC
LIMIT 5;

-- Check RLS on clients
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'clients';
