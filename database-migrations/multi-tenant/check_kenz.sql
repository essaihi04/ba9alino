-- Find the product
SELECT id, name_ar, stock AS legacy_stock FROM products WHERE name_ar LIKE '%كنز%';

-- Find its stock rows
SELECT s.id, s.product_id, p.name_ar, s.primary_variant_id, s.quantity_in_stock, s.updated_at
FROM stock s
JOIN products p ON p.id = s.product_id
WHERE p.name_ar LIKE '%كنز%';

-- Most recent invoice (any product)
SELECT invoice_number, created_at, jsonb_array_length(COALESCE(items,'[]'::jsonb)) AS n_items
FROM invoices
ORDER BY created_at DESC
LIMIT 3;
