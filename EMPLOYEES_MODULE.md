# Module de Gestion des Employés

## 🎯 Objectif

Gérer le personnel, définir les permissions par rôle et tracer toutes les actions importantes pour la responsabilité et l'audit.

## 📋 Fonctionnalités

### 1. **Page des Employés** (`/employees`)
- Tableau des employés avec : Nom, Téléphone, Rôle, Statut, Date de création
- Statistiques : Total, Actifs, Administrateurs, Inactifs
- Filtrage par rôle et statut
- Recherche par nom ou téléphone
- Ajout, édition et suppression d'employés

### 2. **Rôles et Permissions**

| Rôle | Accès | Permissions |
|------|-------|-------------|
| **Admin** (مسؤول) | Tout | Gestion complète du système |
| **Commercial** (تاجر) | Clients + Commandes | Gestion clients et commandes |
| **Stock** (مسؤول المخزن) | Produits + Stock | Gestion produits et inventaire |
| **Livreur de Camion** (ليvreur de camion) | Livraisons | Gestion des livraisons camion |
| **Livreur** (livreur) | Livraisons | Gestion des livraisons |

### 3. **Traçabilité et Audit**

Chaque action importante enregistre :
- **Qui** a effectué l'action (created_by)
- **Quand** (timestamp)
- **Quoi** (type d'action)
- **Détails** (informations supplémentaires)

#### Champs created_by ajoutés à :
- `invoices` - Qui a créé la facture
- `expenses` - Qui a enregistré la dépense
- `supplier_payments` - Qui a enregistré le paiement fournisseur

#### Table audit_logs
```sql
- id: UUID
- action: VARCHAR (vente, paiement, suppression, etc.)
- entity_type: VARCHAR (invoice, expense, supplier_payment, etc.)
- entity_id: UUID (référence à l'entité)
- created_by: UUID (référence à l'employé)
- details: JSONB (données supplémentaires)
- created_at: TIMESTAMP
```

## 🛠️ Installation

### 1. **Base de Données**

Exécutez le script SQL suivant dans l'éditeur Supabase :

```sql
-- Fichier: database-migrations/create_employees_table.sql
```

### 2. **Fichiers Ajoutés**

#### Pages
- `src/pages/EmployeesPage.tsx` - Page de gestion des employés

#### Types
- `src/lib/supabase.ts` - Interfaces `Employee` et `AuditLog`

#### Routing
- `src/App.tsx` - Route `/employees` ajoutée

#### Menu
- `src/components/Layout.tsx` - Lien "الموظفين" ajouté au menu

#### Dashboard
- `src/pages/DashboardPage.tsx` - 3 nouvelles cartes intégrées

## 📊 Intégration au Dashboard

### Nouvelles Cartes Affichées

1. **💰 Dين الموردين** (Dettes Fournisseurs)
   - Montant total des dettes envers les fournisseurs
   - Couleur : Indigo
   - Calcul : Total achats - Total paiements

2. **💸 المصروفات هذا الشهر** (Dépenses du Mois)
   - Total des dépenses du mois courant
   - Couleur : Rose
   - Calcul : Somme des dépenses du 1er au jour actuel

3. **👥 الموظفين النشطين** (Employés Actifs)
   - Nombre d'employés avec statut "actif"
   - Couleur : Cyan
   - Calcul : Comptage des employés actifs

## 🎨 Interface Utilisateur

### Page Principale
- **Cartes de statistiques**: 4 cartes avec indicateurs clés
- **Tableau des employés**: Affichage complet avec filtres
- **Actions rapides**: Ajouter, éditer, supprimer

### Modal d'Ajout/Édition
- **Champs obligatoires**: Nom, Téléphone, Rôle, Statut
- **Champs optionnels**: Mot de passe (ajout seulement)
- **Validation**: Vérification avant soumission

### Couleurs par Rôle
- **Admin** : Violet
- **Caissier** : Bleu
- **Commercial** : Vert
- **Stock** : Orange

## 🔧 Configuration

### Variables d'Environnement

Aucune variable d'environnement supplémentaire n'est requise.

### Permissions

Le module utilise les politiques RLS (Row Level Security) de Supabase :
- `SELECT` pour tous les utilisateurs authentifiés
- `INSERT` pour tous les utilisateurs authentifiés  
- `UPDATE` pour tous les utilisateurs authentifiés
- `DELETE` pour tous les utilisateurs authentifiés

## 🚀 Utilisation

### 1. **Accès au Module**
- Menu principal → "الموظفين"
- Ou directement via `/employees`

### 2. **Ajout d'un Employé**
- Cliquer sur "موظف جديد"
- Remplir le formulaire
- Valider l'ajout

### 3. **Édition d'un Employé**
- Cliquer sur l'icône Edit (crayon)
- Modifier les informations
- Valider les modifications

### 4. **Suppression d'un Employé**
- Cliquer sur l'icône Delete (poubelle)
- Confirmer la suppression

### 5. **Filtrage et Recherche**
- Recherche par nom ou téléphone
- Filtrage par rôle
- Filtrage par statut (actif/inactif)
- Réinitialisation des filtres

## 📈 Traçabilité des Actions

### Enregistrement Automatique

Chaque action importante est enregistrée automatiquement :

```typescript
// Exemple : Enregistrement d'une vente
{
  action: 'create_invoice',
  entity_type: 'invoice',
  entity_id: 'uuid-de-la-facture',
  created_by: 'uuid-du-caissier',
  details: {
    amount: 1500,
    client: 'Nom du client',
    items_count: 5
  },
  created_at: '2026-01-24T18:00:00Z'
}
```

### Consultation des Logs

Les logs d'audit peuvent être consultés via :
- Table `audit_logs` dans Supabase
- Rapports d'audit (à développer)
- Historique par employé (à développer)

## 🔍 Débogage

### Problèmes Communs

1. **Table non trouvée**: Vérifiez que la migration SQL a été exécutée
2. **Permissions refusées**: Vérifiez les politiques RLS dans Supabase
3. **Données incorrectes**: Vérifiez les formats de téléphone

### Logs

Les erreurs sont affichées dans la console du navigateur et via des alertes utilisateur.

## 🔄 Évolutions Futures

### Fonctionnalités Planifiées
- Authentification par employé (login spécifique)
- Historique d'audit détaillé par employé
- Rapports de performance
- Gestion des horaires
- Système de permissions granulaires

### Améliorations Possibles
- Intégration avec système de paie
- Gestion des congés
- Évaluation de performance
- Historique des modifications
- Export des logs d'audit

## 📋 Résumé des Trois Modules Financiers

### 1. **Crédits Fournisseurs** (`/supplier-credits`)
- Suivi des dettes fournisseurs
- Enregistrement des paiements
- Calcul automatique des soldes

### 2. **Dépenses Générales** (`/expenses`)
- Enregistrement des sorties d'argent
- Catégorisation des dépenses
- Statistiques par catégorie

### 3. **Employés** (`/employees`)
- Gestion du personnel
- Permissions par rôle
- Traçabilité des actions

---

**Version**: 1.0.0  
**Date**: Janvier 2026  
**Auteur**: Équipe Ba9alino
