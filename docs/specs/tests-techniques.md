# Spec : Tests techniques candidats / consultants Dasohub (v3)

## Vue d'ensemble

Cinq questionnaires d'évaluation technique destinés aux candidats du vivier consultance et aux consultants internes. Chaque question est étiquetée selon quatre niveaux (Junior, Médior, Senior, Expert) pour permettre une cartographie fine des compétences. Certaines questions sont des **mises en situation** : on présente au répondant un cas concret de chantier et on lui demande sa démarche.

Le score reste invisible pour le répondant. Sur la fiche profil, l'admin voit le score global ainsi qu'un détail ventilé par niveau de difficulté, ce qui permet de qualifier rapidement le profil (« médior confirmé, sénior à conforter »).

| # | Test | Cible profil | Questions | dont mises en situation |
|---|------|--------------|-----------|--------------------------|
| 1 | Électricité industrielle | Électricien-automaticien, intégrateur | 24 | 4 |
| 2 | PLC (Siemens + Schneider) | Automaticien process | 30 | 4 |
| 3 | Data Manager (SCADA, Historian, BDD) | Architecte data industriel | 26 | 4 |
| 4 | IT industriel (OpenShift, MQTT, UNS, DataOps) | OT/IT convergence | 26 | 4 |
| 5 | Cybersécurité industrielle (IEC 62443) | Spécialiste sécurité OT | 24 | 4 |

QCM à choix unique, un point par bonne réponse. Pas de minuteur strict mais le lien magique d'accès au test reste valide 14 jours et la soumission est unique.

---

## TEST 1 — Électricité industrielle (24 questions)

### Connaissances

**1.** [JUNIOR] Selon la norme IEC 60204-1, quelle est la couleur réglementaire d'un conducteur de protection (PE) ?

A) Bleu clair  
B) **Vert/jaune** ✓  
C) Marron  
D) Noir

**2.** [JUNIOR] Que signifie l'indice de protection IP54 d'une armoire électrique ?

A) Protection totale contre les poussières et résistance à l'immersion temporaire  
B) **Protection partielle contre les poussières et contre les projections d'eau dans toutes les directions** ✓  
C) Protection totale contre les poussières et contre les jets d'eau puissants  
D) Protection partielle contre les poussières et contre les chutes verticales d'eau

**3.** [MÉDIOR] Dans une installation en régime de neutre TN-S, comment sont organisés le neutre (N) et le conducteur de protection (PE) ?

A) Ils sont confondus du transformateur jusqu'à l'utilisation  
B) **Ils sont distincts depuis le point de mise à la terre principal** ✓  
C) Ils sont reliés par un éclateur en cas de défaut  
D) Ils ne sont reliés qu'au tableau général

**4.** [MÉDIOR] Pour quelle application est typiquement utilisée la courbe de déclenchement B (3 à 5 fois In) d'un disjoncteur magnéto-thermique ?

A) **L'éclairage et les circuits résistifs domestiques** ✓  
B) Le démarrage de moteurs asynchrones  
C) La protection des transformateurs  
D) Les postes de soudage

**5.** [MÉDIOR] Lors d'un démarrage étoile-triangle d'un moteur asynchrone triphasé, quel est le rapport entre le couple disponible en étoile et le couple disponible en triangle ?

A) 1/√3  
B) **Le couple en étoile vaut un tiers du couple en triangle** ✓  
C) Deux tiers  
D) √3

**6.** [SENIOR] Que désigne le Performance Level (PL) défini par la norme EN ISO 13849-1 ?

A) Une protection contre les courts-circuits  
B) **Une mesure de la fiabilité d'une fonction de sécurité, échelonnée de PL a (le plus faible) à PL e (le plus élevé)** ✓  
C) Un niveau de protection contre la foudre  
D) Une tension nominale d'isolation

**7.** [EXPERT] En zone ATEX 1, à quelle fréquence doit-on s'attendre à la présence d'une atmosphère explosive gazeuse ?

A) De manière permanente, ce qui correspondrait à la zone 0  
B) **De manière occasionnelle, dans le cadre du fonctionnement normal de l'installation** ✓  
C) De manière rare et brève, ce qui correspondrait à la zone 2  
D) Jamais

**8.** [MÉDIOR] Comment un variateur de fréquence (VFD) contrôle-t-il la vitesse d'un moteur asynchrone ?

A) En modifiant la résistance du rotor  
B) En agissant sur le couple résistant de la charge  
C) **En faisant varier la fréquence d'alimentation et la tension de manière proportionnelle (loi U/f)** ✓  
D) En modifiant uniquement le glissement

**9.** [SENIOR] Quand parle-t-on de sélectivité totale entre deux disjoncteurs montés en cascade ?

A) Lorsque le disjoncteur amont s'ouvre quel que soit le défaut  
B) **Lorsque, pour tout défaut survenu en aval, seul le disjoncteur aval s'ouvre, sans solliciter l'amont** ✓  
C) Lorsque les deux disjoncteurs s'ouvrent simultanément  
D) Lorsqu'aucun des deux ne s'ouvre tant qu'une protection externe n'a pas agi

**10.** [JUNIOR] Sur un capteur PNP à trois fils, à quoi correspond habituellement le fil noir ?

A) L'alimentation positive (+24 V DC)  
B) Le commun (0 V)  
C) **La sortie du signal de détection** ✓  
D) Le blindage

**11.** [MÉDIOR] [?] Quelle est la section minimale d'un conducteur en cuivre pour transporter un courant de 16 A en pose dans un chemin de câbles, dans des conditions courantes ?

A) 1,5 mm²  
B) **2,5 mm²** ✓  
C) 4 mm²  
D) 6 mm²

> *À valider selon les pratiques belges (RGIE) et le facteur de regroupement.*

**12.** [EXPERT] Selon la norme IEC 61439, que désigne un tableau « AVCP » (anciennement TTA — Type Tested Assembly) ?

A) Un tableau testé en situation réelle sur le site d'utilisation  
B) Un tableau dont chaque composant a été testé individuellement  
C) **Un tableau dont le type a été certifié après essais complets en laboratoire selon la norme** ✓  
D) Un tableau monté de manière provisoire pour la phase de prototypage

**13.** [SENIOR] À quoi correspond le régime de neutre TT ?

A) Le neutre du transformateur est isolé et les masses sont mises à la terre  
B) **Le neutre du transformateur est mis à la terre côté distribution, et les masses des utilisations sont reliées à une prise de terre distincte** ✓  
C) Le neutre et les masses sont confondus sur tout le réseau  
D) Aucune mise à la terre n'est prévue

**14.** [SENIOR] Quelle puissance est dissipée par un transformateur de courant débitant 5 A au secondaire dans une charge résistive de 1 Ω ?

A) 5 W  
B) **25 W (P = R × I²)** ✓  
C) 1 W  
D) La valeur dépend de la fréquence

**15.** [JUNIOR] Sur un schéma de commande conforme à la CEI 81346, que désigne la paire de bornes « 13-14 » d'un contacteur ?

A) **Un contact auxiliaire normalement ouvert** ✓  
B) Un contact auxiliaire normalement fermé  
C) Un contact principal de puissance  
D) Une borne de raccordement de la bobine

**16.** [MÉDIOR] Quel est le rôle d'un sectionneur porte-fusibles dans une armoire électrique ?

A) Mesurer le courant qui traverse le circuit  
B) **Permettre l'isolement visible du circuit et assurer la protection contre les courts-circuits par les fusibles** ✓  
C) Filtrer les courants harmoniques  
D) Réduire la tension nominale d'utilisation

**17.** [JUNIOR] Quel instrument utilise-t-on pour mesurer la résistance d'une prise de terre ?

A) Un mégohmmètre  
B) **Un telluromètre, également appelé contrôleur de terre** ✓  
C) Une pince ampèremétrique  
D) Un oscilloscope

