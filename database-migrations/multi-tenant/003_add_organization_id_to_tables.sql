-- ============================================================================
-- 003 — Add organization_id (nullable) to all tenant tables
-- We add it nullable first so existing rows don't break, then backfill in 004,
-- then set NOT NULL in 005.
-- ============================================================================

DO $$
DECLARE
  t TEXT;
  tenant_tables TEXT[] := ARRAY[
    -- Catalog
    'products', 'product_variants', 'packaging_variants', 'categories',
    -- People / inventory
    'clients', 'suppliers', 'employees', 'warehouses',
    -- Orders / invoices / payments
    'orders', 'order_items',
    'invoices', 'invoice_items', 'payments',
    -- Purchases
    'purchases', 'purchase_items',
    -- Stock
    'stock', 'warehouse_stock',
    -- Cash
    'cash_sessions', 'cash_movements',
    -- Misc
    'coupons', 'promotions', 'drafts',
    -- Auth (legacy table)
    'user_accounts',
    -- Visit / route tracking (commercial)
    'commercial_visits', 'commercial_routes',
    -- Anything else seen in the codebase
    'expenses'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE', t);
      RAISE NOTICE 'Added organization_id to %', t;
    ELSE
      RAISE NOTICE 'Skipped % (table does not exist)', t;
    END IF;
  END LOOP;
END $$;
