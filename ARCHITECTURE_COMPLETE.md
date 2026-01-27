# 🏗️ Ba9alino - Architecture Complète Vue Commerciale v2.0

## 📊 Vue d'ensemble du système

Ba9alino est maintenant un **système de gestion retail complet** avec 3 interfaces distinctes partageant la même base de données :

1. **Interface Admin** (Web Desktop) - Gestion complète
2. **Interface POS** (Web Tactile) - Caisse et ventes
3. **Interface Commerciale** (Mobile) - Terrain et commandes

---

## 🗄️ Architecture Base de Données

### Tables Principales

#### 1. **employees** (Utilisateurs du système)
```sql
- id (UUID)
- name (TEXT)
- phone (TEXT)
- email (TEXT)
- role (ENUM: admin, commercial, stock, truck_driver, delivery_driver, custom)
- status (ENUM: active, inactive)
- monthly_salary (DECIMAL)
- advance_limit (DECIMAL)
- password_hash (TEXT)
```

#### 2. **clients** (Enrichie pour le commercial)
```sql
-- Champs existants
- id, company_name_ar, company_name_en
- contact_person_name, contact_person_phone, contact_person_email
- address, city, subscription_tier

-- NOUVEAUX CHAMPS
- commercial_id (UUID) → Référence employees
- created_by (UUID) → Référence employees
- gps_lat (DECIMAL 10,8) → Latitude du magasin
- gps_lng (DECIMAL 11,8) → Longitude du magasin
- shop_photo_url (TEXT) → Photo du magasin
- credit_limit (DECIMAL) → Plafond de crédit autorisé
```

#### 3. **orders** (Enrichie pour traçabilité)
```sql
-- Champs existants
- id, order_number, client_id
- order_date, total_amount, status

-- NOUVEAUX CHAMPS
- created_by (UUID) → Référence employees (qui a créé)
- source (ENUM: pos, commercial, admin) → Origine de la commande
```

#### 4. **order_items** (NOUVELLE TABLE)
```sql
- id (UUID)
- order_id (UUID) → Référence orders
- product_id (UUID) → Référence products
- quantity (INTEGER)
- unit_price (DECIMAL)
- total (DECIMAL)
- created_at, updated_at
```

#### 5. **products** (Enrichie)
```sql
-- Champs existants
- id, sku, name_ar, name_en
- price_a, price_b, price_c, price_d, price_e
- stock, cost_price

-- NOUVEAU CHAMP
- is_active_for_commercial (BOOLEAN) → Masquer certains produits aux commerciaux
```

#### 6. **payments** (Enrichie)
```sql
-- Champs existants
- id, invoice_id, client_id, amount
- payment_method, payment_date

-- NOUVEAUX CHAMPS
- collected_by (UUID) → Référence employees (qui a collecté)
- payment_source (ENUM: pos, commercial, admin) → Origine du paiement
```

#### 7. **visits** (NOUVELLE TABLE - Visites terrain)
```sql
- id (UUID)
- commercial_id (UUID) → Référence employees
- client_id (UUID) → Référence clients
- visit_date (TIMESTAMP)
- gps_lat (DECIMAL) → Position lors de la visite
- gps_lng (DECIMAL) → Position lors de la visite
- note (TEXT) → Notes de visite
- photo_url (TEXT) → Photo prise lors de la visite
- order_created (BOOLEAN) → Commande créée pendant la visite ?
- duration_minutes (INTEGER) → Durée de la visite
- created_at, updated_at
```

---

## 🔐 Sécurité - Row Level Security (RLS)

### Policies Clients
```sql
-- Commercial voit uniquement ses clients (commercial_id OU created_by)
-- Admin voit tous les clients
CREATE POLICY commercial_clients_policy ON clients
  FOR ALL
  USING (
    commercial_id = auth.uid() OR 
    created_by = auth.uid() OR 
    role = 'admin'
  );
```

