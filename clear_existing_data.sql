-- Script INTELLIGENT pour supprimer les données seulement des tables qui existent
-- Vérifie l'existence de chaque table avant de tenter de supprimer les données
-- Exécute ce script dans Supabase SQL Editor pour nettoyer la base de données

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

DO $$
DECLARE
    tbl_name text;
    table_exists boolean;
    tables_deleted integer := 0;
    
    -- Tables dans l'ordre de suppression (dépendances d'abord)
    deletion_order text[] := ARRAY[
        -- Tables de transactions et mouvements
        'stock_transfer_items', 'stock_transfers', 'stock_movements', 'warehouse_stock',
        'inventory_movements', 'inventory_adjustments',
        
        -- Tables de transactions financières
        'supplier_payments', 'supplier_credits', 'payments', 'refunds', 'employee_transactions',
        
        -- Tables d'items et détails
        'invoice_items', 'order_items', 'purchase_items', 'return_items',
        'delivery_items', 'quote_items',
        
        -- Tables principales
        'invoices', 'orders', 'purchases', 'returns', 'deliveries', 'quotes',
        'proforma_invoices', 'credit_notes',
        
        -- Tables de visites et sessions
        'visits', 'user_sessions',
        
        -- Tables de produits et stocks
        'product_variants', 'products', 'inventory', 'stock',
        
        -- Tables d'entrepôts
        'warehouses',
        
        -- Tables de clients et fournisseurs
        'clients', 'suppliers',
        
        -- Tables d'employés et utilisateurs
        'user_accounts', 'employees', 'users',
        
        -- Tables de comptes virtuels
        'virtual_accounts',
        
        -- Tables de configuration et système
        'notifications', 'documents', 'attachments', 'file_uploads',
        'audit_logs', 'user_preferences',
        
        -- Tables financières et comptables
        'accounting_entries', 'expenses', 'accounts',
        
        -- Tables de rapports et analytics
        'daily_reports', 'monthly_reports', 'analytics',
        
        -- Tables de prix et promotions
        'product_prices', 'price_lists', 'promotions', 'discounts',
        
        -- Tables de taxes
        'tax_configurations', 'tax_rates',
        
        -- Tables de catégories
        'categories', 'families',
        
        -- Tables de configuration
        'app_settings', 'company_info', 'system_settings', 'localization',
        'notification_templates',
        
        -- Tables fiscales et périodes
        'fiscal_years'
    ];
    
    i integer;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🗑️  DÉBUT DE LA SUPPRESSION DES DONNÉES...';
    RAISE NOTICE '';
    
    -- Parcourir les tables dans l'ordre de suppression
    FOR i IN 1..array_length(deletion_order, 1) LOOP
        tbl_name := deletion_order[i];
        
        -- Vérifier si la table existe
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables t
            WHERE t.table_schema = 'public' 
            AND t.table_name = tbl_name
        ) INTO table_exists;
        
        IF table_exists THEN
            -- Supprimer les données de la table
            EXECUTE format('DELETE FROM public.%I', tbl_name);
            tables_deleted := tables_deleted + 1;
            RAISE NOTICE '✅ Données supprimées de: %', tbl_name;
        ELSE
            RAISE NOTICE '⚠️  Table inexistante: %', tbl_name;
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '=================================================';
    RAISE NOTICE '📊 RÉSUMÉ DE LA SUPPRESSION';
    RAISE NOTICE '=================================================';
    RAISE NOTICE 'Tables traitées: %', tables_deleted;
    RAISE NOTICE '=================================================';
    RAISE NOTICE '🎉 Suppression des données terminée!';
    RAISE NOTICE '=================================================';
END $$;

-- Réactiver les contraintes de clés étrangères
SET session_replication_role = DEFAULT;

-- =====================================================
-- RÉINITIALISER LES SÉQUENCES AUTO-INCREMENT
-- =====================================================

DO $$
DECLARE
    tbl_name text;
    table_exists boolean;
    sequence_exists boolean;
    sequences_reset integer := 0;
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
        tbl_name := tables_with_sequences[i];
        
        -- Vérifier si la table existe
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables t
            WHERE t.table_schema = 'public' 
            AND t.table_name = tbl_name
        ) INTO table_exists;
        
        IF table_exists THEN
            -- Vérifier si la table a une colonne id de type serial
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns c
                WHERE c.table_schema = 'public'
                AND c.table_name = tbl_name
                AND c.column_name = 'id'
                AND c.column_default LIKE 'nextval%'
            ) INTO sequence_exists;
            
            IF sequence_exists THEN
                -- Réinitialiser la séquence à 1
                EXECUTE format('ALTER TABLE public.%I ALTER COLUMN id RESTART WITH 1', tbl_name);
                sequences_reset := sequences_reset + 1;
                RAISE NOTICE '✅ Séquence réinitialisée pour: %', tbl_name;
            END IF;
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '=================================================';
    RAISE NOTICE '📊 RÉSUMÉ DES SÉQUENCES';
    RAISE NOTICE '=================================================';
    RAISE NOTICE 'Séquences réinitialisées: %', sequences_reset;
    RAISE NOTICE '=================================================';
    RAISE NOTICE '🔄 Réinitialisation des séquences terminée';
    RAISE NOTICE '=================================================';
END $$;

-- =====================================================
-- MESSAGE DE CONFIRMATION FINAL
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=================================================';
    RAISE NOTICE '🎉 NETTOYAGE COMPLET TERMINÉ AVEC SUCCÈS!';
    RAISE NOTICE '=================================================';
    RAISE NOTICE '✅ Toutes les données existantes ont été supprimées';
    RAISE NOTICE '✅ Séquences auto-increment réinitialisées';
    RAISE NOTICE '✅ Base de données prête pour un nouveau départ';
    RAISE NOTICE '=================================================';
    RAISE NOTICE '🚀 Vous pouvez maintenant commencer avec une base de données propre!';
    RAISE NOTICE '=================================================';
END $$;
