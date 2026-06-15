-- =====================================================================
--  Ajoute la colonne "opening_balance" (ancien crédit / dette préexistante)
--  à la table suppliers.
--
--  Représente une dette envers le fournisseur ANTÉRIEURE à l'utilisation de
--  l'app. Elle s'ajoute aux dettes calculées depuis les achats reçus dans la
--  page des crédits fournisseurs (SupplierCreditsPage) :
--      reste_dû = opening_balance + total_achats_reçus - total_paiements
--
--  Le front dégrade proprement si la colonne est absente (strip-retry), donc
--  l'app reste fonctionnelle même avant l'exécution de cette migration.
--
--  À exécuter sur le serveur auto-hébergé (Postgres de ba9alino.ma).
-- =====================================================================

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS opening_balance numeric(14,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.suppliers.opening_balance IS
  'Dette préexistante envers le fournisseur (ancien crédit), ajoutée aux dettes des achats.';
