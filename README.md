# Dasolabs ERP

Outil interne **Dasolabs** : gestion commerciale, offres, projets, timesheets, achats, planning, charge équipe et tranches de facturation. La facturation finale reste gérée dans **Peppol** — l'application prépare et suit les tranches.

## Stack

| Couche | Technologie |
|---|---|
| Frontend | **Next.js 14** (App Router) + React 18 + TypeScript strict |
| Styles | **Tailwind 3** + shadcn-style composants maison |
| Backend | Next.js Server Actions + API Routes |
| ORM | **Prisma 5** |
| BDD | **PostgreSQL 16** |
| Auth | **NextAuth v4** (Credentials) + bcrypt + JWT |
| Validation | **Zod** |
| Tests | **Vitest** |
| Exports | xlsx-style CSV (BOM Excel-compat), `pdf-lib` pour devis |
| Containers | **Docker** + docker-compose |

> Pourquoi Next.js fullstack plutôt que NestJS séparé ? Une seule app, un seul déploiement, validation Zod partagée FE/BE, Server Actions = moins de boilerplate REST, plus simple à maintenir pour une petite équipe. Une extraction NestJS reste possible plus tard si un service de fond (workers timesheet, intégration Peppol) devient nécessaire.

## Démarrage rapide

### Pré-requis

- Node.js 22+
- Docker (recommandé pour PostgreSQL) ou Postgres 14+ local

### 1. Cloner et installer

```bash
cd app
npm install
cp .env.example .env
```

Éditer `.env` :

```
DATABASE_URL="postgresql://dasolabs:dasolabs@localhost:5432/dasolabs?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"
SEED_ADMIN_EMAIL="admin@dasolabs.com"
SEED_ADMIN_PASSWORD="Admin123!"
```

### 2. Lancer PostgreSQL (Docker)

```bash
docker compose up -d db
```

### 3. Migrations + seed

```bash
npm run db:migrate   # crée la BDD selon le schéma Prisma
npm run db:seed      # insère utilisateurs et données de démonstration
```

### 4. Lancer l'app

```bash
npm run dev
```

→ http://localhost:3000

### Comptes de démonstration

| Rôle | Email | Mot de passe |
|---|---|---|
| Admin | admin@dasolabs.com | Admin123! |
| Manager | manager@dasolabs.com | Manager123! |
| Consultant | alex@dasolabs.com | Consult123! |
| Consultant | yasmine@dasolabs.com | Consult123! |
| Finance | finance@dasolabs.com | Finance123! |

## Lancement Docker (full stack)

```bash
docker compose up --build
docker compose exec app npx prisma migrate deploy
docker compose exec app npm run db:seed
```

→ http://localhost:3000

## Commandes utiles

```bash
npm run dev           # serveur Next.js en dev
npm run build         # build production
npm run start         # serve build
npm run typecheck     # tsc strict (pas d'émission)
npm run lint          # ESLint Next
npm run test          # Vitest (calculs métier, RBAC, CSV)

npm run db:generate   # prisma generate (client TS)
npm run db:migrate    # nouvelle migration dev + apply
npm run db:deploy     # apply en prod (CI / docker)
npm run db:reset      # ⚠ drop + recrée + seed
npm run db:seed       # seed seul
npm run db:studio     # Prisma Studio GUI
```

## Architecture

