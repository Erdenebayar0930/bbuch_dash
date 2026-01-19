const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  fallbacks: {
    document: "/_offline.html",
  },
  disable: process.env.NODE_ENV === "development",
});

module.exports = withPWA({
  reactStrictMode: true,
  webpack(config: { module: { rules: { test: RegExp; issuer: RegExp; use: string[]; }[]; }; }) {
    if (config.module) {
      config.module.rules.push({
        test: /\.svg$/,
        issuer: /\.[jt]sx?$/,
        use: ["@svgr/webpack"],
      });
    }
    return config;
  },
});
