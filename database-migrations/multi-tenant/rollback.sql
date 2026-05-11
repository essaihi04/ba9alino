-- ============================================================================
-- ROLLBACK — disables RLS, drops new tables, drops organization_id columns
-- DANGER: only run on a non-production DB or after a verified backup.
-- ============================================================================

DO $$
DECLARE
  t TEXT;
  tenant_tables TEXT[] := ARRAY[
    'products','product_variants','packaging_variants','categories',
    'clients','suppliers','employees','warehouses',
    'orders','order_items',
    'invoices','invoice_items','payments',
    'purchases','purchase_items',
    'stock','warehouse_stock',
    'cash_sessions','cash_movements',
    'coupons','promotions','drafts',
    'user_accounts','commercial_visits','commercial_routes','expenses'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', t);
      EXECUTE format('ALTER TABLE public.%I DROP COLUMN IF EXISTS organization_id', t);
    END IF;
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.superadmin_login(TEXT,TEXT);
DROP FUNCTION IF EXISTS public._assert_super_admin(TEXT,TEXT);
DROP FUNCTION IF EXISTS public.superadmin_list_organizations(TEXT,TEXT);
DROP FUNCTION IF EXISTS public.superadmin_create_organization(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT);
DROP FUNCTION IF EXISTS public.superadmin_toggle_organization(TEXT,TEXT,UUID,BOOLEAN);
DROP FUNCTION IF EXISTS public.superadmin_delete_organization(TEXT,TEXT,UUID,BOOLEAN);
DROP FUNCTION IF EXISTS public.resolve_organization_for_user(TEXT);
DROP FUNCTION IF EXISTS public.current_org_id();
DROP FUNCTION IF EXISTS public.is_super_admin();
DROP FUNCTION IF EXISTS public.is_org_member(UUID);

DROP TABLE IF EXISTS organization_members CASCADE;
DROP TABLE IF EXISTS super_admins CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
