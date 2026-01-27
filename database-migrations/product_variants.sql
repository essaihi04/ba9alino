-- ============================================
-- TABLE PRODUCT_VARIANTS - Variantes de produits (unités de vente)
-- ============================================
-- Chaque produit peut avoir plusieurs variantes (unité, carton, palette, etc.)
-- Chaque variante a son propre code-barres, prix et stock

CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  
  -- Informations de la variante
  variant_name VARCHAR(100) NOT NULL,  -- Ex: "Unité", "Carton 12", "Sac 25kg"
  unit_type VARCHAR(50) NOT NULL,      -- Ex: "unit", "kg", "litre", "carton", "palette"
  quantity_contained DECIMAL(10, 3) NOT NULL DEFAULT 1,  -- Ex: 1, 12, 25, 50
  
  -- Code-barres unique par variante
  barcode VARCHAR(100) UNIQUE,
  
  -- Prix par catégorie client (A, B, C, D, E)
  purchase_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,  -- Prix d'achat
  price_a DECIMAL(12, 2) NOT NULL DEFAULT 0.00,  -- Prix vente catégorie A
  price_b DECIMAL(12, 2) NOT NULL DEFAULT 0.00,  -- Prix vente catégorie B
  price_c DECIMAL(12, 2) NOT NULL DEFAULT 0.00,  -- Prix vente catégorie C
  price_d DECIMAL(12, 2) NOT NULL DEFAULT 0.00,  -- Prix vente catégorie D
  price_e DECIMAL(12, 2) NOT NULL DEFAULT 0.00,  -- Prix vente catégorie E
  
  -- Stock
  stock DECIMAL(12, 3) NOT NULL DEFAULT 0,  -- Stock disponible pour cette variante
  alert_threshold DECIMAL(12, 3) DEFAULT 10,  -- Seuil d'alerte stock bas
  
  -- Statut
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,  -- Variante par défaut pour ce produit
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Contraintes
  CONSTRAINT product_variants_price_positive CHECK (
    purchase_price >= 0 AND 
    price_a >= 0 AND price_b >= 0 AND price_c >= 0 AND price_d >= 0 AND price_e >= 0
  ),
  CONSTRAINT product_variants_quantity_positive CHECK (quantity_contained > 0),
  CONSTRAINT product_variants_stock_positive CHECK (stock >= 0)
);

-- ============================================
-- INDEXES pour optimiser les performances
-- ============================================

-- Index pour recherche par produit
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);

-- Index pour recherche par code-barres (scan caisse)
CREATE INDEX IF NOT EXISTS idx_product_variants_barcode ON product_variants(barcode);

-- Index pour les variantes actives
CREATE INDEX IF NOT EXISTS idx_product_variants_is_active ON product_variants(is_active);

-- Index composite produit + actif
CREATE INDEX IF NOT EXISTS idx_product_variants_product_active ON product_variants(product_id, is_active);

-- ============================================
-- TRIGGER pour mise à jour automatique de updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_product_variants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_product_variants_updated_at ON product_variants;
CREATE TRIGGER update_product_variants_updated_at 
    BEFORE UPDATE ON product_variants 
    FOR EACH ROW 
    EXECUTE FUNCTION update_product_variants_updated_at();

-- ============================================
-- TRIGGER pour garantir une seule variante par défaut par produit
-- ============================================

CREATE OR REPLACE FUNCTION ensure_single_default_variant()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = TRUE THEN
        UPDATE product_variants 
        SET is_default = FALSE 
        WHERE product_id = NEW.product_id 
          AND id != NEW.id 
          AND is_default = TRUE;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS ensure_single_default_variant ON product_variants;
CREATE TRIGGER ensure_single_default_variant
    BEFORE INSERT OR UPDATE ON product_variants
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_default_variant();

-- ============================================
-- RLS (Row Level Security) - Optionnel
-- ============================================

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre la lecture à tous les utilisateurs authentifiés
CREATE POLICY "Allow read access for authenticated users" ON product_variants
    FOR SELECT
    TO authenticated
    USING (true);

-- Politique pour permettre l'insertion/modification/suppression aux utilisateurs authentifiés
CREATE POLICY "Allow full access for authenticated users" ON product_variants
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================
-- COMMENTAIRES sur la table et les colonnes
-- ============================================

COMMENT ON TABLE product_variants IS 'Variantes de produits - chaque variante représente une unité de vente différente (unité, carton, palette, etc.)';
COMMENT ON COLUMN product_variants.variant_name IS 'Nom de la variante (ex: Unité, Carton 12, Sac 25kg)';
COMMENT ON COLUMN product_variants.unit_type IS 'Type d''unité: unit, kg, litre, carton, palette, sac';
COMMENT ON COLUMN product_variants.quantity_contained IS 'Quantité contenue dans cette variante (ex: 12 pour un carton de 12)';
COMMENT ON COLUMN product_variants.barcode IS 'Code-barres unique pour cette variante - utilisé pour le scan en caisse';
COMMENT ON COLUMN product_variants.is_default IS 'Variante par défaut pour ce produit (une seule par produit)';
