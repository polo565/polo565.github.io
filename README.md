# HAMDI ITALIE

Plateforme d'information et d'assistance pour les immigrés et résidents étrangers en Italie
(ar / fr / en). **Tout le projet est dans ce dépôt** :

| Partie | Où | Hébergée par |
|---|---|---|
| Site visiteur | `index.html`, `assets/` | **GitHub Pages** → https://polo565.github.io/ |
| Administration | `admin/index.html`, `assets/` | **GitHub Pages** → https://polo565.github.io/admin/ |
| Backend (API) | `apps-script/` | **Google Apps Script** (projet `15qMipz3…`), lié au Google Sheet et au Drive |
| Applications Android | `apps/visitor`, `apps/admin`, `apps/shared` | Flutter (WebView du site GitHub Pages) |
| Tests | `tools/` | en local (Node) |

```
navigateur ──► polo565.github.io  (pages, styles, scripts)
                    │  POST JSON {fn, args}
                    ▼
          Apps Script …/exec  (apps-script/backend/HttpApi.gs → fonctions api_*)
                    ├── Google Sheets : base de données
                    └── Google Drive  : documents, images, pièces jointes
```

Pourquoi deux hébergeurs : GitHub Pages ne sert que des fichiers fixes. Il ne peut ni lire un
Google Sheet, ni garder un mot de passe, ni stocker en privé les demandes des visiteurs.
Apps Script fait ce travail **sans afficher aucune page** : c'est uniquement l'API.

Ce dépôt est **public** : il ne contient aucun secret, aucun identifiant de Sheet ou de dossier
Drive. Ces valeurs sont dans les *propriétés du script* (Apps Script), jamais dans le code.

## État (2026-11-18)
- ✅ Site en ligne sur GitHub Pages, branché sur l'API (déploiement `AKfycbxp2S…`, version 3).
- ✅ Vérifié en ligne : accueil (ar, RTL), 13 catégories, 132 services, guide, recherche, connexion admin (propriétaire).
- ✅ Applications Android 2.0.0 : ouvrent https://polo565.github.io/ (visiteur) et /admin/ (admin).
- ⏳ `SUPER_ADMIN_EMAIL` à ajouter dans les propriétés du script ; ancien projet Apps Script à supprimer.

