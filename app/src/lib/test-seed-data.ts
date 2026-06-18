// Seed data des 5 tests techniques (130 questions au total).
// Utilisé par la server action `seedTestsIfMissing()` pour populer la DB
// au premier déploiement. Idempotent : ne crée que les tests absents.
//
// La source documentée est docs/specs/tests-techniques.md.

import type { TestDomain, TestDifficulty } from "@prisma/client";

type SeedChoice = { text: string; isCorrect: boolean };

export type SeedQuestion = {
  text: string;
  difficulty: TestDifficulty;
  isScenario?: boolean;
  choices: SeedChoice[]; // exactement 4
};

export type SeedTest = {
  domain: TestDomain;
  title: string;
  description: string;
  questions: SeedQuestion[];
};

// ─── Helpers d'écriture compacts ─────────────────────────────────────────
// q(texte, niveau, [A,B,C,D], indexBonneRéponse, isScenario)
function q(
  text: string,
  difficulty: TestDifficulty,
  choices: [string, string, string, string],
  correctIndex: 0 | 1 | 2 | 3,
  isScenario = false
): SeedQuestion {
  return {
    text,
    difficulty,
    isScenario,
    choices: choices.map((c, i) => ({ text: c, isCorrect: i === correctIndex }))
  };
}
const J: TestDifficulty = "JUNIOR";
const M: TestDifficulty = "MEDIOR";
const S: TestDifficulty = "SENIOR";
const E: TestDifficulty = "EXPERT";

// ─── Test 1 : Électricité industrielle (24 questions) ────────────────────
const electricalQuestions: SeedQuestion[] = [
  q(
    "Selon la norme IEC 60204-1, quelle est la couleur réglementaire d'un conducteur de protection (PE) ?",
    J, ["Bleu clair", "Vert/jaune", "Marron", "Noir"], 1
  ),
  q(
    "Que signifie l'indice de protection IP54 d'une armoire électrique ?",
    J, [
      "Protection totale contre les poussières et résistance à l'immersion temporaire",
      "Protection partielle contre les poussières et contre les projections d'eau dans toutes les directions",
      "Protection totale contre les poussières et contre les jets d'eau puissants",
      "Protection partielle contre les poussières et contre les chutes verticales d'eau"
    ], 1
  ),
  q(
    "Dans une installation en régime de neutre TN-S, comment sont organisés le neutre (N) et le conducteur de protection (PE) ?",
    M, [
      "Ils sont confondus du transformateur jusqu'à l'utilisation",
      "Ils sont distincts depuis le point de mise à la terre principal",
      "Ils sont reliés par un éclateur en cas de défaut",
      "Ils ne sont reliés qu'au tableau général"
    ], 1
  ),
  q(
    "Pour quelle application est typiquement utilisée la courbe de déclenchement B (3 à 5 fois In) d'un disjoncteur magnéto-thermique ?",
    M, [
      "L'éclairage et les circuits résistifs domestiques",
      "Le démarrage de moteurs asynchrones",
      "La protection des transformateurs",
      "Les postes de soudage"
    ], 0
  ),
  q(
    "Lors d'un démarrage étoile-triangle d'un moteur asynchrone triphasé, quel est le rapport entre le couple disponible en étoile et le couple disponible en triangle ?",
    M, [
      "1/√3",
      "Le couple en étoile vaut un tiers du couple en triangle",
      "Deux tiers",
      "√3"
    ], 1
  ),
  q(
    "Que désigne le Performance Level (PL) défini par la norme EN ISO 13849-1 ?",
    S, [
      "Une protection contre les courts-circuits",
      "Une mesure de la fiabilité d'une fonction de sécurité, échelonnée de PL a (le plus faible) à PL e (le plus élevé)",
      "Un niveau de protection contre la foudre",
      "Une tension nominale d'isolation"
    ], 1
  ),
  q(
    "En zone ATEX 1, à quelle fréquence doit-on s'attendre à la présence d'une atmosphère explosive gazeuse ?",
    E, [
      "De manière permanente, ce qui correspondrait à la zone 0",
      "De manière occasionnelle, dans le cadre du fonctionnement normal de l'installation",
      "De manière rare et brève, ce qui correspondrait à la zone 2",
      "Jamais"
    ], 1
  ),
  q(
    "Comment un variateur de fréquence (VFD) contrôle-t-il la vitesse d'un moteur asynchrone ?",
    M, [
      "En modifiant la résistance du rotor",
      "En agissant sur le couple résistant de la charge",
      "En faisant varier la fréquence d'alimentation et la tension de manière proportionnelle (loi U/f)",
      "En modifiant uniquement le glissement"
    ], 2
  ),
  q(
    "Quand parle-t-on de sélectivité totale entre deux disjoncteurs montés en cascade ?",
    S, [
      "Lorsque le disjoncteur amont s'ouvre quel que soit le défaut",
      "Lorsque, pour tout défaut survenu en aval, seul le disjoncteur aval s'ouvre, sans solliciter l'amont",
      "Lorsque les deux disjoncteurs s'ouvrent simultanément",
      "Lorsqu'aucun des deux ne s'ouvre tant qu'une protection externe n'a pas agi"
    ], 1
  ),
  q(
    "Sur un capteur PNP à trois fils, à quoi correspond habituellement le fil noir ?",
    J, [
      "L'alimentation positive (+24 V DC)",
      "Le commun (0 V)",
      "La sortie du signal de détection",
      "Le blindage"
    ], 2
  ),
  q(
    "Quelle est la section minimale d'un conducteur en cuivre pour transporter un courant de 16 A en pose dans un chemin de câbles, dans des conditions courantes ?",
    M, ["1,5 mm²", "2,5 mm²", "4 mm²", "6 mm²"], 1
  ),
  q(
    "Selon la norme IEC 61439, que désigne un tableau « AVCP » (anciennement TTA — Type Tested Assembly) ?",
    E, [
      "Un tableau testé en situation réelle sur le site d'utilisation",
      "Un tableau dont chaque composant a été testé individuellement",
      "Un tableau dont le type a été certifié après essais complets en laboratoire selon la norme",
      "Un tableau monté de manière provisoire pour la phase de prototypage"
    ], 2
  ),
  q(
    "À quoi correspond le régime de neutre TT ?",
    S, [
      "Le neutre du transformateur est isolé et les masses sont mises à la terre",
      "Le neutre du transformateur est mis à la terre côté distribution, et les masses des utilisations sont reliées à une prise de terre distincte",
      "Le neutre et les masses sont confondus sur tout le réseau",
      "Aucune mise à la terre n'est prévue"
    ], 1
  ),
  q(
    "Quelle puissance est dissipée par un transformateur de courant débitant 5 A au secondaire dans une charge résistive de 1 Ω ?",
    S, ["5 W", "25 W (P = R × I²)", "1 W", "La valeur dépend de la fréquence"], 1
  ),
  q(
    "Sur un schéma de commande conforme à la CEI 81346, que désigne la paire de bornes « 13-14 » d'un contacteur ?",
    J, [
      "Un contact auxiliaire normalement ouvert",
      "Un contact auxiliaire normalement fermé",
      "Un contact principal de puissance",
      "Une borne de raccordement de la bobine"
    ], 0
  ),
  q(
    "Quel est le rôle d'un sectionneur porte-fusibles dans une armoire électrique ?",
    M, [
      "Mesurer le courant qui traverse le circuit",
      "Permettre l'isolement visible du circuit et assurer la protection contre les courts-circuits par les fusibles",
      "Filtrer les courants harmoniques",
      "Réduire la tension nominale d'utilisation"
    ], 1
  ),
  q(
    "Quel instrument utilise-t-on pour mesurer la résistance d'une prise de terre ?",
    J, [
      "Un mégohmmètre",
      "Un telluromètre, également appelé contrôleur de terre",
      "Une pince ampèremétrique",
      "Un oscilloscope"
    ], 1
  ),
  q(
    "Comment améliore-t-on le facteur de puissance d'une installation alimentant principalement des charges inductives ?",
    S, [
      "En ajoutant une self d'arrêt en amont",
      "En installant une batterie de condensateurs de compensation",
      "En augmentant la tension d'alimentation",
      "En réduisant la fréquence"
    ], 1
  ),
  q(
    "Quelle tension nominale est recommandée par IEC 60204-1 pour les circuits de commande ?",
    J, ["12 V AC", "24 V DC ou AC", "48 V DC", "230 V AC"], 1
  ),
  q(
    "Vous disposez d'un moteur asynchrone triphasé portant la plaque signalétique « 400 V / 690 V ». Vous l'alimentez sur un réseau triphasé 400 V. Quel couplage adopter ?",
    M, ["Étoile", "Triangle", "Étoile au démarrage puis triangle en régime établi", "Zigzag"], 1
  ),
  // Cas pratiques
  q(
    "Vous intervenez sur une armoire pour remplacer un contacteur défectueux. Quelle est la première action à entreprendre avant toute autre opération ?",
    J, [
      "Mesurer le courant consommé pour confirmer la panne",
      "Consigner l'installation : séparer, condamner, identifier, vérifier l'absence de tension (procédure VAT selon NF C 18-510)",
      "Démonter directement le contacteur après avoir averti l'opérateur",
      "Couper uniquement le disjoncteur du circuit concerné"
    ], 1, true
  ),
  q(
    "Un client vous appelle : un moteur asynchrone triphasé déclenche systématiquement sa protection thermique au démarrage, même à vide. À froid, le moteur démarre normalement. Quelle est la piste la plus probable à investiguer ?",
    M, [
      "Un défaut sur une phase d'alimentation (déséquilibre de tension entre phases ou perte d'une phase) qui surcharge les deux phases restantes",
      "Un mauvais réglage de la courbe du disjoncteur, à passer en courbe D",
      "Un problème de mise à la terre du châssis",
      "Une simple usure mécanique des roulements"
    ], 0, true
  ),
  q(
    "Vous concevez une armoire de 800 W de déperdition thermique, installée dans un local non climatisé pouvant atteindre 40 °C en été, avec un indice de protection IP 54 imposé par le client. Quelle est l'approche la plus adaptée pour le traitement thermique ?",
    S, [
      "Aucun équipement de refroidissement n'est nécessaire à cette puissance",
      "Une ventilation forcée avec entrée et sortie d'air par grilles",
      "Un climatiseur d'armoire ou un échangeur air-eau, car l'IP 54 interdit toute ventilation directe à l'air ambiant",
      "Des ouvertures naturelles en haut et en bas de l'armoire"
    ], 2, true
  ),
  q(
    "Un capteur inductif PNP installé sur une ligne de production donne un signal erratique depuis le matin. La tension d'alimentation 24 V est conforme et stable. Quelle est votre démarche de diagnostic ?",
    E, [
      "Remplacer directement le capteur, car c'est la cause la plus probable",
      "Mettre l'installation à l'arrêt pour intervenir en sécurité",
      "Vérifier d'abord les paramètres physiques (distance de détection, alignement mécanique, copeaux métalliques), puis le câblage (continuité, blindage), puis les perturbations électromagnétiques voisines (variateurs, contacteurs) avant de conclure à un défaut du capteur",
      "Changer la marque du capteur pour un type capacitif"
    ], 2, true
  )
];

