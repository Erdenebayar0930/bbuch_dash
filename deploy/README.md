# Байршуулалт

## Одоогийн бодит тохиргоо — Hostinger, `dash.bbuchmongol.com`

Дашборд нь **Hostinger-ийн shared hosting** дээр, тэдний өөрсдийн git-деплой
системээр (`hbuilds`) ажиллаж байна. VPS биш, root эрх байхгүй.

```
Интернэт ──► LiteSpeed + Passenger ──► Next.js standalone server.js (alt-nodejs22)
                (public_html/.htaccess)      hbuilds/current/nodejs/
```

**Деплой хийх арга: `main` салбар руу push хийхэд л хангалттай.** Hostinger
өөрөө repo-г татаж, `npm ci` + `npm run build` ажиллуулаад, шинэ хувилбарыг
`hbuilds/versions/<id>/` дор байрлуулж `current` symlink-ийг сольдог.

### Hostinger build системийн онцлог — ЧУХАЛ

Build хийхийн өмнө Hostinger нь `next.config.ts`-ийг `<hash>.next.config.ts`
болгон нэрлээд, өөрийн боодол файл үүсгэдэг:

```ts
import baseConfig from "./<hash>.next.config";
const config: NextConfig = { ...baseConfig, output: "standalone" };
export default config;
```

Тиймээс [next.config.ts](../next.config.ts) нь **заавал ESM `export default`**
байх ёстой. `module.exports =` (CommonJS) бол build нь
`File ... is not a module` гэж унана.

### Орчны хувьсагч

Standalone `server.js` нь `.env` файл УНШИХГҮЙ — зөвхөн процессын орчноос авна.
Тиймээс бүх хувьсагчийг **hPanel → Websites → dash.bbuchmongol.com →
Deployment/Node.js → Environment variables** хэсэгт оруулна. Эдгээр нь
`public_html/.htaccess`-д `SetEnv` мөр болж бичигддэг.

> ⚠️ `.htaccess`-ийг гараар засах утгагүй — деплой бүрт дахин үүсдэг.

> ⚠️ `NEXT_PUBLIC_*` хувьсагчид **build хийх үед** кодод шигддэг. Тэдгээрийг
> нэмсний дараа заавал дахин деплой хийнэ (push эсвэл hPanel-ийн Redeploy).

Шаардлагатай хувьсагчдын жагсаалтыг [.env.example](../.env.example)-аас үзнэ үү.

### Өгөгдлийн сан — MySQL

Shared hosting дээр PostgreSQL байхгүй тул апп нь **MySQL** дээр ажиллана
(hPanel → Databases хэсгээс сан, хэрэглэгчийг үүсгэнэ). Апптай нэг сервер
дээр байгаа тул host нь `localhost`, SSL шаардлагагүй:

```ini
DATABASE_URL=mysql://u192470510_xxx:нууцүг@localhost:3306/u192470510_bbuch
DATABASE_SSL=
```

Схемийг үүсгэх (локалаас, эсвэл серверийн SSH-аас):

```bash
npm run db:push
```

**MySQL-ийн шаардлага:** схем нь цонхны функц (`row_number() over`) болон
`JSON_CONTAINS` ашигладаг тул **MySQL 8.0+ эсвэл MariaDB 10.2+** байх ёстой.

Postgres-ээс хөрвүүлэхэд гарсан гол ялгаанууд [src/lib/db/schema.ts](../src/lib/db/schema.ts)-ийн
толгой хэсэгт тэмдэглэгдсэн: UUID → `varchar(36)`, индекслэгдсэн бүх `text` →
`varchar(n)`, `jsonb` → `json`, DB талын default-ыг `$defaultFn`-ээр
орлуулсан, `INSERT/UPDATE/DELETE ... RETURNING` байхгүй тул бичсэний дараа
буцааж уншдаг болсон.

### Шалгах

```bash
curl https://dash.bbuchmongol.com/api/health
```

Хүлээгдэх хариу:

```json
{"timestamp":"...","mysql":"ok","firebase":{"status":"configured","projectId":"bbuch-edba7"}}
```

### Лог

```bash
ssh bbuch-vps
D=~/domains/dash.bbuchmongol.com
tail -f $D/hbuilds/current/nodejs/console.log      # ажиллах үеийн лог (JSON)
ls -1t $D/hbuilds/logs/ | head -1                  # хамгийн сүүлийн build
tail -50 $D/hbuilds/logs/<id>/*.log                # build-ын лог
```

`~/.ssh/config`-д `bbuch-vps` гэсэн богино нэр тохируулсан
(145.79.25.241:65002, `u192470510`, `~/.ssh/bbuch_vps` түлхүүрээр).

### Аппыг дахин асаах

```bash
touch ~/domains/dash.bbuchmongol.com/hbuilds/current/nodejs/tmp/restart.txt
```

---

## Хувилбар Б — өөрийн Ubuntu VPS (одоогоор ХЭРЭГЛЭЭГҮЙ)

Хэрэв ирээдүйд shared hosting-оос VPS рүү шилжвэл энэ фолдер дахь скриптүүд
бэлэн байна. Одоогийн `dash.bbuchmongol.com` деплойд эдгээр нь **хэрэглэгддэггүй**.

| Файл | Зориулалт |
|---|---|
| [setup-server.sh](setup-server.sh) | Нэг удаагийн provisioning (Node 20, PM2, Nginx, Postgres, swap, ufw) |
| [deploy.sh](deploy.sh) | pull → build → PM2 reload → health check |
| [ecosystem.config.js](ecosystem.config.js) | PM2 процессын тохиргоо |
| [nginx/bbuch-dash.conf](nginx/bbuch-dash.conf) | Nginx reverse proxy |

Бүтэц: Nginx (80/443) → `next start` (127.0.0.1:3000, PM2) → локал Postgres.
Дэлгэрэнгүйг скриптүүдийн доторх тайлбараас үзнэ үү.
