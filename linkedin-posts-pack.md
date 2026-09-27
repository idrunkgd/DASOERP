# Pack posts LinkedIn — Dasolabs

Six posts prêts à publier. Ton : direct, un peu ambitieux, sans buzzwords.
Format : hook fort en première ligne, corps concret, CTA final soft.

---

## 1. TECHNIQUE — Automation / PLC-SCADA

**Hook :**
Un PLC qui parle à un SCADA, c'est facile. Un SCADA qui parle à un MES, plus rare. Un MES qui parle à un UNS, c'est là que ça devient intéressant.

**Corps :**
Chez Dasolabs, on ne fait pas juste "de l'automatisme". On construit la chaîne complète :

▸ PLC (Siemens, Rockwell, Schneider)
▸ SCADA (WinCC, AVEVA, Ignition)
▸ MES / Batch (ISA-88, ISA-95, GAMP 5)
▸ UNS / MQTT (HighByte, Sparkplug)

Chaque couche a ses conventions. Chaque intégration fait perdre du contexte si on ne s'y prend pas bien.

Ce qu'on essaie de faire : que l'alarme qui remonte au superviseur pharma le mardi à 3h porte encore le batch, le produit, la ligne et l'opérateur — pas juste "Tag_12734 = TRUE".

**CTA :**
Si vous digitalisez une ligne pharma, chimie ou food ces prochains mois, on peut peut-être vous éviter deux mois de re-conception. Ça se discute en 30 min.

---

## 2. ÉQUIPE — Ambition 6 → 12

**Hook :**
On est 6. On sera 12 fin 2027.

**Corps :**
Ce n'est pas un chiffre choisi pour faire joli. C'est le nombre qui nous permet de faire notre métier correctement :

▸ Servir nos clients pharma sans être en flux tendu permanent
▸ Continuer à investir en R&D (bibliothèques ALERT, tooling interne)
▸ Garder une pyramide des âges qui a du sens (juniors qui montent, seniors qui transmettent)
▸ Rester belge, indépendant, sans levée de fonds

Doubler la taille, ce n'est pas juste embaucher. C'est structurer :
▸ Onboarding qui prend 15 jours et pas 6 mois
▸ Cadres de mission clairs pour chaque consultant
▸ HUB interne (notre ERP) qui automatise tout ce qui peut l'être
▸ Formation continue budgétée dès le premier jour

**CTA :**
On recrute deux profils automation d'ici Q1 2027. Si vous voulez rejoindre une boîte qui construit plutôt qu'une qui court, on en parle en MP.

---

## 3. RETOUR CLIENT — Cas d'usage anonymisé

**Hook :**
Un site pharma. 8 lignes de production. Une alarme qui remonte toutes les 4 secondes en pic de batch. Le superviseur qui ferme les yeux.

**Corps :**
On a été appelés il y a 6 mois. Le diagnostic était partagé : trop d'alarmes, pas assez d'action.

Ce qu'on a fait :

▸ Cartographié 100% des tags qui remontent — 62% étaient du bruit
▸ Introduit la hiérarchisation ISA-95 : site → ligne → équipement → tag
▸ Reconfiguré les seuils avec les opérateurs, pas dans un bureau
▸ Enrichi chaque alarme avec le contexte batch (produit, phase, N° lot)
▸ Formé les équipes qualité au nouvel outil

Résultat 3 mois plus tard : 78% de bruit en moins. Les alarmes critiques traitées en moyenne 4× plus vite. Et surtout, un superviseur qui recommence à faire confiance à son système.

**CTA :**
Si vous vivez la même chose sur votre site — trop d'alarmes, opérateurs désengagés — on peut faire l'audit en une journée sur site. C'est notre spécialité.

---

## 4. PARTENARIAT — Annonce Micromédia ALERT

**Hook :**
On a une nouvelle qu'on peut enfin partager.

**Corps :**
Dasolabs entame des discussions avancées avec Micromédia (France) pour reprendre la distribution complète d'ALERT en Belgique.

ALERT, pour ceux qui ne connaissent pas, c'est une solution de gestion des alarmes industrielles qui équipe déjà des sites pharma et chimiques majeurs — dont UCB, où nous l'intégrons depuis plusieurs années.

