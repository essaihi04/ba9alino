-- Migration: Add warehouse_id to stock table for multi-warehouse support
-- Run this in your Supabase SQL editor

DO $$
BEGIN
  -- Add warehouse_id column to stock table if it doesn't exist
  ALTER TABLE public.stock 
  ADD COLUMN IF NOT EXISTS warehouse_id TEXT;
  
  -- Create foreign key constraint if warehouses table exists
  -- This will fail silently if warehouses table doesn't exist yet
  BEGIN
    ALTER TABLE public.stock 
    ADD CONSTRAINT fk_stock_warehouse 
    FOREIGN KEY (warehouse_id) 
    REFERENCES public.warehouses(id);
  EXCEPTION
    WHEN OTHERS THEN
      NULL; -- Ignore if constraint already exists or warehouses table doesn't exist
  END;
  
  -- Create index for performance
  CREATE INDEX IF NOT EXISTS idx_stock_warehouse_product 
  ON public.stock(warehouse_id, product_id);
  
  -- If warehouse_id is NULL, set it to first active warehouse (if any)
  UPDATE public.stock 
  SET warehouse_id = (
    SELECT id FROM public.warehouses 
    WHERE is_active = true 
    ORDER BY name 
    LIMIT 1
  )
  WHERE warehouse_id IS NULL
  AND EXISTS (SELECT 1 FROM public.warehouses WHERE is_active = true);
END $$;
