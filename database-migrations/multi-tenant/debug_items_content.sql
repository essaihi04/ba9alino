-- Show items + matching stock for most recent invoice
WITH r AS (
  SELECT i.invoice_number, i.created_at, jsonb_array_elements(items) AS line
  FROM invoices i
  WHERE items IS NOT NULL AND jsonb_array_length(items) > 0
  ORDER BY created_at DESC
  LIMIT 5
)
SELECT 
  r.invoice_number,
  r.line->>'product_id' AS pid,
  r.line->>'primary_variant_id' AS pvid,
  r.line->>'quantity' AS qty,
  r.line->>'unit_type' AS unit,
  s.id AS stock_id,
  s.quantity_in_stock,
  s.primary_variant_id AS s_pvid
FROM r
LEFT JOIN stock s ON s.product_id::text = r.line->>'product_id'
  AND (
    (r.line->>'primary_variant_id' IS NULL AND s.primary_variant_id IS NULL)
    OR s.primary_variant_id::text = r.line->>'primary_variant_id'
  );