```
app/
├── prisma/
│   ├── schema.prisma          # Modèle complet (User, Company, Contact, Offer, OfferLine,
│   │                          #  BillingMilestone, Project, ProjectMember, TimesheetEntry,
│   │                          #  Purchase, PlanningEntry, Attachment, ActivityLog…)
│   └── seed.ts                # Données démo Dasolabs
├── src/
│   ├── app/
│   │   ├── (auth)/login/      # Page de connexion
│   │   ├── (app)/             # Layout authentifié (sidebar + topbar)
│   │   │   ├── dashboard/
│   │   │   ├── companies/
│   │   │   ├── contacts/
│   │   │   ├── offers/        # Lignes éditables + tranches + transitions
│   │   │   ├── projects/      # Auto-créé depuis offre WON
│   │   │   ├── timesheet/     # Vue semaine + soumission/validation
│   │   │   ├── purchases/
│   │   │   ├── planning/      # Charge équipe semaine
│   │   │   ├── users/
│   │   │   ├── finance/       # Tranches Peppol
│   │   │   └── settings/      # Audit log
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/    # NextAuth handler
│   │   │   ├── search/                # Recherche globale
│   │   │   └── exports/               # CSV + PDF devis
│   │   ├── layout.tsx · page.tsx · globals.css
│   ├── components/
│   │   ├── layout/   (Sidebar, Topbar)
│   │   ├── ui/       (PageHeader, KpiCard, StatusBadge, EmptyState, Confirm…)
│   │   └── providers.tsx
│   ├── lib/
│   │   ├── db.ts          # Singleton PrismaClient
│   │   ├── auth.ts        # Config NextAuth + augment Session
│   │   ├── rbac.ts        # Rôles, permissions, helpers requirePermission
│   │   ├── calc.ts        # Règles métier purement fonctionnelles
│   │   ├── audit.ts       # logActivity(...)
│   │   ├── references.ts  # Génération OFF-AAAA-NNNN, PRJ-AAAA-NNNN
│   │   ├── csv.ts         # toCSV() + Response helper
│   │   └── utils.ts       # cn(), formatCurrency(), formatDate()…
│   ├── server/
│   │   ├── actions/  # Server Actions (companies, contacts, offers, projects,
│   │   │             #   timesheets, purchases, planning, users, project-milestones)
│   │   └── services/ # Logique transactionnelle (offer-service, project-service,
│   │                 #   load-service)
│   └── middleware.ts # Protection des routes via NextAuth
└── tests/  (calc.test.ts, rbac.test.ts, csv.test.ts)
```

## Modules

### 1. Dashboard
KPIs : pipeline pondéré, offres en cours/gagnées/perdues, projets actifs, marges (estimée + réelle), heures semaine, achats engagés, tranches à venir 30j. Bandeau d'alertes (projets en dépassement, tranches en retard, utilisateurs surchargés).

### 2. Entreprises (CRUD)
Statuts : `PROSPECT / CLIENT / PARTNER / SUPPLIER`. Fiche détail avec contacts, offres et projets associés.

### 3. Contacts (CRUD)
Rattachement entreprise, tags libres, **timeline d'interactions** (note/appel/email/réunion).

### 4. Offres
- Référence auto `OFF-AAAA-NNNN`
- Lignes éditables inline (type, qté, unité, PU vente, PU coût, remise) → totaux & marge **recalculés serveur** à chaque mutation
- Tranches de facturation (libellé, %, montant, date prévue, déclencheur, statut)
- Statuts `DRAFT → SENT → NEGOTIATION → WON | LOST | CANCELLED`
- **Transition WON → création automatique du projet + copie tranches & lignes** (transactionnelle)
- Duplication d'offre, export PDF devis (`pdf-lib`), export CSV par offre

### 5. Projets
- Référence auto `PRJ-AAAA-NNNN`
- Création auto depuis offre **ou** manuelle
- Suivi budget vendu / consommé / temps prévu vs réel / achats / marge réelle / avancement
- Équipe projet (membres + rôle)
- Tranches de facturation rattachées au projet
- Bouton **Recalculer** : `marge réelle = budget vendu - coût temps validés - achats reçus/payés`
- Alertes dépassement budget/temps

### 6. Timesheet
- **Vue semaine** avec navigation, totaux journaliers, indicateur de jour > 8h
- 9 catégories d'activité
- Workflow `DRAFT → SUBMITTED → APPROVED | REJECTED`
- Validation par manager (avec note de refus)
- Coût interne calculé à la validation : `heures × hourlyCost utilisateur` → **impacte la marge réelle du projet**

### 7. Achats projet
- Catégories : matériel, licence, sous-traitance, déplacement, formation, autre
- Statuts `PLANNED → ORDERED → RECEIVED → PAID`
- Achats `RECEIVED` ou `PAID` impactent la marge réelle projet

### 8. Planning + charge
- Création d'affectations (utilisateur × projet × période, h/jour ou % charge)
- **Vue charge équipe** semaine en cours avec barre de progression et détection de surcharge
- Comparaison à la capacité hebdo de l'utilisateur

