/**
 * Seed du wiki formation. Idempotent — upserts par (categoryKey, articleSlug).
 * Contient 10 catégories × 3 articles pas-à-pas ancrés dans le vrai fonctionnement
 * de l'ERP DasoERP.
 *
 * Contenu markdown avec callouts [!STEP] pour les étapes numérotées et
 * [!TIP] / [!WARN] / [!INFO] pour astuces, alertes, précisions.
 */
import { PrismaClient } from "@prisma/client";

type Article = {
  slug: string;
  title: string;
  description: string;
  content: string;
  difficulty?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  estimatedMinutes?: number;
  requiredPermission?: string;
};

type Category = {
  key: string;
  title: string;
  description: string;
  icon?: string;         // Nom lucide-react
  colorClass?: string;
  requiredPermission: string;
  articles: Article[];
};

const CATEGORIES: Category[] = [
  {
    key: "dashboard",
    title: "Tableau de bord",
    description: "Comprendre les KPI, les alertes et l'activité récente.",
    icon: "LayoutDashboard",
    colorClass: "text-indigoaccent",
    requiredPermission: "dashboard.read",
    articles: [
      {
        slug: "kpis",
        title: "Lire les KPI du tableau de bord",
        description: "Chiffre d'affaires, missions ouvertes, solde compte, notes en attente : à quoi correspond chaque chiffre.",
        estimatedMinutes: 4,
        content: `
Le tableau de bord affiche 4 à 6 KPI en tête de page. Chacun résume un aspect de l'activité, sans avoir besoin d'ouvrir le module.

![Étape 1 — KPI Missions ouvertes en détail](/wiki/mockups/dashboard-kpis-step1.svg)

## Missions ouvertes

Nombre de \`Mission\` dont le statut est **PLANNED**, **ACTIVE** ou **EXTENDED**. C'est le vrai stock de missions consultants en cours, pas les demandes de mission en pipeline (celles-là restent dans le CRM).

> [!INFO] Différence Mission vs MissionRequest
> Une **MissionRequest** est une demande entrante d'un client (pipeline CRM). Une **Mission** est un consultant Dasolabs concrètement engagé. Le KPI compte les Mission.

![Étape 2 — KPI CA prévu et Solde compte, côte à côte](/wiki/mockups/dashboard-kpis-step2.svg)

## Chiffre d'affaires prévu

Somme des tranches (**BillingMilestone**) attendues sur l'année en cours, statuts non-CANCELLED. C'est la prévision réaliste, pas le facturé.

## Solde compte

Solde de trésorerie **réel** — calculé à partir du bootstrap manuel + tous les mouvements marqués PAID depuis le lancement, indépendamment de l'année affichée dans le cashflow. Sert de vérité terrain.

![Étape 3 — KPI Notes à approuver, rituel manager](/wiki/mockups/dashboard-kpis-step3.svg)

## Notes à approuver

Nombre de notes de frais soumises attendant validation par un manager. Si tu vois ce chiffre monter, il est temps de passer sur \`/expenses\`.

---

## Ce qui n'apparaît PAS dans les KPI

Pour ne pas encombrer, certains chiffres importants restent dans leurs modules :
- Congés en attente → \`/leaves\`
- Maladies récentes → \`/sick-leaves\` (accessible RH uniquement)
- Payroll du mois → panneau "Ce mois-ci" du cashflow
`
      },
      {
        slug: "alertes",
        title: "Comprendre les alertes du dashboard",
        description: "Cartes rouges, oranges, bleues : ce que ça veut dire et comment agir.",
        estimatedMinutes: 3,
        content: `
Sous les KPI, le dashboard affiche des **cartes d'alerte** — des tâches à prendre en main aujourd'hui.

![Étape 1 — Cartes rouges avec cas concrets et actions](/wiki/mockups/dashboard-alertes-step1.svg)

> [!STEP] 1. Cartes rouges
> Actions urgentes : mission arrivant à échéance, offre en retard, note de frais bloquée. Un clic ouvre la fiche concernée.

![Étape 2 — Cartes oranges avec explications de contexte](/wiki/mockups/dashboard-alertes-step2.svg)

> [!STEP] 2. Cartes oranges
> Anomalies à surveiller : cellule cashflow non résolue, milestone dont la date de paiement est dépassée sans être marquée PAID.

![Étape 3 — Cartes bleues informatives](/wiki/mockups/dashboard-alertes-step3.svg)

> [!STEP] 3. Cartes bleues
> Informatif — nouveaux candidats à trier, nouveaux entrants du CRM.

> [!TIP] Rituel matinal
> Idéalement, 5 minutes tous les matins pour vider toutes les cartes rouges. Si tu ne peux pas agir sur une carte, note l'action dans ton propre système et passe à la suivante.
`
      },
      {
        slug: "recherche",
        title: "Rechercher n'importe quoi avec Cmd+K",
        description: "La palette de commandes cherche dans companies, contacts, projets, missions, candidats, wiki.",
        estimatedMinutes: 2,
        content: `
Depuis n'importe quelle page, **Cmd+K** (ou **Ctrl+K** sur Windows) ouvre la palette de recherche globale.

![Étape 1 — Ouvrir la palette avec Cmd+K depuis n'importe où](/wiki/mockups/dashboard-recherche-step1.svg)

## Ce qui est indexé

- Entreprises + contacts
- Missions et demandes de mission
- Offres et projets
- Candidats et consultants internes
- Documents

![Étape 2 — Résultats groupés par type d'entité](/wiki/mockups/dashboard-recherche-step2.svg)

> [!TIP] Recherche multi-mots
> \`sophie belgian\` filtre tout ce qui contient à la fois "sophie" ET "belgian" — pratique pour croiser un prénom et une entreprise sans se rappeler du reste.

![Étape 3 — Recherche multi-mots : "sophie belgian" trouve la bonne personne](/wiki/mockups/dashboard-recherche-step3.svg)

> [!INFO] Résultat prioritaire
> Les résultats sont groupés par entité. Le premier résultat est sélectionné par défaut : appuie sur **Entrée** pour ouvrir directement.
`
      }
    ]
  },
  {
    key: "cashflow",
    title: "Cashflow",
    description: "Grille annuelle des recettes/dépenses, panneau du mois, simulations et statuts.",
    icon: "Wallet",
    colorClass: "text-emerald-600",
    requiredPermission: "cashflow.read",
    articles: [
      {
        slug: "principe",
        title: "Comprendre la grille cashflow",
        description: "12 colonnes = 12 mois. Une ligne = un flux (mission, dépense récurrente, poste ponctuel).",
        estimatedMinutes: 6,
        content: `
Le cashflow est le poste de commande financier de Dasolabs. Il faut prendre 5 minutes pour comprendre sa structure, puis c'est fluide.

![Étape 1 — Structure de la grille : lignes, colonnes, cellules](/wiki/mockups/cashflow-principe-step1.svg)

## Structure de la grille

- **Colonnes** : les 12 mois de l'année sélectionnée (janvier à décembre).
- **Lignes** : un flux financier. Peut être une **mission** (aggrégée par mois), une **dépense récurrente** (loyer, comptable), une **entrée ponctuelle** (subside, remboursement TVA), ou une **payroll** (3 lignes : NET, précompte, ONSS).
- **Cellules** : le montant prévu ce mois-là pour ce flux. La couleur indique le **statut** : gris = prévu, bleu = facturé, vert = payé.

## Le solde de compte

Le **solde compte** en tête est ta trésorerie **réelle** aujourd'hui — indépendant de l'année affichée. Il vient du bootstrap manuel + tous les mouvements PAID chronologiquement.

![Étape 2 — Filtre auto : ligne masquée si plus aucun paiement futur](/wiki/mockups/cashflow-principe-step2.svg)

> [!WARN] Ne pas confondre solde compte et solde année
> Le solde année (fin décembre) est une **projection**. Le solde compte est la vérité banque.

![Étape 3 — Panneau Ce mois-ci pour un check quotidien](/wiki/mockups/cashflow-principe-step3.svg)

## Filtre "vue courante"

En cours d'année, une ligne est masquée si elle **n'a plus aucun paiement futur**. Ex: EDEBEX facturé jusqu'en juin, on est en septembre → la ligne disparaît. Elle reste dans le total annuel mais désencombre la grille.

> [!TIP] Retrouver une ligne masquée
> Change l'année (bouton "Année précédente" / "Année suivante") ou marque une nouvelle échéance future.
`
      },
      {
        slug: "marquer-paye",
        title: "Marquer une tranche facturée puis payée",
        description: "Le workflow standard sur une mission client : PLANNED → INVOICED → PAID.",
        estimatedMinutes: 5,
        content: `
Sur une tranche mission, tu passeras typiquement par 3 statuts : **PLANNED** (prévu, gris) → **INVOICED** (facturé, bleu) → **PAID** (encaissé, vert). Ce guide te montre comment passer une tranche de INVOICED à PAID quand le client a viré la somme.

![Étape 1 — Zoom sur la cellule INVOICED à passer en PAID](/wiki/mockups/cashflow-paid-step1.svg)

> [!STEP] 1. Repérer la tranche INVOICED
> Va sur le cashflow. Trouve la cellule bleue à passer en PAID — c'est celle du mois où la facture a été émise. Ici, Mission ACME Mars 2026 (13 750 € HT / 16 637,50 € TTC).

![Étape 2 — Modal ouvert avec le bouton "Marquer payé" surligné](/wiki/mockups/cashflow-paid-step2.svg)

> [!STEP] 2. Cliquer la cellule pour ouvrir le modal
> Le modal affiche montant HT/TTC, statut actuel, date d'encaissement prévue. Trois boutons de statut au bas : PLANNED, INVOICED (l'actuel), et le gros bouton vert **✓ Marquer payé** à droite.

![Étape 3 — Cellule verte et solde compte impacté](/wiki/mockups/cashflow-paid-step3.svg)

> [!STEP] 3. Résultat immédiat
> Toast vert de confirmation. La cellule Mars passe en **vert PAID**. Le KPI **Solde compte** en haut du cashflow augmente instantanément de 16 637,50 € (le TTC, pas le HT — c'est ce que la banque encaisse vraiment).

![Étape 4 — La tranche remonte dans le panneau "Ce mois-ci"](/wiki/mockups/cashflow-paid-step4.svg)

> [!STEP] 4. Le journal du mois affiche l'encaissement
> Ta tranche fraîchement PAID apparaît en tête du panneau **"Ce mois-ci"** avec fond vert. Elle rejoint les autres encaissements du mois dans le journal. Le solde compte total en bas du panneau est mis à jour.

---

## Encaissement à date différente de la facturation

Si le client paye 30j fin de mois après la facture (règle standard), tu peux modifier la date de la cellule pour refléter la réalité :

- Facture émise le **15 mars** → date INVOICED = 15/03
- Encaissement réel prévu **fin avril** → change la date de la cellule à 30/04

Le cashflow re-calcule automatiquement les projections futures.

## Erreur classique : dé-marquer

Si tu marques PAID par erreur, ré-ouvre la cellule et clique **Repasser en PLANNED**. Le solde compte se recalcule (il diminue du TTC).

> [!TIP] Attention aux fins de mois
> Les tranches PAID rentrent dans le solde compte **à leur date de paiement**, pas à la date de facturation. C'est ce qui permet à la KPI Solde compte d'être une vraie photo de ta banque, pas une projection.

> [!WARN] Ne PAS marquer PAID par anticipation
> Si tu marques PAID avant que l'argent soit vraiment sur ton compte, ton solde compte devient faux. Attends le vrai virement (vérifiable sur le relevé bancaire ou le module Bank sync).
`
      },
      {
        slug: "entree-ponctuelle",
        title: "Ajouter et supprimer une entrée ponctuelle",
        description: "Subside, remboursement TVA, avance manuelle : cas pratique d'un OneOff.",
        estimatedMinutes: 4,
        content: `
Une **entrée ponctuelle** (OneOff) modélise un flux qui n'est ni une mission ni une dépense récurrente : subside régional, remboursement TVA, apport, achat de matériel spécifique…

## Créer une entrée

![Étape 1 — Menu Ajouter → Entrée ponctuelle](/wiki/mockups/cashflow-oneoff-step1.svg)

> [!STEP] 1. Bouton "+ Ajouter"
> Depuis la page cashflow, choisis "Entrée ponctuelle" dans la palette.

![Étape 2 — Modal avec catégorie, montant, date, récurrent + date fin](/wiki/mockups/cashflow-oneoff-step2.svg)

> [!STEP] 2. Remplir le formulaire
> Catégorie (autocomplete), montant, date, sens (recette ou dépense). Tu peux marquer comme récurrent avec date de fin — ex: une garantie qui court 6 mois.

![Étape 3 — Ligne créée avec cellules mensuelles auto-générées](/wiki/mockups/cashflow-oneoff-step3.svg)

> [!STEP] 3. Sauvegarder
> La ligne apparaît dans la grille et dans le panneau "Ce mois-ci" si le mois affiché est concerné.

![Étape 4 — Bouton corbeille dans Ce mois-ci pour supprimer](/wiki/mockups/cashflow-oneoff-step4.svg)

## Supprimer

Depuis le panneau **Ce mois-ci**, une petite corbeille rouge apparaît sur chaque entrée ponctuelle. Cliquer supprime immédiatement (avec confirmation).

> [!WARN] Suppression irréversible
> Si tu supprimes une récurrence marquée sur plusieurs mois, tous les mois disparaissent. Il n'y a pas de "restore".

## Note de frais et cashflow

Une note de frais approuvée crée automatiquement un OneOff dans la catégorie "Notes de frais" au dernier jour du mois de la dépense. Tu la vois dans la grille sans avoir à la saisir deux fois.
`
      }
    ]
  },
  {
    key: "missions",
    title: "Missions consultants",
    description: "Cycle de vie d'une mission : demande → présentation → contrat → suivi.",
    icon: "Briefcase",
    colorClass: "text-sky-600",
    requiredPermission: "missions.read",
    articles: [
      {
        slug: "cycle-vie",
        title: "Le cycle de vie d'une mission",
        description: "MissionRequest → Presentation → Offer → Mission → Facturation.",
        estimatedMinutes: 6,
        content: `
Une mission client passe par 4 phases distinctes dans DasoERP. Comprendre ce cycle évite les confusions.

![Étape 1 — Phase demande : MissionRequest en pipeline CRM](/wiki/mockups/mission-cycle-step1.svg)

## 1. MissionRequest — la demande

Une entreprise nous demande un consultant. On crée une **MissionRequest** avec les infos : compétences requises, TJM cible, durée, dates.

![Étape 2 — Phase présentation : Application dans le pipeline horizontal](/wiki/mockups/mission-cycle-step2.svg)

## 2. Application + Presentation

On crée une **Application** par consultant qu'on veut présenter (interne ou candidat vivier). L'application produit une **presentation** (PDF de CV + lettre de motivation) envoyée au client.

![Étape 3 — Phase offre chiffrée : MissionProposal](/wiki/mockups/mission-cycle-step3.svg)

## 3. Proposal (offre consultant)

Si le client demande une offre chiffrée, on crée un **MissionProposal** avec TJM vendu, taux, conditions. Statut évolue : DRAFT → OFFER_SENT → SELECTED (le consultant est retenu) → REJECTED.

![Étape 4 — Phase mission ACTIVE et facturation mensuelle](/wiki/mockups/mission-cycle-step4.svg)

## 4. Mission

Quand un proposal passe en SELECTED, une **Mission** est créée automatiquement. C'est le "vrai" contrat consultant. Statuts : PLANNED → ACTIVE → EXTENDED / COMPLETED.

## 5. Facturation

Depuis la Mission active, tu génères des **BillingMilestone** mensuelles (jours × TJM × TVA). Elles remontent dans le cashflow.

> [!TIP] Un consultant, une mission active
> Le planning refuse deux missions actives se chevauchant pour un même consultant. Prévois l'EXTENDED plutôt qu'une nouvelle Mission.
`
      },
      {
        slug: "presenter-consultant",
        title: "Présenter un consultant sur une demande",
        description: "Pipeline unifié : ajouter, préparer le CV, envoyer la présentation au client.",
        estimatedMinutes: 5,
        content: `
> [!STEP] 1. Ouvrir la demande de mission
> \`/mission-requests/[id]\` — tu vois le pipeline horizontal en haut : Nouveau · Shortlist · Présenté · Offert · Contrat.

![Étape 2 — Picker avec recherche interne/vivier](/wiki/mockups/mission-present-step2.svg)

> [!STEP] 2. Ajouter un consultant à la shortlist
> Bouton "+ Consultant" → recherche un candidat vivier ou un consultant interne. Ça crée une **Application**.

![Étape 3 — Édition CV : réordonner expériences + lettre de motivation](/wiki/mockups/mission-present-step3.svg)

> [!STEP] 3. Préparer la présentation
> Depuis la carte candidat, clique "Préparer présentation". Écran d'édition : ordre des expériences, mise en avant compétences, lettre de motivation optionnelle.

![Étape 4 — Aperçu PDF + bouton Présenté au client](/wiki/mockups/mission-present-step4.svg)

> [!STEP] 4. Aperçu + Envoi
> **Aperçu PDF** ouvre le rendu final dans un nouvel onglet. Une fois validé, "Présenté au client" fait passer l'application en PRESENTED.

![Étape 5 — SELECTED déclenche création auto de Mission](/wiki/mockups/mission-present-step5.svg)

> [!STEP] 5. Retour client
> Si retenu → passe en OFFER_SENT (avec proposal chiffrée). Si sélectionné final → SELECTED → Mission auto-créée.

> [!WARN] Consultant déjà en mission
> Si le consultant est déjà sur une mission active qui chevauche les dates, l'ERP alerte au moment du SELECTED. Tu peux forcer, mais ce sera visible dans le planning en rouge.
`
      },
      {
        slug: "facturation-mensuelle",
        title: "Facturer les jours prestés en fin de mois",
        description: "Depuis la Mission active, générer les tranches et déclencher le PDF de facture.",
        estimatedMinutes: 4,
        content: `
![Étape 1 — Fiche mission, section Facturation, bouton Générer](/wiki/mockups/mission-factu-step1.svg)

> [!STEP] 1. Récupérer les jours du mois
> Depuis \`/missions/[id]\`, section "Facturation" → bouton **Générer tranche du mois**. L'ERP lit les timesheets validés du consultant sur ce mois.

![Étape 2 — Modal avec jours auto-remplis + TVA + calcul TTC](/wiki/mockups/mission-factu-step2.svg)

> [!STEP] 2. Ajuster si besoin
> Modal ouvre avec les jours pré-remplis. Tu peux ajuster (déductions, congés client, jours fériés). TVA appliquée = celle du projet.

![Étape 3 — BillingMilestone PLANNED + snapshot du TJM + cashflow](/wiki/mockups/mission-factu-step3.svg)

> [!STEP] 3. Générer la tranche
> Statut initial = PLANNED, avec date d'encaissement = fin du mois + 30j (personnalisable dans les settings). Elle apparaît dans le cashflow.

![Étape 4 — Aperçu PDF facture + Marquer facturé](/wiki/mockups/mission-factu-step4.svg)

> [!STEP] 4. Émettre la facture
> **Aperçu PDF** puis "Marquer facturé" quand le PDF est envoyé au client. La tranche passe en INVOICED (bleu).

> [!STEP] 5. Encaissement
> Quand le paiement tombe, ouvre la cellule cashflow → **Marquer payé**. Le solde compte augmente.

> [!TIP] Multi-mois d'un coup
> Tu peux générer plusieurs mois d'avance si la mission est claire (long-terme, TJM fixe). Utile pour visualiser la trésorerie prévisionnelle.
`
      }
    ]
  },
  {
    key: "offers",
    title: "Offres et devis",
    description: "Composer une offre commerciale, la versionner, la faire signer.",
    icon: "FileText",
    colorClass: "text-violet-600",
    requiredPermission: "offers.read",
    articles: [
      {
        slug: "creer-offre",
        title: "Créer une offre depuis zéro",
        description: "Postes, TVA, contacts, marges — les briques essentielles d'un devis propre.",
        estimatedMinutes: 6,
        content: `
![Étape 1 — Sélection client (autocomplete) + contacts destinataires](/wiki/mockups/offer-creer-step1.svg)

> [!STEP] 1. Nouvelle offre
> \`/offers/new\` → sélectionne l'entreprise cliente (autocomplete). Choisis les contacts destinataires (plusieurs possibles).

![Étape 2 — Objet + TVA + date + validité](/wiki/mockups/offer-creer-step2.svg)

> [!STEP] 2. Header
> Objet, référence auto-générée (modifiable), date, validité (30 jours par défaut), **taux TVA** (21% par défaut, 6% pour formations, 12% pour restauration).

![Étape 3 — Ajouter postes avec drag & drop pour réordonner](/wiki/mockups/offer-creer-step3.svg)

> [!STEP] 3. Postes
> Ajoute des lignes : description, quantité, PU HT. Le total HT + TVA + TTC se calcule live. Tu peux réordonner par drag.

![Étape 4 — Totaux calculés + CGV en markdown](/wiki/mockups/offer-creer-step4.svg)

> [!STEP] 4. Conditions
> Zone markdown pour les CGV, délais, garanties. Le rendu PDF applique la charte Dasolabs.

![Étape 5 — Aperçu PDF + 3 boutons finaux (Aperçu, Brouillon, Envoyer)](/wiki/mockups/offer-creer-step5.svg)

> [!STEP] 5. Aperçu + Envoi
> **Aperçu PDF** dans un nouvel onglet. Une fois OK, clique "Envoyer" → statut passe en SENT. Ta trace commerciale est en place.

> [!INFO] Contacts dans le PDF
> Tous les contacts liés sont listés sur la première page. Utile quand plusieurs interlocuteurs suivent l'offre.
`
      },
      {
        slug: "versionner",
        title: "Créer une V2 après retour client",
        description: "Comment produire une nouvelle version sans dupliquer les options par erreur.",
        estimatedMinutes: 3,
        content: `
Le client revient avec des demandes de modif. On crée une V2 pour tracer.

![Étape 1 — Bouton Nouvelle version sur une V1 SENT](/wiki/mockups/offer-version-step1.svg)

> [!STEP] 1. Depuis la V1
> Bouton "Nouvelle version" en haut de la fiche offre. L'ERP duplique tous les postes, options, contacts, conditions.

![Étape 2 — V2 en DRAFT avec postes modifiés (rouge = changement)](/wiki/mockups/offer-version-step2.svg)

> [!STEP] 2. Modifier
> Ajuste les postes. Les modifs restent locales à la V2 — la V1 est figée pour l'historique.

![Étape 3 — V2 envoyée, V1 archivée dans l'historique masqué](/wiki/mockups/offer-version-step3.svg)

> [!STEP] 3. Envoyer la V2
> Statut SENT. La V1 reste dans l'historique mais n'apparaît plus dans la liste principale des offres en cours (filtre auto).

> [!WARN] Options en double
> Un bug historique dupliquait les options vers la V1 lors d'une création V2. Corrigé, mais si tu vois des doublons anciens → un admin peut cleanup en base.
`
      },
      {
        slug: "gagner",
        title: "Marquer une offre gagnée (WON)",
        description: "Le wizard Won → Project transforme l'offre en projet suivi.",
        estimatedMinutes: 4,
        content: `
Le client a signé. Il ne suffit pas de mettre le statut : on crée un projet pour le suivi.

> [!STEP] 1. Bouton "Gagné"
> Ouvre le wizard \`/offers/[id]/win\`.

![Étape 2 — Wizard : 3 tranches pré-remplies avec dates d'encaissement](/wiki/mockups/offer-won-step2.svg)

> [!STEP] 2. Configurer les tranches
> Le wizard propose de découper le montant en tranches de facturation : pré-remplies selon les jalons (30% début, 40% mi-projet, 30% fin) ou personnalisables.

![Étape 3 — Actions automatiques : Project créé + 3 tranches + KPI mis à jour](/wiki/mockups/offer-won-step3.svg)

> [!STEP] 3. Dates prévues
> Chaque tranche a une date prévue de facturation (défaut = fin du mois du jalon). Tu peux ajuster.

![Étape 4 — Différence Project (chantier) vs Mission (consultant TJM)](/wiki/mockups/offer-won-step4.svg)

> [!STEP] 4. Valider
> Le wizard crée le **Project**, copie le taux TVA de l'offre, et ajoute les tranches dans le cashflow. Tu es redirigé sur la fiche projet.

> [!TIP] Projet vs Mission
> Un **Project** est un chantier à durée finie avec livrables (dev, formation, audit). Une **Mission** est un consultant loué en TJM. Un projet peut inclure des missions.
`
      }
    ]
  },
  {
    key: "crm",
    title: "CRM et prospection",
    description: "Companies, contacts, pipeline d'opportunités, outbound.",
    icon: "Users",
    colorClass: "text-rose-600",
    requiredPermission: "crm.read",
    articles: [
      {
        slug: "pipeline",
        title: "Piloter le pipeline commercial",
        description: "Kanban : identifier les stades, déplacer les cartes, ne rien oublier.",
        estimatedMinutes: 5,
        content: `
Le CRM \`/crm\` affiche un **kanban horizontal** avec les stades commerciaux.

![Étape 1 — Les 5 stades du pipeline commercial](/wiki/mockups/crm-pipeline-step1.svg)

## Les stades

- **Nouveau** — la demande arrive
- **Qualif** — on a un premier échange, on comprend le besoin
- **Présenté / Devis** — on a envoyé quelque chose
- **Négo** — le client négocie
- **Gagné / Perdu** — décision prise

## Déplacer une carte

Drag-and-drop d'une carte vers un autre stade. L'ERP met à jour le champ \`crmStage\` sur la MissionRequest ou l'Offer sous-jacente.

> [!TIP] Cohérence stade / statut
> Le stade CRM est distinct du statut interne. Un stade "Négo" peut correspondre à une offre en statut SENT et à une MissionRequest en OFFER_SENT. Le kanban ne s'affole pas.

![Étape 3 — Cartes oranges : opportunités sans activité 14+ jours](/wiki/mockups/crm-pipeline-step3.svg)

## Filtres

Filtre par owner (mon pipeline vs celui de l'équipe), par stade, par période. Les cartes rouges = pas d'activité depuis 14+ jours.
`
      },
      {
        slug: "companies-contacts",
        title: "Créer une entreprise et ses contacts",
        description: "Structure Company ↔ Contact avec plusieurs entreprises par contact.",
        estimatedMinutes: 4,
        content: `
Un **Contact** peut être lié à **plusieurs entreprises** (table ContactCompany). Cas classique : le contact change de boîte mais tu veux garder la relation.

> [!STEP] 1. Créer l'entreprise
> \`/companies/new\` → nom, TVA, adresse, secteur, owner (toi par défaut).

![Étape 2 — Ajouter des contacts avec rôles (Décideur, Achats, Facturation)](/wiki/mockups/crm-cc-step2.svg)

> [!STEP] 2. Créer les contacts
> Depuis la fiche entreprise, section "Contacts" → "+ Ajouter". Tu peux marquer le rôle (Décideur, Technique, Achats) qui reste attaché **au lien** — donc si le contact bouge, tu recréé un lien avec un nouveau rôle.

![Étape 3 — Contact multi-entreprises : lier Bob à son ancienne boîte aussi](/wiki/mockups/crm-cc-step3.svg)

> [!STEP] 3. Historique d'interactions
> Section "Interactions" pour tracer appels, mails, meetings. Le CRM les indexe dans la timeline entreprise.

> [!TIP] Contact multi-entreprises
> Depuis un contact existant, "+ Ajouter à une autre entreprise" — utile pour un consultant externe qui bosse pour plusieurs de tes clients.
`
      },
      {
        slug: "outbound",
        title: "Prospection sortante : templates et relances",
        description: "OutreachInteraction + templates avec placeholders.",
        estimatedMinutes: 4,
        content: `
Le module Prospection \`/prospection\` gère les envois cold outbound et leurs relances.

## Templates

Un **OutreachTemplate** est un message pré-écrit avec des placeholders : \`{{prenom}}\`, \`{{entreprise}}\`, \`{{secteur}}\`. Au moment de l'envoi, l'ERP substitue automatiquement.

![Étape 2 — Choisir cible + canal + template avec aperçu personnalisé](/wiki/mockups/crm-outbound-step2.svg)

> [!STEP] 1. Créer une interaction
> Bouton "+ Interaction" → cible (contact + entreprise), canal (LinkedIn, email, appel), template optionnel.

![Étape 3 — Copy-paste vers LinkedIn (pas de connecteur auto)](/wiki/mockups/crm-outbound-step3.svg)

> [!STEP] 2. Envoyer
> L'ERP ne connecte pas encore ton client mail — pour l'instant, copy-paste du texte final vers ta boîte. Statut = SENT.

![Étape 4 — Programmer relance J+7 pour ne rien oublier](/wiki/mockups/crm-outbound-step4.svg)

> [!STEP] 3. Rappels de relance
> Marque la date de relance J+7. Le dashboard t'affichera cette carte le jour venu.

> [!INFO] À venir
> Digest email quotidien des relances du jour, en cours de dev.
`
      }
    ]
  },
  {
    key: "expenses",
    title: "Notes de frais",
    description: "Saisir, joindre le ticket, faire valider et générer le PDF pour le comptable.",
    icon: "Receipt",
    colorClass: "text-amber-600",
    requiredPermission: "expenses.read",
    articles: [
      {
        slug: "saisir",
        title: "Saisir une note de frais",
        description: "Champs obligatoires, TTC direct, participants pour les repas.",
        estimatedMinutes: 4,
        content: `
![Étape 1 — Form vide sur /expenses/new avec les champs obligatoires](/wiki/mockups/expense-saisir-step1.svg)

> [!STEP] 1. Nouvelle note
> \`/expenses/new\` — tous les champs sont **obligatoires** (date, catégorie, montant TTC, centre de coût, description).

![Étape 2 — Dropdown catégorie ouvert avec TVA appliquée](/wiki/mockups/expense-saisir-step2.svg)

> [!STEP] 2. Choisir la catégorie
> Repas / Hébergement / Déplacement / Fournitures / Autre. La TVA se déduit automatiquement du montant TTC selon le taux légal belge (Repas 12%, Hébergement 6%, autres 21%).

![Étape 3 — Montant TTC saisi et décomposition HT/TVA auto](/wiki/mockups/expense-saisir-step3.svg)

> [!STEP] 3. Montant TTC uniquement
> Tu saisis QUE le TTC (celui visible sur le ticket). La TVA se déduit automatiquement selon la catégorie choisie. Le HT s'affiche pour info.

![Étape 4 — Participants obligatoires pour un repas > 30€](/wiki/mockups/expense-saisir-step4.svg)

> [!STEP] 4. Repas → participants
> Si catégorie Repas et montant > 30€, un champ "Participants" s'affiche et est **obligatoire**. Liste-les (interne + client). Ils apparaîtront dans le PDF envoyé au comptable.

![Étape 5 — Upload justificatif et boutons Aperçu / Soumettre](/wiki/mockups/expense-saisir-step5.svg)

> [!STEP] 5. Justificatif + Aperçu + Soumission
> Upload le PDF ou l'image du ticket (**obligatoire**). Bouton **Aperçu PDF** montre le rendu tel qu'il partira au comptable. Une fois OK, **Soumettre** → statut passe en SUBMITTED.

> [!WARN] Brouillon = pas soumis
> Une note reste éditable tant qu'elle est en brouillon. Une fois soumise, seul un manager peut la modifier ou la refuser.
`
      },
      {
        slug: "approuver",
        title: "Approuver une note (manager)",
        description: "Vérifications, refus motivé, comptabilisation dans le cashflow.",
        estimatedMinutes: 3,
        content: `
Un manager voit les notes SUBMITTED dans son dashboard RH.

![Étape 1 — Vue manager avec les notes SUBMITTED en bordure orange](/wiki/mockups/expense-approuver-step1.svg)

> [!STEP] 1. Ouvrir la note
> Depuis \`/expenses?filter=to-approve\` ou la carte du dashboard. Les SUBMITTED apparaissent avec bordure orange.

![Étape 2 — Checklist en 30 secondes avant d'approuver](/wiki/mockups/expense-approuver-step2.svg)

> [!STEP] 2. Vérifier
> Justificatif présent ? Catégorie cohérente ? Participants OK pour les repas > 30€ ? Centre de coût sensé ? 4 vérifs, 30 secondes.

![Étape 3 — Note approuvée et effets automatiques](/wiki/mockups/expense-approuver-step3.svg)

> [!STEP] 3. Approuver = 3 actions automatiques
> Bouton **Approuver**. La note passe en APPROVED, l'ERP crée automatiquement une entrée OneOff cashflow catégorie "Notes de frais" au dernier jour du mois de la dépense, et Alice reçoit une notif "Approuvée, remboursement au prochain payroll".

> [!STEP] 4. Refuser (alternative)
> Bouton **Refuser** avec motif obligatoire. Le consultant reçoit la raison et peut resoumettre.

> [!TIP] Batch d'approbation
> Filtre par consultant / mois pour approuver toutes ses notes d'un coup, en un après-midi mensuel.
`
      },
      {
        slug: "export-comptable",
        title: "Exporter les notes vers le comptable",
        description: "PDF récapitulatif mensuel avec tous les justificatifs.",
        estimatedMinutes: 3,
        content: `
Chaque fin de mois, tu envoies un batch au comptable.

![Étape 1 — Filtres APPROVED + mois pour récupérer le batch mensuel](/wiki/mockups/expense-export-step1.svg)

> [!STEP] 1. Filtrer
> \`/expenses?filter=approved&month=2026-07\` — toutes les notes approuvées du mois. Le compteur en bas affiche total TTC + TVA récupérable.

![Étape 2 — Bouton Export PDF et détail du contenu généré](/wiki/mockups/expense-export-step2.svg)

> [!STEP] 2. Export PDF
> Bouton **Export PDF** en tête de liste → génère un document avec table synthétique + ventilation TVA + comptes comptables suggérés, suivi de tous les justificatifs concaténés.

![Étape 3 — Template de mail à envoyer au comptable](/wiki/mockups/expense-export-step3.svg)

> [!STEP] 3. Envoi
> Attache le PDF à un mail au comptable. L'ERP ne l'envoie pas automatiquement (pas encore de connecteur mail sortant). Utilise le template fourni.

> [!INFO] Journal comptable
> Le PDF inclut la ventilation TVA (récupérable / non-récupérable) et le compte comptable suggéré par catégorie. Le comptable n'a plus qu'à saisir.
`
      }
    ]
  },
  {
    key: "leaves",
    title: "Congés",
    description: "Solde, demande, workflow d'approbation, rollover annuel.",
    icon: "Plane",
    colorClass: "text-orange-600",
    requiredPermission: "leaves.read",
    articles: [
      {
        slug: "demander",
        title: "Demander un congé",
        description: "Depuis /me, choix du type, dates, cas mission client.",
        estimatedMinutes: 4,
        content: `
Le parcours d'une demande de congé, du solde initial jusqu'à la soumission au manager.

![Étape 1 — Arrivée sur /me onglet RH avec le solde 2026](/wiki/mockups/leave-request-step1.svg)

> [!STEP] 1. Ouvrir /me → onglet RH
> Section "Congés" affiche ton solde en 4 cartes : Légaux · RTT · Année précédente · Total. Clique le bouton **+ Nouvelle demande** en haut à droite.

![Étape 2 — Formulaire vide déployé, champs à compléter](/wiki/mockups/leave-request-step2.svg)

> [!STEP] 2. Le formulaire s'ouvre
> Trois champs obligatoires : dates de début et fin, type. Le motif est optionnel — utile pour un cas particulier (déménagement, événement familial).

![Étape 3 — Dates remplies, jours calculés auto, type déroulé](/wiki/mockups/leave-request-step3.svg)

> [!STEP] 3. Remplir dates et type
> Le champ "jours ouvrés" se calcule automatiquement (lundi-vendredi entre les 2 dates). Choisis le type dans la liste :
> - **Légaux** — décompte du bucket ANNUAL_LEGAL (20j par défaut)
> - **RTT** — décompte du bucket RTT (12j par défaut)
> - **Année précédente** — utilise ton reliquat N-1
> - **Sans solde** / **Spécial** — pas de décompte, statut informatif

![Étape 4 — Case client cochée pour consultant en mission](/wiki/mockups/leave-request-step4.svg)

> [!STEP] 4. Cas spécial : tu es en mission client
> Si tu es actuellement affecté à une mission active, une section jaune apparaît avec **"Demandé chez le client et accordé"** à cocher. Ne coche que si le PM du client t'a explicitement dit oui — le manager RH utilisera cette info pour décider. Si tu triches, ça se saura et ta demande sera refusée avec motif.

![Étape 5 — Toast succès et demande en attente dans le tableau](/wiki/mockups/leave-request-step5.svg)

> [!STEP] 5. Soumettre
> Toast vert de confirmation, la ligne apparaît en tête de ton tableau avec le badge **SUBMITTED** (orange). La demande arrive dans \`/leaves?filter=pending\` du manager qui recevra une notif.

---

> [!TIP] Demi-journée
> Le champ "jours" accepte des décimales : **0.5** pour une demi-journée. Ajuste manuellement après le calcul auto.

> [!WARN] Ne triche pas sur la case client
> Cocher "client OK" alors que tu n'as pas eu l'accord = raison n°1 de refus des demandes. Le manager peut vérifier avec le PM en 2 messages.
`
      },
      {
        slug: "approuver",
        title: "Approuver ou refuser (manager)",
        description: "Vue centralisée + boutons Approuver / Refuser motivé / Supprimer.",
        estimatedMinutes: 3,
        content: `
![Étape 1 — Vue /leaves?filter=pending avec bordure orange](/wiki/mockups/leaves-approve-step1.svg)

> [!STEP] 1. Voir les demandes en attente
> \`/leaves?filter=pending\` — nombre de jours + statut client (si case cochée).

![Étape 2 — Approuver ✓ : 4 actions automatiques](/wiki/mockups/leaves-approve-step2.svg)

> [!STEP] 2. Approuver
> Bouton ✓ vert. La demande passe en APPROVED, le solde du consultant est décrémenté, et l'entrée apparaît en orange dans le planning.

![Étape 3 — Refuser ✗ avec motif obligatoire](/wiki/mockups/leaves-approve-step3.svg)

> [!STEP] 3. Refuser
> Bouton ✗ rouge avec motif obligatoire. Le consultant peut refaire une demande.

![Étape 4 — Supprimer un congé validé restaure le solde](/wiki/mockups/leaves-approve-step4.svg)

> [!STEP] 4. Supprimer (même une demande validée)
> L'icône corbeille est visible sur toutes les lignes pour un manager. Sur une APPROVED, elle **restaure automatiquement les jours** dans le compteur du consultant — utile quand un congé est annulé après coup.

> [!WARN] Traçabilité
> L'auteur ne peut plus supprimer sa propre demande une fois validée. Il doit passer par un manager. Toutes les suppressions sont loguées.
`
      },
      {
        slug: "rollover",
        title: "Nouvelle année : rollover des soldes",
        description: "Bouton unique pour créer les quotas N+1 et reporter le reliquat.",
        estimatedMinutes: 4,
        content: `
En fin d'année, chaque consultant a un reliquat non-consommé. On veut :
1. Créer les quotas N+1 (20j légaux + 12j RTT par défaut, personnalisables par user)
2. Reporter le reliquat en tant qu'"année précédente"

> [!STEP] 1. Onglet Soldes
> \`/leaves?filter=balances\` — accessible aux managers RH uniquement.

> [!STEP] 2. Rollover un user
> Bouton "Ajouter congés N+1" à côté de chaque consultant. Idempotent — si déjà fait, ça refuse.

![Étape 2 — Bouton Ajouter congés N+1 (tous)](/wiki/mockups/leaves-rollover-step2.svg)

> [!STEP] 3. Rollover global
> Bouton "Ajouter congés N+1 (tous)" en tête de tableau. Boucle sur tous les consultants actifs.

![Étape 3 — Après rollover : nouveaux quotas N+1 + reliquat](/wiki/mockups/leaves-rollover-step3.svg)

> [!INFO] Calcul du reliquat
> Reliquat = (Légaux N + RTT N + Report N-1) − consommé APPROVED. Tout est reporté en type CARRIED_OVER pour N+1.

> [!WARN] Modifier les quotas par user
> Un consultant peut avoir plus de 20 légaux (accord contractuel) ou moins de RTT. Édite les champs \`annualLeaveDays\` et \`rttDays\` sur la fiche \`/users/[id]\`.
`
      }
    ]
  },
  {
    key: "planning",
    title: "Planning",
    description: "Grille mensuelle par consultant × jour, avec congés et maladies intégrés.",
    icon: "Calendar",
    colorClass: "text-teal-600",
    requiredPermission: "planning.read",
    articles: [
      {
        slug: "affecter",
        title: "Affecter un consultant à un projet",
        description: "Drag-select sur les jours, choix du projet ou centre de coût.",
        estimatedMinutes: 4,
        content: `
![Étape 1 — Drag-select horizontal sur les jours](/wiki/mockups/planning-affecter-step1.svg)

> [!STEP] 1. Sélectionner une plage de jours
> Sur la ligne du consultant, clique-drag du 1er au dernier jour à couvrir.

![Étape 2 — Modal projet vs centre de coût + charge %](/wiki/mockups/planning-affecter-step2.svg)

> [!STEP] 2. Modal d'affectation
> S'ouvre automatiquement. Choisis **Projet** (client) ou **Centre de coût** (interne : R&D, formation, admin).

> [!STEP] 3. Charge et heures
> Charge % (par défaut 100) et heures/jour (défaut = capacité hebdo / 5). Le rendu du planning est plein / demi selon la charge.

![Étape 3 — Plage colorée par palette projet](/wiki/mockups/planning-affecter-step3.svg)

> [!STEP] 4. Sauver
> Une plage colorée apparaît. Chaque projet a sa couleur (hash déterministe).

![Étape 4 — Supprimer via tableau Affectations en cours](/wiki/mockups/planning-affecter-step4.svg)

## Supprimer une affectation

Depuis le tableau "Affectations en cours" sous la grille, icône X à droite de la ligne.
`
      },
      {
        slug: "couleurs",
        title: "Comprendre les couleurs du planning",
        description: "Projet, interne, congé demandé, congé validé, maladie : lecture rapide.",
        estimatedMinutes: 3,
        content: `
![Le planning avec les 5 palettes distinctes : projet, interne, congé, maladie](/wiki/mockups/planning-colors.svg)

Le planning distingue **5 contextes** par palette :

- **Projet client** — palette colorée par projet (indigo/sky/teal/…). Hash déterministe sur l'id projet.
- **Interne (centre de coût)** — violet doux uniforme.
- **Congé demandé** (SUBMITTED) — jaune avec rayures diagonales. Signale une demande en attente d'approbation.
- **Congé validé** (APPROVED) — orange plein.
- **Maladie** — rouge.

> [!INFO] Priorité affichage
> Un jour de congé ou maladie **masque** l'affectation projet éventuelle. C'est voulu : si quelqu'un est en congé, il n'est pas sur le projet ce jour-là.

> [!TIP] Gérer un congé
> Depuis le planning, on ne modifie pas les congés. Clique sur "gérer sur /leaves" à droite de la ligne pour aller sur le module dédié.
`
      },
      {
        slug: "charge",
        title: "Suivre la charge d'un consultant",
        description: "Colonne « Charge planifiée semaine en cours » sur la fiche user.",
        estimatedMinutes: 2,
        content: `
Depuis \`/users/[id]\`, le header affiche :

> **Charge planifiée semaine en cours : 32h / 38h**

Le calcul agrège les PlanningEntry chevauchant la semaine, pondérés par la charge %.

![Étape 2 — Sur-affectation : signal visuel sans blocage](/wiki/mockups/planning-charge-step2.svg)

> [!TIP] Sur-affectation
> Si tu affectes 100% projet A + 100% projet B sur le même jour, la charge affichera 200% — les cellules restent visibles pour te rappeler qu'il y a conflit.
`
      }
    ]
  },
  {
    key: "consultants",
    title: "Consultants et candidats",
    description: "CV, compétences, expériences, tests, entretiens.",
    icon: "UserCircle",
    colorClass: "text-indigoaccent",
    requiredPermission: "candidates.read",
    articles: [
      {
        slug: "cv-consultant",
        title: "Maintenir son CV consultant",
        description: "Depuis /me, expériences, compétences, taux journalier.",
        estimatedMinutes: 4,
        content: `
![Étape 1 — Onglet CV depuis /me](/wiki/mockups/consultant-cv-step1.svg)

> [!STEP] 1. /me → onglet CV
> Le CV consultant est structuré : expériences pro, compétences (tags), langues, taux journalier vendu.

![Étape 2 — Formulaire ajout expérience pro](/wiki/mockups/consultant-cv-step2.svg)

> [!STEP] 2. Ajouter une expérience
> Entreprise, poste, dates (fin optionnelle si en cours), description en markdown. Les expériences sont triées par date de début décroissante.

![Étape 3 — Autocomplete compétences avec création à la volée](/wiki/mockups/consultant-cv-step3.svg)

> [!STEP] 3. Compétences
> Autocomplete avec le catalogue. Si la compétence n'existe pas, on la crée à la volée avec casse préservée.

> [!STEP] 4. Taux journalier
> \`dailyRate\` = taux vendu au client HTVA. Distinct de \`dailyCost\` (coût interne, visible admin only). Le CV PDF affiche uniquement le taux vendu.

## Générer le CV PDF

Bouton **Aperçu CV** dans le header — ouvre le rendu final dans un nouvel onglet, à la charte Dasolabs.
`
      },
      {
        slug: "tests",
        title: "Faire passer un test technique",
        description: "Assigner un test, générer un lien token, suivre les résultats.",
        estimatedMinutes: 5,
        content: `
Les tests \`/tests\` évaluent : ELEC, PLC, Data Manager, IT.

> [!STEP] 1. Créer une assignation
> \`/tests\` → "+ Assigner" → choisis le test + candidat (ou consultant interne).

![Étape 2 — Lien avec token à copier et envoyer](/wiki/mockups/consultant-tests-step2.svg)

> [!STEP] 2. Envoyer le lien
> L'ERP génère un lien avec **token** unique. Copie-le et envoie-le au candidat. Le lien reste valide jusqu'à ce qu'il passe le test.

![Étape 3 — Vue candidat : timer + questions au démarrage](/wiki/mockups/consultant-tests-step3.svg)

> [!STEP] 3. Le candidat passe le test
> Interface anonyme (pas de login requis), timer, snapshot des questions au démarrage (si l'admin modifie les questions ensuite, la submission garde les originales).

> [!STEP] 4. Consulter les résultats
> Depuis la fiche candidat ou \`/tests/submissions/[id]\` : score, réponses détaillées, mise en évidence des erreurs.

> [!TIP] Test libre
> Tu peux créer un test personnalisé (dev, business analyst, …) avec tes propres questions. Format QCM / QCU / réponse libre.
`
      },
      {
        slug: "import-linkedin",
        title: "Importer un candidat depuis LinkedIn",
        description: "Copier-coller du profil LinkedIn → parsing automatique via Claude Haiku.",
        estimatedMinutes: 3,
        content: `
![Étape 1 — Déplier tout sur LinkedIn avant de copier](/wiki/mockups/consultant-linkedin-step1.svg)

> [!STEP] 1. Ouvrir le profil LinkedIn
> Va sur linkedin.com/in/... du candidat. Assure-toi que le profil est déplié (About, Experience, Education).

> [!STEP] 2. Copier tout le contenu de la page
> Cmd+A puis Cmd+C — pas grave si tu copies la nav LinkedIn, le prompt ignore.

> [!STEP] 3. Coller dans l'ERP
> \`/candidates/new\` → onglet "Depuis LinkedIn" → grosse textarea. Colle et clique **Parser**.

![Étape 3 — Résultat parsé automatiquement à vérifier](/wiki/mockups/consultant-linkedin-step3.svg)

> [!STEP] 4. Vérifier le résultat
> Claude Haiku extrait prénom, nom, poste actuel, expériences, langues. Affichés dans un form pré-rempli — corrige ce qui ne va pas.

> [!STEP] 5. Sauvegarder
> Le candidat est créé avec ses expériences en une seule fois.

![Étape 4 — Compléter les compétences manuellement](/wiki/mockups/consultant-linkedin-step4.svg)

> [!WARN] Compétences non extraites
> Le prompt LinkedIn ne parse pas la section Skills (peu fiable). Ajoute-les à la main sur la fiche.
`
      }
    ]
  },
  {
    key: "users",
    title: "Utilisateurs et permissions",
    description: "Créer un user, groupes d'accès, réinitialiser un mot de passe.",
    icon: "Shield",
    colorClass: "text-red-600",
    requiredPermission: "users.manage",
    articles: [
      {
        slug: "creer-user",
        title: "Créer un utilisateur",
        description: "Info générale, permissions par groupe, mot de passe initial.",
        estimatedMinutes: 4,
        content: `
![Étape 1 — Nom, email et rôle](/wiki/mockups/user-creer-step1.svg)

> [!STEP] 1. /users/new
> Nom, email (unique), rôle par défaut (CONSULTANT, MANAGER, ADMIN, FINANCE, COMMERCIAL).

![Étape 2 — Photo, téléphone, séniorité, langues](/wiki/mockups/user-creer-step2.svg)

> [!STEP] 2. Attributs consultant
> Photo (base64, max 1 Mo), téléphone, ville, séniorité, années d'expérience, langues.

![Étape 3 — Coûts internes confidentiels (marge visible)](/wiki/mockups/user-creer-step3.svg)

> [!STEP] 3. Coûts internes
> hourlyCost, dailyCost, dailyRate (visible admin uniquement). weeklyCapacityH = capacité par semaine (38 par défaut).

![Étape 4 — Quotas Légaux + RTT personnalisables](/wiki/mockups/user-creer-step4.svg)

> [!STEP] 4. Quotas congés
> annualLeaveDays (20 par défaut légal belge), rttDays (12 par défaut). Personnalisables.

![Étape 5 — Mot de passe initial + groupes d'accès](/wiki/mockups/user-creer-step5.svg)

> [!STEP] 5. Mot de passe initial
> Minimum 8 caractères, obligatoire à la création. L'utilisateur devra probablement le changer à sa première connexion.

> [!STEP] 6. Groupes d'accès
> Après création, ajoute-le à un ou plusieurs AccessGroup. C'est ce qui détermine ses permissions (menu, actions).

## Rôle vs Groupes

Le **rôle** est un label. Les **permissions réelles** viennent des groupes. Un CONSULTANT dans le groupe "Finance" a accès au module Finance.
`
      },
      {
        slug: "reset-password",
        title: "Réinitialiser un mot de passe",
        description: "Bouton dédié isolé du form général, robuste aux migrations en retard.",
        estimatedMinutes: 2,
        content: `
![Le bouton isolé de reset password et son mini-form déployé](/wiki/mockups/user-reset-password.svg)

> [!STEP] 1. Aller sur /users/[id]
> En haut de la fiche user, bouton **Réinitialiser le mot de passe** (visible admin uniquement).

> [!STEP] 2. Nouveau mot de passe
> Formulaire mini avec double confirmation. Minimum 8 caractères, sinon erreur explicite.

> [!STEP] 3. Sauver
> Un seul champ est mis à jour (\`passwordHash\`), rien d'autre. Le bouton est **isolé** du form général pour rester fonctionnel même si une colonne DB est en retard sur le schéma Prisma.

> [!INFO] Traçabilité
> Chaque reset log une entrée ActivityLog visible dans \`/audit\`. On peut voir qui a réinitialisé quoi et quand.

> [!TIP] Communiquer le nouveau mot de passe
> L'ERP n'envoie pas de mail. Communique-le sur un canal sécurisé (Signal, en face à face) et demande à l'utilisateur de le changer à sa première connexion.
`
      },
      {
        slug: "groupes-permissions",
        title: "Créer un groupe d'accès",
        description: "Sélectionner les permissions par sidebar, ajouter des users.",
        estimatedMinutes: 4,
        content: `
Les permissions dans DasoERP sont regroupées par **menu / module**. Un groupe = un ensemble de permissions.

![Étape 1 — Créer un nouveau groupe d'accès](/wiki/mockups/user-groupes-step1.svg)

> [!STEP] 1. /access/groups → "+ Nouveau groupe"
> Nom (ex: "Manager RH"), description.

> [!STEP] 2. Cocher les permissions
> L'écran affiche les permissions groupées par entrée sidebar (Pilotage, Commercial, RH, …). Coche ce que ce groupe peut faire : \`leaves.read\`, \`leaves.approve\`, \`expenses.approve\`, etc.

> [!STEP] 3. Sauver
> Le groupe est créé. Il apparaît dans la liste.

![Étape 3 — Ajouter des utilisateurs au groupe](/wiki/mockups/user-groupes-step3.svg)

> [!STEP] 4. Ajouter des users
> Sur la fiche user, section "Groupes d'accès" → tick les groupes concernés.

> [!TIP] Perms effectives = groupe ∪ overrides
> Un user peut avoir des overrides individuels (perms en plus / en moins) via \`getUserEffectivePermissions\`. C'est utile pour un cas exceptionnel sans créer un groupe dédié.

> [!WARN] Ordre des vérifs
> Chaque page fait \`requirePermission("xxx.read")\` en top. Si un user n'a pas la perm, il est redirigé sur \`/dashboard\`. Le wiki formation applique le même contrat.
`
      }
    ]
  },
  {
    key: "meta",
    title: "Maintenir le wiki",
    description: "Comment garder cette documentation à jour à chaque évolution de l'ERP.",
    icon: "BookOpenCheck",
    colorClass: "text-midnight-600",
    requiredPermission: "users.manage",
    articles: [
      {
        slug: "when-to-update",
        title: "Quand modifier le wiki",
        description: "Règle simple : chaque changement visible pour l'utilisateur doit passer par le wiki.",
        estimatedMinutes: 3,
        content: `
Le wiki n'est utile que si tu peux **faire confiance** à ce qu'il raconte. Un article obsolète cause plus de tort qu'un article manquant : il pousse un consultant à faire une manip qui ne marche plus.

![Étape 1 — La règle : visible utilisateur = update du wiki](/wiki/mockups/meta-when-step1.svg)

## La règle

À chaque merge d'une modification visible côté utilisateur (nouveau champ, nouvelle page, changement de workflow, ajout de bouton), **tu passes en revue les articles wiki de la thématique concernée** et tu :

- Édites l'article pour refléter la nouvelle réalité (icône **Modifier**)
- Ajoutes une nouvelle capture d'écran si l'UI a changé (bouton **Image** dans l'éditeur)
- Cliques **Marquer vérifié** pour remettre à zéro le compteur "à revoir"

> [!WARN] Ce qui compte comme "visible utilisateur"
> Nouveau champ dans un form, changement de wording, ajout/suppression de bouton, réorganisation de menu, nouveau statut d'un workflow, changement de règle métier (ex: quotas, seuils). **Un refactor interne** qui ne change rien à l'UI ne demande pas de mise à jour wiki.

![Étape 2 — Badge de fraîcheur : vert vs orange](/wiki/mockups/meta-when-step2.svg)

## Le badge "à revoir"

Chaque article affiche un badge :

- **Vert "Vérifié il y a Xj"** — la doc est confirmée à jour
- **Orange "À revoir (Xj sans vérif)"** — plus de 90 jours sans vérification, considère-la douteuse
- **Orange "Jamais vérifié"** — article créé mais jamais confirmé

Le badge ne change **rien fonctionnellement** — c'est un rappel visuel pour les lecteurs.

## Cadence recommandée

- **Après chaque feature merge** : les 1-3 articles impactés
- **1 fois par trimestre** : passer sur les articles orange "À revoir" que personne n'a touchés

> [!TIP] Pas d'excuse pour ne pas mettre à jour
> Modifier un article prend < 2 minutes. L'éditeur est en ligne, split view avec preview, sauvegarde en 1 clic. Aucun redeploy nécessaire.
`
      },
      {
        slug: "how-to-screenshot",
        title: "Capturer et insérer une capture d'écran",
        description: "Bonnes pratiques : cadrage, résolution, insertion depuis l'éditeur.",
        estimatedMinutes: 4,
        content: `
Une bonne capture vaut 200 mots — mais une mauvaise capture désoriente.

![Étape 1 — Checklist des bonnes pratiques capture](/wiki/mockups/meta-screenshot-step1.svg)

## Capturer proprement

> [!STEP] 1. Ferme les distractions
> Ferme les onglets inutiles, les notifs, les fenêtres qui se superposent. Le lecteur doit voir uniquement ce dont l'article parle.

> [!STEP] 2. Cadre uniquement la zone utile
> Sur macOS : **Cmd + Maj + 4** puis espace pour capturer une fenêtre entière, ou drag pour sélectionner. Sur Windows : **Win + Maj + S**. Coupe la sidebar de l'ERP si l'article ne parle pas du menu.

> [!STEP] 3. Résolution modérée
> Vise ~1200-1600 px de large. Trop grand alourdit inutilement, trop petit rend illisible sur écran retina. Le rendu wiki adapte automatiquement à la largeur.

> [!STEP] 4. Anonymise les données sensibles
> Floute noms de clients réels, montants confidentiels, données personnelles. Un consultant en formation n'a pas besoin de voir "Client X — 45 000€ facturés".

![Étape 2 — Bouton Image dans la toolbar de l'éditeur](/wiki/mockups/meta-screenshot-step2.svg)

## Insérer dans un article

> [!STEP] 1. Ouvre l'article en édition
> Bouton **Modifier** en haut à droite de l'article.

> [!STEP] 2. Positionne le curseur
> Clique dans le markdown à l'endroit exact où tu veux l'image (généralement après un paragraphe qui décrit ce qu'on va voir).

> [!STEP] 3. Bouton Image
> Barre d'outils du haut → **Image**. Sélectionne ton PNG/JPEG.

> [!STEP] 4. L'ERP insère automatiquement la syntaxe
> \`![nom-fichier](/api/wiki-images/xxxxx)\` apparaît à ton curseur. Change \`nom-fichier\` en une **description courte** — elle deviendra la légende sous l'image et le texte alt (accessibilité).

> [!STEP] 5. Sauvegarde
> Bouton **Sauvegarder** en haut. Les autres utilisateurs voient la nouvelle image immédiatement.

![Étape 3 — Rendu final : figure + légende](/wiki/mockups/meta-screenshot-step3.svg)

## Format et poids

- **PNG** pour les captures d'UI (texte net, pas de compression bavante)
- **JPEG** pour les photos ou schémas avec dégradés
- **GIF/WebP animés** pour illustrer une interaction (drag, survol) — mais reste sobre, ça alourdit la page

Limite : **5 Mo par image**. Si ta capture pèse plus, redimensionne ou compresse (macOS : Preview → Export → Reduce File Size).

> [!TIP] Suppression d'images
> Pour l'instant, les images uploadées restent en base même si tu retires la syntaxe markdown. Pas de garbage collector automatique. Si ça devient un problème, on ajoutera une purge.
`
      },
      {
        slug: "process-checklist",
        title: "Checklist post-feature",
        description: "La liste de vérifications à faire après avoir mergé une feature.",
        estimatedMinutes: 3,
        content: `
Après avoir livré une feature qui touche à l'expérience utilisateur, avant de fermer ta PR/ticket, passe cette checklist :

![Étape 1 — 4 vérifications avant de fermer ta PR](/wiki/mockups/meta-checklist-step1.svg)

## Le rituel de 5 minutes

- **[ ]** Le module modifié a-t-il un article wiki ? Si non, en créer un via le seed (ou demander à l'admin de le faire depuis l'UI).
- **[ ]** Les captures d'écran de l'article correspondent-elles encore à l'UI actuelle ? Sinon, en refaire.
- **[ ]** Un nouveau bouton / champ / workflow ? Ajouter une étape numérotée dans l'article correspondant.
- **[ ]** Un ancien élément supprimé ? Retirer la mention dans le wiki.
- **[ ]** Cliquer **Marquer vérifié** sur chaque article touché.

![Étape 2 — Nouveau vs modifier — décision](/wiki/mockups/meta-checklist-step2.svg)

## Nouvel article = quand ?

Crée un nouvel article quand :

- Tu introduis un **nouveau flux** qui n'existait pas (ex: nouveau workflow de validation)
- Tu ajoutes un **nouvel écran** avec sa propre logique
- Un cas d'usage récurrent te fait dire "tiens, il faudrait documenter ça"

Modifie un article existant quand :

- Tu ajoutes un champ, un bouton, un onglet à quelque chose qui existe déjà
- Tu changes le wording d'un statut, d'un label
- Tu ajustes une règle métier (ex: TVA, plafond, seuil)

## Qui édite quoi

- **Admin** (perm \`users.manage\`) : peut éditer n'importe quel article et upload d'images.
- **Consultant lambda** : lit uniquement. Pas de bouton Modifier visible.

![Étape 3 — Retour utilisateur = signal + refonte majeure](/wiki/mockups/meta-checklist-step3.svg)

> [!TIP] Retour utilisateur
> Si un consultant te dit "j'ai suivi la doc mais ça marche pas", **c'est un signal** — l'article est probablement obsolète. Corrige-le immédiatement, ça évitera la même confusion à 10 autres personnes.

## En cas de refonte majeure

Si tu refais complètement un module (ex: refonte du cashflow), il vaut mieux :

1. Créer les nouveaux articles à partir de zéro dans le seed (avec captures fraîches)
2. Archiver les anciens en dépubliant (nullifier \`publishedAt\` — accessible côté DB)

Plutôt que de tenter une édition incrémentale d'un article devenu incompréhensible.
`
      }
    ]
  }
  ,
  {
    key: "timesheet",
    title: "Timesheet",
    description: "Saisir tes heures, soumettre, validation manager.",
    icon: "Clock",
    colorClass: "text-teal-600",
    requiredPermission: "timesheet.read",
    articles: [
      {
        slug: "utiliser",
        title: "Saisir et faire valider ton timesheet",
        description: "Cycle DRAFT → SUBMITTED → APPROVED en 3 étapes.",
        estimatedMinutes: 4,
        content: `
Ton timesheet hebdomadaire alimente la facturation client et ta paie. Rituel du vendredi.

![Étape 1 — Grille semaine × projets/missions](/wiki/mockups/timesheet-step1.svg)

> [!STEP] 1. Saisir la semaine
> \`/timesheet\` → grille par jour + projet/mission. Tab entre les cellules. Total automatique en pied de colonne.

![Étape 2 — Workflow validation DRAFT → SUBMITTED → APPROVED](/wiki/mockups/timesheet-step2.svg)

> [!STEP] 2. Soumettre le vendredi
> Bouton **Soumettre** en haut → statut passe en SUBMITTED. Ton manager reçoit une notif.

![Étape 3 — Vue manager /timesheet/validation](/wiki/mockups/timesheet-step3.svg)

> [!STEP] 3. Le manager valide (ou refuse motivé)
> Un timesheet APPROVED est utilisable pour la facturation mensuelle mission. REJECTED = tu corriges.

> [!WARN] Timesheet en retard = blocage
> Sans validation, la tranche mensuelle mission ne peut pas être générée. Le comptable ne peut pas envoyer la facture. Bref, tout se cascade.
`
      }
    ]
  },
  {
    key: "finance",
    title: "Facturation & TVA",
    description: "Vue synthétique factures trimestrielles + déclaration TVA.",
    icon: "Landmark",
    colorClass: "text-emerald-700",
    requiredPermission: "finance.read",
    articles: [
      {
        slug: "declaration-tva",
        title: "Préparer la déclaration TVA trimestrielle",
        description: "Récap collectée/déductible + export PDF au comptable.",
        estimatedMinutes: 5,
        content: `
La TVA se déclare tous les trimestres en Belgique. Deadline : le 20 du mois suivant.

![Étape 1 — Vue synthèse du trimestre en cours](/wiki/mockups/finance-step1.svg)

> [!STEP] 1. Vue synthèse
> \`/finance\` → cartes TVA collectée / déductible / à payer. Un seul écran te dit tout.

![Étape 2 — Détail des 12 factures émises ce trimestre](/wiki/mockups/finance-step2.svg)

> [!STEP] 2. Détail des factures émises
> Tableau ligne par ligne avec ventilation par taux TVA. Sers de contrôle avant envoi comptable.

![Étape 3 — Export PDF déclaration + envoi comptable](/wiki/mockups/finance-step3.svg)

> [!STEP] 3. Export et envoi
> Bouton **Export PDF trimestriel** → attache au mail comptable → programme le virement pour le 20 du mois suivant.

> [!WARN] Deadline stricte
> Retard = amende + intérêts. Rituel : dernière semaine du trimestre, export et transmission.
`
      }
    ]
  },
  {
    key: "supplier-invoices",
    title: "Factures fournisseurs",
    description: "Drop PDF, OCR auto, workflow paiement.",
    icon: "FileScan",
    colorClass: "text-orange-700",
    requiredPermission: "supplier-invoices.read",
    articles: [
      {
        slug: "traiter-facture",
        title: "Traiter une facture fournisseur reçue",
        description: "De l'upload PDF au marquage payé.",
        estimatedMinutes: 4,
        content: `
Les factures fournisseurs (loyer, comptable, matériel...) arrivent par mail. Traitement en 3 étapes.

![Étape 1 — Drop PDF avec OCR automatique](/wiki/mockups/supplier-step1.svg)

> [!STEP] 1. Drop le PDF
> \`/supplier-invoices\` → drag le PDF. L'OCR extrait fournisseur, montant, TVA, date automatiquement.

![Étape 2 — Vérifier les champs extraits + catégorie](/wiki/mockups/supplier-step2.svg)

> [!STEP] 2. Vérifier et catégoriser
> L'OCR est ~90% fiable. Corrige à la main ce qui ne va pas. Choisis la catégorie comptable.

![Étape 3 — Cycle de vie TO_PAY → SCHEDULED → PAID](/wiki/mockups/supplier-step3.svg)

> [!STEP] 3. Suivre le paiement
> Statut TO_PAY → SCHEDULED (virement programmé) → PAID (débit confirmé). Effet cashflow automatique à PAID.

> [!TIP] Webhook email entrant (Phase 2)
> À venir : forward directement au mail dasoerp+invoices@ → auto-création. Zéro manip.
`
      }
    ]
  },
  {
    key: "payroll",
    title: "Payroll",
    description: "Calcul mensuel salaires, précompte, ONSS.",
    icon: "Wallet2",
    colorClass: "text-rose-700",
    requiredPermission: "payroll.read",
    articles: [
      {
        slug: "workflow-mensuel",
        title: "Workflow payroll mensuel",
        description: "Calcul, validation, statut PAID par flux.",
        estimatedMinutes: 4,
        content: `
Chaque mois, 3 flux à honorer : salaires nets aux employés, précompte au fisc, ONSS.

![Étape 1 — Vue mensuelle avec tous les employés](/wiki/mockups/payroll-step1.svg)

> [!STEP] 1. Vérifier le récap
> \`/payroll\` → tableau par employé avec Net / Précompte / ONSS. Total masse salariale en bas.

![Étape 2 — Marquer chaque flux payé individuellement](/wiki/mockups/payroll-step2.svg)

> [!STEP] 2. Marquer les 3 flux
> Chaque flux a sa deadline légale. Marque PAID au fur et à mesure des virements réels.

![Étape 3 — 3 lignes cashflow créées automatiquement](/wiki/mockups/payroll-step3.svg)

> [!STEP] 3. Impact cashflow
> Les 3 lignes cashflow sont pré-remplies chaque mois. Aucune double saisie.

> [!WARN] Deadlines belges
> Précompte : versement le 15 du mois M+1 (mensuel). ONSS : trimestriel. En retard = amendes ONSS lourdes.
`
      }
    ]
  },
  {
    key: "simulators",
    title: "Simulateurs",
    description: "Package RH consultant + brut/net personnel.",
    icon: "Calculator",
    colorClass: "text-violet-700",
    requiredPermission: "candidates.read",
    articles: [
      {
        slug: "package-consultant",
        title: "Simuler un package consultant",
        description: "Construire une offre RH avec TJM cible et marge.",
        estimatedMinutes: 5,
        content: `
Avant d'embaucher, tu simules le package : salaire, ATN voiture, chèques-repas, hospitalisation, GSM.

![Étape 1 — Saisie salaire brut + extras](/wiki/mockups/simu-step1.svg)

> [!STEP] 1. Saisir le brut mensuel + extras
> \`/simulator/package\` → salaire brut + coche les avantages (voiture, chèques-repas, frais représentation, hospi, GSM).

![Étape 2 — Calcul du TJM cible avec marge 30%](/wiki/mockups/simu-step2.svg)

> [!STEP] 2. Lire le TJM à vendre
> L'ERP calcule le coût employeur total, le divise par 200 jours facturables, applique la marge cible → **TJM à vendre**.

![Étape 3 — Sauvegarder pour comparer](/wiki/mockups/simu-step3.svg)

> [!STEP] 3. Sauvegarder plusieurs scénarios
> Compare "4500€ brut" vs "4200€ + voiture". Souvent l'ATN gagne : moins cher pour toi, plus attractif pour le candidat.

> [!TIP] Lien depuis simulateur → brut/net personnel
> Bouton **Voir le net perçu** ouvre \`/simulator/brut-net\` avec les valeurs pré-remplies. Utile pour montrer au candidat son net réel.
`
      }
    ]
  },
  {
    key: "onboarding",
    title: "Onboarding",
    description: "Parcours d'intégration structuré par rôle.",
    icon: "UserPlus",
    colorClass: "text-cyan-700",
    requiredPermission: "onboarding.read",
    articles: [
      {
        slug: "utiliser",
        title: "Créer et suivre un onboarding",
        description: "Template par rôle → instance auto → progression trackée.",
        estimatedMinutes: 4,
        content: `
Un template par rôle. À la création d'un user, l'onboarding est auto-généré. Pas de checklist perdue.

![Étape 1 — Templates par rôle dans Settings](/wiki/mockups/onboarding-step1.svg)

> [!STEP] 1. Templates configurables
> \`/settings/onboarding-templates\` → 1 template par rôle (CONSULTANT, MANAGER, COMMERCIAL, FINANCE). Chaque item a un owner.

![Étape 2 — Instance auto-créée au recrutement](/wiki/mockups/onboarding-step2.svg)

> [!STEP] 2. Nouveau user = onboarding auto
> Quand tu crées un user avec un rôle, son onboarding est instancié automatiquement (12-18 items selon rôle).

![Étape 3 — Vue RH globale de tous les onboardings](/wiki/mockups/onboarding-step3.svg)

> [!STEP] 3. Piloter en tant que RH
> \`/onboarding\` liste tous les onboardings en cours. Barre de progression + statut par personne. Ping les owners si stagnation.
`
      }
    ]
  },
  {
    key: "reviews",
    title: "Entretiens",
    description: "Annuels, semi-annuels, projet — trace structurée.",
    icon: "MessagesSquare",
    colorClass: "text-blue-700",
    requiredPermission: "reviews.read",
    articles: [
      {
        slug: "conduire",
        title: "Conduire un entretien annuel",
        description: "Planifier, prendre notes, séparer feedback et notes privées.",
        estimatedMinutes: 4,
        content: `
L'entretien annuel structure la relation manager-consultant. Trace obligatoire pour évolution salariale, promotion.

![Étape 1 — Planifier l'entretien](/wiki/mockups/reviews-step1.svg)

> [!STEP] 1. Planifier
> Fiche user → onglet Entretiens → **Nouveau**. Type : Annuel / Semi-annuel / Projet. Invite dans le calendrier (à la main).

![Étape 2 — Formulaire structuré en séance](/wiki/mockups/reviews-step2.svg)

> [!STEP] 2. Prendre les notes en séance
> Sections : points forts observés, axes d'amélioration, objectifs N+1, souhaits carrière du consultant.

![Étape 3 — Distinguer Feedback partagé vs Notes privées](/wiki/mockups/reviews-step3.svg)

> [!STEP] 3. Séparer le partagé du privé
> **Feedback** : partagé avec le consultant, visible sur son /me. **Notes privées** : manager+admins only, pour contexte confidentiel.

> [!WARN] Écris comme si tout pouvait être révélé
> Un jour un tribunal peut demander accès. Diplomatie et factualité toujours — même dans les notes privées.
`
      }
    ]
  },
  {
    key: "sick-leaves",
    title: "Arrêts maladie",
    description: "Déclaration consultant + vue RH centralisée.",
    icon: "HeartPulse",
    colorClass: "text-red-700",
    requiredPermission: "users.manage",
    articles: [
      {
        slug: "gerer",
        title: "Gérer les arrêts maladie",
        description: "Déclaration consultant → certif → RH → impact planning.",
        estimatedMinutes: 4,
        content: `
Un consultant malade déclare depuis /me. Le manager RH voit le tout centralisé et prévient les impacts.

![Étape 1 — Consultant déclare depuis /me](/wiki/mockups/sick-step1.svg)

> [!STEP] 1. Le consultant déclare
> \`/me\` → onglet RH → Nouvel arrêt → dates + upload certificat médical (obligatoire).

![Étape 2 — Vue manager RH centralisée](/wiki/mockups/sick-step2.svg)

> [!STEP] 2. Manager RH voit tout
> \`/sick-leaves\` → tous les arrêts en cours en rouge. Communique aux managers projet impactés.

![Étape 3 — Effets automatiques sur planning + KPI](/wiki/mockups/sick-step3.svg)

> [!STEP] 3. Impact automatique partout
> Planning : jours en rouge Maladie. Facturation mission : jours déduits. Dashboard : carte "consultant absent".

> [!INFO] Arrêt > 30 jours
> Belgique : déclaration ONSS/mutuelle obligatoire par l'employeur. Contacte le secrétariat social.
`
      }
    ]
  },
  {
    key: "documents",
    title: "Documents",
    description: "GED liée aux entités : contrats, factures, certifs.",
    icon: "Files",
    colorClass: "text-slate-700",
    requiredPermission: "documents.read",
    articles: [
      {
        slug: "utiliser",
        title: "Utiliser la GED intégrée",
        description: "Upload avec versioning + liaison aux entités.",
        estimatedMinutes: 3,
        content: `
Tous les documents à un seul endroit, mais consultables depuis les fiches concernées.

![Étape 1 — Vue documents avec filtres par type](/wiki/mockups/docs-step1.svg)

> [!STEP] 1. Liste centralisée
> \`/documents\` → 47 documents · filtres par type (contrats, factures, certifs) et recherche.

![Étape 2 — Upload avec liaison entité + versioning](/wiki/mockups/docs-step2.svg)

> [!STEP] 2. Upload avec liens
> Nouveau document → upload + lie-le à une entité (Mission, User, Contact) + tags. Versioning natif (V1 → V2).

![Étape 3 — Accès depuis les fiches entité](/wiki/mockups/docs-step3.svg)

> [!STEP] 3. Accéder depuis les fiches
> Fiche mission / user / client → section Documents affiche les documents liés. Pas besoin de chercher par nom.

> [!TIP] Contrôle d'accès
> Les documents privés (RH, entretiens) ne sont pas visibles par le consultant. Permission granulaire.
`
      }
    ]
  },
  {
    key: "bank",
    title: "Banque",
    description: "Sync GoCardless + réconciliation cashflow.",
    icon: "Building2",
    colorClass: "text-green-700",
    requiredPermission: "bank.read",
    articles: [
      {
        slug: "connecter-syncer",
        title: "Connecter ta banque et synchroniser",
        description: "GoCardless PSD2 · sync auto · réconciliation.",
        estimatedMinutes: 5,
        content: `
GoCardless (Open Banking) synchronise tes transactions automatiquement. Fini la saisie manuelle.

![Étape 1 — Connecter ta banque via GoCardless](/wiki/mockups/bank-step1.svg)

> [!STEP] 1. Connecter (première fois)
> \`/bank\` → Connecter → choisis ta banque (ING, Belfius, BNP, KBC...). Redirection sécurisée PSD2, consentement 90j.

![Étape 2 — Transactions syncées en continu](/wiki/mockups/bank-step2.svg)

> [!STEP] 2. Consultation
> Sync automatique toutes les heures. Chaque tx affichée avec statut Réconcilié / À matcher.

![Étape 3 — Réconciliation manuelle des à matcher](/wiki/mockups/bank-step3.svg)

> [!STEP] 3. Matcher avec le cashflow
> L'ERP suggère les matches par montant/date/nom. Tu confirmes en 1 clic → tx marquée RÉCONCILIÉE.

> [!WARN] Consentement à renouveler
> Tous les 90 jours PSD2 exige une re-authentification. Le dashboard t'affiche un rappel J-7.
`
      }
    ]
  },
  {
    key: "prospection",
    title: "Prospection",
    description: "Outbound structuré avec templates et relances.",
    icon: "Send",
    colorClass: "text-pink-700",
    requiredPermission: "crm.read",
    articles: [
      {
        slug: "outbound-followup",
        title: "Organiser sa prospection outbound",
        description: "Templates + envois personnalisés + relances programmées.",
        estimatedMinutes: 4,
        content: `
La prospection nécessite discipline et volumétrie. L'ERP structure les envois et automatise les relances.

![Étape 1 — Dashboard prospection avec KPI](/wiki/mockups/prospection-step1.svg)

> [!STEP] 1. Vue synthèse quotidienne
> \`/prospection\` → envoyés, réponses, relances du jour. Taux de réponse en un coup d'œil.

![Étape 2 — Créer une interaction avec template](/wiki/mockups/prospection-step2.svg)

> [!STEP] 2. Ajouter une interaction
> Cible (contact + entreprise) + canal (LinkedIn/email/appel) + template. Placeholders {{prenom}}, {{entreprise}}, {{secteur}} substitués auto.

![Étape 3 — Programmer follow-up J+7](/wiki/mockups/prospection-step3.svg)

> [!STEP] 3. Toujours programmer une relance
> À chaque envoi, coche "Rappel J+7". Le jour venu, carte bleue sur le dashboard.

> [!TIP] Discipline &gt; volumétrie
> Mieux vaut 5 relances programmées et faites que 50 envois oubliés dans la nature.
`
      }
    ]
  },
  {
    key: "employees",
    title: "Employés & Freelances",
    description: "Distinguer contractTypes, payroll agrégé, chaînage automatique.",
    icon: "Users2",
    colorClass: "text-amber-700",
    requiredPermission: "employees.read",
    articles: [
      {
        slug: "gerer",
        title: "Gérer employés vs freelances",
        description: "Flag contractType + impact cashflow + chaînage recrutement.",
        estimatedMinutes: 4,
        content: `
Distinction Employee/Freelance impacte le payroll, la facturation, les cotisations. À bien setter.

![Étape 1 — Liste unifiée Employees + Freelances](/wiki/mockups/employees-step1.svg)

> [!STEP] 1. Vue unifiée
> \`/employees\` → tous les postes, badge EMPLOYEE ou FREELANCE, coût mensuel, TJM cible.

![Étape 2 — Cashflow : 1 ligne agrégée par flux](/wiki/mockups/employees-step2.svg)

> [!STEP] 2. Cashflow simplifié
> Avant : 1 ligne par employé (illisible). Après : 3 lignes agrégées (Salaires nets, Précompte, ONSS).

![Étape 3 — Chaînage Candidate → User Employee](/wiki/mockups/employees-step3.svg)

> [!STEP] 3. Recrutement chaîné
> Candidat HIRED → bouton "Promouvoir en User" → contractType EMPLOYEE + onboarding auto + ajout payroll. Un clic, 4 automatismes.

> [!INFO] Freelance vs Employee
> Employee = payroll mensuel Dasolabs. Freelance = facture mensuelle du freelance à Dasolabs (traité comme SupplierInvoice).
`
      }
    ]
  }  ,
  {
    key: "fleet",
    title: "Flotte véhicules",
    description: "Gérer voitures leasing + achat, attribuer, tracer.",
    icon: "Car",
    colorClass: "text-slate-700",
    requiredPermission: "fleet.read",
    articles: [
      {
        slug: "gerer",
        title: "Gérer la flotte de véhicules",
        description: "Liste, fiche véhicule, contrat leasing, attribution + sync cashflow.",
        estimatedMinutes: 4,
        content: `
La flotte Dasolabs (voitures leasing + propriété) tient dans un module dédié qui alimente automatiquement le cashflow pour les mensualités leasing.

![Étape 1 — Liste des véhicules avec statut et utilisateur](/wiki/mockups/fleet-step1.svg)

> [!STEP] 1. Vue liste
> \`/fleet\` affiche tous les véhicules actifs · plaque · marque/modèle · type (Leasing/Propriété) · utilisateur actuel · mensualité leasing. Section "Sortis de flotte" pliable en bas.

![Étape 2 — Fiche véhicule avec contrat leasing + attribution](/wiki/mockups/fleet-step2.svg)

> [!STEP] 2. Fiche véhicule
> Trois blocs : infos véhicule (plaque, VIN, dates), contrat de leasing (bailleur, dates, mensualité), attribution actuelle avec bouton "Clôturer".

![Étape 3 — Sync cashflow des mensualités leasing](/wiki/mockups/fleet-step3.svg)

> [!STEP] 3. Sync cashflow automatique
> Sauvegarder un contrat = créer une ligne récurrente dans le cashflow (catégorie "Leasing véhicules") entre les dates du contrat. Modifier = màj, supprimer = suppression de la ligne cashflow.

> [!TIP] Attribution avec historique
> Attribuer un véhicule à un nouvel user ferme automatiquement l'attribution précédente à la veille de la nouvelle date. L'historique complet reste consultable sur la fiche.

> [!INFO] Kilométrage optionnel
> Tu peux tracer les km au départ / retour d'attribution — utile pour arbitrer le forfait leasing en fin de contrat (dépassement km facturé).
`
      }
    ]
  }
];

