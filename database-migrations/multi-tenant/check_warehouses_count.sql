-- How many warehouses?
SELECT id, name, is_active FROM warehouses;

-- How many warehouse_stock per product (any product with multiple warehouses)?
SELECT product_id, COUNT(*) AS n_warehouses, SUM(quantity) AS total_q
FROM warehouse_stock
GROUP BY product_id
HAVING COUNT(*) > 1
LIMIT 5;
