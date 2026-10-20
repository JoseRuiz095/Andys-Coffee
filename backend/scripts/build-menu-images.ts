/**
 * Converts the original menu photos to the WebP files committed in assets/menu-images, with
 * the same pipeline the API applies to uploads (orientation, max size, WebP quality).
 *
 *   npx tsx scripts/build-menu-images.ts [sourceDir]
 *
 * sourceDir defaults to assets/menu-images-originals (<Folder>/<Name>.png|jpg|webp, ignored by
 * git). Existing WebP files are overwritten: run it only when an original changes.
 */
import fs from "node:fs";
import path from "node:path";
import { processProductImage } from "../src/services/image-processing.service";
import { MENU_IMAGES_DIR, MENU_IMAGES_ORIGINALS_DIR } from "../prisma/menu-images";

const SOURCE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif"]);

async function main() {
  const sourceDir = path.resolve(process.argv[2] ?? MENU_IMAGES_ORIGINALS_DIR);
  let totalIn = 0;
  let totalOut = 0;
  for (const folder of fs.readdirSync(sourceDir, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
    for (const file of fs.readdirSync(path.join(sourceDir, folder.name))) {
      const extension = path.extname(file).toLowerCase();
      if (!SOURCE_EXTENSIONS.has(extension)) continue;
      const input = fs.readFileSync(path.join(sourceDir, folder.name, file));
      const output = await processProductImage(input);
      const target = path.join(MENU_IMAGES_DIR, folder.name, `${path.basename(file, path.extname(file))}.webp`);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, output.data);
      totalIn += input.length;
      totalOut += output.data.length;
      console.log(`${folder.name}/${file}: ${(input.length / 1024).toFixed(0)} KB → ${(output.data.length / 1024).toFixed(0)} KB (${output.width}x${output.height})`);
    }
  }
  console.log(`\nTotal: ${(totalIn / 1048576).toFixed(1)} MB → ${(totalOut / 1048576).toFixed(1)} MB`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
