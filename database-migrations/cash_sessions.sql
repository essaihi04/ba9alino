CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  opening_cash NUMERIC(12, 2) NOT NULL DEFAULT 0,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  closing_cash_declared NUMERIC(12, 2),
  closing_note TEXT
);

-- Un employé ne peut avoir qu'une session ouverte
CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_sessions_open_per_employee
ON cash_sessions(employee_id)
WHERE closed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cash_sessions_employee_id ON cash_sessions(employee_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_warehouse_id ON cash_sessions(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_opened_at ON cash_sessions(opened_at);

ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read cash_sessions" ON cash_sessions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert cash_sessions" ON cash_sessions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update cash_sessions" ON cash_sessions
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE TABLE IF NOT EXISTS cash_session_reports (
  session_id UUID PRIMARY KEY REFERENCES cash_sessions(id) ON DELETE CASCADE,
  total_sales NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_cash NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_card NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_transfer NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_credit NUMERIC(12, 2) NOT NULL DEFAULT 0,
  expected_cash NUMERIC(12, 2) NOT NULL DEFAULT 0,
  declared_cash NUMERIC(12, 2) NOT NULL DEFAULT 0,
  difference NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE cash_session_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read cash_session_reports" ON cash_session_reports
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert cash_session_reports" ON cash_session_reports
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Lier les ventes/paiements à une session
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS cash_session_id UUID REFERENCES cash_sessions(id) ON DELETE SET NULL;

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS cash_session_id UUID REFERENCES cash_sessions(id) ON DELETE SET NULL;

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS cash_session_id UUID REFERENCES cash_sessions(id) ON DELETE SET NULL;

-- Ajouter les colonnes employee_id et warehouse_id aux factures pour le suivi
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_cash_session_id ON orders(cash_session_id);
CREATE INDEX IF NOT EXISTS idx_invoices_cash_session_id ON invoices(cash_session_id);
CREATE INDEX IF NOT EXISTS idx_payments_cash_session_id ON payments(cash_session_id);
CREATE INDEX IF NOT EXISTS idx_invoices_employee_id ON invoices(employee_id);
CREATE INDEX IF NOT EXISTS idx_invoices_warehouse_id ON invoices(warehouse_id);
