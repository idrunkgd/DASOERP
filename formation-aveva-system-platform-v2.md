# Formation AVEVA System Platform — v2

> Version corrigée intégrant les retours techniques (Yoann, 05/10/2026).
> Terminologie à jour, parties manquantes ajoutées (RDI, sécurité, redondance, exemples concrets).

---

## INTRODUCTION

### 01 · Cover
**AVEVA System Platform — Formation interne Dasolabs**
Du débutant au référent SP. 3 niveaux · 60+ chapitres · exercices sur VM.

### 02 · Pourquoi cette formation
- Dasolabs intègre AVEVA System Platform chez des clients majeurs (UCB, SAFRAN).
- Objectif : chaque automaticien Dasolabs doit pouvoir démarrer un projet SP seul après Niveau 1, livrer un projet standard après Niveau 2, concevoir une architecture redondée après Niveau 3.

### 03 · Prérequis
- Bases automatisme (variable, scan, PLC)
- Windows Server (installation, services, pare-feu)
- SQL Server (notions de base, SSMS)
- VM Windows disponible (fournie par Dasolabs — image cloud préparée)

### 04 · Comment utiliser cette formation
- Lire → tester sur la VM → quiz → exercice → debrief avec un référent
- Chaque chapitre a : contenu · exemple concret · pièges fréquents · exercice · quiz
- La formation couvre les versions **2012 → 2026** (ne traite plus ArchestrA, qui est le nom historique obsolète)

