-- Look at the JSON items column of a recent invoice
SELECT invoice_number, jsonb_pretty(items::jsonb) AS items_json
FROM invoices
WHERE created_at > NOW() - INTERVAL '4 hours'
  AND items IS NOT NULL
ORDER BY created_at DESC
LIMIT 1;

-- For each line in last 5 invoices, extract product_id, primary_variant_id, qty, and check stock
WITH recent AS (
  SELECT i.id, i.invoice_number, jsonb_array_elements(i.items::jsonb) AS line
  FROM invoices i
  WHERE i.created_at > NOW() - INTERVAL '4 hours'
  ORDER BY i.created_at DESC LIMIT 20
)
SELECT 
  r.invoice_number,
  r.line->>'product_id' AS product_id,
  r.line->>'primary_variant_id' AS primary_variant_id,
  r.line->>'quantity' AS qty,
  r.line->>'unit_type' AS unit_type,
  s.id AS stock_id,
  s.quantity_in_stock,
  s.primary_variant_id AS stock_pv
FROM recent r
LEFT JOIN stock s ON s.product_id::text = r.line->>'product_id'
ORDER BY r.invoice_number;
