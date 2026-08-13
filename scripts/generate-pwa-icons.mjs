/**
 * PWA icon үүсгэгч — `node scripts/generate-pwa-icons.mjs`
 *
 * Логог (public/images/logo/logo-icon.svg) эх болгон public/icons/ доор
 * PNG-үүдийг гаргана. Хөтөч manifest доторх icon-ыг татаж чадахгүй бол
 * "Install" санал огт гарахгүй тул эдгээр файл ЗААВАЛ репод байх ёстой.
 *
 * Хоёр төрөл гаргана:
 *  - "any"      — өөрийн бөөрөнхий булантай, ирмэг хүртэл дүүрэн лого.
 *  - "maskable" — Android дурын хэлбэрээр (тойрог, squircle) тайрдаг тул
 *                 захаас 20% "аюулгүй бүс" үлдээж, дэвсгэрийг ирмэг хүртэл
 *                 дүүргэнэ. Үүнийг "any"-тай нэг файлаар хуваалцаж БОЛОХГҮЙ:
 *                 нэг нь тайрагдана, нөгөө нь хэт жижиг харагдана.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "public", "icons");

/** Логоны брэнд өнгө — logo-icon.svg доторхтой ижил байлгана. */
const BRAND = "#465FFF";

/**
 * Логоны гурван багана. Эх SVG-ийн 32×32 сүлжээн дэх байрлал.
 * Эх файлын drop-shadow филтерүүдийг зориуд авсан — жижиг хэмжээнд
 * бүдгэрч, icon-ыг бохир харагдуулдаг.
 */
const BARS = [
  { x: 8.42383, y: 6.7373, w: 3.36837, h: 18.5263, opacity: 1 },
  { x: 14.7422, y: 13.4727, w: 3.3684, h: 11.7894, opacity: 0.9 },
  { x: 21.0547, y: 9.26172, w: 3.3684, h: 16.0, opacity: 0.7 },
];

const barsMarkup = BARS.map(
  (b) =>
    `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${b.w / 2}" fill="#fff" fill-opacity="${b.opacity}"/>`
).join("");

/** Ирмэг хүртэл дүүрэн, бөөрөнхий булантай хувилбар (purpose: any). */
function anySvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
<rect width="32" height="32" rx="8.42105" fill="${BRAND}"/>
${barsMarkup}
</svg>`;
}

/**
 * Дөрвөлжин дэвсгэр + төв рүү жижигрүүлсэн лого (purpose: maskable).
 * Багануудын хүрээ 8.42..24.42 × 6.74..25.26 буюу төв нь (16.42, 16.0).
 * Түүнийг 0.75-аар жижигрүүлбэл нийт агуулга icon-ы төв 80%-д багтана.
 */
function maskableSvg() {
  const scale = 0.75;
  const cx = 16.42;
  const cy = 16.0;
  // Тухайн цэгийг хөдөлгөхгүйгээр масштаблах: translate → scale → translate буцаах.
  const tx = cx - cx * scale;
  const ty = cy - cy * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
<rect width="32" height="32" fill="${BRAND}"/>
<g transform="translate(${tx} ${ty}) scale(${scale})">${barsMarkup}</g>
</svg>`;
}

/** Дэлгэцийн богино тайлбар (badge) — саарал дэвсгэргүй, цагаан дүрстэй. */
function monochromeSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
${barsMarkup.replace(/fill-opacity="[\d.]+"/g, 'fill-opacity="1"')}
</svg>`;
}

const TARGETS = [
  { file: "icon-192x192.png", size: 192, svg: anySvg() },
  { file: "icon-512x512.png", size: 512, svg: anySvg() },
  { file: "icon-maskable-192x192.png", size: 192, svg: maskableSvg() },
  { file: "icon-maskable-512x512.png", size: 512, svg: maskableSvg() },
  // iOS нь ил тод дэвсгэрийг хараар дүүргэдэг тул apple-touch-icon дүүрэн байна.
  { file: "apple-touch-icon.png", size: 180, svg: maskableSvg() },
  // Мэдэгдлийн badge — Android status bar дээр зөвхөн дүрсийг нь силуэт болгоно.
  { file: "badge-72x72.png", size: 72, svg: monochromeSvg() },
];

await mkdir(OUT_DIR, { recursive: true });

for (const { file, size, svg } of TARGETS) {
  const png = await sharp(Buffer.from(svg))
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(path.join(OUT_DIR, file), png);
  console.log(`✓ public/icons/${file} (${size}×${size}, ${(png.length / 1024).toFixed(1)} KB)`);
}

console.log(`\n${TARGETS.length} icon үүслээ → ${OUT_DIR}`);
