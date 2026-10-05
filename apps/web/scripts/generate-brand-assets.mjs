#!/usr/bin/env node
/**
 * Generates PWA icons, favicons and iOS splash screens from the vector logo in public/brand.
 *   node scripts/generate-brand-assets.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brand = path.join(web, "public", "brand");
const icons = path.join(web, "public", "icons");
const splash = path.join(web, "public", "splash");
const appDir = path.join(web, "src", "app");
fs.mkdirSync(icons, { recursive: true });
fs.mkdirSync(splash, { recursive: true });

const INK = "#0E0D0C";
const sealSvg = fs.readFileSync(path.join(brand, "dimsum-seal.svg"));
const lockupWhite = fs.readFileSync(path.join(brand, "dimsum-lockup-white.svg"));

async function sealIcon(size, sealHeightRatio, radius = 0) {
  const sealH = Math.round(size * sealHeightRatio);
  const seal = await sharp(sealSvg, { density: 600 }).resize({ height: sealH }).png().toBuffer();
  const meta = await sharp(seal).metadata();
  const bg = radius
    ? Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="${INK}"/></svg>`,
      )
    : null;
  const base = bg
    ? sharp(bg)
    : sharp({ create: { width: size, height: size, channels: 4, background: INK } });
  return base
    .composite([
      {
        input: seal,
        left: Math.round((size - (meta.width ?? 0)) / 2),
        top: Math.round((size - (meta.height ?? 0)) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** Minimal ICO container embedding PNG images (supported by every modern browser). */
function toIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

async function main() {
  // Manifest icons: "any" keeps a generous seal, "maskable" stays inside the 80 % safe zone.
  fs.writeFileSync(path.join(icons, "icon-192.png"), await sealIcon(192, 0.56));
  fs.writeFileSync(path.join(icons, "icon-512.png"), await sealIcon(512, 0.56));
  fs.writeFileSync(path.join(icons, "maskable-192.png"), await sealIcon(192, 0.42));
  fs.writeFileSync(path.join(icons, "maskable-512.png"), await sealIcon(512, 0.42));
  fs.writeFileSync(
    path.join(icons, "badge-96.png"),
    await sharp(sealSvg, { density: 600 })
      .resize({ height: 72 })
      .extend({ top: 12, bottom: 12, left: 24, right: 24, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer(),
  );

  // App Router file conventions.
  fs.writeFileSync(path.join(appDir, "apple-icon.png"), await sealIcon(180, 0.56));
  fs.writeFileSync(path.join(appDir, "icon.png"), await sealIcon(96, 0.62, 20));
  const ico = toIco([
    { size: 16, data: await sealIcon(16, 0.78, 3) },
    { size: 32, data: await sealIcon(32, 0.72, 6) },
    { size: 48, data: await sealIcon(48, 0.68, 9) },
  ]);
  fs.writeFileSync(path.join(appDir, "favicon.ico"), ico);

  // iOS launch screens (portrait) for current iPhone sizes.
  const screens = [
    [1320, 2868, 3],
    [1290, 2796, 3],
    [1206, 2622, 3],
    [1179, 2556, 3],
    [1170, 2532, 3],
    [1125, 2436, 3],
    [828, 1792, 2],
    [750, 1334, 2],
  ];
  for (const [w, h] of screens) {
    const logo = await sharp(lockupWhite, { density: 600 })
      .resize({ width: Math.round(w * 0.62) })
      .png()
      .toBuffer();
    const m = await sharp(logo).metadata();
    await sharp({ create: { width: w, height: h, channels: 4, background: INK } })
      .composite([
        {
          input: logo,
          left: Math.round((w - (m.width ?? 0)) / 2),
          top: Math.round(h * 0.44 - (m.height ?? 0) / 2),
        },
      ])
      .png({ compressionLevel: 9 })
      .toFile(path.join(splash, `splash-${w}x${h}.png`));
  }
  console.log("brand assets generated");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
