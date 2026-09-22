# Байршуулалт

## Одоогийн бодит тохиргоо — өөрийн VPS, `dash.bbuchmongol.com`

Дашборд нь **Hostinger KVM VPS** дээр (AlmaLinux 9, cPanel/WHM суусан),
systemd-ээр удирдагддаг `next start` процесс байдлаар ажиллана. Өгөгдлийн сан нь
**PostgreSQL 13**, тэр же серверийн дотор.

```
Интернэт ──► Nginx (80) ──► next start (127.0.0.1:3002, systemd) ──► Postgres (127.0.0.1:5432)
             conf.d/bbuch-dash.conf        bbuch-dash.service           bbuch_dash сан
```

| Юу | Утга |
|---|---|
| SSH | `ssh -i ~/.ssh/bbuch_vps2 root@72.62.192.163` |
| Аппын хэрэглэгч | `bbuch` |
| Аппын фолдер | `/home/bbuch/app` |
| Орчны хувьсагч | `/home/bbuch/app/.env.local` (systemd `EnvironmentFile`) |
| systemd unit | `/etc/systemd/system/bbuch-dash.service` |
| Лог | `/var/log/bbuch-dash.log` |
| Nginx | `/etc/nginx/conf.d/bbuch-dash.conf` |
| Порт | 3002 (зөвхөн локал, Nginx proxy хийнэ) |
| Postgres | `postgresql://bbuch_dash@127.0.0.1:5432/bbuch_dash`, өгөгдөл нь `/var/lib/pgsql/data/` |

> **Өмнөх хувилбар — Hostinger shared hosting (`hbuilds`, MySQL/MariaDB) нь
> ХОЙШ ТАВИГДСАН.** `145.79.25.241` дээрх хуучин суурилуулалт устгаагүй хэвээр
> байгаа ч ашиглагдахгүй. `main` руу push хийхэд ТЭНД автоматаар build хийгдэх
> магадлалтай тул хуучин деплойг hPanel-аас унтраах нь зүйтэй.

### ⚠ Деплой нь push хийхэд автоматаар ЯВАХГҮЙ

VPS дээр git webhook байхгүй. Шинэчлэлт бүрийг доорх дарааллаар **гараар**
хийнэ. Энэ нь санаатай: build нь сервер дээр ойролцоогоор хоёр минут авдаг тул
санамсаргүй push ажиллаж буй сайтыг хөндөхгүй.

---

## Шинэчлэлт — алхам алхмаар

Шинэ хувилбарыг **тусдаа фолдерт** бэлдэж, бүрэн болсон хойно нь сольдог.
Ингэснээр build унасан ч ажиллаж буй сайт хөндөгдөхгүй.

```bash
# 1. Локал: buildийг серверээс ӨМНӨ барина
npm run build

# 2. Локал: commit + push (эх код хадгалагдана; деплойг энэ өдөөхгүй)
git push origin main

# 3. Локал: яг тэр commit-ын архивыг сервер рүү илгээнэ
git archive --format=tar.gz -o /tmp/bbuch-app.tgz HEAD
scp -i ~/.ssh/bbuch_vps2 /tmp/bbuch-app.tgz root@72.62.192.163:/tmp/

# 4. Сервер: шинэ хувилбарыг ХАЖУУД нь бэлдэнэ
ssh -i ~/.ssh/bbuch_vps2 root@72.62.192.163
mkdir -p /home/bbuch/app-new
tar -xzf /tmp/bbuch-app.tgz -C /home/bbuch/app-new
cp /home/bbuch/app/.env.local /home/bbuch/app-new/.env.local   # нууц утгууд зөвхөн серверт
chown -R bbuch:bbuch /home/bbuch/app-new

cd /home/bbuch/app-new
sudo -u bbuch npm ci
sudo -u bbuch bash -c "set -a; source ./.env.local; set +a; npm run build"

# 5. Сервер: солиод асаана (таслалт 10 орчим секунд)
systemctl stop bbuch-dash
mv /home/bbuch/app /home/bbuch/app-prev
mv /home/bbuch/app-new /home/bbuch/app
systemctl start bbuch-dash
systemctl is-active bbuch-dash

# 6. Шалгах
curl -s http://127.0.0.1:3002/api/health
curl -s https://dash.bbuchmongol.com/api/health
```

