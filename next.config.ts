import type { NextConfig } from "next";

// next-pwa@5 нь TypeScript тодорхойлолтгүй тул require-ээр авна (import хийвэл
// TS7016 "declaration file олдсонгүй" гэж унана).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
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