// ─── Test 2 : PLC Siemens + Schneider (30 questions) ─────────────────────
const plcQuestions: SeedQuestion[] = [
  q(
    "Quel bloc d'organisation (OB) est exécuté au démarrage d'une CPU S7-1500 ?",
    J, ["OB1", "OB35", "OB100, dédié à la phase de démarrage (Startup)", "OB80"], 2
  ),
  q(
    "À quoi correspond le bloc OB1 dans la structure d'un programme S7 ?",
    J, [
      "Au programme de diagnostic du matériel",
      "Au programme cyclique principal, exécuté en boucle par la CPU",
      "À une routine d'interruption matérielle",
      "À la gestion des erreurs"
    ], 1
  ),
  q(
    "Quelle est la différence architecturale principale entre les gammes S7-1200 et S7-1500 ?",
    M, [
      "Le S7-1200 ne supporte que PROFIBUS, contrairement au S7-1500",
      "Le S7-1500 dispose d'une mémoire et de performances significativement supérieures et d'une intégration plus poussée avec TIA Portal",
      "Seul le S7-1200 propose une variante Safety",
      "Il n'existe pas de différence majeure"
    ], 1
  ),
  q(
    "Quelle caractéristique distingue un Function Block (FB) d'un Function (FC) ?",
    M, [
      "Le FB n'accepte pas de paramètres d'entrée",
      "Le FB ne peut être appelé qu'en mode interruption",
      "Le FB dispose d'un instance DB qui conserve les valeurs de ses variables internes entre deux appels successifs",
      "Le FB doit obligatoirement être écrit en SCL"
    ], 2
  ),
  q(
    "Pour écrire des algorithmes mathématiques complexes (régulation, calculs vectoriels), quel langage est recommandé en S7 ?",
    M, [
      "LAD (Ladder)",
      "FBD (Function Block Diagram)",
      "STL (Statement List)",
      "SCL (Structured Control Language), dont la syntaxe haut niveau facilite la lecture et la maintenance"
    ], 3
  ),
  q(
    "Que contient une « Tag table » dans TIA Portal ?",
    J, [
      "Une liste de temporisations à intervalle",
      "Une liste de variables symboliques associées à leurs adresses absolues (I, Q, M, DB)",
      "Une page de visualisation HMI",
      "Les journaux d'événements de la CPU"
    ], 1
  ),
  q(
    "À quoi sert le bloc OB35 sur les anciennes CPU S7-300 et S7-400 ?",
    S, [
      "Au programme cyclique principal",
      "À l'exécution d'une routine cyclique à intervalle de temps configurable (interruption temporelle)",
      "À la gestion des interruptions matérielles",
      "Au diagnostic système"
    ], 1
  ),
  q(
    "Que représente le type de données TIME, noté avec le préfixe T#, en S7 ?",
    J, [
      "Une date au format ISO 8601",
      "Une durée codée sur 32 bits avec une résolution d'une milliseconde",
      "Un timestamp Unix",
      "Une heure de la journée"
    ], 1
  ),
  q(
    "Comment configure-t-on la fonction Trace pour analyser le comportement d'une variable en temps réel dans TIA Portal ?",
    S, [
      "En programmant un OB d'erreur dédié",
      "Dans Online & Diagnostics, en créant une configuration Trace avec un déclencheur (trigger) et la liste des variables à enregistrer",
      "En appelant un FB Trace mis à disposition par Siemens",
      "Cela requiert obligatoirement une licence WinCC"
    ], 1
  ),
  q(
    "Quelle est la bonne pratique de structuration d'un programme S7 complexe ?",
    M, [
      "Tout placer dans OB1 pour avoir une vue d'ensemble immédiate",
      "Découper en Function Blocks réutilisables, organisés hiérarchiquement et appelés depuis OB1",
      "Utiliser exclusivement le langage STL pour la rapidité d'exécution",
      "Éviter au maximum l'usage de blocs de données"
    ], 1
  ),
  q(
    "Sur quelle infrastructure repose le protocole PROFINET ?",
    J, [
      "Une liaison série RS-485",
      "Un réseau Ethernet industriel TCP/IP, complété par des extensions temps réel RT et IRT",
      "Modbus over TCP",
      "Le bus CAN"
    ], 1
  ),
  q(
    "À quoi sert un bloc de données (DB) en S7 ?",
    J, [
      "À définir la configuration matérielle",
      "À stocker des données structurées : variables, tableaux, structures réutilisables",
      "À exécuter du code de manière interrompue",
      "À paramétrer les liaisons de communication"
    ], 1
  ),
  q(
    "Sur une CPU S7-1500 F (Safety), où doivent être codées les fonctions de sécurité ?",
    S, [
      "Indifféremment dans n'importe quel FB du programme standard",
      "Dans des F-FB ou F-FC dédiés, exécutés au sein du runtime F (séparé du runtime standard)",
      "En langage STL uniquement",
      "Côté WinCC, dans une couche logicielle de supervision"
    ], 1
  ),
  q(
    "Vous devez faire évoluer un projet client de TIA Portal V15.1 vers V17. Quelle démarche est recommandée ?",
    S, [
      "Effectuer la mise à niveau directement en production pour limiter les coûts",
      "Cloner le projet, le tester sur banc d'essai ou avec PLCSIM Advanced, valider l'ensemble des fonctions avant déploiement sur site",
      "Attendre la révision suivante de TIA Portal",
      "Réécrire le programme à zéro pour profiter des nouveautés"
    ], 1
  ),
  q(
    "Comment partager efficacement du code S7 entre plusieurs projets différents ?",
    M, [
      "Par copier-coller successifs entre les projets",
      "En centralisant les blocs dans une Global Library TIA, avec gestion de version intégrée",
      "En exportant les blocs en STL avant de les réimporter",
      "En recodant les blocs à chaque projet pour éviter les dérives"
    ], 1
  ),
  q(
    "Quelle taille mémoire occupe la déclaration ARRAY[1..10] OF REAL ?",
    J, ["10 octets", "20 octets", "40 octets, puisqu'un REAL occupe 4 octets", "Cela dépend de la CPU utilisée"], 2
  ),
  q(
    "Quelle est la fonction de l'instruction MOVE_BLK en SCL ?",
    M, [
      "Copier une seule valeur d'une variable à une autre",
      "Copier un bloc d'éléments d'un tableau source vers un tableau destination",
      "Déplacer dynamiquement un Function Block dans la mémoire",
      "Compresser les données stockées en DB"
    ], 1
  ),
  q(
    "Pour faire communiquer une CPU S7-1500 avec une CPU Schneider Modicon M340, quel protocole utiliser ?",
    M, [
      "PROFINET, qui est interopérable nativement",
      "Modbus TCP ou OPC UA, qui sont des protocoles supportés par les deux constructeurs",
      "PROFIBUS DP",
      "Une liaison série RS-232"
    ], 1
  ),
  q(
    "Comment versionner correctement un projet TIA Portal sur Git ?",
    E, [
      "Versionner directement le fichier binaire .ap17 (suivi inefficace)",
      "Utiliser TIA Portal Multiuser Engineering pour le travail collaboratif, en exportant régulièrement les sources XML dans un dépôt Git pour le versionnage long terme",
      "Adopter SVN, mieux adapté aux fichiers binaires",
      "Renoncer au versionnage, peu pertinent pour TIA Portal"
    ], 1
  ),
  q(
    "En quoi WinCC Unified diffère-t-il de WinCC Comfort/Advanced ?",
    S, [
      "Il est exclusivement compatible avec les CPU S7-300",
      "Il repose sur une architecture web HTML5 native, supporte le scripting JavaScript et fonctionne sur plusieurs types de terminaux (PC, tablette, panel)",
      "Il ne supporte pas PROFINET",
      "Les deux solutions sont fonctionnellement identiques"
    ], 1
  ),
  q(
    "Vous suspectez qu'un bloc spécifique ralentit le cycle CPU d'une S7-1500. Quel outil utilisez-vous pour le confirmer ?",
    S, [
      "La Watch Table, pour observer les valeurs des variables",
      "L'outil Performance/Runtime Analysis disponible dans Online & Diagnostics, qui mesure le temps d'exécution par bloc",
      "Un oscilloscope branché sur les sorties",
      "WinCC, qui fournit des indicateurs de performance"
    ], 1
  ),
  q(
    "Quelle convention de nommage Siemens recommande-t-il pour un Function Block de contrôle moteur ?",
    M, [
      "FB_1, en suivant l'ordre de création",
      "ControlMotor_FB, en utilisant le suffixe _FB",
      "Un nom explicite type FB_MotorControl ou Mot_Ctrl, organisé dans une Global Library avec préfixe métier cohérent",
      "Aucune convention n'est nécessaire, le numéro suffit"
    ], 2
  ),
  // Schneider
  q(
    "Quel est l'outil de programmation actuel pour les automates Modicon Schneider ?",
    M, [
      "Unity Pro, dans sa version la plus récente",
      "EcoStruxure Control Expert, qui est la nouvelle dénomination de Unity Pro",
      "Schneider Studio",
      "PL7 Pro"
    ], 1
  ),
  q(
    "Quelle est la différence majeure entre les automates Modicon M340 et M580 ?",
    S, [
      "Les deux gammes sont fonctionnellement identiques",
      "Le M580 est un ePAC (Ethernet Process Automation Controller) qui intègre nativement un backplane Ethernet et propose une architecture redondante CPU/réseau, là où le M340 reste sur une architecture plus classique",
      "Le M340 est plus performant",
      "Le M580 appartient à une génération antérieure"
    ], 1
  ),
  q(
    "Le protocole EtherNet/IP (basé sur CIP) est-il supporté sur un Modicon M580 ?",
    M, [
      "Non, le M580 ne supporte que Modbus TCP",
      "Oui, EtherNet/IP est supporté nativement en complément de Modbus TCP",
      "Uniquement à travers une passerelle externe",
      "Uniquement en mode message explicite, pas en implicite"
    ], 1
  ),
  q(
    "Quelles mesures de cybersécurité applicative sont disponibles sur un automate Modicon M580 ?",
    E, [
      "Aucune, la sécurité est gérée exclusivement au niveau réseau",
      "Une certification Achilles niveau 2, un mot de passe projet, un Application Password qui sécurise le téléchargement et la modification du programme, ainsi qu'une gestion de profils utilisateurs configurables",
      "Ce type de sécurité est réservé aux automates Siemens",
      "C'est un sujet hors du périmètre des automates"
    ], 1
  ),
  // Cas pratiques
  q(
    "Vous arrivez chez un nouveau client qui vous remet un projet TIA Portal V14 sans documentation, à reprendre. Quelle est votre première étape ?",
    J, [
      "Migrer immédiatement vers la dernière version de TIA Portal pour bénéficier des dernières fonctionnalités",
      "Sauvegarder l'original, ouvrir le projet en lecture seule pour cartographier la structure (matériel, OB appelés, FB utilisés), puis seulement après échanger avec le client sur les évolutions",
      "Effacer les blocs non utilisés pour clarifier",
      "Refaire le programme à zéro selon les bonnes pratiques actuelles"
    ], 1, true
  ),
  q(
    "Un opérateur signale que la ligne ralentit en fin de cycle, sans raison apparente. Vous suspectez un cycle PLC qui s'allonge. Comment confirmez-vous votre hypothèse ?",
    M, [
      "En augmentant la fréquence d'échantillonnage des entrées",
      "En utilisant l'outil Cycle Time monitoring de la CPU et la Performance/Runtime Analysis dans TIA Portal pour identifier la durée de chaque bloc dans le cycle, puis en comparant aux valeurs de référence",
      "En remplaçant la CPU par une référence plus puissante",
      "En réduisant le nombre de variables suivies par le HMI"
    ], 1, true
  ),
  q(
    "Un client souhaite intégrer la lecture de 100 variables Modbus TCP issues d'un système tiers (compteurs d'énergie) dans son programme S7-1500 existant. Quelle est votre démarche la plus rationnelle ?",
    S, [
      "Programmer une boucle de polling avec un FB MB_CLIENT par variable",
      "Utiliser un FB MB_CLIENT unique avec un buffer de réception structuré, lecture groupée des registres consécutifs en une seule transaction, gestion des timeouts et reconnexion, et exposition des variables dans un DB symbolique pour le reste du programme",
      "Demander au client de remplacer ses compteurs par des compteurs PROFINET",
      "Passer par un OPC UA serveur tiers"
    ], 1, true
  ),
  q(
    "Un client vous demande de mettre en place une stratégie de versionnage Git pour ses projets TIA Portal, sur lesquels travaillent trois automaticiens en parallèle. Que proposez-vous concrètement ?",
    E, [
      "Un dépôt Git classique, chacun commitant son fichier .ap17",
      "Un déploiement de TIA Portal Multiuser Engineering pour le travail collaboratif synchrone (serveur de projet), couplé à un export automatisé des sources XML vers Git après chaque jalon (build du projet), avec convention de commits structurée par fonction modifiée",
      "Un système de fichiers partagé avec verrou manuel",
      "Renoncer au versionnage et passer par des sauvegardes journalières"
    ], 1, true
  )
];