**18.** [SENIOR] Comment améliore-t-on le facteur de puissance d'une installation alimentant principalement des charges inductives ?

A) En ajoutant une self d'arrêt en amont  
B) **En installant une batterie de condensateurs de compensation** ✓  
C) En augmentant la tension d'alimentation  
D) En réduisant la fréquence

**19.** [JUNIOR] Quelle tension nominale est recommandée par IEC 60204-1 pour les circuits de commande ?

A) 12 V AC  
B) **24 V DC ou AC** ✓  
C) 48 V DC  
D) 230 V AC

**20.** [MÉDIOR] Vous disposez d'un moteur asynchrone triphasé portant la plaque signalétique « 400 V / 690 V ». Vous l'alimentez sur un réseau triphasé 400 V. Quel couplage adopter ?

A) Étoile  
B) **Triangle** ✓  
C) Étoile au démarrage puis triangle en régime établi  
D) Zigzag

### Mises en situation

**21.** [CAS PRATIQUE — JUNIOR] Vous intervenez sur une armoire pour remplacer un contacteur défectueux. Quelle est la première action à entreprendre avant toute autre opération ?

A) Mesurer le courant consommé pour confirmer la panne  
B) **Consigner l'installation : séparer, condamner, identifier, vérifier l'absence de tension (procédure VAT selon NF C 18-510)** ✓  
C) Démonter directement le contacteur après avoir averti l'opérateur  
D) Couper uniquement le disjoncteur du circuit concerné

**22.** [CAS PRATIQUE — MÉDIOR] Un client vous appelle : un moteur asynchrone triphasé déclenche systématiquement sa protection thermique au démarrage, même à vide. À froid, le moteur démarre normalement. Quelle est la piste la plus probable à investiguer ?

A) **Un défaut sur une phase d'alimentation (déséquilibre de tension entre phases ou perte d'une phase) qui surcharge les deux phases restantes** ✓  
B) Un mauvais réglage de la courbe du disjoncteur, à passer en courbe D  
C) Un problème de mise à la terre du châssis  
D) Une simple usure mécanique des roulements

**23.** [CAS PRATIQUE — SENIOR] Vous concevez une armoire de 800 W de déperdition thermique, installée dans un local non climatisé pouvant atteindre 40 °C en été, avec un indice de protection IP 54 imposé par le client. Quelle est l'approche la plus adaptée pour le traitement thermique ?

A) Aucun équipement de refroidissement n'est nécessaire à cette puissance  
B) Une ventilation forcée avec entrée et sortie d'air par grilles  
C) **Un climatiseur d'armoire ou un échangeur air-eau, car l'IP 54 interdit toute ventilation directe à l'air ambiant** ✓  
D) Des ouvertures naturelles en haut et en bas de l'armoire

**24.** [CAS PRATIQUE — EXPERT] Un capteur inductif PNP installé sur une ligne de production donne un signal erratique depuis le matin (présence détectée puis perdue de manière aléatoire). La tension d'alimentation 24 V est conforme et stable. Quelle est votre démarche de diagnostic ?

A) Remplacer directement le capteur, car c'est la cause la plus probable  
B) Mettre l'installation à l'arrêt pour intervenir en sécurité  
C) **Vérifier d'abord les paramètres physiques (distance de détection, alignement mécanique, présence de copeaux métalliques), puis le câblage (continuité, blindage), puis les perturbations électromagnétiques voisines (variateurs, contacteurs) avant de conclure à un défaut du capteur** ✓  
D) Changer la marque du capteur pour un type capacitif

---

## TEST 2 — PLC Siemens et Schneider (30 questions)

### Connaissances Siemens (TIA Portal + S7)

**1.** [JUNIOR] Quel bloc d'organisation (OB) est exécuté au démarrage d'une CPU S7-1500 ?

A) OB1  
B) OB35  
C) **OB100, dédié à la phase de démarrage (Startup)** ✓  
D) OB80

**2.** [JUNIOR] À quoi correspond le bloc OB1 dans la structure d'un programme S7 ?

A) Au programme de diagnostic du matériel  
B) **Au programme cyclique principal, exécuté en boucle par la CPU** ✓  
C) À une routine d'interruption matérielle  
D) À la gestion des erreurs

**3.** [MÉDIOR] Quelle est la différence architecturale principale entre les gammes S7-1200 et S7-1500 ?

A) Le S7-1200 ne supporte que PROFIBUS, contrairement au S7-1500  
B) **Le S7-1500 dispose d'une mémoire et de performances significativement supérieures et d'une intégration plus poussée avec TIA Portal** ✓  
C) Seul le S7-1200 propose une variante Safety  
D) Il n'existe pas de différence majeure

**4.** [MÉDIOR] Quelle caractéristique distingue un Function Block (FB) d'un Function (FC) ?

A) Le FB n'accepte pas de paramètres d'entrée  
B) Le FB ne peut être appelé qu'en mode interruption  
C) **Le FB dispose d'un instance DB qui conserve les valeurs de ses variables internes entre deux appels successifs** ✓  
D) Le FB doit obligatoirement être écrit en SCL

**5.** [MÉDIOR] Pour écrire des algorithmes mathématiques complexes (régulation, calculs vectoriels), quel langage est recommandé en S7 ?

A) LAD (Ladder)  
B) FBD (Function Block Diagram)  
C) STL (Statement List)  
D) **SCL (Structured Control Language), dont la syntaxe haut niveau facilite la lecture et la maintenance** ✓

**6.** [JUNIOR] Que contient une « Tag table » dans TIA Portal ?

A) Une liste de temporisations à intervalle  
B) **Une liste de variables symboliques associées à leurs adresses absolues (I, Q, M, DB)** ✓  
C) Une page de visualisation HMI  
D) Les journaux d'événements de la CPU

**7.** [SENIOR] À quoi sert le bloc OB35 sur les anciennes CPU S7-300 et S7-400 ?

A) Au programme cyclique principal  
B) **À l'exécution d'une routine cyclique à intervalle de temps configurable (interruption temporelle)** ✓  
C) À la gestion des interruptions matérielles  
D) Au diagnostic système

**8.** [JUNIOR] Que représente le type de données TIME, noté avec le préfixe T#, en S7 ?

A) Une date au format ISO 8601  
B) **Une durée codée sur 32 bits avec une résolution d'une milliseconde** ✓  
C) Un timestamp Unix  
D) Une heure de la journée

**9.** [SENIOR] Comment configure-t-on la fonction Trace pour analyser le comportement d'une variable en temps réel dans TIA Portal ?

A) En programmant un OB d'erreur dédié  
B) **Dans Online & Diagnostics, en créant une configuration Trace avec un déclencheur (trigger) et la liste des variables à enregistrer** ✓  
C) En appelant un FB Trace mis à disposition par Siemens  
D) Cela requiert obligatoirement une licence WinCC

**10.** [MÉDIOR] Quelle est la bonne pratique de structuration d'un programme S7 complexe ?

A) Tout placer dans OB1 pour avoir une vue d'ensemble immédiate  
B) **Découper en Function Blocks réutilisables, organisés hiérarchiquement et appelés depuis OB1** ✓  
C) Utiliser exclusivement le langage STL pour la rapidité d'exécution  
D) Éviter au maximum l'usage de blocs de données

**11.** [JUNIOR] Sur quelle infrastructure repose le protocole PROFINET ?

A) Une liaison série RS-485  
B) **Un réseau Ethernet industriel TCP/IP, complété par des extensions temps réel RT et IRT** ✓  
C) Modbus over TCP  
D) Le bus CAN

**12.** [JUNIOR] À quoi sert un bloc de données (DB) en S7 ?

A) À définir la configuration matérielle  
B) **À stocker des données structurées : variables, tableaux, structures réutilisables** ✓  
C) À exécuter du code de manière interrompue  
D) À paramétrer les liaisons de communication

