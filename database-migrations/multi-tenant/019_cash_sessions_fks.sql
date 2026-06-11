-- Add missing FKs on cash_sessions so PostgREST can resolve embedded relations
-- (frontend uses cash_sessions_employee_id_fkey and cash_sessions_warehouse_id_fkey)

-- Null out orphaned references first
UPDATE public.cash_sessions SET employee_id = NULL
WHERE employee_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.employees e WHERE e.id = cash_sessions.employee_id);

UPDATE public.cash_sessions SET warehouse_id = NULL
WHERE warehouse_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.warehouses w WHERE w.id = cash_sessions.warehouse_id);

ALTER TABLE public.cash_sessions
  ADD CONSTRAINT cash_sessions_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;

ALTER TABLE public.cash_sessions
  ADD CONSTRAINT cash_sessions_warehouse_id_fkey
  FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Verify
SELECT conname FROM pg_constraint
WHERE conrelid = 'cash_sessions'::regclass AND contype = 'f';