> ⚠ **4-р алхам дахь `source ./.env.local` нь заавал.** `NEXT_PUBLIC_*`
> хувьсагчид build хийх ҮЕД кодод шигддэг. Орчингүй build хийвэл Firebase-ийн
> тохиргоо хоосон шигдэж, хэрэглэгч нэвтэрч чадахгүй болно.

> `npm ci` нь `package-lock.json`-оос яг тэр хувилбаруудыг суулгана. `npm
> install` БИШ — тэр нь lock-ыг чимээгүй өөрчилж, локалд ажилласан код сервер
> дээр өөр хувилбартай ажиллах эрсдэл үүсгэнэ.

### Буцаах (rollback)

Өмнөх хувилбар `/home/bbuch/app-prev` дотор build-тэйгээ бүрэн хэвээр байна —
дахин build хийх шаардлагагүй:

```bash
systemctl stop bbuch-dash
mv /home/bbuch/app /home/bbuch/app-bad
mv /home/bbuch/app-prev /home/bbuch/app
systemctl start bbuch-dash
```

**Өгөгдлийг буцаах** нь тусдаа үйлдэл — доорх Backup хэсгийг үзнэ үү.

### Зөвхөн дахин асаах, лог харах

```bash
systemctl restart bbuch-dash
tail -f /var/log/bbuch-dash.log
journalctl -u bbuch-dash -n 50 --no-pager
```

---

## Орчны хувьсагч

Бүгд `/home/bbuch/app/.env.local` дотор. systemd үүнийг `EnvironmentFile`-аар
уншиж процесст дамжуулна — зассаны дараа **заавал `systemctl restart
bbuch-dash`**, `NEXT_PUBLIC_*`-ыг өөрчилсөн бол **дахин build**.

Бүрэн жагсаалт, тайлбарыг [.env.example](../.env.example)-аас үзнэ үү. Энэ
серверийн онцлог утгууд:

```ini
NEXT_PUBLIC_APP_URL=https://dash.bbuchmongol.com
DATABASE_URL=postgresql://bbuch_dash:НУУЦҮГ@127.0.0.1:5432/bbuch_dash
DATABASE_SSL=disable          # апп болон Postgres нэг серверт — SSL шаардлагагүй
DATABASE_POOL_MAX=5
```

> `MYSQL_URL` гэсэн нэр нь код дотор **`DATABASE_URL`-ыг дардаг** нөөц зам болж
> үлдсэн ([createPool.ts](../src/lib/db/createPool.ts)). Нэр нь хуучирсан ч утга
> нь Postgres URL байна. VPS дээр хэрэггүй — тохируулахгүй байх нь зөв.

---

## Өгөгдлийн сан — PostgreSQL

```bash
sudo -u postgres psql -d bbuch_dash        # сервер дээрээс шууд
```

Схем нь [src/lib/db/schema.ts](../src/lib/db/schema.ts) дотор, `drizzle-orm/pg-core`
дээр. MySQL-ээс хөрвүүлэхэд өөрчлөгдсөн гол зүйлс тэр файлын толгойд
тэмдэглэгдсэн: `varchar(36)` → натив `uuid`, `json` → `jsonb`, бүх `timestamp`
нь `{ withTimezone: true }`.

### Схем өөрчлөгдсөн үед

```bash
npm run backup            # 1. буцах цэг — ЗААВАЛ эхэнд
npm run db:push           # 2. гаралтыг УНШИЖ байж зөвшөөрнө
npm run db:check          # 3. сан хэвийн эсэхийг батална
```

`drizzle-kit push` нь хуучин MariaDB дээр чимээгүй уначихдаг байсан тул SQL-ийг
гараар ажиллуулдаг байв — **Postgres дээр энэ асуудал байхгүй**.

> Устгах (`DROP COLUMN` / `DROP TABLE`) SQL санал болговол **зогсоод** схемээ
> дахин харна уу — өгөгдөл алдагдана.

`db:check` нь цагийн бүс, кодчлол, схемийн бүх хүснэгт байгаа эсэхийг шалгаад
алдаатай бол 0-ээс ялгаатай кодоор гарна. Локалаас ажиллуулах үед `.env.local`
дахь `DATABASE_URL` нь **локал** сан руу заадгийг санаарай — серверийн санг
шалгах бол `DATABASE_URL=... npm run db:check` гэж дарж өгнө.

### Тогтмол мэдэгдэл (cron)

