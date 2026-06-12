# Manuel de formation Dasohub — site web statique

Site web statique (HTML/CSS/JS pur, sans framework) pour former tes utilisateurs à Dasohub.

## Comment l'utiliser

### Pour consulter

Ouvre simplement `index.html` dans n'importe quel navigateur (double-clic depuis le Finder). Pas besoin de serveur web.

### Pour héberger

Tu peux uploader le dossier `training-site/` entier sur :

- **Coolify** : ajoute une nouvelle ressource type "Static Site" pointant vers ce dossier
- **Netlify / Vercel** : déploiement gratuit en quelques minutes
- **GitHub Pages** : si tu veux le rendre public à ton équipe seulement
- **Tes serveurs** : copie le dossier dans le webroot Apache/Nginx

## Structure

```
training-site/
├── index.html              ← Le manuel complet (1 seule page avec sections)
├── README.md               ← Ce fichier
├── styles/
│   └── main.css            ← Styles (palette Dasohub, responsive)
└── screenshots/            ← Tes captures d'écran (à remplir)
    ├── 01-login.png
    ├── 03-dashboard-vue-globale.png
    ├── ...
```

## Screenshots

**État actuel** : 26 mockups SVG ont été générés automatiquement (palette Dasohub + données factices Acme/Contoso/Globex/Initech). Ils suffisent pour former tes utilisateurs sur la disposition, le vocabulaire et les parcours. Le site est immédiatement utilisable.

Si tu veux remplacer les mockups par de vrais screenshots de production :
- Prends les `.png` selon `docs/CHECKLIST_SCREENSHOTS.md`
- Place-les dans `screenshots/` avec le **même nom de base** que les SVG (ex. `03-dashboard-vue-globale.png`)
- Remplace `.svg` par `.png` dans `index.html` (un simple `sed -i 's|\.svg"|.png"|g'`)

### Si tu repars de zéro

Le manuel référence ~30 captures d'écran. Tant qu'elles ne sont pas présentes, des placeholders s'affichent à leur place avec le nom de fichier attendu.

### Pour les prendre toi-même

1. Connecte-toi à https://hub.dasolabs.be
2. Pour chaque écran de la liste ci-dessous : <kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>4</kbd> → sélection rectangulaire → l'image va sur ton bureau
3. Renomme avec le **nom exact** attendu (voir `docs/CHECKLIST_SCREENSHOTS.md`)
4. Glisse dans `docs/training-site/screenshots/`

### Liste minimale (30 screenshots essentiels)

| Fichier | Page à capturer |
|---------|-----------------|
| `01-login.png` | Page de login (déconnecté) |
| `03-dashboard-vue-globale.png` | `/dashboard` complet |
| `04-sidebar-deroulee.png` | Sidebar visible |
| `06-palette-cmd-k.png` | ⌘K ouverte |
| `09-project-status.png` | `/project-status` |
| `10-cashflow-vue-annee.png` | `/cashflow` |
| `12-app-links.png` | `/app-links` |
| `13-companies-liste.png` | `/companies` |
| `15-contacts-liste.png` | `/contacts` |
| `17-crm-kanban.png` | `/test/crm` |
| `19-candidates-liste.png` | `/candidates` |
| `21-cv-parser.png` | `/test/cv-parser` |
| `26-reviews-liste.png` | `/reviews` |
| `27-offers-liste.png` | `/offers` |
| `34-wizard-win-step1.png` | Wizard win section 1 |
| `35-wizard-win-step2.png` | Wizard win section 2 |
| `36-project-fiche.png` | Fiche d'un projet |
| `38-timesheet-saisie.png` | `/timesheet` |
| `39-finance-vue.png` | `/finance` |
| `40-tva-trimestrielle.png` | `/test/tva` |
| `41-cashflow-modal-milestone.png` | Modal édit cellule cashflow |
| `42-onboarding-liste.png` | `/onboarding` |
| `43-onboarding-fiche.png` | Fiche d'un onboarding |
| `44-documents-liste.png` | `/documents` |
| `46-document-fiche.png` | Fiche d'un document |

Format : **PNG** (pas JPG), taille native.

## Personnalisation

### Changer les couleurs

Édite les variables CSS en haut de `styles/main.css` :

```css
:root {
  --midnight-900: #161922;     /* Texte principal */
  --indigoaccent: #5b5fd6;     /* Accent (boutons, liens) */
  /* ... */
}
```

### Ajouter une section

Dans `index.html` :

1. Ajoute un `<a class="nav-link">` dans la sidebar
2. Ajoute un `<section class="section" id="ton-id">` dans `<main>`
3. La section est automatiquement intégrée à la recherche et au scroll-spy

### Modifier le texte

Tu peux éditer directement le HTML (ou ses sections dans un éditeur). Pas de build, pas de compilation.

## Recherche

La recherche en haut de la sidebar filtre les sections dont le texte contient le mot recherché. Pas d'index externe, juste un filtre côté client en JavaScript.

## Imprimer

Tu peux imprimer le manuel via Cmd+P. Le CSS contient des règles `@media print` qui :

- Masquent la sidebar
- Réduisent les marges
- Évitent les coupures de screenshots à mi-image

Sauve en PDF si besoin pour distribuer.

## Maintenir le manuel

À chaque mise à jour majeure de Dasohub :

1. Refait les screenshots impactés
2. Édite les sections concernées dans `index.html`
3. Versionne dans Git

## Crédits

Généré pour Dasolabs en juin 2026 par Cowork.
Aucune dépendance externe, aucun framework, ~30 ko HTML+CSS+JS gzippé.
