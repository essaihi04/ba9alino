INSERT INTO public.warehouses (id, name, address, is_active, created_at)
VALUES
  ('9e32fd9d-c784-4d1b-978b-b97e8554fdaf', 'stock 1', NULL, true, '2026-01-27T09:22:27.485141+00:00'),
  ('8519113a-6b64-49e0-8b6f-f38f356e6441', 'tock 2', '', true, '2026-01-27T17:25:34.214302+00:00')
ON CONFLICT (id) DO NOTHING;

SELECT 'employees: ' || COUNT(*) FROM public.employees
UNION ALL
SELECT 'warehouses: ' || COUNT(*) FROM public.warehouses;
