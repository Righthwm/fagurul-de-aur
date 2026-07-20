// One-off: generates the admin PWA icons from the site logo. Run with
//   node scripts/generate-pwa-icons.mjs
// then commit the PNGs. The maskable icon gets extra padding so Android's
// circular mask doesn't clip the hexagon.
import sharp from "sharp";
import { mkdirSync } from "fs";

mkdirSync("public/icons", { recursive: true });
const BG = "#0D0A06"; // --color-bg-primary

async function make(size, pad, out) {
  const inner = size - pad * 2;
  const logo = await sharp("public/logo.svg", { density: 384 })
    .resize({ width: inner, height: inner, fit: "contain", background: BG })
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: logo, left: pad, top: pad }])
    .png()
    .toFile(out);
  console.log("wrote", out);
}

await make(192, 16, "public/icons/admin-192.png");
await make(512, 42, "public/icons/admin-512.png");
await make(512, 96, "public/icons/admin-512-maskable.png");
