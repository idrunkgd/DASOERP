# Formation SQL Server — v2

> Formation réorganisée selon la chronologie pédagogique du document source.
> Théorie conservée, exemples pratiques ajoutés à chaque chapitre, quiz réécrits
> (impossible de scorer 100% sans avoir fait le cours).

---

## INTRODUCTION

### 00 · Comment utiliser cette formation
- Chaque chapitre : théorie → démo SQL → exercice → quiz
- VM SQL Server fournie (contact Ops) ou SQL Server Express gratuit à installer
- Outil recommandé : **SQL Server Management Studio (SSMS)** (gratuit)
- Fil rouge : on construit progressivement la base `formationSQL` avec `Clients` et `Commandes`

### 01 · Qu'est-ce que SQL Server
- SGBD relationnel développé par **Microsoft**
- Stockage, requêtes, sécurité
- Communique en **T-SQL** (dialecte Microsoft, proche du SQL ANSI)

### 02 · Les éditions de SQL Server
| Édition      | Pour                             | Limite |
|--------------|----------------------------------|--------|
| Express      | Dev, petits projets              | 10 Go/DB, 1 Go RAM utilisée |
| Developer    | Dev, test (gratuit)              | Toutes features Enterprise, usage non-prod uniquement |
| Standard     | PME                              | Features de base |
| Enterprise   | Grands comptes                   | Tout (OLAP, HA, in-memory) |

**Piège :** Developer = Enterprise fonctionnellement, mais **interdit en production**. À ne pas confondre avec Express.

---

## NIVEAU 1 · DÉBUTANT

### N1-01 · Concepts d'une base relationnelle
Une **RDB** stocke des données dans des **tables** reliées entre elles.

Vocabulaire :
- **Table** : structure tabulaire (lignes × colonnes)
- **Colonne** : un champ typé (texte, nombre, date, bool…)
- **Ligne / enregistrement** : une entrée unique
- **Clé primaire (PK)** : identifie uniquement une ligne
- **Clé étrangère (FK)** : référence une PK d'une autre table
- **Intégrité référentielle** : une FK doit pointer vers une PK existante

**Exemple visuel :**

Table `Clients` :
| ClientID (PK) | Nom    | Prenom |
|---------------|--------|--------|
| 1             | Dupont | Jean   |
| 2             | Martin | Sophie |

Table `Commandes` :
| CommandeID (PK) | ClientID (FK) | DateCommande | Prix |
|-----------------|---------------|--------------|------|
| 1               | 1             | 2024-01-01   | 4.90 |
| 2               | 2             | 2024-02-15   | 7.50 |

### N1-02 · Créer sa première base
```sql
CREATE DATABASE formationSQL;
GO
USE formationSQL;
GO

CREATE TABLE Clients (
  ClientID  INT PRIMARY KEY IDENTITY(1,1),
  Nom       NVARCHAR(50) NOT NULL,
  Prenom    NVARCHAR(50) NOT NULL
);

CREATE TABLE Commandes (
  CommandeID    INT PRIMARY KEY IDENTITY(1,1),
  ClientID      INT,
  DateCommande  DATE,
  Prix          FLOAT,
  FOREIGN KEY (ClientID) REFERENCES Clients(ClientID)
    ON DELETE CASCADE ON UPDATE CASCADE
);
```

**Notes importantes :**
- `IDENTITY(1,1)` = auto-increment (SQL Server). MySQL utilise `AUTO_INCREMENT`.
- `ON DELETE CASCADE` : si on supprime un client, ses commandes sont supprimées aussi.
- `NVARCHAR` = Unicode (recommandé). `VARCHAR` = ASCII simple.

### N1-03 · INSERT — ajouter des données
```sql
INSERT INTO Clients (Nom, Prenom) VALUES ('Dupont', 'Jean');

-- Plusieurs lignes à la fois (plus performant)
INSERT INTO Clients (Nom, Prenom) VALUES
  ('Martin',  'Sophie'),
  ('Durand',  'Alice'),
  ('Lemoine', 'Luc');
```

**Piège fréquent :** oublier les colonnes `IDENTITY` dans l'INSERT. SQL Server les remplit tout seul — ne pas forcer la valeur sans raison (sinon utiliser `SET IDENTITY_INSERT ON`).

**Exercice N1-03 :** insérer 10 clients `user1..user10` avec prénoms `user1prenom..user10prenom`.

