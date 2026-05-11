-- ============================================================================
-- 004 — Backfill organization_id with the Ba9alino default org
-- ============================================================================

DO $$
DECLARE
  v_org_id UUID;
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
  v_updated BIGINT;
BEGIN
  SELECT id INTO v_org_id FROM organizations WHERE is_default = TRUE LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No default organization found — run 002 first';
  END IF;

  RAISE NOTICE 'Backfilling organization_id = % (Ba9alino)', v_org_id;

  FOREACH t IN ARRAY tenant_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t)
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'organization_id')
    THEN
      EXECUTE format('UPDATE public.%I SET organization_id = $1 WHERE organization_id IS NULL', t)
        USING v_org_id;
      GET DIAGNOSTICS v_updated = ROW_COUNT;
      RAISE NOTICE '  %: % rows updated', t, v_updated;
    END IF;
  END LOOP;
END $$;
