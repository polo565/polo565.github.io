# MEMORY — HAMDI ITALIE (suite de la conversation)

> Pour Claude (ou toute personne) qui reprend ce projet en local : lis ce fichier en entier
> avant de travailler, puis `README.md` pour le détail technique.
> Dépôt **public** : ce fichier ne contient aucun secret ni identifiant privé (Sheet, Drive,
> mots de passe). Ne jamais en ajouter ici.
> Dernière mise à jour : 2026-11-19.

---

## 1. Le propriétaire et sa façon de travailler

- **Langue : répondre en français**, simplement et clairement. Le site lui-même est en arabe
  (par défaut, de droite à gauche), français et anglais. L'italien a été retiré.
- Le propriétaire travaille souvent **depuis son téléphone** : préférer des instructions courtes,
  des liens cliquables, et faire soi-même ce qui peut l'être.
- **Pas de commits automatiques** (refusé explicitement) : pas de GitHub Action qui commite ou
  pousse tout seul. La copie publique `data/` se rafraîchit à la main.
- **Ne pas toucher au dépôt d'origine `polo565/hamdi_italia`** (privé). Tout se passe ici,
  dans `polo565/polo565.github.io` (public).
- Le propriétaire a donné son accord pour que Claude fasse les modifications, les commits,
  les pushs et les déploiements nécessaires. Toujours expliquer ce qui a été fait, tester avant
  de dire « c'est fini », et ne jamais inventer un résultat.