**13.** [SENIOR] Sur une CPU S7-1500 F (Safety), où doivent être codées les fonctions de sécurité ?

A) Indifféremment dans n'importe quel FB du programme standard  
B) **Dans des F-FB ou F-FC dédiés, exécutés au sein du runtime F (séparé du runtime standard)** ✓  
C) En langage STL uniquement  
D) Côté WinCC, dans une couche logicielle de supervision

**14.** [SENIOR] Vous devez faire évoluer un projet client de TIA Portal V15.1 vers V17. Quelle démarche est recommandée ?

A) Effectuer la mise à niveau directement en production pour limiter les coûts  
B) **Cloner le projet, le tester sur banc d'essai ou avec PLCSIM Advanced, valider l'ensemble des fonctions avant déploiement sur site** ✓  
C) Attendre la révision suivante de TIA Portal  
D) Réécrire le programme à zéro pour profiter des nouveautés

**15.** [MÉDIOR] Comment partager efficacement du code S7 entre plusieurs projets différents ?

A) Par copier-coller successifs entre les projets  
B) **En centralisant les blocs dans une Global Library TIA, avec gestion de version intégrée** ✓  
C) En exportant les blocs en STL avant de les réimporter  
D) En recodant les blocs à chaque projet pour éviter les dérives

**16.** [JUNIOR] Quelle taille mémoire occupe la déclaration `ARRAY[1..10] OF REAL` ?

A) 10 octets  
B) 20 octets  
C) **40 octets, puisqu'un REAL occupe 4 octets** ✓  
D) Cela dépend de la CPU utilisée

**17.** [MÉDIOR] Quelle est la fonction de l'instruction `MOVE_BLK` en SCL ?

A) Copier une seule valeur d'une variable à une autre  
B) **Copier un bloc d'éléments d'un tableau source vers un tableau destination** ✓  
C) Déplacer dynamiquement un Function Block dans la mémoire  
D) Compresser les données stockées en DB

**18.** [MÉDIOR] Pour faire communiquer une CPU S7-1500 avec une CPU Schneider Modicon M340, quel protocole utiliser ?

A) PROFINET, qui est interopérable nativement  
B) **Modbus TCP ou OPC UA, qui sont des protocoles supportés par les deux constructeurs** ✓  
C) PROFIBUS DP  
D) Une liaison série RS-232

**19.** [EXPERT] Comment versionner correctement un projet TIA Portal sur Git ?

A) Versionner directement le fichier binaire `.ap17` (suivi inefficace, peu de différence visible entre commits)  
B) **Utiliser TIA Portal Multiuser Engineering pour le travail collaboratif, en exportant régulièrement les sources XML dans un dépôt Git pour le versionnage long terme** ✓  
C) Adopter SVN, mieux adapté aux fichiers binaires  
D) Renoncer au versionnage, peu pertinent pour TIA Portal

**20.** [SENIOR] En quoi WinCC Unified diffère-t-il de WinCC Comfort/Advanced ?

A) Il est exclusivement compatible avec les CPU S7-300  
B) **Il repose sur une architecture web HTML5 native, supporte le scripting JavaScript et fonctionne sur plusieurs types de terminaux (PC, tablette, panel)** ✓  
C) Il ne supporte pas PROFINET  
D) Les deux solutions sont fonctionnellement identiques

**21.** [SENIOR] Vous suspectez qu'un bloc spécifique ralentit le cycle CPU d'une S7-1500. Quel outil utilisez-vous pour le confirmer ?

A) La Watch Table, pour observer les valeurs des variables  
B) **L'outil Performance/Runtime Analysis disponible dans Online & Diagnostics, qui mesure le temps d'exécution par bloc** ✓  
C) Un oscilloscope branché sur les sorties  
D) WinCC, qui fournit des indicateurs de performance

**22.** [MÉDIOR] Quelle convention de nommage Siemens recommande-t-il pour un Function Block de contrôle moteur ?

A) FB_1, en suivant l'ordre de création  
B) ControlMotor_FB, en utilisant le suffixe `_FB`  
C) **Un nom explicite type FB_MotorControl ou Mot_Ctrl, organisé dans une Global Library avec préfixe métier cohérent** ✓  
D) Aucune convention n'est nécessaire, le numéro suffit

### Connaissances Schneider Electric

**23.** [MÉDIOR] Quel est l'outil de programmation actuel pour les automates Modicon Schneider ?

A) Unity Pro, dans sa version la plus récente  
B) **EcoStruxure Control Expert, qui est la nouvelle dénomination de Unity Pro** ✓  
C) Schneider Studio  
D) PL7 Pro

**24.** [SENIOR] Quelle est la différence majeure entre les automates Modicon M340 et M580 ?

A) Les deux gammes sont fonctionnellement identiques  
B) **Le M580 est un ePAC (Ethernet Process Automation Controller) qui intègre nativement un backplane Ethernet et propose une architecture redondante CPU/réseau, là où le M340 reste sur une architecture plus classique** ✓  
C) Le M340 est plus performant  
D) Le M580 appartient à une génération antérieure

**25.** [MÉDIOR] Le protocole EtherNet/IP (basé sur CIP) est-il supporté sur un Modicon M580 ?

A) Non, le M580 ne supporte que Modbus TCP  
B) **Oui, EtherNet/IP est supporté nativement en complément de Modbus TCP** ✓  
C) Uniquement à travers une passerelle externe  
D) Uniquement en mode message explicite, pas en implicite

**26.** [EXPERT] Quelles mesures de cybersécurité applicative sont disponibles sur un automate Modicon M580 ?

A) Aucune, la sécurité est gérée exclusivement au niveau réseau  
B) **Une certification Achilles niveau 2, un mot de passe projet, un Application Password qui sécurise le téléchargement et la modification du programme, ainsi qu'une gestion de profils utilisateurs configurables** ✓  
C) Ce type de sécurité est réservé aux automates Siemens  
D) C'est un sujet hors du périmètre des automates

### Mises en situation

**27.** [CAS PRATIQUE — JUNIOR] Vous arrivez chez un nouveau client qui vous remet un projet TIA Portal V14 sans documentation, à reprendre. Quelle est votre première étape ?

A) Migrer immédiatement vers la dernière version de TIA Portal pour bénéficier des dernières fonctionnalités  
B) **Sauvegarder l'original, ouvrir le projet en lecture seule pour cartographier la structure (matériel, OB appelés, FB utilisés), puis seulement après échanger avec le client sur les évolutions** ✓  
C) Effacer les blocs non utilisés pour clarifier  
D) Refaire le programme à zéro selon les bonnes pratiques actuelles

**28.** [CAS PRATIQUE — MÉDIOR] Un opérateur signale que la ligne ralentit en fin de cycle, sans raison apparente. Vous suspectez un cycle PLC qui s'allonge. Comment confirmez-vous votre hypothèse ?

A) En augmentant la fréquence d'échantillonnage des entrées  
B) **En utilisant l'outil Cycle Time monitoring de la CPU et la Performance/Runtime Analysis dans TIA Portal pour identifier la durée de chaque bloc dans le cycle, puis en comparant aux valeurs de référence** ✓  
C) En remplaçant la CPU par une référence plus puissante  
D) En réduisant le nombre de variables suivies par le HMI

**29.** [CAS PRATIQUE — SENIOR] Un client souhaite intégrer la lecture de 100 variables Modbus TCP issues d'un système tiers (compteurs d'énergie) dans son programme S7-1500 existant. Quelle est votre démarche la plus rationnelle ?