### Policies Orders
```sql
-- Commercial voit uniquement ses commandes
-- Admin voit toutes les commandes
CREATE POLICY commercial_orders_policy ON orders
  FOR ALL
  USING (
    created_by = auth.uid() OR 
    role = 'admin'
  );
```

### Policies Products
```sql
-- Commercial voit uniquement les produits actifs pour lui
-- Admin voit tous les produits
CREATE POLICY products_read_policy ON products
  FOR SELECT
  USING (
    is_active_for_commercial = true OR 
    role = 'admin'
  );
```

### Policies Visits
```sql
-- Commercial voit uniquement ses visites
-- Admin voit toutes les visites
CREATE POLICY commercial_visits_policy ON visits
  FOR ALL
  USING (
    commercial_id = auth.uid() OR 
    role = 'admin'
  );
```

### Policies Payments
```sql
-- Commercial voit uniquement ses encaissements
-- Admin voit tous les paiements
CREATE POLICY payments_read_policy ON payments
  FOR SELECT
  USING (
    collected_by = auth.uid() OR 
    role = 'admin'
  );

-- Commercial peut insérer des paiements avec source='commercial'
CREATE POLICY payments_insert_policy ON payments
  FOR INSERT
  WITH CHECK (
    collected_by = auth.uid() AND 
    payment_source = 'commercial'
  );
```

---

## 📱 Pages Commerciales (10 pages)

### 1. Login & Dashboard
- **`CommercialLoginPage.tsx`** → `/commercial/login`
- **`CommercialDashboardPage.tsx`** → `/commercial/dashboard`

### 2. Gestion Clients
- **`CommercialClientsPage.tsx`** → `/commercial/clients`
  - Liste SES clients
  - Création client avec GPS et photo
  - Plafond crédit

### 3. Gestion Produits
- **`CommercialProductsPage.tsx`** → `/commercial/products`
  - Catalogue lecture seule
  - Filtrage par catégorie
  - 4 prix visibles

### 4. Gestion Commandes
- **`CommercialOrdersPage.tsx`** → `/commercial/orders`
  - Liste SES commandes
  - Filtres par statut
- **`CommercialNewOrderPage.tsx`** → `/commercial/orders/new`
  - Création commande
  - Panier avec prix automatique selon tier
  - Source = 'commercial', Status = 'pending'

### 5. Terrain & Géolocalisation
- **`CommercialMapPage.tsx`** → `/commercial/map`
  - Carte des clients avec GPS
  - Calcul distance
  - Navigation Google Maps
  - Tri par proximité
- **`CommercialVisitPage.tsx`** → `/commercial/visits/new`
  - Enregistrement visite
  - Capture GPS automatique
  - Photo du magasin
  - Notes de visite
  - Durée calculée

### 6. Encaissements & Performance
- **`CommercialPaymentsPage.tsx`** → `/commercial/payments`
  - Liste clients avec dettes
  - Encaissement terrain
  - Source = 'commercial'
- **`CommercialPerformancePage.tsx`** → `/commercial/performance`
  - Statistiques personnelles
  - CA mensuel
  - Taux de conversion
  - Graphiques

---

## 🖥️ Pages Admin (2 nouvelles pages)

### 1. Gestion Commandes Commerciales
**`CommercialOrdersManagementPage.tsx`** → `/commercial-orders`
- Vue de TOUTES les commandes commerciales
- Filtres : Pending / Confirmed / Rejected
- Détails complets : Commercial, Client, Produits
- Actions : Confirmer ✅ / Rejeter ❌
- Badge "X commandes en attente"

### 2. Activité Terrain
**`CommercialActivityPage.tsx`** → `/commercial-activity`
- Vue de TOUTES les visites terrain
- Statistiques par commercial :
  - Nombre de visites
  - Nombre de commandes
  - CA généré
  - Taux de conversion (visites → commandes)
- Filtres : Aujourd'hui / Semaine / Mois / Tout
- Détails visite : GPS, photo, notes, durée

---

## 🔄 Workflow Complet

### Scénario 1 : Création Client + Commande

