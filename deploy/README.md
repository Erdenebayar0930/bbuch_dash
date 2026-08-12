# Ubuntu сервер дээр байршуулах

Dashboard (`bbuch_dash`) -ыг өөрийн VPS дээр **Node 20 + PM2 + Nginx + PostgreSQL**
бүтцээр ажиллуулна. Апп нь `127.0.0.1:3000` дээр сонсож, Nginx нь 80/443-аас
дамжуулна.

```
Интернэт ──► Nginx (80/443, SSL) ──► Next.js (127.0.0.1:3000, PM2) ──► PostgreSQL (localhost)
```

Энэ фолдер дахь файлууд:

| Файл | Зориулалт |
|---|---|
| [setup-server.sh](setup-server.sh) | Сервер дээр **нэг удаа** ажиллах бэлтгэл (Node, PM2, Nginx, Postgres, swap, ufw) |
| [deploy.sh](deploy.sh) | Шинэ хувилбар гаргах бүрд ажиллана (pull → build → reload) |
| [ecosystem.config.js](ecosystem.config.js) | PM2 процессын тохиргоо |
| [nginx/bbuch-dash.conf](nginx/bbuch-dash.conf) | Nginx reverse proxy |

---

## 1. Урьдчилсан нөхцөл

- Ubuntu 22.04 / 24.04 VPS, root эсвэл sudo эрх
- Домэйн (жишээ `dash.bbuch.mn`) — A бичлэг нь серверийн IP рүү заасан байх
- Хамгийн багадаа **1GB RAM** (setup скрипт 2GB swap нэмнэ — `next build` санах ой их иддэг)

## 2. Серверийг бэлдэх (нэг удаа)

```bash
ssh root@СЕРВЕРИЙН_IP

git clone https://github.com/Erdenebayar0930/bbuch_dash.git /tmp/bbuch
sudo bash /tmp/bbuch/deploy/setup-server.sh
```

Скрипт нь Node 20, PM2, Nginx, PostgreSQL суулгаж, `bid_tuslay` сан болон
`bbuch` хэрэглэгчийг үүсгээд, **үүсгэсэн нууц үгээ нэг л удаа хэвлэнэ** —
заавал хуулж авна уу.

## 3. Орчны хувьсагч

```bash
cd /var/www/bbuch-dash
sudo cp .env.example .env.local
sudo nano .env.local
```

Бөглөх ёстой утгууд:

```ini
DATABASE_URL=postgresql://bbuch:НУУЦҮГ@localhost:5432/bid_tuslay
DATABASE_SSL=disable          # нэг серверийн дотор — SSL хэрэггүй
DATABASE_POOL_MAX=10

# Firebase — локал .env.local-оос яг хуулна
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=bbuch-edba7
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=bbuch-edba7.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_VAPID_KEY=...

FIREBASE_PROJECT_ID=bbuch-edba7
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@bbuch-edba7.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```

> ⚠️ `NEXT_PUBLIC_*` хувьсагчид **build хийх үед** кодод шигдэнэ. Тэдгээрийг
> өөрчилсөн бол зөвхөн PM2 restart хангалтгүй — `deploy.sh` дахин ажиллуулж
> build хийнэ.

> ⚠️ `FIREBASE_PRIVATE_KEY`-г **давхар хашилтад**, `\n` тэмдэгтүүдтэй нь хамт
> нэг мөрөнд бичнэ.

## 4. Схем үүсгэх

```bash
cd /var/www/bbuch-dash
npm ci
npm run db:push
```

Асуултад хариулж, үүсэх SQL-ийг **уншиж байж** зөвшөөрнө үү.
`drizzle.config.ts`-д `tablesFilter: ["!site_*"]` тавьсан тул website-ын
хүснэгтүүдэд хүрэхгүй.

## 5. Локал өгөгдлөө зөөх (шаардлагатай бол)

Windows дээрх локал сангаа сервер рүү хуулах:

```powershell
# Локал компьютер дээр
pg_dump -U postgres -h localhost -d bid_tuslay -Fc -f bbuch.dump
scp bbuch.dump root@СЕРВЕРИЙН_IP:/tmp/
```

```bash
# Сервер дээр
sudo -u postgres pg_restore -d bid_tuslay --no-owner --role=bbuch /tmp/bbuch.dump
```

## 6. Ачаалах

```bash
sudo bash /var/www/bbuch-dash/deploy/deploy.sh
```

Скрипт нь build хийгээд PM2-оор асааж, `/api/health`-ыг шалгана. Амжилттай бол:

```json
{"timestamp":"...","postgres":"ok","firebase":{"status":"configured",...}}
```

## 7. Домэйн ба SSL

```bash
sudo nano /etc/nginx/sites-available/bbuch-dash   # DOMAIN.MN → өөрийн домэйн
sudo nginx -t && sudo systemctl reload nginx

sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d dash.bbuch.mn
```

Certbot нь 443 блок болон автомат шинэчлэлтийг өөрөө нэмнэ.

## 8. Firebase Console дээр домэйнөө бүртгэх

**Энэ алхмыг алгасвал нэвтрэлт ажиллахгүй.**

Firebase Console → Authentication → Settings → **Authorized domains** →
`dash.bbuch.mn` нэмнэ.

---

## Өдөр тутмын ажиллагаа

```bash
# Шинэ хувилбар гаргах
sudo bash /var/www/bbuch-dash/deploy/deploy.sh

# Лог харах
pm2 logs bbuch-dash --lines 100

# Төлөв
pm2 status
curl -s localhost:3000/api/health

# Дахин асаах
pm2 restart bbuch-dash
```

### Асуудал шийдэх

| Шинж тэмдэг | Шалтгаан / шийдэл |
|---|---|
| `502 Bad Gateway` | Node процесс унтарсан → `pm2 logs bbuch-dash` |
| `postgres: {"status":"error"}` | `DATABASE_URL` буруу эсвэл Postgres унтарсан → `systemctl status postgresql` |
| `firebase: "missing-config"` | `.env.local`-д Admin SDK-ийн 3 хувьсагч дутуу |
| Нэвтрэхэд `auth/unauthorized-domain` | 8-р алхам хийгдээгүй |
| Build үед процесс алагдах (`Killed`) | Санах ой дутсан → swap идэвхтэй эсэхийг `free -h`-аар шалгах |
| Хуучин хувилбар харагдсаар байх | Service worker кэш → браузерын hard reload, эсвэл Application → Unregister SW |
