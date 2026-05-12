SELECT invoice_number, created_at, items IS NOT NULL AS has_items, jsonb_array_length(COALESCE(items, '[]'::jsonb)) AS items_count
FROM invoices
ORDER BY created_at DESC
LIMIT 5;
