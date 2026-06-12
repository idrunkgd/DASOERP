# Manuel opérateur — Dasohub

Version : 1.0 — Juin 2026
Application : Dasohub (ERP interne Dasolabs)
URL : https://hub.dasolabs.be

---

## Table des matières

1. [Introduction](#1-introduction)
2. [Premiers pas](#2-premiers-pas)
3. [Navigation et recherche](#3-navigation-et-recherche)
4. [Module Pilotage](#4-module-pilotage)
5. [Module Commerciale](#5-module-commerciale)
6. [Module Consultance](#6-module-consultance)
7. [Module Projet](#7-module-projet)
8. [Module Finances](#8-module-finances)
9. [Module RH & Documents](#9-module-rh--documents)
10. [Annexes](#10-annexes)

---

## 1. Introduction

### 1.1 Qu'est-ce que Dasohub

Dasohub est l'outil interne de pilotage de Dasolabs. Il centralise :

- La gestion commerciale (entreprises, contacts, opportunités, offres)
- L'exécution des missions de consultance (candidats, consultants, demandes, exécutions)
- Le suivi projet (offres signées, timesheets, achats, planning, facturation)
- La gestion financière (cashflow, TVA trimestrielle, factures fournisseurs)
- Les ressources humaines (entretiens, onboarding)
- La documentation interne (contrats, NDA, procédures)

### 1.2 À qui s'adresse ce manuel

Ce document décrit toutes les fonctionnalités utilisables par un utilisateur connecté à Dasohub. Les actions d'administration (gestion des utilisateurs, configuration globale, sauvegardes, déploiements) sont décrites dans le *Manuel administrateur*.

### 1.3 Profils et permissions

Chaque utilisateur est rattaché à un **groupe d'accès** qui définit les modules visibles dans la sidebar et les actions autorisées. Si une entrée de menu ou un bouton n'apparaît pas, c'est que ton groupe n'a pas la permission correspondante. Demande à l'administrateur d'ajuster ton groupe.

Les rôles courants chez Dasolabs :

| Rôle | Cas d'usage typique |
|------|---------------------|
| Administrateur | Gérald — accès complet, gestion des comptes |
| Manager | Encadrement, validation timesheets, vision finance partielle |
| Commercial | Pipeline, offres, contacts, gestion clients |
| Consultant | Saisie timesheets, profil personnel, missions |
| Finance | Cashflow, facturations, TVA, achats |

---

## 2. Premiers pas

### 2.1 Accès à l'application

Ouvre ton navigateur (Chrome, Safari, Firefox récent) sur :

```
https://hub.dasolabs.be
```

Si tu n'es pas connecté, tu arrives sur la page de login.

### 2.2 Connexion

Renseigne :

- **Email** : celui qui t'a été communiqué par l'administrateur
- **Password** : celui que tu as choisi

Clique **Connexion**.

À la première connexion, l'administrateur t'aura probablement créé un compte avec un mot de passe temporaire. Va sur ton profil (`/me`) pour le changer immédiatement.

### 2.3 Mot de passe oublié

Pas de bouton self-service pour le moment. Contacte l'administrateur (Gérald) qui réinitialise depuis `/users/<ton-id>`.

### 2.4 Première vue après connexion

Après connexion, tu arrives par défaut sur le **Tableau de bord** (`/dashboard`). Si ton groupe ne te donne pas accès au dashboard, tu atterris sur **Mon profil** (`/me`).

### 2.5 Profil personnel (`/me`)

Accessible via :
- L'avatar en haut à droite → "Mon profil"
- Ou directement `/me` dans l'URL

Sur cette page tu peux :

- Modifier ton nom, prénom, email, photo
- Changer ton mot de passe
- Voir tes informations de groupe d'accès
- Voir l'historique de tes connexions (audit trail filtré sur ton compte)

**Tout utilisateur connecté** a accès à son `/me`, même sans aucune autre permission.

---

## 3. Navigation et recherche

### 3.1 Structure générale de l'écran

L'application est divisée en trois zones :

```
┌──────────────────────────────────────────────┐
│ [SIDEBAR]      [TOPBAR : recherche + profil] │
│                                              │
│ Pilotage      ┌──────────────────────────┐   │
│ Commerciale   │                          │   │
│ Consultance   │   CONTENU DE LA PAGE     │   │
│ Projet        │                          │   │
│ Finances      │                          │   │
│ RH            │                          │   │
│ Config        │                          │   │
└──────────────────────────────────────────────┘
```

### 3.2 La sidebar

La sidebar à gauche groupe les fonctionnalités par section. Cliquer sur une entrée navigue vers le module correspondant. Sur mobile, la sidebar se cache derrière un bouton hamburger en haut à gauche de la topbar.

**Sections** :

- **Pilotage** : tableau de bord, suivi projet, simulateur de package, cashflow, TVA, outils & apps
- **Commerciale** : entreprises, contacts, activités, CRM pipeline
- **Consultance** : candidats, consultants, demandes de mission, missions, matching, entretiens, calendrier
- **Projet** : offres, projets, timesheets, achats, planning
- **Finances** : facturations
- **RH & Documents** : onboarding, documents
- **Configuration** (admin uniquement)

### 3.3 La topbar

Toujours visible en haut, elle contient :

- À gauche : icône hamburger (mobile uniquement)
- Au centre : la barre de **recherche globale** (clic ou ⌘K)
- À droite : ton avatar avec menu déroulant (Mon profil / Déconnexion)

### 3.4 Recherche globale (palette Cmd+K)

C'est l'outil le plus puissant de navigation.

**Ouverture** :
- Raccourci clavier : ⌘ K (Mac) ou Ctrl + K (Windows)
- Ou clique la barre de recherche

**Utilisation** :

1. Tape au moins 2 caractères
2. Les résultats apparaissent groupés par type (Entreprises, Contacts, Offres, Projets, Demandes, Missions, Candidats, Consultants, Documents, Onboarding, etc.)
3. Navigue avec ↑ ↓ et valide avec Entrée
4. Esc ou clic en dehors pour fermer

**Recherche multi-mots** : "Zoetis offre janvier" cherche les offres dont le titre OU la référence OU la description OU le nom du client matche **tous les mots**.

**Recherche cross-entité** : taper le nom d'un client retourne aussi ses offres, projets, missions et demandes liées.

**Recherche par compétence** : taper un skill (ex. "Java") retourne les candidats et consultants ayant ce skill.

### 3.5 Filtres de liste

Sur chaque page de liste (entreprises, offres, etc.) tu disposes d'une barre de filtres en haut :

- Champ texte de recherche
- Sélecteurs de statut, catégorie, etc.
- Bouton "Filtrer" pour appliquer

Les filtres se reflètent dans l'URL — tu peux donc bookmark une vue filtrée.

### 3.6 Tri des colonnes

Cliquer sur un en-tête de colonne trie la liste par cette colonne. Re-cliquer inverse l'ordre.

### 3.7 Raccourcis clavier

| Raccourci | Action |
|-----------|--------|
| ⌘ K / Ctrl K | Ouvrir la palette de recherche |
| Esc | Fermer modal/palette |
| ↑ ↓ | Naviguer dans une liste (palette) |
| Entrée | Valider la sélection |

---

## 4. Module Pilotage

### 4.1 Tableau de bord (`/dashboard`)

**Permission requise** : `dashboard.read`

Vue synthétique de l'état de la boîte à l'instant T. Tu y trouves :

**KPIs principaux** :

- **Offres en cours** : nombre d'offres en statut DRAFT, SENT, NEGOTIATION (uniquement la version actuelle, pas les V1 remplacées par V2)
- **Gagnées YTD** : nombre d'offres gagnées depuis le 1er janvier
- **Perdues YTD** : idem perdues
- **Projets actifs** : projets en statut TO_START ou ACTIVE
- **Heures semaine** : total des heures timesheets saisies cette semaine
- **Achats ouverts** : montant des achats non encore reçus
- **Milestones à venir** : factures à émettre dans les 30 prochains jours
- **Milestones en retard** : factures qui auraient dû être émises et ne l'ont pas été

**Sections** :

- **Mes tâches** : timesheets non saisis, milestones en retard, actions personnelles
- **Pipeline commercial** : top 5 offres ouvertes par valeur
- **Projets en alerte** : projets en dépassement budgétaire
- **Cashflow ce mois** : résumé entrées/sorties prévues du mois en cours

Chaque ligne est cliquable et navigue vers la page détail correspondante.

### 4.2 Statut projet (`/project-status`)

**Permission requise** : `projects.read`

Vue tabulaire de tous les projets en cours avec leur consommation horaire.

**Colonnes** :

- Référence (PRJ-2026-XXXX)
- Nom du projet
- Client
- Statut (à démarrer / actif / en pause / terminé)
- Heures vendues
- Heures consommées (validées + en attente)
- Reste à faire (saisi par l'équipe)
- Total estimé = consommées + reste à faire
- Barre de progression visuelle
- Date de dernière mise à jour du reste

**Code couleur** :

- **Rouge** : total estimé > heures vendues (dépassement)
- **Orange** : total estimé ≥ 90% des heures vendues (à surveiller)
- **Vert** : sous le seuil

**Mise à jour du "reste à faire"** : clique dans la cellule et tape la nouvelle valeur. Sauvegardée automatiquement.

**Filtres** :

- Vue par défaut : projets en cours (TO_START, ACTIVE, ON_HOLD)
- Bouton "Voir tous les projets" inclut les terminés et annulés

### 4.3 Simulateur de package (`/salary-simulator`)

**Permission requise** : `consulting.read`

Outil de simulation du package salarial d'un consultant pour calculer :

- Le coût employeur total
- Le brut imposable
- Le net en main du consultant
- Le TJM vendu nécessaire pour atteindre une marge cible

**Variables d'entrée** :

- Salaire brut mensuel
- Régime de travail (5j, 4j, etc.)
- Voiture de société (avec ATN)
- Chèques-repas
- Hospitalisation (mensuel × 12)
- GSM/Internet (mensuel × 12)
- Assurance groupe
- Frais de représentation
- Marge cible Dasolabs

**Onglets** :

- **Simulateur package** : calcul global
- **Calculateur brut/net** : conversion brute → net belge avec tous les paramètres (impôts, sécurité sociale, ATN voiture)

**Sauvegarder un scénario** : clique "Sauvegarder" et donne un nom. Tes scénarios apparaissent sur la fiche candidat liée.

### 4.4 Cashflow (`/cashflow`)

**Permission requise** : `finance.read` (lecture), `finance.write` (modifications)

Tableau de bord de trésorerie annuelle, organisé en grille 12 mois × N lignes.

**KPIs en haut** :

- **En cours** : total TVAC des factures émises (status INVOICED) non payées — c'est ton outstanding receivables
- **Solde compte** : solde réel calculé depuis le solde initial + tous les paiements marqués payés
- **Entrées année** : somme des recettes prévues (hors simulations)
- **Sorties année** : somme des dépenses prévues
- **Net année** : entrées − sorties
- **Solde fin d'année** : projection du solde au 31/12

**Grille mensuelle** :

Les lignes sont regroupées par section :

- **Recettes** :
  - Milestones de facturation (BillingMilestone) — TVAC, datés à la date d'encaissement attendu
  - Revenus récurrents (RecurringExpense isIncome=true)
  - Recettes ponctuelles (OneOffCashflowEntry kind=INCOME)
- **Dépenses récurrentes** : salaires, loyers, abonnements (RecurringExpense)
- **Dépenses ponctuelles** : achats, frais exceptionnels
- **Engagements** : contrats signés à venir
- **Simulations** : what-if (ex. mission consultant en négociation)

**Cellules** :

- Chaque cellule = un montant et un statut (PLANNED, PAID, SKIPPED)
- Le total mensuel apparaît en bas
- Le cumul depuis le solde initial est affiché ligne du bas

**Édition** :

- Clic sur une cellule **vide** : ajoute une nouvelle ligne
- Clic sur une cellule **avec valeur** d'une récurrence : ouvre l'éditeur inline (modifier le montant pour ce mois précis)
- Clic sur une cellule de **OneOff/sim** : ouvre le modal d'édition complet
- Clic sur le **crayon** d'une ligne : édite la définition de cette ligne (montant par défaut, fréquence, etc.)

**Sélecteur année** : en haut à droite, navigue entre les années passées et futures.

**Filtre simulations** : case à cocher "Afficher avec simulations" superpose les what-if au cashflow réel.

**Cleanup avant mois X** : bouton pour skipper toutes les récurrences avant un mois donné (utile quand tu commences à encoder en cours d'année).

### 4.5 TVA trimestrielle (`/test/tva`)

**Permission requise** : `finance.read`

Aide à la déclaration TVA trimestrielle.

**Sélecteur trimestre** : Q1/Q2/Q3/Q4 + année.

**Affichage** :

- TVA collectée (sur ventes — factures émises avec TVA)
- TVA déductible (sur achats — factures fournisseurs)
- TVA due (net à reverser)
- Tableau détaillé par facture
- Bouton "Copier le récapitulatif" pour collage dans IntervAT ou ton expert-comptable

### 4.6 Outils & apps (`/app-links`)

**Permission requise** : `applinks.read` (lecture), `applinks.write` (édition)

Page de raccourcis vers les applications externes utilisées par Dasolabs : Scaleway, Coolify, GitHub, Slack, Google Workspace, Anthropic Console, etc.

**Vue** : grille de "dalles" cliquables. Chaque dalle affiche :

- Nom de l'app
- Domaine
- Description courte

**Cliquer** : ouvre l'app dans un nouvel onglet.

**Ajouter une app** (avec `applinks.write`) : bouton "Ajouter une app" en haut à droite. Formulaire avec nom, URL, description.

**Modifier/supprimer** : icône crayon discrète au coin de chaque dalle, visible au survol.

---

## 5. Module Commerciale

### 5.1 Entreprises (`/companies`)

**Permission requise** : `companies.read` (lecture), `companies.write` (édition)

Liste de tous les clients, prospects, partenaires, fournisseurs.

**Filtres** :

- Statut (PROSPECT, CLIENT, PARTNER, SUPPLIER, INACTIVE, ARCHIVED)
- Recherche par nom, numéro TVA, ville

**Bouton Import** : `/companies/import` permet d'importer un CSV en masse.

**Fiche entreprise** (clic sur la ligne) :

- Informations légales (nom, n° TVA, adresse, IBAN, conditions de paiement)
- Contacts associés
- Offres en cours/passées
- Projets actifs/terminés
- Missions
- Achats vers cette entreprise (si fournisseur)
- Documents rattachés
- Historique d'activités

**Créer une entreprise** : bouton "Nouvelle entreprise" en haut à droite.

### 5.2 Contacts (`/contacts`)

**Permission requise** : `contacts.read` (lecture), `contacts.write` (édition)

Liste des personnes physiques rattachées aux entreprises (interlocuteurs commerciaux, contacts opérationnels).

**Filtres** : nom, email, job title, entreprise.

**Bouton Import** : CSV en masse.

**Fiche contact** :

- Coordonnées (email, téléphone, LinkedIn)
- Entreprise rattachée
- Activités commerciales liées
- Documents

### 5.3 Activités commerciales (`/commercial`)

**Permission requise** : `contacts.read`

Historique des interactions commerciales : appels, emails, meetings, notes. Permet de tracer le suivi client.

**Saisie** : depuis la fiche d'un contact, bouton "Logger une activité" avec type (call, email, meeting, note), date, sujet, corps.

### 5.4 CRM pipeline (`/test/crm`)

**Permission requise** : `crm.read` (lecture), `crm.write` (déplacement de cartes)

Tableau Kanban du pipeline commercial — visualisation des opportunités/offres/projets par stade.

**Colonnes** :

1. **Identifié** : opportunité détectée, pas qualifiée
2. **Qualifié** : besoin confirmé
3. **Proposé** : devis envoyé
4. **Négociation** : en discussion
5. **Gagné** : signé
6. **Perdu** : refusé
7. **Annulé** : caduque (option toggle pour afficher/masquer)

**Cartes affichées** :

- Opportunités (table Opportunity)
- Demandes de mission
- Offres
- Projets

Chaque carte affiche le titre, le montant estimé, la probabilité, le client, l'owner, la date de décision attendue.

**Déplacement** :

- Drag-and-drop entre colonnes
- Flèches gauche/droite sur la carte (mobile)
- Bouton ✕ pour "Perdre" avec saisie d'une raison
- Bouton 🚫 pour "Annuler"

**Cas particulier : carte Offre vers Gagné** :

Quand tu déplaces une offre vers "Gagné", tu n'es pas directement marqué WON. Tu es redirigé vers le **wizard de création de projet** (`/offers/[id]/win`). Voir [§7.1.5](#715-marquer-une-offre-gagnée-le-wizard).

**Création d'une nouvelle affaire** : formulaire en haut de page.

**KPIs en haut** :

- Pipeline brut (somme valeurs ouvertes)
- Carnet pondéré (Σ valeur × proba)
- Gagné YTD
- Taux de conversion

---

## 6. Module Consultance

### 6.1 Candidats (`/candidates`)

**Permission requise** : `consulting.read` (lecture), `consulting.write` (édition)

Base de données des candidats consultants — personnes pas encore embauchées mais identifiées pour de futures missions.

**Filtres** : nom, skills, séniorité, statut (ACTIVE, INACTIVE, ARCHIVED), ville, disponibilité.

**Fiche candidat** :

- Identité (nom, email, téléphone, LinkedIn, photo)
- Compétences techniques (multi-select avec autocomplete)
- Langues parlées
- Tarifs (coût journalier, horaire, tarif min souhaité)
- Disponibilité (date)
- Source (LinkedIn, recommandation, plateforme...)
- Owner (recruteur référent)
- Expériences professionnelles
- CV (upload PDF, parsing automatique pour pré-remplir les compétences)
- Notes
- Scénarios de package salarial sauvegardés
- Applications aux missions

**Création** : bouton "Nouveau candidat" en haut. Saisie manuelle OU drop d'un CV PDF avec parsing IA.

**Parser CV automatique** (`/test/cv-parser`) : drop un PDF de CV, l'IA extrait nom, email, compétences, expériences. Tu valides et crées le candidat.

### 6.2 Consultants (`/consultants`)

**Permission requise** : `consulting.read` (lecture), `consulting.write` (édition)

Liste des consultants internes Dasolabs (= utilisateurs avec rôle CONSULTANT + ayant un profil rempli).

**Fiche consultant** :

- Identité
- Compétences
- Séniorité
- Tarif journalier (vendu) et coût employeur
- Missions actuelles et passées
- Timesheets
- Notes de frais
- Entretiens (reviews)
- Documents
- Onboarding (si présent)

### 6.3 Demandes de mission (`/mission-requests`)

**Permission requise** : `consulting.read` (lecture), `consulting.write` (édition)

Demandes entrantes d'un client : "j'ai besoin d'un consultant Java senior pendant 3 mois".

**Filtres** : référence (DEM-2026-XXXX), titre, statut, client.

**Statuts** :

- NEW : demande reçue
- QUALIFYING : qualification en cours
- PRESENTING : présentation de candidats
- CONTRACTED : signé
- LOST : perdu
- CANCELLED : annulé

**Fiche demande** :

- Référence + titre + description
- Client + contact
- Société intermédiaire (Randstad, etc.) si applicable
- Owner Dasolabs
- Profil recherché : skills requises, séniorité, lieu de travail
- Période souhaitée : date de début, durée estimée
- Tarif visé client (target daily rate)
- Candidats proposés (= applications)
- Mission liée (si signé)
- Documents

**Workflow** :

1. Création de la demande
2. Recherche de candidats via `/test/matching` (matching automatique)
3. Présentation de 1-3 candidats au client (création d'applications)
4. Si client choisit un candidat → création d'une offre
5. Offre signée → création de la mission exécutée

### 6.4 Missions (`/missions`)

**Permission requise** : `consulting.read` (lecture), `consulting.write` (édition)

Missions exécutées : un consultant interne place chez un client.

**Filtres** : référence (MIS-2026-XXXX), titre, consultant, client, statut.

**Statuts** :

- PLANNED : à démarrer
- ACTIVE : en cours
- ON_HOLD : en pause
- COMPLETED : terminé
- CANCELLED : annulé

**Fiche mission** :

- Référence + titre
- Demande source
- Application sélectionnée (candidat retenu)
- Consultant assigné
- Client final + société intermédiaire
- Période contractuelle : startDate, endDate, actualEndDate
- Jours estimés
- Tarif journalier (facturé client) + coût journalier (payé consultant)
- Lieu de travail
- Fréquence facturation (mensuelle par défaut)
- TVA applicable
- Statut
- Timesheets associés
- Milestones de facturation (générés mensuellement)
- Notes

**Générer les factures mensuelles** : depuis la fiche mission, bouton "Générer factures mensuelles" crée des `BillingMilestone` pour chaque mois entre startDate et endDate. Tu peux les éditer ensuite (jours, montant).

**Édition par cellule mensuelle** : tableau annuel jours/mois éditable inline.

### 6.5 Matching mission (`/test/matching`)

**Permission requise** : `consulting.read`

Algorithme de matching entre une demande de mission et tes candidats/consultants.

**Usage** :

1. Sélectionne une demande de mission
2. Le système calcule un score de match pour chaque candidat/consultant en se basant sur :
   - Skills overlap
   - Séniorité
   - Disponibilité (dates)
   - Tarif (dans le budget client)
3. Liste triée par score, avec explications

Bouton "Présenter ce candidat" crée une application directement.

### 6.6 Entretiens (`/reviews`)

**Permission requise** : `reviews.read` (lecture), `reviews.write` (édition)

Entretiens des consultants : onboarding, check-in mensuels/trimestriels, entretien annuel, fin de mission, performance, carrière, offboarding.

**Filtres** : sujet (consultant), type d'entretien, statut, mission liée.

**Statuts** :

- SCHEDULED : planifié
- COMPLETED : terminé
- CANCELLED : annulé
- RESCHEDULED : reprogrammé

**Création** : bouton "Planifier un entretien" avec sujet (consultant), date, type, projet/mission lié, conducteur.

**Saisie après entretien** : champs feedback, objectifs, notes privées (visibles uniquement aux admin/manager), statut.

**Auto-création depuis onboarding** : quand tu lances un onboarding (voir §9.1), 4 entretiens sont auto-planifiés à J+1, J+30, J+90, J+180.

### 6.7 Calendrier (`/calendar`)

**Permission requise** : `consulting.read`

Vue calendrier des événements consultance : missions, entretiens, jalons.

---

## 7. Module Projet

### 7.1 Offres (`/offers`)

**Permission requise** : `offers.read` (lecture), `offers.write` (édition)

Gestion des devis commerciaux.

#### 7.1.1 Liste

Filtres : référence (OFF-2026-XXXX), titre, statut, client.

**Important** : seule la **version courante** de chaque offre est affichée. Si tu as V1 + V2, seule V2 apparaît. Les V1 restent accessibles via la fiche V2 → "version précédente".

**Statuts** :

- DRAFT : brouillon
- SENT : envoyée au client
- NEGOTIATION : en discussion
- WON : gagnée (projet créé)
- LOST : perdue
- CANCELLED : annulée

#### 7.1.2 Création

Bouton "Nouvelle offre". Saisie :

- Titre
- Mode : **Projet (forfait)** ou **Consultance (T&M)**
- Client
- Responsable commercial
- Probabilité (par défaut 50%)
- Description
- TVA applicable (par défaut 21%, mettre 0% pour client exonéré)

À la création, le système génère automatiquement une référence (OFF-2026-XXXX).

#### 7.1.3 Édition de l'offre

La fiche d'offre est divisée en plusieurs sections :

**Header** :

- Titre, statut, probabilité, client, responsable, dates, description, commentaires
- En statut DRAFT : tout est éditable
- En statut SENT/NEGOTIATION : tu peux toujours modifier titre, owner, dates, probabilité, description, TVA, MAIS pas les lignes/tranches/options (substance financière verrouillée)
- En statut WON/LOST/CANCELLED : tout est verrouillé en lecture seule

**Lignes de devis** :

Liste des prestations/livrables avec :

- Description
- Type (prestation jour, forfait, matériel)
- Profil de prestation (template avec tarif horaire / journalier)
- Quantité, unité
- Prix unitaire de vente, coût unitaire
- Pourcentage de marge OU marge en €
- Remise %
- Totaux calculés automatiquement

**Options** :

Blocs séparés présentés au client en plus du devis principal. Chaque option a son nom, sa description et ses propres lignes.

Apparaissent dans le PDF en page séparée (2bis).

**Tranches de facturation (Milestones)** :

Découpage du montant total en jalons facturables :

- Libellé (ex. "Acompte 30%")
- Pourcentage du total OU montant fixe
- Date d'encaissement attendue
- Déclencheur (ex. "à la signature", "à la livraison du module X")

Servent à projeter le cashflow.

#### 7.1.4 Versioning

Une offre **SENT** ou **NEGOTIATION** peut être versionnée si le client demande des modifications de substance.

**Bouton "+ Nouvelle version"** :

- Crée une V+1 en statut DRAFT
- Clone : titre, description, lignes, options (avec leurs lignes), tranches, contacts
- L'ancienne reste consultable mais figée
- La référence devient `OFF-XXXX-V2`

Pour la modifier, va sur la V2.

#### 7.1.5 Marquer une offre gagnée — le wizard

Quand le client accepte ton devis, tu marques l'offre **gagnée**. Cela déclenche la création du projet associé.

**Déclencheur** :

- Sur la fiche offre : sélecteur "Changer de statut..." → "Marquer gagnée"
- Ou drag de la carte vers la colonne "Gagné" dans le CRM

**Tu es redirigé vers le wizard** (`/offers/[id]/win`) qui te demande :

**Section 1 — Configuration du projet** :

- Nom du projet (pré-rempli depuis le titre de l'offre, éditable)
- Manager du projet
- Date de démarrage prévu
- Date de fin prévue
- Notes / rappels

**Section 2 — Échéances de facturation** :

Pour chaque tranche, tu confirmes/ajustes la **date d'émission de la facture**. Le système calcule automatiquement la **date d'encaissement attendue** (= date facture + 30 jours fin de mois, ou ton délai de paiement) et le **montant TVAC**.

**Clic "Créer le projet et marquer gagnée"** :

- Crée le projet avec sa référence (PRJ-2026-XXXX)
- Rattache les tranches au projet
- Stocke la date d'encaissement comme `expectedAt` sur chaque tranche (apparaît au bon mois dans le cashflow)
- Marque l'offre WON
- Te redirige vers la fiche du nouveau projet

#### 7.1.6 Compléments d'offre

Pour ajouter une prestation à une offre déjà signée (sans créer une V2), utilise un complément.

**Bouton "+ Complément"** sur la fiche offre :

- Crée une nouvelle offre liée à l'original (parentOfferId)
- Référence : `OFF-XXXX-C1`
- Statut DRAFT, sans lignes (à saisir)
- Hérite client/owner/mode

Quand tu marques le complément WON, **ses tranches sont fusionnées dans le projet parent** (pas de nouveau projet créé).

#### 7.1.7 PDF d'offre

Bouton "Exporter PDF" sur la fiche offre. Génère un PDF 3 pages :

- Page 1 : Garde + introduction
- Page 2 : Détails (lignes + tranches)
- Page 3 : Conditions
- Page 2bis (optionnel) : Options si présentes

Le PDF reprend ton branding (logo, couleurs Dasohub).

#### 7.1.8 Suppression / duplication

- **Dupliquer** : copie l'offre en DRAFT (utile pour template)
- **Supprimer** : possible sauf si statut WON

### 7.2 Projets (`/projects`)

**Permission requise** : `projects.read` (lecture), `projects.write` (édition)

Suivi opérationnel des projets gagnés.

#### 7.2.1 Liste

Filtres : référence, nom, client, statut.

**Statuts** :

- TO_START : à démarrer
- ACTIVE : en cours
- ON_HOLD : en pause
- COMPLETED : terminé
- CANCELLED : annulé

#### 7.2.2 Fiche projet

- Header (référence, nom, mode, statut, client, manager, dates)
- Budget : heures vendues, heures consommées, marge estimée
- Membres du projet (consultants assignés)
- **Tranches de facturation** (BillingMilestone) — voir §7.2.3
- Timesheets liés
- Achats liés
- Entretiens (reviews) liés
- Documents

#### 7.2.3 Tranches de facturation (Milestones)

Section centrale pour gérer la facturation du projet.

**Tableau** :

- Libellé
- Montant HT
- **Date d'encaissement** (éditable inline) — date où tu attends l'argent sur ton compte
- Statut (PLANNED / READY / INVOICED / TRANSMITTED / PAID / CANCELLED)
- Bouton supprimer

**Workflow typique** :

1. PLANNED → la date est définie (lors du wizard d'offre gagnée)
2. READY → le livrable est validé, prêt à facturer
3. INVOICED → la facture est émise et envoyée
4. PAID → le client a payé

**Note importante sur les dates** : La date stockée est la **date d'encaissement attendu** (pas la date facture). Le wizard d'offre gagnée fait le calcul "facture + 30j fin de mois" pour toi. Une fois le projet créé, tu peux ajuster cette date depuis la fiche projet pour refléter la réalité (facture envoyée plus tôt ou retardée, paiement décalé).

Modifier une date d'encaissement met à jour automatiquement le cashflow et le dashboard.

**Ajouter une tranche manuellement** : formulaire en bas du tableau (libellé, montant HT, date, déclencheur).

#### 7.2.4 Mode CONSULTING : facturation périodique

Pour un projet en mode CONSULTING (consultance T&M), tu peux activer une fréquence de facturation (mensuelle par défaut) et générer automatiquement les jalons mensuels via le bouton dédié.

### 7.3 Timesheets (`/timesheet`)

**Permission requise** : `timesheet.self.write` (saisie), `timesheet.validate` (validation)

Saisie quotidienne du temps consultant.

#### 7.3.1 Saisie

Grille semaine (lun-dim) × projets/missions/centres de coût.

**Pour chaque cellule** : tu tapes le nombre d'heures travaillées. La valeur est sauvegardée automatiquement.

**Type d'activité** (par cellule) :

- DEVELOPMENT, ANALYSIS, MEETING, SUPPORT, TRAINING, COMMERCIAL, ADMIN, OTHER

**Ajouter une cible** : bouton "+ Ajouter projet/mission/centre de coût" en bas de la grille.

**Statut de chaque saisie** :

- DRAFT : brouillon, modifiable
- SUBMITTED : soumis pour validation
- APPROVED : validé
- REJECTED : refusé avec note

**Bouton "Soumettre la semaine"** : passe toutes les saisies DRAFT en SUBMITTED.

#### 7.3.2 Validation (managers)

`/timesheet/validation` — liste des timesheets SUBMITTED en attente de validation.

**Pour chaque entrée** :

- Utilisateur
- Date
- Projet/Mission/Centre de coût (avec référence)
- Heures
- Type d'activité
- Description
- Boutons "Approuver" / "Rejeter (avec note)"

### 7.4 Achats (`/purchases`)

**Permission requise** : `purchases.read` (lecture), `purchases.write` (édition)

Suivi des achats liés à un projet.

**Filtres** : description, projet, statut.

**Statuts** : PLANNED, ORDERED, RECEIVED, PAID, CANCELLED.

**Fiche achat** :

- Description
- Projet rattaché
- Fournisseur (entreprise)
- Montant HT, TVA, TTC
- Date prévue, date commande, date réception, date paiement
- PDF facture (upload)

### 7.5 Planning (`/planning`)

**Permission requise** : `planning.read` (lecture), `planning.write` (édition)

Vue calendrier des consultants : qui est où, sur quel projet/mission, quelle semaine.

Permet d'identifier les sous/sur-occupations et de planifier les missions futures.

---

## 8. Module Finances

### 8.1 Facturations (`/finance`)

**Permission requise** : `finance.read` (lecture), `finance.write` (édition)

Vue d'ensemble de toutes les tranches de facturation à émettre/émises, tous projets et missions confondus.

**Filtres** :

- Client
- Projet/Mission
- Statut (PLANNED, READY, INVOICED, TRANSMITTED, PAID, CANCELLED)
- Période

**Actions par tranche** :

- Modifier le statut directement dans le tableau
- Cliquer pour naviguer vers le projet/mission

**Tableau récap mensuel** : total facturé / payé / en attente par mois.

### 8.2 Factures fournisseurs

Une page dédiée existe (`/test/supplier-invoices`) pour gérer les factures reçues de tes fournisseurs (Scaleway, services SaaS, sous-traitants).

**Workflow** :

1. Drop un PDF de facture fournisseur
2. OCR (Claude Vision ou Gemini) extrait automatiquement : fournisseur, numéro, dates, montants HT/TVA/TTC
3. Tu valides et complètes manuellement si besoin
4. Statut : DRAFT, VALIDATED, PAID

Sert aussi à la déclaration TVA déductible.

### 8.3 Notes de frais

`/test/expenses` — saisie des notes de frais des consultants.

**Workflow consultant** :

1. Photo du ticket → upload
2. OCR extrait montant et catégorie
3. Validation par manager
4. Remboursement via Dasolabs

---

## 9. Module RH & Documents

### 9.1 Onboarding (`/onboarding`)

**Permission requise** : `onboarding.read` (lecture), `onboarding.write` (édition)

Checklist d'arrivée pour chaque nouvel utilisateur Dasolabs.

#### 9.1.1 Liste

Vue grille des onboardings en cours et récemment terminés. Chaque carte affiche :

- Nom de la personne
- Rôle
- Template utilisé
- Date de démarrage
- Barre de progression (items faits / total)

#### 9.1.2 Lancer un onboarding

Formulaire en haut de la page liste :

- Sélecteur user (parmi ceux qui n'ont pas encore d'onboarding)
- Date d'arrivée
- Template (auto-sélectionné selon le rôle, ou choisi manuellement)

**À la création** :

- Tous les items du template sont copiés dans l'instance
- 4 entretiens sont planifiés (J+1, J+30, J+90, J+180) — visibles dans `/reviews`

#### 9.1.3 Fiche onboarding

`/onboarding/[userId]` — checklist groupée par catégorie (Administratif, IT, Formation, Intégration équipe, ou catégories custom).

**Cocher un item** : clic sur la case. L'item passe en done, doneAt + doneById remplis.

**Ajouter un item à la volée** : bouton "+ Ajouter un item" dans une catégorie ou "+ Nouvelle catégorie + item".

**Supprimer un item** : icône poubelle au survol.

**Panneau "Entretiens planifiés"** à droite : liste des reviews du subject avec leur statut.

**Bouton "Archiver"** : passe l'onboarding en ARCHIVED (n'apparaît plus en liste par défaut).

### 9.2 Documents (`/documents`)

**Permission requise** : `documents.read` (consultation/téléchargement), `documents.write` (upload/modification/suppression)

DMS interne pour stocker contrats, NDA, procédures, livrables, CVs signés, etc.

#### 9.2.1 Liste

**Filtres** :

- Texte libre (titre, nom de fichier, description)
- Tag
- Expire dans 30 jours (alertes d'échéance)

**Colonnes** :

- Titre + nom du fichier original
- Tags
- Entités liées (entreprise, projet, offre, consultant)
- Date d'expiration (en rouge si dépassée, orange si imminente)
- Taille
- Date d'ajout + uploader

Cliquer une ligne → fiche document.

#### 9.2.2 Upload

Formulaire en haut de la page :

- **Drop zone** : glisse un fichier ou clique pour parcourir (max 50 MB)
- Titre (pré-rempli depuis le nom du fichier)
- Tags (CSV : "Contrat, NDA, RH")
- Date d'expiration optionnelle
- Description
- Section "Lier à une entité" (repliable) : choix entreprise / projet / offre / consultant

#### 9.2.3 Fiche document

`/documents/[id]`

- Métadonnées éditables (titre, tags, expiration, description, liens entités)
- Liens cliquables vers entreprise / projet / offre / consultant
- Panneau **Versions** à droite :
  - Version actuelle en vert (avec bouton télécharger)
  - Versions précédentes (avec bouton télécharger chacune)
  - Bouton "Nouvelle version" : drop d'un fichier qui devient V+1
- Bouton **Supprimer** en bas à gauche : supprime le doc + ses versions

#### 9.2.4 Téléchargement

Clic sur l'icône **télécharger** d'une version → ouvre dans le navigateur (PDF / image) ou télécharge (autres types).

**Sécurité** : chaque téléchargement re-vérifie l'authentification et logge un événement dans l'audit trail.

---

## 10. Annexes

### 10.1 Statuts d'une offre

| Statut | Libellé | Modifiable ? | Action possible |
|--------|---------|--------------|-----------------|
| DRAFT | Brouillon | Oui (tout) | Toutes |
| SENT | Envoyée | Header oui, lignes non | Passer en NEGOTIATION, marquer gagnée, marquer perdue, nouvelle version |
| NEGOTIATION | En négociation | Header oui, lignes non | Marquer gagnée, marquer perdue, nouvelle version |
| WON | Gagnée | Non (figée) | Voir le projet |
| LOST | Perdue | Non | Dupliquer |
| CANCELLED | Annulée | Non | — |

### 10.2 Statuts d'un milestone de facturation

| Statut | Libellé | Quand l'utiliser |
|--------|---------|------------------|
| PLANNED | Prévue | Création initiale, date connue |
| READY | Prête à facturer | Livrable validé, OK pour émettre la facture |
| INVOICED | Facturée | Facture émise et envoyée au client (PDF/email) |
| TRANSMITTED | Transmise Peppol | Facture envoyée électroniquement via Peppol |
| PAID | Payée | Argent reçu sur le compte |
| CANCELLED | Annulée | Caduque |

Le KPI cashflow "En cours" compte les statuts INVOICED.

### 10.3 Statuts d'une mission

PLANNED, ACTIVE, ON_HOLD, COMPLETED, CANCELLED.

### 10.4 Statuts d'un projet

TO_START, ACTIVE, ON_HOLD, COMPLETED, CANCELLED.

### 10.5 Statuts d'une demande de mission

NEW, QUALIFYING, PRESENTING, CONTRACTED, LOST, CANCELLED.

### 10.6 Catégories d'activité timesheet

DEVELOPMENT, ANALYSIS, MEETING, SUPPORT, TRAINING, COMMERCIAL, ADMIN, OTHER.

### 10.7 Glossaire

- **Offre** : devis commercial envoyé à un client
- **Projet** : exécution d'une offre signée (mode forfait ou T&M)
- **Mission** : exécution T&M d'un consultant placé chez un client
- **Demande de mission** : besoin entrant client (le consultant n'est pas encore choisi)
- **Application** : candidat proposé pour une demande de mission
- **Milestone** (BillingMilestone) : tranche de facturation d'un projet ou mission
- **Recurring expense** : dépense ou recette mensuelle/trimestrielle prévisible
- **OneOff** : dépense ou recette ponctuelle
- **Engagement** (Commitment) : entrée OneOff signée à venir
- **Simulation** : entrée OneOff "what-if" non confirmée
- **Centre de coût** : catégorie d'imputation interne (SALES, LEAVE, ADMIN, RND...)
- **Profil de prestation** (ServiceProfile) : template tarifaire (junior / senior / lead par techno)
- **CRM stage** : position dans le pipeline (NEW → QUALIFIED → PROPOSED → NEGOTIATING → WON / LOST / CANCELLED)
- **TVAC** : Toutes Taxes Versées (HT + TVA)
- **HTVA** : Hors Taxes Versées (montant net HT)
- **Cashflow** : trésorerie prévisionnelle
- **Solde compte** : argent réellement disponible (solde initial + paiements marqués PAID)
- **En cours** : factures émises non encore payées (= outstanding receivables)
- **Bootstrap balance** : solde initial pour amorcer le cashflow
- **DSO** : Days Sales Outstanding — temps moyen de paiement client

### 10.8 Raccourcis clavier

| Raccourci | Action |
|-----------|--------|
| ⌘ K (Mac) / Ctrl K (Win) | Ouvrir la palette de recherche globale |
| Esc | Fermer modal/palette |
| ↑ ↓ | Naviguer dans la palette de recherche |
| Entrée | Valider sélection palette |
| Tab | Naviguer entre champs de formulaire |

### 10.9 FAQ courante

**Q : Je ne vois pas une entrée de menu**
R : Ton groupe d'accès n'a pas la permission. Demande à l'admin.

**Q : Mon mot de passe ne fonctionne plus**
R : Demande à l'admin de le réinitialiser depuis `/users/<ton-id>`.

**Q : Je vois "Application error" après une action**
R : Note l'heure exacte et envoie un screenshot à l'admin. Souvent un rafraîchissement (Cmd+R) résout.

**Q : Pourquoi mon offre apparaît deux fois dans la liste ?**
R : Tu en as créé deux versions (V1 + V2). Seule la plus récente devrait apparaître. Si les deux apparaissent, contact admin (régression possible).

**Q : Le cashflow ne reflète pas ma facture émise**
R : Vérifie sur la fiche du projet/mission que le milestone correspondant a bien sa `expectedAt` à la date d'encaissement attendu (pas la date facture). Ajuste si nécessaire.

**Q : Un client est exonéré de TVA, comment configurer ?**
R : Sur l'offre, mets `TVA = 0%`. Lors du passage en gagné, le projet héritera de ce taux. Le cashflow affichera des montants HT (pas TVAC artificiel).

**Q : Comment marquer une facture comme émise mais pas encore payée ?**
R : Sur la fiche projet → section "Tranches de facturation" → dropdown statut → "Facturée" (= INVOICED). Le KPI cashflow "En cours" la comptera.

**Q : Une entrée de cashflow plante quand je clique ?**
R : Probablement un état périmé du navigateur. Le modal "Entrée introuvable" propose "Rafraîchir la page" — clique dessus.

**Q : Comment retrouver une ancienne version d'un document ?**
R : Ouvre la fiche du document → panneau "Versions" à droite → clique l'icône télécharger de la version voulue.

**Q : Comment retrouver une ancienne version d'une offre ?**
R : Ouvre la version actuelle → en haut, lien vers "précédente : OFF-XXXX-V1".

---

*Fin du Manuel opérateur — version 1.0*

Pour les actions d'administration (gestion des utilisateurs, configuration globale, sauvegardes, déploiements), consulte le *Manuel administrateur*.
