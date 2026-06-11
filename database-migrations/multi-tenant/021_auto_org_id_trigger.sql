-- Trigger: auto-fill organization_id from JWT when null on INSERT
-- Applies to all tenant tables that have the column.

CREATE OR REPLACE FUNCTION public.auto_set_organization_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := public.current_org_id();
  END IF;
  RETURN NEW;
END;
$$;

-- Helper macro: create the trigger for a given table
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clients', 'products', 'invoices', 'orders', 'payments',
    'employees', 'stock', 'warehouse_stock', 'purchases',
    'expenses', 'cash_sessions', 'warehouses'
  ] LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_auto_org_id ON %I;
      CREATE TRIGGER trg_auto_org_id
        BEFORE INSERT ON %I
        FOR EACH ROW EXECUTE FUNCTION public.auto_set_organization_id();
    ', t, t);
  END LOOP;
END $$;

-- Verify trigger exists on clients
SELECT tgname, tgrelid::regclass FROM pg_trigger
WHERE tgname = 'trg_auto_org_id'
ORDER BY tgrelid::regclass::text;
