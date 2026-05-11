-- ============================================================================
-- 014 — Auto-set organization_id on INSERT via trigger
--
-- The RLS WITH CHECK policy requires organization_id = current_org_id().
-- The frontend does not include organization_id in INSERT payloads.
-- This trigger fires BEFORE INSERT on every tenant table and fills
-- organization_id from the current JWT context (current_org_id()).
-- Existing rows keep their organization_id unchanged (trigger only fires
-- on INSERT, not UPDATE).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_set_organization_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := public.current_org_id();
  END IF;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_set_organization_id() TO PUBLIC;

-- Install trigger on all tenant tables that have organization_id
DO $$
DECLARE
  t TEXT;
  tenant_tables TEXT[] := ARRAY[
    'products', 'product_variants', 'packaging_variants', 'categories',
    'clients', 'suppliers', 'employees', 'warehouses',
    'orders', 'order_items',
    'invoices', 'invoice_items', 'payments',
    'purchases', 'purchase_items',
    'stock', 'warehouse_stock',
    'cash_sessions', 'cash_movements',
    'coupons', 'promotions', 'drafts',
    'user_accounts',
    'commercial_visits', 'commercial_routes',
    'expenses'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'organization_id'
    ) THEN
      -- Drop existing trigger if any, then recreate
      EXECUTE format('DROP TRIGGER IF EXISTS trg_auto_org_id ON public.%I', t);
      EXECUTE format($f$
        CREATE TRIGGER trg_auto_org_id
        BEFORE INSERT ON public.%I
        FOR EACH ROW
        EXECUTE FUNCTION public.auto_set_organization_id()
      $f$, t);
      RAISE NOTICE 'Trigger installed on %', t;
    END IF;
  END LOOP;
END $$;
