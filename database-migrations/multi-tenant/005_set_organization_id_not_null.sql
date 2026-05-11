-- ============================================================================
-- 005 — Lock down organization_id (NOT NULL + indexes)
-- Run this AFTER you've confirmed step 004 backfilled all rows successfully.
-- ============================================================================

DO $$
DECLARE
  t TEXT;
  v_remaining BIGINT;
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
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t)
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'organization_id')
    THEN
      -- Verify backfill is complete before locking
      EXECUTE format('SELECT COUNT(*) FROM public.%I WHERE organization_id IS NULL', t) INTO v_remaining;
      IF v_remaining > 0 THEN
        RAISE EXCEPTION 'Cannot set NOT NULL on %.organization_id: % rows still NULL. Run 004 again.', t, v_remaining;
      END IF;

      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN organization_id SET NOT NULL', t);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_organization_id ON public.%I(organization_id)', t, t);
      RAISE NOTICE 'Locked %: NOT NULL + index', t;
    END IF;
  END LOOP;
END $$;
