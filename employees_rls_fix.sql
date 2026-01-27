-- Créer une politique RLS pour autoriser toutes les opérations sur la table employees
-- Cela permet aux utilisateurs authentifiés via l'application de gérer les employés

-- Supprimer les politiques existantes s'il y en a
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.employees;

-- Créer une nouvelle politique qui autorise tout pour les utilisateurs authentifiés
CREATE POLICY "Enable all operations for authenticated users" ON public.employees
  FOR ALL USING (auth.role() = 'authenticated');

-- Alternative: Autoriser toutes les opérations sans vérification d'authentification
-- (si vous voulez que tout le monde puisse accéder à la table employees)
-- DROP POLICY IF EXISTS "Enable all operations for everyone" ON public.employees;
-- CREATE POLICY "Enable all operations for everyone" ON public.employees
--   FOR ALL USING (true);

-- Vérifier que RLS est activé sur la table employees
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