### 05 · Historique produit (indispensable à connaître)
- ArchestrA (historique) → **AVEVA System Platform** (nom actuel)
- Versions couvertes : 2012, 2012R2, 2014, 2014R2, 2017, 2020, 2020R2, 2023, 2023R2, 2026
- Les versions **avant 2014** s'appelaient `wwAlmDB` pour la base d'alarmes
- **2014 → 2020** : `A2AlmDB`
- **2020 et après** : `runtime` (nom unifié avec Historian)
- **Runtime = Historian** (c'est la même chose, confusion fréquente)

---

## NIVEAU 1 · DÉBUTANT

### N1-01 · Qu'est-ce qu'AVEVA System Platform
- Plateforme de supervision industrielle (SCADA/HMI/MES light)
- Modélise une installation en **objets** reliés dans un **Galaxy** (projet SP)
- Les objets vivent sur des **AOS** (Application Object Servers)
- Les clients visualisent via **InTouch OMI** ou vieux InTouch

**Composants principaux à connaître dès le début :**
- GR (Galaxy Repository) — DB de configuration
- IDE — l'outil d'édition (pas inclus dans Application Server, c'est à part)
- AOS (Application Object Server) — exécute les objets en runtime
- InTouch OMI — client de visualisation
- Historian — stockage historique (= runtime depuis 2020)

**Piège fréquent :** confondre IDE et System Platform. L'IDE est l'outil de dev, SP est la plateforme runtime.

### N1-02 · Le Galaxy Repository (GR)
- Le GR est une **DB de configuration**, rien d'autre
- Si le GR est coupé, **tout tourne en runtime** (c'est important à retenir pour la haute dispo)
- Les clients runtime **ne contactent jamais le GR**, uniquement l'IDE l'interroge
- Le GR héberge les templates, les objets, les scripts

**Exemple concret :** on peut couper le GR pour maintenance et les lignes de prod continuent de fonctionner. Seuls les développeurs sont bloqués pour modifier le projet.

### N1-03 · Installation
- Prérequis Windows Server 2016+ (2019 recommandé, 2022 OK dès SP 2023)
- SQL Server Standard ou Express (selon taille projet)
- **Pas de ports obsolètes à retenir** : le fameux 5100 **n'existe pas**
- **Ports par défaut : 88 et 443** (changés par rapport aux versions pré-2020)
- Pare-feu Windows à ouvrir : voir chapitre N3-sécurité

**Exercice :** installer SP 2023R2 sur une VM Windows Server 2022 avec SQL Express.

### N1-04 · Licences — évolution historique
- **2014** : fichier `.lic` (local)
- **2017** : coexistence `.lic` + serveur de licences
- **2020 et après** : uniquement serveur de licences (AVEVA Enterprise License Server)
- Le serveur **Connect** n'a rien à voir avec le licensing — ne pas confondre

**Piège fréquent :** en 2024, certains croient que `.lic` suffit. Faux depuis 2020.

### N1-05 · Les traductions
- Les labels/étiquettes multilangues sont **identiques dans toutes les versions**
- Mécanisme : ressource `.aaLNG` liée aux objets
- Mettre à jour la ressource = mettre à jour toutes les instances

### N1-06 · Templates vs instances
- Template = modèle réutilisable
- Instance = objet déployé sur un AOS
- **Règle d'or : on ne met JAMAIS rien directement dans une instance** (pas propre)
- Toujours créer un **derived template** (template dérivé) et instancier à partir de celui-ci
- On peut **renommer un template sans impact** (les instances suivent)

**Exemple concret :** vous avez un template `$Motor_Base`. Vous créez `$Motor_SiteUCB` dérivé pour les specs UCB. Vous instanciez `Motor_01`, `Motor_02`… de `$Motor_SiteUCB`.

**Piège fréquent :** modifier directement une instance. Si le template change, l'instance est écrasée OU gardée en override (dangereux).

### N1-07 · Les attributs
- Un attribut = une valeur typée (bool, int, string, etc.)
- Attribut *custom* : défini au niveau du template
- Attribut *built-in* : fourni par SP
- Un attribut peut avoir une **référence externe** (via Custom Properties, PAS via la pseudo-"production")

**Correction importante :** le terme "en production" vu dans certains docs est **faux**. Les attributs sont référencés via Custom Properties ou directement par chemin ArchestrA (`Galaxy:Object.Attribute`).

### N1-08 · Deploy / Undeploy — statuts visuels
Dans l'IDE, chaque objet a un statut :
- **"V" noir** = checked out par **un autre utilisateur**
- **"V" bleu** = checked out par **vous**
- Statut undeployed + warning
- `pending change` = modifié mais pas encore déployé
- Déployé et à jour = (icône OK)
- Override checkout = (icône spécifique)

**Il n'y a pas de cadenas** dans SP, c'est bien des "V". Cette confusion revient souvent dans la doc.

### N1-09 · Un objet peut être déployé en erreur
- Un objet qui est **en erreur** peut quand même être déployé
- Il ne passera pas en `OnScan`, mais le déploiement en lui-même réussit
- Conséquence : il **ne scanne pas** et **bloque les autres** objets dépendants

**Piège fréquent :** croire qu'un objet en erreur bloque le déploiement. Non — c'est le runtime qui est bloqué, pas le deploy.

### N1-10 · Device Integration (DI)
- Les **objets de communication** s'appellent historiquement `DI` (Device Integration)
- Terminologie actuelle : `DDESuiteLink Objects` pour les nouveaux
- Mais tout le monde **continue d'appeler ça DI**
- `DINetwork` ne veut rien dire — c'est un terme fantôme, à ne pas utiliser

**Note version :** le **SuiteLink existe toujours en 2026**. Pas supprimé.

### N1-11 · Les I/O Devices
- Pour la connexion vers les PLC, on utilise les **IO Devices** (objets `$DDESuiteLinkClient` ou `$OPCClient`)
- Un IO Device référence un équipement physique (Siemens S7, Rockwell CL5000, etc.)

### N1-12 · OCMC (Operation Control Management Console)
- Nom actuel depuis **SP 2023** : OCMC
- Remplace l'ancien SMC (System Management Console)
- Permet de monitorer le statut des platformes, engines, objets en runtime

### N1-13 · Les alarmes
- 4 statuts d'alarme : `UNACK_ALM`, `ACK_ALM`, `UNACK_RTN`, `ACK_RTN`
  - UNACK_ALM : alarme active non acquittée
  - ACK_ALM : alarme active acquittée
  - UNACK_RTN : revenue à la normale, pas encore acquittée
  - ACK_RTN : revenue à la normale et acquittée
- Base d'alarmes : voir chapitre N1-05 (renommages historiques)

### N1-14 · Les scripts (bases)
- Scripts QuickScript.NET au niveau des objets
- Déclencheurs : OnScan, OffScan, Execute, Shutdown, Startup
- Un script peut lire/écrire des attributs locaux ou distants
- Ne pas abuser des scripts dans les objets — préférer les symbols/aliases

### N1-15 · On ne voit pas le bootstrap
- Le processus **bootstrap** tourne mais n'est pas visible dans l'IDE
- Si problème : vérifier via Services Windows (`aaBootstrap`)

### N1-16 · Exercice complet Niveau 1
Sur la VM fournie :
1. Installer SP 2023R2
2. Créer un Galaxy "ForUcbDemo"
3. Créer un derived template `$Pump` avec attributs `Running:bool`, `Flow:real`
4. Instancier `Pump_01`, `Pump_02`, `Pump_03`
5. Déployer sur un AOS
6. Lire les valeurs en runtime via Object Viewer

### N1-17 · Quiz Niveau 1 (10 questions)
Chaque question avec la bonne réponse marquée ✓.

1. Que signifie "V" noir sur un objet dans l'IDE ?
   - a) Il est corrompu
   - b) Il est locké par un autre utilisateur ✓
   - c) Il est en production
   - d) Il est validé

