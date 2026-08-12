#!/usr/bin/env bash
#
# Шинэ хувилбар гаргах скрипт — сервер дээр ажиллуулна.
#   cd /var/www/bbuch-dash && sudo bash deploy/deploy.sh
#
# Хийх зүйл: git pull → npm ci → next build → PM2 reload.
# Build амжилтгүй бол ХУУЧИН хувилбар үргэлжлүүлэн ажиллана (reload хийхгүй).

set -euo pipefail

APP_NAME="bbuch-dash"
APP_DIR="/var/www/${APP_NAME}"
BRANCH="${1:-main}"

cd "${APP_DIR}"

if [[ ! -f .env.local ]]; then
  echo "❌ ${APP_DIR}/.env.local олдсонгүй." >&2
  echo "   cp .env.example .env.local  → дараа нь утгуудыг бөглөнө үү." >&2
  exit 1
fi

echo "▶ 1/4  Код татах (${BRANCH})"
git fetch --prune origin
git checkout "${BRANCH}"
git reset --hard "origin/${BRANCH}"

echo "▶ 2/4  Хамаарлууд"
# package-lock.json-той яг тааруулна — санамсаргүй хувилбар өөрчлөгдөхгүй.
npm ci

echo "▶ 3/4  Build"
# Жижиг сервер дээр Node-ын үндсэн heap хүрэлцдэггүй.
export NODE_OPTIONS="--max-old-space-size=2048"
export NODE_ENV=production
# Хуучин build-ын үлдэгдэл шинэтэй холилдохоос сэргийлнэ.
rm -rf .next
npm run build

# ТАЙЛБАР: `npm run db:push`-ыг ЭНД ЗОРИУДААР дуудахгүй. Drizzle push нь
# багана/хүснэгт устгах SQL үүсгэж чаддаг бөгөөд баталгаажуулалт асуудаг тул
# скриптэд гацна. Схем өөрчлөгдсөн үед ГАРААР, гаралтыг нь уншаад ажиллуулна:
#     cd /var/www/bbuch-dash && npm run db:push

echo "▶ 4/4  PM2"
if pm2 describe "${APP_NAME}" >/dev/null 2>&1; then
  pm2 reload "${APP_NAME}" --update-env
else
  pm2 start deploy/ecosystem.config.js
  pm2 save
  # Сервер дахин асахад PM2 автоматаар хөөрнө.
  pm2 startup systemd -u root --hp /root | tail -1 | bash || true
fi

sleep 3
echo ""
echo "▶ Эрүүл мэндийн шалгалт:"
curl -fsS http://127.0.0.1:3000/api/health || {
  echo ""
  echo "❌ Апп хариу өгсөнгүй. Лог: pm2 logs ${APP_NAME} --lines 50" >&2
  exit 1
}
echo ""
echo "✅ Deploy дууслаа — $(git rev-parse --short HEAD)"