// ─── Test 3 : Data Manager (26 questions) ────────────────────────────────
const dataManagerQuestions: SeedQuestion[] = [
  q(
    "Au sein de la suite AVEVA System Platform (anciennement Wonderware), quel module gère l'exécution des objets et leur communication ?",
    M, ["L'Application Server, accompagné de son IDE de développement", "L'Historian", "InTouch HMI", "Information Server"], 0
  ),
  q(
    "Dans quelle technologie AVEVA Historian stocke-t-il nativement les données de production ?",
    M, [
      "Une base PostgreSQL avec extension TimescaleDB",
      "Microsoft SQL Server, complété par un moteur de compression propriétaire pour les séries temporelles",
      "Une base Oracle",
      "Des fichiers CSV plats"
    ], 1
  ),
  q(
    "Quel protocole industriel moderne permet l'échange de données SCADA-automate en mode publication/abonnement sécurisé ?",
    M, ["Modbus RTU", "OPC UA, à travers son extension Pub/Sub", "Profibus DP", "HART"], 1
  ),
  q(
    "En quoi OPC UA se distingue-t-il principalement d'OPC Classic (DA) ?",
    J, [
      "OPC UA est uniquement plus rapide",
      "OPC UA est compatible multi-plateformes (sans dépendance à DCOM/COM), sécurisé nativement par TLS, et offre un modèle d'information riche",
      "OPC UA ne fonctionne qu'avec Modbus",
      "Aucune différence fonctionnelle"
    ], 1
  ),
  q(
    "Que représente un « datapoint » dans WinCC OA (Open Architecture) ?",
    M, [
      "Un point de mesure physique",
      "Une structure de données représentant un objet du process, dotée d'attributs configurables organisés selon une hiérarchie",
      "Un fichier d'export généré périodiquement",
      "Une connexion réseau active"
    ], 1
  ),
  q(
    "Pour stocker des données process à très haute cadence (plus de 1 000 points par seconde par tag) sur le long terme, quelle famille de SGBD est la plus adaptée ?",
    J, [
      "Un SQL Server relationnel classique",
      "Une base de données time-series spécialisée (InfluxDB, TimescaleDB, OSI PI ou AVEVA Historian)",
      "MongoDB",
      "MySQL"
    ], 1
  ),
  q(
    "Que définit le standard ISA-95 (S95) ?",
    M, [
      "Les protocoles de communication entre automates",
      "Une hiérarchie fonctionnelle structurée en cinq niveaux (du process au pilotage d'entreprise) et un modèle d'objets pour l'intégration MES-ERP",
      "Le code couleur des câbles industriels",
      "Les zones ATEX"
    ], 1
  ),
  q(
    "Quelle est la fonction principale d'un module Historian dans un SCADA ?",
    J, [
      "Afficher les synoptiques opérateur",
      "Acquérir, compresser et stocker des séries temporelles de tags, et permettre des requêtes historiques avec interpolation et agrégation",
      "Programmer les automates connectés",
      "Gérer les comptes utilisateurs"
    ], 1
  ),
  q(
    "Quelle est la bonne pratique pour interroger un Historian depuis Power BI dans un contexte de reporting industriel ?",
    S, [
      "Copier-coller manuellement les données à intervalle régulier",
      "Établir une connexion DirectQuery ou un Import via ODBC ou API REST, complétée par une couche de cache intermédiaire si le volume devient important",
      "Capture d'écran journalière des graphiques",
      "Envoi par e-mail de fichiers Excel exportés"
    ], 1
  ),
  q(
    "Quelle est la différence d'architecture entre WinCC V7 et WinCC Unified ?",
    M, [
      "Les deux produits sont architecturalement identiques",
      "WinCC V7 reste lié à l'environnement Windows et à ses runtimes propriétaires, alors que WinCC Unified adopte une architecture web native fondée sur HTML5",
      "Les deux produits sont open-source",
      "Seul WinCC V7 supporte les automates S7-200"
    ], 1
  ),
  q(
    "Comment interfacer un SCADA AVEVA avec un MES SAP en production ?",
    S, [
      "En passant par une couche Modbus directe",
      "À travers OPC UA, complété par un middleware d'intégration tel que SAP PCo (Plant Connectivity) ou AVEVA Connect",
      "Par échange de fichiers via FTP",
      "Par un cron envoyant des CSV chaque nuit"
    ], 1
  ),
  q(
    "Que désigne le concept de « golden record » en gestion de données industrielles ?",
    E, [
      "Un enregistrement particulièrement ancien dans la base",
      "La source unique de vérité consolidée d'une entité (équipement, produit, lot), qui résout les conflits entre les différents systèmes qui la décrivent",
      "Une copie chiffrée de sauvegarde",
      "Un record de performance opérationnelle"
    ], 1
  ),
  q(
    "Que garantit un envoi MQTT avec une QoS de niveau 2 ?",
    J, [
      "Le message est délivré au plus une fois",
      "Le message est délivré exactement une fois, grâce à un mécanisme d'accusés de réception à quatre échanges",
      "Aucune garantie n'est apportée",
      "Le message est chiffré en transit"
    ], 1
  ),
  q(
    "Comment se décompose l'indicateur OEE (Overall Equipment Effectiveness) ?",
    M, [
      "Coût, qualité et délai",
      "Disponibilité × Performance × Qualité",
      "Production, maintenance et stock",
      "Énergie, matière et main-d'œuvre"
    ], 1
  ),
  q(
    "Sur quelle base indexer un journal d'alarmes industriel à fort volume pour des requêtes efficaces ?",
    M, [
      "Sur le message d'alarme uniquement",
      "Sur l'horodatage, la source (tag ou équipement), et l'état d'acquittement",
      "Sur l'utilisateur actuellement connecté",
      "Sur le numéro de série de l'équipement émetteur"
    ], 1
  ),
  q(
    "À quoi sert le buffering local sur un edge device industriel ?",
    S, [
      "À augmenter la vitesse du process commandé",
      "À stocker localement les données lorsque la connexion vers le système central est perdue, puis à les retransmettre quand la liaison est rétablie (mécanisme de store and forward)",
      "À compresser des images de caméras de surveillance",
      "À sauvegarder le programme PLC"
    ], 1
  ),
  q(
    "Quelle architecture est aujourd'hui recommandée pour la construction d'un Data Lake industriel ?",
    S, [
      "Un dossier partagé Windows accessible à tous",
      "Une architecture en couches Bronze (données brutes), Silver (nettoyées), Gold (agrégées prêtes pour le métier), associée à une gouvernance et un catalogue de données",
      "Un unique fichier Excel mis à jour quotidiennement",
      "Une seule base MongoDB centralisant tout"
    ], 1
  ),
  q(
    "Comment configurer l'authentification d'un SCADA pour respecter les exigences IEC 62443 ?",
    S, [
      "Un mot de passe unique partagé par les opérateurs",
      "Une authentification individuelle nominative, des rôles et droits d'accès gérés par RBAC, une intégration à l'Active Directory et une journalisation persistante des actions",
      "Aucune authentification pour ne pas ralentir l'opérateur",
      "Une biométrie locale sans intégration centrale"
    ], 1
  ),
  q(
    "Que penser du protocole DDE (Dynamic Data Exchange) pour des systèmes industriels modernes ?",
    E, [
      "Il s'agit d'une norme moderne recommandée par les éditeurs",
      "Il s'agit d'un protocole Windows historique, déprécié et déconseillé : à éviter au profit d'OPC UA pour toute nouvelle conception",
      "C'est le successeur d'OPC UA",
      "Il est spécifique à l'environnement Siemens"
    ], 1
  ),
  q(
    "Que désigne une « tag » dans le contexte d'un Historian ?",
    J, [
      "Un commentaire libre attaché à un événement",
      "Une variable enregistrée dans le temps, avec son nom symbolique, son unité, son type et sa configuration de compression",
      "Un fichier image associé à un équipement",
      "Le nom d'un opérateur intervenant sur l'installation"
    ], 1
  ),
  q(
    "Quelle stack technique typique mettre en place pour générer un rapport de production hebdomadaire automatique croisant production, qualité et consommation d'énergie ?",
    S, [
      "Excel rempli manuellement chaque vendredi",
      "Un pipeline associant Historian comme source, une couche ETL ou SQL pour la consolidation, un outil de reporting (Power BI ou AVEVA Insight) pour la mise en forme, déclenché par un ordonnanceur et distribué par e-mail",
      "Capture d'écran régulière des synoptiques",
      "Un script cron utilisant grep sur les logs"
    ], 1
  ),
  q(
    "Que désigne un « mass parameter » dans WinCC OA ?",
    E, [
      "Une mesure de la masse physique d'un produit",
      "Un paramètre partagé entre plusieurs instances d'un même type de datapoint (datapoint type), modifié en un seul endroit et propagé automatiquement",
      "Un indicateur de surcharge CPU",
      "Un compteur du nombre de tags actifs"
    ], 1
  ),
  // Cas pratiques
  q(
    "Un client souhaite collecter 50 tags critiques de production à une fréquence d'acquisition de 100 ms (10 Hz), conservés pendant 5 ans pour traçabilité réglementaire. Quelle architecture proposez-vous ?",
    M, [
      "Un SCADA classique avec son historian intégré sans dimensionnement spécifique",
      "Une base de données time-series adaptée (OSI PI, AVEVA Historian, InfluxDB), correctement dimensionnée (volume estimé proche de 80 milliards de points, donc politique de compression et de rétention différenciée par âge de la donnée), avec sauvegarde régulière et stratégie de purge ou d'archivage à long terme",
      "Un export quotidien de fichiers CSV vers un disque réseau",
      "Une base relationnelle MySQL classique avec une table par tag"
    ], 1, true
  ),
  q(
    "Votre client constate que son reporting Power BI hebdomadaire met désormais quatre heures à se rafraîchir, contre 30 minutes il y a un an. Le volume de données a doublé sur la période. Quelle est votre démarche d'optimisation ?",
    S, [
      "Demander à l'éditeur de Power BI une licence plus performante",
      "Profiler les requêtes (durée, volumes), pré-agréger les données côté Historian (vues, tables de synthèse, ou Data Mart dédié), passer en Import avec planification de rafraîchissement incrémental, et indexer correctement les colonnes filtrées",
      "Réduire le périmètre fonctionnel du reporting de moitié",
      "Désactiver les filtres interactifs du tableau de bord"
    ], 1, true
  ),
  q(
    "Un client refuse OPC UA pour des raisons de politique sécurité interne et veut conserver Modbus TCP. Comment l'accompagnez-vous tout en améliorant son niveau de sécurité ?",
    S, [
      "Vous insistez et refusez la mission tant qu'OPC UA n'est pas accepté",
      "Vous validez avec lui les contraintes qu'il évoque, puis vous renforcez le déploiement Modbus TCP existant : segmentation réseau dédiée, allowlist IP source/destination, journalisation des accès, supervision par un IDS industriel (Claroty, Nozomi), et passerelle de protocole sécurisée pour les communications inter-zones",
      "Vous acceptez sans rien changer à l'architecture existante",
      "Vous proposez un passage immédiat à HTTPS, qui n'est pas pertinent ici"
    ], 1, true
  ),
  q(
    "Un industriel souhaite comparer la performance de deux lignes de production équivalentes pour identifier les facteurs de dérive. Quelles données minimales devez-vous collecter pour produire un OEE détaillé et exploitable ?",
    E, [
      "Uniquement les compteurs de pièces bonnes et rejetées",
      "Pour chaque ligne : temps total ouvert, arrêts subis (catégorisés pour la disponibilité), cadence théorique vs cadence réelle (performance), production conforme vs rebuts et retouches (qualité), tout horodaté pour pouvoir corréler aux événements (matières, opérateur, maintenance)",
      "Une simple courbe de production en quantité",
      "La consommation électrique de chaque ligne"
    ], 1, true
  )
];