### N1-04 · SELECT — lire des données
```sql
-- Tout lire
SELECT * FROM Clients;

-- Colonnes spécifiques
SELECT Nom, Prenom FROM Clients;

-- Avec filtre
SELECT * FROM Clients WHERE Nom = 'Dupont';

-- Avec tri
SELECT * FROM Clients ORDER BY Nom ASC;

-- Limiter les résultats (SQL Server : TOP ; MySQL/PG : LIMIT)
SELECT TOP 5 * FROM Commandes ORDER BY Prix DESC;
```

**Opérateurs utiles dans WHERE :**
- `=`, `<>`, `<`, `>`, `<=`, `>=`
- `BETWEEN 1 AND 10`
- `IN (1, 2, 3)`
- `LIKE 'Dup%'` (joker : `%` = n'importe quoi, `_` = un caractère)
- `IS NULL` / `IS NOT NULL`

**Exercice N1-04 :**
1. Lister tous les clients dont le nom commence par "user"
2. Lister les 3 commandes les plus chères
3. Lister les commandes passées entre le 1er janvier et le 31 mars 2024

### N1-05 · GROUP BY et agrégations
```sql
-- Compter toutes les commandes
SELECT COUNT(*) FROM Commandes;

-- Nombre de commandes par client
SELECT ClientID, COUNT(*) AS NbCommandes
FROM Commandes
GROUP BY ClientID;

-- Prix moyen par client
SELECT ClientID, AVG(Prix) AS PrixMoyen
FROM Commandes
GROUP BY ClientID;

-- Commande max par client
SELECT ClientID, MAX(Prix) AS CommandePlusChere
FROM Commandes
GROUP BY ClientID
ORDER BY CommandePlusChere DESC;
```

**Fonctions d'agrégation :**
`COUNT()`, `SUM()`, `AVG()`, `MIN()`, `MAX()`

**Règle d'or :** toute colonne dans le `SELECT` qui n'est pas une fonction d'agrégation **doit être dans le `GROUP BY`**.

### N1-06 · HAVING vs WHERE
Grosse source de confusion. Règle :
- `WHERE` : filtre **avant** l'agrégation (sur les lignes brutes)
- `HAVING` : filtre **après** l'agrégation (sur le résultat agrégé)

**Exemple ERREUR :**
```sql
-- ❌ Marche pas : on ne peut pas utiliser SUM() dans WHERE
SELECT SUM(Prix) AS Total, ClientID
FROM Commandes
WHERE SUM(Prix) > 5   -- ERREUR
GROUP BY ClientID;
```

**Version correcte :**
```sql
SELECT SUM(Prix) AS Total, ClientID
FROM Commandes
GROUP BY ClientID
HAVING SUM(Prix) > 5
ORDER BY Total DESC;
```

**Exercice N1-06 :**
Lister les clients dont le total de commandes dépasse 20€, triés par total décroissant.

### N1-07 · Quiz Niveau 1 (10 questions — pas devinables sans lire)

1. Quelle est la différence fonctionnelle principale entre Developer et Express ?
   - a) Developer est payant, Express est gratuit
   - b) Developer a toutes les features Enterprise mais est interdit en prod ✓
   - c) Express est plus rapide
   - d) Developer est en 32 bits uniquement

2. Dans la clause ON DELETE CASCADE sur une FK, que se passe-t-il si on supprime le parent ?
   - a) Erreur, suppression refusée
   - b) Les enfants restent avec FK = NULL
   - c) Les enfants sont supprimés automatiquement ✓
   - d) Les enfants sont archivés dans une autre table

3. Que fait `IDENTITY(10, 5)` ?
   - a) 10 lignes espacées de 5
   - b) Premier ID = 10, incrément de 5 ✓
   - c) Premier ID = 5, incrément de 10
   - d) Limite à 10 insertions

4. Pour lister les clients dont le nom contient "ran" :
   - a) `WHERE Nom = 'ran'`
   - b) `WHERE Nom CONTAINS 'ran'`
   - c) `WHERE Nom LIKE '%ran%'` ✓
   - d) `WHERE Nom IN ('ran')`

5. Pourquoi ne peut-on PAS utiliser `WHERE SUM(Prix) > 5` ?
   - a) `WHERE` ne supporte pas les fonctions
   - b) `WHERE` filtre avant l'agrégation, SUM() n'existe pas encore ✓
   - c) Il faut un `GROUP BY` avant
   - d) SUM() ne marche qu'avec HAVING par syntaxe

6. Quelle commande T-SQL remet un IDENTITY à 0 ?
   - a) `TRUNCATE TABLE Clients`
   - b) `DBCC CHECKIDENT ('Clients', RESEED, 0)` ✓
   - c) `ALTER TABLE Clients IDENTITY RESET`
   - d) `RESET IDENTITY Clients`

