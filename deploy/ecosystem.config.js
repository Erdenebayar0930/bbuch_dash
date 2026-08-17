/**
 * PM2 тохиргоо — Ubuntu сервер дээр dashboard-ыг ажиллуулна.
 *
 * Ашиглах:
 *   cd /var/www/bid_tuslay
 *   pm2 start deploy/ecosystem.config.js
 *   pm2 save
 *
 * ЧУХАЛ: 127.0.0.1 дээр л сонсоно — гаднаас шууд хандах боломжгүй,
 * зөвхөн Nginx дамжуулна. Ингэснээр 3000 портыг галт ханаанд нээх
 * шаардлагагүй болно.
 */
module.exports = {
  apps: [
    {
      name: "bid_tuslay",
      cwd: "/var/www/bid_tuslay",
      // `npm run start` биш next-ийн binary-г шууд дуудна — PM2 restart хийхэд
      // npm дундын процесс үлдэхгүй, дохио (SIGINT) шууд апп руу очно.
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3000",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      // Next.js-ийн санах ойн алдагдал хуримтлагдвал автоматаар сэргээнэ.
      max_memory_restart: "700M",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      error_file: "/var/log/bid_tuslay/error.log",
      out_file: "/var/log/bid_tuslay/out.log",
      time: true,
    },
  ],
};
