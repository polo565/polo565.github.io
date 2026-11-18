# HAMDI ITALIE — site web sur GitHub Pages

Le site HAMDI ITALIE (visiteurs + administration) est hébergé ici, en fichiers statiques
(HTML, CSS, JavaScript), à l'adresse **https://polo565.github.io/**.

| Adresse | Page |
|---|---|
| `https://polo565.github.io/` | site visiteur (ar / fr / en, RTL pour l'arabe) |
| `https://polo565.github.io/#/service/<slug>` | lien direct vers un service (aussi `#/services`, `#/guide`, `#/track`…) |
| `https://polo565.github.io/admin/` | administration (non indexée par les moteurs de recherche) |

## Architecture

```
navigateur ──► polo565.github.io (GitHub Pages : pages, styles, scripts)
     │
     └── fetch POST JSON ──► Google Apps Script …/exec  (apps-script/HttpApi.gs → api_* existants)
                                   │
                                   ├── Google Sheets (base de données)
                                   └── Google Drive (documents, pièces jointes)
```

GitHub Pages ne peut héberger que des fichiers statiques : il ne peut ni lire le Google Sheet
ni garder un secret. Les données, les comptes, les mots de passe, les rôles et Drive restent donc
dans le projet Apps Script existant, qui sert d'**API**. Toute vérification (session admin, rôles,
code de suivi, limites, contrôle des fichiers) reste faite sur le serveur.

Ce dépôt est **public** : il ne contient aucun code backend, aucun identifiant de Sheet ou de
dossier Drive, aucun secret. L'URL `/exec` (déjà publique) est le seul lien vers le backend.

## ⚠️ Mise en service (à faire une fois, par le propriétaire)

### 1. Ajouter l'API au projet Apps Script
1. Ouvrir le projet Apps Script (script.google.com → projet HAMDI ITALIE).
2. **Fichiers → + → Script**, nom : `HttpApi`. Coller le contenu de [`apps-script/HttpApi.gs`](apps-script/HttpApi.gs). Enregistrer.
3. **Déployer → Gérer les déploiements → ✏ Modifier** le déploiement existant →
   *Version* : **Nouvelle version** → **Déployer**. L'URL `/exec` ne change pas.

Tant que cette étape n'est pas faite, le site affiche « Something went wrong. Please try again. »
(l'URL `/exec` ne sait pas encore répondre au site).

> Si vous publiez plus tard le projet avec `clasp push` depuis le dépôt `hamdi_italia`, clasp
> remplace tous les fichiers du projet : `HttpApi.gs` serait supprimé et le site cesserait de
> fonctionner. Ajoutez alors aussi `HttpApi.gs` dans `hamdi_italia/google-apps-script/`, ou
> recollez-le dans l'éditeur et republiez une version.

### 2. Activer GitHub Pages
Settings → **Pages** → *Build and deployment* → Source : **Deploy from a branch** →
branche `ccr-70deccce-a0w3wk` (ou `main` après fusion), dossier **/ (root)** → **Save**.
Le site apparaît sur https://polo565.github.io/ après une ou deux minutes.

## Fichiers

| Chemin | Rôle |
|---|---|
| `index.html`, `admin/index.html` | les deux pages |
| `assets/css/`, `assets/js/` | styles et scripts (un fichier par module, `?v=<hash>` contre le cache) |
| `assets/js/config.js` | **seul endroit** où se trouve l'URL de l'API (`API_URL`) |
| `apps-script/HttpApi.gs` | le fichier à ajouter au projet Apps Script (voir ci-dessus) |
| `tools/convert.js` | régénère le site à partir du frontend Apps Script de `hamdi_italia` |
| `tools/dev-server.js` | test local complet, sans déploiement (backend réel en mémoire) |
| `tools/smoke-test.js` | test navigateur (visiteur + admin) |
| `404.html`, `robots.txt`, `.nojekyll` | redirection des adresses inconnues, exclusion de `/admin/`, fichiers servis tels quels |

## Changer l'URL Apps Script
- **Nouvelle version** du même déploiement : rien à faire.
- **Nouveau déploiement** (nouvelle URL `/exec`) : modifier `API_URL` dans `assets/js/config.js`,
  relancer `node tools/convert.js <chemin vers hamdi_italia>` (met à jour le `?v=`), commit, push.

## Mettre à jour le site après une modification du frontend dans `hamdi_italia`
```bash
node tools/convert.js ../hamdi_italia      # régénère index.html, admin/, assets/
```
Le convertisseur échoue clairement si le code d'origine a changé à un endroit qu'il adapte
(`api()` et la navigation dans `shared/Ui.html`).

## Tester en local
```bash
node tools/dev-server.js ../hamdi_italia   # site :8810, API :8812, affiche un login admin local
node tools/smoke-test.js                    # dans un autre terminal (Playwright)
```
`dev-server.js` charge le backend `.gs` de `hamdi_italia` dans Node (avec les simulateurs
Google du dépôt) et imite la réponse de Google (redirection 302 + `Access-Control-Allow-Origin: *`).
Rien du backend n'est écrit dans ce dépôt.

## Limites connues
- Le site dépend de l'API Apps Script : mêmes quotas Google qu'avant.
- La langue, la session visiteur et la progression du guide sont stockées dans le navigateur
  pour `polo565.github.io` : elles sont distinctes de celles de l'ancienne adresse `script.google.com`.
- Les applications Android (Flutter) continuent d'ouvrir l'ancienne adresse `/exec`, qui reste
  en service (`doGet` n'est pas modifié).