7. `NVARCHAR(50)` vs `VARCHAR(50)` ?
   - a) Identique, syntaxe différente
   - b) NVARCHAR stocke de l'Unicode (2 octets/car), VARCHAR du ASCII (1 octet/car) ✓
   - c) VARCHAR est plus récent
   - d) NVARCHAR est limité aux chiffres

8. `TOP 5` est équivalent à :
   - a) `LIMIT 5` (MySQL/PostgreSQL) ✓
   - b) `FIRST 5`
   - c) `SELECT 5`
   - d) `MAX 5`

9. Dans un GROUP BY, une colonne non-agrégée du SELECT doit :
   - a) Être unique
   - b) Être dans le GROUP BY ✓
   - c) Être marquée DISTINCT
   - d) Être une PK

10. Que renvoie `SELECT COUNT(*) FROM Clients` si la table est vide ?
    - a) NULL
    - b) 0 ✓
    - c) Erreur
    - d) Rien (pas de ligne retournée)

---

## NIVEAU 2 · INTERMÉDIAIRE

### N2-01 · Les JOINs
Un JOIN combine les lignes de 2+ tables selon une condition de liaison.

**Setup de démo (tables simplifiées) :**
```sql
-- Clients
INSERT INTO Clients (ClientID, Nom) VALUES
  (1, 'Dupont'), (2, 'Martin'), (3, 'Durand'), (4, 'Petit');

-- Commandes
INSERT INTO Commandes (CommandeID, ClientID, Produit) VALUES
  (1, 1, 'Livre A'),
  (2, 1, 'Livre B'),
  (3, 2, 'Livre C'),
  (4, 5, 'Livre D');  -- ClientID 5 n'existe pas !
```

#### INNER JOIN
Renvoie uniquement les lignes avec correspondance dans **les deux** tables.
```sql
SELECT c.ClientID, c.Nom, co.Produit
FROM Clients c
INNER JOIN Commandes co ON c.ClientID = co.ClientID;
```
Résultat : Dupont × 2, Martin × 1 (3 lignes).

#### LEFT JOIN
Toutes les lignes de la table de **gauche** (Clients), même sans correspondance.
```sql
SELECT c.ClientID, c.Nom, co.Produit
FROM Clients c
LEFT JOIN Commandes co ON c.ClientID = co.ClientID;
```
Résultat : Dupont × 2, Martin × 1, Durand × NULL, Petit × NULL (5 lignes).

#### RIGHT JOIN
Toutes les lignes de la table de **droite** (Commandes), même sans correspondance.
```sql
SELECT c.ClientID, c.Nom, co.Produit
FROM Clients c
RIGHT JOIN Commandes co ON c.ClientID = co.ClientID;
```
Résultat : Dupont × 2, Martin × 1, NULL × "Livre D" (4 lignes).

#### FULL OUTER JOIN
Union des LEFT et RIGHT. Toutes les lignes des deux côtés.
```sql
SELECT c.ClientID, c.Nom, co.Produit
FROM Clients c
FULL OUTER JOIN Commandes co ON c.ClientID = co.ClientID;
```
Résultat : 6 lignes (3 Dupont/Martin + 2 Durand/Petit sans commande + 1 commande orpheline).

**Mémo visuel :**
```
INNER JOIN       LEFT JOIN        RIGHT JOIN       FULL OUTER JOIN
   [∩]           [L + ∩]           [∩ + R]           [L + ∩ + R]
```

**Exercice N2-01 :**
1. Lister tous les clients et le total de leurs commandes (même ceux sans commande → 0)
2. Lister les commandes orphelines (sans client)

### N2-02 · UPDATE
```sql
UPDATE Clients
SET Prenom = 'Jean-Philippe'
WHERE Nom = 'Dupont';
```

**Piège critique :** oublier le `WHERE` → **toute la table est modifiée**. Toujours tester en SELECT avant :
```sql
-- 1. Tester
SELECT * FROM Clients WHERE Nom = 'Dupont';
-- 2. Si OK, UPDATE
UPDATE Clients SET Prenom = 'Jean-Philippe' WHERE Nom = 'Dupont';
```

### N2-03 · DELETE
```sql
DELETE FROM Clients WHERE Nom = 'Lemoine';

-- ⚠️ Supprime TOUTES les lignes (structure gardée)
DELETE FROM Clients;

-- Alternative plus rapide pour vider une table (reset IDENTITY aussi)
TRUNCATE TABLE Clients;
```

