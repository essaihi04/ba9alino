-- ============================================================
-- 1) Add organization_id to product_categories
-- ============================================================
ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS organization_id UUID
    REFERENCES public.organizations(id) ON DELETE CASCADE;

-- ============================================================
-- 2) Assign all existing categories to Ba9alino org
-- ============================================================
UPDATE public.product_categories
SET organization_id = '6db5963e-4412-4b07-bab5-80eb33bd1d7f'
WHERE organization_id IS NULL;

-- ============================================================
-- 3) Enable RLS + isolation policy
-- ============================================================
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON public.product_categories;
CREATE POLICY tenant_isolation ON public.product_categories
  FOR ALL
  USING (is_super_admin() OR (organization_id = current_org_id()))
  WITH CHECK (is_super_admin() OR (organization_id = current_org_id()));

-- ============================================================
-- 4) Add auto-fill trigger (same as other tables)
-- ============================================================
DROP TRIGGER IF EXISTS trg_auto_org_id ON public.product_categories;
CREATE TRIGGER trg_auto_org_id
  BEFORE INSERT ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_organization_id();

-- ============================================================
-- 5) Also fix the Nginx Authorization header issue
--    (done in nginx config — just reload PostgREST schema)
-- ============================================================
NOTIFY pgrst, 'reload schema';

-- Verify
SELECT COUNT(*) AS categories_ba9alino
FROM product_categories
WHERE organization_id = '6db5963e-4412-4b07-bab5-80eb33bd1d7f';

SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'product_categories';
