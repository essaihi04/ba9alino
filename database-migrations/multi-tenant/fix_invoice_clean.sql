-- Check actual invoice items to know the real total
SELECT i.invoice_number, i.total_amount, i.status,
       jsonb_array_length(COALESCE(i.items, '[]'::jsonb)) AS items_count
FROM invoices i WHERE i.invoice_number = 'INV-1779098450695';

-- Delete ALL accumulated fake payments for this invoice
DELETE FROM payments
WHERE invoice_id = (SELECT id FROM invoices WHERE invoice_number = 'INV-1779098450695');

-- Reset invoice to clean state (user said it should be paid)
UPDATE invoices
SET
  paid_amount = total_amount,
  remaining_amount = 0,
  status = 'paid'
WHERE invoice_number = 'INV-1779098450695';

-- Insert 1 correct payment record
INSERT INTO payments (invoice_id, payment_number, client_id, amount, payment_method, payment_date, status, organization_id)
SELECT
  id,
  'PAY-FIX-' || EXTRACT(EPOCH FROM NOW())::BIGINT,
  client_id,
  total_amount,
  COALESCE(payment_method, 'cash'),
  CURRENT_DATE,
  'completed',
  organization_id
FROM invoices WHERE invoice_number = 'INV-1779098450695';

-- Verify
SELECT invoice_number, total_amount, paid_amount, remaining_amount, status FROM invoices
WHERE invoice_number = 'INV-1779098450695';

SELECT amount, status FROM payments
WHERE invoice_id = (SELECT id FROM invoices WHERE invoice_number = 'INV-1779098450695');
