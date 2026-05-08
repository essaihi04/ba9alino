-- ============================================================
-- Ba9alino — Schéma complet pour PostgreSQL (nouveau serveur)
-- Généré depuis information_schema + interfaces TypeScript
-- ============================================================

-- Extensions requises
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- EMPLOYEES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    national_id VARCHAR(50),
    salary NUMERIC,
    monthly_salary NUMERIC,
    advance_limit NUMERIC,
    hire_date DATE,
    role VARCHAR(50) NOT NULL DEFAULT 'custom',
    custom_role VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    password_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- USER_ACCOUNTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID,
    employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    username VARCHAR(100) NOT NULL,
    full_name VARCHAR(255),
    email VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'employee',
    is_active BOOLEAN DEFAULT true,
    password_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- CLIENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    company_name_ar VARCHAR(255) NOT NULL,
    company_name_en VARCHAR(255),
    company_logo_url TEXT,
    industry_ar VARCHAR(255),
    industry_en VARCHAR(255),
    description_ar TEXT,
    description_en TEXT,
    tax_id VARCHAR(50),
    registration_number VARCHAR(50),
    contact_person_name VARCHAR(255),
    contact_person_email VARCHAR(255),
    contact_person_phone VARCHAR(20),
    billing_address_ar VARCHAR(500),
    billing_address_en VARCHAR(500),
    shipping_address_ar VARCHAR(500),
    shipping_address_en VARCHAR(500),
    address TEXT,
    city VARCHAR(255),
    state VARCHAR(255),
    postal_code VARCHAR(20),
    country VARCHAR(255),
    website_url TEXT,
    subscription_tier VARCHAR(10),
    subscription_tier_old VARCHAR(50) DEFAULT 'basic',
    subscription_status VARCHAR(50) DEFAULT 'active',
    credit_limit NUMERIC,
    payment_terms_days INTEGER DEFAULT 30,
    is_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    commercial_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    created_by UUID,
    gps_lat NUMERIC,
    gps_lng NUMERIC,
    shop_photo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- WAREHOUSES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    name_ar VARCHAR(255),
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(100),
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    description_ar TEXT,
    description_en TEXT,
    category_ar VARCHAR(255),
    category_en VARCHAR(255),
    unit VARCHAR(50),
    price NUMERIC NOT NULL DEFAULT 0,
    price_b NUMERIC DEFAULT 0,
    price_c NUMERIC DEFAULT 0,
    price_d NUMERIC DEFAULT 0,
    price_e NUMERIC DEFAULT 0,
    cost_price NUMERIC DEFAULT 0,
    tax_rate NUMERIC DEFAULT 0,
    image_url TEXT,
    barcode VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    is_active_for_commercial BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PRODUCT_VARIANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    variant_name_ar VARCHAR(255),
    variant_name_en VARCHAR(255),
    sku VARCHAR(100),
    price NUMERIC DEFAULT 0,
    price_b NUMERIC DEFAULT 0,
    price_c NUMERIC DEFAULT 0,
    price_d NUMERIC DEFAULT 0,
    price_e NUMERIC DEFAULT 0,
    cost_price NUMERIC DEFAULT 0,
    barcode VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- STOCK
-- ============================================================
CREATE TABLE IF NOT EXISTS public.stock (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity_in_stock NUMERIC DEFAULT 0,
    quantity_reserved NUMERIC DEFAULT 0,
    quantity_available NUMERIC DEFAULT 0,
    reorder_level NUMERIC DEFAULT 0,
    is_low_stock BOOLEAN DEFAULT false,
    is_out_of_stock BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- WAREHOUSE_STOCK
-- ============================================================
CREATE TABLE IF NOT EXISTS public.warehouse_stock (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity NUMERIC DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(warehouse_id, product_id)
);

-- ============================================================
-- SUPPLIERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    name_ar VARCHAR(255),
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    tax_id VARCHAR(50),
    balance NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PURCHASES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reference_number VARCHAR(100),
    status VARCHAR(50) DEFAULT 'received',
    subtotal NUMERIC DEFAULT 0,
    tax_amount NUMERIC DEFAULT 0,
    total_amount NUMERIC DEFAULT 0,
    amount_paid NUMERIC DEFAULT 0,
    payment_method VARCHAR(50),
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PURCHASE_ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.purchase_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
    quantity NUMERIC NOT NULL,
    unit_cost NUMERIC NOT NULL,
    total_cost NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- SUPPLIER_PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.supplier_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method VARCHAR(50) DEFAULT 'cash',
    reference_number VARCHAR(100),
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(100),
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_delivery_date DATE,
    status VARCHAR(50) DEFAULT 'pending',
    payment_status VARCHAR(50) DEFAULT 'unpaid',
    shipping_status VARCHAR(50) DEFAULT 'pending',
    subtotal NUMERIC DEFAULT 0,
    tax_amount NUMERIC DEFAULT 0,
    shipping_cost NUMERIC DEFAULT 0,
    discount_amount NUMERIC DEFAULT 0,
    total_amount NUMERIC DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'DZD',
    source VARCHAR(50) DEFAULT 'pos',
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ORDER_ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
    quantity NUMERIC NOT NULL,
    unit_price NUMERIC NOT NULL,
    total_price NUMERIC NOT NULL,
    discount_amount NUMERIC DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INVOICES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(100),
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    status VARCHAR(50) DEFAULT 'draft',
    subtotal NUMERIC DEFAULT 0,
    tax_amount NUMERIC DEFAULT 0,
    total_amount NUMERIC DEFAULT 0,
    amount_paid NUMERIC DEFAULT 0,
    amount_due NUMERIC DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'DZD',
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INVOICE_ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
    description_ar TEXT,
    quantity NUMERIC NOT NULL,
    unit_price NUMERIC NOT NULL,
    total_price NUMERIC NOT NULL,
    discount_amount NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    amount NUMERIC NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'cash',
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reference_number VARCHAR(100),
    notes TEXT,
    status VARCHAR(50) DEFAULT 'completed',
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- CASH_SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cash_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES public.employees(id),
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
    opening_cash NUMERIC NOT NULL DEFAULT 0,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ,
    closing_cash_declared NUMERIC,
    closing_note TEXT
);

