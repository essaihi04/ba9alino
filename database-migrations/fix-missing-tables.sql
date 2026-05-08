-- View product_primary_variants (alias of product_variants)
CREATE OR REPLACE VIEW public.product_primary_variants AS
SELECT id, product_id, variant_name, barcode,
       price_a, price_b, price_c, price_d, price_e,
       is_active, is_default, purchase_price, stock,
       unit_type, quantity_contained, alert_threshold,
       created_at, updated_at
FROM public.product_variants;

GRANT SELECT ON public.product_primary_variants TO ba9alino_anon;
GRANT SELECT ON public.product_primary_variants TO ba9alino_admin;

-- Table product_categories
CREATE TABLE IF NOT EXISTS public.product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ar TEXT NOT NULL,
    name_en TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO ba9alino_anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO ba9alino_admin;
