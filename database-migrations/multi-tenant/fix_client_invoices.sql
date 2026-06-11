-- 1. Verify client_id 8137dce2 exists in clients
SELECT id, company_name_ar FROM clients WHERE id = '8137dce2-25e2-46f2-b14c-1b2f19cedb5b';

-- 2. Fix INV-1779100327549: set correct client_id to real trrr + fix paid_amount from payments
UPDATE invoices
SET
  client_id = '1c82fb7c-7f75-48a2-9b78-5431010296c9',
  paid_amount = COALESCE((
    SELECT SUM(amount) FROM payments
    WHERE invoice_id = invoices.id AND status = 'completed'
  ), 0),
  remaining_amount = GREATEST(0, total_amount - COALESCE((
    SELECT SUM(amount) FROM payments
    WHERE invoice_id = invoices.id AND status = 'completed'
  ), 0)),
  status = CASE
    WHEN COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = invoices.id AND status='completed'), 0) >= total_amount THEN 'paid'
    WHEN COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = invoices.id AND status='completed'), 0) > 0 THEN 'partial'
    ELSE 'draft'
  END
WHERE invoice_number = 'INV-1779100327549';

-- 3. Fix FAC-ORD: set paid_amount = total_amount (it's already marked paid)
UPDATE invoices
SET
  paid_amount = total_amount,
  remaining_amount = 0
WHERE invoice_number = 'FAC-ORD-1769727242249781'
  AND (paid_amount IS NULL OR paid_amount = 0);

-- Verify
SELECT invoice_number, client_id, total_amount, paid_amount, remaining_amount, status
FROM invoices
WHERE invoice_number IN ('FAC-ORD-1769727242249781', 'INV-1779100327549');
