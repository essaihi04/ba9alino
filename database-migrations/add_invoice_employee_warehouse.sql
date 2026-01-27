-- Ajouter les colonnes employee_id et warehouse_id à la table invoices
-- Exécuter cette migration dans Supabase SQL Editor

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL;

-- Créer les index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_invoices_employee_id ON invoices(employee_id);
CREATE INDEX IF NOT EXISTS idx_invoices_warehouse_id ON invoices(warehouse_id);

-- Mettre à jour les factures existantes avec des valeurs par défaut si nécessaire
-- Optionnel: vous pouvez mettre à jour les factures existantes avec des valeurs par défaut
-- UPDATE invoices SET employee_id = (SELECT id FROM employees LIMIT 1) WHERE employee_id IS NULL;
-- UPDATE invoices SET warehouse_id = (SELECT id FROM warehouses LIMIT 1) WHERE warehouse_id IS NULL;
