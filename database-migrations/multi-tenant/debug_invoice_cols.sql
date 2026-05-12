-- All columns of invoices
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'invoices' ORDER BY ordinal_position;

-- Recent invoice raw
SELECT invoice_number, items IS NULL AS items_null, items::text AS items_raw
FROM invoices
WHERE created_at > NOW() - INTERVAL '4 hours'
ORDER BY created_at DESC LIMIT 2;
