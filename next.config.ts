import type { NextConfig } from "next";

// next-pwa@5 нь TypeScript тодорхойлолтгүй тул require-ээр авна (import хийвэл
// TS7016 "declaration file олдсонгүй" гэж унана).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const defaultRuntimeCaching = require("next-pwa/cache");

// ⚠ /api/* хариултыг кэшлэхгүй. Энэ систем нэг төхөөрөмж дээр олон хэрэглэгч
// ээлжлэн нэвтэрдэг бөгөөд service worker-ийн кэш нь хэрэглэгчээр
// тусгаарлагддаггүй — өмнөх хүний гүйлгээ/хандивын жагсаалт дараагийнх нь
// дэлгэц дээр гарч ирнэ. Мөн гараас нь хассан өгөгдөл 24 цаг "амьд" үлдэнэ.
// ⚠ HTML баримтыг (navigation) SW-д ОГТ кэшлүүлэхгүй. Кэшлэсэн HTML нь тухайн
// үеийн chunk хэшүүдийг заадаг ба дараагийн деплойд тэдгээр файл серверээс
// устдаг тул хуучин HTML → байхгүй chunk → "client-side exception" болж унана.
// Яг энэ алдааг Hostinger-ийн CDN нэгэнт үүсгэсэн (доорх headers() харна уу);
// SW-ээр дамжуулан дахин давтуулах шаардлагагүй.
//
// NetworkOnly + next-pwa-гийн handlerDidError → сүлжээгүй үед _offline.html.
const runtimeCaching = [
  {
    urlPattern: ({ request }: { request: Request }) =>
      request.mode === "navigate",
    handler: "NetworkOnly",
    options: { cacheName: "navigations" },
  },
  // ⚠ /api/* хариултыг кэшлэхгүй. Энэ систем нэг төхөөрөмж дээр олон хэрэглэгч
  // ээлжлэн нэвтэрдэг бөгөөд service worker-ийн кэш нь хэрэглэгчээр
  // тусгаарлагддаггүй — өмнөх хүний гүйлгээ/хандивын жагсаалт дараагийнх нь
  // дэлгэц дээр гарч ирнэ. Мөн гараас нь хассан өгөгдөл 24 цаг "амьд" үлдэнэ.
  ...defaultRuntimeCaching.filter(
    (entry: { options?: { cacheName?: string } }) =>
      entry.options?.cacheName !== "apis"
  ),
];

const withPWA = require("next-pwa")({
  dest: "public",
  // ⚠ register: false. next-pwa@5 нь бүртгэлийн кодоо webpack-ийн `main.js`
  // entry-д оруулдаг ба App Router түүнийг ачаалдаггүй (зөвхөн `main-app.js`).
  // Тиймээс бүртгэлийг components/ServiceWorkerRegister.tsx гараар хийнэ.
  register: false,
  // next-pwa нь "/" замыг NetworkFirst-ээр кэшлэх start-url маршрут нэмдэг —
  // энэ нь дээр тайлбарласан хуучин HTML-ийн асуудлыг яг давтана. Тиймээс
  // хоёуланг нь унтраана; navigation-ыг дээрх NetworkOnly маршрут хариуцна.
  cacheStartUrl: false,
  dynamicStartUrl: false,
  skipWaiting: true,
  runtimeCaching,
  // public/ доторх бүхнийг precache хийдэг тул template-ийн 7.9 МБ demo зургийг
  // хасна — эс бөгөөс апп суулгах үед хэрэглэгч дэмий трафик зарцуулна.
  // firebase-messaging-sw.js бол өөрөө service worker; түүнийг кэшлэвэл
  // шинэчлэлт нь хүрэхгүй хуучин хувилбар дээрээ гацна.
  publicExcludes: [
    "!images/carousel/**",
    "!images/grid-image/**",
    "!images/cards/**",
    "!images/user/**",
    "!images/product/**",
    "!images/chat/**",
    "!images/video-thumb/**",
    "!images/task/**",
    "!images/country/**",
    "!images/brand/**",
    "!firebase-messaging-sw.js",
  ],
  fallbacks: {
    document: "/_offline.html",
  },
  disable: process.env.NODE_ENV === "development",
});

const isDev = process.env.NODE_ENV === "development";

