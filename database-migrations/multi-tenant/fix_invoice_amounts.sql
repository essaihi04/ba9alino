-- Fix corrupted invoice INV-1779098450695
-- Show current state
SELECT invoice_number, total_amount, paid_amount, remaining_amount, payment_status
FROM invoices WHERE invoice_number = 'INV-1779098450695';

-- Show accumulated payments
SELECT id, amount, status, payment_date, created_at
FROM payments WHERE invoice_id = (
  SELECT id FROM invoices WHERE invoice_number = 'INV-1779098450695'
);

-- Fix: recalculate paid_amount from SUM of completed payments
UPDATE invoices inv
SET
  paid_amount = COALESCE(pay_sum.total, 0),
  remaining_amount = GREATEST(0, inv.total_amount - COALESCE(pay_sum.total, 0)),
  payment_status = CASE
    WHEN COALESCE(pay_sum.total, 0) >= inv.total_amount THEN 'paid'
    WHEN COALESCE(pay_sum.total, 0) > 0 THEN 'partial'
    ELSE 'credit'
  END
FROM (
  SELECT invoice_id, SUM(amount) AS total
  FROM payments
  WHERE status = 'completed'
    AND invoice_id = (SELECT id FROM invoices WHERE invoice_number = 'INV-1779098450695')
  GROUP BY invoice_id
) pay_sum
WHERE inv.id = pay_sum.invoice_id;

-- Also remove duplicate payment records (keep only the latest per day if same amount)
-- Show result after fix
SELECT invoice_number, total_amount, paid_amount, remaining_amount, payment_status
FROM invoices WHERE invoice_number = 'INV-1779098450695';