// ─── Test 4 : IT industriel (26 questions) ───────────────────────────────
const itQuestions: SeedQuestion[] = [
  q(
    "Qu'est-ce que OpenShift ?",
    J, [
      "Un système d'exploitation Linux concurrent de Red Hat",
      "Une distribution Kubernetes pour l'entreprise éditée par Red Hat, qui intègre une chaîne CI/CD, des fonctionnalités de sécurité et des outils pour développeurs",
      "Un broker MQTT industriel",
      "Un fork de Docker"
    ], 1
  ),
  q(
    "Dans une architecture UNS (Unified Namespace) telle que théorisée par Walker Reynolds, quel composant central est typiquement employé ?",
    M, [
      "Un serveur OPC DA",
      "Un broker MQTT (Mosquitto, HiveMQ, EMQX), associé à une hiérarchie de topics alignée sur le modèle ISA-95",
      "Une base Oracle relationnelle",
      "Un SCADA Wonderware"
    ], 1
  ),
  q(
    "Quel est le principe fondamental d'un Unified Namespace ?",
    M, [
      "Centraliser tous les calculs dans le cloud",
      "Disposer d'une source unique de vérité en temps réel, organisée hiérarchiquement et navigable, avec un découplage total entre producteurs et consommateurs de données, dans une logique de cohérence à terme (eventually consistent)",
      "Remplacer progressivement les automates",
      "Supprimer les historians traditionnels"
    ], 1
  ),
  q(
    "Que désigne Sparkplug B ?",
    S, [
      "Un protocole concurrent destiné à remplacer MQTT",
      "Une spécification qui se superpose à MQTT pour standardiser la structure des topics, le format des payloads (sérialisation Protobuf) et la gestion des sessions (messages birth, death, state) dans les environnements industriels",
      "Un environnement de développement Java",
      "Un système de gestion d'alarmes"
    ], 1
  ),
  q(
    "Quel niveau de QoS MQTT privilégier pour des données de production critiques ne tolérant aucune perte ?",
    M, ["QoS 0", "QoS 1", "QoS 2, qui garantit une délivrance exactement une fois", "Les trois niveaux sont équivalents en pratique"], 2
  ),
  q(
    "À quoi correspond le DataOps appliqué à l'industrie ?",
    M, [
      "Une augmentation des effectifs en mode opération",
      "L'application des principes DevOps (intégration continue, tests automatisés, gestion de versions, observabilité, supervision) aux pipelines de données industrielles",
      "Une approche purement manuelle et artisanale du traitement des données",
      "L'utilisation systématique de fichiers Excel"
    ], 1
  ),
  q(
    "Que définit le modèle Purdue (Purdue Reference Model for CIM) pour la cybersécurité industrielle ?",
    M, [
      "Les niveaux d'isolement physique entre équipements",
      "Une segmentation en niveaux (0 = process, 1 = contrôle, 2 = supervision, 3 = MES, 3.5 = DMZ, 4 = entreprise, 5 = internet) et les règles de communication autorisées entre eux",
      "Une politique de chiffrement des communications",
      "Une convention de couleurs pour les câbles industriels"
    ], 1
  ),
  q(
    "Quelle est la norme de référence en matière de cybersécurité industrielle ?",
    S, ["ISO 27001, qui est généraliste IT", "IEC 62443, spécifiquement dédiée aux systèmes de contrôle industriels", "Le RGPD", "PCI-DSS"], 1
  ),
  q(
    "Qu'est-ce qu'un Pod dans Kubernetes ?",
    J, [
      "Une machine virtuelle complète",
      "La plus petite unité déployable, regroupant un ou plusieurs containers qui partagent le même espace réseau et de stockage",
      "Un cluster complet",
      "Un node physique"
    ], 1
  ),
  q(
    "Comment expose-t-on typiquement un service applicatif déployé dans OpenShift vers l'extérieur du cluster ?",
    J, [
      "Par un objet Deployment",
      "À travers une Route (spécifique à OpenShift) ou un Ingress (standard Kubernetes)",
      "Par un ConfigMap",
      "Par un Secret"
    ], 1
  ),
  q(
    "À quoi sert un broker MQTT déployé en mode cluster ?",
    S, [
      "À réduire le nombre de topics",
      "À assurer la haute disponibilité et la mise à l'échelle horizontale, en répartissant la charge entre plusieurs nœuds broker synchronisés",
      "À augmenter le bruit de fond du réseau",
      "À compresser les payloads"
    ], 1
  ),
  q(
    "Quel format de topic MQTT respecte une hiérarchie inspirée d'ISA-95 ?",
    M, [
      "data/temperature",
      "Enterprise/Site/Area/Line/Cell/DeviceTag (par exemple Dasolabs/Bruxelles/Assembly/Line1/Robot3/Temp)",
      "random_topic",
      "Une succession aléatoire sans hiérarchie"
    ], 1
  ),
  q(
    "Quel est le rôle d'un edge gateway dans une architecture IIoT ?",
    M, [
      "Remplacer fonctionnellement un automate",
      "Faire le pont entre les protocoles OT (Modbus, OPC UA, S7, EtherNet/IP) et les couches IT (MQTT, REST, Kafka), avec souvent une couche de pré-traitement local : filtrage, agrégation, store and forward",
      "Stocker l'ensemble des historiques de production",
      "Afficher les synoptiques de supervision"
    ], 1
  ),
  q(
    "À quoi sert une DMZ entre les niveaux 3 et 4 du modèle Purdue ?",
    J, [
      "À héberger un réseau Wi-Fi public",
      "À isoler les zones IT et OT en imposant l'usage de proxies, de jump hosts contrôlés et l'audit de tous les flux qui transitent entre les deux zones",
      "À stocker les sauvegardes",
      "À héberger des serveurs web publics"
    ], 1
  ),
  q(
    "Avec quels outils supervise-t-on typiquement un cluster OpenShift ?",
    J, [
      "Excel mis à jour quotidiennement",
      "L'ensemble Prometheus (collecte de métriques), Grafana (visualisation) et Alertmanager (gestion des alertes), intégrés par défaut dans OpenShift",
      "Un simple ping",
      "Telegram"
    ], 1
  ),
  q(
    "Que signifie l'approche GitOps appliquée à OpenShift ?",
    S, [
      "Le code est partagé sur clé USB",
      "L'état désiré du cluster est décrit par des manifests YAML versionnés dans Git, et un opérateur (ArgoCD, Flux) se charge de synchroniser en permanence l'état réel sur l'état désiré",
      "Il n'y a aucun versionnage des configurations",
      "Tout est déployé manuellement"
    ], 1
  ),
  q(
    "Comment authentifier solidement un client MQTT en production industrielle ?",
    S, [
      "Avec un identifiant et mot de passe en clair, sur un réseau public",
      "Avec une authentification mTLS reposant sur des certificats X.509 propres à chaque client, complétée par des règles d'ACL définissant les topics autorisés en publication et abonnement",
      "Sans authentification, pour préserver la simplicité",
      "Avec un simple filtrage d'adresses IP"
    ], 1
  ),
  q(
    "Quelle est la différence fondamentale entre Apache Kafka et MQTT ?",
    S, [
      "Les deux solutions sont fonctionnellement équivalentes",
      "Kafka est un système de streaming distribué qui garantit un ordre strict des messages par partition et une rétention longue durée, tandis que MQTT est un protocole de publication/abonnement léger optimisé pour la bande passante limitée et les clients embarqués",
      "Kafka est gratuit là où MQTT est payant",
      "MQTT est systématiquement plus rapide"
    ], 1
  ),
  q(
    "Que permet une architecture événementielle (event-driven) dans l'IIoT ?",
    S, [
      "D'introduire un fort couplage entre les systèmes",
      "De découpler producteurs et consommateurs de données, d'autoriser la mise à l'échelle indépendante de chaque composant, d'améliorer la résilience aux pannes partielles et de faciliter une évolution progressive des systèmes",
      "De remplacer les automates de terrain",
      "Uniquement de réduire les coûts"
    ], 1
  ),
  q(
    "Dans quelles situations un Pod OpenShift est-il typiquement redémarré automatiquement ?",
    M, [
      "Lors d'une mise à jour du firmware d'un automate distant",
      "En cas de crash applicatif, lors d'une mise à jour de l'image container, à la suite d'un scale-up ou scale-down, lors du drain d'un node pour maintenance, ou en cas de dépassement de la mémoire allouée (OOMKilled)",
      "Lors d'un changement de mot de passe utilisateur",
      "Jamais automatiquement"
    ], 1
  ),
  q(
    "Comment gérer correctement les secrets (mots de passe, certificats, clés API) dans un cluster OpenShift ?",
    E, [
      "En les plaçant dans un ConfigMap pour simplifier",
      "En utilisant des objets Secret de Kubernetes, idéalement complétés par un gestionnaire externe (HashiCorp Vault, Sealed Secrets, External Secrets Operator) qui assure le chiffrement au repos et la rotation des credentials",
      "En les écrivant en clair dans les manifests YAML versionnés sur Git",
      "En les stockant sur un disque externe partagé"
    ], 1
  ),
  q(
    "Quelle est la première étape concrète d'un projet de retrofit d'une usine existante vers une architecture UNS ?",
    E, [
      "Remplacer immédiatement l'ensemble des automates",
      "Cartographier exhaustivement les sources de données existantes (automates, SCADA, historians, MES, ERP), définir le modèle hiérarchique cible aligné sur ISA-95, et concevoir la convention de nommage des topics MQTT avant tout déploiement",
      "Souscrire à un service cloud",
      "Former tous les opérateurs aux nouveaux outils"
    ], 1
  ),
  // Cas pratiques
  q(
    "Un client manufacturing exploitant trois sites vous demande de proposer une roadmap de déploiement progressive vers un Unified Namespace. Quelle est votre approche ?",
    M, [
      "Déployer simultanément sur les trois sites pour gagner du temps",
      "Commencer par un site pilote représentatif, valider le modèle hiérarchique et la convention de topics, déployer la solution broker (avec haute disponibilité), connecter d'abord les données critiques (production, qualité), mesurer les bénéfices opérationnels, puis répliquer la démarche sur les deux autres sites en capitalisant sur le pilote",
      "Confier le projet à un intégrateur unique sans phase pilote",
      "Demander au siège de décider seul du modèle hiérarchique"
    ], 1, true
  ),
  q(
    "Le broker MQTT central de votre client tombe et redémarre quatre fois par jour depuis une semaine, sans logs explicites. Comment diagnostiquez-vous ?",
    S, [
      "Vous remplacez immédiatement le broker par un produit concurrent",
      "Vous analysez les métriques système (CPU, mémoire, descripteurs de fichiers, sockets ouverts), les logs broker en niveau debug, le trafic réseau (charge, clients connectés, fréquence des messages), corrélez avec d'éventuelles tâches planifiées et identifiez si la cause est applicative, système ou réseau",
      "Vous redémarrez quotidiennement le serveur de manière préventive",
      "Vous demandez au client de réduire le nombre de tags"
    ], 1, true
  ),
  q(
    "Vous devez justifier le choix d'OpenShift plutôt que Kubernetes vanilla pour un client industriel en contexte régulé. Quels sont vos arguments ?",
    S, [
      "OpenShift est plus rapide que Kubernetes",
      "OpenShift intègre par défaut une chaîne CI/CD (Pipelines, BuildConfigs), des fonctionnalités de sécurité durcies (SCC plus strict que PSP), une interface développeur, des opérateurs certifiés, un support entreprise Red Hat et un cycle de release maîtrisé — critères pertinents dans un environnement régulé et long terme malgré un coût de licence non négligeable",
      "Kubernetes vanilla ne fonctionne pas en production",
      "OpenShift est gratuit, contrairement à Kubernetes"
    ], 1, true
  ),
  q(
    "Un client souhaite connecter 200 automates distribués sur cinq sites via MQTT vers un broker centralisé. Comment structurez-vous les topics et les politiques d'ACL ?",
    E, [
      "Un topic unique global pour tous les automates",
      "Une hiérarchie type dasolabs/{site}/{area}/{cell}/{device}/{tag} strictement alignée ISA-95, des certificats X.509 par automate (mTLS), des ACL par site et par rôle (lecture seule pour les opérateurs locaux, publication restreinte aux devices propriétaires de leur sous-arborescence), un namespace de monitoring séparé pour les métriques broker, et un test régulier des règles d'ACL (audit trimestriel)",
      "Un identifiant et mot de passe partagés entre tous les automates",
      "Aucune politique d'ACL, le réseau privé suffit"
    ], 1, true
  )
];