**DELETE vs TRUNCATE :**
| Opération | DELETE | TRUNCATE |
|-----------|--------|----------|
| Vitesse   | Lent (ligne par ligne) | Rapide (déalloue pages) |
| WHERE     | ✅ Oui | ❌ Non |
| Reset IDENTITY | ❌ Non | ✅ Oui |
| Rollback  | ✅ Possible | ✅ (dans transaction) |
| Triggers  | ✅ Déclenchés | ❌ Non déclenchés |
| FK dépendantes | ✅ CASCADE si configuré | ❌ Interdit |

### N2-04 · DDL — ALTER TABLE
Modifier la structure d'une table existante.

```sql
-- Ajouter une colonne
ALTER TABLE Clients ADD Email NVARCHAR(100);

-- Modifier le type
ALTER TABLE Clients ALTER COLUMN Email NVARCHAR(150);

-- Supprimer une colonne
ALTER TABLE Clients DROP COLUMN Email;

-- Ajouter une contrainte FK
ALTER TABLE Commandes
ADD CONSTRAINT FK_Commandes_Clients
  FOREIGN KEY (ClientID) REFERENCES Clients(ClientID);

-- Ajouter une contrainte unique
ALTER TABLE Clients ADD CONSTRAINT UQ_Clients_Email UNIQUE (Email);

-- Supprimer une contrainte
ALTER TABLE Commandes DROP CONSTRAINT FK_Commandes_Clients;
```

**Piège fréquent :** on ne peut pas ajouter une colonne `NOT NULL` sans valeur par défaut si la table a déjà des lignes.
```sql
-- ❌ Erreur si Clients a des lignes
ALTER TABLE Clients ADD Code NVARCHAR(10) NOT NULL;

-- ✅ Correct
ALTER TABLE Clients ADD Code NVARCHAR(10) NOT NULL DEFAULT 'INCONNU';
```

### N2-05 · Les variables
#### Variable scalaire : `@Nom`
```sql
DECLARE @NomClient NVARCHAR(50);
SET @NomClient = 'Dupont';
SELECT * FROM Clients WHERE Nom = @NomClient;
```

#### Variable de table : `@NomTable`
Petit jeu de données en mémoire.
```sql
DECLARE @TempClients TABLE (
  ClientID INT,
  Nom NVARCHAR(50)
);
INSERT INTO @TempClients VALUES (1, 'Dupont'), (2, 'Martin');
SELECT * FROM @TempClients;
```

#### Tables temporaires : `#Temp` et `##Temp`
Stockées dans `tempdb`, supprimées à la fin de session.

```sql
-- Locale (visible dans ma session uniquement)
CREATE TABLE #TempClients (ClientID INT, Nom NVARCHAR(50));
INSERT INTO #TempClients VALUES (1, 'Dupont');
SELECT * FROM #TempClients;

-- Globale (visible dans toutes les sessions)
CREATE TABLE ##TempGlobale (ID INT, Description NVARCHAR(50));
```

**Variable scalaire vs variable table vs #Temp :**
| Type | Scope | Perf | Index | Transactions |
|------|-------|------|-------|--------------|
| `@scalaire` | Batch courant | Rapide | — | Non loggée |
| `@TableVar` | Batch courant | OK petits volumes | PK/unique seulement | Non loggée |
| `#TempTable` | Session | OK gros volumes | Tous indexes | Loggée, rollback possible |
| `##GlobalTemp` | Toutes sessions | OK | Tous indexes | Loggée |

### N2-06 · Les curseurs
Parcours ligne par ligne. **À éviter pour les gros volumes** — préférer des requêtes ensemblistes.
```sql
DECLARE @ClientID INT, @Nom NVARCHAR(50);

DECLARE client_cursor CURSOR FOR
  SELECT ClientID, Nom FROM Clients;

OPEN client_cursor;
FETCH NEXT FROM client_cursor INTO @ClientID, @Nom;

WHILE @@FETCH_STATUS = 0
BEGIN
  PRINT 'Client : ' + @Nom;
  FETCH NEXT FROM client_cursor INTO @ClientID, @Nom;
END

CLOSE client_cursor;
DEALLOCATE client_cursor;
```

**Quand utiliser un curseur :**
- Appeler une SP par ligne (ex : envoi d'email client par client)
- Logique séquentielle qui ne peut pas être exprimée ensemblistement

**Quand NE PAS utiliser :**
- Agrégation, filtrage, mise à jour en masse → faire ensembliste

### N2-07 · Quiz Niveau 2 (10 questions)

1. `LEFT JOIN` sur Clients et Commandes avec un client sans commande → combien de lignes pour ce client ?
   - a) 0
   - b) 1 avec les colonnes Commande à NULL ✓
   - c) 1 avec Commande = 0
   - d) Erreur