/**
 * CSP-г ЯМАР горимоор гаргахыг `CSP_MODE` орчны хувьсагч шийднэ.
 *
 *   off          — толгой огт тавихгүй
 *   report-only  — зөрчлийг хөтчийн console-д бичнэ, ЮУ Ч ХААХГҮЙ (АНХДАГЧ)
 *   enforce      — зөрчсөн нөөцийг хаана
 *
 * Яагаад анхдагчаар report-only вэ: CSP нь зөвхөн нэвтрэлтгүй хуудсууд дээр
 * шалгагдсан. Нэвтэрсэн хойшхи хэсэг (Leaflet хавтан, график, Firebase Storage
 * руу зураг байршуулах, push бүртгэл) шалгагдаагүй тул шууд албадвал амьд
 * дашбордын тэр хэсэг чимээгүйхэн эвдэрч болно. Report-only нь ЮУ Ч ХААДАГГҮЙ
 * учир аюулгүй боловч зөрчлийг console дээр ил гаргадаг тул жагсаалт дутуу
 * эсэхийг бодит хэрэглээгээр шалгах боломж өгнө.
 *
 * Үлдсэн алхам — hPanel → Environment variables дээр утгыг л солино:
 *   1. (одоо) report-only → нэвтэрч ороод бүх хуудсыг тойрч, DevTools →
 *      Console дээр "[Report Only] Refused to …" байгаа эсэхийг харна
 *   2. Зөрчил гарвал доорх жагсаалтад тухайн хостыг нэмнэ
 *   3. Цэвэр бол CSP_MODE=enforce
 *
 * ⚠ Хувьсагч солисны дараа ЗААВАЛ ДАХИН DEPLOY хийнэ — restart хангалтгүй.
 * Next нь `headers()`-ийг BUILD ҮЕД дуудаж, үр дүнг нь
 * `.next/routes-manifest.json`-д шигтгэдэг; ажиллах үеийн процесс тэр бэлэн
 * жагсаалтыг л уншина. Тиймээс зөвхөн restart.txt-ээр сэргээвэл хуучин
 * толгой хэвээр үлдэж, "яагаад өөрчлөгдөхгүй байна аа" гэсэн будлиан үүснэ.
 * (Hostinger нь hPanel дээрх хувьсагчийг build-д ч дамжуулдаг тул
 * Redeploy дархад л хангалттай.)
 */
const cspMode = process.env.CSP_MODE ?? "report-only";

/**
 * Content-Security-Policy — тарьсан скрипт өгөгдөл гаргахаас сэргийлнэ.
 *
 * Энэ апп нь сүм/байгууллагын гишүүдийн хувийн мэдээлэл (нэр, утас, хаяг,
 * тэтгэмж, гүйлгээ) хадгалдаг тул XSS-ийн үнэ өндөр: нэвтэрсэн админы табанд
 * ажилласан скрипт нь түүний ID token-оор бүх /api/* руу хандаж чадна.
 *
 * ⚠ `script-src` дотор 'unsafe-inline' үлдээв. Next.js нь өөрийн bootstrap
 * скриптүүдээ inline тавьдаг ба тэднийг nonce-оор солих нь middleware
 * шаарддаг. Тиймээс энэ CSP нь inline тарилтыг биш, ГАДНЫ хост руу өгөгдөл
 * урсахыг таслах зорилготой — `connect-src`, `form-action` нь жагсаасан
 * хостоор хязгаарлагдана.
 *
 * Хостуудын учир:
 *   googleapis/gstatic  — Firebase Auth, FCM, Storage, Installations
 *   firebaseapp.com     — Auth-ийн нэвтрэлтийн iframe (authDomain)
 *   openstreetmap.org   — Leaflet газрын зургийн хавтан
 *   blob:/data:         — зураг тайрах (react-easy-crop), видео шахалт
 */
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  // Плагин байхгүй — <object>/<embed> нь зөвхөн халдлагын гадаргуу
  "object-src 'none'",
  // Clickjacking: хандивын дүн батлах, эрх олгох товчнууд iframe дотроос
  // дарагдах эрсдэлтэй. X-Frame-Options нь энэ мөрийн хуучин хувилбар.
  "frame-ancestors 'none'",
  "form-action 'self'",
  // Дев дээр webpack HMR нь eval ашигладаг — прод build-д хэрэггүй
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://www.gstatic.com https://apis.google.com`,
  // Tailwind-ийн runtime style болон Next-ийн inline critical CSS
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.tile.openstreetmap.org",
  "font-src 'self' data:",
  // Дев дээр HMR нь ws:// ашиглана
  `connect-src 'self'${isDev ? " ws: http://localhost:*" : ""} https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebaseapp.com https://*.tile.openstreetmap.org`,
  "frame-src 'self' https://*.firebaseapp.com",
  // Service worker + видео шахалтын worker
  "worker-src 'self' blob:",
  "media-src 'self' blob: data:",
  "manifest-src 'self'",
  // ⚠ `upgrade-insecure-requests` нь report-only бодлогод УТГАГҮЙ — хөтөч
  // түүнийг үл тоомсорлоод console-д алдаа бичдэг ("is ignored when delivered
  // in a report-only policy"). Тайлагнах гэдэг нь юу ч хийхгүй гэсэн үг тул
  // "http-г https болго" гэсэн үйлдэл шаардсан директив утга алдана.
  // Тиймээс ЗӨВХӨН албадах горимд. Дев дээр localhost нь http тул хэзээ ч
  // оруулахгүй.
  ...(!isDev && cspMode === "enforce" ? ["upgrade-insecure-requests"] : []),
].join("; ");