// ─── Test 5 : Cybersécurité industrielle (24 questions) ──────────────────
const cybersecQuestions: SeedQuestion[] = [
  q(
    "À quel périmètre s'applique la norme IEC 62443 ?",
    J, [
      "Aux systèmes informatiques de bureau",
      "Aux systèmes industriels de contrôle (IACS — Industrial Automation and Control Systems)",
      "Aux réseaux télécoms",
      "Aux logiciels bureautiques"
    ], 1
  ),
  q(
    "Que désignent les concepts de zone et de conduit dans IEC 62443 ?",
    M, [
      "Un bâtiment physique et ses couloirs",
      "Un regroupement logique d'équipements partageant les mêmes exigences de sécurité (zone), et les canaux contrôlés de communication entre ces zones (conduit)",
      "Le câblage des bus de terrain",
      "Le simple câblage électrique"
    ], 1
  ),
  q(
    "Comment se découpe le modèle Purdue ?",
    J, [
      "En cinq niveaux numérotés de 1 à 5",
      "En sept niveaux, de 0 (process) à 5 (internet ou entreprise), avec un niveau intermédiaire 3.5 dédié à la DMZ entre OT et IT",
      "En niveaux A à E",
      "Il n'est pas standardisé"
    ], 1
  ),
  q(
    "À quoi correspondent les Security Levels (SL) dans IEC 62443 ?",
    S, [
      "Une simple échelle d'IP réseau",
      "Une échelle de quatre niveaux, allant de SL 1 (protection contre une violation accidentelle) à SL 4 (protection contre un attaquant disposant de moyens importants comme un acteur étatique)",
      "Le niveau de criticité d'un PLC",
      "Le rang hiérarchique d'un utilisateur"
    ], 1
  ),
  q(
    "Quelle bonne pratique appliquer aux mots de passe d'un PLC ?",
    J, [
      "Les désactiver pour faciliter les interventions",
      "Activer un mot de passe projet et un mot de passe applicatif (Application Password chez Schneider, SecurityProtect chez Siemens), prévoir un changement régulier, ne jamais le partager entre PLC",
      "Conserver le code par défaut fourni par le constructeur",
      "Utiliser un même mot de passe pour tous les PLC du parc"
    ], 1
  ),
  q(
    "En quoi le patch management diffère-t-il entre OT et IT ?",
    M, [
      "Les deux contextes appliquent le même rythme de patching",
      "En OT, les correctifs sont appliqués sur des fenêtres de maintenance planifiées, après validation préalable dans un environnement de test ; on arbitre entre la criticité du correctif et le risque d'indisponibilité, alors qu'en IT le patching peut être beaucoup plus agressif et automatisé",
      "On ne patche jamais en OT",
      "Le patching est entièrement automatique en OT"
    ], 1
  ),
  q(
    "Que prévoit la directive européenne NIS2 pour les entités essentielles et importantes ?",
    J, [
      "Des standards techniques sans obligation réelle",
      "Des obligations de mesures de cybersécurité, un reporting des incidents auprès des autorités compétentes, et une responsabilité juridique engagée des dirigeants pour les secteurs critiques, dont le manufacturing fait désormais partie",
      "Elle ne concerne que le secteur bancaire",
      "Elle est purement déclarative et sans obligation"
    ], 1
  ),
  q(
    "Qu'est-ce que l'attaque Stuxnet (2010) a démontré au monde industriel ?",
    M, [
      "L'existence de vulnérabilités sur des sites web critiques",
      "La capacité d'un malware sophistiqué à cibler spécifiquement des PLC Siemens S7-300 à travers une infection préalable de l'environnement de programmation Step 7, sans nécessiter de connexion directe à Internet",
      "L'importance de sécuriser les réseaux Wi-Fi",
      "Le manque général de chiffrement réseau"
    ], 1
  ),
  q(
    "Comment organiser un accès distant sécurisé pour un mainteneur travaillant à distance sur un site OT ?",
    S, [
      "Autoriser un RDP direct exposé sur Internet",
      "Mettre en place un VPN d'entrée, suivi d'un jump host avec authentification multi-facteurs, des sessions enregistrées pour traçabilité, des droits restreints au strict nécessaire et limités dans le temps (approche Privileged Access Management)",
      "Installer un TeamViewer permanent en arrière-plan",
      "Communiquer un mot de passe partagé à l'équipe maintenance"
    ], 1
  ),
  q(
    "Quel élément est central dans la segmentation d'un réseau industriel ?",
    M, [
      "Des switches manageables, ce qui suffit",
      "Des firewalls industriels (par exemple Tofino, Hirschmann EAGLE, Fortinet OT), associés à une segmentation par VLAN, des listes de contrôle d'accès (ACL) explicites et un IDS spécifique OT",
      "Un réseau Wi-Fi étendu",
      "L'absence de segmentation pour simplifier les flux"
    ], 1
  ),
  q(
    "Comment aborder la protection antivirus d'un poste opérateur SCADA sous Windows ?",
    S, [
      "Installer une solution antivirus IT standard avec mises à jour automatiques",
      "Privilégier une approche par whitelisting applicatif (AppLocker, McAfee Application Control), valider toute mise à jour antivirus en environnement de test, en accord avec les recommandations de l'éditeur SCADA, plutôt que de se reposer sur des signatures fréquemment mises à jour qui peuvent perturber le runtime",
      "Désactiver toute protection pour ne pas affecter les performances",
      "Migrer obligatoirement le poste sous Linux"
    ], 1
  ),
  q(
    "Comment organiser les sauvegardes des programmes PLC pour une installation industrielle ?",
    M, [
      "Ce n'est pas une priorité",
      "Sauvegarder à chaque modification, puis cycliquement, sous forme versionnée, conserver une copie hors ligne en plus d'une copie sur le réseau interne, et tester périodiquement la procédure de restauration sur banc",
      "Conserver les programmes uniquement sur le PLC lui-même",
      "Une seule sauvegarde initiale est suffisante"
    ], 1
  ),
  q(
    "À quoi sert un IDS spécifique OT (Claroty, Nozomi, Dragos) ?",
    S, [
      "À jouer le rôle d'antivirus pour les PLC",
      "À détecter des anomalies par analyse passive du trafic industriel (Modbus, S7, EtherNet/IP, OPC UA), à construire automatiquement une baseline du fonctionnement normal du process et à alerter sur les déviations",
      "À filtrer les spams sur les messageries internes",
      "À jouer le rôle d'un firewall classique"
    ], 1
  ),
  q(
    "Que stipule le principe du moindre privilège (least privilege) en OT ?",
    J, [
      "Tout utilisateur dispose des droits d'administration",
      "Chaque utilisateur reçoit uniquement les permissions strictement nécessaires à l'exercice de sa fonction, et rien de plus",
      "Tous les utilisateurs sont en lecture seule",
      "Personne n'est autorisé à se connecter"
    ], 1
  ),
  q(
    "Comment gérer les comptes utilisateurs d'un SCADA en vue d'un audit de conformité ?",
    M, [
      "Avec des comptes génériques partagés pour simplifier",
      "Avec des comptes individuels nominatifs intégrés à l'Active Directory, des règles MFA pour les accès distants ou privilégiés, une journalisation persistante des actions, et une procédure de désactivation au départ d'un collaborateur",
      "En affichant le mot de passe sur le poste opérateur",
      "En supprimant toute authentification"
    ], 1
  ),
  q(
    "Quelle cible visait l'attaque TRITON/TRISIS (2017) ?",
    S, [
      "Des centrales nucléaires d'Europe de l'Est",
      "Un système instrumenté de sécurité (SIS) Triconex de Schneider Electric, démontrant qu'un attaquant peut désactiver les fonctions de sécurité avant un sabotage du process",
      "Des banques",
      "Des objets connectés grand public"
    ], 1
  ),
  q(
    "Quelle est la démarche de durcissement (hardening) d'un serveur SCADA sous Windows ?",
    M, [
      "Aucun changement n'est nécessaire par rapport au paramétrage par défaut",
      "Désactiver les services et protocoles inutiles, restreindre l'usage des ports USB, activer un firewall local, retirer les tâches planifiées non nécessaires, limiter les comptes locaux, en s'appuyant sur les benchmarks reconnus (DISA STIG, CIS Benchmark Windows)",
      "Activer tous les services pour ne rien casser",
      "Le hardening provoque inévitablement une perte de fonctionnalités"
    ], 1
  ),
  q(
    "Comment construit-on un inventaire d'actifs OT (asset inventory) ?",
    E, [
      "En tenant un cahier papier manuel",
      "Avec un outil de découverte passive spécialisé OT (Claroty, Nozomi, Tenable.ot), qui identifie les équipements, leur firmware, les vulnérabilités connues (CVE) qui les affectent, et leur exposition relative",
      "En s'appuyant sur l'inventaire IT, qui couvre déjà ce besoin",
      "L'inventaire n'a pas de pertinence en OT"
    ], 1
  ),
  q(
    "En quoi la réponse à incident en OT diffère-t-elle de la réponse en IT ?",
    E, [
      "Les deux processus sont totalement identiques",
      "En OT, la continuité de production prime souvent sur la confidentialité ; l'isolation physique est plus complexe à mettre en œuvre ; une expertise spécifique en process safety est nécessaire ; et la coordination avec les exploitants opérationnels doit être étroite",
      "Il faut couper toutes les liaisons immédiatement, sans réflexion",
      "Aucune procédure formelle n'est nécessaire en OT"
    ], 1
  ),
  q(
    "Quelle méthodologie utiliser pour le threat modeling d'un système OT ?",
    S, [
      "Le sujet est inutile en OT",
      "La méthodologie STRIDE (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege), adaptée au contexte OT, croisée avec des analyses HAZOP ou FMEA pour intégrer la dimension safety",
      "Un audit financier suffit",
      "Une certification ISO 9001"
    ], 1
  ),
  // Cas pratiques
  q(
    "Vous arrivez chez un nouveau client qui n'a aucune politique de sécurité OT et vous demande où commencer. Quelle est votre première étape ?",
    J, [
      "Acheter immédiatement des firewalls industriels",
      "Réaliser une cartographie de l'existant (architecture réseau OT/IT, équipements, flux, vulnérabilités évidentes), classifier les actifs critiques selon leur impact sur la sécurité et la production, et définir une feuille de route priorisée avec le client (quick wins puis chantiers structurants)",
      "Lancer un audit ISO 27001 sans préambule",
      "Migrer tous les équipements en DMZ"
    ], 1, true
  ),
  q(
    "Un audit de sécurité chez votre client révèle que tous les opérateurs partagent un même compte sur le SCADA. Comment organisez-vous la migration vers des comptes individuels sans interrompre la production ?",
    M, [
      "Forcer la migration en une fois, le jour même",
      "Préparer la nouvelle structure d'identités dans l'Active Directory, créer un compte par opérateur en parallèle, former l'équipe sur la nouvelle procédure de connexion, planifier la bascule à froid pendant une fenêtre d'arrêt prévue, et désactiver le compte partagé seulement après une période d'observation",
      "Imposer un nouveau mot de passe complexe sur le compte partagé existant",
      "Conserver le compte partagé tout en ajoutant des comptes individuels (équivalent à ne rien faire)"
    ], 1, true
  ),
  q(
    "Une vulnérabilité critique (CVE de score 9.8) est publiée sur le firmware d'une CPU S7-1500 en exploitation chez votre client. Le patch impose un redémarrage de la CPU. Comment décidez-vous et planifiez-vous ?",
    S, [
      "Patcher immédiatement en production sans tests préalables",
      "Évaluer le risque concret d'exposition (chemin d'attaque réellement disponible), tester le patch sur un banc identique, planifier la fenêtre d'application avec l'exploitant (idéalement lors d'un arrêt prévu), préparer une procédure de rollback si le patch pose problème, et confirmer la disponibilité d'un support constructeur pendant l'opération",
      "Ne rien faire et attendre la prochaine version majeure du firmware",
      "Déconnecter immédiatement la CPU du réseau"
    ], 1, true
  ),
  q(
    "Votre client a un réseau plat unique mélangeant OT et IT et souhaite segmenter conformément au modèle Purdue. Comment menez-vous ce chantier ?",
    E, [
      "Tirer un nouveau câblage à neuf pour tout l'atelier",
      "Procéder par étapes : cartographie complète des flux existants, définition des zones cibles selon Purdue, design des firewalls et VLAN, validation des règles en mode logging avant blocage actif, mise en place de la DMZ avec proxies/jump hosts, formation des équipes, bascule progressive avec surveillance renforcée pour identifier les faux positifs et ajuster",
      "Déployer un firewall périmétrique unique et estimer que la segmentation est faite",
      "Demander au client de remplacer tous ses automates"
    ], 1, true
  )
];