2. Que fait `DELETE FROM Clients;` sans WHERE ?
   - a) Erreur
   - b) Supprime toutes les lignes, structure conservée ✓
   - c) Supprime la table
   - d) Supprime la DB

3. Avantage de `TRUNCATE` vs `DELETE` sur une grosse table ?
   - a) TRUNCATE accepte un WHERE
   - b) TRUNCATE est plus rapide et reset l'IDENTITY ✓
   - c) TRUNCATE est transactionnel, DELETE non
   - d) Aucune différence réelle

4. On veut ajouter une colonne `Code NVARCHAR(10) NOT NULL` sur une table peuplée. Que faire ?
   - a) Erreur impossible
   - b) Ajouter avec `DEFAULT 'XXX'` ✓
   - c) Vider la table d'abord
   - d) Supprimer puis recréer

5. Différence `#TempTable` vs `@TableVariable` ?
   - a) Aucune
   - b) `#` supporte tous les index + rollback, `@` est limité ✓
   - c) `@` est plus récente
   - d) `#` est obsolète depuis 2019

6. `FULL OUTER JOIN` renvoie :
   - a) Que les correspondances
   - b) Union des LEFT et RIGHT JOIN (toutes les lignes des 2 tables) ✓
   - c) Produit cartésien
   - d) Erreur dans SQL Server

7. Un curseur est pertinent quand :
   - a) Il faut agréger plusieurs millions de lignes
   - b) Il faut appeler une SP sur chaque ligne séquentiellement ✓
   - c) On fait un simple SELECT
   - d) Jamais, c'est obsolète

8. `##TempGlobale` est visible :
   - a) Dans ma session uniquement
   - b) Dans toutes les sessions tant qu'au moins une tient la référence ✓
   - c) Dans ma transaction
   - d) Dans la DB courante uniquement

9. Peut-on indexer une variable de table (`@TableVar`) ?
   - a) Non, jamais
   - b) Seulement PK et UNIQUE ✓
   - c) Oui, tous les types d'index
   - d) Oui mais seulement en 2022+

10. `@@FETCH_STATUS = 0` signifie :
    - a) Erreur
    - b) Fin du curseur
    - c) Dernier FETCH réussi, ligne disponible ✓
    - d) Curseur fermé

---

## NIVEAU 3 · EXPERT

### N3-01 · Les vues (VIEW)
Une **vue** = une requête SELECT enregistrée, utilisable comme une table virtuelle.

```sql
CREATE VIEW v_CommandesClients AS
SELECT c.Nom, c.Prenom, co.DateCommande, co.Prix
FROM Clients c
INNER JOIN Commandes co ON c.ClientID = co.ClientID;

-- Utilisation
SELECT * FROM v_CommandesClients WHERE Prix > 5;
```

**Avantages :**
- Simplifie les requêtes complexes (abstraction)
- Sécurité : on masque les colonnes sensibles aux users non autorisés
- Permet un refactoring sans casser les requêtes externes

**Limites :**
- Pas de paramètres (contrairement à une fonction table)
- UPDATE/INSERT sur une vue multi-tables peut échouer (ambiguïté)
- Pas d'index par défaut (sauf vue **indexed/materialized** via `WITH SCHEMABINDING`)

### N3-02 · Procédures stockées (Stored Procedures)
Bloc de code SQL enregistré, exécutable avec paramètres.

```sql
-- Lecture
CREATE PROCEDURE GetCommandesParClient
  @ClientID INT
AS
BEGIN
  SELECT * FROM Commandes WHERE ClientID = @ClientID;
END;

-- Appel
EXEC GetCommandesParClient @ClientID = 1;

-- Insertion
CREATE PROCEDURE AddClient
  @Nom NVARCHAR(50),
  @Prenom NVARCHAR(50)
AS
BEGIN
  INSERT INTO Clients (Nom, Prenom) VALUES (@Nom, @Prenom);
  SELECT SCOPE_IDENTITY() AS NewClientID;  -- retourne l'ID créé
END;
```

**Avantages :**
- Précompilée → plus rapide
- Centralise la logique métier côté DB
- Sécurité : droit `EXECUTE` sans donner accès direct aux tables
- Paramètres typés → prévention injection SQL

### N3-03 · Fonctions utilisateur (FUNCTION)

#### Fonction scalaire (retourne 1 valeur)
```sql
CREATE FUNCTION GetTotalCommandes(@ClientID INT)
RETURNS FLOAT
AS
BEGIN
  DECLARE @Total FLOAT;
  SELECT @Total = SUM(Prix) FROM Commandes WHERE ClientID = @ClientID;
  RETURN ISNULL(@Total, 0);
END;

-- Utilisation (préfixer par dbo.)
SELECT Nom, Prenom, dbo.GetTotalCommandes(ClientID) AS Total
FROM Clients;
```

