-- Lance chaque requête séparément dans Supabase SQL Editor
-- Copie le résultat de chaque table dans un fichier séparé : table_products.json, table_clients.json, etc.

-- 1. warehouses
SELECT json_agg(row_to_json(t)) AS data FROM warehouses t;

-- 2. employees
SELECT json_agg(row_to_json(t)) AS data FROM employees t;

-- 3. user_accounts
SELECT json_agg(row_to_json(t)) AS data FROM user_accounts t;

-- 4. clients
SELECT json_agg(row_to_json(t)) AS data FROM clients t;

-- 5. products
SELECT json_agg(row_to_json(t)) AS data FROM products t;

-- 6. product_variants
SELECT json_agg(row_to_json(t)) AS data FROM product_variants t;

-- 7. stock
SELECT json_agg(row_to_json(t)) AS data FROM stock t;

-- 8. suppliers
SELECT json_agg(row_to_json(t)) AS data FROM suppliers t;

-- 9. cash_sessions
SELECT json_agg(row_to_json(t)) AS data FROM cash_sessions t;

-- 10. orders
SELECT json_agg(row_to_json(t)) AS data FROM orders t;

-- 11. invoices
SELECT json_agg(row_to_json(t)) AS data FROM invoices t;

-- 12. payments
SELECT json_agg(row_to_json(t)) AS data FROM payments t;

-- 13. purchases
SELECT json_agg(row_to_json(t)) AS data FROM purchases t;

-- 14. expenses
SELECT json_agg(row_to_json(t)) AS data FROM expenses t;

-- 15. visits
SELECT json_agg(row_to_json(t)) AS data FROM visits t;

-- 16. coupons
SELECT json_agg(row_to_json(t)) AS data FROM coupons t;

-- 17. coupon_usage
SELECT json_agg(row_to_json(t)) AS data FROM coupon_usage t;
