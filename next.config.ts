// next.config.js
const withPWA = require("next-pwa")({
  dest: "public", // service worker-ийг public/ дотор гаргана
  register: true,
  skipWaiting: true,
  fallbacks: {
    document: "/_offline.html",
  },
  disable: process.env.NODE_ENV === "development", // dev-д PWA идэвхгүй
});

module.exports = withPWA({
  reactStrictMode: true,
});
