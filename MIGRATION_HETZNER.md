# Migration Vercel → Hetzner VPS + Coolify

Guide complet pour héberger Dasohub sur ton propre VPS européen.

## TL;DR — Setup final

- **VPS Hetzner CX22** : 4 vCPU / 8 GB / 80 GB SSD / 20 TB traffic — ~6 €/mois HT — DC Falkenstein (DE) ou Helsinki (FI)
- **Coolify** (PaaS auto-hébergé) sur le VPS — git push → redéploiement auto comme Vercel
- **PostgreSQL** : tu gardes Neon EU OU tu le self-host sur le même VPS (au choix)
- **HTTPS** : Caddy automatique via Coolify (Let's Encrypt)
- **Backups** : pg_dump quotidien vers Scaleway Object Storage Paris (~1 €/mois)

Total : ~7-10 €/mois HT pour un setup pro, RGPD, souverain.

---

## Étape 1 — Créer le VPS Hetzner (15 min)

1. Crée un compte sur **https://console.hetzner.cloud/**. CB requise mais facturation au prorata, pas de minimum.
2. **New Project** → "Dasohub"
3. **Add server** :
   - Location : **Falkenstein** (DE, le plus proche de la Belgique) ou Helsinki/Nuremberg
   - Image : **Ubuntu 24.04**
   - Type : **CX22** (4 vCPU dédié, 8 GB RAM, 80 GB SSD) — 5,83 € HT/mois
   - SSH Key : ajoute ta clé publique (`cat ~/.ssh/id_ed25519.pub`)
   - Firewalls : crée-en un qui autorise SSH (port 22) + HTTP (80) + HTTPS (443)
   - Name : `dasohub-prod`
4. **Create & Buy now** → environ 30 sec → IP publique affichée
5. Connecte-toi : `ssh root@<IP>`

## Étape 2 — Installer Coolify (10 min)

Une fois loggé sur le VPS en root :

```bash
# Update système
apt update && apt upgrade -y

# Installation Coolify (officiel, signé, idempotent)
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Le script install Docker, Coolify, Caddy. À la fin il affiche une URL `http://<IP>:8000`.

1. Ouvre cette URL dans ton navigateur
2. Crée le compte admin (premier utilisateur)
3. Tu es dans le dashboard Coolify

## Étape 3 — Configurer le domaine (5 min)

Tu veux servir Dasohub sur `erp.dasolabs.com` (ou autre).

1. Va chez ton registrar (Gandi, OVH, etc.)
2. Crée un enregistrement **DNS A** : `erp.dasolabs.com` → `<IP du VPS Hetzner>`
3. TTL court (300 sec) pour la première fois

Dans Coolify → **Settings → Instance Settings → Domain** : indique `erp.dasolabs.com`. Caddy générera automatiquement le certificat Let's Encrypt.

## Étape 4 — Connecter ton GitHub (5 min)

Coolify → **Sources → New** → GitHub App → autorise sur le repo `idrunkgd/DASOERP`.

## Étape 5 — Déployer Dasohub (10 min)

Dans Coolify :

1. **Projects → New Project** : "Dasohub"
2. **New Resource → Application → Public Repository**
3. Repository : `https://github.com/idrunkgd/DASOERP`
4. Branch : `main`
5. **Build pack** : Dockerfile (Coolify va lire ton Dockerfile à la racine — il est dans `app/Dockerfile`)
   - Si Coolify se plaint : configure **Base Directory** = `/app`
6. **Port** : 3000
7. **Environment Variables** — recopie depuis Vercel toutes tes envs :
   ```
   DATABASE_URL=postgres://...
   NEXTAUTH_SECRET=...
   NEXTAUTH_URL=https://erp.dasolabs.com
   GROQ_API_KEY=...
   GOOGLE_API_KEY=...   (si configurée pour Gemini OCR/CV)
   ANTHROPIC_API_KEY=...  (si configurée)
   MAILGUN_WEBHOOK_KEY=... (si configuré)
   ```
8. **Domain** : `https://erp.dasolabs.com`
9. **Deploy**

Premier build prend ~5-10 min. Suis les logs dans Coolify. Quand le healthcheck `/api/health` passe au vert, ton ERP est en ligne sur `https://erp.dasolabs.com`.

## Étape 6 — Auto-deploy sur git push (déjà fait)

Coolify a configuré un webhook GitHub pour rebuilder automatiquement quand tu push sur `main`. Plus rapide que Vercel (~3 min en moyenne).

## Étape 7 — Backups Postgres (10 min)

### Option A — Tu gardes Neon EU

Rien à faire — Neon fait des backups point-in-time inclus, en EU (Frankfurt).

### Option B — Tu self-host Postgres sur le VPS

Dans Coolify :
1. **New Resource → Database → PostgreSQL 17**
2. Note l'URL interne (`postgres://<user>:<pwd>@<host>:5432/<db>`)
3. Met à jour `DATABASE_URL` de l'application Dasohub
4. Migration des données depuis Neon :
   ```bash
   # Sur ton Mac local
   pg_dump $NEON_URL > dasohub-backup.sql
   # Copie vers le VPS
   scp dasohub-backup.sql root@<IP>:/tmp/
   # Sur le VPS
   docker exec -i <postgres-container-id> psql -U <user> -d <db> < /tmp/dasohub-backup.sql
   ```

**Backups auto vers Scaleway** (optionnel mais recommandé) :

```bash
# Sur le VPS, ajoute un cron quotidien
cat > /etc/cron.daily/dasohub-backup << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d-%H%M)
docker exec <postgres-container> pg_dump -U <user> <db> | gzip > /tmp/dasohub-$DATE.sql.gz
# Upload Scaleway Object Storage
aws s3 cp /tmp/dasohub-$DATE.sql.gz s3://dasohub-backups/ \
  --endpoint-url https://s3.fr-par.scw.cloud
rm /tmp/dasohub-$DATE.sql.gz
EOF
chmod +x /etc/cron.daily/dasohub-backup
```

## Étape 8 — Vérifications post-migration

- [ ] `https://erp.dasolabs.com` répond avec login Dasohub
- [ ] Connexion OK avec ton compte admin
- [ ] `/api/health` répond `{"status":"ok","db":"up"}`
- [ ] Création d'un client / d'une offre / d'un milestone fonctionne
- [ ] PDF s'exporte correctement
- [ ] Chatbot répond (vérifie que GROQ_API_KEY est bien dans les env vars Coolify)
- [ ] Toutes tes données migrées (si tu as migré Neon → Postgres self-host)

## Étape 9 — Couper Vercel (quand tout marche)

Quand tu es confiant que Hetzner fonctionne depuis ~1 semaine :

1. Sur Vercel : Project Settings → Delete Project (ou simplement Pause)
2. Si tu utilises encore Neon : tu peux le garder (option redondante) ou le supprimer
3. Sauvegarde locale du repo + d'un dump récent de la DB **avant** de couper quoi que ce soit

---

## Coûts comparés (par mois HT)

| Item | Vercel actuel | Hetzner setup |
|------|---------------|---------------|
| Hosting Next.js | $20 (Pro) | 5,83 € (CX22) |
| DB Postgres | Neon Free→Pro $19 | inclus dans VPS OU Neon EU 0-19 € |
| Object Storage backups | — | ~1 € (Scaleway) |
| Domaine | (déjà payé) | (déjà payé) |
| **Total** | **~35 €** | **~7-10 €** |

Économie : ~25 €/mois = 300 €/an, **et** tu gagnes la souveraineté.

## Inconvénients à connaître

- **Tu deviens responsable du VPS** : si Hetzner Falkenstein a une coupure réseau, ton ERP est down. Hetzner a ~99,9% d'uptime (~8h down/an max).
- **OS à maintenir** : `apt upgrade` régulièrement, sécurité, fail2ban. Coolify aide mais pas magique.
- **Pas d'Edge Network** : Vercel a un CDN global, ici tu serves depuis Falkenstein. Latence ~50ms supplémentaires pour des users en Australie. Pour Dasolabs (équipe Belgique), zéro impact.

## Si jamais tu veux revenir sur Vercel

Le code reste 100% compatible Vercel. Tu peux pivoter à tout moment :
```bash
vercel link
vercel --prod
```

Bonne migration ! 🚀
