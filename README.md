# HAMDI ITALIE — site web (GitHub Pages)

Ce dépôt publie la plateforme **HAMDI ITALIE** sur `https://polo565.github.io/`.

Le site lui-même (pages, services, demandes, comptes, administration, documents Drive) reste
l'application **Google Apps Script** du projet [`polo565/hamdi_italia`](https://github.com/polo565/hamdi_italia),
qui n'est pas modifié. Ce dépôt n'est qu'une **coquille statique** qui affiche cette application en plein écran.

| Adresse | Affiche |
|---|---|
| `https://polo565.github.io/` | site visiteur (`…/exec`) |
| `https://polo565.github.io/#/services` | lien direct vers une page (`…/exec#/services`, `#/service/<slug>`…) |
| `https://polo565.github.io/admin/` | administration (`…/exec?app=admin`) — non indexée |

## Fichiers
- `assets/config.js` — **seul endroit** où se trouve l'URL Apps Script (`/exec`).
- `index.html`, `admin/index.html` — pages coquilles (écran de chargement en ar/fr/en, puis le site).
- `assets/shell.js` / `assets/shell.css` — chargement, transfert des liens `#/…`, bouton « ouvrir directement » si le chargement est lent.
- `404.html` — renvoie toute adresse inconnue vers l'accueil (ou `/admin/`).
- `robots.txt` — exclut `/admin/` des moteurs de recherche.

## Après un nouveau déploiement Apps Script
- **Nouvelle version** du même déploiement (même URL `/exec`) : rien à faire ici.
- **Nouveau déploiement** (nouvelle URL) : remplacer l'URL dans `assets/config.js`, commit, push.

## Activer GitHub Pages
Settings → Pages → *Build and deployment* → Source : **Deploy from a branch** →
choisir la branche qui contient ces fichiers, dossier **/(root)** → Save.

## Sécurité et limites
- Aucun secret ici ; tout contrôle (connexion admin, rôles, accès aux documents) est fait par le serveur Apps Script.
- Google peut afficher son bandeau « Cette application a été créée par un utilisateur de Google Apps Script » :
  il est ajouté par Google dans le cadre et ne peut pas être masqué depuis une page extérieure.
- La barre d'adresse de `polo565.github.io` ne suit pas la navigation interne (elle reste sur la page d'entrée) ;
  les liens directs `#/…` fonctionnent à l'ouverture.
- Les données du navigateur (langue choisie, session visiteur, progression du guide) sont celles du cadre
  Apps Script ; certains navigateurs les séparent de celles d'une visite directe sur `script.google.com`.
