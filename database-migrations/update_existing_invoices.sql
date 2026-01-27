-- Mettre à jour les factures existantes avec des valeurs par défaut
-- Exécuter cette migration dans Supabase SQL Editor

-- Mettre à jour les factures existantes avec le premier employé et le premier entrepôt disponibles
UPDATE invoices 
SET 
  employee_id = (SELECT id FROM employees LIMIT 1),
  warehouse_id = (SELECT id FROM warehouses LIMIT 1)
WHERE 
  employee_id IS NULL 
  AND warehouse_id IS NULL;

-- Optionnel: Si vous voulez assigner un employé spécifique (par exemple le premier admin)
-- UPDATE invoices 
-- SET employee_id = (SELECT id FROM employees WHERE role = 'admin' LIMIT 1)
-- WHERE employee_id IS NULL;

-- Optionnel: Si vous voulez assigner un entrepôt spécifique (par exemple le dépôt principal)
-- UPDATE invoices 
-- SET warehouse_id = (SELECT id FROM warehouses WHERE name LIKE '%stock%' OR name LIKE '%principal%' LIMIT 1)
-- WHERE warehouse_id IS NULL;
