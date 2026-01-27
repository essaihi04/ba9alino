# 📱 Vue Commerciale Ba9alino - Documentation Complète

## 🎯 Vue d'ensemble

La **Vue Commerciale** est une interface mobile-first intégrée au système Ba9alino qui permet aux commerciaux terrain de :
- Consulter les produits et prix en temps réel
- Gérer leurs clients
- Créer des commandes qui nécessitent validation admin
- Travailler en mobilité avec une interface tactile optimisée

**Architecture** : Même base de données, même backend, interface séparée avec permissions limitées.

---

## 🏗️ Architecture Technique

### Base de données commune
- **Supabase** : Base de données PostgreSQL partagée
- **Tables utilisées** :
  - `employees` (avec role = 'commercial')
  - `clients` (avec created_by pour traçabilité)
  - `orders` (avec created_by et status)
  - `order_items` (lignes de commande)
  - `products` (lecture seule)

### Authentification
- Login séparé : `/commercial/login`
- Stockage localStorage : `commercial_id`, `commercial_name`, `commercial_role`
- Pas d'intégration avec Supabase Auth (authentification simple par phone/password)

---

## 📋 Permissions et Restrictions

### ✅ Ce que le commercial PEUT faire :
1. **Produits**
   - Voir tous les produits
   - Voir tous les prix (A, B, C, D, E)
   - Voir le stock disponible
   - Filtrer par catégorie
   - Rechercher par nom/SKU

2. **Clients**
   - Créer de nouveaux clients
   - Voir uniquement SES clients (created_by = son ID)
   - Modifier les informations de ses clients

3. **Commandes**
   - Créer des commandes (status = 'pending')
   - Voir uniquement SES commandes
   - Suivre le statut de ses commandes

4. **Encaissements**
   - Enregistrer les paiements terrain (à implémenter)

### ❌ Ce que le commercial NE PEUT PAS faire :
- Modifier les prix des produits
- Modifier le stock
- Voir les clients des autres commerciaux
- Voir les commandes des autres commerciaux
- Valider ses propres commandes
- Accéder au dashboard admin
- Voir les marges et bénéfices

---

## 🚀 Pages Créées

### 1. `/commercial/login` - Page de connexion
**Fichier** : `src/pages/commercial/CommercialLoginPage.tsx`

**Fonctionnalités** :
- Connexion par téléphone + mot de passe
- Vérification du rôle 'commercial' et statut 'active'
- Interface mobile-first avec gros boutons
- Redirection vers dashboard après login

**Sécurité** :
- Vérification côté serveur du rôle
- Stockage sécurisé dans localStorage
- TODO : Implémenter bcrypt pour les mots de passe

---

### 2. `/commercial/dashboard` - Dashboard commercial
**Fichier** : `src/pages/commercial/CommercialDashboardPage.tsx`

**Statistiques affichées** :
- 📦 Commandes du jour
- ⏰ Commandes en attente
- 💰 Chiffre d'affaires du jour
- 👥 Nombre de clients

**Actions rapides** :
- Créer un nouveau client
- Créer une commande
- Voir les produits
- Voir mes commandes

---

### 3. `/commercial/products` - Catalogue produits
**Fichier** : `src/pages/commercial/CommercialProductsPage.tsx`

**Fonctionnalités** :
- Liste complète des produits
- Filtrage par catégorie
- Recherche par nom/SKU
- Affichage des 4 prix (A, B, C, D)
- Indicateur de stock (couleur selon disponibilité)
- **Lecture seule** : Aucune modification possible

---

### 4. `/commercial/clients` - Gestion clients
**Fichier** : `src/pages/commercial/CommercialClientsPage.tsx`

**Fonctionnalités** :
- Liste de SES clients uniquement
- Recherche par nom/téléphone
- Ajout de nouveau client (formulaire complet)
- Bouton "Créer commande" direct depuis la fiche client
- Affichage de la fiche client (nom, téléphone, adresse, tier)

**Champs du formulaire client** :
- Nom de la société (AR + EN)
- Nom du contact
- Téléphone (requis)
- Email
- Adresse
- Ville
- Tier de prix (A, B, C, D, E)

---

### 5. `/commercial/orders` - Mes commandes
**Fichier** : `src/pages/commercial/CommercialOrdersPage.tsx`

**Fonctionnalités** :
- Liste de SES commandes uniquement
- Filtres : Toutes / En attente / Confirmées / Rejetées
- Statuts avec badges colorés :
  - 🟡 **Pending** : En attente de validation admin
  - 🟢 **Confirmed** : Validée par l'admin
  - 🔴 **Rejected** : Rejetée par l'admin
  - 🔵 **Completed** : Complétée
- Affichage : Numéro, client, montant, date, statut

---

### 6. `/commercial/orders/new` - Créer une commande
**Fichier** : `src/pages/commercial/CommercialNewOrderPage.tsx`

