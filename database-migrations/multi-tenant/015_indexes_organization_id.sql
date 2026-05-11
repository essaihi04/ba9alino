-- ============================================================================
-- 015 — Indexes on organization_id for all tenant tables
--
-- Without these indexes, every RLS policy check (organization_id = current_org_id())
-- triggers a full sequential scan. This is the root cause of slow page loads.
-- Each index turns O(n) scans into O(log n) lookups.
-- CONCURRENTLY avoids locking tables during creation (safe for production).
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_org_id
  ON public.products (organization_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_variants_org_id
  ON public.product_variants (organization_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_org_id
  ON public.clients (organization_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_suppliers_org_id
  ON public.suppliers (organization_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employees_org_id
  ON public.employees (organization_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_warehouses_org_id
  ON public.warehouses (organization_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_org_id
  ON public.orders (organization_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_org_id
  ON public.order_items (organization_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_org_id
  ON public.invoices (organization_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoice_items_org_id
  ON public.invoice_items (organization_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_org_id
  ON public.payments (organization_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchases_org_id
  ON public.purchases (organization_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_items_org_id
  ON public.purchase_items (organization_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_org_id
  ON public.stock (organization_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_warehouse_stock_org_id
  ON public.warehouse_stock (organization_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cash_sessions_org_id
  ON public.cash_sessions (organization_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expenses_org_id
  ON public.expenses (organization_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_coupons_org_id
  ON public.coupons (organization_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_promotions_org_id
  ON public.promotions (organization_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_accounts_org_id
  ON public.user_accounts (organization_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_virtual_accounts_org_id
  ON public.virtual_accounts (organization_id);

-- Composite indexes for the most common POS/dashboard queries
-- (organization_id + is_active is a very common filter pair)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_org_active
  ON public.products (organization_id, is_active);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_org_created
  ON public.invoices (organization_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_org_created
  ON public.orders (organization_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_org_product
  ON public.stock (organization_id, product_id);
