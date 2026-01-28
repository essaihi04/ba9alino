# Ba9alino Desktop – Workflow de publication automatique

## 1. Pré-requis
- `GH_TOKEN` défini dans l'environnement PowerShell avec un token GitHub (scope `repo`).
- Version dans `package.json` incrémentée pour chaque release (1.0.0 → 1.1.0, etc.).
- L'application desktop fermée avant de lancer la publication (sinon `dist/win-unpacked` est verrouillé).

## 2. Commandes importantes
```powershell
# lancer le build Electron (sans publier)
npm run desktop:dist

# publier automatiquement la release GitHub
$env:GH_TOKEN='ghp_xxxxx'; npm run publish:release
```

## 3. Étapes pour une nouvelle version
1. Modifier le code (front + Electron).
2. Mettre à jour `package.json` → `"version": "1.x.y"`.
3. `git add`, `git commit`, `git push`.
4. `npm run publish:release` (avec `GH_TOKEN`).
5. Vérifier sur https://github.com/essaihi04/ba9alino/releases que la release et les fichiers `.exe`, `.blockmap`, `latest.yml` sont présents.

## 4. Auto-update côté app
Dans `electron/main.cjs`, l'`autoUpdater` est configuré pour pointer vers GitHub (`owner: essaihi04`, `repo: ba9alino`). Lorsque l'utilisateur clique sur le bouton « Mise à jour », l'app :
1. vérifie les releases GitHub,
2. télécharge la nouvelle version,
3. applique automatiquement la mise à jour.

## 5. Dépannage
- **Token manquant** : message “GitHub Personal Access Token is not set” → redéfinir `GH_TOKEN` dans la session courante.
- **Fichier verrouillé** (`app.asar in use`) : fermer toutes les instances de Ba9alino Desktop avant de relancer la commande.
- **Push trop lourd** : ne jamais versionner `dist/`; vérifier que `.gitignore` contient `dist/` et refaire `git reset --hard origin/main` si nécessaire.
