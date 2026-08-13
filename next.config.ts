import type { NextConfig } from "next";

// next-pwa@5 нь TypeScript тодорхойлолтгүй тул require-ээр авна (import хийвэл
// TS7016 "declaration file олдсонгүй" гэж унана).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const defaultRuntimeCaching = require("next-pwa/cache");

// ⚠ /api/* хариултыг кэшлэхгүй. Энэ систем нэг төхөөрөмж дээр олон хэрэглэгч
// ээлжлэн нэвтэрдэг бөгөөд service worker-ийн кэш нь хэрэглэгчээр
// тусгаарлагддаггүй — өмнөх хүний гүйлгээ/хандивын жагсаалт дараагийнх нь
// дэлгэц дээр гарч ирнэ. Мөн гараас нь хассан өгөгдөл 24 цаг "амьд" үлдэнэ.
const runtimeCaching = defaultRuntimeCaching.filter(
  (entry: { options?: { cacheName?: string } }) =>
    entry.options?.cacheName !== "apis"
);

const withPWA = require("next-pwa")({
  dest: "public",
  // ⚠ register: false. next-pwa@5 нь бүртгэлийн кодоо webpack-ийн `main.js`
  // entry-д оруулдаг ба App Router түүнийг ачаалдаггүй (зөвхөн `main-app.js`).
  // Тиймээс бүртгэлийг components/ServiceWorkerRegister.tsx гараар хийнэ.
  register: false,
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

// Тайлбар: output: 'export' авагдсан — мэдэгдэл илгээх /api/notifications/send
// route нь сервер талд ажиллах шаардлагатай (FCM service account түлхүүр браузерт гарч болохгүй).
const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
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
