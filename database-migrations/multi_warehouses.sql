CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Créer d'abord les tables
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS warehouse_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  min_alert_level INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT warehouse_stock_unique UNIQUE (warehouse_id, product_id)
);

ALTER TABLE warehouse_stock ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('sale', 'purchase', 'transfer', 'adjustment', 'return')),
  quantity INTEGER NOT NULL,
  source_reference UUID,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  to_warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT stock_transfers_not_same CHECK (from_warehouse_id <> to_warehouse_id)
);

ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT transfer_items_unique UNIQUE (transfer_id, product_id)
);

ALTER TABLE stock_transfer_items ENABLE ROW LEVEL SECURITY;

-- Ajouter la colonne warehouse_id à la table orders
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL;

-- Maintenant créer le dépôt par défaut "stock 1" et migrer les données
INSERT INTO warehouses (id, name, address, is_active)
VALUES (
  gen_random_uuid(),
  'stock 1',
  'Dépôt principal - Stock existant',
  TRUE
)
ON CONFLICT DO NOTHING;  -- Évite les doublons si la migration est réexécutée

-- Récupérer l'ID du dépôt par défaut pour l'utiliser dans les contraintes
DO $$
DECLARE
  v_default_warehouse_id UUID;
BEGIN
  SELECT id INTO v_default_warehouse_id 
  FROM warehouses 
  WHERE name = 'stock 1' 
  LIMIT 1;
  
  -- Mettre à jour les colonnes warehouse_id dans les tables existantes
  IF v_default_warehouse_id IS NOT NULL THEN
    -- Mettre à jour les commandes existantes pour utiliser le dépôt par défaut
    UPDATE orders 
    SET warehouse_id = v_default_warehouse_id 
    WHERE warehouse_id IS NULL;
    
    -- Insérer le stock existant dans warehouse_stock
    INSERT INTO warehouse_stock (warehouse_id, product_id, quantity, min_alert_level)
    SELECT 
      v_default_warehouse_id,
      p.id,
      COALESCE(p.stock, 0),  -- Utiliser le stock actuel du produit
      5  -- Valeur par défaut pour l'alerte
    FROM products p
    WHERE p.id NOT IN (
      SELECT ws.product_id 
      FROM warehouse_stock ws 
      WHERE ws.warehouse_id = v_default_warehouse_id
    )
    ON CONFLICT (warehouse_id, product_id) DO UPDATE
    SET 
      quantity = EXCLUDED.quantity,
      updated_at = NOW();
  END IF;
END $$;