2. Un objet en erreur peut-il être déployé ?
   - a) Non, jamais
   - b) Oui, mais il ne scannera pas ✓
   - c) Oui, et il tournera quand même
   - d) Dépend de la version

3. Peut-on mettre des choses directement dans une instance ?
   - a) Oui, c'est la méthode standard
   - b) Non, on passe toujours par un derived template ✓
   - c) Seulement les attributs custom
   - d) Dépend du type d'objet

4. Si le GR est coupé, que se passe-t-il ?
   - a) Tout s'arrête
   - b) Les clients runtime continuent, seul l'IDE est bloqué ✓
   - c) Les alarmes s'arrêtent
   - d) Rien ne tourne

5. Les ports par défaut de SP (2023+) ?
   - a) 5100 et 5101
   - b) 88 et 443 ✓
   - c) 80 et 8080
   - d) 1433 uniquement

6. En quelle année la licence `.lic` a-t-elle totalement disparu ?
   - a) 2014
   - b) 2017
   - c) 2020 ✓
   - d) 2023

7. Que signifie DI ?
   - a) Data Integration
   - b) Device Integration ✓
   - c) Direct Interface
   - d) Dynamic Instance

8. Peut-on renommer un template ?
   - a) Non, c'est destructif
   - b) Oui, sans impact sur les instances ✓
   - c) Oui, mais les instances se détachent
   - d) Seulement si aucune instance

9. Comment se nomme la base d'alarmes depuis 2020 ?
   - a) wwAlmDB
   - b) A2AlmDB
   - c) runtime ✓
   - d) HistorianDB

10. L'IDE est-il inclus dans Application Server ?
    - a) Oui
    - b) Non, c'est un composant à part ✓
    - c) Seulement en version Enterprise
    - d) Depuis 2020 oui

---

## NIVEAU 2 · INTERMÉDIAIRE

### N2-01 · Architecture détaillée
- Galaxy → Platform → Engine → Area → Object
- Un Platform = une VM Windows avec SP installé
- Un Engine = un processus `aaEngine.exe` hébergé par la Platform
- Une Area = un regroupement logique (unité, ligne, zone)
- Un Object = instance d'un template