`/api/cron/notifications` нь товлосон мэдэгдлийг илгээнэ. `CRON_SECRET`
тохируулаагүй бол энэ route **аль ч** хүсэлтийг татгалзана. cPanel → Advanced →
Cron Jobs дээр 15 минут тутам:

```
*/15 * * * * curl -fsS "https://dash.bbuchmongol.com/api/cron/notifications?secret=НУУЦ" >/dev/null
```

---

## Nginx ба SSL

Тохиргоо нь `/etc/nginx/conf.d/bbuch-dash.conf` — `dash.bbuchmongol.com`-ыг
`127.0.0.1:3002` руу proxy хийнэ (WebSocket-ийн upgrade толгойнуудтай).

```bash
nginx -t && systemctl reload nginx
```

> ⚠ **DNS.** Домэйныг энэ сервер рүү (`72.62.192.163`) заалгаагүй бол дээрх
> бүхэн ажиллахгүй. A бичлэгийг сольж, хуучин серверийг заасан AAAA бичлэгүүдийг
> ч мөн засах эсвэл устгана.

> ⚠ **Сертификат.** Одоогоор зөвхөн 80 порт сонсож байна. DNS чиглүүлсний дараа
> cPanel-ийн AutoSSL ашиглах, эсвэл certbot суулгаж https-ийг идэвхжүүлнэ:
> `dnf install certbot python3-certbot-nginx && certbot --nginx -d dash.bbuchmongol.com`.
> Үүнгүйгээр `NEXT_PUBLIC_APP_URL`-д бичсэн https хаяг ажиллахгүй.

---

## Backup ба сэргээлт

Хуулбар нь **Google Drive** дээрх заасан фолдер руу очно — сервер бүхэлдээ
алдагдсан ч өгөгдөл үлдэнэ. Формат нь gzip хийсэн NDJSON: хүснэгт бүрийн мөр
тус тусдаа мөрөнд, эхэнд толгой, төгсгөлд дуусгавар мөртэй (тасарсан архивыг
таних боломж).

### Нэг удаагийн тохиргоо — Google Drive

⚠ **Service account энд ажиллахгүй.** Google 2021 оноос хойш service
account-д Drive-ийн хадгалах багтаамж олгохоо больсон: хэрэглэгчийн фолдерыг
хуваалцсан ч байршуулах үед `storageQuotaExceeded` алдаа өгнө. Тиймээс жинхэнэ
хэрэглэгчийн нэрийн өмнөөс ажиллах **refresh token** хэрэгтэй.

Бүхнийг **дэлгэцээс** хийнэ: супер админаар нэвтэрч `/backup` → «Google Drive»
хэсэг. Орчны хувьсагч руу юу ч бичихгүй.

Google Cloud Console дээр нэг удаагийн бэлтгэл:

1. [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com)
   → **Enable**
