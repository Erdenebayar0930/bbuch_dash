import { readFileSync } from "node:fs";

import { defineConfig } from "drizzle-kit";

// drizzle-kit нь Next.js-ийн env ачаалагчийг ашигладаггүй тул .env.local-ыг
// өөрсдөө уншина (нэмэлт хамаарал шаардахгүйн тулд гараар задална).
function loadEnvLocal() {
  if (process.env.DATABASE_URL) return;

  try {
    const raw = readFileSync(".env.local", "utf8");

    // Windows дээр .env.local нь CRLF-тэй байдаг — "\n"-ээр л таславал мөр
    // бүрийн төгсгөлд "\r" үлдэж regex таарахаа больдог.
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!match) continue;

      const [, key, rawValue] = match;
      const value = rawValue.trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env.local байхгүй бол системийн env-ээс уншина
  }
}

loadEnvLocal();

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // website/ апп нь өөрийн "site_" угтвартай хүснэгтүүдтэй. Хэрэв нэг санг
  // хуваалцах болвол эдгээрийг хасахгүй үед `drizzle-kit push` нь "схемд алга"
  // гэж үзээд DROP TABLE site_posts/site_categories үүсгэнэ.
  tablesFilter: ["!site_*"],
});
