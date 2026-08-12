#!/usr/bin/env bash
#
# Ubuntu сервер дээр НЭГ УДАА ажиллуулах бэлтгэл скрипт.
# Node 20, PostgreSQL, Nginx, PM2-г суулгаад, апп-ын фолдер, лог, галт хана,
# swap-ыг тохируулна. Дахин ажиллуулж болно (idempotent).
#
# Ашиглах:
#   sudo bash deploy/setup-server.sh
#
# Үүний ДАРАА: .env.local бөглөх → deploy/deploy.sh ажиллуулах.

set -euo pipefail

APP_NAME="bbuch-dash"
APP_DIR="/var/www/${APP_NAME}"
LOG_DIR="/var/log/${APP_NAME}"
DB_NAME="bid_tuslay"
DB_USER="bbuch"
REPO_URL="https://github.com/Erdenebayar0930/bbuch_dash.git"
NODE_MAJOR=20

if [[ $EUID -ne 0 ]]; then
  echo "❌ root эрхээр ажиллуулна уу: sudo bash deploy/setup-server.sh" >&2
  exit 1
fi

echo "▶ 1/8  Системийн багцууд"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git ca-certificates gnupg nginx postgresql postgresql-contrib ufw

echo "▶ 2/8  Node.js ${NODE_MAJOR}"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt "${NODE_MAJOR}" ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi
echo "   node $(node -v) / npm $(npm -v)"

echo "▶ 3/8  PM2"
command -v pm2 >/dev/null 2>&1 || npm install -g pm2

echo "▶ 4/8  Swap (build үед санах ой дутвал OOM болохоос сэргийлнэ)"
# 2GB-аас бага RAM-тай сервер дээр `next build` санах ой дуусгадаг.
if [[ ! -f /swapfile ]] && [[ "$(free -m | awk '/^Mem:/{print $2}')" -lt 2048 ]]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "   2GB swap нэмэгдлээ"
else
  echo "   swap шаардлагагүй эсвэл аль хэдийн байна"
fi

echo "▶ 5/8  PostgreSQL — ${DB_NAME} сан, ${DB_USER} хэрэглэгч"
systemctl enable --now postgresql
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
  DB_PASS="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
  sudo -u postgres psql -c "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';"
  echo ""
  echo "   ⚠ ЭНЭ НУУЦ ҮГИЙГ ХАДГАЛААРАЙ — дахин харагдахгүй:"
  echo "   DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
  echo ""
else
  echo "   ${DB_USER} хэрэглэгч аль хэдийн байна — нууц үг хэвээр"
fi
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
  || sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"

echo "▶ 6/8  Фолдер ба лог"
mkdir -p "${LOG_DIR}"
if [[ ! -d "${APP_DIR}/.git" ]]; then
  mkdir -p "$(dirname "${APP_DIR}")"
  git clone "${REPO_URL}" "${APP_DIR}"
else
  echo "   ${APP_DIR} аль хэдийн clone хийгдсэн"
fi

echo "▶ 7/8  Nginx"
if [[ ! -f /etc/nginx/sites-available/${APP_NAME} ]]; then
  cp "${APP_DIR}/deploy/nginx/bbuch-dash.conf" "/etc/nginx/sites-available/${APP_NAME}"
  ln -sf "/etc/nginx/sites-available/${APP_NAME}" "/etc/nginx/sites-enabled/${APP_NAME}"
  rm -f /etc/nginx/sites-enabled/default
  echo "   ⚠ /etc/nginx/sites-available/${APP_NAME} дотор DOMAIN.MN-г засна уу"
fi

echo "▶ 8/8  Галт хана"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

cat <<EOF

✅ Бэлтгэл дууслаа.

Дараагийн алхмууд:
  1. Nginx дээрх домэйнөө засах:
       sudo nano /etc/nginx/sites-available/${APP_NAME}   # DOMAIN.MN → өөрийн домэйн
       sudo nginx -t && sudo systemctl reload nginx

  2. Орчны хувьсагч бөглөх (энэ файл git-д ОРОХГҮЙ):
       sudo cp ${APP_DIR}/.env.example ${APP_DIR}/.env.local
       sudo nano ${APP_DIR}/.env.local
     DATABASE_URL, DATABASE_SSL=disable, Firebase-ийн бүх түлхүүрийг оруулна.

  3. Схем үүсгэх:
       cd ${APP_DIR} && npm ci && npm run db:push

  4. Апп-ыг ачаалах:
       sudo bash ${APP_DIR}/deploy/deploy.sh

  5. SSL (домэйн нь энэ сервер рүү заасны дараа):
       sudo apt-get install -y certbot python3-certbot-nginx
       sudo certbot --nginx -d DOMAIN.MN
EOF
