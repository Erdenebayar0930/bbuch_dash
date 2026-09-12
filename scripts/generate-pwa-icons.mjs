/**
 * PWA icon үүсгэгч — `node scripts/generate-pwa-icons.mjs`
 *
 * Логог (public/images/logo/logo-mark.png — ил тод дэвсгэртэй ББУЧ сүлд)
 * эх болгон public/icons/ доор PNG-үүдийг гаргана. Хөтөч manifest доторх
 * icon-ыг татаж чадахгүй бол "Install" санал огт гарахгүй тул эдгээр файл
 * ЗААВАЛ репод байх ёстой.
 *
 * Сүлд өөрөө нил ягаан + алт өнгөтэй, дотор талдаа цайвар тул дэвсгэрийг
 * ЦАГААН болгоно — ягаан дэвсгэр дээр тавибал сүлдний ягаан хэсэг (цагираг,
 * загалмай, тууз) уусан алга болно.
 *
 * Гурван төрөл гаргана:
 *  - "any"        — бөөрөнхий булантай, ирмэг хүртэл дүүрэн.
 *  - "maskable"   — Android дурын хэлбэрээр (тойрог, squircle) тайрдаг тул
 *                   захаас ~20% "аюулгүй бүс" үлдээж, дэвсгэрийг ирмэг хүртэл
 *                   дүүргэнэ. Үүнийг "any"-тай нэг файлаар хуваалцаж БОЛОХГҮЙ:
 *                   нэг нь тайрагдана, нөгөө нь хэт жижиг харагдана.
 *  - "monochrome" — мэдэгдлийн badge. Android status bar дээр зөвхөн силуэтийг
 *                   нь авдаг тул сүлдний alpha-г цагаан дүүргэлт болгоно.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "public", "icons");
const SRC_LOGO = path.join(ROOT, "public", "images", "logo", "logo-mark.png");

/** Icon-ы дэвсгэр. Сүлдний дотор тал цайвар тул цагаан нь хамгийн цэвэр. */
const BG = { r: 255, g: 255, b: 255, alpha: 1 };

/**
 * @param size   гаралтын хэмжээ (px)
 * @param inset  сүлд icon-ы хэдэн хувийг эзлэх (0..1)
 * @param round  булангийн радиус, size-ийн хувиар. 0 бол дөрвөлжин.
 */
async function compose(size, inset, round) {
  const logoSize = Math.round(size * inset);
  const offset = Math.round((size - logoSize) / 2);

  const logo = await sharp(SRC_LOGO)
    .resize(logoSize, logoSize, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();

  const layers = [{ input: logo, left: offset, top: offset }];

  // Бөөрөнхий булан — дэвсгэрийг SVG маскаар тайрна.
  if (round > 0) {
    const r = size * round;
    const mask = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
        `<rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#fff"/></svg>`
    );
    layers.push({ input: mask, blend: "dest-in" });
  }

  return sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite(layers)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** Силуэт badge — өнгийг хаяж, зөвхөн alpha-г цагаанаар дүүргэнэ. */
async function silhouette(size) {
  const alpha = await sharp(SRC_LOGO)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extractChannel("alpha")
    .toBuffer();

  return sharp({
    create: { width: size, height: size, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .joinChannel(alpha)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

const TARGETS = [
  { file: "icon-192x192.png", make: () => compose(192, 0.88, 0.22) },
  { file: "icon-512x512.png", make: () => compose(512, 0.88, 0.22) },
  { file: "icon-maskable-192x192.png", make: () => compose(192, 0.62, 0) },
  { file: "icon-maskable-512x512.png", make: () => compose(512, 0.62, 0) },
  // iOS нь ил тод дэвсгэрийг хараар дүүргэдэг тул apple-touch-icon дүүрэн байна.
  // Булангаа өөрөө бөөрөнхийлдөг тул энд дөрвөлжнөөр үлдээнэ.
  { file: "apple-touch-icon.png", make: () => compose(180, 0.86, 0) },
  { file: "badge-72x72.png", make: () => silhouette(72) },
];

await mkdir(OUT_DIR, { recursive: true });

for (const { file, make } of TARGETS) {
  const png = await make();
  await writeFile(path.join(OUT_DIR, file), png);
  console.log(`✓ public/icons/${file} (${(png.length / 1024).toFixed(1)} KB)`);
}

console.log(`\n${TARGETS.length} icon үүслээ → ${OUT_DIR}`);