-- ============================================================
-- CASH_SESSION_REPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cash_session_reports (
    session_id UUID NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
    total_sales NUMERIC NOT NULL DEFAULT 0,
    total_cash NUMERIC NOT NULL DEFAULT 0,
    total_card NUMERIC NOT NULL DEFAULT 0,
    total_transfer NUMERIC NOT NULL DEFAULT 0,
    total_credit NUMERIC NOT NULL DEFAULT 0,
    expected_cash NUMERIC NOT NULL DEFAULT 0,
    declared_cash NUMERIC NOT NULL DEFAULT 0,
    difference NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- EXPENSES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    category VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'cash',
    employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- EMPLOYEE_TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employee_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    transaction_type VARCHAR(50) NOT NULL,
    amount NUMERIC NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'cash',
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- VISITS (commercial)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    commercial_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    visit_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    gps_lat NUMERIC,
    gps_lng NUMERIC,
    note TEXT,
    photo_url TEXT,
    order_created BOOLEAN DEFAULT false,
    duration_minutes INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- AUDIT_LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    created_by UUID,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- COMPANY_INFO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.company_info (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ar TEXT NOT NULL,
    name_en TEXT,
    address_ar TEXT,
    address_en TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    logo_url TEXT,
    tax_id TEXT,
    commercial_register TEXT,
    description_ar TEXT,
    description_en TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- COUPONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,
    description_ar TEXT,
    description_en TEXT,
    discount_type VARCHAR(20) NOT NULL,
    discount_value NUMERIC NOT NULL,
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    usage_limit_per_client INTEGER,
    min_order_amount NUMERIC,
    max_discount_amount NUMERIC,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- COUPON_USAGE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.coupon_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coupon_id UUID NOT NULL REFERENCES public.coupons(id),
    client_id UUID NOT NULL REFERENCES public.clients(id),
    order_id UUID REFERENCES public.orders(id),
    discount_amount NUMERIC NOT NULL,
    used_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- VIRTUAL_ACCOUNTS (pour les comptes virtuels)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.virtual_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee',
    employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PERMISSIONS (roles)
-- ============================================================
GRANT ALL ON SCHEMA public TO ba9alino_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ba9alino_anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ba9alino_anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ba9alino_anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ba9alino_anon;

-- ============================================================
-- RPC: virtual_login
-- ============================================================
CREATE OR REPLACE FUNCTION public.virtual_login(p_name TEXT, p_password TEXT)
RETURNS TABLE(id UUID, role TEXT, name TEXT, employee_id UUID)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT va.employee_id AS id, va.role, va.name, va.employee_id
    FROM public.virtual_accounts va
    WHERE va.name = LOWER(TRIM(p_name))
      AND va.is_active = true
      AND va.password_hash = crypt(p_password, va.password_hash);
END;
$$;
GRANT EXECUTE ON FUNCTION public.virtual_login(TEXT, TEXT) TO anon, ba9alino_anon;

-- ============================================================
-- RPC: user_accounts_login
-- ============================================================
CREATE OR REPLACE FUNCTION public.user_accounts_login(p_name TEXT, p_password TEXT)
RETURNS TABLE(id UUID, role TEXT, name TEXT, employee_id UUID, email TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_name TEXT := LOWER(TRIM(COALESCE(p_name, '')));
BEGIN
    IF v_name = '' OR COALESCE(p_password, '') = '' THEN RETURN; END IF;
    RETURN QUERY
    SELECT ua.id, ua.role::TEXT, COALESCE(ua.full_name, ua.username, v_name),
           ua.employee_id, ua.email
    FROM public.user_accounts ua
    WHERE LOWER(TRIM(ua.username)) = v_name
      AND COALESCE(ua.is_active, true) = true
      AND ua.password_hash IS NOT NULL
      AND ua.password_hash = crypt(p_password, ua.password_hash)
    LIMIT 1;
END;
$$;
GRANT EXECUTE ON FUNCTION public.user_accounts_login(TEXT, TEXT) TO anon, ba9alino_anon;