1. **Commercial** se connecte → `/commercial/login`
2. Va sur **Carte** → `/commercial/map`
3. Clique **"Nouvelle visite"** pour un prospect
4. Système capture **GPS automatiquement**
5. Commercial prend **photo du magasin**
6. Ajoute **notes** : "Épicerie, intéressé par huiles"
7. Clique **"Créer client"**
   - Formulaire pré-rempli avec GPS
   - Ajoute nom, téléphone, tier de prix
   - `commercial_id` = son ID
8. Clique **"Créer commande"**
   - Sélectionne produits
   - Prix automatique selon tier
   - `source` = 'commercial', `status` = 'pending'
9. Commande enregistrée → Notification "En attente validation"

### Scénario 2 : Validation Admin

1. **Admin** voit badge **"3 commandes en attente"**
2. Va sur → `/commercial-orders`
3. Ouvre commande **ORD-0042**
4. Voit :
   - Commercial : Mohamed
   - Client : Épicerie Al Baraka
   - Produits : 10x Huile, 20x Sucre
   - Total : 1,250 MAD
5. Vérifie **stock disponible**
6. Clique **"Confirmer"**
7. Status → 'confirmed'
8. Commercial voit badge vert **"Confirmé"**

### Scénario 3 : Encaissement Terrain

1. **Commercial** visite client avec dette
2. Va sur → `/commercial/payments`
3. Sélectionne **client**
4. Voit factures impayées
5. Client paie **500 MAD**
6. Commercial enregistre :
   - Montant : 500
   - Méthode : Cash
   - `collected_by` = son ID
   - `payment_source` = 'commercial'
7. Facture mise à jour en temps réel
8. Admin voit le paiement dans `/payments`

### Scénario 4 : Visite Terrain

1. **Commercial** arrive chez client
2. Clique **"Nouvelle visite"** → `/commercial/visits/new`
3. GPS capturé automatiquement
4. Prend photo du magasin
5. Ajoute notes : "Stock faible, relancer semaine prochaine"
6. Durée calculée : 15 minutes
7. Sauvegarde visite
8. **Admin** voit dans `/commercial-activity` :
   - Toutes les visites du jour
   - Statistiques par commercial
   - Photos et notes

---

## 🎨 Design System

### Palette Couleurs Commerciale

| Couleur | Usage | Pages |
|---------|-------|-------|
| 🔵 Bleu | Clients, Info | Clients, Login |
| 🟢 Vert | Commandes, Succès | Nouvelle commande, Validation |
| 🟣 Violet | Produits | Catalogue, Visites |
| 🟠 Orange | Commandes en cours | Mes commandes |
| 🟡 Jaune | En attente | Pending orders |
| 🔴 Rouge | Rejet, Dettes | Rejets, Impayés |
| 🟤 Teal | Carte | Map |
| 🟡 Amber | Paiements | Encaissements |
| 🔵 Indigo | Performance | Stats |
| 🌸 Pink | Visites | Nouvelle visite |

### Composants UI Mobile

- **Cards** : `rounded-xl shadow-md hover:shadow-lg`
- **Boutons** : Min 44x44px, gros texte, icônes
- **Headers** : Gradient, sticky top-0
- **Badges** : Colorés selon statut
- **Bottom Sheet** : Panier fixe en bas
- **Modals** : Full-screen sur mobile

---

## 📡 Flux de Données

### Synchronisation Temps Réel

```
Commercial Mobile ──┐
                    ├──→ Supabase (BDD commune) ←── Admin Web
POS Desktop ────────┘
```

**Aucune duplication** :
- Même table `clients`
- Même table `orders`
- Même table `payments`
- Même table `products`

**Isolation par RLS** :
- Commercial voit uniquement SES données
- Admin voit TOUTES les données
- Sécurité garantie au niveau BDD

---

## 🚀 Routes Complètes

