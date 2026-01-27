-- Script INTELLIGENT pour désactiver RLS seulement sur les tables qui existent
-- Vérifie l'existence de chaque table avant de tenter de désactiver RLS
-- Exécute ce script dans Supabase SQL Editor

-- Fonction pour désactiver RLS en toute sécurité
DO $$
DECLARE
    table_name text;
    table_exists boolean;
    rls_enabled boolean;
    tables_processed integer := 0;
    tables_with_rls integer := 0;
    table_array text[] := ARRAY[
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
    -- Parcourir toutes les tables
    FOR i IN 1..array_length(table_array, 1) LOOP
        table_name := table_array[i];
        
        -- Vérifier si la table existe
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = table_name
        ) INTO table_exists;
        
        IF table_exists THEN
            tables_processed := tables_processed + 1;
            
            -- Vérifier si RLS est activé
            SELECT relrowsecurity INTO rls_enabled
            FROM pg_class 
            WHERE relname = table_name 
            AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
            
            IF rls_enabled THEN
                -- Désactiver RLS
                EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', table_name);
                tables_with_rls := tables_with_rls + 1;
                RAISE NOTICE '✅ RLS désactivé sur: %', table_name;
            ELSE
                RAISE NOTICE 'ℹ️  RLS déjà désactivé sur: %', table_name;
            END IF;
        ELSE
            RAISE NOTICE '⚠️  Table inexistante: %', table_name;
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '=================================================';
    RAISE NOTICE '📊 RÉSUMÉ DU TRAITEMENT';
    RAISE NOTICE '=================================================';
    RAISE NOTICE 'Tables trouvées: %', tables_processed;
    RAISE NOTICE 'RLS désactivé sur: %', tables_with_rls;
    RAISE NOTICE '=================================================';
    RAISE NOTICE '🎉 Opération terminée avec succès!';
    RAISE NOTICE '=================================================';
END $$;

-- Réactiver les permissions sur les fonctions RPC si elles existent
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔧 Vérification des fonctions RPC...';
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'virtual_login') THEN
        GRANT EXECUTE ON FUNCTION public.virtual_login(text, text) TO anon;
        RAISE NOTICE '✅ Permissions activées sur: virtual_login';
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'virtual_create_account') THEN
        -- Vérifier la signature exacte de la fonction
        IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'virtual_create_account' AND pronargs = 5) THEN
            GRANT EXECUTE ON FUNCTION public.virtual_create_account(text, text, text, text, uuid) TO anon;
            RAISE NOTICE '✅ Permissions activées sur: virtual_create_account (5 params)';
        ELSIF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'virtual_create_account' AND pronargs = 4) THEN
            GRANT EXECUTE ON FUNCTION public.virtual_create_account(text, text, text, text) TO anon;
            RAISE NOTICE '✅ Permissions activées sur: virtual_create_account (4 params)';
        END IF;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'virtual_list_accounts') THEN
        GRANT EXECUTE ON FUNCTION public.virtual_list_accounts(text) TO anon;
        RAISE NOTICE '✅ Permissions activées sur: virtual_list_accounts';
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'virtual_delete_account') THEN
        GRANT EXECUTE ON FUNCTION public.virtual_delete_account(text, uuid) TO anon;
        RAISE NOTICE '✅ Permissions activées sur: virtual_delete_account';
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'reset_all_sequences') THEN
        GRANT EXECUTE ON FUNCTION public.reset_all_sequences() TO anon;
        RAISE NOTICE '✅ Permissions activées sur: reset_all_sequences';
    END IF;
    
    RAISE NOTICE '🔧 Vérification des fonctions RPC terminée';
END $$;