/**
 * Бүх хариултад тавих хамгаалалтын толгойнууд.
 *
 * HSTS болон upgrade-insecure-requests нь ЗӨВХӨН прод дээр — localhost дээр
 * тавибал хөтөч тэр домэйныг https руу түгжиж, дараа нь дев сервер нээгдэхгүй
 * болно (хөтчийн HSTS кэш нь гараар цэвэрлэх хүртэл үлддэг).
 */
const securityHeaders = [
  ...(cspMode === "off"
    ? []
    : [
        {
          key:
            cspMode === "report-only"
              ? "Content-Security-Policy-Report-Only"
              : "Content-Security-Policy",
          value: csp,
        },
      ]),
  // Clickjacking-ийн хамгаалалт нь CSP-ээс ХАМААРАХГҮЙ байх ёстой: CSP
  // унтраалттай үед ч энэ толгой ажиллана. `frame-ancestors` нь үүнийг
  // дардаг тул хоёулаа зэрэг байхад зөрчил үүсэхгүй.
  { key: "X-Frame-Options", value: "DENY" },
  // Хэрэглэгчийн байршуулсан файлыг хөтөч "таамаглаж" HTML болгон
  // ажиллуулахаас сэргийлнэ
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Бүтэн зам нь ID агуулдаг (/welfare/<id>) — гадны сайт руу гоожуулахгүй
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Байршил нь хандивын хайрцаг/өрхийн цэг тэмдэглэхэд хэрэгтэй тул үлдээв;
  // камер, микрофон, төлбөр зэргийг огт ашигладаггүй тул хаав
  {
    key: "Permissions-Policy",
    value:
      "geolocation=(self), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  ...(isDev
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]),
];

// Тайлбар: output: 'export' авагдсан — мэдэгдэл илгээх /api/notifications/send
// route нь сервер талд ажиллах шаардлагатай (FCM service account түлхүүр браузерт гарч болохгүй).
const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        // ⚠ Next нь статик prerender хийсэн HTML-д `s-maxage=31536000` тавьдаг.
        // Hostinger-ийн CDN (Server: hcdn) түүнийг дуулгавартай дагаж, HTML-ийг
        // НЭГ ЖИЛ барьдаг. Деплойн дараа chunk-уудын хэш өөрчлөгдөж, хуучин
        // файлууд диск дээрээс УСТДАГ тул CDN-ээс ирсэн хуучин HTML нь байхгүй
        // chunk руу заана → хуудас "Application error: a client-side exception"
        // болж унана. CDN зангилаа бүр өөр хуулбартай тул алдаа нь хэсэг
        // хэрэглэгчид дээр л гарч, оношлоход төвөгтэй.
        //
        // Тиймээс HTML-ийг үргэлж origin-оос шалгуулна. ETag хэвээр ажиллах тул
        // өөрчлөгдөөгүй үед 304 буцаж, зардал бага хэвээр үлдэнэ.
        //
        // `_next/static` болон `_next/image` энд ОРОХГҮЙ — тэдгээрийн нэр нь
        // агуулгын хэштэй тул мөнхөд кэшлэгдэх нь ЗӨВ (immutable).
        source: "/((?!_next/static|_next/image).*)",
        headers: [
          { key: "Cache-Control", value: "no-cache, must-revalidate" },
        ],
      },
      {
        // Хамгаалалтын толгойг БҮХ замд — статик chunk-ууд ч мөн адил
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // API хариултыг хаана ч кэшлэхгүй: CDN, прокси, хөтчийн буцах товч.
        // Эдгээр нь хэрэглэгчийн эрхээр шүүгдсэн хувийн өгөгдөл тул нэг
        // төхөөрөмж дээр ээлжлэн нэвтэрсэн хоёр хүний хооронд урсаж болохгүй.
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, private" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
    ];
  },
  webpack(config: any) {
    if (config.module) {
      config.module.rules.push({
        test: /\.svg$/,
        issuer: /\.[jt]sx?$/,
        use: ["@svgr/webpack"],
      });
    }
    // Fix Windows path resolution issues
    if (config.resolve) {
      config.resolve.symlinks = false;
      // Ensure proper module resolution
      if (!config.resolve.modules) {
        config.resolve.modules = [];
      }
      config.resolve.modules = [
        ...config.resolve.modules,
        'node_modules',
      ];
    }
    return config;
  },
};

// ЧУХАЛ: `module.exports =` БИШ, ESM `export default` байх ёстой.
// Hostinger-ийн build систем энэ файлыг өөрийн боодолоор солиод
// `import baseConfig from "./<hash>.next.config"` гэж импортолдог тул
// CommonJS export үед "is not a module" гэж build унадаг.
export default withPWA(nextConfig) as NextConfig;
