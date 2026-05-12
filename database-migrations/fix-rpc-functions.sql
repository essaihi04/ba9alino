-- ============================================================
-- Fix user_accounts_login (explicit TEXT casts to avoid type mismatch)
-- ============================================================
CREATE OR REPLACE FUNCTION public.user_accounts_login(p_name text, p_password text)
RETURNS TABLE(id uuid, role text, name text, employee_id uuid, email text)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_name TEXT := LOWER(TRIM(COALESCE(p_name, '')));
BEGIN
  IF v_name = '' OR COALESCE(p_password, '') = '' THEN RETURN; END IF;
  RETURN QUERY
  SELECT ua.id::uuid,
         ua.role::TEXT,
         COALESCE(ua.full_name, ua.username, v_name)::TEXT,
         ua.employee_id::uuid,
         ua.email::TEXT
  FROM public.user_accounts ua
  WHERE LOWER(TRIM(ua.username)) = v_name
    AND COALESCE(ua.is_active, true) = true
    AND ua.password_hash IS NOT NULL
    AND ua.password_hash = crypt(p_password, ua.password_hash)
  LIMIT 1;
END;
$$;

-- ============================================================
-- virtual_list_accounts  (list all virtual accounts for admin)
-- ============================================================
CREATE OR REPLACE FUNCTION public.virtual_list_accounts(p_admin_password text DEFAULT '')
RETURNS TABLE(id uuid, name text, role text, is_active boolean, created_at timestamptz, employee_id uuid)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT va.id, va.name, va.role, va.is_active, va.created_at, va.employee_id
  FROM public.virtual_accounts va
  ORDER BY va.created_at DESC;
END;
$$;

-- ============================================================
-- virtual_create_account
-- ============================================================
CREATE OR REPLACE FUNCTION public.virtual_create_account(
  p_admin_password text,
  p_name text,
  p_password text,
  p_role text DEFAULT 'employee',
  p_employee_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_name TEXT := LOWER(TRIM(COALESCE(p_name, '')));
  v_exists INT;
BEGIN
  IF v_name = '' OR COALESCE(p_password, '') = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_fields');
  END IF;

  SELECT COUNT(*) INTO v_exists FROM public.virtual_accounts WHERE name = v_name;
  IF v_exists > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'name_exists');
  END IF;

  INSERT INTO public.virtual_accounts (name, password_hash, role, employee_id, is_active)
  VALUES (v_name, crypt(p_password, gen_salt('bf')), COALESCE(p_role, 'employee'), p_employee_id, true);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- virtual_delete_account
-- ============================================================
CREATE OR REPLACE FUNCTION public.virtual_delete_account(p_admin_password text, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.virtual_accounts WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Grant execute to anon role (needed by PostgREST)
GRANT EXECUTE ON FUNCTION public.user_accounts_login(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.virtual_list_accounts(text) TO anon;
GRANT EXECUTE ON FUNCTION public.virtual_create_account(text, text, text, text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.virtual_delete_account(text, uuid) TO anon;

SELECT 'RPC functions created OK' AS status;