2. [Google Auth Platform → Audience](https://console.cloud.google.com/auth/audience)
   → User type **External** → **Publish app** дарж төлөвийг **In production**
   болгоно
3. [Clients](https://console.cloud.google.com/auth/clients) → Create client →
   Application type: **Web application**
4. **Authorized redirect URIs** хэсэгт деплойн хаягаа нэмнэ:
   `https://dash.bbuchmongol.com/api/backup/drive/callback`
   (яг энэ хаягийг нөөцлөлтийн дэлгэц дээр хуулж авахад бэлэн харуулна)
5. Client ID / secret-ийг нөөцлөлтийн дэлгэцийн маягтад буулгаад
   **«Google-ээр зөвшөөрөх»** дарна

Фолдерыг апп өөрөө үүсгэнэ (**«Бид туслая — нөөцлөлт»**) — Drive рүү орж юу ч
хийх шаардлагагүй.

> ⚠ **`In production` болгохоо мартаж болохгүй.** `Testing` төлөвт үлдээвэл
> Google-ийн refresh token **7 хоногийн дараа хүчингүй** болж, нөөцлөлт
> чимээгүй зогсоно. Ашиглаж буй эрх (`drive.file`) нь эмзэг бус ангилалд
> ордог тул нийтлэхэд баталгаажуулалт (verification) шаардахгүй.

> Эрх нь `drive.file` — энэ апп **өөрөө үүсгэсэн** файлд л хандана. Таны Drive
> дээрх бусад файлыг унших боломж нээгдэхгүй.

### Автомат — өдөрт нэг удаа

Cron нь нэвтэрч чаддаггүй тул түүнд зориулсан токен хэрэгтэй. Үүнийг ч
**дэлгэцээс** хийнэ:

1. `/backup` → «Автомат хуулбар» хэсэг → **«Токен үүсгэх»**
2. Гарч ирэх бүтэн командыг **Хуулах** товчоор аваад, cPanel → **Advanced →
   Cron Jobs** дээр өдөр бүр (жишээ нь 03:00) ажиллахаар тавина

Токен нь `settings` хүснэгтэд хадгалагдана — орчны хувьсагч нэмэх, дахин
деплой хийх шаардлагагүй. «Токен шинэчлэх» дарахад хуучин нь тэр дороо
хүчингүй болох тул cron дээрх командыг ч заавал солино.

> Хуучин `BACKUP_TOKEN` орчны хувьсагч нь нөөц зам болж үлдсэн — баазад токен
> байхгүй үед ажиллана.

### Хадгалах хугацаа

Анхдагчаар **15 хоног** — түүнээс хуучин архивууд нөөцлөлт бүрийн дараа
автоматаар устана. Хугацааг `/backup` хуудасны «Хадгалах хугацаа» хэсгээс
шууд өөрчилнө (3-365 хоног); утга нь баазад хадгалагдах тул cron-оор ажиллах
нөөцлөлтөд ч шууд үйлчилнэ.

> **Хамгийн сүүлийн 3 хуулбарыг ХЭЗЭЭ Ч устгахгүй.** Нөөцлөлт хэсэг хугацаанд
> ажиллаагүй байгаад дараа нь цэвэрлэгээ ажиллахад "бүгд хуучирсан" гэж бүх
> хуулбар алга болох тохиолдлоос сэргийлнэ.

### Дэлгэцээс — «Нөөцлөлт» цэс

Супер админ нэвтэрсэн үед хажуугийн цэсэнд **Нөөцлөлт** гарч ирнэ (`/backup`).
Тэндээс сүүлийн хуулбарын огноо, токен тохируулсан эсэх, «Одоо хуулбарлах»,
архив бүрийг Drive дээр нээх боломжтой. Энгийн админ ч, хаягаар шууд орсон ч
хандахгүй: цэс нь `superOnly`, дэлгэц нь шалгалттай, API нь `requireSuper`-тэй.

### Гараар (терминалаас)

```bash
npm run backup                       # Google Drive руу
npm run backup -- --file dump.gz     # локал файл руу (Drive шаардахгүй)
npm run restore -- --list            # Drive дэх архивуудыг ID-тэй нь жагсаана
```

### Сэргээх

```bash
npm run restore -- --file dump.gz               # ЮУ болохыг харуулна (бичихгүй)
npm run restore -- --file dump.gz --write       # бодитоор бичнэ
npm run restore -- --remote <drive-file-id> --write
```

> ⚠ `--write` нь сэргээж буй **хүснэгт бүрийг урьдчилан хоослоно**. Хэсэгчилсэн
> сэргээлт нь хуучин, шинэ мөрийг холиод хамгийн муу төлөв рүү хүргэдэг тул
> зориудаар ийм байдлаар хийв. Тиймээс анхдагч горим нь зөвхөн харуулна.

Сэргээлтийг **жилд нэг удаа туршиж** үзнэ үү — туршаагүй backup бол backup биш.
Хоосон туршилтын сан үүсгээд түүн рүү заагаад сэргээхэд хангалттай:

```bash
sudo -u postgres createdb bbuch_test
DATABASE_URL="postgresql://…/bbuch_test" npm run db:push
DATABASE_URL="postgresql://…/bbuch_test" npm run restore -- --file dump.gz --write
```

### Сэргээлт хэрхэн хамгаалагдсан бэ

Сэргээлт нь **бүхэлдээ нэг гүйлгээнд**, гадаад түлхүүрийн шалгалтыг түр
унтраасан байдлаар явна. Гурван зүйлийг тэр шийддэг:

1. **Дараалал** — архив дахь хүснэгтүүд цагаан толгойн дарааллаар байдаг
   (`children` нь `users`-ээс өмнө). Шалгалттай бол хүүхдийн мөр эцгээсээ өмнө
   орж FK алдаа өгнө.
2. **Каскад устгал** — `users`-ийг хоослоход `ON DELETE CASCADE` нь аль хэдийн
   сэргээгдсэн `children`, `notifications`-ыг дагуулж устгана. Тиймээс БҮХ
   хүснэгтийг бичилт эхлэхээс **өмнө** хоослоно.
3. **Тасалдал** — дундуур алдаа гарвал гүйлгээ бүхэлдээ буцна. Хоосруулсан
   хэрнээ дүүргэж амжаагүй төлөв **үлдэхгүй**.

Эдгээр гурвууланг ачааллын өмнөх хувилбар барьж чадахгүй байсныг туршилт
илрүүлсэн — тиймээс өөрчилвөл дээрх гурван нөхцөлийг заавал дахин шалгана уу.

---

## Тогтвортой ажиллагаа

### Хяналт

`/api/health` нь эрхгүй дуудагчид `{"status":"ok"}` буцаана — гадны хяналтын
үйлчилгээнд (UptimeRobot, cron-job.org зэрэг үнэгүй сонголтууд) яг тохирно.
5 минут тутамд шалгаж, 2 удаа дараалан унавал имэйл/SMS-ээр мэдэгдэхээр
тохируулна. Ингэснээр 502 гарсныг хэрэглэгчээс өмнө мэднэ.

Дэлгэрэнгүй оношилгоог `HEALTH_TOKEN`-оор авна:

```bash
curl -H "x-health-token: ТОКЕН" https://dash.bbuchmongol.com/api/health
```

Хариунд Postgres-ийн SQLSTATE код орж ирнэ — буруу нууц үг, байхгүй сан,
хаалттай порт гурвыг лог уншилгүй ялгана.

### Холболтын хязгаар

Бодит холболт = `DATABASE_POOL_MAX` × процессын тоо. Одоогийн бүтцээр нэг л
процесс ажиллаж байгаа тул дээд тал нь 5 холболт — Postgres-ийн анхдагч 100-гийн
дэргэд огт асуудалгүй. Процессыг олшруулбал (systemd template, PM2 cluster г.м.)
энэ үржвэрийг дахин тооцоолно.

`/api/health`-ийн дэлгэрэнгүй хариунд гарах `53300` (`too_many_connections`) нь
энэ таазанд хүрснийг шууд хэлнэ.

### Хэт ачааллын хариу

Холболт дүүрэхэд апп **503 + `Retry-After: 5`** буцаана (500 биш). Ялгаа нь
чухал: 500 нь "энэ хүсэлт хэзээ ч ажиллахгүй", 503 нь "одоо завгүй, дахин
оролдоорой" гэсэн утгатай бөгөөд лог шинжлэхэд жинхэнэ програмын алдаанаас
ялгарна. Ангилалт нь [isOverloadError](../src/lib/api/auth.ts) дотор.

### Процессын хамгаалалт

Хоёр давхарга:

- [src/instrumentation.ts](../src/instrumentation.ts) нь баригдаагүй Promise
  алдааг барьж логт бичээд процессыг амьд үлдээнэ. Үүнгүйгээр Node 20 нь ийм
  алдаанд процессыг шууд унагаадаг — нэг хүсэлтийн алдаа бүх хэрэглэгчийг
  унагана гэсэн үг.
- systemd `Restart=always`, `RestartSec=5` — процесс ямар ч шалтгаанаар унавал
  5 секундын дараа сэргэнэ. Unit нь `enabled` тул сервер дахин асахад ч өөрөө
  эхэлнэ.

### Санах ой

`next build` нь Node-ын үндсэн heap-д багтдаггүй тохиолдол гардаг. Build
«Killed» гэж унавал:

```bash
sudo -u bbuch bash -c "set -a; source ./.env.local; set +a; NODE_OPTIONS=--max-old-space-size=2048 npm run build"
```

---

## Энэ фолдор дахь хуучин скриптүүд

[setup-server.sh](setup-server.sh), [deploy.sh](deploy.sh),
[ecosystem.config.js](ecosystem.config.js), [nginx/bid_tuslay.conf](nginx/bid_tuslay.conf)
нь **PM2 дээр суурилсан өөр нэг бүтцэд** зориулж бичигдсэн бөгөөд одоогийн
systemd деплойд **хэрэглэгддэггүй**. Уншиж лавлахаас цаашгүй — ажиллуулбал
одоогийн тохиргоотой зөрчилдөнө.