// ─── Export consolidé ────────────────────────────────────────────────────

export const SEED_TESTS: SeedTest[] = [
  {
    domain: "ELEC_INDUSTRIAL",
    title: "Électricité industrielle",
    description:
      "Évaluation des connaissances et de la pratique en électricité industrielle : normes (IEC 60204, IEC 61439, ISO 13849, ATEX, NF C 18-510), schémas, régimes de neutre, moteurs et variateurs, capteurs, mises en situation chantier.",
    questions: electricalQuestions
  },
  {
    domain: "PLC",
    title: "PLC Siemens et Schneider — bonnes pratiques",
    description:
      "Évaluation TIA Portal (S7-1200/1500, OB, FB/FC, langages LAD/FBD/STL/SCL, F-PLC, WinCC Unified) et Modicon Schneider (M340/M580, EcoStruxure Control Expert, EtherNet/IP), avec mises en situation de chantier réel.",
    questions: plcQuestions
  },
  {
    domain: "DATA_MANAGER",
    title: "Data Manager — SCADA, Historian, BDD, Reporting",
    description:
      "Évaluation autour de AVEVA System Platform et Historian, WinCC OA/V7/Unified, protocoles (OPC UA, MQTT), modélisation (ISA-95, Data Lake), bases de données time-series et reporting industriel (Power BI, AVEVA Insight).",
    questions: dataManagerQuestions
  },
  {
    domain: "IT_INDUSTRIAL",
    title: "IT industriel — OpenShift, MQTT, UNS, DataOps",
    description:
      "Évaluation des compétences en OT/IT convergence : OpenShift et Kubernetes, brokers MQTT, Sparkplug B, Unified Namespace (Walker Reynolds), DataOps, edge computing, GitOps, observabilité.",
    questions: itQuestions
  },
  {
    domain: "CYBERSEC_INDUSTRIAL",
    title: "Cybersécurité industrielle — IEC 62443",
    description:
      "Évaluation cybersécurité OT : norme IEC 62443 (zones, conduits, SL 1-4), modèle Purdue, segmentation, durcissement Windows industriel, asset inventory, threat modeling STRIDE croisé HAZOP, NIS2, retour d'expérience Stuxnet et TRITON.",
    questions: cybersecQuestions
  }
];
