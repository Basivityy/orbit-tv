# Deployment on Ubuntu 24.04 LTS

This guide installs QuicklyTools on a fresh Ubuntu 24.04 VPS with Docker Compose:
**nginx** (TLS, rate limiting, micro-cache) → **Next.js app** → **PostgreSQL 17**.

## 1. Requirements

| Item | Minimum | Recommended for growth |
|---|---|---|
| CPU / RAM | 2 vCPU / 4 GB | 4 vCPU / 8 GB |
| Disk | 30 GB SSD | 80 GB NVMe |
| OS | Ubuntu 24.04 LTS | — |
| Domain | DNS you control | Cloudflare (free plan is enough) |

Most tools run in the visitor's browser, so server load is dominated by serving cached HTML and static files.

## 2. First installation

```bash
# as a sudo user on the server
git clone <your-repo-url> /opt/quicklytools-src
cd /opt/quicklytools-src/quicklytools        # the project directory
sudo ./scripts/install.sh example.com you@example.com
```

`install.sh` is idempotent and does the following:

1. Installs Docker Engine + Compose from Docker's official repository, `ufw`, `fail2ban`, and enables **unattended security upgrades**.
2. Opens only ports 22, 80 and 443.
3. Creates `.env` from `.env.example` with **random** database password and internal secret (`chmod 600`). No credentials are hard-coded anywhere.
4. Creates a temporary self-signed certificate so nginx can start.
5. Builds the images (tagged with the git commit), starts PostgreSQL, runs migrations, starts the app and nginx.
6. Installs a daily backup cron job.

### Create the first administrator

```bash
docker compose --profile tools run --rm migrate npm run admin:create
```

You are prompted for email, name and password (12+ characters, three character classes). The password is hashed with Argon2id; nothing is written to files. Run the same command again to reset a password (all of that user's sessions are revoked).

Then sign in at `https://example.com/admin`.

### Optional: seed editable copies of the static pages

```bash
docker compose --profile tools run --rm migrate npm run db:seed
```

(Not required — defaults are served from code until you edit a page.)

## 3. TLS and DNS

* **Cloudflare (recommended):** see [CLOUDFLARE.md](CLOUDFLARE.md) — use a Cloudflare Origin Certificate and SSL mode *Full (strict)*.
* **Without Cloudflare:** see [SSL.md](SSL.md) for Let's Encrypt.
* DNS records: see [DOMAIN.md](DOMAIN.md).

After installing a certificate: `docker compose restart nginx`.

## 4. Updating

```bash
./scripts/update.sh            # current branch
./scripts/update.sh main       # explicit branch
```

The script fast-forwards the code, builds a new image tagged with the commit hash, **backs up the database**, runs migrations, switches the app container, waits for `/api/health` and purges the nginx page cache. If the new version is unhealthy it **rolls back automatically**.

## 5. Rollback

```bash
./scripts/rollback.sh          # to the tag recorded before the last update
./scripts/rollback.sh a1b2c3d  # to any image tag still present (docker image ls quicklytools-app)
```

Migrations are written to be additive (new nullable columns/tables), so an older app version keeps working against a newer schema. If a migration ever must be undone, restore the pre-update backup:

```bash
./scripts/restore.sh backups/quicklytools-20261020T031500Z.sql.gz
```

## 6. Backups

* `scripts/backup.sh` writes a gzip'd `pg_dump` to `./backups` (mode 600) and deletes files older than `BACKUP_KEEP_DAYS` (default 14).
* Cron: `/etc/cron.d/quicklytools-backup` runs it daily at 03:15.
* **Copy backups off the server** (e.g. `rclone`/`restic` to S3-compatible storage). A backup on the same disk does not protect against disk loss.
* Test restores regularly with `scripts/restore.sh` on a staging server.

## 7. Health and monitoring

* `GET /api/health` → `200 {"status":"ok","db":"ok",…}` or `503` when the database is unreachable. Use it with UptimeRobot, Better Stack, etc.
* Docker restarts unhealthy containers (`restart: unless-stopped` + `HEALTHCHECK`).
* Logs: `docker compose logs -f app nginx` (rotated: 5 × 10 MB per container).
* Admin → **System errors** shows grouped client and server errors; **Audit log** records every admin action.

## 8. Configuration reference (`.env`)

| Variable | Purpose |
|---|---|
| `SERVER_NAME`, `SITE_URL` | Domain and canonical origin |
| `POSTGRES_*`, `DB_POOL_SIZE` | Database credentials and Prisma pool size |
| `INTERNAL_API_SECRET` | Protects the internal cache-refresh endpoint (≥32 chars) |
| `SSL_CERT`, `SSL_KEY` | Certificate paths inside the nginx container |
| `CF_API_TOKEN`, `CF_ZONE_ID` | Optional: purge Cloudflare after admin edits |
| `NEXT_PUBLIC_IPV6_TEST_URL` | Optional: IPv6-only endpoint for the IPv6 checker (build-time) |
| `ROBOTS_DISALLOW_ALL` | `true` on staging to block crawlers |
| `APP_TAG` | Image tag in use (managed by update/rollback) |

## 9. Security checklist

- [x] Only 22/80/443 open (ufw); database not published to the host
- [x] Automatic security updates, fail2ban for SSH
- [x] App runs as non-root, `no-new-privileges`, all Linux capabilities dropped
- [x] Argon2id passwords, HttpOnly/Secure/SameSite=Strict session cookies, account lockout, login rate limiting
- [x] CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy headers
- [x] Admin pages `no-store` + `noindex`, never cached by nginx or Cloudflare
- [ ] Use SSH keys only (`PasswordAuthentication no` in `/etc/ssh/sshd_config`)
- [ ] Off-site backups
- [ ] Review the privacy policy and terms with legal counsel

## 10. Scaling

* **Vertical first:** more CPU/RAM; raise `APP_MEMORY_LIMIT`, PostgreSQL `shared_buffers`.
* **CDN:** with Cloudflare caching HTML (see CLOUDFLARE.md) the origin only serves cache misses.
* **Horizontal:** run several `app` replicas behind nginx (`docker compose up -d --scale app=3`). For consistent ISR across replicas configure a shared Next.js `cacheHandler` (e.g. Redis) and switch the in-memory rate limiter to Redis; analytics buffering already works per instance.
* Load testing: see [LOAD-TESTING.md](LOAD-TESTING.md).
