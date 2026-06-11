-- ============================================================
-- Fix virtual_* functions to respect organization isolation
-- ============================================================

-- 1) virtual_list_accounts: filter by current org
CREATE OR REPLACE FUNCTION public.virtual_list_accounts(p_admin_password TEXT)
RETURNS TABLE(id UUID, name TEXT, role TEXT, is_active BOOLEAN, created_at TIMESTAMPTZ, employee_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT va.id, va.name, va.role, va.is_active, va.created_at, va.employee_id
  FROM public.virtual_accounts va
  WHERE (is_super_admin() OR va.organization_id = current_org_id())
  ORDER BY va.created_at DESC;
END;
$$;

-- 2) virtual_create_account: inject organization_id
CREATE OR REPLACE FUNCTION public.virtual_create_account(
  p_admin_password TEXT,
  p_name TEXT,
  p_password TEXT,
  p_role TEXT DEFAULT 'employee',
  p_employee_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name TEXT := LOWER(TRIM(COALESCE(p_name, '')));
  v_exists INT;
  v_org_id UUID := current_org_id();
BEGIN
  IF v_name = '' OR COALESCE(p_password, '') = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_fields');
  END IF;

  -- Check for duplicate name within same org
  SELECT COUNT(*) INTO v_exists
  FROM public.virtual_accounts
  WHERE name = v_name AND organization_id = v_org_id;

  IF v_exists > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'name_exists');
  END IF;

  INSERT INTO public.virtual_accounts (name, password_hash, role, employee_id, is_active, organization_id)
  VALUES (v_name, crypt(p_password, gen_salt('bf')), COALESCE(p_role, 'employee'), p_employee_id, true, v_org_id);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 3) virtual_delete_account: only delete within own org
CREATE OR REPLACE FUNCTION public.virtual_delete_account(
  p_admin_password TEXT,
  p_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.virtual_accounts
  WHERE id = p_id
    AND (is_super_admin() OR organization_id = current_org_id());

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- 4) Add auto-fill trigger on virtual_accounts (was missing)
DROP TRIGGER IF EXISTS trg_auto_org_id ON public.virtual_accounts;
CREATE TRIGGER trg_auto_org_id
  BEFORE INSERT ON public.virtual_accounts
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_organization_id();

-- Verify
SELECT proname FROM pg_proc WHERE proname LIKE 'virtual_%' ORDER BY proname;
SELECT tgname FROM pg_trigger WHERE tgname = 'trg_auto_org_id' AND tgrelid = 'virtual_accounts'::regclass;