A) Programmer une boucle de polling avec un FB MB_CLIENT par variable  
B) **Utiliser un FB MB_CLIENT unique avec un buffer de réception structuré, lecture groupée des registres consécutifs en une seule transaction, gestion des timeouts et reconnexion, et exposition des variables dans un DB symbolique pour le reste du programme** ✓  
C) Demander au client de remplacer ses compteurs par des compteurs PROFINET  
D) Passer par un OPC UA serveur tiers

**30.** [CAS PRATIQUE — EXPERT] Un client vous demande de mettre en place une stratégie de versionnage Git pour ses projets TIA Portal, sur lesquels travaillent trois automaticiens en parallèle. Que proposez-vous concrètement ?

A) Un dépôt Git classique, chacun commitant son fichier `.ap17`  
B) **Un déploiement de TIA Portal Multiuser Engineering pour le travail collaboratif synchrone (serveur de projet), couplé à un export automatisé des sources XML vers Git après chaque jalon (build du projet), avec convention de commits structurée par fonction modifiée** ✓  
C) Un système de fichiers partagé avec verrou manuel  
D) Renoncer au versionnage et passer par des sauvegardes journalières

---

## TEST 3 — Data Manager (26 questions)

### Connaissances

**1.** [MÉDIOR] Au sein de la suite AVEVA System Platform (anciennement Wonderware), quel module gère l'exécution des objets et leur communication ?

A) **L'Application Server, accompagné de son IDE de développement** ✓  
B) L'Historian  
C) InTouch HMI  
D) Information Server

**2.** [MÉDIOR] Dans quelle technologie AVEVA Historian stocke-t-il nativement les données de production ?

A) Une base PostgreSQL avec extension TimescaleDB  
B) **Microsoft SQL Server, complété par un moteur de compression propriétaire pour les séries temporelles** ✓  
C) Une base Oracle  
D) Des fichiers CSV plats

**3.** [MÉDIOR] Quel protocole industriel moderne permet l'échange de données SCADA-automate en mode publication/abonnement sécurisé ?

A) Modbus RTU  
B) **OPC UA, à travers son extension Pub/Sub** ✓  
C) Profibus DP  
D) HART

**4.** [JUNIOR] En quoi OPC UA se distingue-t-il principalement d'OPC Classic (DA) ?

A) OPC UA est uniquement plus rapide  
B) **OPC UA est compatible multi-plateformes (sans dépendance à DCOM/COM), sécurisé nativement par TLS, et offre un modèle d'information riche** ✓  
C) OPC UA ne fonctionne qu'avec Modbus  
D) Aucune différence fonctionnelle

**5.** [MÉDIOR] Que représente un « datapoint » dans WinCC OA (Open Architecture) ?

A) Un point de mesure physique  
B) **Une structure de données représentant un objet du process, dotée d'attributs configurables organisés selon une hiérarchie** ✓  
C) Un fichier d'export généré périodiquement  
D) Une connexion réseau active

**6.** [JUNIOR] Pour stocker des données process à très haute cadence (plus de 1 000 points par seconde par tag) sur le long terme, quelle famille de SGBD est la plus adaptée ?

A) Un SQL Server relationnel classique  
B) **Une base de données time-series spécialisée (InfluxDB, TimescaleDB, OSI PI ou AVEVA Historian)** ✓  
C) MongoDB  
D) MySQL

**7.** [MÉDIOR] Que définit le standard ISA-95 (S95) ?

A) Les protocoles de communication entre automates  
B) **Une hiérarchie fonctionnelle structurée en cinq niveaux (du process au pilotage d'entreprise) et un modèle d'objets pour l'intégration MES-ERP** ✓  
C) Le code couleur des câbles industriels  
D) Les zones ATEX

**8.** [JUNIOR] Quelle est la fonction principale d'un module Historian dans un SCADA ?

A) Afficher les synoptiques opérateur  
B) **Acquérir, compresser et stocker des séries temporelles de tags, et permettre des requêtes historiques avec interpolation et agrégation** ✓  
C) Programmer les automates connectés  
D) Gérer les comptes utilisateurs

**9.** [SENIOR] Quelle est la bonne pratique pour interroger un Historian depuis Power BI dans un contexte de reporting industriel ?

A) Copier-coller manuellement les données à intervalle régulier  
B) **Établir une connexion DirectQuery ou un Import via ODBC ou API REST, complétée par une couche de cache intermédiaire si le volume devient important** ✓  
C) Capture d'écran journalière des graphiques  
D) Envoi par e-mail de fichiers Excel exportés

**10.** [MÉDIOR] Quelle est la différence d'architecture entre WinCC V7 et WinCC Unified ?

A) Les deux produits sont architecturalement identiques  
B) **WinCC V7 reste lié à l'environnement Windows et à ses runtimes propriétaires, alors que WinCC Unified adopte une architecture web native fondée sur HTML5** ✓  
C) Les deux produits sont open-source  
D) Seul WinCC V7 supporte les automates S7-200

**11.** [SENIOR] Comment interfacer un SCADA AVEVA avec un MES SAP en production ?

A) En passant par une couche Modbus directe  
B) **À travers OPC UA, complété par un middleware d'intégration tel que SAP PCo (Plant Connectivity) ou AVEVA Connect** ✓  
C) Par échange de fichiers via FTP  
D) Par un cron envoyant des CSV chaque nuit

**12.** [EXPERT] Que désigne le concept de « golden record » en gestion de données industrielles ?

A) Un enregistrement particulièrement ancien dans la base  
B) **La source unique de vérité consolidée d'une entité (équipement, produit, lot), qui résout les conflits entre les différents systèmes qui la décrivent** ✓  
C) Une copie chiffrée de sauvegarde  
D) Un record de performance opérationnelle

**13.** [JUNIOR] Que garantit un envoi MQTT avec une QoS de niveau 2 ?

A) Le message est délivré au plus une fois  
B) **Le message est délivré exactement une fois, grâce à un mécanisme d'accusés de réception à quatre échanges** ✓  
C) Aucune garantie n'est apportée  
D) Le message est chiffré en transit

**14.** [MÉDIOR] Comment se décompose l'indicateur OEE (Overall Equipment Effectiveness) ?

A) Coût, qualité et délai  
B) **Disponibilité × Performance × Qualité** ✓  
C) Production, maintenance et stock  
D) Énergie, matière et main-d'œuvre

**15.** [MÉDIOR] Sur quelle base indexer un journal d'alarmes industriel à fort volume pour des requêtes efficaces ?

A) Sur le message d'alarme uniquement  
B) **Sur l'horodatage, la source (tag ou équipement), et l'état d'acquittement** ✓  
C) Sur l'utilisateur actuellement connecté  
D) Sur le numéro de série de l'équipement émetteur

**16.** [SENIOR] À quoi sert le buffering local sur un edge device industriel ?

A) À augmenter la vitesse du process commandé  
B) **À stocker localement les données lorsque la connexion vers le système central est perdue, puis à les retransmettre quand la liaison est rétablie (mécanisme de store and forward)** ✓  
C) À compresser des images de caméras de surveillance  
D) À sauvegarder le programme PLC

**17.** [SENIOR] Quelle architecture est aujourd'hui recommandée pour la construction d'un Data Lake industriel ?

A) Un dossier partagé Windows accessible à tous  
B) **Une architecture en couches Bronze (données brutes), Silver (nettoyées), Gold (agrégées prêtes pour le métier), associée à une gouvernance et un catalogue de données** ✓  
C) Un unique fichier Excel mis à jour quotidiennement  
D) Une seule base MongoDB centralisant tout

**18.** [SENIOR] Comment configurer l'authentification d'un SCADA pour respecter les exigences IEC 62443 ?

A) Un mot de passe unique partagé par les opérateurs  
B) **Une authentification individuelle nominative, des rôles et droits d'accès gérés par RBAC, une intégration à l'Active Directory et une journalisation persistante des actions** ✓  
C) Aucune authentification pour ne pas ralentir l'opérateur  
D) Une biométrie locale sans intégration centrale