Mise à jour du backend après une modification de `apps-script/` :
`cd apps-script && clasp push --force && clasp create-version "…" && clasp update-deployment AKfycbxp2S16sgQ1DFJfuXA0PpZRjRveazyH-K9VYlcKjYM6kGQ7uYHU7GtYe5yk4PqhJDVuug -V <n° de version>`
(ou dans l'éditeur : Déployer → Gérer les déploiements → ✏ → Nouvelle version).

---

## Mise en service (propriétaire) — déjà faite, gardée pour référence

### 1. Propriétés du nouveau projet Apps Script — AVANT toute autre chose
Ancien projet → ⚙ **Paramètres du projet** → *Propriétés du script* : noter **toutes** les valeurs.
Nouveau projet (`15qMipz3…`) → ⚙ **Paramètres du projet** → *Propriétés du script* : les recréer
à l'identique, en particulier :

| Propriété | Pourquoi |
|---|---|
| `PASSWORD_PEPPER` | **indispensable** : sans la même valeur, aucun mot de passe (admin, visiteur) ne fonctionne |
| `HASH_ITERATIONS` | réglage du hachage des mots de passe |
| `SPREADSHEET_ID` | le Google Sheet (base de données) |
| `DRIVE_ROOT_FOLDER_ID` | le dossier Drive HAMDI_ITALIE |
| `PRIVATE_UPLOADS_FOLDER_ID` | dossier privé des pièces jointes |
| `SUPER_ADMIN_EMAIL` | votre compte Google (propriétaire) |
| `OTP_SMS_PROVIDER`, `OTP_SMS_API_KEY` | seulement s'ils existent |

`setup()` refuse de démarrer si `PASSWORD_PEPPER` manque alors que le Sheet a déjà des
administrateurs : il ne crée jamais un nouveau « pepper » par-dessus vos comptes.

### 2. Envoyer le backend dans le nouveau projet (clasp)
```bash
npm install -g @google/clasp      # une seule fois
clasp login                       # une seule fois (compte propriétaire)
cd apps-script
clasp push --force                # remplace TOUS les fichiers du projet 15qMipz3… par ceux de apps-script/
```
(Activer d'abord l'API Apps Script : https://script.google.com/home/usersettings)

Les anciennes pages HTML copiées avec le projet sont supprimées : ce projet n'affiche plus de pages.

### 3. Initialiser puis déployer
1. Éditeur Apps Script → fonction **`setup`** → **Exécuter** (autoriser). Elle ajoute seulement
   ce qui manque (tâche quotidienne de confidentialité, colonnes manquantes) et ne modifie
   aucune donnée existante.
2. **Déployer → Nouveau déploiement** → type **Application Web** →
   *Exécuter en tant que* : **Moi** — *Qui a accès* : **Tout le monde** → **Déployer**.
3. Copier l'URL `https://script.google.com/macros/s/…/exec`.
   L'ouvrir dans le navigateur doit afficher `{"app":"HAMDI ITALIE","api":"ok",…}`.

### 4. Brancher le site sur l'API
Dans `assets/js/config.js`, coller l'URL dans `API_URL`, puis :
```bash
node tools/stamp.js     # met à jour les ?v= (évite l'ancien cache)
git commit -am "Set API URL" && git push
```

### 5. Activer GitHub Pages
Dépôt → **Settings → Pages** → *Source* : **Deploy from a branch** → branche par défaut,
dossier **/ (root)** → **Save**. Le site est en ligne après une ou deux minutes.

### 6. Supprimer l'ancien projet Apps Script
Seulement après avoir vérifié que la connexion admin fonctionne sur
https://polo565.github.io/admin/. Le Sheet et le Drive ne sont pas touchés.
Les applications Android (Flutter) ouvraient l'ancien projet : elles ne fonctionneront plus
tant qu'elles ne sont pas mises à jour vers https://polo565.github.io/.

---

## Modifier le projet

| Je veux modifier… | Fichier(s) | Ensuite |
|---|---|---|
| textes de l'interface | `assets/js/i18n.js`, `assets/js/visitor/strings.js`, `assets/js/admin/labels.js` | `node tools/stamp.js`, commit, push |
| apparence | `assets/css/…` | idem |
| pages / comportement | `assets/js/…`, `index.html`, `admin/index.html` | idem |
| logique serveur, sécurité, base | `apps-script/…` | `cd apps-script && clasp push --force`, puis **Déployer → Gérer les déploiements → ✏ → Nouvelle version** (l'URL ne change pas) |
| contenu (services, FAQ, prix, coordonnées…) | rien : depuis l'**administration** | — |

## Vitesse : copie publique et mémoire du navigateur

Chaque appel à Apps Script prend 1 à 5 s (démarrage du script par Google). Pour que les pages
s'affichent tout de suite, le contenu public est montré depuis la copie la plus rapide, puis
vérifié auprès de l'API en arrière-plan (`assets/js/ui.js`) :

1. mémoire de la visite → 2. mémoire du navigateur (visites précédentes) →
3. `data/*.json` sur GitHub Pages → 4. l'API.

Si l'API répond quelque chose de différent (modification faite dans l'admin), la page se met à
jour toute seule quelques secondes après. L'API reste la seule source de vérité.

`data/` contient l'accueil, le catalogue, le guide, les 13 catégories et les pages de services.
Les pages de services sont lues avec `api_getServicePage`, qui ne compte pas de vue ; le site
compte une vue (`api_countView`) chaque fois qu'une page de service est vraiment affichée.
Pas de mise à jour automatique (pas de commits automatiques) : pour rafraîchir la copie, par
exemple après de grosses modifications dans l'admin :
```bash
node tools/snapshot.js && git add data && git commit -m "Update public content snapshot" && git push
```
Une copie ancienne n'est jamais affichée longtemps : la réponse de l'API la remplace.

### Administration
Les données de l'admin sont privées : pas de copie publique et rien d'enregistré dans le
navigateur. Pour la vitesse (`adminApi` dans `assets/js/ui.js`, `prefetchSection` dans
`assets/js/admin/app.js`) :
- les tableaux de bord, listes et rapports déjà ouverts pendant la session s'affichent depuis la
  mémoire de la page, puis sont revérifiés en arrière-plan (au-delà de 15 s) et redessinés si
  besoin — jamais sur un formulaire, une fiche ouverte ou pendant la saisie ;
- toute écriture (enregistrer, supprimer, statut, paiement, connexion, déconnexion) vide cette
  mémoire ; la déconnexion aussi ;
- les formulaires de modification chargent toujours la fiche actuelle ;
- après le tableau de bord, les demandes, paiements, services et catégories sont préchargés ;
  pointer ou toucher une entrée du menu la précharge ;
- une liste charge ses données et ses listes de choix en même temps ; à la réouverture de
  l'admin, la session et le tableau de bord sont demandés en même temps.

## Applications Android (Flutter)

Deux petites applications qui affichent le site dans une WebView ; aucune logique ni secret dedans.

| Dossier | Application | Ouvre |
|---|---|---|
| `apps/visitor` | HAMDI ITALIE (`it.hamdiitalie.visitor`) | https://polo565.github.io/ |
| `apps/admin` | HAMDI Admin (`it.hamdiitalie.admin`) | https://polo565.github.io/admin/ |
| `apps/shared` | code commun : WebView, règles de navigation, textes ar/fr/en | — |

- Adresse du site : `apps/shared/assets/config.json` (`SITE_URL`), puis recompiler les deux APK.
- Seules les pages de `polo565.github.io` s'ouvrent dans l'application ; les autres liens
  (Drive, WhatsApp, téléphone, sites officiels) s'ouvrent dans l'application adaptée.
  L'application visiteur n'ouvre jamais `/admin/`.
- L'application admin enregistre les fichiers (documents, pièces jointes, CSV) dans
  `Téléchargements/HAMDI ITALIE` ; menu ⋮ → « Se déconnecter et effacer les données ».

Compiler (Flutter **3.47.9**, celle avec laquelle les applications ont été créées) :
```bash
cd apps/shared  && flutter test                 # 17 tests (navigation, configuration, fichiers)
cd ../visitor   && flutter build apk --release   # build/app/outputs/flutter-apk/app-release.apk
cd ../admin     && flutter build apk --release
```
Signature : sans `android/key.properties`, les APK sont signés avec la clé de *debug* de la
machine qui compile. Android refuse alors de mettre à jour une application signée par une autre
clé : désinstaller l'ancienne version d'abord. Pour une distribution durable (ou Google Play),
créer une clé de publication et la garder hors du dépôt (`key.properties`, `*.jks` sont ignorés).

## Tester en local (sans rien déployer)
```bash
node tools/test/run-tests.js      # 51 tests du backend (sécurité, demandes, paiements, RGPD, API…)
node tools/dev-server.js          # site http://127.0.0.1:8810 + API locale ; affiche un login admin de test
node tools/smoke-test.js          # (autre terminal) test navigateur visiteur + admin, Playwright
```
Le serveur local exécute le vrai code de `apps-script/` dans Node, avec des simulateurs Google en mémoire.

## Fichiers
```
index.html, admin/index.html   les deux pages
assets/js/config.js            URL de l'API (seul réglage du site)
assets/js/*.js, assets/css/    interface (design neumorphique, ar/fr/en, RTL)
apps-script/                   backend : Code.gs (statut), backend/HttpApi.gs (API JSON), backend/*.gs, config/*.gs
tools/test/                    tests du backend + simulateurs Google
tools/dev-server.js            serveur de test local
tools/smoke-test.js            test navigateur
tools/stamp.js                 met à jour les ?v= anti-cache
tools/snapshot.js              copie publique du contenu (data/)
data/                          copie publique : accueil, catalogue, guide, catégories
apps/                          applications Android (Flutter)
404.html, robots.txt, .nojekyll
```