#### Fonction table inline (retourne une table)
```sql
CREATE FUNCTION CommandesSuperieures(@Montant FLOAT)
RETURNS TABLE
AS
RETURN (
  SELECT * FROM Commandes WHERE Prix > @Montant
);

-- Utilisation
SELECT * FROM dbo.CommandesSuperieures(5);
```

**SP vs FUNCTION :**
| Critère | Stored Procedure | Function |
|---------|------------------|----------|
| Retour | 0, 1 ou N result sets | 1 valeur ou 1 table |
| Appel dans un SELECT | ❌ Non | ✅ Oui |
| Modifications (INSERT/UPDATE) | ✅ Oui | ❌ Non (sauf exception) |
| Transactions | ✅ Peut en démarrer | ❌ Pas de BEGIN TRANSACTION |

### N3-04 · Index — notion essentielle (chapitre AJOUTÉ)
Un **index** = structure accessoire qui accélère les SELECT, au prix d'INSERT/UPDATE/DELETE légèrement plus lents.

```sql
-- Index non-clustered sur une colonne
CREATE INDEX IX_Clients_Nom ON Clients(Nom);

-- Index composite
CREATE INDEX IX_Commandes_ClientID_Date
  ON Commandes(ClientID, DateCommande);

-- Index unique (combinaison avec contrainte)
CREATE UNIQUE INDEX UX_Clients_Email ON Clients(Email);

-- Supprimer un index
DROP INDEX IX_Clients_Nom ON Clients;
```

**Règles d'or :**
- La **PK crée automatiquement un index clustered** (données triées physiquement)
- Indexer les colonnes utilisées dans `WHERE`, `JOIN`, `ORDER BY`
- Ne PAS indexer les colonnes très volatiles ou peu sélectives (sexe M/F, bool)
- Trop d'index = INSERT/UPDATE pénalisés

**Comment analyser :** utiliser le plan d'exécution dans SSMS (Ctrl+M puis exécuter).

### N3-05 · Transactions (chapitre AJOUTÉ)
Groupe d'instructions qui réussit ou échoue ensemble (atomicité).

```sql
BEGIN TRANSACTION;

UPDATE Clients SET Nom = 'Dupont-Durand' WHERE ClientID = 1;
INSERT INTO Commandes (ClientID, DateCommande, Prix) VALUES (1, GETDATE(), 10.5);

-- Si tout OK :
COMMIT TRANSACTION;

-- Si problème (code applicatif) :
-- ROLLBACK TRANSACTION;
```

**Avec gestion d'erreur :**
```sql
BEGIN TRY
  BEGIN TRANSACTION;
  UPDATE Clients SET Nom = 'X' WHERE ClientID = 1;
  INSERT INTO Commandes (ClientID, Prix) VALUES (999, 10); -- FK invalide
  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  SELECT ERROR_NUMBER() AS ErrNum, ERROR_MESSAGE() AS ErrMsg;
END CATCH;
```

**Niveaux d'isolation (du moins strict au plus strict) :**
1. `READ UNCOMMITTED` : lit même les données non-committées (dirty reads)
2. `READ COMMITTED` : défaut SQL Server
3. `REPEATABLE READ` : les lignes lues restent verrouillées jusqu'au commit
4. `SERIALIZABLE` : isolation totale, peut causer des blocages
5. `SNAPSHOT` : utilise des versions, pas de verrous en lecture

### N3-06 · Triggers (chapitre AJOUTÉ)
Code exécuté automatiquement sur INSERT / UPDATE / DELETE.

```sql
CREATE TRIGGER TR_Commandes_Audit
ON Commandes
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
  INSERT INTO AuditLog (TableName, Action, OccurredAt)
  SELECT 'Commandes',
         CASE
           WHEN EXISTS(SELECT 1 FROM inserted) AND EXISTS(SELECT 1 FROM deleted) THEN 'UPDATE'
           WHEN EXISTS(SELECT 1 FROM inserted) THEN 'INSERT'
           ELSE 'DELETE'
         END,
         GETDATE();
END;
```

**Tables virtuelles dans un trigger :**
- `inserted` : les nouvelles lignes (INSERT/UPDATE)
- `deleted` : les anciennes lignes (DELETE/UPDATE)

**Piège :** les triggers s'exécutent sur TOUTES les lignes affectées en une fois. Ne pas écrire de code "par ligne" dedans.