### Routes Commerciales (Sans Layout Admin)
```
/commercial/login              → Login commercial
/commercial/dashboard          → Dashboard + stats
/commercial/products           → Catalogue produits
/commercial/clients            → Gestion clients
/commercial/orders             → Liste commandes
/commercial/orders/new         → Nouvelle commande
/commercial/map                → Carte clients GPS
/commercial/visits/new         → Enregistrer visite
/commercial/payments           → Encaissements terrain
/commercial/performance        → Mes statistiques
```

### Routes Admin (Avec Layout Admin)
```
/commercial-orders             → Validation commandes
/commercial-activity           → Activité terrain (visites)
```

---

## 📋 Checklist Déploiement

### Phase 1 : Base de Données
- [ ] Exécuter `supabase-migrations.sql` dans Supabase SQL Editor
- [ ] Vérifier que toutes les tables sont créées
- [ ] Vérifier que les colonnes sont ajoutées
- [ ] Activer RLS sur toutes les tables
- [ ] Tester les policies avec un utilisateur test

### Phase 2 : Création Utilisateurs
```sql
-- Créer un commercial de test
INSERT INTO employees (name, phone, role, status, monthly_salary, advance_limit)
VALUES ('Mohamed Alami', '0612345678', 'commercial', 'active', 5000, 2000);

-- Créer un client de test avec GPS
INSERT INTO clients (
  company_name_ar, contact_person_name, contact_person_phone,
  subscription_tier, commercial_id, gps_lat, gps_lng, credit_limit
)
VALUES (
  'Épicerie Test', 'Ahmed', '0623456789',
  'B', '[ID_COMMERCIAL]', 33.5731, -7.5898, 5000
);
```

### Phase 3 : Tests Fonctionnels
- [ ] Login commercial fonctionnel
- [ ] Dashboard affiche les stats
- [ ] Création client avec GPS
- [ ] Création commande → Status pending
- [ ] Admin voit la commande
- [ ] Admin confirme → Status confirmed
- [ ] Commercial voit le changement
- [ ] Enregistrement visite avec GPS et photo
- [ ] Encaissement terrain
- [ ] Carte clients avec calcul distance

### Phase 4 : Interface Admin
- [ ] Ajouter lien "إدارة طلبات التجار" dans menu → `/commercial-orders`
- [ ] Ajouter lien "نشاط التجار الميداني" dans menu → `/commercial-activity`
- [ ] Badge notification sur commandes pending

---

## 🎯 Fonctionnalités par Rôle

### 👨‍💼 Commercial (Mobile)

**Peut faire** :
- ✅ Voir tous les produits actifs
- ✅ Voir tous les prix (A, B, C, D, E)
- ✅ Créer ses clients avec GPS et photo
- ✅ Voir uniquement SES clients
- ✅ Créer des commandes (status = pending)
- ✅ Voir uniquement SES commandes
- ✅ Enregistrer des visites terrain avec GPS
- ✅ Prendre photos des magasins
- ✅ Encaisser des paiements terrain
- ✅ Voir ses statistiques personnelles

**Ne peut pas** :
- ❌ Modifier les prix
- ❌ Modifier le stock
- ❌ Voir les clients des autres commerciaux
- ❌ Voir les commandes des autres
- ❌ Valider ses propres commandes
- ❌ Accéder au dashboard admin

### 👨‍💻 Admin (Web)

**Peut faire** :
- ✅ Tout ce que le commercial peut faire
- ✅ Voir TOUS les clients (tous commerciaux)
- ✅ Voir TOUTES les commandes
- ✅ Valider/Rejeter les commandes commerciales
- ✅ Voir toutes les visites terrain
- ✅ Voir les statistiques de tous les commerciaux
- ✅ Gérer les produits et prix
- ✅ Gérer le stock
- ✅ Voir tous les paiements

---

## 📊 Statistiques et Rapports

### Dashboard Commercial
- Commandes du jour
- Commandes en attente
- CA du jour
- Nombre de clients
- Performance mensuelle
- Taux de conversion visites→commandes

### Dashboard Admin - Vue Commerciale
- Nombre de visites par commercial
- Nombre de commandes par commercial
- CA par commercial
- Taux de conversion par commercial
- Classement des commerciaux
- Carte de chaleur des visites

