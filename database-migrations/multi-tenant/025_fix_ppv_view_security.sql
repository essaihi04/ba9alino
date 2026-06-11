-- Fix product_primary_variants view to respect RLS of underlying product_variants table
-- PostgreSQL 15+ supports WITH (security_invoker = true)

-- Check PG version
SELECT version();

-- Recreate the view with security_invoker so RLS on product_variants is enforced
CREATE OR REPLACE VIEW public.product_primary_variants
WITH (security_invoker = true)
AS
  SELECT id,
     product_id,
     variant_name,
     barcode,
     price_a,
     price_b,
     price_c,
     price_d,
     price_e,
     is_active,
     is_default,
     purchase_price,
     stock,
     unit_type,
     quantity_contained,
     alert_threshold,
     created_at,
     updated_at
    FROM product_variants;

-- Grant access
GRANT SELECT ON public.product_primary_variants TO ba9alino_anon;

NOTIFY pgrst, 'reload schema';
