-- Mettre à jour la table virtual_accounts pour inclure employee_id
ALTER TABLE public.virtual_accounts ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.employees(id);

-- Supprimer et recréer la fonction virtual_create_account pour accepter employee_id
DROP FUNCTION IF EXISTS public.virtual_create_account(text, text, text, text);

CREATE OR REPLACE FUNCTION public.virtual_create_account(
  p_admin_password text,
  p_name text,
  p_password text,
  p_role text,
  p_employee_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_name text;
  v_role text;
BEGIN
  IF coalesce(p_admin_password,'') <> 'admin123' THEN
    RETURN json_build_object('success', false, 'error', 'unauthorized');
  END IF;

  v_name := trim(coalesce(p_name,''));
  v_role := lower(trim(coalesce(p_role,'')));

  IF v_name = '' THEN
    RETURN json_build_object('success', false, 'error', 'name_required');
  END IF;

  IF coalesce(p_password,'') = '' THEN
    RETURN json_build_object('success', false, 'error', 'password_required');
  END IF;

  IF v_role not in ('employee','commercial') THEN
    RETURN json_build_object('success', false, 'error', 'invalid_role');
  END IF;

  INSERT INTO public.virtual_accounts(name, role, password_hash, employee_id)
  VALUES (v_name, v_role, crypt(p_password, gen_salt('bf')), p_employee_id);

  RETURN json_build_object('success', true);
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('success', false, 'error', 'name_exists');
END;
$$;

-- Supprimer et recréer la fonction virtual_list_accounts pour inclure employee_id
DROP FUNCTION IF EXISTS public.virtual_list_accounts(text);

CREATE OR REPLACE FUNCTION public.virtual_list_accounts(p_admin_password text)
RETURNS table (
  id uuid, 
  name text, 
  role text, 
  is_active boolean, 
  created_at timestamptz,
  employee_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF coalesce(p_admin_password,'') <> 'admin123' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT va.id, va.name, va.role, va.is_active, va.created_at, va.employee_id
  FROM public.virtual_accounts va
  ORDER BY va.created_at DESC;
END;
$$;

-- Réattribuer les permissions
GRANT EXECUTE ON FUNCTION public.virtual_create_account(text, text, text, text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.virtual_list_accounts(text) TO anon;
