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

## Missions ouvertes

Nombre de \`Mission\` dont le statut est **PLANNED**, **ACTIVE** ou **EXTENDED**. C'est le vrai stock de missions consultants en cours, pas les demandes de mission en pipeline (celles-là restent dans le CRM).

> [!INFO] Différence Mission vs MissionRequest
> Une **MissionRequest** est une demande entrante d'un client (pipeline CRM). Une **Mission** est un consultant Dasolabs concrètement engagé. Le KPI compte les Mission.

## Chiffre d'affaires prévu

Somme des tranches (**BillingMilestone**) attendues sur l'année en cours, statuts non-CANCELLED. C'est la prévision réaliste, pas le facturé.

## Solde compte

Solde de trésorerie **réel** — calculé à partir du bootstrap manuel + tous les mouvements marqués PAID depuis le lancement, indépendamment de l'année affichée dans le cashflow. Sert de vérité terrain.

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

> [!STEP] 1. Cartes rouges
> Actions urgentes : mission arrivant à échéance, offre en retard, note de frais bloquée. Un clic ouvre la fiche concernée.

> [!STEP] 2. Cartes oranges
> Anomalies à surveiller : cellule cashflow non résolue, milestone dont la date de paiement est dépassée sans être marquée PAID.

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

## Ce qui est indexé

- Entreprises + contacts
- Missions et demandes de mission
- Offres et projets
- Candidats et consultants internes
- Documents

> [!TIP] Recherche multi-mots
> \`sophie belgian\` filtre tout ce qui contient à la fois "sophie" ET "belgian" — pratique pour croiser un prénom et une entreprise sans se rappeler du reste.

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

## Structure de la grille

- **Colonnes** : les 12 mois de l'année sélectionnée (janvier à décembre).
- **Lignes** : un flux financier. Peut être une **mission** (aggrégée par mois), une **dépense récurrente** (loyer, comptable), une **entrée ponctuelle** (subside, remboursement TVA), ou une **payroll** (3 lignes : NET, précompte, ONSS).
- **Cellules** : le montant prévu ce mois-là pour ce flux. La couleur indique le **statut** : gris = prévu, bleu = facturé, vert = payé.

## Le solde de compte

Le **solde compte** en tête est ta trésorerie **réelle** aujourd'hui — indépendant de l'année affichée. Il vient du bootstrap manuel + tous les mouvements PAID chronologiquement.

> [!WARN] Ne pas confondre solde compte et solde année
> Le solde année (fin décembre) est une **projection**. Le solde compte est la vérité banque.

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
Sur une tranche mission, tu passeras typiquement par 3 statuts.

> [!STEP] 1. PLANNED
> État initial, avec la date prévue de facturation. Grisé dans la grille. Tu peux modifier la date et le montant tant que la tranche n'est pas facturée.

> [!STEP] 2. INVOICED (facturé)
> Une fois la facture émise, clique sur la cellule → bouton **Marquer facturé**. La cellule passe en bleu, et le montant remonte dans le KPI "En cours" du dashboard.

> [!STEP] 3. PAID (payé)
> Quand le client paye, clique sur la cellule → **Marquer payé**. La cellule passe en vert, le solde compte augmente du montant TVAC, et la ligne remonte dans le journal PAID.

> [!TIP] Encaissement décalé
> La date d'encaissement peut être décalée par rapport à la date de facturation (paiement 30j fin de mois). Modifie la date de la cellule pour refléter la réalité — le cashflow se recalculera.

## Erreur classique : dé-marquer

Si tu marques PAID par erreur, ouvre la cellule et clique **Repasser en PLANNED**. Le solde compte se recalcule automatiquement.
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

> [!STEP] 1. Bouton "+ Ajouter"
> Depuis la page cashflow, choisis "Entrée ponctuelle" dans la palette.

> [!STEP] 2. Remplir le formulaire
> Catégorie (autocomplete), montant, date, sens (recette ou dépense). Tu peux marquer comme récurrent avec date de fin — ex: une garantie qui court 6 mois.

> [!STEP] 3. Sauvegarder
> La ligne apparaît dans la grille et dans le panneau "Ce mois-ci" si le mois affiché est concerné.

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

## 1. MissionRequest — la demande

Une entreprise nous demande un consultant. On crée une **MissionRequest** avec les infos : compétences requises, TJM cible, durée, dates.

## 2. Application + Presentation

On crée une **Application** par consultant qu'on veut présenter (interne ou candidat vivier). L'application produit une **presentation** (PDF de CV + lettre de motivation) envoyée au client.

## 3. Proposal (offre consultant)

Si le client demande une offre chiffrée, on crée un **MissionProposal** avec TJM vendu, taux, conditions. Statut évolue : DRAFT → OFFER_SENT → SELECTED (le consultant est retenu) → REJECTED.

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

> [!STEP] 2. Ajouter un consultant à la shortlist
> Bouton "+ Consultant" → recherche un candidat vivier ou un consultant interne. Ça crée une **Application**.

> [!STEP] 3. Préparer la présentation
> Depuis la carte candidat, clique "Préparer présentation". Écran d'édition : ordre des expériences, mise en avant compétences, lettre de motivation optionnelle.

> [!STEP] 4. Aperçu + Envoi
> **Aperçu PDF** ouvre le rendu final dans un nouvel onglet. Une fois validé, "Présenté au client" fait passer l'application en PRESENTED.

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
> [!STEP] 1. Récupérer les jours du mois
> Depuis \`/missions/[id]\`, section "Facturation" → bouton **Générer tranche du mois**. L'ERP lit les timesheets validés du consultant sur ce mois.

> [!STEP] 2. Ajuster si besoin
> Modal ouvre avec les jours pré-remplis. Tu peux ajuster (déductions, congés client, jours fériés). TVA appliquée = celle du projet.

> [!STEP] 3. Générer la tranche
> Statut initial = PLANNED, avec date d'encaissement = fin du mois + 30j (personnalisable dans les settings). Elle apparaît dans le cashflow.

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
> [!STEP] 1. Nouvelle offre
> \`/offers/new\` → sélectionne l'entreprise cliente (autocomplete). Choisis les contacts destinataires (plusieurs possibles).

> [!STEP] 2. Header
> Objet, référence auto-générée (modifiable), date, validité (30 jours par défaut), **taux TVA** (21% par défaut, 6% pour formations, 12% pour restauration).

> [!STEP] 3. Postes
> Ajoute des lignes : description, quantité, PU HT. Le total HT + TVA + TTC se calcule live. Tu peux réordonner par drag.

> [!STEP] 4. Conditions
> Zone markdown pour les CGV, délais, garanties. Le rendu PDF applique la charte Dasolabs.

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

> [!STEP] 1. Depuis la V1
> Bouton "Nouvelle version" en haut de la fiche offre. L'ERP duplique tous les postes, options, contacts, conditions.

> [!STEP] 2. Modifier
> Ajuste les postes. Les modifs restent locales à la V2 — la V1 est figée pour l'historique.

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

> [!STEP] 2. Configurer les tranches
> Le wizard propose de découper le montant en tranches de facturation : pré-remplies selon les jalons (30% début, 40% mi-projet, 30% fin) ou personnalisables.

> [!STEP] 3. Dates prévues
> Chaque tranche a une date prévue de facturation (défaut = fin du mois du jalon). Tu peux ajuster.

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

> [!STEP] 2. Créer les contacts
> Depuis la fiche entreprise, section "Contacts" → "+ Ajouter". Tu peux marquer le rôle (Décideur, Technique, Achats) qui reste attaché **au lien** — donc si le contact bouge, tu recréé un lien avec un nouveau rôle.

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

> [!STEP] 1. Créer une interaction
> Bouton "+ Interaction" → cible (contact + entreprise), canal (LinkedIn, email, appel), template optionnel.

> [!STEP] 2. Envoyer
> L'ERP ne connecte pas encore ton client mail — pour l'instant, copy-paste du texte final vers ta boîte. Statut = SENT.

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
> [!STEP] 1. Nouvelle note
> \`/expenses/new\` — tous les champs sont **obligatoires** (date, catégorie, montant TTC, centre de coût, description).

> [!STEP] 2. Choisir la catégorie
> Repas / Hébergement / Déplacement / Fournitures / Autre. La TVA se déduit automatiquement du montant TTC selon le taux légal belge (Repas 12%, Hébergement 6%, autres 21%).

> [!STEP] 3. Repas → participants
> Si catégorie Repas, un champ "Participants" s'affiche. Liste-les (interne + client). Ils apparaîtront dans le PDF.

> [!STEP] 4. Ticket / justificatif
> Upload le PDF ou l'image du ticket. Obligatoire — sinon le comptable refuse.

> [!STEP] 5. Aperçu + Soumission
> Bouton **Aperçu PDF** montre le rendu tel qu'il partira au comptable. Une fois OK, **Soumettre** → statut passe en SUBMITTED.

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

> [!STEP] 1. Ouvrir la note
> Depuis \`/expenses?filter=to-approve\` ou la carte du dashboard.

> [!STEP] 2. Vérifier
> Justificatif présent ? Catégorie cohérente ? Participants OK pour les repas > 30€ ?

> [!STEP] 3. Approuver
> Bouton **Approuver**. La note passe en APPROVED, et l'ERP crée automatiquement une entrée cashflow catégorie "Notes de frais" au dernier jour du mois de la dépense.

> [!STEP] 4. Refuser
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

> [!STEP] 1. Filtrer
> \`/expenses?filter=approved&month=2026-07\` — toutes les notes approuvées du mois.

> [!STEP] 2. Export PDF
> Bouton **Export PDF** en tête de liste → génère un document avec table synthétique + tous les justificatifs concaténés.

> [!STEP] 3. Envoi
> Attache le PDF à un mail au comptable. L'ERP ne l'envoie pas automatiquement (pas encore de connecteur mail sortant).

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
> [!STEP] 1. Ouvrir /me → onglet RH
> Section "Congés" affiche ton solde 4 cartes : Légaux · RTT · Année précédente · Total.

> [!STEP] 2. Nouvelle demande
> Formulaire avec dates début/fin. Le nombre de jours ouvrés est suggéré automatiquement (lundi-vendredi).

> [!STEP] 3. Type
> Légaux (bucket ANNUAL_LEGAL) / RTT / Année précédente / Sans solde / Spécial. Les 3 premiers décomptent des soldes.

> [!STEP] 4. Mission client active ?
> Si tu es en mission, une section apparaît avec **"Demandé chez le client et accordé"** à cocher. Coche uniquement si le client a validé de son côté — le manager verra ça pour décider.

> [!STEP] 5. Soumettre
> DRAFT → SUBMITTED. La demande arrive dans \`/leaves?filter=pending\` du manager.

> [!TIP] Demi-journée
> Le champ "jours" accepte des décimales : 0.5 pour une demi-journée.
`
      },
      {
        slug: "approuver",
        title: "Approuver ou refuser (manager)",
        description: "Vue centralisée + boutons Approuver / Refuser motivé / Supprimer.",
        estimatedMinutes: 3,
        content: `
> [!STEP] 1. Voir les demandes en attente
> \`/leaves?filter=pending\` — nombre de jours + statut client (si case cochée).

> [!STEP] 2. Approuver
> Bouton ✓ vert. La demande passe en APPROVED, le solde du consultant est décrémenté, et l'entrée apparaît en orange dans le planning.

> [!STEP] 3. Refuser
> Bouton ✗ rouge avec motif obligatoire. Le consultant peut refaire une demande.

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

> [!STEP] 3. Rollover global
> Bouton "Ajouter congés N+1 (tous)" en tête de tableau. Boucle sur tous les consultants actifs.

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
> [!STEP] 1. Sélectionner une plage de jours
> Sur la ligne du consultant, clique-drag du 1er au dernier jour à couvrir.

> [!STEP] 2. Modal d'affectation
> S'ouvre automatiquement. Choisis **Projet** (client) ou **Centre de coût** (interne : R&D, formation, admin).

> [!STEP] 3. Charge et heures
> Charge % (par défaut 100) et heures/jour (défaut = capacité hebdo / 5). Le rendu du planning est plein / demi selon la charge.

> [!STEP] 4. Sauver
> Une plage colorée apparaît. Chaque projet a sa couleur (hash déterministe).

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
> [!STEP] 1. /me → onglet CV
> Le CV consultant est structuré : expériences pro, compétences (tags), langues, taux journalier vendu.

> [!STEP] 2. Ajouter une expérience
> Entreprise, poste, dates (fin optionnelle si en cours), description en markdown. Les expériences sont triées par date de début décroissante.

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

> [!STEP] 2. Envoyer le lien
> L'ERP génère un lien avec **token** unique. Copie-le et envoie-le au candidat. Le lien reste valide jusqu'à ce qu'il passe le test.

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
> [!STEP] 1. Ouvrir le profil LinkedIn
> Va sur linkedin.com/in/... du candidat. Assure-toi que le profil est déplié (About, Experience, Education).

> [!STEP] 2. Copier tout le contenu de la page
> Cmd+A puis Cmd+C — pas grave si tu copies la nav LinkedIn, le prompt ignore.

> [!STEP] 3. Coller dans l'ERP
> \`/candidates/new\` → onglet "Depuis LinkedIn" → grosse textarea. Colle et clique **Parser**.

> [!STEP] 4. Vérifier le résultat
> Claude Haiku extrait prénom, nom, poste actuel, expériences, langues. Affichés dans un form pré-rempli — corrige ce qui ne va pas.

> [!STEP] 5. Sauvegarder
> Le candidat est créé avec ses expériences en une seule fois.

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
> [!STEP] 1. /users/new
> Nom, email (unique), rôle par défaut (CONSULTANT, MANAGER, ADMIN, FINANCE, COMMERCIAL).

> [!STEP] 2. Attributs consultant
> Photo (base64, max 1 Mo), téléphone, ville, séniorité, années d'expérience, langues.

> [!STEP] 3. Coûts internes
> hourlyCost, dailyCost, dailyRate (visible admin uniquement). weeklyCapacityH = capacité par semaine (38 par défaut).

> [!STEP] 4. Quotas congés
> annualLeaveDays (20 par défaut légal belge), rttDays (12 par défaut). Personnalisables.

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

> [!STEP] 1. /access/groups → "+ Nouveau groupe"
> Nom (ex: "Manager RH"), description.

> [!STEP] 2. Cocher les permissions
> L'écran affiche les permissions groupées par entrée sidebar (Pilotage, Commercial, RH, …). Coche ce que ce groupe peut faire : \`leaves.read\`, \`leaves.approve\`, \`expenses.approve\`, etc.

> [!STEP] 3. Sauver
> Le groupe est créé. Il apparaît dans la liste.

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

## La règle

À chaque merge d'une modification visible côté utilisateur (nouveau champ, nouvelle page, changement de workflow, ajout de bouton), **tu passes en revue les articles wiki de la thématique concernée** et tu :

- Édites l'article pour refléter la nouvelle réalité (icône **Modifier**)
- Ajoutes une nouvelle capture d'écran si l'UI a changé (bouton **Image** dans l'éditeur)
- Cliques **Marquer vérifié** pour remettre à zéro le compteur "à revoir"

> [!WARN] Ce qui compte comme "visible utilisateur"
> Nouveau champ dans un form, changement de wording, ajout/suppression de bouton, réorganisation de menu, nouveau statut d'un workflow, changement de règle métier (ex: quotas, seuils). **Un refactor interne** qui ne change rien à l'UI ne demande pas de mise à jour wiki.

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

## Capturer proprement

> [!STEP] 1. Ferme les distractions
> Ferme les onglets inutiles, les notifs, les fenêtres qui se superposent. Le lecteur doit voir uniquement ce dont l'article parle.

> [!STEP] 2. Cadre uniquement la zone utile
> Sur macOS : **Cmd + Maj + 4** puis espace pour capturer une fenêtre entière, ou drag pour sélectionner. Sur Windows : **Win + Maj + S**. Coupe la sidebar de l'ERP si l'article ne parle pas du menu.

> [!STEP] 3. Résolution modérée
> Vise ~1200-1600 px de large. Trop grand alourdit inutilement, trop petit rend illisible sur écran retina. Le rendu wiki adapte automatiquement à la largeur.

> [!STEP] 4. Anonymise les données sensibles
> Floute noms de clients réels, montants confidentiels, données personnelles. Un consultant en formation n'a pas besoin de voir "Client X — 45 000€ facturés".

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

## Le rituel de 5 minutes

- **[ ]** Le module modifié a-t-il un article wiki ? Si non, en créer un via le seed (ou demander à l'admin de le faire depuis l'UI).
- **[ ]** Les captures d'écran de l'article correspondent-elles encore à l'UI actuelle ? Sinon, en refaire.
- **[ ]** Un nouveau bouton / champ / workflow ? Ajouter une étape numérotée dans l'article correspondant.
- **[ ]** Un ancien élément supprimé ? Retirer la mention dans le wiki.
- **[ ]** Cliquer **Marquer vérifié** sur chaque article touché.

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
