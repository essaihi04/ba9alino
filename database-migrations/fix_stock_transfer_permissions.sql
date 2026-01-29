-- Fonction simplifiée pour compléter les transferts de stock
-- Crée une version qui fonctionne sans vérifications de permissions complexes

CREATE OR REPLACE FUNCTION complete_stock_transfer_simple(p_transfer_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer stock_transfers%ROWTYPE;
BEGIN
  -- Vérifier si le transfert existe
  SELECT *
  INTO v_transfer
  FROM stock_transfers st
  WHERE st.id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'transfer not found';
  END IF;

  -- Vérifier si le transfert est en attente
  IF v_transfer.status <> 'pending' THEN
    RAISE EXCEPTION 'transfer not pending';
  END IF;

  -- Mettre à jour manuellement le stock dans les deux entrepôts
  -- Soustraire du stock source
  UPDATE warehouse_stock ws
  SET quantity = ws.quantity - sti.quantity,
      updated_at = NOW()
  FROM stock_transfer_items sti
  WHERE ws.warehouse_id = v_transfer.from_warehouse_id
    AND ws.product_id = sti.product_id
    AND sti.transfer_id = v_transfer.id;

  -- Ajouter au stock destination
  INSERT INTO warehouse_stock (warehouse_id, product_id, quantity, min_alert_level, updated_at)
  SELECT 
    v_transfer.to_warehouse_id,
    sti.product_id,
    sti.quantity,
    5, -- valeur par défaut
    NOW()
  FROM stock_transfer_items sti
  WHERE sti.transfer_id = v_transfer.id
  ON CONFLICT (warehouse_id, product_id) 
  DO UPDATE SET 
    quantity = warehouse_stock.quantity + EXCLUDED.quantity,
    updated_at = NOW();

  -- Créer les mouvements de stock
  INSERT INTO stock_movements (warehouse_id, product_id, type, quantity, source_reference, created_by, created_at)
  SELECT 
    v_transfer.from_warehouse_id,
    sti.product_id,
    'transfer',
    -sti.quantity,
    v_transfer.id,
    auth.uid(),
    NOW()
  FROM stock_transfer_items sti
  WHERE sti.transfer_id = v_transfer.id;

  INSERT INTO stock_movements (warehouse_id, product_id, type, quantity, source_reference, created_by, created_at)
  SELECT 
    v_transfer.to_warehouse_id,
    sti.product_id,
    'transfer',
    sti.quantity,
    v_transfer.id,
    auth.uid(),
    NOW()
  FROM stock_transfer_items sti
  WHERE sti.transfer_id = v_transfer.id;

  -- Marquer le transfert comme complété
  UPDATE stock_transfers
  SET status = 'completed',
      completed_at = NOW()
  WHERE id = v_transfer.id;
END;
$$;

-- Donner les permissions d'exécution
GRANT EXECUTE ON FUNCTION complete_stock_transfer_simple(UUID) TO authenticated;