-- Indexes pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_warehouse_stock_warehouse_id ON warehouse_stock(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_stock_product_id ON warehouse_stock(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse_id ON stock_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status ON stock_transfers(status);
CREATE INDEX IF NOT EXISTS idx_orders_warehouse_id ON orders(warehouse_id);

CREATE OR REPLACE FUNCTION ba9alino_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
      AND ur.is_active = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION ba9alino_user_warehouse_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT (ur.permissions->>'warehouse_id')::uuid
  FROM user_roles ur
  WHERE ur.user_id = auth.uid()
    AND ur.is_active = TRUE
  LIMIT 1;
$$;

DROP POLICY IF EXISTS warehouses_select ON warehouses;
CREATE POLICY warehouses_select
  ON warehouses
  FOR SELECT
  USING (
    ba9alino_is_admin()
    OR manager_id = auth.uid()
    OR id = ba9alino_user_warehouse_id()
  );

DROP POLICY IF EXISTS warehouses_write ON warehouses;
CREATE POLICY warehouses_write
  ON warehouses
  FOR ALL
  USING (ba9alino_is_admin())
  WITH CHECK (ba9alino_is_admin());

DROP POLICY IF EXISTS warehouse_stock_select ON warehouse_stock;
CREATE POLICY warehouse_stock_select
  ON warehouse_stock
  FOR SELECT
  USING (
    ba9alino_is_admin()
    OR warehouse_id = ba9alino_user_warehouse_id()
    OR EXISTS (
      SELECT 1 FROM warehouses w
      WHERE w.id = warehouse_stock.warehouse_id
        AND w.manager_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS warehouse_stock_write ON warehouse_stock;
CREATE POLICY warehouse_stock_write
  ON warehouse_stock
  FOR ALL
  USING (ba9alino_is_admin())
  WITH CHECK (ba9alino_is_admin());

DROP POLICY IF EXISTS stock_movements_select ON stock_movements;
CREATE POLICY stock_movements_select
  ON stock_movements
  FOR SELECT
  USING (
    ba9alino_is_admin()
    OR warehouse_id = ba9alino_user_warehouse_id()
    OR EXISTS (
      SELECT 1 FROM warehouses w
      WHERE w.id = stock_movements.warehouse_id
        AND w.manager_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS stock_movements_write ON stock_movements;
CREATE POLICY stock_movements_write
  ON stock_movements
  FOR ALL
  USING (ba9alino_is_admin())
  WITH CHECK (ba9alino_is_admin());

DROP POLICY IF EXISTS stock_transfers_select ON stock_transfers;
CREATE POLICY stock_transfers_select
  ON stock_transfers
  FOR SELECT
  USING (
    ba9alino_is_admin()
    OR EXISTS (
      SELECT 1 FROM warehouses w
      WHERE (w.id = stock_transfers.from_warehouse_id OR w.id = stock_transfers.to_warehouse_id)
        AND w.manager_id = auth.uid()
    )
    OR stock_transfers.from_warehouse_id = ba9alino_user_warehouse_id()
    OR stock_transfers.to_warehouse_id = ba9alino_user_warehouse_id()
  );

DROP POLICY IF EXISTS stock_transfers_write ON stock_transfers;
CREATE POLICY stock_transfers_write
  ON stock_transfers
  FOR ALL
  USING (ba9alino_is_admin())
  WITH CHECK (ba9alino_is_admin());

DROP POLICY IF EXISTS stock_transfer_items_select ON stock_transfer_items;
CREATE POLICY stock_transfer_items_select
  ON stock_transfer_items
  FOR SELECT
  USING (
    ba9alino_is_admin()
    OR EXISTS (
      SELECT 1
      FROM stock_transfers st
      WHERE st.id = stock_transfer_items.transfer_id
        AND (
          st.from_warehouse_id = ba9alino_user_warehouse_id()
          OR st.to_warehouse_id = ba9alino_user_warehouse_id()
          OR EXISTS (
            SELECT 1 FROM warehouses w
            WHERE (w.id = st.from_warehouse_id OR w.id = st.to_warehouse_id)
              AND w.manager_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS stock_transfer_items_write ON stock_transfer_items;
CREATE POLICY stock_transfer_items_write
  ON stock_transfer_items
  FOR ALL
  USING (ba9alino_is_admin())
  WITH CHECK (ba9alino_is_admin());

CREATE OR REPLACE FUNCTION apply_stock_movement(
  p_warehouse_id UUID,
  p_product_id UUID,
  p_type TEXT,
  p_quantity INTEGER,
  p_source_reference UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_user_wh UUID;
  v_is_manager BOOLEAN;
  v_row warehouse_stock%ROWTYPE;
  v_new_qty INTEGER;
BEGIN
  IF p_quantity = 0 THEN
    RAISE EXCEPTION 'quantity cannot be 0';
  END IF;

  IF p_type NOT IN ('sale', 'purchase', 'transfer', 'adjustment', 'return') THEN
    RAISE EXCEPTION 'invalid type: %', p_type;
  END IF;

  v_is_admin := ba9alino_is_admin();
  v_user_wh := ba9alino_user_warehouse_id();

  SELECT EXISTS (
    SELECT 1 FROM warehouses w
    WHERE w.id = p_warehouse_id
      AND w.manager_id = auth.uid()
  ) INTO v_is_manager;

  IF NOT v_is_admin AND NOT v_is_manager AND (v_user_wh IS NULL OR v_user_wh <> p_warehouse_id) THEN
    RAISE EXCEPTION 'not allowed for this warehouse';
  END IF;

  SELECT *
  INTO v_row
  FROM warehouse_stock ws
  WHERE ws.warehouse_id = p_warehouse_id
    AND ws.product_id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO warehouse_stock (warehouse_id, product_id, quantity, min_alert_level, updated_at)
    VALUES (p_warehouse_id, p_product_id, 0, 0, NOW())
    RETURNING * INTO v_row;
  END IF;

  v_new_qty := v_row.quantity + p_quantity;
  IF v_new_qty < 0 THEN
    RAISE EXCEPTION 'insufficient stock';
  END IF;

  UPDATE warehouse_stock
  SET quantity = v_new_qty,
      updated_at = NOW()
  WHERE id = v_row.id;

  INSERT INTO stock_movements (
    warehouse_id,
    product_id,
    type,
    quantity,
    source_reference,
    created_by,
    created_at
  ) VALUES (
    p_warehouse_id,
    p_product_id,
    p_type,
    p_quantity,
    p_source_reference,
    auth.uid(),
    NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION apply_stock_movement(UUID, UUID, TEXT, INTEGER, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION complete_stock_transfer(p_transfer_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer stock_transfers%ROWTYPE;
  v_is_admin BOOLEAN;
  v_is_manager_from BOOLEAN;
BEGIN
  SELECT *
  INTO v_transfer
  FROM stock_transfers st
  WHERE st.id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'transfer not found';
  END IF;

  IF v_transfer.status <> 'pending' THEN
    RAISE EXCEPTION 'transfer not pending';
  END IF;

  v_is_admin := ba9alino_is_admin();

  SELECT EXISTS (
    SELECT 1 FROM warehouses w
    WHERE w.id = v_transfer.from_warehouse_id
      AND w.manager_id = auth.uid()
  ) INTO v_is_manager_from;

  IF NOT v_is_admin AND NOT v_is_manager_from THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  PERFORM apply_stock_movement(
    v_transfer.from_warehouse_id,
    sti.product_id,
    'transfer',
    -sti.quantity,
    v_transfer.id
  )
  FROM stock_transfer_items sti
  WHERE sti.transfer_id = v_transfer.id;

  PERFORM apply_stock_movement(
    v_transfer.to_warehouse_id,
    sti.product_id,
    'transfer',
    sti.quantity,
    v_transfer.id
  )
  FROM stock_transfer_items sti
  WHERE sti.transfer_id = v_transfer.id;

  UPDATE stock_transfers
  SET status = 'completed',
      completed_at = NOW()
  WHERE id = v_transfer.id;
END;
$$;

GRANT EXECUTE ON FUNCTION complete_stock_transfer(UUID) TO authenticated;
