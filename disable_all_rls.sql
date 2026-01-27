-- Script pour désactiver RLS sur toutes les tables de l'application Ba9alino
-- Exécute ce script dans Supabase SQL Editor pour désactiver les restrictions de sécurité

-- Tables principales de l'application
ALTER TABLE public.employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.families DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.virtual_accounts DISABLE ROW LEVEL SECURITY;

-- Tables de configuration et système
ALTER TABLE public.app_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;

-- Tables de comptabilité et finances
ALTER TABLE public.accounting_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_years DISABLE ROW LEVEL SECURITY;

-- Tables de rapports et statistiques
ALTER TABLE public.daily_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_reports DISABLE ROW LEVEL SECURITY;

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE 'RLS a été désactivé sur toutes les tables de l''application Ba9alino';
  RAISE NOTICE 'Les utilisateurs peuvent maintenant accéder à toutes les tables sans restrictions';
  RAISE NOTICE 'Pensez à réactiver RLS avec des politiques appropriées avant la production';
END $$;
