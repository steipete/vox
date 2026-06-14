import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, "..", "public", "og-image.svg");
const pngPath = join(__dirname, "..", "public", "og-image.png");

const svgBuffer = readFileSync(svgPath);

await sharp(svgBuffer, { density: 144 })
  .resize(1200, 630, { fit: "contain", background: { r: 5, g: 5, b: 10, alpha: 1 } })
  .png({ compressionLevel: 9, quality: 100 })
  .toFile(pngPath);

console.log(`Generated ${pngPath}`);