---

## 🔮 Évolutions Futures (Roadmap)

### Phase 2 - Offline First
- Service Worker pour mode hors ligne
- Synchronisation en arrière-plan
- Queue de commandes à envoyer
- Cache local des produits

### Phase 3 - Notifications Push
- Notification quand commande validée
- Notification rappel visite client
- Notification objectif atteint

### Phase 4 - Analytics Avancés
- Prédiction des ventes
- Recommandations de produits
- Optimisation des tournées
- Scoring des clients

### Phase 5 - Gamification
- Objectifs mensuels
- Badges et récompenses
- Classement des commerciaux
- Commissions automatiques

---

## 🛠️ Stack Technique

### Frontend
- **React 18** + TypeScript
- **React Router** pour navigation
- **Lucide React** pour icônes
- **TailwindCSS** pour styling
- **Mobile-first** responsive design

### Backend
- **Supabase** (PostgreSQL + Auth + Storage)
- **Row Level Security** pour permissions
- **Realtime** pour synchronisation

### Authentification
- **Custom Auth** via localStorage (commercial)
- **Supabase Auth** (admin)

### Géolocalisation
- **Navigator.geolocation** API
- **Google Maps** pour navigation
- Calcul distance Haversine

---

## 📈 Métriques de Succès

### KPIs Commerciaux
- **Nombre de visites / jour** : Objectif 8-10
- **Taux de conversion** : Objectif 60%
- **CA moyen / commande** : Suivi mensuel
- **Nombre de nouveaux clients / mois** : Objectif 5-10

### KPIs Admin
- **Temps de validation commande** : < 2h
- **Taux de rejet** : < 10%
- **Couverture GPS clients** : > 80%
- **Utilisation app mobile** : Suivi quotidien

---

## 🐛 Troubleshooting

### Problème : GPS ne fonctionne pas
**Solution** : 
- Vérifier permissions navigateur
- Utiliser HTTPS (requis pour geolocation)
- Fallback : saisie manuelle

### Problème : Photos ne s'affichent pas
**Solution** :
- Vérifier Supabase Storage configuré
- Vérifier policies Storage
- Fallback : Base64 dans BDD (temporaire)

### Problème : Commercial voit clients d'autres commerciaux
**Solution** :
- Vérifier RLS activé sur table clients
- Vérifier policy commercial_clients_policy
- Vérifier que commercial_id est bien renseigné

### Problème : Commandes ne se synchronisent pas
**Solution** :
- Vérifier connexion Supabase
- Vérifier que created_by est renseigné
- Vérifier que source = 'commercial'

---

## 📞 Support & Maintenance

### Logs à surveiller
- Supabase Logs → Erreurs RLS
- Console navigateur → Erreurs JS
- Network tab → Requêtes échouées

### Monitoring
- Nombre de commandes pending > 24h
- Nombre de visites sans GPS
- Taux d'erreur création commande
- Performance requêtes BDD

---

## ✅ Résumé Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    SUPABASE (BDD Commune)               │
│  ┌──────────┬──────────┬──────────┬──────────────────┐ │
│  │ clients  │ orders   │ products │ visits           │ │
│  │ payments │ employees│ invoices │ order_items      │ │
│  └──────────┴──────────┴──────────┴──────────────────┘ │
└─────────────────────────────────────────────────────────┘
           ↑                ↑                ↑
           │                │                │
    ┌──────┴────┐    ┌─────┴─────┐   ┌─────┴──────┐
    │  Admin    │    │    POS    │   │ Commercial │
    │   Web     │    │  Desktop  │   │   Mobile   │
    └───────────┘    └───────────┘   └────────────┘
```

**Principe** : Une seule source de vérité (Supabase), trois interfaces adaptées aux besoins.

---

**Version** : 2.0 Enrichie  
**Date** : Janvier 2026  
**Système** : Ba9alino - Vue Commerciale Terrain Complète
