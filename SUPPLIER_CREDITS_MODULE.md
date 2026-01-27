# Module de Gestion des Crédits Fournisseurs

## 🎯 Objectif

Suivre et gérer les paiements dus aux fournisseurs dans le système Ba9alino.

## 📋 Fonctionnalités

### 1. **Page des Crédits Fournisseurs** (`/supplier-credits`)
- Tableau récapitulatif des dettes fournisseurs
- Calcul automatique des soldes
- Statuts visuels (Dette, Dette partielle, Soldé)
- Statistiques en temps réel

### 2. **Gestion des Paiements**
- Enregistrement des paiements fournisseurs
- Plusieurs méthodes de paiement (Espèces, Virement, Chèque, Carte)
- Suivi des dates et montants
- Notes et commentaires optionnels

### 3. **Intégration Existantes**
- Bouton de paiement dans la page des fournisseurs
- Lien dans le menu principal
- Compatible avec le système d'achats existant

## 🛠️ Installation

### 1. **Base de Données**

Exécutez le script SQL suivant dans l'éditeur Supabase :

```sql
-- Fichier: database-migrations/supplier_payments.sql
```

Ou copiez le contenu du fichier `database-migrations/supplier_payments.sql` dans l'éditeur SQL Supabase.

### 2. **Fichiers Ajoutés**

#### Pages
- `src/pages/SupplierCreditsPage.tsx` - Page principale des crédits fournisseurs

#### Types
- `src/lib/supabase.ts` - Ajout de l'interface `SupplierPayment`

#### Routing
- `src/App.tsx` - Route `/supplier-credits` ajoutée

#### Menu
- `src/components/Layout.tsx` - Lien "أرصدة الموردين" ajouté au menu

### 3. **Modifications Existantes**

#### SuppliersPage.tsx
- Ajout du bouton "تسجيل دفع" dans les actions
- Modal de paiement intégré
- Gestion des états de paiement

## 📊 Logique Métier

### Calcul des Soldes

```typescript
// Pour chaque fournisseur:
totalPurchases = somme(total_amount) des achats reçus
totalPaid = somme(amount) des paiements enregistrés
remainingAmount = totalPurchases - totalPaid
```

### Statuts Automatiques

- **Dette** (`debt`): `totalPaid = 0` et `totalPurchases > 0`
- **Dette partielle** (`partial`): `0 < totalPaid < totalPurchases`
- **Soldé** (`paid`): `totalPaid >= totalPurchases`
- **Aucune dette** (`no-debt`): `totalPurchases = 0`

## 🎨 Interface Utilisateur

### Page Principale
- **Cartes de statistiques**: Dette totale, Montants payés, Fournisseurs débiteurs
- **Tableau des crédits**: Fournisseur, Achats, Payé, Reste, Statut, Dernier paiement
- **Actions rapides**: Voir détails, Enregistrer paiement

### Modal de Paiement
- **Champs obligatoires**: Montant, Date, Méthode de paiement
- **Champs optionnels**: Notes
- **Validation**: Vérification avant soumission

### Intégration Fournisseurs
- **Bouton dédié**: Icône DollarSign dans les actions
- **Modal réutilisable**: Même composant que la page des crédits
- **Mise à jour automatique**: Actualisation après paiement

## 🔧 Configuration

### Variables d'Environnement

Aucune variable d'environnement supplémentaire n'est requise. Le module utilise les mêmes configurations Supabase que le reste de l'application.

### Permissions

Le module utilise les politiques RLS (Row Level Security) de Supabase :
- `SELECT` pour tous les utilisateurs authentifiés
- `INSERT` pour tous les utilisateurs authentifiés  
- `UPDATE` pour tous les utilisateurs authentifiés
- `DELETE` pour tous les utilisateurs authentifiés

## 📈 Rapports et Statistiques

### Indicateurs Clés
- **Dette totale**: Somme de tous les montants restants dus
- **Montants payés**: Total des paiements enregistrés
- **Fournisseurs débiteurs**: Nombre de fournisseurs avec des dettes
- **Fournisseurs soldés**: Nombre de fournisseurs sans dettes

### Export et Impression
- Les données peuvent être exportées via les fonctionnalités existantes du navigateur
- Impression du tableau des crédits disponible

## 🚀 Utilisation

### 1. **Accès au Module**
- Menu principal → "أرصدة الموردين"
- Ou directement via `/supplier-credits`

### 2. **Consultation des Dettes**
- Vue d'ensemble de tous les fournisseurs
- Filtres par recherche
- Statuts visuels immédiats

### 3. **Enregistrement d'un Paiement**
- Cliquer sur l'icône DollarSign dans la page des fournisseurs
- Ou depuis la page des crédits fournisseurs
- Remplir le formulaire et valider

### 4. **Suivi**
- Mise à jour automatique des soldes
- Historique des paiements disponible
- Statuts mis à jour en temps réel

## 🔍 Débogage

### Problèmes Communs

1. **Table non trouvée**: Vérifiez que la migration SQL a été exécutée
2. **Permissions refusées**: Vérifiez les politiques RLS dans Supabase
3. **Données incorrectes**: Vérifiez les relations entre `purchases` et `suppliers`

### Logs

Les erreurs sont affichées dans la console du navigateur et via des alertes utilisateur.

## 🔄 Évolutions Futures

### Fonctionnalités Planifiées
- Export PDF des relevés fournisseurs
- Notifications de rappel de paiement
- Historique détaillé par fournisseur
- Graphiques d'évolution des dettes

### Améliorations Possibles
- Intégration avec la comptabilité
- Automatisation des rappels
- Multi-devises
- Rapprochement bancaire

---

**Version**: 1.0.0  
**Date**: Janvier 2026  
**Auteur**: Équipe Ba9alino
