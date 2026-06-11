-- ============================================================
-- Fix product_primary_variants: add org isolation
-- ============================================================

-- 1) Add organization_id column (backfill from products)
ALTER TABLE public.product_primary_variants
  ADD COLUMN IF NOT EXISTS organization_id UUID
    REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.product_primary_variants ppv
SET organization_id = p.organization_id
FROM public.products p
WHERE ppv.product_id = p.id
  AND ppv.organization_id IS NULL;

-- 2) Enable RLS
ALTER TABLE public.product_primary_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON public.product_primary_variants;
CREATE POLICY tenant_isolation ON public.product_primary_variants
  FOR ALL
  USING (is_super_admin() OR (organization_id = current_org_id()))
  WITH CHECK (is_super_admin() OR (organization_id = current_org_id()));

-- 3) Auto-fill trigger
DROP TRIGGER IF EXISTS trg_auto_org_id ON public.product_primary_variants;
CREATE TRIGGER trg_auto_org_id
  BEFORE INSERT ON public.product_primary_variants
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_organization_id();

-- Verify
SELECT p.organization_id, COUNT(ppv.id)
FROM product_primary_variants ppv
JOIN products p ON p.id = ppv.product_id
GROUP BY p.organization_id;

SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'product_primary_variants';

NOTIFY pgrst, 'reload schema';
