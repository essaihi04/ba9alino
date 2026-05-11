-- ============================================================================
-- 007 — Enable RLS and create per-tenant policies
--
-- IMPORTANT: this script is destructive of existing policies. It drops a
-- conventionally-named "tenant_isolation" policy first, then recreates it.
-- Other custom policies (e.g. RLS for service_role) are not touched.
-- ============================================================================

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
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t)
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'organization_id')
    THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', t);
      EXECUTE format($f$
        CREATE POLICY tenant_isolation ON public.%I
          FOR ALL
          USING (
            public.is_super_admin()
            OR organization_id = public.current_org_id()
          )
          WITH CHECK (
            public.is_super_admin()
            OR organization_id = public.current_org_id()
          )
      $f$, t);
      RAISE NOTICE 'RLS enabled on %', t;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Core multi-tenant tables: more restrictive policies
-- ---------------------------------------------------------------------------

ALTER TABLE organizations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admins          ENABLE ROW LEVEL SECURITY;

-- organizations: SuperAdmin sees all, normal users only see their own
DROP POLICY IF EXISTS organizations_super_admin   ON organizations;
DROP POLICY IF EXISTS organizations_self_select   ON organizations;
CREATE POLICY organizations_super_admin ON organizations
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY organizations_self_select ON organizations
  FOR SELECT USING (id = public.current_org_id());

-- organization_members: SuperAdmin all; user can SELECT own membership
DROP POLICY IF EXISTS org_members_super_admin ON organization_members;
DROP POLICY IF EXISTS org_members_self_select ON organization_members;
CREATE POLICY org_members_super_admin ON organization_members
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY org_members_self_select ON organization_members
  FOR SELECT USING (organization_id = public.current_org_id());

-- super_admins: ONLY SuperAdmin can read/write. Login itself uses a
-- SECURITY DEFINER RPC that bypasses RLS.
DROP POLICY IF EXISTS super_admins_super_admin ON super_admins;
CREATE POLICY super_admins_super_admin ON super_admins
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