**Règle 3→4 est fausse** : en vrai, on dépasse largement 4 engines par platform selon la charge. Dimensionnement selon CPU, pas selon un nombre magique.

### N2-02 · Topologies (versions corrigées)
- **Mono-platform** : tout sur une VM — dev et petits sites
- **Multi-platforms** : GR séparé, AOS 1+2, historian séparé
- **Redondance AOS** : paires d'AOS primaires + backup
- Je ne suis pas totalement d'accord avec les topologies "officielles" AVEVA, en pratique on adapte au site

### N2-03 · Dimensionnement CPU
- On vise **sous 40%** de CPU par platform
- Pourquoi 40% et pas plus ? **Parce qu'en redondance**, une platform peut reprendre la charge d'une autre — elle doit arriver à **80% max** dans ce cas de bascule
- 40% × 2 = 80% → marge de sécurité pour la bascule

**Piège fréquent :** dimensionner à 70% en nominal → la bascule explose en overrun.

### N2-04 · Scan overrun
- **ScanOverrun existe et est courant** (contrairement à ce que disent certains docs)
- Un overrun = l'engine n'a pas fini son scan avant le prochain tick
- Causes : trop d'objets, scripts trop lourds, I/O lentes, CPU à 100%
- Comment le voir : OCMC → onglet "Platform" → statistiques Engine
- Comment le réduire : alléger les scripts, répartir les objets sur plusieurs engines, augmenter le scan period

### N2-05 · Les Historian / Runtime (c'est pareil)
- Depuis 2020, le nom "Runtime" désigne la DB d'historique
- Attribut historisé = valeur stockée dans la DB
- Configuration par attribut : `StorageType` **n'existe pas** en écriture
- Par défaut, tout est stocké en **Full** (= chaque échantillon)
- C'est à la **lecture** qu'on choisit (raw, cyclic, delta, etc.)

### N2-06 · Deadbands — correction importante
Les deadbands dans SP :
- **Value Deadband** : écart minimum pour stocker — **en unité**, PAS en %
- **Time Deadband n'existe PAS** → ce qu'on cherche c'est **ForceStoragePeriod** (forcer un échantillon toutes les X secondes même si rien change)
- **Rate Deadband** : n'existe pas (c'est un terme inventé)
- **Interpolation** : n'est pas un deadband non plus — c'est une méthode de lecture

**Doc à corriger :** supprimer "Rate deadband", "Time deadband" et "Interpolation deadband" partout.

### N2-07 · Scripts avancés
- Scripts timés : attention au timing entre deux ticks d'engine
- Les **indirects ne sont plus utilisés** aujourd'hui — on utilise :
  - **SetCustomProperties** pour les binds dynamiques
  - **Attributs référencés** directement
- Pourquoi : le set du `bindto` d'un indirect se fait **entre deux exécutions d'engine** → il faut exécuter le script **deux fois** pour voir l'effet. Casse-tête, abandonné.

### N2-08 · Export d'objets (load / dump)
- `aaIDE.exe` en ligne de commande supporte **load** et **dump**
- `dump` → exporte un objet vers un XML
- `load` → importe un XML dans le Galaxy
- Permet backup, versionning Git, migration entre Galaxies

**Exemple concret :** script PowerShell qui dump tous les objets d'un area chaque nuit vers un repo Git.

**C'est un gros manque dans la doc actuelle** — l'export d'objets n'est pas documenté.

### N2-09 · Les symboles ArchestrA
- Symbole = élément graphique (bouton, bargraph, animation)
- Attaché à un template ou libre
- InTouch OMI charge dynamiquement les symboles de la Galaxy

### N2-10 · InTouch OMI
- Client de visualisation moderne (depuis SP 2017)
- Remplace le vieux InTouch "WindowMaker"
- Supporte navigation hiérarchique, context switching, mobile

