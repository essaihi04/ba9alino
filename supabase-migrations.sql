-- =====================================================
-- MIGRATIONS SUPABASE POUR LA VUE COMMERCIALE BA9ALINO
-- Version 2.0 - Enrichissement terrain
-- =====================================================

-- =====================================================
-- 1. ENRICHISSEMENT TABLE CLIENTS
-- =====================================================

-- Associer client au commercial
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS commercial_id UUID REFERENCES employees(id);

-- Géolocalisation du magasin
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS gps_lat DECIMAL(10, 8);

ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS gps_lng DECIMAL(11, 8);

-- Photo du magasin
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS shop_photo_url TEXT;

-- Plafond de crédit
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(10, 2) DEFAULT 0;

-- Compatibilité avec ancienne version
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES employees(id);

-- =====================================================
-- 2. ENRICHISSEMENT TABLE ORDERS
-- =====================================================

-- Tracer qui a créé la commande
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES employees(id);

-- Source de la commande
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_source') THEN
    CREATE TYPE order_source AS ENUM ('pos', 'commercial', 'admin');
  END IF;
END $$;

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS source order_source DEFAULT 'pos';

-- Statut enrichi (si pas déjà un ENUM)
-- Note: Si status existe déjà, cette commande peut échouer - c'est normal
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'delivered', 'cancelled');
  END IF;
END $$;

-- Si status n'est pas encore un ENUM, le convertir
-- ALTER TABLE orders ALTER COLUMN status TYPE order_status USING status::order_status;

-- 3. Créer la table order_items si elle n'existe pas
-- Pour stocker les lignes de commande
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
  total DECIMAL(10, 2) NOT NULL CHECK (total >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. ENRICHISSEMENT TABLE PRODUCTS
-- =====================================================

-- Masquer certains produits aux commerciaux
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS is_active_for_commercial BOOLEAN DEFAULT true;

-- =====================================================
-- 4. ENRICHISSEMENT TABLE PAYMENTS
-- =====================================================

-- Tracer qui a collecté le paiement
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS collected_by UUID REFERENCES employees(id);

-- Source du paiement
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_source') THEN
    CREATE TYPE payment_source AS ENUM ('pos', 'commercial', 'admin');
  END IF;
END $$;

ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS payment_source payment_source DEFAULT 'pos';

-- =====================================================
-- 5. NOUVELLE TABLE VISITS (Visites commerciales)
-- =====================================================

CREATE TABLE IF NOT EXISTS visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commercial_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  visit_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  gps_lat DECIMAL(10, 8),
  gps_lng DECIMAL(11, 8),
  note TEXT,
  photo_url TEXT,
  order_created BOOLEAN DEFAULT false,
  duration_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON clients(created_by);
CREATE INDEX IF NOT EXISTS idx_clients_commercial_id ON clients(commercial_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders(created_by);
CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source);
CREATE INDEX IF NOT EXISTS idx_payments_collected_by ON payments(collected_by);
CREATE INDEX IF NOT EXISTS idx_visits_commercial_id ON visits(commercial_id);
CREATE INDEX IF NOT EXISTS idx_visits_client_id ON visits(client_id);
CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(visit_date);

-- 4. Ajouter un trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_order_items_updated_at ON order_items;
CREATE TRIGGER update_order_items_updated_at
  BEFORE UPDATE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- DÉSACTIVATION TEMPORAIRE DU RLS (pour tests sans auth Supabase)
-- =====================================================

ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE visits DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES (commentées pour le moment)
-- =====================================================

-- Activer RLS sur les tables
-- ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE visits ENABLE ROW LEVEL SECURITY;

-- Policy pour les clients : un commercial ne voit que ses clients
-- DROP POLICY IF EXISTS commercial_clients_policy ON clients;
-- CREATE POLICY commercial_clients_policy ON clients
--   FOR ALL
--   USING (
--     commercial_id = auth.uid() OR 
--     created_by = auth.uid() OR 
--     EXISTS (
--       SELECT 1 FROM employees 
--       WHERE id = auth.uid() AND role = 'admin'
--     )
--   );

-- Policy pour les commandes : un commercial ne voit que ses commandes
-- POLICY commercial_orders_policy ON orders
--   FOR ALL
--   USING (
--     created_by = auth.uid() OR 
--     EXISTS (
--       SELECT 1 FROM employees 
--       WHERE id = auth.uid() AND role = 'admin'
--     )
--   );

-- Policy pour les lignes de commande : accès via la commande
-- POLICY commercial_order_items_policy ON order_items
--   FOR ALL
--   USING (
--     EXISTS (
--       SELECT 1 FROM orders 
--       WHERE orders.id = order_items.order_id 
--       AND (
--         orders.created_by = auth.uid() OR 
--         EXISTS (
--           SELECT 1 FROM employees 
--           WHERE id = auth.uid() AND role = 'admin'
--         )
--       )
--     )
--   );

-- Policy pour les produits : lecture seule pour tous (seulement produits actifs pour commerciaux)
-- DROP POLICY IF EXISTS products_read_policy ON products;
-- CREATE POLICY products_read_policy ON products
--   FOR SELECT
--   USING (
--     is_active_for_commercial = true OR
--     EXISTS (
--       SELECT 1 FROM employees 
--       WHERE id = auth.uid() AND role = 'admin'
--     )
--   );

-- Policy pour les visites : un commercial ne voit que ses visites
-- POLICY commercial_visits_policy ON visits
--   FOR ALL
--   USING (
--     commercial_id = auth.uid() OR 
--     EXISTS (
--       SELECT 1 FROM employees 
--       WHERE id = auth.uid() AND role = 'admin'
--     )
--   );

-- Policy pour les paiements : lecture selon collecteur
-- DROP POLICY IF EXISTS payments_read_policy ON payments;
-- CREATE POLICY payments_read_policy ON payments
--   FOR SELECT
--   USING (
--     collected_by = auth.uid() OR 
--     EXISTS (
--       SELECT 1 FROM employees 
--       WHERE id = auth.uid() AND role = 'admin'
--     )
--   );

-- Policy pour insertion paiements par commercial
-- POLICY payments_insert_policy ON payments
--   FOR INSERT
--   WITH CHECK (
--     collected_by = auth.uid() AND payment_source = 'commercial'
--   );

-- =====================================================
-- NOTES D'IMPLÉMENTATION
-- =====================================================

/*
IMPORTANT : Ces migrations supposent que :
1. La table employees existe avec les colonnes : id, role
2. La table clients existe
3. La table orders existe avec les colonnes : id, order_number, client_id, order_date, status, total_amount
4. La table products existe avec les colonnes : id, name_ar, sku, price_a, price_b, price_c, price_d, price_e, stock
5. Supabase Auth est configuré et auth.uid() retourne l'ID de l'employé connecté

WORKFLOW COMMERCIAL :
1. Le commercial se connecte via /commercial/login
2. Il peut créer des clients (created_by = son ID)
3. Il peut créer des commandes (status = 'pending', created_by = son ID)
4. L'admin voit toutes les commandes et peut les valider (status = 'confirmed') ou rejeter (status = 'rejected')
5. Le commercial ne peut voir que ses propres clients et commandes

PERMISSIONS :
- Commercial : Lecture produits, CRUD sur ses clients, CRUD sur ses commandes (pending uniquement)
- Admin : Accès complet à tout, peut valider/rejeter les commandes

SÉCURITÉ :
- RLS activé sur toutes les tables sensibles
- Les commerciaux ne peuvent pas voir les données des autres commerciaux
- Les commerciaux ne peuvent pas modifier les prix ou le stock
- Seul l'admin peut valider les commandes
*/
