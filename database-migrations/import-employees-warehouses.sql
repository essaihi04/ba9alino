-- Import employees
INSERT INTO public.employees (id, name, phone, role, status, password_hash, created_at, updated_at, email, address, national_id, salary, hire_date, custom_role, monthly_salary, advance_limit, allowed_price_tiers)
VALUES
  ('1528d08c-e9f1-4c5d-9295-11dd95405fd0', 'zouhair', '09090909', 'commercial', 'active', NULL, '2026-01-27T09:19:06.049+00:00', '2026-01-27T09:19:06.049+00:00', NULL, NULL, NULL, NULL, '2026-01-27', NULL, 1000, 1000, NULL),
  ('4630c8a3-0d4e-444b-b354-ae620d1a26a4', 'zizo', '004630c8a3', 'commercial', 'active', NULL, '2026-05-04T11:15:48.203451+00:00', '2026-05-04T11:15:48.203451+00:00', 'commercial-4630c8a3-0d4e-444b-b354-ae620d1a26a4@ba9alino.com', NULL, NULL, NULL, NULL, NULL, 0, 0, NULL),
  ('61c2028e-cd64-410a-8482-1a7b4fb43f57', 'مهدي', '0603573759', 'delivery_driver', 'inactive', NULL, '2026-02-02T13:01:55.104+00:00', '2026-04-20T10:01:35.587+00:00', NULL, 'ansi', 'BB179990', NULL, '2026-02-02', NULL, 3000, 200, ARRAY['D']),
  ('f7dbbd95-44af-40af-b235-0329187411e1', 'Commercial User', '0000000000', 'commercial', 'inactive', NULL, '2026-01-27T11:10:32.20122+00:00', '2026-02-02T16:29:16.466+00:00', 'commercial-f7dbbd95-44af-40af-b235-0329187411e1@ba9alino.com', NULL, NULL, NULL, NULL, NULL, 0, 0, NULL),
  ('d1468d81-7175-4fae-8388-474f92f1b3f9', 'test', '0641998700', 'commercial', 'active', NULL, '2026-02-13T18:46:29.95+00:00', '2026-02-13T18:46:29.949+00:00', NULL, NULL, NULL, NULL, '2026-02-13', NULL, NULL, NULL, ARRAY['C']),
  ('ea35637f-a553-4409-a58d-95a7c08012e8', 'عبد الجليل الباينة', '0601284590', 'admin', 'active', NULL, '2026-02-16T13:51:21.055+00:00', '2026-02-16T13:53:36.774+00:00', NULL, NULL, NULL, NULL, '2026-02-16', NULL, NULL, NULL, ARRAY['A','B','C','D']),
  ('b2a93ce9-685d-49bd-8775-51c0b8be3af8', 'test', '012345678', 'commercial', 'active', NULL, '2026-04-06T16:10:22.067+00:00', '2026-04-06T16:10:22.067+00:00', NULL, NULL, NULL, NULL, '2026-04-06', NULL, NULL, NULL, ARRAY['C']),
  ('ac174016-1734-425f-9ae5-1103e4de6041', 'Samahi', '06985632178965', 'commercial', 'active', NULL, '2026-04-15T14:41:18.627+00:00', '2026-04-15T21:09:59.383+00:00', NULL, NULL, NULL, NULL, '2026-04-15', NULL, 4000, NULL, ARRAY['B','A','C','D']),
  ('1e9947a0-04d5-4138-bd64-796065bbd51b', 'younsse', '0619256493', 'delivery_driver', 'active', NULL, '2026-03-30T15:56:52.704+00:00', '2026-04-24T09:47:37.879+00:00', NULL, NULL, NULL, NULL, '2026-03-30', NULL, 2500, NULL, ARRAY['D','C'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  email = EXCLUDED.email,
  address = EXCLUDED.address,
  national_id = EXCLUDED.national_id,
  hire_date = EXCLUDED.hire_date,
  monthly_salary = EXCLUDED.monthly_salary,
  advance_limit = EXCLUDED.advance_limit,
  allowed_price_tiers = EXCLUDED.allowed_price_tiers,
  updated_at = EXCLUDED.updated_at;

-- Import warehouses
INSERT INTO public.warehouses (id, name, address, manager_id, is_active, created_at)
VALUES
  ('9e32fd9d-c784-4d1b-978b-b97e8554fdaf', 'stock 1', NULL, NULL, true, '2026-01-27T09:22:27.485141+00:00'),
  ('8519113a-6b64-49e0-8b6f-f38f356e6441', 'tock 2', E'\n', NULL, true, '2026-01-27T17:25:34.214302+00:00')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  is_active = EXCLUDED.is_active;

SELECT 'employees: ' || COUNT(*) FROM public.employees
UNION ALL
SELECT 'warehouses: ' || COUNT(*) FROM public.warehouses;