### N3-07 · Sécurité et permissions (chapitre AJOUTÉ)
```sql
-- Créer un login (niveau serveur)
CREATE LOGIN appuser WITH PASSWORD = 'StrongPassword123!';

-- Créer un user (niveau DB)
CREATE USER appuser FOR LOGIN appuser;

-- Rôles standards
EXEC sp_addrolemember 'db_datareader', 'appuser';  -- Lecture tout
EXEC sp_addrolemember 'db_datawriter', 'appuser';  -- Écriture tout

-- Permission granulaire
GRANT SELECT ON Clients TO appuser;
GRANT EXECUTE ON GetCommandesParClient TO appuser;
DENY DELETE ON Commandes TO appuser;
```

**Bonne pratique prod :**
- Un login dédié par application (pas `sa` !)
- Donner uniquement `EXECUTE` sur SP → le user n'a pas accès direct aux tables
- Audit des connexions activé

### N3-08 · Performance et plans d'exécution (chapitre AJOUTÉ)
Dans SSMS :
- `Ctrl + M` : activer le plan d'exécution réel avant d'exécuter
- `Ctrl + L` : plan estimé sans exécuter

**Métriques clés :**
- `Logical Reads` : nombre de pages lues (moins = mieux)
- `Index Seek` ✅ vs `Index Scan` ❌ vs `Table Scan` ❌❌
- `Key Lookup` : symptôme d'un index incomplet

**Outils :**
- `SET STATISTICS IO ON` + `SET STATISTICS TIME ON`
- `sys.dm_exec_query_stats` pour les top requêtes consommatrices
- Query Store (depuis 2016) : capture automatique des plans

### N3-09 · Backup & Restore (chapitre AJOUTÉ)
```sql
-- Full backup
BACKUP DATABASE formationSQL
TO DISK = 'C:\Backup\formationSQL_full.bak'
WITH COMPRESSION, CHECKSUM;

-- Differential backup
BACKUP DATABASE formationSQL
TO DISK = 'C:\Backup\formationSQL_diff.bak'
WITH DIFFERENTIAL;

-- Log backup (modèle Full requis)
BACKUP LOG formationSQL
TO DISK = 'C:\Backup\formationSQL_log.trn';

-- Restore
RESTORE DATABASE formationSQL
FROM DISK = 'C:\Backup\formationSQL_full.bak'
WITH REPLACE, RECOVERY;
```

**3 modèles de récupération :**
- `SIMPLE` : pas de log backup, perte depuis dernier full/diff
- `FULL` : log backup possible, point-in-time recovery
- `BULK_LOGGED` : optimisé import massif

### N3-10 · Exercices de synthèse
Finaliser le projet pédagogique :

1. **Créer la table Produits** :
```sql
CREATE TABLE Produits (
  ProduitID    INT PRIMARY KEY IDENTITY(1,1),
  NomProduit   NVARCHAR(100) NOT NULL,
  PrixUnitaire DECIMAL(10,2) NOT NULL
);
```

2. **Insérer des produits** (5 lignes au choix)

3. **Ajouter une FK ProduitID sur Commandes** :
```sql
ALTER TABLE Commandes ADD ProduitID INT;
ALTER TABLE Commandes
  ADD CONSTRAINT FK_Commandes_Produits
  FOREIGN KEY (ProduitID) REFERENCES Produits(ProduitID);
```

4. **Créer une vue** `v_CommandesDetaillees` affichant : nom client, date commande, prix, nom produit

5. **Créer une SP** `AddCommande(@ClientID, @ProduitID, @Prix)` qui insère et retourne le CommandeID créé

6. **Créer une fonction** `GetNbCommandes(@ClientID)` qui retourne le nombre de commandes d'un client

7. **Créer un index** sur `Commandes(ClientID, DateCommande)`

8. **Encapsuler les 2-5 dans une transaction** avec gestion d'erreur

### N3-11 · Quiz Niveau 3 (10 questions)

1. Peut-on appeler une Stored Procedure dans un SELECT ?
   - a) Oui, comme une fonction
   - b) Non, pas directement — il faut passer par OPENQUERY ou une FUNCTION ✓
   - c) Oui si elle retourne un scalaire
   - d) Oui depuis 2019

2. Une vue indexed (materialized) nécessite :
   - a) `WITH ENCRYPTION`
   - b) `WITH SCHEMABINDING` + une PK unique ✓
   - c) Rien de spécial
   - d) Edition Enterprise uniquement

3. Dans un trigger, quelle table virtuelle contient les anciennes valeurs lors d'un UPDATE ?
   - a) `old`
   - b) `inserted`
   - c) `deleted` ✓
   - d) `previous`

