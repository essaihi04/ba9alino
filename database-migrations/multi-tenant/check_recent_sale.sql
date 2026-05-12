SELECT 
  i.invoice_number,
  i.created_at,
  line->>'product_id' AS pid,
  line->>'product_name' AS pname,
  line->>'quantity' AS qty,
  line->>'primary_variant_id' AS pvid,
  line->>'unit_type' AS unit
FROM invoices i, jsonb_array_elements(items) AS line
WHERE i.invoice_number = 'INV-20260512-124353-776';
