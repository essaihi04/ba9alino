# Guide de Diagnostic du Dashboard

## 🔍 Problèmes Identifiés

### 1. **Stock Négatif (-22)**
**Cause probable** : La colonne `stock` contient des valeurs NULL ou négatives dans la base de données.

**Solution** :
```sql
-- Vérifier les produits avec stock négatif ou NULL
SELECT id, name, stock FROM products WHERE stock < 0 OR stock IS NULL;

-- Corriger les valeurs NULL
UPDATE products SET stock = 0 WHERE stock IS NULL;

-- Corriger les valeurs négatives
UPDATE products SET stock = 0 WHERE stock < 0;
```

### 2. **Produits Faibles = 1000**
**Cause probable** : La requête retourne le nombre total de produits au lieu du nombre de produits avec stock < 10.

**Vérification** :
```sql
-- Vérifier le nombre de produits avec stock < 10
SELECT COUNT(*) FROM products WHERE stock < 10;

-- Vérifier le nombre total de produits
SELECT COUNT(*) FROM products;
```

### 3. **Ventes et Crédits = 0**
**Cause probable** : 
- Les factures n'existent pas pour aujourd'hui
- Les colonnes `total_amount`, `paid_amount` ou `payment_status` n'existent pas
- Les données ne sont pas au bon format

**Vérification** :
```sql
-- Vérifier les colonnes de la table invoices
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'invoices';

-- Vérifier les factures du jour
SELECT id, total_amount, paid_amount, payment_status, created_at 
FROM invoices 
WHERE DATE(created_at) = CURRENT_DATE
LIMIT 10;

-- Vérifier les factures avec crédits
SELECT id, total_amount, paid_amount, payment_status 
FROM invoices 
WHERE payment_status IN ('partial', 'credit')
LIMIT 10;
```

## 📊 Étapes de Diagnostic

### Étape 1 : Vérifier les Tables Existantes
```sql
-- Lister toutes les tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- Vérifier les colonnes de chaque table
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public'
ORDER BY table_name;
```

### Étape 2 : Vérifier les Données
```sql
-- Compter les enregistrements par table
SELECT 'invoices' as table_name, COUNT(*) as count FROM invoices
UNION ALL
SELECT 'products', COUNT(*) FROM products
UNION ALL
SELECT 'purchases', COUNT(*) FROM purchases
UNION ALL
SELECT 'supplier_payments', COUNT(*) FROM supplier_payments
UNION ALL
SELECT 'expenses', COUNT(*) FROM expenses
UNION ALL
SELECT 'employees', COUNT(*) FROM employees;
```

### Étape 3 : Vérifier les Permissions RLS
```sql
-- Vérifier les politiques RLS
SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public';
```

## 🔧 Corrections Recommandées

### 1. Nettoyer les Données
```sql
-- Corriger les stocks NULL ou négatifs
UPDATE products SET stock = COALESCE(stock, 0) WHERE stock IS NULL OR stock < 0;

-- Vérifier l'intégrité des données
ALTER TABLE products ADD CONSTRAINT stock_non_negative CHECK (stock >= 0);
```

### 2. Vérifier les Colonnes Requises
Assurez-vous que les tables ont les colonnes suivantes :

**invoices** :
- `id` (UUID)
- `total_amount` (DECIMAL)
- `paid_amount` (DECIMAL)
- `payment_status` (VARCHAR)
- `created_at` (TIMESTAMP)

**products** :
- `id` (UUID)
- `stock` (INTEGER)

**purchases** :
- `id` (UUID)
- `total_amount` (DECIMAL)
- `status` (VARCHAR)

**supplier_payments** :
- `id` (UUID)
- `amount` (DECIMAL)

**expenses** :
- `id` (UUID)
- `amount` (DECIMAL)
- `date` (DATE)

**employees** :
- `id` (UUID)
- `status` (VARCHAR)

## 📋 Checklist de Vérification

- [ ] Toutes les tables existent dans Supabase
- [ ] Toutes les colonnes requises existent
- [ ] Les données sont présentes dans les tables
- [ ] Les types de données sont corrects
- [ ] Les politiques RLS permettent la lecture
- [ ] Les valeurs NULL sont gérées correctement
- [ ] Les valeurs négatives sont corrigées

## 🐛 Logs à Vérifier

Ouvrez la console du navigateur (F12) et cherchez :

```
✅ Invoices fetched: X
✅ All invoices fetched: X
✅ Products fetched: X
✅ Purchases fetched: X
✅ Payments fetched: X
✅ Expenses fetched: X
✅ Employees fetched: X
```

Et les erreurs :
```
❌ Invoices error: {...}
❌ All invoices error: {...}
etc.
```

## 🔗 Ressources Utiles

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Date Functions](https://www.postgresql.org/docs/current/functions-datetime.html)
- [Supabase RLS Policies](https://supabase.com/docs/guides/auth/row-level-security)

---

**Prochaines Actions** :
1. Exécutez les requêtes SQL de diagnostic
2. Vérifiez les logs du navigateur
3. Corrigez les données/schéma si nécessaire
4. Testez à nouveau le dashboard
