-- Script COMPLET pour désactiver RLS sur TOUTES les tables de l'application Ba9alino
-- Basé sur l'analyse complète du code source de l'admin-app
-- Exécute ce script dans Supabase SQL Editor pour désactiver toutes les restrictions de sécurité

-- =====================================================
-- TABLES PRINCIPALES (utilisées dans l'application)
-- =====================================================

-- Tables de gestion des utilisateurs et employés
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_transactions DISABLE ROW LEVEL SECURITY;

-- Tables de gestion des clients
ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits DISABLE ROW LEVEL SECURITY;

-- Tables de gestion des produits et stocks
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.families DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_stock DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_items DISABLE ROW LEVEL SECURITY;

-- Tables de gestion des commandes et ventes
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;

-- Tables de gestion des achats et fournisseurs
ALTER TABLE public.suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_credits DISABLE ROW LEVEL SECURITY;

-- Tables de gestion financière
ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_years DISABLE ROW LEVEL SECURITY;

-- Tables de configuration et système
ALTER TABLE public.app_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_info DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions DISABLE ROW LEVEL SECURITY;

-- Tables de rapports et statistiques
ALTER TABLE public.daily_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- TABLES VIRTUELLES (pour les comptes virtuels)
-- =====================================================
ALTER TABLE public.virtual_accounts DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- TABLES SUPPLÉMENTAIRES (potentiellement utilisées)
-- =====================================================

-- Tables de gestion des stocks avancés
ALTER TABLE public.inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_adjustments DISABLE ROW LEVEL SECURITY;

-- Tables de gestion des prix et promotions
ALTER TABLE public.price_lists DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_prices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.discounts DISABLE ROW LEVEL SECURITY;

-- Tables de gestion des taxes
ALTER TABLE public.tax_rates DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_configurations DISABLE ROW LEVEL SECURITY;

-- Tables de gestion des devis et factures proforma
ALTER TABLE public.quotes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.proforma_invoices DISABLE ROW LEVEL SECURITY;

-- Tables de gestion des retours et remboursements
ALTER TABLE public.returns DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds DISABLE ROW LEVEL SECURITY;

-- Tables de gestion des livraisons
ALTER TABLE public.deliveries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_routes DISABLE ROW LEVEL SECURITY;

-- Tables de gestion des notifications
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates DISABLE ROW LEVEL SECURITY;

-- Tables de gestion des documents et fichiers
ALTER TABLE public.documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_uploads DISABLE ROW LEVEL SECURITY;

-- Tables de gestion des paramètres et préférences
ALTER TABLE public.user_preferences DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.localization DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- FONCTIONS RPC (pour s'assurer qu'elles fonctionnent)
-- =====================================================

-- Réactiver les permissions sur les fonctions RPC si elles existent
DO $$
BEGIN
    -- Fonctions de comptes virtuels
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'virtual_login') THEN
        GRANT EXECUTE ON FUNCTION public.virtual_login(text, text) TO anon;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'virtual_create_account') THEN
        GRANT EXECUTE ON FUNCTION public.virtual_create_account(text, text, text, text, uuid) TO anon;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'virtual_list_accounts') THEN
        GRANT EXECUTE ON FUNCTION public.virtual_list_accounts(text) TO anon;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'virtual_delete_account') THEN
        GRANT EXECUTE ON FUNCTION public.virtual_delete_account(text, uuid) TO anon;
    END IF;
    
    -- Fonctions système
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'reset_all_sequences') THEN
        GRANT EXECUTE ON FUNCTION public.reset_all_sequences() TO anon;
    END IF;
END $$;

-- =====================================================
-- MESSAGE DE CONFIRMATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'RLS a été désactivé sur TOUTES les tables Ba9alino';
  RAISE NOTICE 'Nombre de tables traitées: ~60+ tables';
  RAISE NOTICE '=================================================';
  RAISE NOTICE '✅ Tables utilisateurs: users, user_accounts, employees';
  RAISE NOTICE '✅ Tables clients: clients, visits';
  RAISE NOTICE '✅ Tables produits: products, categories, families, stock';
  RAISE NOTICE '✅ Tables entrepôts: warehouses, warehouse_stock, stock_transfers';
  RAISE NOTICE '✅ Tables ventes: orders, invoices, payments';
  RAISE NOTICE '✅ Tables achats: suppliers, purchases, supplier_payments';
  RAISE NOTICE '✅ Tables financières: expenses, accounts, accounting_entries';
  RAISE NOTICE '✅ Tables système: app_settings, audit_logs, virtual_accounts';
  RAISE NOTICE '✅ Tables rapports: daily_reports, monthly_reports, analytics';
  RAISE NOTICE '=================================================';
  RAISE NOTICE '🎉 Toutes les fonctionnalités devraient maintenant fonctionner!';
  RAISE NOTICE '⚠️  Pensez à réactiver RLS avec des politiques sécurisées avant la production';
  RAISE NOTICE '=================================================';
END $$;
