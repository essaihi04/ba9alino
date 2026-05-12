-- Add missing columns to order_items
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS line_total NUMERIC,
  ADD COLUMN IF NOT EXISTS product_name_ar TEXT,
  ADD COLUMN IF NOT EXISTS product_sku TEXT;

-- Backfill line_total from total_price
UPDATE public.order_items SET line_total = total_price WHERE line_total IS NULL;

-- Backfill product_name_ar and product_sku from products table
UPDATE public.order_items oi
SET 
  product_name_ar = p.name_ar,
  product_sku = p.sku
FROM public.products p
WHERE oi.product_id = p.id
  AND (oi.product_name_ar IS NULL OR oi.product_sku IS NULL);

-- Trigger to keep line_total in sync with total_price on INSERT/UPDATE
CREATE OR REPLACE FUNCTION sync_order_item_line_total()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.line_total IS NULL THEN
    NEW.line_total := NEW.total_price;
  END IF;
  IF NEW.total_price IS NULL AND NEW.line_total IS NOT NULL THEN
    NEW.total_price := NEW.line_total;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_order_item_line_total ON public.order_items;
CREATE TRIGGER trg_sync_order_item_line_total
  BEFORE INSERT OR UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION sync_order_item_line_total();

-- Verify
SELECT COUNT(*) as total, 
       COUNT(line_total) as with_line_total,
       COUNT(product_name_ar) as with_product_name
FROM public.order_items;
