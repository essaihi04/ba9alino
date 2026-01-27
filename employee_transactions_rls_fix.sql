-- Créer une politique RLS pour autoriser toutes les opérations sur la table employee_transactions
-- Cela permet aux utilisateurs authentifiés via l'application de gérer les transactions employés

-- Supprimer les politiques existantes s'il y en a
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.employee_transactions;

-- Créer une nouvelle politique qui autorise tout pour les utilisateurs authentifiés
CREATE POLICY "Enable all operations for authenticated users" ON public.employee_transactions
  FOR ALL USING (auth.role() = 'authenticated');

-- Alternative: Autoriser toutes les opérations sans vérification d'authentification
-- (si vous voulez que tout le monde puisse accéder à la table employee_transactions)
-- DROP POLICY IF EXISTS "Enable all operations for everyone" ON public.employee_transactions;
-- CREATE POLICY "Enable all operations for everyone" ON public.employee_transactions
--   FOR ALL USING (true);

-- Vérifier que RLS est activé sur la table employee_transactions
ALTER TABLE public.employee_transactions ENABLE ROW LEVEL SECURITY;