### 9. Utilisateurs
- CRUD complet, rôles, taux interne, capacité, compétences
- Activation/désactivation
- Vue charge planifiée semaine sur la fiche

### 10. Finance / Tranches
- Vue agrégée : KPI prévu/prêt/transmis/payé/en retard
- Filtres par statut, client, dates
- Transitions de statut Peppol traçées (`transmittedAt`, `paidAt`)
- Export CSV pour Peppol/comptable

### 11. Recherche globale
Topbar : entreprises, contacts, offres, projets, achats, utilisateurs (filtré par permissions de l'utilisateur).

### 12. Audit trail
Toutes les actions importantes sont tracées dans `ActivityLog` : create/update/delete, changements de statut, soumissions/validations timesheet, transitions de tranches. Visible dans **Paramètres**.

## Rôles & permissions

| Permission | ADMIN | MANAGER | COMMERCIAL | CONSULTANT | FINANCE |
|---|:-:|:-:|:-:|:-:|:-:|
| `users.manage` | ✓ | | | | |
| `settings.manage` | ✓ | | | | |
| `companies.write` | ✓ | ✓ | ✓ | | |
| `offers.write` | ✓ | ✓ | ✓ | | |
| `projects.write` | ✓ | ✓ | | | |
| `timesheet.self.write` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `timesheet.validate` | ✓ | ✓ | | | |
| `purchases.write` | ✓ | ✓ | | | ✓ |
| `planning.write` | ✓ | ✓ | | | |
| `finance.write` | ✓ | | | | ✓ |

Toutes les Server Actions appellent `requirePermission(...)` côté serveur ; les liens de navigation sont filtrés côté client. Validation Zod systématique sur l'entrée.

## Règles métier automatisées

- **Offre WON** → projet créé en transaction Prisma : reprend entreprise, contacts, budgets vente/coût, marge estimée ; les tranches passent du `offerId` au `projectId`. Audit trail : `OFFER_WON` + `PROJECT_CREATED_FROM_OFFER`.
- **Recalcul lignes/totaux offre** à chaque add/update/delete d'une ligne (`recomputeOfferTotals`).
- **Recalcul projet** à chaque validation de timesheet ou mutation d'achat (`recomputeProject`) :
  - `actualTimeH` = somme heures `APPROVED`
  - `actualTimeCost` = `Σ(hours × user.hourlyCost)`
  - `actualPurchaseCost` = `Σ(amount where status ∈ {RECEIVED, PAID})`
  - `marginActual = budgetSell - actualTimeCost - actualPurchaseCost`
  - `progressPct = min(100, actualTimeH / budgetTimeH × 100)`
- **Détections** : projets en dépassement, tranches en retard, utilisateurs en surcharge (vues dashboard).

## Tests

```bash
npm run test
```

Couvre :
- `calc.ts` — calculs lignes, totaux offre, marge projet, génération de référence
- `rbac.ts` — matrice de permissions par rôle
- `csv.ts` — encodage CSV (BOM, échappement)

## Sécurité

- Mots de passe hashés (bcrypt, salt 10)
- Sessions JWT (NextAuth)
- Toutes les routes `/(app)` protégées via `middleware.ts` + double-check serveur via `requireSession`/`requirePermission`
- Validation Zod sur **toutes** les Server Actions
- Aucun secret en dur — tout via `.env`
- `NEXTAUTH_SECRET` à régénérer en prod (`openssl rand -base64 32`)

## Itération 2 — changements importants

- **ServiceProfile** : catalogue de profils (Junior / Senior / Lead / Analyst…) avec coûts et prix de vente standards par jour et par heure. Module CRUD `/service-profiles`.
- **CostCenter** : centres de coût internes (Sales, Congés, Réunion, Admin, Formation, R&D…). Module CRUD `/cost-centers`. Timesheets et Planning peuvent désormais référencer un projet **OU** un centre de coût.
- **Lignes d'offre refondues** : deux tableaux distincts.
  - **Services** : sélection d'un profil (auto-remplit PU vente et PU coût), total = qté × PU, marge auto sans saisie.
  - **Autres** : description libre + qté + PU + **marge %** (pas de type prédéfini, le coût est dérivé du % de marge).
- **Tranches** : si vous saisissez un pourcentage, le montant se calcule automatiquement à partir du total HT de l'offre. Un badge en haut du tableau indique en temps réel **= 100 % ?**, avec le delta exact en cas d'écart (manque ou excès).
- **Tranches héritées** : la création de projet depuis une offre WON migre automatiquement les tranches vers le projet (déjà en place).
- **Planning mensuel visuel** : grille mois × utilisateurs avec sélection multi-jours (mouse-down + drag) qui ouvre une modale d'affectation (projet ou centre de coût).
- **Audit trail global** `/audit` : page filtrable (entité, action, acteur, date, recherche texte) avec **diff structuré before/after** sur chaque mutation. Le helper `logActivity({ before, after })` calcule automatiquement les champs modifiés.
- **Import CSV entreprises** `/companies/import` : preview des lignes, parser tolérant (`,` `;` `\t`), reconnaissance d'en-têtes FR ou EN, match sur TVA puis sur nom, rapport détaillé (créées/màj/erreurs).
- **Module Commercial** `/commercial` : timeline agrégée de toutes les interactions contacts, filtrable par utilisateur / type / période / texte.
- **Sidebar** réorganisée en sections (Pilotage / Commercial / Delivery / Finance / Configuration).
- **Headers de tables** alignés correctement avec leur colonne (numérique → droite).

## Itération 3 — Mode Projet vs Mode Consultance

### Mode Projet (forfait, déjà existant — enrichi)
- Champ `mode = PROJECT` sur l'offre, repris automatiquement sur le projet créé.
- **Compléments d'offre** : depuis la fiche d'une offre racine, bouton **+ Complément** crée une nouvelle offre référencée `OFF-2026-0001-C1`, `-C2`… (compteur auto).
- Quand un complément passe en **WON** :
  - si l'offre parente a déjà un projet → les budgets (vente, coût, marge) du projet sont **incrémentés** et les tranches du complément sont **migrées** vers ce projet ;
  - sinon, un projet dédié est créé.
- Tranches définies à la signature, calcul %/montant auto, validation 100 %.

### Mode Consultance (T&M, nouveau)
Pipeline complet **Demande de mission → Présentations → Entretiens → Sélection → Offre Consulting → Projet T&M → Facturation timesheet**.

- **Demandes de mission** `/missions` : référence `DEM-2026-0001`, profil recherché (séniorité, compétences, localisation), tarif cible/max, dates et durée estimée. Statuts `NEW → QUALIFYING → PRESENTING → CONTRACTED | LOST | CANCELLED`.
- **Candidats** `/candidates` : vivier avec coordonnées, LinkedIn, compétences, langues, années d'expérience, séniorité, **taux freelance** (cout/j et /h), tarif minimum souhaité, dispo, statut `ACTIVE / ENGAGED / UNAVAILABLE / ARCHIVED`.
- **Présenter un candidat** sur une mission depuis la fiche mission : crée une `MissionApplication` avec snapshot du coût et tarif négocié au client. La marge daily (vente − coût) s'affiche en temps réel.
- **Suivi candidature** : statuts `PRESENTED → INTERVIEW_SCHEDULED → INTERVIEWED → SHORTLISTED → SELECTED | REJECTED | WITHDRAWN`. Auto-transition fluide (créer un entretien fait passer en INTERVIEW_SCHEDULED, marquer un entretien PASSED bumpe en INTERVIEWED).
- **Entretiens** : date, type (Phone / Video / On-site / Technical / HR), interviewers, lieu, feedback, outcome (PENDING / PASSED / FAILED / CANCELLED).
- **Sélection automatique** : marquer une candidature `SELECTED` rejette automatiquement les autres candidatures de la mission (raison "Autre candidat sélectionné"), passe la mission en `CONTRACTED` et le candidat en `ENGAGED`.
- **Conversion en offre** : bouton **Créer l'offre Consulting** sur l'application sélectionnée → génère une offre `mode = CONSULTING` liée à la mission + application, avec une ligne "Prestation consultance" basée sur le tarif négocié × jours estimés.
- **Projet T&M** : projet créé en mode CONSULTING, sans tranches forfaitaires. Bouton **Générer tranche T&M** sur la fiche projet : agrège les heures validées du mois × tarif jour de l'offre source (8 h/jour) → crée/upsert une `BillingMilestone` "T&M Mois Année" à transmettre dans Peppol.

### Sécurité Consultance
Nouvelle permission `consulting.read` / `consulting.write`. Accordée à ADMIN, MANAGER, COMMERCIAL. Les CONSULTANT et FINANCE n'ont pas accès au pipeline RH par défaut.

## Itération 4 — Verrous, versioning, grille timesheet, suivi consultants

### Offre verrouillée + versioning
- **Une offre n'est modifiable qu'en statut `DRAFT`.** Dès qu'elle passe en `SENT`, le formulaire entête, les lignes et les tranches deviennent **lecture seule** (fieldsets désactivés, boutons d'ajout masqués). Toute tentative de mutation côté serveur lève une `OfferLockedError` (garde-fou dans `assertOfferEditable` / `assertLineEditable` / `assertMilestoneEditable`).
- **Statuts finaux figés** : `WON`, `LOST`, `CANCELLED` — aucune modification, ni complément, ni suppression (sauf LOST/CANCELLED).
- **Bouton "Nouvelle version" (V+1)** disponible uniquement en `SENT` ou `NEGOTIATION` : clone l'intégralité de l'offre (lignes, tranches, contacts) en `DRAFT`, référence `OFF-2026-0001-V2` (puis V3, V4…). L'offre précédente conserve toute son historique mais devient lecture seule, avec un lien vers la nouvelle version. Une seule version "next" autorisée par offre.
- Bandeau de verrouillage explicatif en haut de la fiche offre selon le statut.
- Tests `tests/offer-rules.test.ts`.

