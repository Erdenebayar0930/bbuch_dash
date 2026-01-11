/** @type {import('next').NextConfig} */
const nextConfig = {
  // өөрийн бусад тохиргоо
  turbopack: {}, // хоосон Turbopack config нэмнэ
};

module.exports = nextConfig;
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
});

module.exports = withPWA({
  // бусад config
  turbopack: {}, // хоосон Turbopack config нэмнэ
});