### N2-11 · Exercice Niveau 2
1. Créer 2 AOS redondants dans un même Galaxy
2. Déployer `Pump_01..10` avec backup sur l'AOS2
3. Simuler la coupure de l'AOS1 → vérifier le failover
4. Historiser les attributs `Flow`
5. Faire un dump XML de l'objet `$Pump` vers un fichier

### N2-12 · Quiz Niveau 2 (10 questions)
1. À quel pourcentage CPU on dimensionne un platform en nominal ?
   - a) 70%
   - b) 50%
   - c) 40% ✓ (pour que la bascule reste sous 80%)
   - d) 90%

2. ScanOverrun est-il un problème ?
   - a) Non, ça n'arrive jamais
   - b) Oui, c'est fréquent et à surveiller ✓
   - c) Oui mais uniquement en Expert
   - d) Impossible depuis 2020

3. Value Deadband est exprimé en :
   - a) Pourcentage
   - b) Unité de la valeur ✓
   - c) Microvolts
   - d) Dépend du type

4. Time Deadband existe-t-il ?
   - a) Oui, dans tous les attributs historisés
   - b) Non, on utilise ForceStoragePeriod à la place ✓
   - c) Oui depuis 2023
   - d) Seulement sur Historian Server

5. Runtime et Historian sont :
   - a) Deux produits différents
   - b) La même chose ✓
   - c) Historian a été remplacé par Runtime
   - d) Runtime est le nouveau nom historique de GR

6. Les indirects sont-ils encore recommandés ?
   - a) Oui
   - b) Non, on préfère SetCustomProperties ✓
   - c) Oui uniquement en 2026
   - d) Dépend de la version

7. Comment exporter un objet ?
   - a) Clic droit → Save As
   - b) aaIDE.exe en CLI avec `dump` ✓
   - c) C'est impossible
   - d) Via l'OCMC

8. StorageType à l'écriture dans Historian :
   - a) Full
   - b) Cyclic
   - c) Delta
   - d) Rien à configurer, c'est full par défaut ✓

9. Combien d'engines max par platform ?
   - a) 3 à 4
   - b) 10 strict
   - c) Pas de limite magique, dépend du CPU ✓
   - d) 2 toujours

10. InTouch OMI remplace :
    - a) System Management Console
    - b) InTouch WindowMaker (ancien) ✓
    - c) Historian Client
    - d) ArchestrA IDE

---

## NIVEAU 3 · EXPERT

### N3-01 · Redondance AOS (chapitre MANQUANT dans l'ancienne formation)
- Paire primary/backup déployée sur deux platforms différentes
- Chaque objet a un `RedundancyPartner`
- Failover < 1 seconde pour les attributs scannés
- **Snapshots** : critiques pour l'AOS redondant — la synchro backup se fait via **fichiers**. Si le système freeze/désynchronise, **les fichiers ne sont plus alignés** → split-brain.

**Comment prévenir :**
- Monitorer `aaEngine` + espace disque
- Prévoir un snapshot régulier
- Tester la bascule au moins 1x/trimestre

### N3-02 · Redondance de communication (chapitre MANQUANT)
- Pour un PLC critique : **2 RDI pour 2 AOS vers 1 PLC**
- RDI = Redundant Device Integration object
- Permet de perdre un AOS ou un lien réseau sans perdre les valeurs PLC
- Config : primary IP + backup IP + arbitrage automatique

**Architecture type :**
```
PLC Siemens S7
  ├── AOS1 → RDI_1 → DDESuiteLink
  └── AOS2 → RDI_2 → DDESuiteLink
```

### N3-03 · RDI — chapitre complet (MANQUANT)
- `$DINetwork` object (nom historique conservé)
- Attribut `IsRedundant = true`
- Deux Device Integration pointent vers le même PLC
- Un seul est "actif" à la fois, bascule automatique

**Exemple concret :**
Un PLC chez UCB en zone pharma. Si l'AOS1 tombe, l'AOS2 continue de scanner le PLC sans interruption via le RDI backup.