- Le cahier des charges complet d'origine (spécification du projet) est dans
  `hamdi_italia/CLAUDE.md` : ses règles restent valables (pas de faux rendez-vous officiel,
  pas de conseil juridique inventé, RGPD, paiement en espèces d'abord, etc.).

## 2. Ce qu'est le projet aujourd'hui

Plateforme d'information et d'assistance pour les immigrés en Italie : 13 catégories,
132 services, guide nouveaux immigrants, demandes d'assistance avec suivi, comptes visiteurs
optionnels, paiements (espèces d'abord), administration complète.

```
navigateur / applis Android
      │
      ▼
https://polo565.github.io/          (GitHub Pages : index.html, admin/, assets/, data/)
      │  fetch POST {fn, args}  (text/plain, sans cookies)
      ▼
Google Apps Script …/exec           (dossier apps-script/ : API JSON uniquement, aucune page)
      ├── Google Sheet  : base de données
      └── Google Drive  : documents, images, pièces jointes
```

- **Site visiteur** : https://polo565.github.io/
- **Administration** : https://polo565.github.io/admin/ (connexion vérifiée par le serveur)
- **Backend** : projet Apps Script `15qMipz3…` (voir `apps-script/.clasp.json`),
  déploiement Web App `AKfycbxp2S…` (l'URL complète est dans `assets/js/config.js`),
  **version 5** déployée. « Exécuter en tant que : Moi », « Accès : Tout le monde ».
- **Branche** : `ccr-70deccce-a0w3wk` = branche par défaut du dépôt = branche publiée
  par GitHub Pages (dossier racine). Tout ce qui y est poussé est **en ligne ~30 s après**.
- **Applications Android** (Flutter, `apps/`) : version 2.0.0, ouvrent le site GitHub.

## 3. Historique (ce qui a été fait, dans l'ordre)

1. Au départ, tout le projet tournait dans Google Apps Script (pages HtmlService) depuis le
   dépôt `hamdi_italia`. Le propriétaire a voulu l'héberger sur GitHub.
2. Première tentative (abandonnée) : une simple page GitHub qui affichait l'ancien site dans un
   cadre. Le propriétaire n'en voulait pas : il voulait un vrai site GitHub.
3. Conversion réelle : le frontend est devenu des fichiers statiques (HTML/CSS/JS) ici ; le
   backend Apps Script est devenu une **API JSON** (`apps-script/backend/HttpApi.gs`, `doPost`,
   seules les fonctions `api_*` sont appelables). Les identifiants privés (Sheet, Drive) ont été
   retirés du code : ils sont dans les **propriétés du script** Apps Script.
4. Le propriétaire a créé une **copie** du projet Apps Script (`15qMipz3…`) ; Claude y a envoyé
   le nouveau backend avec `clasp` (autorisation donnée par le propriétaire depuis son téléphone,
   puis effacée de l'environnement cloud). Connexion admin vérifiée par le propriétaire : OK.
5. **Applications Android** copiées dans `apps/` et adaptées au site GitHub (version 2.0.0,
   compilées avec Flutter 3.47.9, APK envoyés au propriétaire, signés avec une clé de test).
6. **Vitesse visiteurs** : copie publique `data/*.json` (accueil, catalogue, guide,
   13 catégories, 132 services) + mémoire du navigateur + vérification de l'API en arrière-plan.
   Backend version 5 : `api_getServicePage` (page service sans compter de vue) et
   `api_countView` (une vue par page réellement affichée).
7. **Vitesse admin** : mémoire de session uniquement (rien d'enregistré dans le navigateur),
   préchargement des sections principales, chargements en parallèle.
8. Discussions sur l'IA (voir § 7) : **rien n'est encore construit**, en attente de décision.

Mesures (site en ligne) : accueil 1,2 s (avant 2–5 s) · catégorie 0,3 s · page service 0,4 s
(avant 2–6 s) · guide 0,15 s · page déjà vue 0,07 s. Admin (test local, API à 3 s) : écrans
préchargés ou déjà vus < 0,03 s (avant 3 s) ; modifier un service 3 s (avant 6 s) ;
réouverture 3,4 s (avant 6 s) ; première connexion toujours ~6 s (deux appels obligatoires).

## 4. Règles à ne jamais oublier (pièges réels)

- **Ne plus jamais déployer depuis l'ancien dossier `hamdi_italia`** (`push-gas.ps1` ou
  `clasp push`) : `clasp push` remplace TOUS les fichiers du projet Apps Script ; l'ancien code
  n'a pas `doPost` et le site GitHub cesserait de fonctionner. Le backend se déploie depuis
  `apps-script/` de ce dépôt.
- **Ordre de déploiement** : si le site appelle une nouvelle fonction de l'API, **déployer le
  backend d'abord**, puis pousser le site — ou rendre le site compatible avec l'ancienne API
  (exemple : `publicFetch` dans `assets/js/ui.js` retombe sur `api_getService` si
  `api_getServicePage` n'existe pas). Pousser sur la branche = mise en ligne immédiate.
- **Dépôt public** : jamais de secret, d'identifiant de Sheet/Drive, de mot de passe, d'e-mail
  personnel, ni de clé API dans le code, les commits ou ce fichier. Les secrets vont dans
  Apps Script → Paramètres du projet → Propriétés du script.
- **`PASSWORD_PEPPER`** (propriété du script) doit rester identique à celle qui a créé les
  comptes, sinon plus aucun mot de passe ne marche. `setup()` refuse d'en créer un nouveau
  par-dessus des administrateurs existants.
- **Après une modification dans `assets/`** : `node tools/stamp.js` (met à jour les `?v=`
  anti-cache dans `index.html` et `admin/index.html`).
- **Données admin** : privées → jamais dans `localStorage`/`sessionStorage` (seul le jeton de
  session est en `sessionStorage`), jamais dans `data/`. Les formulaires de modification lisent
  toujours la fiche actuelle (le serveur ne détecte pas les modifications concurrentes).
- **Compteur de vues** : ne pas appeler `api_getService` pour des copies ou des tests de masse
  (il compte une vue) ; utiliser `api_getServicePage`.
- **Flutter** : utiliser **3.47.9** (3.50 exige un autre plugin Android). Les APK sont signés
  avec une clé de *debug* : désinstaller l'ancienne appli avant d'installer la nouvelle.
- La copie publique `data/` peut être un peu ancienne : ce n'est pas grave, la réponse de
  l'API la remplace en 1–3 s. La rafraîchir à la main après de grosses modifications.

## 5. Où est quoi

| Chemin | Rôle |
|---|---|
| `index.html`, `admin/index.html` | les deux pages (ne pas éditer les `?v=` à la main : `tools/stamp.js`) |
| `assets/js/config.js` | **seul réglage** : URL de l'API (`API_URL`) |
| `assets/js/ui.js` | `api()` : appels API, copie publique (`publicRead`…), mémoire admin (`adminApi`…) |
| `assets/js/visitor/*.js` | pages visiteur (accueil, services, demande, compte, guide) |
| `assets/js/admin/*.js` | administration (`app.js` routage + préchargement, `engine.js` listes/formulaires, `sections.js` configuration des sections, `ops.js` demandes/paiements/rapports, `drive.js` documents) |
| `assets/js/i18n.js`, `visitor/strings.js`, `admin/labels.js` | textes ar / fr / en |
| `data/` | copie publique du contenu (générée par `tools/snapshot.js`) |
| `apps-script/` | backend Apps Script (`backend/HttpApi.gs` = API JSON, `Code.gs` = statut `doGet`) |
| `apps/shared`, `apps/visitor`, `apps/admin` | applications Android Flutter |
| `tools/test/run-tests.js` | 52 tests du backend (simulateurs Google en mémoire) |
| `tools/dev-server.js` | site + API en local (http://127.0.0.1:8810), affiche un login admin de test |
| `tools/smoke-test.js` | test navigateur visiteur + admin (Playwright) |
| `tools/snapshot.js` | rafraîchit `data/` depuis l'API en ligne |
| `tools/stamp.js` | anti-cache des fichiers `assets/` |

## 6. Commandes courantes (Windows / PowerShell, depuis la racine du dépôt)

```powershell
node tools/test/run-tests.js                 # tests backend (doivent tous passer)
node tools/dev-server.js                     # test local complet
node tools/smoke-test.js                     # (autre terminal) test navigateur
node tools/stamp.js                          # après modification de assets/
node tools/snapshot.js                       # rafraîchir data/, puis commit + push

# Déployer le backend (garde la même URL) :
cd apps-script
clasp push --force
clasp create-version "description"
clasp update-deployment <ID du déploiement AKfycbxp2S…, voir config.js> -V <nouveau numéro>

# Applications Android :
cd apps\shared ; flutter test
cd ..\visitor ; flutter build apk --release
cd ..\admin   ; flutter build apk --release
```

## 7. Décisions en attente et prochaines étapes

**À faire par le propriétaire**
- [ ] Ajouter la propriété du script `SUPER_ADMIN_EMAIL` (son adresse Google) dans le projet
      Apps Script `15qMipz3…` (sinon `setup` refuse de se lancer depuis l'éditeur).
- [ ] Tester les APK 2.0.0 sur le téléphone (accueil, service, retour, demande avec pièce jointe ;
      admin : connexion, téléchargement d'un document vers `Téléchargements/HAMDI ITALIE`).
- [ ] Ensuite seulement : supprimer l'ancien projet Apps Script (le Sheet et le Drive ne sont pas
      touchés). Les anciennes applis (1.0) cesseront alors de fonctionner.
- [ ] Plus tard : créer une vraie clé de signature Android (à garder hors du dépôt) avant de
      distribuer les applis ou de publier sur Google Play.
- [ ] Facultatif : retirer l'accès « clasp » dans myaccount.google.com/permissions.

**Proposé, en attente de réponse**
1. **Réponse automatique SANS IA** (recommandée en premier) : à chaque demande, Apps Script
   envoie au visiteur les documents, le bureau compétent et les liens officiels **du service
   choisi** (données déjà dans l'admin), avec la mention « ceci n'est pas un rendez-vous
   officiel ». Gratuit, immédiat, sans risque RGPD. **Question en attente : par quel canal ?
   e-mail, page de suivi, ou les deux.** Nécessite un déploiement backend (`clasp`).
2. **Notifications sur le téléphone** quand le statut d'une demande change : Firebase Cloud
   Messaging (gratuit) dans les applis Android. Facultatif.
3. **IA plus tard, seulement pour les messages en texte libre**, appelée directement depuis
   Apps Script (`UrlFetchApp`, pas de n8n) :
   - l'IA ne choisit des liens **que dans la liste fournie** ; le serveur rejette tout autre lien ;
   - réponse au format fixe (structured output) ; cas sensibles (asile, recours, éligibilité)
     **toujours validés par l'admin** ; boutons Envoyer / Modifier / Ignorer dans l'admin ;
   - envoyer le minimum à l'IA : ni nom, ni téléphone, ni e-mail, ni pièce jointe ;
   - clé API dans les propriétés du script (le propriétaire la colle lui-même) ;
   - mettre à jour la politique de confidentialité (à faire relire).
   - **Choix du modèle** : recommandation Claude **Haiku 5.5** (`claude-haiku-5-5`, le moins
     cher : ~0,001 $ par demande) ou Opus 5.5 (`claude-opus-5-5`, ~0,05 $) ; faire d'abord un
     **test à l'aveugle** sur ~30 vraies demandes anonymisées. DeepSeek a été comparé : pas moins
     cher que Haiku 5.5, et sa politique indique un stockage des données **en Chine** (problème
     RGPD sérieux pour ce public) → déconseillé.
   - n8n et Firebase ne sont **pas nécessaires** pour ça : Apps Script suffit.

## 8. Comment reprendre

1. `git pull` dans ce dossier.
2. Lire ce fichier, puis `README.md`.
3. Lancer `node tools/test/run-tests.js` pour vérifier que tout passe.
4. Demander au propriétaire laquelle des étapes du § 7 il veut faire maintenant.
5. Mettre à jour **ce fichier** (§ 3 et § 7) à la fin de chaque étape importante.