Ce que ça veut dire concrètement :
▸ Le dev, le support, la vente et le suivi client en Belgique, sous un même toit — chez nous
▸ De la R&D produit belge : bibliothèques PLC_ALERT natives, templates pharma, intégration UNS
▸ Un centre de formation ALERT — pour que d'autres intégrateurs puissent aussi le déployer proprement
▸ Rendez-vous officiel le 22 octobre à Paris pour la suite

Rien n'est signé. Mais l'idée est belle : faire d'ALERT le standard belge de la gestion d'alarmes industrielles, avec une équipe locale, bilingue et technique.

**CTA :**
Si vous exploitez déjà ALERT ou si vous cherchez à améliorer la gestion des alarmes sur votre site, on est preneurs d'échanger. Même en amont — nos meilleurs choix produit viennent toujours de discussions client.

---

## 5. RECRUTEMENT — Justin & Michael

**Hook :**
On cherche deux personnes. Ce ne sont pas des offres d'emploi comme les autres.

**Corps :**
Profil #1 — Senior ALERT / SCADA (priorité haute)
▸ Vous avez déjà intégré ALERT ou un système équivalent
▸ Vous êtes à l'aise avec un PLC Siemens ET une discussion client
▸ Vous voulez porter un produit, pas juste "faire des projets"
▸ Belgique, présentiel partiel possible

Profil #2 — Automation & Support (priorité moyenne)
▸ Bases solides PLC (Siemens ou Rockwell)
▸ Français ou néerlandais courant, anglais technique
▸ Vous aimez résoudre le problème d'un client au téléphone autant qu'écrire du code
▸ Belgique

Ce qu'on offre :
▸ Une équipe où chaque personne compte (on est 6, on sera 12)
▸ Salaire aligné marché + package voiture + package formation
▸ Un vrai projet produit — pas une SS2I qui te loue chez le plus offrant
▸ Un HUB interne pour arrêter de perdre son temps sur l'administratif

**CTA :**
Vous ou quelqu'un que vous connaissez ? Envoyez-nous un message. Les CV parfaits ne nous intéressent pas — les vrais parcours, oui.

---

## 6. CULTURE — Comment on bosse

**Hook :**
On a écrit 34 pages de politique interne. On n'en applique que trois vraiment.

**Corps :**
Les trois qui comptent :

▸ **Un consultant, une mission, un client à la fois.** On ne saute pas de mission tous les 3 mois. On ne se disperse pas. On livre.

▸ **Le rendu vaut plus que le rendu.** Si tu passes 40h sur un livrable moyen, on préfère 30h sur un excellent. Le "présentéisme technique", très peu pour nous.

▸ **Tout ce qui peut être automatisé doit l'être.** Nos timesheets, nos factures, nos NDF, nos plannings — tout passe par notre HUB interne. Zéro Excel qui traîne dans un mail.

Le reste (télétravail, congés, RTT, formations) — on l'aligne sur ce qui est bon pour toi et bon pour l'équipe. Pas de règle rigide pour montrer qu'on a un règlement.

Ce qui compte : que dans 5 ans, tu puisses dire "j'ai grandi chez Dasolabs" et que ce soit vrai.

**CTA :**
Curieux de nos coulisses ? On ouvre les portes en janvier — 3 postes à pourvoir. MP pour en parler.

---

## Notes de publication

- **Ordre suggéré** : 1 (technique) → 3 (retour client) → 4 (partenariat) → 2 (équipe) → 5 (recrutement) → 6 (culture)
- **Rythme** : 1 par semaine, mardi ou mercredi matin
- **Hashtags** à ajouter en fin selon le post :
  - Technique : #automation #industrialIT #manufacturing #alarms
  - Équipe : #startup #belgium #dasolabs #industrialTech
  - Client : #pharma #automation #uns #isa95
  - Partenariat : #alarms #alert #partnership
  - Recrutement : #hiring #automation #belgium
  - Culture : #culture #consulting #industrial
- **Visuel** conseillé : photo équipe pour post 2 & 6, capture technique (schéma alarme) pour 1 & 3, logo Micromédia pour 4.
