-- Check trigger on clients
SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid='clients'::regclass;

-- Check if trigger function handles NULL org_id return
SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'auto_set_organization_id';

-- Try a simpler fix: set the WITH CHECK to also allow when trigger will handle it
-- Add a DEFAULT on clients.organization_id
ALTER TABLE public.clients
  ALTER COLUMN organization_id SET DEFAULT public.current_org_id();

-- Also widen the RLS to be less strict: if org_id ends up correct after trigger, accept
-- (the current policy checks AFTER trigger in PostgreSQL)
-- Verify trigger order
SELECT tgname, tgtype, tgenabled FROM pg_trigger WHERE tgrelid = 'clients'::regclass;
