# Module de Gestion des Dépenses Générales

## 🎯 Objectif

Enregistrer et suivre toutes les sorties d'argent non liées aux achats de marchandises (loyer, électricité, salaires, etc.).

## 📋 Fonctionnalités

### 1. **Page des Dépenses** (`/expenses`)
- Tableau récapitulatif des dépenses avec : Date, Catégorie, Description, Montant, Mode de paiement
- Statistiques en temps réel : Total dépenses, Rémunérations, Loyer, Charges
- Filtrage par catégorie et recherche
- Édition et suppression des dépenses

### 2. **Catégories de Dépenses**
- **الإيجار** (Loyer)
- **الكهرباء** (Électricité)
- **الماء** (Eau)
- **الإنترنت** (Internet)
- **النقل** (Transport)
- **الراتب** (Salaire)
- **أخرى** (Autre)

### 3. **Modes de Paiement**
- نقدي (Espèces)
- تحويل بنكي (Virement bancaire)
- شيك (Chèque)
- بطاقة (Carte)
- أخرى (Autre)

## 🛠️ Installation

### 1. **Base de Données**

Exécutez le script SQL suivant dans l'éditeur Supabase :

```sql
-- Fichier: database-migrations/create_expenses_table.sql
```

### 2. **Fichiers Ajoutés**

#### Pages
- `src/pages/ExpensesPage.tsx` - Page principale des dépenses

#### Types
- `src/lib/supabase.ts` - Ajout de l'interface `Expense`

#### Routing
- `src/App.tsx` - Route `/expenses` ajoutée

#### Menu
- `src/components/Layout.tsx` - Lien "المصروفات" ajouté au menu

## 📊 Logique Métier

### Calcul des Statistiques

```typescript
// Total des dépenses
totalExpenses = Σ(amount) de toutes les dépenses

// Par catégorie
byCategory[category] = Σ(amount) pour chaque catégorie
```

### Impact sur le Bénéfice

```
Bénéfice = Ventes – Coût marchandises – Dépenses générales
```

Les dépenses enregistrées ici sont automatiquement soustraites du bénéfice dans les rapports financiers.

## 🎨 Interface Utilisateur

### Page Principale
- **Cartes de statistiques**: 
  - Total des dépenses (rouge)
  - Rémunérations (orange)
  - Loyer (jaune)
  - Charges (rose)
- **Tableau des dépenses**: Date, Catégorie, Description, Montant, Mode de paiement
- **Actions rapides**: Éditer, Supprimer

### Modal d'Ajout/Édition
- **Champs obligatoires**: Date, Catégorie, Description, Montant, Mode de paiement
- **Champs optionnels**: Employé responsable
- **Validation**: Vérification avant soumission

## 🔧 Configuration

### Variables d'Environnement

Aucune variable d'environnement supplémentaire n'est requise.

### Permissions

Le module utilise les politiques RLS (Row Level Security) de Supabase :
- `SELECT` pour tous les utilisateurs authentifiés
- `INSERT` pour tous les utilisateurs authentifiés  
- `UPDATE` pour tous les utilisateurs authentifiés
- `DELETE` pour tous les utilisateurs authentifiés

## 📈 Rapports et Statistiques

### Indicateurs Clés
- **Total des dépenses**: Somme de toutes les dépenses
- **Dépenses par catégorie**: Ventilation par type
- **Dépenses mensuelles**: Évolution dans le temps

### Export et Impression
- Les données peuvent être exportées via les fonctionnalités du navigateur
- Impression du tableau des dépenses disponible

## 🚀 Utilisation

### 1. **Accès au Module**
- Menu principal → "المصروفات"
- Ou directement via `/expenses`

### 2. **Ajout d'une Dépense**
- Cliquer sur "مصروف جديد"
- Remplir le formulaire
- Valider l'ajout

### 3. **Édition d'une Dépense**
- Cliquer sur l'icône Edit (crayon)
- Modifier les informations
- Valider les modifications

### 4. **Suppression d'une Dépense**
- Cliquer sur l'icône Delete (poubelle)
- Confirmer la suppression

### 5. **Filtrage et Recherche**
- Recherche par description ou catégorie
- Filtrage par catégorie
- Réinitialisation des filtres

## 🔍 Débogage

### Problèmes Communs

1. **Table non trouvée**: Vérifiez que la migration SQL a été exécutée
2. **Permissions refusées**: Vérifiez les politiques RLS dans Supabase
3. **Données incorrectes**: Vérifiez les formats de date et montants

### Logs

Les erreurs sont affichées dans la console du navigateur et via des alertes utilisateur.

## 🔄 Intégration avec les Rapports Financiers

### Rapport de Bénéfice
Le module des dépenses s'intègre automatiquement avec le système de rapports :

```
Revenu Total (Ventes)
- Coût des Marchandises Vendues
- Dépenses Générales (ce module)
= Bénéfice Net
```

### Données Disponibles pour les Rapports
- Montant total des dépenses par période
- Ventilation par catégorie
- Historique complet des transactions

## 🔄 Évolutions Futures

### Fonctionnalités Planifiées
- Budgets par catégorie
- Alertes de dépassement
- Rapports mensuels/annuels
- Graphiques d'évolution
- Export PDF des rapports

### Améliorations Possibles
- Récurrence automatique (loyer mensuel, etc.)
- Approbation des dépenses
- Attachement de justificatifs
- Intégration comptable

---

**Version**: 1.0.0  
**Date**: Janvier 2026  
**Auteur**: Équipe Ba9alino
