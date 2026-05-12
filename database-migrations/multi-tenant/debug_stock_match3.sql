-- Recent invoices and how many items they have
SELECT i.invoice_number, i.created_at, COUNT(ii.id) AS items_count, i.total_amount
FROM invoices i
LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
WHERE i.created_at > NOW() - INTERVAL '4 hours'
GROUP BY i.id, i.invoice_number, i.created_at, i.total_amount
ORDER BY i.created_at DESC
LIMIT 15;

-- Total invoice_items count
SELECT COUNT(*) AS total_invoice_items FROM invoice_items;
SELECT COUNT(*) AS recent_items FROM invoice_items ii
JOIN invoices i ON i.id = ii.invoice_id
WHERE i.created_at > NOW() - INTERVAL '4 hours';
