#!/usr/bin/env bash
# One-time server setup for Ubuntu 24.04 LTS. Run as a sudo-capable user from the project root:
#   sudo ./scripts/install.sh example.com admin@example.com
set -euo pipefail

DOMAIN="${1:-}"; EMAIL="${2:-}"
if [[ -z "$DOMAIN" ]]; then echo "Usage: sudo $0 <domain> [contact-email]"; exit 1; fi
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

log "Installing system packages and automatic security updates"
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl gnupg ufw unattended-upgrades fail2ban openssl git
dpkg-reconfigure -f noninteractive unattended-upgrades
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'CONF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
CONF

if ! command -v docker >/dev/null; then
  log "Installing Docker Engine + Compose plugin (official repository)"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" >/etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
fi

log "Configuring firewall (SSH, HTTP, HTTPS only)"
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
systemctl enable --now fail2ban

if [[ ! -f .env ]]; then
  log "Creating .env with generated secrets"
  cp .env.example .env
  rand() { openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c "$1"; }
  sed -i "s|^SERVER_NAME=.*|SERVER_NAME=${DOMAIN}|" .env
  sed -i "s|^SITE_URL=.*|SITE_URL=https://${DOMAIN}|" .env
  [[ -n "$EMAIL" ]] && sed -i "s|^CONTACT_EMAIL=.*|CONTACT_EMAIL=${EMAIL}|" .env
  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(rand 40)|" .env
  sed -i "s|^INTERNAL_API_SECRET=.*|INTERNAL_API_SECRET=$(rand 48)|" .env
  chmod 600 .env
else
  log ".env already exists — keeping it"
fi

if [[ ! -f deploy/certs/fullchain.pem ]]; then
  log "Creating a temporary self-signed certificate so nginx can start (replace it — see docs/SSL.md)"
  openssl req -x509 -nodes -newkey rsa:2048 -days 30 -subj "/CN=${DOMAIN}" \
    -keyout deploy/certs/privkey.pem -out deploy/certs/fullchain.pem
  chmod 600 deploy/certs/privkey.pem
fi

log "Building images"
GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M)"
sed -i "s|^APP_TAG=.*|APP_TAG=${GIT_SHA}|" .env
docker compose build app migrate

log "Starting database and applying migrations"
docker compose up -d db
docker compose --profile tools run --rm migrate

log "Starting the application and nginx"
docker compose up -d app nginx

log "Installing daily backup cron job (03:15, keeps 14 days)"
cat >/etc/cron.d/toolorbit-backup <<CRON
15 3 * * * root cd ${ROOT} && ./scripts/backup.sh >> /var/log/toolorbit-backup.log 2>&1
CRON

log "Done. Next steps:"
cat <<TXT
  1. Create the first administrator (prompts for a password):
       docker compose --profile tools run --rm migrate npm run admin:create
  2. Install a real TLS certificate (docs/SSL.md), then: docker compose restart nginx
  3. Point DNS / Cloudflare at this server (docs/DOMAIN.md, docs/CLOUDFLARE.md)
  4. Health check: curl -k https://${DOMAIN}/api/health
TXT