### Timesheet — grille double entrée + visibilité équipe
- **Visibilité projets** : un consultant ne voit que les projets dont il est `ProjectMember`. Admin/Manager (rôle disposant de `timesheet.validate`) voient tous les projets actifs pour leurs propres saisies.
- **Vue grille** : tableau lignes × jours, façon Excel.
  - Lignes = projets équipe + centres de coût
  - Colonnes = 7 jours de la semaine (week-end grisé, jour courant surligné)
  - Cellules cliquables → input inline (heures + activité + Esc/Enter)
  - 1 entry par couple (utilisateur, cible, jour) — saisir 0 supprime
  - Totaux par ligne, par colonne, total semaine
  - Cellule colorée selon statut (vert validé, indigo soumis, rouge refusé)
  - Sélecteur "+ Ajouter une ligne" pour rendre visible un projet/centre sans entrée encore
- Côté serveur : `upsertCell` vérifie l'appartenance équipe avant d'écrire, refuse de modifier une entrée déjà `APPROVED`.

### Candidat (externe) vs Consultant (interne)
Distinction explicite, deux flux d'entretien séparés :

| | Candidat | Consultant (User) |
|---|---|---|
| Statut juridique | Externe (en cours d'évaluation) | Employé Dasolabs |
| Module | `/candidates` | `/users` (fiche) + `/reviews` (vue agrégée) |
| Type d'entretien | `Interview` (rattaché à `MissionApplication`) | `ConsultantReview` (rattaché à `User`) |
| Catégories | Phone / Video / On-site / Technical / HR | Onboarding / Check-in / Annual review / End-of-mission / Performance / Career / Offboarding |
| Issues | Pending / Passed / Failed / Cancelled | Scheduled / Completed / Cancelled / Rescheduled |
| Contenu | Feedback technique | Feedback + objectifs + **notes privées** (visibles Admin/Manager seulement) |

- **Page fiche utilisateur** : panneau "Entretiens internes" avec planification, édition inline, séparation feedback (visible) vs notes privées (masquées au consultant lui-même).
- **Page agrégée `/reviews`** dans la sidebar (section Consultance) : tous les entretiens internes filtrables par consultant, type, issue. Un consultant ne voit que ses propres entretiens.
- **Permissions** : Admin/Manager peuvent créer/modifier/supprimer toutes les reviews. Le consultant peut consulter les siennes (sans les notes privées).

## Itération 5 — Vivier Candidats ↔ Consultants Dasolabs

### Deux viviers distincts, transitions explicites

| | Candidat (externe) | Consultant (interne) |
|---|---|---|
| Modèle | `Candidate` | `User` (rôle CONSULTANT/MANAGER/...) |
| URL | `/candidates` (dalles avec photos) | `/consultants` (dalles avec photos) |
| Authentification | Pas d'accès à l'app | Compte avec mot de passe |
| Statuts | ACTIVE / ENGAGED / UNAVAILABLE / ARCHIVED | active=true/false + `joinedAt`/`leftAt` |
| Entretiens | `Interview` (recrutement, lié à `MissionApplication`) | `ConsultantReview` (suivi RH/manager) |
| Suivi commercial | Pipeline missions (présentations, applications) | Affectations projets, ProjectMember |
| Champs profil | photo, skills, langues, taux freelance, ville, séniorité | mêmes + email pro, taux interne, capacité |

### Transition Candidat → Consultant (recrutement)
Bouton **"Recruter en consultant"** sur la fiche candidat (réservé Admin) :
- Ouvre une modale demandant email Dasolabs, rôle, mot de passe initial (pré-rempli aléatoire), date d'entrée, capacité
- Crée un `User` avec rôle CONSULTANT (par défaut), mot de passe haché
- **Recopie le profil** : photo, compétences, langues, séniorité, taux, ville
- Marque `Candidate.convertedToUserId` (lien fort) et statut ENGAGED
- Audit trail : `STATUS_CHANGE` + diff
- Redirige vers `/consultants/[id]`
- Sur la fiche candidat, bandeau vert permanent "Candidat recruté" avec lien vers le consultant

### Transition Consultant → Candidat (départ)
Bouton **"Marquer comme parti"** sur la fiche consultant (Admin) :
- Modale avec raison + checkbox "Conserver dans le vivier candidats"
- Désactive le compte (`active=false`, `leftAt=now`)
- Si "Conserver dans le vivier" coché :
  - Si le consultant venait d'un Candidate (recrutement passé), réactive ce Candidate (statut ACTIVE, dispo immédiate)
  - Sinon, crée un nouveau Candidate avec le profil complet pour pouvoir le re-présenter sur des missions

### Schéma — User enrichi
Champs ajoutés à `User` pour parité avec `Candidate` :
`photoUrl`, `phone`, `linkedinUrl`, `city`, `seniority`, `yearsExperience`, `spokenLanguages` + relation 1-1 `recruitedFromCandidate`.

### Entretiens de recrutement consolidés (fiche candidat)
La fiche candidat affiche désormais une section **"Entretiens de recrutement"** qui aplatit tous les `Interview` à travers toutes ses `MissionApplication`, triés par date desc, avec :
- Date / heure
- Mission (lien) + client + titre
- Type (Téléphone / Visio / Sur site / Technique / RH)
- Interviewer(s)
- Issue (Pending / Passed / Failed / Cancelled)
- Feedback complet

### Module Consultants `/consultants`
- Vue dalles avec photo, séniorité, compétences, ville, taux, langues, projets actifs
- Filtres : recherche, compétence, rôle (Consultant / Manager / Commercial / Finance / Admin), actif/inactif
- Badge "Ex-candidat" sur les profils issus du recrutement
- Fiche détail :
  - Photo proéminente + coordonnées + taux + capacité + charge planifiée semaine
  - Liste des projets (membre)
  - Section reviews internes (entretiens annuels, end-of-mission, performance...) avec notes privées Admin/Manager
  - Bouton **"Marquer comme parti"** (Admin)

### Recherche globale étendue
Trouve aussi les consultants par nom / email / compétence.

## Itération 6 — Mission ≠ Projet (entités distinctes)

### Le besoin
Une **Mission** (consultant placé chez un client en T&M) n'a rien à voir avec un **Projet** (livraison forfaitaire avec équipe, lignes, tranches). Le flux de l'itération 5 créait à tort une "offre Consulting" + un "projet mode CONSULTING" — ce qui mélangeait deux choses différentes. C'est corrigé.

### Modèles
| | Projet (forfait) | Mission (T&M) |
|---|---|---|
| Modèle Prisma | `Project` | `Mission` (nouveau) |
| Référence | `PRJ-2026-0001` | `MIS-2026-0001` |
| URL | `/projects` | `/missions` |
| Source | Offre WON | Application SELECTED |
| Acteurs | Équipe (`ProjectMember`) | Un consultant (`User`) |
| Conditions | Lignes + tranches forfaitaires définies à la signature | `dailyRate`, `dailyCost`, `startDate`, `endDate` |
| Statuts | `TO_START / ACTIVE / ON_HOLD / COMPLETED / CANCELLED` | `PLANNED / ACTIVE / EXTENDED / ON_HOLD / COMPLETED / CANCELLED` |
| Facturation | Tranches (validées une à une) | Tranches T&M générées mensuellement depuis timesheet |

### Flux mis à jour
- **`/mission-requests`** = pipeline commercial (avant : `/missions`). La demande client `MissionRequest` reste l'entrée du tunnel : qualification → présentation candidats → entretiens → SELECTED.
- **Application SELECTED → bouton "Créer la mission"** : appelle `convertApplicationToMission` qui crée directement une `Mission` rattachée à la demande, à l'application et — si le candidat est déjà recruté en interne — au `User` consultant correspondant. Plus aucun Offer/Project parasite n'est généré pour les T&M.
- **`/missions`** = liste des missions T&M (filtrable par statut, consultant, client). Par défaut affiche `PLANNED + ACTIVE + EXTENDED + ON_HOLD`.
- **Fiche mission** : conditions contractuelles éditables (tarif, dates, consultant, statut, fréquence facturation, lieu), encart **Réalisé depuis timesheet validés** (heures, jours, facturable, coût, marge, jours restants), encart Tranches T&M, transitions de statut sécurisées (PLANNED→ACTIVE→EXTENDED→COMPLETED…).

### Sécurité d'écriture missions
- Une mission `ACTIVE` ou `EXTENDED` ne peut pas être supprimée (il faut d'abord la terminer/annuler).
- Quand on marque `COMPLETED`/`CANCELLED`, `actualEndDate` est fixée si non renseignée.

### Schéma — relations
- `Mission` : références à `MissionRequest`, `MissionApplication`, `User` (consultant), `Company` (client).
- `TimesheetEntry`, `PlanningEntry`, `BillingMilestone` ont gagné un champ `missionId` (à côté de `projectId` et `costCenterId`).
- Convention : une saisie cible **exactement une** des trois cibles (Projet OU Mission OU Centre de coût).

### Timesheet & Planning
Le sélecteur de cible distingue désormais **3 catégories** :
- **Mes missions T&M** (badge ambre) — visibles si je suis le consultant assigné
- **Mes projets forfait** (badge bleu) — visibles si je suis `ProjectMember`
- **Centres de coût internes** (badge gris) — sales, congés, meeting…

Le garde-fou serveur vérifie l'appartenance équipe (Projet) ou l'assignation (Mission) avant tout enregistrement.

### Statut "en mission" sur les consultants
Le helper `getConsultantMissionStatus` lit maintenant l'entité `Mission` (status `ACTIVE`/`EXTENDED` couvrant aujourd'hui) au lieu de regarder les `PlanningEntry`. Plus précis et plus rapide. La pastille sur la dalle, le bandeau de la fiche consultant, et le filtre "Disponibles maintenant" se basent tous sur cette source unique de vérité.

### Sidebar Consultance
Demandes de mission · **Missions T&M actives** · Candidats (externes) · Consultants (Dasolabs) · Entretiens internes.

## Évolutions prévues / pistes

- Upload réel des pièces jointes (S3/MinIO + signed URLs) — modèle `Attachment` déjà en place
- Webhooks Peppol pour synchroniser le statut "PAID" automatiquement
- Vue Gantt projets
- Notifications email (validation timesheets, tranches échues)
- API REST/GraphQL séparée si besoin d'ouvrir l'ERP à des intégrations
- Multi-tenant si ouverture à d'autres entités

## Licence

Code interne Dasolabs — tous droits réservés.
