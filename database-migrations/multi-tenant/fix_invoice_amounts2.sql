-- Check invoices columns
SELECT column_name FROM information_schema.columns
WHERE table_name = 'invoices'
AND column_name IN ('status', 'payment_status', 'paid_amount', 'remaining_amount')
ORDER BY column_name;

-- Show corrupted invoice
SELECT invoice_number, total_amount, paid_amount, remaining_amount, status
FROM invoices WHERE invoice_number = 'INV-1779098450695';

-- Fix: set paid_amount = sum of completed payments, remaining = total - paid
UPDATE invoices inv
SET
  paid_amount = COALESCE(pay_sum.total, 0),
  remaining_amount = GREATEST(0, inv.total_amount - COALESCE(pay_sum.total, 0))
FROM (
  SELECT invoice_id, SUM(amount) AS total
  FROM payments
  WHERE status = 'completed'
    AND invoice_id = (SELECT id FROM invoices WHERE invoice_number = 'INV-1779098450695')
  GROUP BY invoice_id
) pay_sum
WHERE inv.id = pay_sum.invoice_id;

-- Show result
SELECT invoice_number, total_amount, paid_amount, remaining_amount, status
FROM invoices WHERE invoice_number = 'INV-1779098450695';

-- Also delete duplicate accumulated payments: keep only the FIRST payment for each amount on same day
-- First show duplicates
SELECT amount, payment_date, COUNT(*) as cnt
FROM payments
WHERE invoice_id = (SELECT id FROM invoices WHERE invoice_number = 'INV-1779098450695')
GROUP BY amount, payment_date
HAVING COUNT(*) > 1;
