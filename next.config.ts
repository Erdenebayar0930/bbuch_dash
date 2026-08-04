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
module.exports = withPWA({
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
});
