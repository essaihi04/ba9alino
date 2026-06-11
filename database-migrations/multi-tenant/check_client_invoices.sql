-- Check client trrr and their invoices
SELECT id, company_name_ar FROM clients WHERE company_name_ar ILIKE '%trrr%' OR company_name_ar ILIKE '%test%';

-- Check both invoices
SELECT invoice_number, client_id, client_name, total_amount, paid_amount, remaining_amount, status
FROM invoices
WHERE invoice_number IN ('FAC-ORD-1769727242249781', 'INV-1779100327549');

-- Check items structure of FAC-ORD invoice (what fields are stored)
SELECT invoice_number,
       jsonb_array_elements(COALESCE(items, '[]'::jsonb)) -> 0 AS first_item_fields,
       jsonb_array_elements(COALESCE(items, '[]'::jsonb)) AS item
FROM invoices
WHERE invoice_number = 'FAC-ORD-1769727242249781'
LIMIT 3;

-- Check items field names used in POS invoices
SELECT invoice_number, items->0 AS first_item
FROM invoices
WHERE invoice_number IN ('FAC-ORD-1769727242249781', 'INV-1779100327549');
