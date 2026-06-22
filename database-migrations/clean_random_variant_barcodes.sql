-- ============================================================
-- Nettoyage des codes-barres ALÉATOIRES générés sur les variantes
-- ============================================================
-- Contexte :
--   L'ancien formulaire produit appelait generateBarcode() (Math.random)
--   pour chaque variante. Ces codes-barres aléatoires polluaient l'espace
--   de scan : en caisse, le scan d'un vrai produit tombait par collision
--   sur la variante d'un AUTRE produit.
--
--   La table physique est `product_variants`.
--   `product_primary_variants` n'est qu'une VUE de `product_variants`.
--
--   Le SEUL code-barres légitime à conserver est celui qui correspond au
--   vrai code-barres du produit (products.sku) — c'est lui que la caisse
--   utilise pour scanner. Tous les autres ont été générés aléatoirement.
-- ============================================================

-- 1) APERÇU (ne modifie rien) : combien de codes-barres aléatoires seront effacés
SELECT count(*) AS barcodes_aleatoires_a_effacer
FROM product_variants pv
JOIN products p ON p.id = pv.product_id
WHERE pv.barcode IS NOT NULL
  AND pv.barcode IS DISTINCT FROM p.sku;

-- 2) NETTOYAGE (transaction) : on garde uniquement le code-barres = products.sku
BEGIN;

UPDATE product_variants pv
SET barcode = NULL
FROM products p
WHERE pv.product_id = p.id
  AND pv.barcode IS NOT NULL
  AND pv.barcode IS DISTINCT FROM p.sku;

COMMIT;

-- 3) VÉRIFICATION : il ne doit plus rester que des codes-barres = sku (ou NULL)
SELECT count(*) AS barcodes_restants
FROM product_variants pv
JOIN products p ON p.id = pv.product_id
WHERE pv.barcode IS NOT NULL
  AND pv.barcode IS DISTINCT FROM p.sku;
