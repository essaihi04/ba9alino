DROP FUNCTION IF EXISTS public.virtual_list_accounts(text);

CREATE FUNCTION public.virtual_list_accounts(p_admin_password TEXT)
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

GRANT EXECUTE ON FUNCTION public.virtual_list_accounts(text) TO ba9alino_anon;

NOTIFY pgrst, 'reload schema';

-- Quick test: simulate test org
BEGIN;
  SET LOCAL "request.jwt.claims" = '{"sub":"2127ef88-a86e-4c9b-92b8-4fe59abaf7e3","organization_id":"209ab928-d1bc-472c-8543-ba08dff73f5c","role":"ba9alino_anon"}';
  SET LOCAL ROLE ba9alino_anon;
  SELECT COUNT(*) AS accounts_visible FROM public.virtual_list_accounts('admin123');
ROLLBACK;
