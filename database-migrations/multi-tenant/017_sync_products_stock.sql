-- Sync products.stock (legacy column read by StockPage) with stock.quantity_in_stock
-- This corrects the drift caused by past sales updating only stock.quantity_in_stock.

UPDATE public.products p
SET stock = sub.total
FROM (
  SELECT product_id, SUM(quantity_in_stock)::numeric AS total
  FROM public.stock
  GROUP BY product_id
) sub
WHERE sub.product_id = p.id
  AND COALESCE(p.stock, 0) <> sub.total;

-- Sanity: count of products and matching stock
SELECT COUNT(*) AS products_total FROM products;
SELECT COUNT(*) AS products_with_stock_row FROM products p WHERE EXISTS (SELECT 1 FROM stock s WHERE s.product_id = p.id);
