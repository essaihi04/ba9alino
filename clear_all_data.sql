-- Script pour SUPPRIMER TOUTES LES DONNÉES des tables de l'application Ba9alino
-- Respecte l'ordre des dépendances pour éviter les erreurs de clés étrangères
-- Exécute ce script dans Supabase SQL Editor pour nettoyer complètement la base de données

-- =====================================================
-- ATTENTION: CE SCRIPT VA SUPPRIMER TOUTES LES DONNÉES
-- =====================================================
-- Sauvegardez votre base de données avant d'exécuter ce script
-- Cette opération est IRRÉVERSIBLE
-- =====================================================

-- Désactiver temporairement les contraintes de clés étrangères
SET session_replication_role = replica;

-- =====================================================
-- SUPPRESSION DES DONNÉES (ordre des dépendances)
-- =====================================================

-- Tables de transactions et mouvements (dépendent d'autres tables)
DELETE FROM public.stock_transfer_items;
DELETE FROM public.stock_transfers;
DELETE FROM public.stock_movements;
DELETE FROM public.warehouse_stock;
DELETE FROM public.inventory_movements;
DELETE FROM public.inventory_adjustments;

-- Tables de transactions financières
DELETE FROM public.supplier_payments;
DELETE FROM public.supplier_credits;
DELETE FROM public.payments;
DELETE FROM public.refunds;
DELETE FROM public.employee_transactions;

-- Tables d'items et détails
DELETE FROM public.invoice_items;
DELETE FROM public.order_items;
DELETE FROM public.purchase_items;
DELETE FROM public.return_items;
DELETE FROM public.delivery_items;
DELETE FROM public.quote_items;

-- Tables principales (dépendent des tables de référence)
DELETE FROM public.invoices;
DELETE FROM public.orders;
DELETE FROM public.purchases;
DELETE FROM public.returns;
DELETE FROM public.deliveries;
DELETE FROM public.quotes;
DELETE FROM public.proforma_invoices;
DELETE FROM public.credit_notes;

-- Tables de visites et sessions
DELETE FROM public.visits;
DELETE FROM public.user_sessions;

-- Tables de produits et stocks
DELETE FROM public.product_variants;
DELETE FROM public.products;
DELETE FROM public.inventory;
DELETE FROM public.stock;

-- Tables d'entrepôts
DELETE FROM public.warehouses;

-- Tables de clients et fournisseurs
DELETE FROM public.clients;
DELETE FROM public.suppliers;

-- Tables d'employés et utilisateurs
DELETE FROM public.user_accounts;
DELETE FROM public.employees;
DELETE FROM public.users;

-- Tables de comptes virtuels
DELETE FROM public.virtual_accounts;

-- Tables de configuration et système
DELETE FROM public.notifications;
DELETE FROM public.documents;
DELETE FROM public.attachments;
DELETE FROM public.file_uploads;
DELETE FROM public.audit_logs;
DELETE FROM public.user_preferences;

-- Tables financières et comptables
DELETE FROM public.accounting_entries;
DELETE FROM public.expenses;
DELETE FROM public.accounts;

-- Tables de rapports et analytics
DELETE FROM public.daily_reports;
DELETE FROM public.monthly_reports;
DELETE FROM public.analytics;

-- Tables de prix et promotions
DELETE FROM public.product_prices;
DELETE FROM public.price_lists;
DELETE FROM public.promotions;
DELETE FROM public.discounts;

-- Tables de taxes
DELETE FROM public.tax_configurations;
DELETE FROM public.tax_rates;

-- Tables de catégories
DELETE FROM public.categories;
DELETE FROM public.families;

-- Tables de configuration
DELETE FROM public.app_settings;
DELETE FROM public.company_info;
DELETE FROM public.system_settings;
DELETE FROM public.localization;
DELETE FROM public.notification_templates;

-- Tables fiscales et périodes
DELETE FROM public.fiscal_years;

-- Réactiver les contraintes de clés étrangères
SET session_replication_role = DEFAULT;

-- =====================================================
-- RÉINITIALISER LES SÉQUENCES AUTO-INCREMENT
-- =====================================================

DO $$
DECLARE
    table_name text;
    sequence_name text;
    table_exists boolean;
    sequence_exists boolean;
    tables_with_sequences text[] := ARRAY[
        'users', 'user_accounts', 'employees', 'employee_transactions',
        'clients', 'visits',
        'products', 'product_variants', 'categories', 'families',
        'stock', 'warehouses', 'warehouse_stock', 'stock_movements',
        'stock_transfers', 'stock_transfer_items',
        'orders', 'order_items', 'invoices', 'invoice_items',
        'credit_notes', 'payments',
        'suppliers', 'purchases', 'purchase_items',
        'supplier_payments', 'supplier_credits',
        'expenses', 'accounts', 'accounting_entries', 'fiscal_years',
        'app_settings', 'company_info', 'audit_logs', 'user_sessions',
        'daily_reports', 'monthly_reports', 'analytics',
        'virtual_accounts',
        'inventory', 'inventory_movements', 'inventory_adjustments',
        'price_lists', 'product_prices', 'promotions', 'discounts',
        'tax_rates', 'tax_configurations',
        'quotes', 'quote_items', 'proforma_invoices',
        'returns', 'return_items', 'refunds',
        'deliveries', 'delivery_items', 'delivery_routes',
        'notifications', 'notification_templates',
        'documents', 'attachments', 'file_uploads',
        'user_preferences', 'system_settings', 'localization'
    ];
    i integer;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔄 Réinitialisation des séquences auto-increment...';
    
    FOR i IN 1..array_length(tables_with_sequences, 1) LOOP
        table_name := tables_with_sequences[i];
        
        -- Vérifier si la table existe
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables t
            WHERE t.table_schema = 'public' 
            AND t.table_name = table_name
        ) INTO table_exists;
        
        IF table_exists THEN
            -- Vérifier si la table a une colonne id de type serial
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns c
                WHERE c.table_schema = 'public'
                AND c.table_name = table_name
                AND c.column_name = 'id'
                AND c.column_default LIKE 'nextval%'
            ) INTO sequence_exists;
            
            IF sequence_exists THEN
                -- Réinitialiser la séquence à 1
                EXECUTE format('ALTER TABLE public.%I ALTER COLUMN id RESTART WITH 1', table_name);
                RAISE NOTICE '✅ Séquence réinitialisée pour: %', table_name;
            END IF;
        END IF;
    END LOOP;
    
    RAISE NOTICE '🔄 Réinitialisation des séquences terminée';
END $$;

-- =====================================================
-- MESSAGE DE CONFIRMATION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=================================================';
    RAISE NOTICE '🗑️  NETTOYAGE COMPLET TERMINÉ';
    RAISE NOTICE '=================================================';
    RAISE NOTICE '✅ Toutes les données ont été supprimées';
    RAISE NOTICE '✅ Séquences auto-increment réinitialisées';
    RAISE NOTICE '✅ Base de données prête pour un nouveau départ';
    RAISE NOTICE '=================================================';
    RAISE NOTICE '🎉 La base de données est maintenant vide!';
    RAISE NOTICE '=================================================';
END $$;