**Configuration pas-à-pas :**
1. Créer deux `$DDESuiteLinkClient` nommés `DDE_Primary` et `DDE_Backup`
2. Créer un `$DINetwork` nommé `RDI_PLC01`
3. Attribut `PrimaryDI = DDE_Primary`, `BackupDI = DDE_Backup`
4. Déployer sur AOS1 et AOS2
5. Tester en coupant AOS1

### N3-04 · Sécurité (chapitre MANQUANT)
- Modes d'auth : Galaxy (local), OS Group-based, OpenID (depuis 2023)
- Rôles standards : Administrator, Developer, Supervisor, Operator
- Rôles custom : permettent de restreindre par Area

**Configuration recommandée pharma GAMP 5 :**
- OS Group-based (lié à l'AD)
- Audit trail activé (ALL events)
- Signature électronique pour les ack d'alarme critiques
- Role-based permissions par Area

**Ports à ouvrir (sécurité réseau) :**
- 88 (Kerberos auth)
- 443 (HTTPS runtime)
- 1433 (SQL Server si distant)
- 2020 (Historian)
- Pas de 5100 (ce port est inventé)

### N3-05 · Audit trail
- Logging de toute action utilisateur
- Table `aaAlarmHistory` + `aaAudit`
- Export CSV / PDF pour inspection pharma

### N3-06 · Signatures électroniques
- Pour les actions critiques (ack d'alarme GAMP 5)
- Double auth : utilisateur + password + commentaire obligatoire
- Traçabilité qui/quand/pourquoi

### N3-07 · Performances
- Monitoring OCMC
- Clé : rester < 40% CPU, < 60% RAM, scan sans overrun
- Tooling : AVEVA Insight pour historisation remontée cloud

### N3-08 · Snapshots et recovery
- Pour l'AOS redondant : snapshots des fichiers de synchro
- Pour le GR : backup SQL régulier (daily)
- Pour l'Historian : backup DB + archivage historisé

**Procédure de recovery testée :**
1. Restaurer GR depuis backup SQL
2. Redéployer tous les objets
3. Resync AOS → attendre snapshot complet
4. Vérifier intégrité via OCMC

### N3-09 · Mixes de versions
- Un Galaxy = **une seule version** majeure
- GR 2023 ne peut pas héberger un AOS 2020
- Migration : procédure Galaxy Migration Wizard

**Attention :** la doc actuelle mélange des screenshots de 2017 et 2023 — à nettoyer.

### N3-10 · Topologies grands sites (exemples réels)
- UCB Braine : 2 GR redondés + 6 AOS + 2 Historian + 3 Terminal Servers
- SAFRAN site X : 1 GR + 4 AOS + 1 Historian

### N3-11 · Scripts avancés — patterns
- Pattern "Delayed Set" : utiliser `.SetAttribute` sur un attribut distant
- Pattern "SetCustomProperties" pour binds dynamiques
- Éviter : indirects (voir N2-07)

### N3-12 · Exercice Niveau 3
1. Créer un Galaxy multi-platforms avec 2 AOS redondants
2. Configurer un RDI vers un PLC Siemens simulé
3. Activer audit trail + signatures électroniques
4. Tester bascule AOS → validation que RDI continue
5. Faire un recovery depuis backup SQL

### N3-13 · Quiz Niveau 3 (10 questions)
1. Combien de RDI pour une archi 2 AOS + 1 PLC ?
   - a) 1
   - b) 2 ✓
   - c) 4
   - d) Dépend du PLC

2. Pourquoi des snapshots sont critiques pour l'AOS redondant ?
   - a) Pour la perf
   - b) Parce que la synchro se fait via fichiers — si freeze, désynchro ✓
   - c) Pour l'audit
   - d) Obligatoire GAMP 5