**19.** [EXPERT] Que penser du protocole DDE (Dynamic Data Exchange) pour des systèmes industriels modernes ?

A) Il s'agit d'une norme moderne recommandée par les éditeurs  
B) **Il s'agit d'un protocole Windows historique, déprécié et déconseillé : à éviter au profit d'OPC UA pour toute nouvelle conception** ✓  
C) C'est le successeur d'OPC UA  
D) Il est spécifique à l'environnement Siemens

**20.** [JUNIOR] Que désigne une « tag » dans le contexte d'un Historian ?

A) Un commentaire libre attaché à un événement  
B) **Une variable enregistrée dans le temps, avec son nom symbolique, son unité, son type et sa configuration de compression** ✓  
C) Un fichier image associé à un équipement  
D) Le nom d'un opérateur intervenant sur l'installation

**21.** [SENIOR] Quelle stack technique typique mettre en place pour générer un rapport de production hebdomadaire automatique croisant production, qualité et consommation d'énergie ?

A) Excel rempli manuellement chaque vendredi  
B) **Un pipeline associant Historian comme source, une couche ETL ou SQL pour la consolidation, un outil de reporting (Power BI ou AVEVA Insight) pour la mise en forme, déclenché par un ordonnanceur et distribué par e-mail** ✓  
C) Capture d'écran régulière des synoptiques  
D) Un script cron utilisant grep sur les logs

**22.** [EXPERT] Que désigne un « mass parameter » dans WinCC OA ?

A) Une mesure de la masse physique d'un produit  
B) **Un paramètre partagé entre plusieurs instances d'un même type de datapoint (datapoint type), modifié en un seul endroit et propagé automatiquement** ✓  
C) Un indicateur de surcharge CPU  
D) Un compteur du nombre de tags actifs

### Mises en situation

**23.** [CAS PRATIQUE — MÉDIOR] Un client souhaite collecter 50 tags critiques de production à une fréquence d'acquisition de 100 ms (10 Hz), conservés pendant 5 ans pour traçabilité réglementaire. Quelle architecture proposez-vous ?

A) Un SCADA classique avec son historian intégré sans dimensionnement spécifique  
B) **Une base de données time-series adaptée (OSI PI, AVEVA Historian, InfluxDB), correctement dimensionnée (volume estimé proche de 80 milliards de points, donc politique de compression et de rétention différenciée par âge de la donnée), avec sauvegarde régulière et stratégie de purge ou d'archivage à long terme** ✓  
C) Un export quotidien de fichiers CSV vers un disque réseau  
D) Une base relationnelle MySQL classique avec une table par tag

**24.** [CAS PRATIQUE — SENIOR] Votre client constate que son reporting Power BI hebdomadaire met désormais quatre heures à se rafraîchir, contre 30 minutes il y a un an. Le volume de données a doublé sur la période. Quelle est votre démarche d'optimisation ?

A) Demander à l'éditeur de Power BI une licence plus performante  
B) **Profiler les requêtes (durée, volumes), pré-agréger les données côté Historian (vues, tables de synthèse, ou Data Mart dédié), passer en Import avec planification de rafraîchissement incrémental, et indexer correctement les colonnes filtrées** ✓  
C) Réduire le périmètre fonctionnel du reporting de moitié  
D) Désactiver les filtres interactifs du tableau de bord

**25.** [CAS PRATIQUE — SENIOR] Un client refuse OPC UA pour des raisons de politique sécurité interne et veut conserver Modbus TCP. Comment l'accompagnez-vous tout en améliorant son niveau de sécurité ?

A) Vous insistez et refusez la mission tant qu'OPC UA n'est pas accepté  
B) **Vous validez avec lui qu'OPC UA présente bien les contraintes qu'il évoque (sinon vous le clarifiez), puis vous renforcez le déploiement Modbus TCP existant : segmentation réseau dédiée, allowlist IP source/destination, journalisation des accès, supervision par un IDS industriel (Claroty, Nozomi), et passerelle de protocole sécurisée pour les communications inter-zones** ✓  
C) Vous acceptez sans rien changer à l'architecture existante  
D) Vous proposez un passage immédiat à HTTPS, qui n'est pas pertinent ici

**26.** [CAS PRATIQUE — EXPERT] Un industriel souhaite comparer la performance de deux lignes de production équivalentes pour identifier les facteurs de dérive. Quelles données minimales devez-vous collecter pour produire un OEE détaillé et exploitable ?

A) Uniquement les compteurs de pièces bonnes et rejetées  
B) **Pour chaque ligne : temps total ouvert (planning), arrêts subis (avec catégorisation pour la disponibilité), cadence théorique vs cadence réelle (performance), production conforme vs rebuts et retouches (qualité), tout horodaté pour pouvoir corréler aux événements (matières, opérateur, maintenance) ; sans cette catégorisation l'OEE ne sera pas actionnable** ✓  
C) Une simple courbe de production en quantité  
D) La consommation électrique de chaque ligne

---

## TEST 4 — IT industriel (26 questions)

### Connaissances

**1.** [JUNIOR] Qu'est-ce que OpenShift ?

A) Un système d'exploitation Linux concurrent de Red Hat  
B) **Une distribution Kubernetes pour l'entreprise éditée par Red Hat, qui intègre une chaîne CI/CD, des fonctionnalités de sécurité et des outils pour développeurs** ✓  
C) Un broker MQTT industriel  
D) Un fork de Docker

**2.** [MÉDIOR] Dans une architecture UNS (Unified Namespace) telle que théorisée par Walker Reynolds, quel composant central est typiquement employé ?

A) Un serveur OPC DA  
B) **Un broker MQTT (Mosquitto, HiveMQ, EMQX), associé à une hiérarchie de topics alignée sur le modèle ISA-95** ✓  
C) Une base Oracle relationnelle  
D) Un SCADA Wonderware

**3.** [MÉDIOR] Quel est le principe fondamental d'un Unified Namespace ?

A) Centraliser tous les calculs dans le cloud  
B) **Disposer d'une source unique de vérité en temps réel, organisée hiérarchiquement et navigable, avec un découplage total entre producteurs et consommateurs de données, dans une logique de cohérence à terme (eventually consistent)** ✓  
C) Remplacer progressivement les automates  
D) Supprimer les historians traditionnels

**4.** [SENIOR] Que désigne Sparkplug B ?

A) Un protocole concurrent destiné à remplacer MQTT  
B) **Une spécification qui se superpose à MQTT pour standardiser la structure des topics, le format des payloads (sérialisation Protobuf) et la gestion des sessions (messages birth, death, state) dans les environnements industriels** ✓  
C) Un environnement de développement Java  
D) Un système de gestion d'alarmes

**5.** [MÉDIOR] Quel niveau de QoS MQTT privilégier pour des données de production critiques ne tolérant aucune perte ?

A) QoS 0  
B) QoS 1  
C) **QoS 2, qui garantit une délivrance exactement une fois** ✓  
D) Les trois niveaux sont équivalents en pratique

**6.** [MÉDIOR] À quoi correspond le DataOps appliqué à l'industrie ?

A) Une augmentation des effectifs en mode opération  
B) **L'application des principes DevOps (intégration continue, tests automatisés, gestion de versions, observabilité, supervision) aux pipelines de données industrielles** ✓  
C) Une approche purement manuelle et artisanale du traitement des données  
D) L'utilisation systématique de fichiers Excel

**7.** [MÉDIOR] Que définit le modèle Purdue (Purdue Reference Model for CIM) pour la cybersécurité industrielle ?

A) Les niveaux d'isolement physique entre équipements  
B) **Une segmentation en niveaux (0 = process, 1 = contrôle, 2 = supervision, 3 = MES, 3.5 = DMZ, 4 = entreprise, 5 = internet) et les règles de communication autorisées entre eux** ✓  
C) Une politique de chiffrement des communications  
D) Une convention de couleurs pour les câbles industriels

