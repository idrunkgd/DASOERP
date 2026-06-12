# Checklist screenshots — Manuel de formation Dasohub

Prends chaque capture **en taille réelle** (Cmd+Shift+4 sur Mac, puis sélection précise). Sauvegarde-les dans `docs/screenshots/` avec **exactement le nom indiqué** (sans changer l'extension `.png`).

Astuce : pour cacher tes vraies données sensibles, tu peux :
- Te connecter avec un compte "demo" rempli de données factices
- Ou prendre les captures sur des projets fictifs que tu crées juste pour l'occasion
- Ou flouter les noms clients après dans Preview Mac (Cmd+Shift+4 → ouvrir l'image → outil de marqueur)

---

## 1. Accueil & connexion (3 screenshots)

| Fichier | Contenu attendu |
|---------|-----------------|
| `01-login.png` | Page de login vide (déconnecte-toi avant) |
| `02-login-rempli.png` | Page de login avec email + password masqués remplis |
| `03-dashboard-vue-globale.png` | Le dashboard complet, KPIs en haut + sections en dessous |

## 2. Navigation (4 screenshots)

| Fichier | Contenu attendu |
|---------|-----------------|
| `04-sidebar-deroulee.png` | Sidebar entière visible, toutes les sections ouvertes |
| `05-topbar-recherche.png` | Topbar avec la barre de recherche bien visible (hint ⌘K à droite) |
| `06-palette-cmd-k.png` | Palette ⌘K ouverte avec rien dedans (juste la barre de recherche) |
| `07-palette-resultats.png` | Palette ⌘K avec une recherche genre "Zoetis" et résultats groupés par type |

## 3. Module Pilotage (5 screenshots)

| Fichier | Contenu attendu |
|---------|-----------------|
| `08-dashboard-kpis.png` | Vue rapprochée des KPIs en haut du dashboard |
| `09-project-status.png` | Page /project-status avec la grille de projets et leur consommation |
| `10-cashflow-vue-annee.png` | Page /cashflow complète, vue 12 mois × N lignes |
| `11-cashflow-kpis-en-cours.png` | Vue rapprochée des KPIs cashflow (En cours, Solde compte, Entrées, etc.) |
| `12-app-links.png` | Page /app-links avec dalles cliquables vers Coolify, Scaleway, etc. |

## 4. Module Commerciale (6 screenshots)

| Fichier | Contenu attendu |
|---------|-----------------|
| `13-companies-liste.png` | Liste des entreprises avec filtres |
| `14-company-fiche.png` | Fiche détail d'une entreprise (avec contacts, offres, projets liés) |
| `15-contacts-liste.png` | Liste des contacts |
| `16-contact-fiche.png` | Fiche détail d'un contact |
| `17-crm-kanban.png` | Page /test/crm vue complète du Kanban pipeline |
| `18-crm-card-detail.png` | Une carte du kanban en gros plan (avec ses boutons d'action) |

## 5. Module Consultance (8 screenshots)

| Fichier | Contenu attendu |
|---------|-----------------|
| `19-candidates-liste.png` | Liste des candidats avec filtres |
| `20-candidate-fiche.png` | Fiche détail d'un candidat (skills, expériences, scénarios) |
| `21-cv-parser.png` | Page /test/cv-parser avec drop zone et résultat parsing |
| `22-consultants-liste.png` | Liste des consultants internes |
| `23-mission-requests-liste.png` | Liste des demandes de mission |
| `24-mission-request-fiche.png` | Fiche d'une demande avec candidats proposés |
| `25-mission-fiche.png` | Fiche d'une mission active avec timesheets et milestones |
| `26-reviews-liste.png` | Page /reviews avec liste des entretiens |

## 6. Module Projet (12 screenshots)

| Fichier | Contenu attendu |
|---------|-----------------|
| `27-offers-liste.png` | Liste des offres avec filtres (uniquement les versions courantes) |
| `28-offer-creation-form.png` | Formulaire de création d'une nouvelle offre (TVA bien visible) |
| `29-offer-header.png` | Header d'une offre en édition (titre, statut, probabilité, TVA) |
| `30-offer-lines.png` | Section "Lignes de devis" d'une offre |
| `31-offer-options.png` | Section "Options" d'une offre avec un bloc déplié |
| `32-offer-milestones.png` | Section "Tranches de facturation" d'une offre |
| `33-offer-actions-dropdown.png` | Dropdown "Changer de statut..." ouvert avec les choix |
| `34-wizard-win-step1.png` | Page wizard /offers/[id]/win — section config projet |
| `35-wizard-win-step2.png` | Page wizard /offers/[id]/win — section dates de facturation |
| `36-project-fiche.png` | Fiche projet créée depuis le wizard, avec ses tranches |
| `37-project-milestones-dropdown.png` | Dropdown statut milestone ouvert avec "Facturée" visible |
| `38-timesheet-saisie.png` | Page /timesheet vue semaine avec cellules |

## 7. Module Finances (3 screenshots)

| Fichier | Contenu attendu |
|---------|-----------------|
| `39-finance-vue.png` | Page /finance avec liste des tranches de facturation |
| `40-tva-trimestrielle.png` | Page /test/tva avec récap d'un trimestre |
| `41-cashflow-modal-milestone.png` | Modal d'édition d'une cellule milestone dans cashflow (avec boutons "Marquer facturé" et "Marquer payé" visibles) |

## 8. Module RH & Documents (5 screenshots)

| Fichier | Contenu attendu |
|---------|-----------------|
| `42-onboarding-liste.png` | Page /onboarding avec grille d'onboardings en cours |
| `43-onboarding-fiche.png` | Fiche détail d'un onboarding avec checklist groupée par catégorie |
| `44-documents-liste.png` | Page /documents avec liste de fichiers et filtres |
| `45-documents-upload.png` | Formulaire d'upload de document avec drop zone bien visible |
| `46-document-fiche.png` | Fiche détail d'un document avec panneau Versions à droite |

## 9. Profil personnel & accès (3 screenshots)

| Fichier | Contenu attendu |
|---------|-----------------|
| `47-me-profil.png` | Page /me avec ses informations personnelles |
| `48-access-groups.png` | Page /access avec liste des groupes d'accès |
| `49-access-group-edit.png` | Page /access/groups/[id] avec permissions organisées par sidebar |
| `50-users-liste.png` | Page /users avec liste des utilisateurs |

---

## Total : 50 screenshots

Si tu veux gagner du temps, tu peux sauter ceux qui te paraissent les moins critiques. Mais les **20 premiers** sont vraiment essentiels.

## Format et nommage

- **Format** : PNG uniquement (pas JPG, pas WEBP)
- **Résolution** : taille native, pas de retina dégradé
- **Nommage** : strict, comme dans le tableau (chiffre à 2 digits + descriptif court + .png)
- **Dossier** : `docs/screenshots/`

Une fois toutes les captures dans le dossier, dis-le moi, je construis le site de formation autour.