**Workflow** :
1. **Sélectionner le client** (obligatoire)
   - Liste déroulante de SES clients
   - Affichage du tier de prix du client
   
2. **Ajouter des produits**
   - Recherche produit
   - Prix automatique selon le tier du client
   - Ajout au panier avec quantité
   - Modification quantité (+/-)
   
3. **Valider la commande**
   - Récapitulatif : produits, quantités, prix, total
   - Création avec status = 'pending'
   - Génération automatique du numéro de commande
   - Notification : "En attente de validation admin"

**Logique métier** :
- Le prix appliqué dépend du tier du client (A→price_a, B→price_b, etc.)
- Stock affiché mais pas vérifié (l'admin validera)
- Commande enregistrée immédiatement en BDD
- Stock non déduit tant que non validée

---

## 🔐 Page Admin - Gestion des commandes

### `/commercial-orders` - Validation des commandes
**Fichier** : `src/pages/CommercialOrdersManagementPage.tsx`

**Pour l'administrateur uniquement**

**Fonctionnalités** :
- Vue de TOUTES les commandes commerciales
- Filtres : En attente / Confirmées / Rejetées / Toutes
- Badge "X commandes en attente" visible
- Détails complets de chaque commande :
  - Informations du commercial (nom, téléphone)
  - Informations du client (société, tier)
  - Liste des produits (nom, SKU, quantité, prix unitaire, total)
  - Montant total

**Actions admin** :
- ✅ **Confirmer** : Change status → 'confirmed'
- ❌ **Rejeter** : Change status → 'rejected'
- 👁️ **Voir détails** : Modal avec toutes les infos

**Workflow de validation** :
1. Admin reçoit notification (badge jaune)
2. Admin ouvre la commande
3. Admin vérifie :
   - Stock disponible
   - Prix corrects
   - Client valide
4. Admin confirme ou rejette
5. Commercial voit le changement de statut en temps réel

---

## 🗄️ Migrations Supabase

**Fichier** : `supabase-migrations.sql`

### Tables modifiées :
```sql
-- Ajout de created_by dans clients
ALTER TABLE clients ADD COLUMN created_by UUID REFERENCES employees(id);

-- Ajout de created_by dans orders
ALTER TABLE orders ADD COLUMN created_by UUID REFERENCES employees(id);
```

### Nouvelle table :
```sql
-- Table order_items pour les lignes de commande
CREATE TABLE order_items (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  product_id UUID REFERENCES products(id),
  quantity INTEGER,
  unit_price DECIMAL(10, 2),
  total DECIMAL(10, 2),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Row Level Security (RLS) :
```sql
-- Commercial voit uniquement ses clients
CREATE POLICY commercial_clients_policy ON clients
  FOR ALL USING (created_by = auth.uid() OR role = 'admin');

-- Commercial voit uniquement ses commandes
CREATE POLICY commercial_orders_policy ON orders
  FOR ALL USING (created_by = auth.uid() OR role = 'admin');

-- Produits en lecture seule pour tous
CREATE POLICY products_read_policy ON products
  FOR SELECT USING (true);
```

---

## 🎨 Design Mobile-First

### Principes UI/UX :
- **Gros boutons tactiles** (min 44x44px)
- **Navigation simple** avec bouton retour
- **Headers colorés** avec gradient
- **Cards avec ombres** pour les listes
- **Badges colorés** pour les statuts
- **Bottom sheet** pour le panier (commande)
- **Modals full-screen** sur mobile

### Palette de couleurs :
- 🔵 **Bleu** : Clients, informations
- 🟢 **Vert** : Commandes, validation, succès
- 🟣 **Violet** : Produits, catalogue
- 🟠 **Orange** : Commandes en cours
- 🟡 **Jaune** : En attente, alertes
- 🔴 **Rouge** : Rejet, erreurs

---

## 📱 Workflow Complet - Exemple

### Scénario : Le commercial Mohamed crée une commande

1. **Login** (`/commercial/login`)
   - Mohamed entre son téléphone : 0612345678
   - Entre son mot de passe
   - Système vérifie : role='commercial', status='active'
   - Redirection → Dashboard

2. **Dashboard** (`/commercial/dashboard`)
   - Mohamed voit : 3 commandes aujourd'hui, 2 en attente
   - Clique sur "طلب جديد" (Nouvelle commande)

3. **Nouvelle commande** (`/commercial/orders/new`)
   - Clique sur "اختر العميل" (Choisir client)
   - Sélectionne "Épicerie Al Baraka" (Tier B)
   - Recherche "Huile"
   - Ajoute "Huile d'olive 1L" x 10 (prix B appliqué)
   - Recherche "Sucre"
   - Ajoute "Sucre 1kg" x 20
   - Voit le total : 1,250.00 MAD
   - Clique "تأكيد الطلب" (Confirmer)

4. **Confirmation**
   - Commande créée : ORD-0042
   - Status : pending
   - Message : "✅ تم إنشاء الطلب بنجاح! في انتظار موافقة المسؤول"
   - Redirection → Liste commandes

5. **Côté Admin** (`/commercial-orders`)
   - Badge "1 طلب جديد" apparaît
   - Admin ouvre la commande ORD-0042
   - Voit : Mohamed, Épicerie Al Baraka, 1,250 MAD
   - Vérifie le stock : OK
   - Clique "تأكيد الطلب"
   - Status → confirmed

6. **Retour commercial**
   - Mohamed rafraîchit sa page
   - Voit le badge 🟢 "مؤكد" (Confirmé)
   - Peut préparer la livraison

---

## 🔄 Intégration avec Ba9alino existant

### Points d'intégration :

1. **Table employees**
   - Rôle 'commercial' déjà existant
   - Utilisation des champs : id, name, phone, role, status

2. **Table clients**
   - Ajout du champ `created_by`
   - Les clients créés par admin ont `created_by = NULL`
   - Les clients créés par commercial ont `created_by = commercial_id`

3. **Table orders**
   - Ajout du champ `created_by`
   - Utilisation du champ `status` existant
   - Nouvelles valeurs : 'pending', 'confirmed', 'rejected'

4. **Table products**
   - Aucune modification
   - Lecture seule pour les commerciaux

5. **Navigation**
   - Routes commerciales séparées : `/commercial/*`
   - Pas de Layout admin pour les pages commerciales
   - Interface standalone mobile

---

## 🚀 Déploiement et Configuration

### Étapes de déploiement :

1. **Exécuter les migrations SQL**
   ```bash
   # Dans Supabase SQL Editor
   # Copier-coller le contenu de supabase-migrations.sql
   ```

2. **Créer un employé commercial**
   ```sql
   INSERT INTO employees (name, phone, role, status, password_hash)
   VALUES ('Mohamed Alami', '0612345678', 'commercial', 'active', 'hash_bcrypt');
   ```

3. **Configurer les RLS policies**
   - Activer RLS sur clients, orders, order_items
   - Appliquer les policies du fichier migrations

4. **Tester le workflow**
   - Login commercial
   - Créer un client
   - Créer une commande
   - Valider côté admin

### Configuration requise :

- **Supabase** : Project URL + Anon Key dans `.env`
- **Tables** : employees, clients, orders, order_items, products, categories
- **RLS** : Activé avec policies appropriées
- **Auth** : Système custom (localStorage) ou Supabase Auth

---

## 📊 Statistiques et Rapports

### Pour l'admin :
- Nombre de commandes par commercial
- Chiffre d'affaires par commercial
- Taux de validation des commandes
- Clients créés par commercial
- Performance commerciale (à implémenter)

### Pour le commercial :
- Ses statistiques personnelles uniquement
- Historique de ses commandes
- Ses clients actifs
- Son CA du mois (à implémenter)

---

## 🔮 Évolutions Futures

### Phase 2 - Encaissements terrain :
- Enregistrer les paiements clients
- Synchronisation avec la caisse centrale
- Suivi des impayés par commercial

### Phase 3 - Géolocalisation :
- Traçabilité des visites clients
- Optimisation des tournées
- Carte des clients

### Phase 4 - Offline-first :
- Mode hors ligne avec synchronisation
- Cache local des produits
- Queue de commandes à envoyer

### Phase 5 - Analytics :
- Dashboard commercial avancé
- Objectifs et commissions
- Classement des commerciaux

---

## 🐛 Troubleshooting

### Problème : Le commercial ne voit pas ses clients
**Solution** : Vérifier que `created_by` est bien renseigné lors de la création

### Problème : Les commandes ne s'affichent pas
**Solution** : Vérifier les RLS policies et que `created_by` est correct

### Problème : Les prix ne correspondent pas
**Solution** : Vérifier le `subscription_tier` du client (A, B, C, D, E)

### Problème : Erreur 403 sur les produits
**Solution** : Vérifier la policy `products_read_policy` (SELECT pour tous)

---

## 📞 Support

Pour toute question ou problème :
1. Vérifier cette documentation
2. Consulter les logs Supabase
3. Vérifier les RLS policies
4. Tester avec un utilisateur admin d'abord

---

## ✅ Checklist de mise en production

- [ ] Migrations SQL exécutées
- [ ] RLS policies activées
- [ ] Employé commercial de test créé
- [ ] Login commercial fonctionnel
- [ ] Création client testée
- [ ] Création commande testée
- [ ] Validation admin testée
- [ ] Interface mobile testée sur smartphone
- [ ] Performances vérifiées
- [ ] Sécurité auditée
- [ ] Documentation à jour

---

**Version** : 1.0  
**Date** : Janvier 2026  
**Système** : Ba9alino - Vue Commerciale Mobile