**8.** [SENIOR] Quelle est la norme de référence en matière de cybersécurité industrielle ?

A) ISO 27001, qui est généraliste IT  
B) **IEC 62443, spécifiquement dédiée aux systèmes de contrôle industriels** ✓  
C) Le RGPD  
D) PCI-DSS

**9.** [JUNIOR] Qu'est-ce qu'un Pod dans Kubernetes ?

A) Une machine virtuelle complète  
B) **La plus petite unité déployable, regroupant un ou plusieurs containers qui partagent le même espace réseau et de stockage** ✓  
C) Un cluster complet  
D) Un node physique

**10.** [JUNIOR] Comment expose-t-on typiquement un service applicatif déployé dans OpenShift vers l'extérieur du cluster ?

A) Par un objet Deployment  
B) **À travers une Route (spécifique à OpenShift) ou un Ingress (standard Kubernetes)** ✓  
C) Par un ConfigMap  
D) Par un Secret

**11.** [SENIOR] À quoi sert un broker MQTT déployé en mode cluster ?

A) À réduire le nombre de topics  
B) **À assurer la haute disponibilité et la mise à l'échelle horizontale, en répartissant la charge entre plusieurs nœuds broker synchronisés** ✓  
C) À augmenter le bruit de fond du réseau  
D) À compresser les payloads

**12.** [MÉDIOR] Quel format de topic MQTT respecte une hiérarchie inspirée d'ISA-95 ?

A) `data/temperature`  
B) **`Enterprise/Site/Area/Line/Cell/DeviceTag` (par exemple `Dasolabs/Bruxelles/Assembly/Line1/Robot3/Temp`)** ✓  
C) `random_topic`  
D) Une succession aléatoire sans hiérarchie

**13.** [MÉDIOR] Quel est le rôle d'un edge gateway dans une architecture IIoT ?

A) Remplacer fonctionnellement un automate  
B) **Faire le pont entre les protocoles OT (Modbus, OPC UA, S7, EtherNet/IP) et les couches IT (MQTT, REST, Kafka), avec souvent une couche de pré-traitement local : filtrage, agrégation, store and forward** ✓  
C) Stocker l'ensemble des historiques de production  
D) Afficher les synoptiques de supervision

**14.** [JUNIOR] À quoi sert une DMZ entre les niveaux 3 et 4 du modèle Purdue ?

A) À héberger un réseau Wi-Fi public  
B) **À isoler les zones IT et OT en imposant l'usage de proxies, de jump hosts contrôlés et l'audit de tous les flux qui transitent entre les deux zones** ✓  
C) À stocker les sauvegardes  
D) À héberger des serveurs web publics

**15.** [JUNIOR] Avec quels outils supervise-t-on typiquement un cluster OpenShift ?

A) Excel mis à jour quotidiennement  
B) **L'ensemble Prometheus (collecte de métriques), Grafana (visualisation) et Alertmanager (gestion des alertes), intégrés par défaut dans OpenShift** ✓  
C) Un simple ping  
D) Telegram

**16.** [SENIOR] Que signifie l'approche GitOps appliquée à OpenShift ?

A) Le code est partagé sur clé USB  
B) **L'état désiré du cluster est décrit par des manifests YAML versionnés dans Git, et un opérateur (ArgoCD, Flux) se charge de synchroniser en permanence l'état réel sur l'état désiré** ✓  
C) Il n'y a aucun versionnage des configurations  
D) Tout est déployé manuellement

**17.** [SENIOR] Comment authentifier solidement un client MQTT en production industrielle ?

A) Avec un identifiant et mot de passe en clair, sur un réseau public  
B) **Avec une authentification mTLS reposant sur des certificats X.509 propres à chaque client, complétée par des règles d'ACL définissant les topics autorisés en publication et abonnement** ✓  
C) Sans authentification, pour préserver la simplicité  
D) Avec un simple filtrage d'adresses IP

**18.** [SENIOR] Quelle est la différence fondamentale entre Apache Kafka et MQTT ?

A) Les deux solutions sont fonctionnellement équivalentes  
B) **Kafka est un système de streaming distribué qui garantit un ordre strict des messages par partition et une rétention longue durée, tandis que MQTT est un protocole de publication/abonnement léger optimisé pour la bande passante limitée et les clients embarqués** ✓  
C) Kafka est gratuit là où MQTT est payant  
D) MQTT est systématiquement plus rapide

**19.** [SENIOR] Que permet une architecture événementielle (event-driven) dans l'IIoT ?

A) D'introduire un fort couplage entre les systèmes  
B) **De découpler producteurs et consommateurs de données, d'autoriser la mise à l'échelle indépendante de chaque composant, d'améliorer la résilience aux pannes partielles et de faciliter une évolution progressive des systèmes** ✓  
C) De remplacer les automates de terrain  
D) Uniquement de réduire les coûts

**20.** [MÉDIOR] Dans quelles situations un Pod OpenShift est-il typiquement redémarré automatiquement ?

A) Lors d'une mise à jour du firmware d'un automate distant  
B) **En cas de crash applicatif, lors d'une mise à jour de l'image container, à la suite d'un scale-up ou scale-down, lors du drain d'un node pour maintenance, ou en cas de dépassement de la mémoire allouée (OOMKilled)** ✓  
C) Lors d'un changement de mot de passe utilisateur  
D) Jamais automatiquement

**21.** [EXPERT] Comment gérer correctement les secrets (mots de passe, certificats, clés API) dans un cluster OpenShift ?

A) En les plaçant dans un ConfigMap pour simplifier  
B) **En utilisant des objets Secret de Kubernetes, idéalement complétés par un gestionnaire externe (HashiCorp Vault, Sealed Secrets, External Secrets Operator) qui assure le chiffrement au repos et la rotation des credentials** ✓  
C) En les écrivant en clair dans les manifests YAML versionnés sur Git  
D) En les stockant sur un disque externe partagé

**22.** [EXPERT] Quelle est la première étape concrète d'un projet de retrofit d'une usine existante vers une architecture UNS ?

A) Remplacer immédiatement l'ensemble des automates  
B) **Cartographier exhaustivement les sources de données existantes (automates, SCADA, historians, MES, ERP), définir le modèle hiérarchique cible aligné sur ISA-95, et concevoir la convention de nommage des topics MQTT avant tout déploiement** ✓  
C) Souscrire à un service cloud  
D) Former tous les opérateurs aux nouveaux outils

### Mises en situation

**23.** [CAS PRATIQUE — MÉDIOR] Un client manufacturing exploitant trois sites vous demande de proposer une roadmap de déploiement progressive vers un Unified Namespace. Quelle est votre approche ?

A) Déployer simultanément sur les trois sites pour gagner du temps  
B) **Commencer par un site pilote représentatif, valider le modèle hiérarchique et la convention de topics, déployer la solution broker (avec haute disponibilité), connecter d'abord les données critiques (production, qualité), mesurer les bénéfices opérationnels, puis répliquer la démarche sur les deux autres sites en capitalisant sur le pilote** ✓  
C) Confier le projet à un intégrateur unique sans phase pilote  
D) Demander au siège de décider seul du modèle hiérarchique

**24.** [CAS PRATIQUE — SENIOR] Le broker MQTT central de votre client tombe et redémarre quatre fois par jour depuis une semaine, sans logs explicites. Comment diagnostiquez-vous ?

A) Vous remplacez immédiatement le broker par un produit concurrent  
B) **Vous analysez les métriques système (CPU, mémoire, descripteurs de fichiers, sockets ouverts), les logs broker en niveau debug, le trafic réseau (charge, clients connectés, fréquence des messages), corrélez avec d'éventuelles tâches planifiées et identifiez si la cause est applicative (fuite mémoire, surcharge), système (saturation OS) ou réseau (déni de service interne)** ✓  
C) Vous redémarrez quotidiennement le serveur de manière préventive  
D) Vous demandez au client de réduire le nombre de tags

