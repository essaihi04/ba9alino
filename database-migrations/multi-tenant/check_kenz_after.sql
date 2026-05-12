SELECT name_ar, stock AS products_stock,
  (SELECT quantity_in_stock FROM stock WHERE product_id = p.id LIMIT 1) AS stock_table
FROM products p WHERE id = '72947015-f28b-4eb9-8f0f-766d6cb976e7';
