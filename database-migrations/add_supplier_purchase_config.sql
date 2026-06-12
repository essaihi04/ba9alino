-- Ajoute la configuration d'achat (remises par paliers + transport) aux fournisseurs.
-- À exécuter sur le serveur auto-hébergé (ba9alino.ma) via psql / la console SQL du serveur.
--
-- Forme attendue du JSON :
-- {
--   "transport_rate": 0.10,                 -- dh par kg (0 = pas de transport)
--   "discount_tiers": [
--     { "min_qty": 100, "type": "centime", "value": 20, "basis": "kilo" },
--     { "min_qty": 200, "type": "centime", "value": 30, "basis": "kilo" }
--   ]
-- }
--   type  : 'centime' (value/100 dh) | 'dirham' (value dh) | 'percent' (value % du prix)
--   basis : 'kilo' (réduction par kg, sur base_quantity) | 'boite' (réduction par boîte/quantité)
--   min_qty : seuil en unité de base (kg) comparé au cumul mensuel du fournisseur

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS purchase_config jsonb DEFAULT '{}'::jsonb;

-- Colonnes de suivi sur les achats : remise appliquée, transport, palier retenu et cumul
-- mensuel au moment de l'achat (servent à l'affichage et à la régularisation rétroactive).
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transport_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS applied_tier_min_qty numeric,
  ADD COLUMN IF NOT EXISTS monthly_qty_at_save numeric;