export async function seedWiki(prisma: PrismaClient) {
  console.log("📚 Seeding wiki formation...");
  for (let ci = 0; ci < CATEGORIES.length; ci++) {
    const cat = CATEGORIES[ci];
    const catRow = await prisma.wikiCategory.upsert({
      where: { key: cat.key },
      update: {
        title: cat.title,
        description: cat.description,
        icon: cat.icon,
        colorClass: cat.colorClass,
        requiredPermission: cat.requiredPermission,
        orderIndex: ci
      },
      create: {
        key: cat.key,
        title: cat.title,
        description: cat.description,
        icon: cat.icon,
        colorClass: cat.colorClass,
        requiredPermission: cat.requiredPermission,
        orderIndex: ci
      }
    });
    for (let ai = 0; ai < cat.articles.length; ai++) {
      const art = cat.articles[ai];
      await prisma.wikiArticle.upsert({
        where: { categoryId_slug: { categoryId: catRow.id, slug: art.slug } },
        update: {
          title: art.title,
          description: art.description,
          content: art.content.trim(),
          difficulty: art.difficulty ?? "BEGINNER",
          estimatedMinutes: art.estimatedMinutes ?? 5,
          requiredPermission: art.requiredPermission ?? null,
          orderIndex: ai,
          publishedAt: new Date()
        },
        create: {
          categoryId: catRow.id,
          slug: art.slug,
          title: art.title,
          description: art.description,
          content: art.content.trim(),
          difficulty: art.difficulty ?? "BEGINNER",
          estimatedMinutes: art.estimatedMinutes ?? 5,
          requiredPermission: art.requiredPermission ?? null,
          orderIndex: ai,
          publishedAt: new Date()
        }
      });
    }
  }
  console.log(`   → ${CATEGORIES.length} catégories, ${CATEGORIES.reduce((s, c) => s + c.articles.length, 0)} articles.`);
}