**25.** [CAS PRATIQUE — SENIOR] Vous devez justifier le choix d'OpenShift plutôt que Kubernetes vanilla pour un client industriel en contexte régulé. Quels sont vos arguments ?

A) OpenShift est plus rapide que Kubernetes  
B) **OpenShift intègre par défaut une chaîne CI/CD (Pipelines, BuildConfigs), des fonctionnalités de sécurité durcies (SCC plus strict que PSP, container hardening), une interface développeur, des opérateurs certifiés, un support entreprise Red Hat, et un cycle de release maîtrisé — tous critères pertinents dans un environnement régulé et long terme, malgré un coût de licence non négligeable** ✓  
C) Kubernetes vanilla ne fonctionne pas en production  
D) OpenShift est gratuit, contrairement à Kubernetes

**26.** [CAS PRATIQUE — EXPERT] Un client souhaite connecter 200 automates distribués sur cinq sites via MQTT vers un broker centralisé. Comment structurez-vous les topics et les politiques d'ACL ?

A) Un topic unique global pour tous les automates  
B) **Une hiérarchie type `dasolabs/{site}/{area}/{cell}/{device}/{tag}` strictement alignée ISA-95, des certificats X.509 par automate (mTLS), des ACL par site et par rôle (lecture seule pour les opérateurs locaux, publication restreinte aux devices propriétaires de leur sous-arborescence), un namespace de monitoring séparé pour les métriques broker, et un test régulier des règles d'ACL (audit trimestriel)** ✓  
C) Un identifiant et mot de passe partagés entre tous les automates  
D) Aucune politique d'ACL, le réseau privé suffit

---

## TEST 5 — Cybersécurité industrielle (24 questions)

### Connaissances

**1.** [JUNIOR] À quel périmètre s'applique la norme IEC 62443 ?

A) Aux systèmes informatiques de bureau  
B) **Aux systèmes industriels de contrôle (IACS — Industrial Automation and Control Systems)** ✓  
C) Aux réseaux télécoms  
D) Aux logiciels bureautiques

**2.** [MÉDIOR] Que désignent les concepts de zone et de conduit dans IEC 62443 ?

A) Un bâtiment physique et ses couloirs  
B) **Un regroupement logique d'équipements partageant les mêmes exigences de sécurité (zone), et les canaux contrôlés de communication entre ces zones (conduit)** ✓  
C) Le câblage des bus de terrain  
D) Le simple câblage électrique

**3.** [JUNIOR] Comment se découpe le modèle Purdue ?

A) En cinq niveaux numérotés de 1 à 5  
B) **En sept niveaux, de 0 (process) à 5 (internet ou entreprise), avec un niveau intermédiaire 3.5 dédié à la DMZ entre OT et IT** ✓  
C) En niveaux A à E  
D) Il n'est pas standardisé

**4.** [SENIOR] À quoi correspondent les Security Levels (SL) dans IEC 62443 ?

A) Une simple échelle d'IP réseau  
B) **Une échelle de quatre niveaux, allant de SL 1 (protection contre une violation accidentelle) à SL 4 (protection contre un attaquant disposant de moyens importants comme un acteur étatique)** ✓  
C) Le niveau de criticité d'un PLC  
D) Le rang hiérarchique d'un utilisateur

**5.** [JUNIOR] Quelle bonne pratique appliquer aux mots de passe d'un PLC ?

A) Les désactiver pour faciliter les interventions  
B) **Activer un mot de passe projet et un mot de passe applicatif (par exemple Application Password chez Schneider ou SecurityProtect chez Siemens), prévoir un changement régulier, ne jamais le partager entre PLC** ✓  
C) Conserver le code par défaut fourni par le constructeur  
D) Utiliser un même mot de passe pour tous les PLC du parc

**6.** [MÉDIOR] En quoi le patch management diffère-t-il entre OT et IT ?

A) Les deux contextes appliquent le même rythme de patching  
B) **En OT, les correctifs sont appliqués sur des fenêtres de maintenance planifiées, après validation préalable dans un environnement de test ; on arbitre entre la criticité du correctif et le risque d'indisponibilité, alors qu'en IT le patching peut être beaucoup plus agressif et automatisé** ✓  
C) On ne patche jamais en OT  
D) Le patching est entièrement automatique en OT

**7.** [JUNIOR] Que prévoit la directive européenne NIS2 pour les entités essentielles et importantes ?

A) Des standards techniques sans obligation réelle  
B) **Des obligations de mesures de cybersécurité, un reporting des incidents auprès des autorités compétentes, et une responsabilité juridique engagée des dirigeants pour les secteurs critiques, dont le manufacturing fait désormais partie** ✓  
C) Elle ne concerne que le secteur bancaire  
D) Elle est purement déclarative et sans obligation

**8.** [MÉDIOR] Qu'est-ce que l'attaque Stuxnet (2010) a démontré au monde industriel ?

A) L'existence de vulnérabilités sur des sites web critiques  
B) **La capacité d'un malware sophistiqué à cibler spécifiquement des PLC Siemens S7-300 à travers une infection préalable de l'environnement de programmation Step 7, sans nécessiter de connexion directe à Internet** ✓  
C) L'importance de sécuriser les réseaux Wi-Fi  
D) Le manque général de chiffrement réseau

**9.** [SENIOR] Comment organiser un accès distant sécurisé pour un mainteneur travaillant à distance sur un site OT ?

A) Autoriser un RDP direct exposé sur Internet  
B) **Mettre en place un VPN d'entrée, suivi d'un jump host avec authentification multi-facteurs, des sessions enregistrées pour traçabilité, des droits restreints au strict nécessaire et limités dans le temps (approche Privileged Access Management)** ✓  
C) Installer un TeamViewer permanent en arrière-plan  
D) Communiquer un mot de passe partagé à l'équipe maintenance

**10.** [MÉDIOR] Quel élément est central dans la segmentation d'un réseau industriel ?

A) Des switches manageables, ce qui suffit  
B) **Des firewalls industriels (par exemple Tofino, Hirschmann EAGLE, Fortinet OT), associés à une segmentation par VLAN, des listes de contrôle d'accès (ACL) explicites et un IDS spécifique OT** ✓  
C) Un réseau Wi-Fi étendu  
D) L'absence de segmentation pour simplifier les flux

**11.** [SENIOR] Comment aborder la protection antivirus d'un poste opérateur SCADA sous Windows ?

A) Installer une solution antivirus IT standard avec mises à jour automatiques  
B) **Privilégier une approche par whitelisting applicatif (par exemple AppLocker, McAfee Application Control), valider toute mise à jour antivirus en environnement de test, en accord avec les recommandations de l'éditeur SCADA, plutôt que de se reposer sur des signatures fréquemment mises à jour qui peuvent perturber le runtime** ✓  
C) Désactiver toute protection pour ne pas affecter les performances  
D) Migrer obligatoirement le poste sous Linux

**12.** [MÉDIOR] Comment organiser les sauvegardes des programmes PLC pour une installation industrielle ?

A) Ce n'est pas une priorité  
B) **Sauvegarder à chaque modification, puis cycliquement, sous forme versionnée, conserver une copie hors ligne en plus d'une copie sur le réseau interne, et tester périodiquement la procédure de restauration sur banc** ✓  
C) Conserver les programmes uniquement sur le PLC lui-même  
D) Une seule sauvegarde initiale est suffisante

**13.** [SENIOR] À quoi sert un IDS spécifique OT (Claroty, Nozomi, Dragos) ?