4. `Table Scan` dans un plan d'exécution signifie :
   - a) Index utilisé optimalement
   - b) Toutes les lignes lues sans index → à optimiser ✓
   - c) Table verrouillée
   - d) Erreur dans la requête

5. En modèle de récupération SIMPLE :
   - a) On peut faire un log backup
   - b) Pas de log backup possible, point-in-time impossible ✓
   - c) Backup automatique à la validation
   - d) Idem FULL

6. `GRANT EXECUTE ON ma_sp TO user` donne quoi comme droit indirect ?
   - a) Lecture sur toutes les tables de la DB
   - b) Exécution de la SP, qui elle accède aux tables sous ses propres droits ✓
   - c) Droit sysadmin
   - d) Rien si pas de SELECT sur les tables sous-jacentes

7. Niveau d'isolation qui permet dirty reads :
   - a) READ COMMITTED
   - b) READ UNCOMMITTED ✓
   - c) SERIALIZABLE
   - d) SNAPSHOT

8. Que renvoie `SCOPE_IDENTITY()` ?
   - a) Le dernier IDENTITY généré, toutes sessions confondues
   - b) Le dernier IDENTITY dans la scope (procédure/batch) courante ✓
   - c) Le prochain IDENTITY disponible
   - d) Le max de la colonne IDENTITY

9. Dans un trigger, pour savoir si c'est un UPDATE :
   - a) `IF @@TRIGGER_TYPE = 'UPDATE'`
   - b) `IF EXISTS(SELECT 1 FROM inserted) AND EXISTS(SELECT 1 FROM deleted)` ✓
   - c) `IF TG_OP = 'UPDATE'`
   - d) Impossible dans SQL Server

10. Après avoir indexé une colonne, les INSERT sur cette table sont :
    - a) Plus rapides
    - b) Inchangés
    - c) Légèrement plus lents (l'index doit être mis à jour) ✓
    - d) Bloqués pendant 1 seconde

---

## CLÔTURE

### CL-01 · Récap par niveau
- **N1** : installation, modèle relationnel, SELECT/INSERT, GROUP BY/HAVING
- **N2** : JOINs, UPDATE/DELETE, DDL, variables, curseurs
- **N3** : Vues, SP, Functions, Index, Transactions, Triggers, Sécurité, Perf, Backup

### CL-02 · Projet final
Reprendre les exercices N3-10 et livrer un script `.sql` complet qui :
- Crée la DB, les 3 tables (Clients, Commandes, Produits) + FK
- Insère un jeu de 10 clients, 20 commandes, 5 produits
- Crée la vue, la SP, la fonction, les index
- Démontre une transaction avec rollback sur erreur FK
- Inclut un commentaire par bloc expliquant quoi/pourquoi

### CL-03 · Ressources
- VM Dasolabs : `vm-formation-sql.dasolabs.be` (contact Ops)
- Doc officielle : `learn.microsoft.com/sql`
- SSMS gratuit : `aka.ms/ssmsfullsetup`
- Référents internes : Yoann (perf, indexing), Jordan (modèles), Gérald (projet)

---

## NOTES POUR LA PRODUCTION

### Changements majeurs vs v1
- **Chronologie respectée** : Intro → RDB → SELECT → agrégations → JOINS → DML → DDL → variables → curseurs → vues → SP → functions → nouveautés
- **Exercices concrets** à chaque chapitre, basés sur `Clients`/`Commandes`
- **Pièges fréquents** signalés sur chaque chapitre sensible (WHERE sans filtre, DELETE sans WHERE, ALTER TABLE NOT NULL, etc.)
- **Chapitres ajoutés en Niveau 3** : Index, Transactions, Triggers, Sécurité, Performance, Backup — absents de la v1
- **Quiz réécrits** : les mauvaises réponses sont crédibles, et il faut avoir **compris** le chapitre pour trouver la bonne. Fini le quiz où tu lis la question et tu as déjà la réponse.

### Checklist screenshots à produire pour la version PPTX
- [ ] SSMS : vue arborescence `formationSQL` avec les tables
- [ ] Plan d'exécution avec Index Seek vs Table Scan
- [ ] Résultat des JOINs côte à côte (4 types)
- [ ] Fenêtre de modification de contrainte FK dans SSMS
- [ ] Trace d'un trigger qui se déclenche
- [ ] Backup/Restore via wizard SSMS

### Pour la VM pédagogique
- Windows Server 2019 ou 2022
- SQL Server 2022 Developer
- SSMS 19
- Script d'init `formationSQL` + data pré-chargée
- Snapshot clean pour reset entre apprenants