3. Mode d'auth recommandé pour un site pharma ?
   - a) Galaxy local
   - b) OS Group-based lié à l'AD ✓
   - c) Pas d'auth
   - d) OpenID uniquement

4. Un Galaxy peut-il mixer AOS 2020 et AOS 2023 ?
   - a) Oui
   - b) Non, une seule version majeure ✓
   - c) Depuis 2023 oui
   - d) Dépend du GR

5. Après restore GR, que faire ?
   - a) Rien, tout repart
   - b) Redéployer tous les objets ✓
   - c) Réinstaller SP
   - d) Reconfigurer l'auth

6. Pour un Galaxy critique pharma, le dimensionnement CPU vise :
   - a) 70%
   - b) 40% nominal (80% en bascule) ✓
   - c) 90%
   - d) Pas de limite

7. Audit trail est stocké dans :
   - a) wwAlmDB
   - b) aaAudit ✓
   - c) HistorianDB
   - d) Un fichier log

8. Les snapshots AOS synchronisent via :
   - a) SQL
   - b) Fichiers partagés ✓
   - c) MQTT
   - d) OPC

9. Que remplace OCMC ?
   - a) IDE
   - b) System Management Console (SMC) ✓
   - c) InTouch OMI
   - d) Historian Client

10. Pour une bascule testée régulièrement, à quelle fréquence minimum ?
    - a) 1x/an
    - b) 1x/trimestre ✓
    - c) 1x/mois
    - d) Jamais nécessaire

---

## CLÔTURE

### CL-01 · Récap par niveau
- **Niveau 1** : installation, templates, instances, deploy, bases alarmes
- **Niveau 2** : scripts, redondance CPU, historian corrigé, export d'objets
- **Niveau 3** : RDI, sécurité, GAMP 5, recovery, snapshots

### CL-02 · Prochaines étapes
- Passer les 3 quiz avec score ≥ 80%
- Faire les 3 exercices sur la VM
- Soutenance orale 30 min avec un référent Dasolabs
- Certification interne Dasolabs AVEVA SP

### CL-03 · Ressources
- VM Cloud Dasolabs : `vm-formation-sp.dasolabs.be` (contacter Ops)
- Doc officielle AVEVA : docs.aveva.com (login partenaire)
- Référents internes : Yoann (technique), Jordan (OT), Gérald (projet)

### CL-04 · Suivi
- Formation suivie dans `/training` du HUB Dasohub
- Progression trackée automatiquement
- Certificat généré en PDF à la fin

---

## ANNEXES À PRODUIRE

Checklist des choses à ajouter dans la version PPTX finale :

- [ ] **Screenshots réels** à faire sur une VM 2023R2 pour :
  - IDE avec les statuts "V" (noir / bleu / vert)
  - OCMC avec les métriques CPU / scan
  - Création d'un derived template
  - Configuration RDI étape par étape
  - Audit trail SSMS avec requête aaAudit

- [ ] **Préparer VM dans le cloud** avec :
  - Windows Server 2022
  - SQL Server 2019
  - AVEVA System Platform 2023R2
  - Licences serveur configurées
  - Snapshot "clean" pour reset entre apprenants

- [ ] **Supprimer** de la version 1 :
  - Toute mention de "ArchestrA" seul (utiliser "SP")
  - Mentions "5100" (port qui n'existe pas)
  - Mentions "Rate deadband", "Time deadband", "Interpolation deadband"
  - "DINetwork" en nom d'objet
  - Terme "en production" pour les attributs
  - U3 2017 (obsolète)
  - Mixes de screenshots de versions différentes

- [ ] **Corriger les quiz** : les mauvaises réponses officielles signalées par Yoann sont toutes rectifiées ci-dessus (points 1 à 7 dans son retour)

- [ ] **Ajouter** chapitres :
  - Export/import objets (load/dump)
  - Sécurité complète
  - Redondance comm & AOS
  - Snapshots & recovery
  - Exemples concrets dans chaque chapitre (actuellement absents)