A) À jouer le rôle d'antivirus pour les PLC  
B) **À détecter des anomalies par analyse passive du trafic industriel (Modbus, S7, EtherNet/IP, OPC UA), à construire automatiquement une baseline du fonctionnement normal du process et à alerter sur les déviations** ✓  
C) À filtrer les spams sur les messageries internes  
D) À jouer le rôle d'un firewall classique

**14.** [JUNIOR] Que stipule le principe du moindre privilège (least privilege) en OT ?

A) Tout utilisateur dispose des droits d'administration  
B) **Chaque utilisateur reçoit uniquement les permissions strictement nécessaires à l'exercice de sa fonction, et rien de plus** ✓  
C) Tous les utilisateurs sont en lecture seule  
D) Personne n'est autorisé à se connecter

**15.** [MÉDIOR] Comment gérer les comptes utilisateurs d'un SCADA en vue d'un audit de conformité ?

A) Avec des comptes génériques partagés pour simplifier  
B) **Avec des comptes individuels nominatifs intégrés à l'Active Directory, des règles MFA pour les accès distants ou privilégiés, une journalisation persistante des actions, et une procédure de désactivation au départ d'un collaborateur** ✓  
C) En affichant le mot de passe sur le poste opérateur  
D) En supprimant toute authentification

**16.** [SENIOR] Quelle cible visait l'attaque TRITON/TRISIS (2017) ?

A) Des centrales nucléaires d'Europe de l'Est  
B) **Un système instrumenté de sécurité (SIS) Triconex de Schneider Electric, démontrant qu'un attaquant peut désactiver les fonctions de sécurité avant un sabotage du process** ✓  
C) Des banques  
D) Des objets connectés grand public

**17.** [MÉDIOR] Quelle est la démarche de durcissement (hardening) d'un serveur SCADA sous Windows ?

A) Aucun changement n'est nécessaire par rapport au paramétrage par défaut  
B) **Désactiver les services et protocoles inutiles, restreindre l'usage des ports USB, activer un firewall local, retirer les tâches planifiées non nécessaires, limiter les comptes locaux, en s'appuyant sur les benchmarks reconnus (DISA STIG, CIS Benchmark Windows)** ✓  
C) Activer tous les services pour ne rien casser  
D) Le hardening provoque inévitablement une perte de fonctionnalités

**18.** [EXPERT] Comment construit-on un inventaire d'actifs OT (asset inventory) ?

A) En tenant un cahier papier manuel  
B) **Avec un outil de découverte passive spécialisé OT (Claroty, Nozomi, Tenable.ot), qui identifie les équipements, leur firmware, les vulnérabilités connues (CVE) qui les affectent, et leur exposition relative** ✓  
C) En s'appuyant sur l'inventaire IT, qui couvre déjà ce besoin  
D) L'inventaire n'a pas de pertinence en OT

**19.** [EXPERT] En quoi la réponse à incident en OT diffère-t-elle de la réponse en IT ?

A) Les deux processus sont totalement identiques  
B) **En OT, la continuité de production prime souvent sur la confidentialité ; l'isolation physique est plus complexe à mettre en œuvre ; une expertise spécifique en process safety est nécessaire ; et la coordination avec les exploitants opérationnels doit être étroite** ✓  
C) Il faut couper toutes les liaisons immédiatement, sans réflexion  
D) Aucune procédure formelle n'est nécessaire en OT

**20.** [SENIOR] Quelle méthodologie utiliser pour le threat modeling d'un système OT ?

A) Le sujet est inutile en OT  
B) **La méthodologie STRIDE (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege), adaptée au contexte OT, croisée avec des analyses HAZOP ou FMEA pour intégrer la dimension safety** ✓  
C) Un audit financier suffit  
D) Une certification ISO 9001

### Mises en situation

**21.** [CAS PRATIQUE — JUNIOR] Vous arrivez chez un nouveau client qui n'a aucune politique de sécurité OT et vous demande où commencer. Quelle est votre première étape ?

A) Acheter immédiatement des firewalls industriels  
B) **Réaliser une cartographie de l'existant (architecture réseau OT/IT, équipements, flux, vulnérabilités évidentes), classifier les actifs critiques selon leur impact sur la sécurité et la production, et définir une feuille de route priorisée avec le client (quick wins puis chantiers structurants)** ✓  
C) Lancer un audit ISO 27001 sans préambule  
D) Migrer tous les équipements en DMZ

**22.** [CAS PRATIQUE — MÉDIOR] Un audit de sécurité chez votre client révèle que tous les opérateurs partagent un même compte sur le SCADA. Comment organisez-vous la migration vers des comptes individuels sans interrompre la production ?

A) Forcer la migration en une fois, le jour même  
B) **Préparer la nouvelle structure d'identités dans l'Active Directory, créer un compte par opérateur en parallèle, former l'équipe sur la nouvelle procédure de connexion, planifier la bascule à froid pendant une fenêtre d'arrêt prévue, et désactiver le compte partagé seulement après une période d'observation** ✓  
C) Imposer un nouveau mot de passe complexe sur le compte partagé existant  
D) Conserver le compte partagé tout en ajoutant des comptes individuels (équivalent à ne rien faire)

**23.** [CAS PRATIQUE — SENIOR] Une vulnérabilité critique (CVE de score 9.8) est publiée sur le firmware d'une CPU S7-1500 en exploitation chez votre client. Le patch impose un redémarrage de la CPU. Comment décidez-vous et planifiez-vous ?

A) Patcher immédiatement en production sans tests préalables  
B) **Évaluer le risque concret d'exposition (chemin d'attaque réellement disponible), tester le patch sur un banc identique, planifier la fenêtre d'application avec l'exploitant (idéalement lors d'un arrêt prévu), préparer une procédure de rollback si le patch pose problème, et confirmer la disponibilité d'un support constructeur pendant l'opération** ✓  
C) Ne rien faire et attendre la prochaine version majeure du firmware  
D) Déconnecter immédiatement la CPU du réseau

**24.** [CAS PRATIQUE — EXPERT] Votre client a un réseau plat unique mélangeant OT et IT et souhaite segmenter conformément au modèle Purdue. Comment menez-vous ce chantier ?

A) Tirer un nouveau câblage à neuf pour tout l'atelier  
B) **Procéder par étapes : cartographie complète des flux existants (qui parle à qui, sur quels ports, à quelle fréquence), définition des zones cibles selon Purdue, design des firewalls et VLAN, validation des règles en mode logging avant blocage actif, mise en place de la DMZ avec proxies/jump hosts, formation des équipes, bascule progressive avec surveillance renforcée pour identifier les faux positifs et ajuster** ✓  
C) Déployer un firewall périmétrique unique et estimer que la segmentation est faite  
D) Demander au client de remplacer tous ses automates

---

## Architecture (rappel)

Inchangée depuis la v2 — schéma Prisma avec enums `TestDomain` et `TestDifficulty`, modèles `Test` / `TestQuestion` / `TestChoice` / `TestAssignment` / `TestSubmission` / `TestAnswer`. Score caché au répondant, ventilation par niveau visible côté admin. Lien magique pour candidat externe valide 14 jours, soumission unique.

---

## Récapitulatif final

- **5 tests, 130 questions au total**, dont 20 mises en situation
- Niveaux : Junior / Médior / Senior / Expert sur chaque question
- Mises en situation explicitement étiquetées `[CAS PRATIQUE — niveau]` pour les distinguer
- Français corrigé : phrases complètes, terminologie technique adaptée, abandon des listes télégraphiques
- Cas pratiques conçus comme des situations réelles de chantier : « vous arrivez chez le client », « un audit révèle », « le broker tombe »

Tu valides cette v3 ? Une fois ton OK, je passe à l'implémentation complète (migration Prisma, server actions, page admin `/tests`, UI répondant via token magique, envoi e-mail Mailgun, onglet « Tests » sur fiches profil) — environ une journée de dev.
