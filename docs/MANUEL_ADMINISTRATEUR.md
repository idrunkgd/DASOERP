# Manuel administrateur — Dasohub

Version : 1.0 — Juin 2026
Application : Dasohub (ERP interne Dasolabs)
Lecteur cible : administrateur système et fonctionnel de l'application

---

## Table des matières

1. [Architecture & infrastructure](#1-architecture--infrastructure)
2. [Accès aux composants](#2-accès-aux-composants)
3. [Gestion des utilisateurs](#3-gestion-des-utilisateurs)
4. [Gestion des permissions et groupes d'accès](#4-gestion-des-permissions-et-groupes-daccès)
5. [Configuration de l'application](#5-configuration-de-lapplication)
6. [Workflows administratifs](#6-workflows-administratifs)
7. [Sauvegardes (backups)](#7-sauvegardes-backups)
8. [Déploiements](#8-déploiements)
9. [Maintenance courante](#9-maintenance-courante)
10. [Troubleshooting](#10-troubleshooting)
11. [Sécurité](#11-sécurité)
12. [Procédures d'urgence](#12-procédures-durgence)

---

## 1. Architecture & infrastructure

### 1.1 Vue d'ensemble

Dasohub est une application web auto-hébergée sur un VPS Scaleway européen, déployée via Coolify, et adossée à une base Postgres self-host.

```
┌─────────────────────────────────────────────────────────────┐
│                    https://hub.dasolabs.be                  │
│                            │                                │
│                            ▼                                │
│                    Caddy (Let's Encrypt)                    │
│                            │                                │
│                            ▼                                │
│                    Container Next.js (port 3000)            │
│                            │                                │
│                            ▼                                │
│  Container Postgres 17 ◄───┤  Volume /var/dasohub-documents │
│  (xeex1zbl...)             │                                │
│                            │                                │
│  Tout orchestré par Coolify v4 sur VPS Scaleway DEV1-M      │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Composants

| Composant | Rôle | Adresse |
|-----------|------|---------|
| VPS | Hôte physique | Scaleway DEV1-M Paris, IP `51.159.170.220` |
| OS | Système d'exploitation | Ubuntu 24.04 |
| Coolify | PaaS auto-hébergé (déploiement, monitoring, certificats) | http://51.159.170.220:8000 |
| Caddy | Reverse proxy + HTTPS automatique | Géré par Coolify |
| Container Dasohub | Application Next.js 14 | Port interne 3000 |
| Container Postgres | Base de données | Service interne Coolify |
| Volume Documents | Stockage fichiers DMS | `/var/dasohub-documents/` sur le VPS |
| GitHub | Code source | https://github.com/idrunkgd/DASOERP |
| Cloudflare R2 (à venir) | Backup Postgres offsite | Pas encore en place |

### 1.3 Stack technique

- **Frontend/Backend** : Next.js 14 (App Router, Server Actions)
- **ORM** : Prisma 5.22.0 (pinné, ne pas upgrade sans précaution)
- **DB** : Postgres 17
- **Auth** : NextAuth (Credentials provider, JWT 30 jours)
- **PDF** : @react-pdf/renderer 3.4.5 (pinné, downgrade délibéré depuis 4.0.0)
- **Style** : Tailwind 3.4.15
- **OCR** : Claude Vision API + Google Gemini (selon module)
- **Chatbot interne** : Groq API

### 1.4 Dépendances externes critiques

| Service | Usage | Conséquence si down |
|---------|-------|---------------------|
| Scaleway VPS | Hébergement principal | Application down |
| GitHub | Source code | Pas de nouveau déploiement |
| Anthropic API | OCR factures fournisseurs, IA contextuelle | Fonctionnalités OCR dégradées |
| Groq API | Chatbot interne | Chatbot KO |
| Let's Encrypt | Renouvellement certificat HTTPS | Avertissement HTTPS au bout de 90 jours |
| Cloudflare DNS | Résolution hub.dasolabs.be | Application inaccessible par nom |

---

## 2. Accès aux composants

### 2.1 Connexion à l'application (`hub.dasolabs.be`)

1. Ouvre https://hub.dasolabs.be
2. Login avec l'email + password admin
3. Tu atterris sur `/dashboard` (ou `/me` si tu n'as pas `dashboard.read`)

### 2.2 Connexion à Coolify

URL : http://51.159.170.220:8000

Compte créé au setup initial. Si tu as perdu le password, voir §2.5 (reset Coolify).

Dashboard Coolify te permet de :

- Voir l'état des services (containers up/down)
- Lancer un Redeploy manuel
- Consulter les logs de déploiement et runtime
- Gérer les variables d'environnement
- Configurer les volumes persistants
- Voir l'usage CPU/RAM/disque

### 2.3 Connexion SSH au VPS

Avec ta clé SSH :

```bash
ssh root@51.159.170.220
```

Si la clé n'est pas reconnue, deux solutions :

- **Cloud Shell Scaleway** : https://console.scaleway.com → Cloud Shell (icône terminal en haut) → `ssh root@51.159.170.220` (la clé est pré-configurée)
- **Console VPS Scaleway** : https://console.scaleway.com → Instances → ton VPS → onglet Console → login root + password (si tu l'as encore)

### 2.4 Connexion à la DB Postgres

#### Depuis le VPS (en SSH)

```bash
docker exec -it <postgres-container-id> psql -U postgres -d postgres
```

Pour trouver le container :

```bash
docker ps | grep postgres
```

#### Depuis ton Mac (externe)

L'accès externe est exposé via Coolify (Public Port activé). URL de connexion :

```
postgres://postgres:<password>@51.159.170.220:5432/postgres
```

Exemple psql :

```bash
psql 'postgres://postgres:<password>@51.159.170.220:5432/postgres'
```

⚠️ Le password Postgres est dans Coolify → DB → onglet Configuration. Il est aussi visible dans la variable `DATABASE_URL` de l'application Dasohub.

### 2.5 Reset du password Coolify

Si tu as perdu le password admin Coolify :

```bash
# Sur le VPS
docker exec -it coolify php artisan tinker
```

Dans le shell Tinker :

```php
$u = App\Models\User::first();
echo $u->email; // Pour rappeler l'email
$u->password = bcrypt('NouveauPasswordSecure123');
$u->save();
exit
```

Puis va sur http://51.159.170.220:8000 et connecte-toi avec l'email affiché + le nouveau password.

### 2.6 Reset du password Postgres

Si tu veux rotation pour sécurité :

1. Coolify → DB Postgres → **Regenerate password**
2. Note le nouveau password
3. Coolify → app Dasohub → Environment Variables → édite `DATABASE_URL` avec le nouveau password
4. Coolify → app Dasohub → **Redeploy**

---

## 3. Gestion des utilisateurs

### 3.1 Concepts clés

Trois éléments définissent les droits d'un utilisateur :

- **Rôle** : libellé fonctionnel (Administrateur, Manager, Commercial, Consultant, Finance). N'a plus d'impact direct sur les permissions depuis la refonte des accès (juin 2026).
- **Groupe d'accès** : ensemble de permissions. C'est ça qui définit ce que l'utilisateur peut faire.
- **Surcharges fines** (User Permission Overrides) : ajustements individuels (grant ou revoke) sur un compte particulier.

### 3.2 Page Utilisateurs (`/users`)

**Permission requise** : `users.manage`

Liste de tous les utilisateurs avec leur rôle, leur groupe d'accès, leur statut (actif / inactif), leur nombre de surcharges.

#### Créer un utilisateur

Bouton "Nouvel utilisateur" en haut à droite. Saisie :

- Prénom, nom
- Email (unique)
- Mot de passe initial (lui communiquer pour première connexion)
- Rôle fonctionnel
- Groupe d'accès
- Tarifs (si consultant) : coût journalier, tarif journalier vendu
- Photo (optionnel)
- Compétences (multi-select autocomplete)

À la création, le user reçoit son groupe d'accès. Il pourra changer son password depuis `/me`.

#### Modifier un utilisateur

Clique sur la ligne ou sur `/users/<id>`. Tu peux changer :

- Identité
- Email
- Mot de passe
- Rôle
- Groupe d'accès
- Tarifs
- Compétences
- Statut actif/inactif

#### Désactiver un utilisateur

Au lieu de supprimer (perte de l'historique), bascule `active = false`. L'utilisateur ne peut plus se connecter mais ses timesheets, missions, etc. restent intacts.

#### Supprimer un utilisateur

**À éviter**. Si vraiment nécessaire :

- Plus possible si l'utilisateur a des timesheets, des missions, des entretiens (relations en cascade RESTRICT)
- Préfère la désactivation

---

## 4. Gestion des permissions et groupes d'accès

### 4.1 Page Accès (`/access`)

**Permission requise** : `users.manage`

Vue d'ensemble :

- Liste des groupes d'accès existants
- Liste des utilisateurs avec leur groupe assigné
- Bouton pour aller voir les surcharges fines (`/access/overrides`)

### 4.2 Créer un groupe d'accès

`/access/groups/new`

Champs :

- Nom (ex. "Administrateur", "Commercial Senior", "Consultant Lecture Seule")
- Description
- Permissions (sélection par section)

Quand tu coches/décoches les permissions, la liste est organisée comme la sidebar (Pilotage, Commerciale, Consultance, Projet, Finances, RH & Documents, Configuration). Pour chaque entrée de menu, les permissions associées sont listées (lecture, écriture).

### 4.3 Liste exhaustive des permissions

#### Pilotage

| Permission | Donne accès à |
|------------|---------------|
| `dashboard.read` | Tableau de bord (`/dashboard`) |
| `projects.read` | Statut projet (`/project-status`) |
| `consulting.read` | Simulateur package (`/salary-simulator`) |
| `finance.read` | Cashflow (lecture, `/cashflow`) |
| `finance.write` | Modifier le cashflow |
| `applinks.read` | Voir Outils & apps (`/app-links`) |
| `applinks.write` | Ajouter/modifier Outils & apps |

#### Commerciale

| Permission | Donne accès à |
|------------|---------------|
| `companies.read` | Voir les entreprises |
| `companies.write` | Créer/modifier entreprises |
| `contacts.read` | Voir contacts + activités commerciales |
| `contacts.write` | Créer/modifier contacts |
| `crm.read` | Voir le CRM pipeline |
| `crm.write` | Déplacer des cartes dans le CRM |

#### Consultance

| Permission | Donne accès à |
|------------|---------------|
| `consulting.read` | Candidats, consultants, demandes, missions, matching, calendrier |
| `consulting.write` | Créer/modifier candidats, consultants, demandes, missions |
| `reviews.read` | Voir les entretiens |
| `reviews.write` | Créer/modifier des entretiens |

#### Projet

| Permission | Donne accès à |
|------------|---------------|
| `offers.read` | Voir les offres |
| `offers.write` | Créer/modifier offres + gérer profils de prestation |
| `projects.read` | Voir les projets |
| `projects.write` | Modifier les projets |
| `timesheet.self.write` | Saisir ses propres timesheets |
| `timesheet.validate` | Valider les timesheets des autres |
| `purchases.read` | Voir les achats |
| `purchases.write` | Créer/modifier les achats |
| `planning.read` | Voir le planning |
| `planning.write` | Modifier le planning |

#### Finances

| Permission | Donne accès à |
|------------|---------------|
| `finance.read` | Facturations, TVA trimestrielle (lecture) |
| `finance.write` | Émettre/modifier factures, TVA |

#### RH & Documents

| Permission | Donne accès à |
|------------|---------------|
| `onboarding.read` | Voir les onboardings en cours |
| `onboarding.write` | Créer/modifier onboardings et templates |
| `documents.read` | Voir et télécharger documents |
| `documents.write` | Upload/modification/suppression de documents |

#### Configuration

| Permission | Donne accès à |
|------------|---------------|
| `users.manage` | Gestion utilisateurs et groupes d'accès |
| `settings.manage` | Paramètres globaux, compétences, centres de coûts |
| `audit.read` | Consulter l'audit trail |

### 4.4 Groupes recommandés

#### Administrateur

Toutes les permissions.

#### Manager

- `dashboard.read`, `projects.read`, `consulting.read`, `finance.read` (lecture cashflow), `applinks.read`
- `companies.read/write`, `contacts.read/write`, `crm.read/write`
- `offers.read/write`, `projects.read/write`, `timesheet.validate`, `purchases.read/write`, `planning.read/write`
- `consulting.read/write`, `reviews.read/write`, `onboarding.read/write`
- `documents.read/write`
- `audit.read`

#### Commercial

- `dashboard.read`, `applinks.read`
- `companies.read/write`, `contacts.read/write`, `crm.read/write`
- `offers.read/write`, `projects.read`, `consulting.read/write`
- `finance.read` (visibilité encaissements), `documents.read/write`

#### Consultant

- `dashboard.read`, `applinks.read`
- `companies.read`, `contacts.read`
- `projects.read`, `timesheet.self.write`, `planning.read`, `purchases.read`
- `reviews.read`, `documents.read`

#### Finance

- `dashboard.read`, `applinks.read`
- `companies.read`, `contacts.read`, `offers.read`, `projects.read`
- `purchases.read/write`, `finance.read/write`, `planning.read`
- `documents.read/write`, `audit.read`

### 4.5 Surcharges fines (`/access/overrides`)

Permet d'ajouter ou retirer **une** permission précise à un user en particulier, sans changer son groupe.

**Cas d'usage** :

- Donner `audit.read` à un consultant pour un projet temporaire
- Retirer `documents.write` à un user dont tu veux limiter le risque d'erreur
- Donner `finance.read` à un manager qui n'en a pas dans son groupe

Les surcharges sont appliquées **par-dessus** le groupe : grant ajoute, revoke retire.

---

## 5. Configuration de l'application

### 5.1 Paramètres globaux (`/settings`)

**Permission requise** : `settings.manage`

Page d'accueil des paramètres avec des liens vers chaque section.

### 5.2 Informations légales (`/settings/company`)

Coordonnées de Dasolabs utilisées dans les PDF d'offre, les factures, les en-têtes :

- Raison sociale (legal name)
- Adresse, code postal, ville, pays
- Numéro de TVA
- IBAN
- Email facturation
- Téléphone
- Conditions de paiement (par défaut 30 jours)
- Validité des offres (par défaut 30 jours)

### 5.3 Centres de coûts (`/cost-centers`)

Catégories d'imputation interne pour les timesheets et les achats : SALES, LEAVE, MEETING, ADMIN, TRAINING, RND, OTHER.

Création/édition libre.

### 5.4 Compétences (`/skills`)

Liste maître des compétences techniques pour candidats et consultants.

- Casse préservée (saisir "Java/JEE" garde le slash et la casse)
- Catégories optionnelles (Backend, Frontend, Cloud, Soft skills)
- Désactivation possible (ne supprime pas, juste exclut des autocompletes)

### 5.5 Profils de prestation (`/service-profiles`)

Templates tarifaires utilisés dans les lignes d'offre :

- Nom (ex. "Développeur Senior Java", "Architecte Cloud")
- Tarif journalier vendu
- Coût journalier interne
- Marge calculée
- Tarif horaire dérivé (÷ 8)
- Actif / inactif

### 5.6 Templates d'onboarding (`/settings/onboarding-templates`)

Modèles de checklists d'arrivée appliqués à chaque nouvel utilisateur.

**Création** :

- Nom
- Rôle ciblé (sinon générique)
- Description
- Entretiens (CSV de jours, par défaut "1, 30, 90, 180")
- Items par catégorie (Administratif, IT, Formation, Intégration équipe)

**Items du template** :

- Catégorie (libre)
- Titre
- Description
- Responsable par défaut (rôle)
- Décalage en jours par rapport à la date d'arrivée (négatif = avant, positif = après)

**Application** : quand tu lances un onboarding pour un user, le template matching son rôle est sélectionné par défaut, sinon le générique.

### 5.7 Outils & apps

Liste les outils externes (Coolify, Scaleway, GitHub...) en raccourcis pour l'équipe. Tout user avec `applinks.read` les voit, ceux avec `applinks.write` peuvent les éditer.

---

## 6. Workflows administratifs

### 6.1 Marquer une offre gagnée (wizard) — admin et commercial

Voir détail dans le Manuel opérateur §7.1.5.

**Côté admin** : assure-toi que le commercial qui marque l'offre :

- A bien `offers.write`
- Saisit la **date d'émission de facture** correcte pour chaque tranche (pas la date d'encaissement directement — le wizard fait le calcul)

Le projet créé hérite du `vatRate` de l'offre. Si l'offre avait TVA = 0%, le projet aussi → cashflow affiche du HT pur, pas de gonflement TVAC artificiel.

### 6.2 Configurer la TVA d'un projet déjà créé

Si un projet a été créé avec TVA = 21% mais le client est en réalité exonéré :

**Option A — Via l'UI** : pour le moment pas de champ TVA directement éditable depuis `/projects/[id]`. Édite directement en SQL :

```bash
psql 'postgres://postgres:<password>@51.159.170.220:5432/postgres' -c "UPDATE \"Project\" SET \"vatRate\" = 0 WHERE id = 'PROJET_ID';"
```

Pour aligner aussi l'offre source :

```bash
psql 'postgres://postgres:<password>@51.159.170.220:5432/postgres' -c "UPDATE \"Offer\" SET \"vatRate\" = 0 WHERE id = (SELECT \"offerId\" FROM \"Project\" WHERE id = 'PROJET_ID');"
```

### 6.3 Modifier une date d'encaissement de milestone

Va sur `/projects/<id>` → section "Tranches de facturation" → clique le champ date → tape la nouvelle date. Sauvegardée automatiquement. Le cashflow et le dashboard se rafraîchissent.

### 6.4 Suivre les factures en cours d'encaissement

KPI "En cours" sur `/cashflow` montre le total TVAC de toutes les tranches en statut INVOICED. Compte aussi le nombre de factures.

Pour voir le détail : `/finance` filtré sur statut INVOICED.

### 6.5 Gérer un complément d'offre

Quand un client demande une extension contractuelle :

- Ouvre l'offre originale
- Bouton "+ Complément"
- Crée la référence -C1 automatiquement
- Saisis les lignes/tranches du complément
- Marque le complément WON → ses tranches sont fusionnées dans le projet parent (pas de nouveau projet créé)

### 6.6 Gérer une V2 d'offre

Quand un client demande à revoir une offre déjà envoyée :

- Ouvre la V1
- Bouton "+ Nouvelle version"
- V2 créée en DRAFT, avec lignes + tranches + options + contacts clonés
- V1 reste consultable mais figée
- Modifie la V2 selon les besoins du client
- Envoie la V2 → statut SENT

Quand tu marques V2 WON, le projet est créé depuis V2 (pas V1).

⚠️ Bug historique corrigé en juin 2026 : autrefois, créer une V2 dupliquait les lignes d'option dans le devis principal. Si tu as des projets antérieurs à cette correction avec des options en double, il faut nettoyer manuellement (ou recréer une V3 propre).

### 6.7 Reset password d'un utilisateur

`/users/<id>` → champ "Nouveau mot de passe" → tape un password fort → enregistrer. Communique-le au user qui le changera depuis `/me`.

---

## 7. Sauvegardes (backups)

### 7.1 Stratégie

Trois niveaux à mettre en place idéalement :

1. **Backup local sur le VPS** (volume Docker) — auto par Coolify si configuré
2. **Backup offsite** (Cloudflare R2 ou Scaleway Object Storage) — pour résister à un crash VPS total
3. **Backup ponctuel sur ton Mac** — avant chaque session de modifications majeures

### 7.2 Backup manuel depuis ton Mac (recommandé avant chaque chantier)

```bash
mkdir -p ~/Backups/dasohub
pg_dump -Fc 'postgres://postgres:<password>@51.159.170.220:5432/postgres' \
  > ~/Backups/dasohub/dasohub-$(date +%Y%m%d-%H%M%S).dump
```

Format `-Fc` (custom) = compressé, restauration sélective possible.

Vérifie la taille (> 1 MB) :

```bash
ls -lh ~/Backups/dasohub/
```

### 7.3 Script automatique

Crée `~/dasohub-backup.sh` :

```bash
#!/bin/bash
set -e
DEST=~/Backups/dasohub
mkdir -p $DEST
DATE=$(date +%Y%m%d-%H%M%S)
FILE="$DEST/dasohub-$DATE.dump"
echo "Backup → $FILE"
pg_dump -Fc 'postgres://postgres:<password>@51.159.170.220:5432/postgres' > "$FILE"
SIZE=$(du -h "$FILE" | cut -f1)
echo "Done — $SIZE"
# Rétention 30 derniers
ls -t $DEST/*.dump | tail -n +31 | xargs -r rm
echo "Rétention : 30 derniers backups conservés"
```

```bash
chmod +x ~/dasohub-backup.sh
~/dasohub-backup.sh
```

Pour automatiser quotidiennement, ajoute au crontab Mac :

```bash
crontab -e
```

Ligne à ajouter (backup quotidien à 22h) :

```
0 22 * * * /Users/gerald/dasohub-backup.sh >> /tmp/dasohub-backup.log 2>&1
```

### 7.4 Backup offsite via Cloudflare R2 (à mettre en place)

Avantages R2 : 10 GB gratuits, zéro frais d'egress, S3-compatible.

**Setup** :

1. Crée un compte Cloudflare (https://dash.cloudflare.com)
2. Active R2, crée le bucket `dasohub-backups`
3. Crée un token API "dasohub-backups" avec permission Object Read & Write
4. Note les 3 valeurs : Access Key ID, Secret Access Key, Endpoint
5. Dans Coolify → Servers → Backups → S3 Storages → New :
   - Name : Cloudflare R2
   - Endpoint : `https://<account-id>.r2.cloudflarestorage.com`
   - Region : `auto`
   - Bucket : `dasohub-backups`
   - Access Key + Secret
6. Coolify → DB Postgres → onglet Backups → Enable scheduled backups
   - Schedule : `0 3 * * *` (3h du matin)
   - Storage : Cloudflare R2
   - Rétention : 7 daily / 4 weekly / 6 monthly

### 7.5 Backup du volume documents

Les fichiers PDF/contrats stockés via le DMS sont dans `/var/dasohub-documents/` sur le VPS — **pas dans Postgres**. Le pg_dump ne les sauvegarde pas.

Pour les inclure :

```bash
# Sur le VPS (en SSH)
tar czf /tmp/dasohub-documents-$(date +%Y%m%d).tar.gz /var/dasohub-documents/
# Puis upload ailleurs (rsync vers ton Mac, scp, etc.)
```

### 7.6 Test de restauration (à faire 1× / mois)

**Crucial** : un backup non testé n'est pas un backup.

Sur ton Mac avec Postgres installé :

```bash
# Crée une DB de test locale
createdb dasohub_test
# Restaure
pg_restore -d dasohub_test ~/Backups/dasohub/dasohub-XXXX.dump
# Vérifie
psql dasohub_test -c "SELECT COUNT(*) FROM \"User\";"
psql dasohub_test -c "SELECT COUNT(*) FROM \"Project\";"
psql dasohub_test -c "SELECT COUNT(*) FROM \"BillingMilestone\";"
# Nettoie
dropdb dasohub_test
```

Si tu vois des nombres cohérents avec ta prod → backup valide. Si erreurs → investiguer.

---

## 8. Déploiements

### 8.1 Workflow général

```
[Modifications code] → [git commit] → [git push origin main]
                                              │
                                              ▼
                              [GitHub webhook → Coolify]
                                              │
                                              ▼
                             [Coolify lance docker build]
                                              │
                                              ▼
                  [npx prisma migrate deploy → applique migrations]
                                              │
                                              ▼
                                  [node server.js → app live]
                                              │
                                              ▼
                           [Healthcheck /api/health pendant 60s]
                                              │
                                              ▼
                              [Healthy → rolling update completed]
                                              │
                                              ▼
                                  [Ancien container détruit]
```

### 8.2 Lancer un déploiement manuel

Si tu veux forcer un rebuild (par exemple après un fix Dockerfile sans changement de code) :

- Coolify → app Dasohub → bouton **Redeploy** en haut à droite

### 8.3 Suivre les logs d'un déploiement

Coolify → app Dasohub → onglet **Deployments** → clique le déploiement en cours → tu vois en direct :

- Étape 1 : clone du repo
- Étape 2 : docker build
- Étape 3 : container démarre
- Étape 4 : healthchecks
- Étape 5 : rolling update completed ✅

### 8.4 Logs runtime (app en cours d'exécution)

Coolify → app Dasohub → onglet **Logs** : flux temps réel du container Next.js. Utile pour debug une erreur live.

Pour Postgres : Coolify → DB → onglet Logs.

### 8.5 Variables d'environnement

Coolify → app Dasohub → onglet **Environment Variables** :

| Variable | Valeur | Notes |
|----------|--------|-------|
| `DATABASE_URL` | `postgres://...` | Connection string Postgres (interne) |
| `NEXTAUTH_SECRET` | `xxx=` | Secret signature JWT, 32+ chars base64 |
| `NEXTAUTH_URL` | `https://hub.dasolabs.be` | URL canonique |
| `GROQ_API_KEY` | `gsk_...` | Pour le chatbot interne |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Pour l'OCR Claude Vision |
| `GOOGLE_API_KEY` | `...` | Pour Gemini si utilisé |
| `MAILGUN_WEBHOOK_KEY` | `...` | Pour webhook email entrant |
| `DOCS_STORAGE_PATH` | `/data/documents` | Chemin volume documents |

Tout changement nécessite un **Redeploy** pour prendre effet.

### 8.6 Volumes persistants

Coolify → app Dasohub → onglet **Storages** (ou Persistent Storage / Volumes selon version) :

| Source (host VPS) | Destination (container) | Usage |
|-------------------|-------------------------|-------|
| `/var/dasohub-documents` | `/data/documents` | DMS — fichiers PDF/contrats |

**Critique** : sans ce volume, tous les documents uploadés sont perdus à chaque rebuild. Vérifie qu'il est bien présent.

### 8.7 Rollback en cas de problème

Si un déploiement casse :

**Option A — Coolify rollback** : Coolify → app → Deployments → précédente version → bouton "Rollback" (selon version Coolify).

**Option B — Git revert** :

```bash
cd "/Users/gerald/Documents/Claude/Projects/ERP Dasolabs"
git log --oneline -5
git revert <SHA-du-mauvais-commit>
git push origin main
```

Coolify rebuild automatiquement la version corrigée.

**Option C — Reset hard** (en dernier recours) :

```bash
git reset --hard <SHA-de-la-version-qui-marche>
git push --force origin main
```

⚠️ `--force` réécrit l'historique distant. À utiliser uniquement si tu es seul sur main.

### 8.8 Migrations Prisma bloquées

Si tu vois dans les logs :

```
Error: P3009: failed migration
```

Connecte-toi à la DB et marque la migration en cause comme appliquée :

```bash
psql 'postgres://postgres:<password>@51.159.170.220:5432/postgres' \
  -c "UPDATE _prisma_migrations SET finished_at = NOW(), rolled_back_at = NULL, logs = NULL WHERE finished_at IS NULL;"
```

Puis relance le déploiement Coolify.

---

## 9. Maintenance courante

### 9.1 Santé générale du système

Coolify dashboard affiche en temps réel :

- CPU usage
- RAM usage
- Disk usage
- Containers up/down

**Seuils d'alerte** :

- CPU > 70% pendant 10 min → investiguer (process zombie, surcharge)
- RAM > 80% → considérer un upgrade VPS
- Disk > 80% → cleanup (vieux dumps, vieux logs, vieux images Docker)

### 9.2 Nettoyer les vieilles images Docker

Sur le VPS, périodiquement :

```bash
docker system prune -af --volumes
```

⚠️ `--volumes` supprime les volumes non rattachés. Tu peux omettre cette option si tu n'es pas sûr.

### 9.3 Vérifier le certificat HTTPS

Caddy gère automatiquement le renouvellement Let's Encrypt. Vérification manuelle :

```bash
curl -vI https://hub.dasolabs.be 2>&1 | grep -E "subject|issuer|date"
```

Le certificat doit avoir une date d'expiration > 30 jours dans le futur.

### 9.4 Vérifier la sauvegarde

```bash
ls -la ~/Backups/dasohub/ | tail -5
```

Les dumps récents doivent dater de moins de 7 jours.

### 9.5 Mises à jour Coolify

Coolify se met à jour via son propre dashboard :

- Notification dans Coolify quand une update est dispo
- Bouton "Update" dans Settings → Update

Lis le changelog avant. Backup obligatoire avant une major version.

### 9.6 Mise à jour Postgres

À éviter pendant les 12 premiers mois (Postgres 17 récent, stable). Si vraiment nécessaire (CVE) :

1. Backup complet
2. Suis la doc Coolify pour migration de version Postgres
3. Test sur dev local d'abord si possible

### 9.7 Mise à jour de l'app Next.js

Tu git pull, tu testes localement, tu push → Coolify rebuild automatiquement. Cycle normal.

---

## 10. Troubleshooting

### 10.1 L'app est inaccessible (hub.dasolabs.be ne répond pas)

**Étapes** :

1. Coolify dashboard accessible ? (http://51.159.170.220:8000)
   - Si non → VPS lui-même est down. Va sur https://console.scaleway.com → Instances → check état + Reboot si besoin
2. Container Dasohub up dans Coolify ?
   - Si "starting" depuis trop longtemps → healthcheck échoue → check les logs runtime
   - Si "down" → check les logs de deployment
3. DB Postgres up ?
   - Container coolify-db doit être "running"
4. Caddy / Coolify-proxy OK ?
   - Container coolify-proxy doit être "running"
5. DNS OK ?
   - `nslookup hub.dasolabs.be` doit retourner `51.159.170.220`

### 10.2 Erreur "Application error: a server-side exception" sur une page

Cherche le digest dans Coolify → Logs runtime. Tape le digest pour trouver la stack trace.

Causes fréquentes :

- Prisma : entrée référencée n'existe plus (P2025) — voir §10.3
- Server Action : null pointer sur un champ optionnel
- Middleware : redirect en boucle
- Module fs : permission denied sur un volume mal monté

### 10.3 Erreur P2025 (record not found)

Une référence pointe vers une row Prisma qui n'existe plus. Souvent dû à un état navigateur périmé.

**Côté user** : rafraîchir la page (Cmd+Shift+R hard refresh).

**Côté admin** : si ça revient systématiquement, regarder la table concernée pour identifier les ids orphelins ou les jointures cassées.

### 10.4 Healthcheck échoue au déploiement

Symptôme : Coolify rollback après ~3 min avec `New container is not healthy`.

Causes possibles :

- Migration Prisma plante → check logs, voir §8.8
- Application crash au démarrage → check logs
- `/api/health` répond 401/302 (middleware intercepte) → vérifier que `api/health` est dans la liste excludes du middleware
- Port mal exposé → vérifier `EXPOSE 3000` dans Dockerfile

### 10.5 Permissions inattendues

User dit "je ne vois pas le menu X" alors qu'il devrait :

1. `/access` → vérifier son groupe
2. Édition du groupe → cocher la permission concernée
3. User doit se déconnecter / reconnecter (refresh JWT)

Si problème persiste, vérifie son `accessGroupId` en DB :

```sql
SELECT u.email, ag.name, ag.permissions FROM "User" u
LEFT JOIN "AccessGroup" ag ON ag.id = u."accessGroupId"
WHERE u.email = 'xxx@xxx.com';
```

### 10.6 Documents ne s'uploadent pas

Symptômes : "Application error" lors de l'upload, ou "EACCES" dans les logs.

Causes :

- Volume `/var/dasohub-documents` non monté → Coolify → Storages → ajouter Bind Mount
- Permissions hôte incorrectes → sur le VPS : `chown -R 1001:1001 /var/dasohub-documents && chmod 755 /var/dasohub-documents`
- Disque plein → `df -h` sur le VPS

### 10.7 PDF d'offre génère "Unknown font format"

Connu et corrigé. Le projet utilise `@react-pdf/renderer` 3.4.5 (pinné). Si quelqu'un upgrade vers 4.x, ça casse les polices custom et l'unitsPerEm.

À ne pas modifier sans tester.

### 10.8 Cashflow affiche des montants étranges

Vérifie sur la fiche projet le `vatRate`. 21% par défaut, mettre 0% pour clients exonérés. Si encore faux, vérifie les `BillingMilestone.expectedAt` (sont les **dates d'encaissement attendu**, pas les dates facture).

### 10.9 Sessions JWT qui expirent prématurément

Si les users sont déconnectés trop vite, vérifier `NEXTAUTH_SECRET` qui n'a pas changé entre déploiements (sinon tous les tokens existants sont invalidés).

### 10.10 Recherche Cmd+K ne trouve rien

Vérifier que l'user a au moins les permissions de lecture des entités qu'il cherche. Si rien ne sort même en étant Admin, vérifier l'API `/api/search` :

```bash
curl -H 'Cookie: <session-cookie>' 'https://hub.dasolabs.be/api/search?q=test'
```

---

## 11. Sécurité

### 11.1 Rotation des secrets

À faire au moins **1× par an**, et **immédiatement** si compromis (fuite log, ex-employé, etc.) :

- **Password Postgres** : Coolify → DB → Regenerate → update `DATABASE_URL` → Redeploy
- **NEXTAUTH_SECRET** : génère un nouveau secret (`openssl rand -base64 32`) → update env var Coolify → Redeploy (déconnecte tous les users)
- **Passwords utilisateurs** : si compromis suspecté, reset depuis `/users`
- **API keys externes** (Anthropic, Groq, Google) : régénère côté provider, update env Coolify
- **Coolify admin password** : voir §2.5

### 11.2 Bonnes pratiques

- **Ne jamais partager** un password en chat IA ou messagerie non chiffrée
- Utiliser un **password manager** (1Password, Bitwarden, Apple Keychain)
- Générer des passwords longs (12+ caractères, mélange) avec le générateur du manager
- Activer la **2FA** sur tous les services externes (GitHub, Cloudflare, Scaleway, Anthropic)

### 11.3 Audit trail

`/audit` (permission `audit.read`) : log de toutes les actions importantes (CREATE, UPDATE, DELETE, STATUS_CHANGE, VIEW pour documents). Permet de tracer qui a fait quoi quand.

À consulter régulièrement (mensuellement) pour détecter des comportements anormaux.

### 11.4 HTTPS Let's Encrypt

Caddy renouvelle automatiquement le certificat tous les ~60-90 jours. Vérifier la validité en ouvrant le cadenas dans le navigateur. Si jaune/rouge → investiguer.

### 11.5 SSH

- Ne **jamais** activer le login root par password sur le VPS (ssh PermitRootLogin without-password ou prohibit-password)
- Ajouter les clés publiques des admins dans `/root/.ssh/authorized_keys`
- Si une clé est compromise, retire-la immédiatement

### 11.6 RGPD

Tu manipules des données personnelles (consultants, candidats, contacts) et financières (clients). Tu dois avoir, au minimum :

- Une **politique de rétention** documentée (combien de temps tu gardes les CV refusés, contrats clos)
- Un **registre des traitements** (qui, quoi, pourquoi, combien de temps)
- Un **DPA** (data processing agreement) avec chaque sous-traitant (Anthropic, Google = transferts hors UE)
- Un mécanisme de **droit à l'oubli** (supprimer un user à sa demande)
- Un mécanisme d'**export** (donner à un user toutes ses données)

À documenter dans un `docs/RGPD.md` à part.

---

## 12. Procédures d'urgence

### 12.1 VPS Scaleway down

1. Vérifie l'état https://status.scaleway.com
2. Si confirmé du côté Scaleway → attendre, communiquer à l'équipe que c'est externe
3. Si du côté Scaleway tout est OK mais le VPS ne répond pas → console Scaleway → reboot
4. Si reboot ne suffit pas → ouvrir un ticket support Scaleway, prévoir migration de secours (cf. §12.6)

### 12.2 DB Postgres corrompue

1. **NE PAS PANIQUER**. Ne lance aucune commande destructive.
2. Stoppe l'application (Coolify → app → Stop) pour empêcher de nouvelles écritures
3. Vérifie l'intégrité :
   ```bash
   docker exec -it coolify-db psql -U postgres -d postgres -c "VACUUM FULL ANALYZE;"
   ```
4. Si toujours corrompu → restauration depuis backup (§12.4)

### 12.3 Compromission suspecte

Signes : connexions inhabituelles, données modifiées par un user inconnu, fuite externe.

1. Coupe immédiatement l'accès :
   - Désactive tous les comptes user sauf le tien (`active = false`)
   - Change tous les secrets (DATABASE_URL, NEXTAUTH_SECRET, API keys)
   - Renouvelle ta clé SSH VPS si suspectée
2. Consulte l'audit trail (`/audit`) pour identifier l'origine et le périmètre
3. Restaure depuis un backup pré-compromission si nécessaire
4. Communique à l'équipe + DPO si données personnelles affectées (notification RGPD à la CNIL/AP belge dans les 72h si fuite)

### 12.4 Restauration depuis backup

**Préparation** :

1. Stop l'app (Coolify → Stop)
2. Identifie le dump à restaurer (le plus récent fiable)

**Restauration** :

```bash
# Depuis ton Mac
# Drop la DB existante (DESTRUCTIF) — fais un backup courant avant
pg_dump -Fc 'postgres://postgres:<password>@51.159.170.220:5432/postgres' \
  > ~/Backups/dasohub/pre-restore-$(date +%Y%m%d-%H%M%S).dump

# Truncate ou drop+recréate la DB Postgres
psql 'postgres://postgres:<password>@51.159.170.220:5432/postgres' -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Restaure
pg_restore -d 'postgres://postgres:<password>@51.159.170.220:5432/postgres' ~/Backups/dasohub/dasohub-XXXX.dump
```

Démarre l'app, vérifie que tout est fonctionnel.

### 12.5 Compte admin perdu (toi tu es bloqué)

Tu connais le password Postgres → tu peux reset ton compte admin Dasohub directement en SQL :

```bash
# Génère un hash bcrypt
node -e "console.log(require('bcryptjs').hashSync('NouveauPassword123', 10))"

# Met à jour le password en DB
psql 'postgres://postgres:<password>@51.159.170.220:5432/postgres' \
  -c "UPDATE \"User\" SET password = 'HASH_GENERE_AU_DESSUS' WHERE email = 'gerald.devestele@gmail.com';"
```

Pour Coolify admin → §2.5.

### 12.6 Migration de secours vers un autre VPS

Si Scaleway est down pour 24h+ :

1. Crée un VPS de secours sur OVH/Hetzner/AWS
2. Install Coolify sur le nouveau VPS
3. Restaure le backup Postgres le plus récent
4. Pointe le DNS hub.dasolabs.be vers la nouvelle IP (TTL court)
5. Communique l'incident à l'équipe

**Préparer** : garde une procédure documentée step-by-step + un VPS de bascule pré-provisionné (ou au moins l'éligibilité créée) chez un second fournisseur.

---

## Annexes

### A. Liste des migrations Prisma

Voir `app/prisma/migrations/`. Chaque dossier = une migration. Format `YYYYMMDDhhmmss_nom_descriptif`.

### B. Conventions de code

- Branches : `main` est la production
- Commits : format conventionnel (`feat:`, `fix:`, `chore:`, etc.)
- PRs : optionnelles tant que tu es seul, mais utiles si une revue extérieure intervient
- Tests : à mettre en place sur les calculs critiques (brut/net, marge offre, cashflow)

### C. Contacts d'urgence

- Scaleway support : https://console.scaleway.com → Support
- Cloudflare support : https://dash.cloudflare.com → Support
- GitHub support : https://support.github.com
- Anthropic support : https://console.anthropic.com → Support
- Expert-comptable : (à compléter)

### D. Glossaire technique

- **DXA** : unité de mesure docx (1440 = 1 inch)
- **Peppol** : réseau européen de facturation électronique B2B
- **Reverse proxy** : Caddy, devant le container Next.js
- **JWT** : JSON Web Token (auth)
- **PaaS** : Platform as a Service (Coolify ici)
- **DMS** : Document Management System (notre `/documents`)
- **OCR** : Optical Character Recognition
- **RGPD/GDPR** : Réglementation européenne données personnelles

---

*Fin du Manuel administrateur — version 1.0*

À tenir à jour à chaque changement majeur d'infrastructure ou de fonctionnalité critique.
