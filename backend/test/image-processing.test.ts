import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { processProductImage } from "../src/services/image-processing.service";

const OPTIONS = { maxDimension: 1200, webpQuality: 80, maxInputPixels: 50_000_000, minDimension: 100 };

/** A photo-like PNG: blurred gaussian noise (flat colors would compress too well). */
async function photoPng(width: number, height: number) {
  const noise = await sharp({
    create: { width, height, channels: 3, background: { r: 140, g: 100, b: 60 }, noise: { type: "gaussian", mean: 128, sigma: 40 } },
  }).png().toBuffer();
  return sharp(noise).blur(1.5).png().toBuffer();
}

const isWebp = (data: Buffer) => data.subarray(0, 4).toString("ascii") === "RIFF" && data.subarray(8, 12).toString("ascii") === "WEBP";

test("convierte una imagen válida a WebP real y la reduce al ancho máximo", async () => {
  const input = await photoPng(3000, 2000);
  const output = await processProductImage(input, OPTIONS);

  assert.ok(isWebp(output.data), "la salida debe tener la firma RIFF/WEBP");
  const metadata = await sharp(output.data).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(output.width, 1200);
  assert.equal(output.height, 800);
  assert.ok(output.data.length < input.length, `${output.data.length} debe ser menor que ${input.length}`);
  assert.equal(output.originalBytes, input.length);
});

test("no agranda imágenes pequeñas", async () => {
  const output = await processProductImage(await photoPng(500, 300), OPTIONS);
  assert.equal(output.width, 500);
  assert.equal(output.height, 300);
});

test("acepta JPEG y WebP de entrada", async () => {
  const jpeg = await sharp(await photoPng(400, 400)).jpeg().toBuffer();
  const webp = await sharp(await photoPng(400, 400)).webp().toBuffer();
  assert.ok(isWebp((await processProductImage(jpeg, OPTIONS)).data));
  assert.ok(isWebp((await processProductImage(webp, OPTIONS)).data));
});

test("corrige la orientación EXIF de las fotografías", async () => {
  // Stored 400x200 but tagged "rotate 90°": it must come out 200x400.
  const rotated = await sharp(await photoPng(400, 200)).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const output = await processProductImage(rotated, OPTIONS);
  assert.equal(output.width, 200);
  assert.equal(output.height, 400);
});

test("elimina los metadatos (EXIF/GPS) de la imagen guardada", async () => {
  const tagged = await sharp(await photoPng(300, 300)).jpeg().withMetadata({ orientation: 1 }).toBuffer();
  const metadata = await sharp((await processProductImage(tagged, OPTIONS)).data).metadata();
  assert.equal(metadata.exif, undefined);
});

test("rechaza contenido que no es imagen aunque se declare como tal", async () => {
  await assert.rejects(processProductImage(Buffer.from("<script>alert(1)</script>"), OPTIONS), { name: "ValidationError" });
  await assert.rejects(processProductImage(Buffer.alloc(0), OPTIONS), { name: "ValidationError" });
});

test("rechaza imágenes dañadas (truncadas)", async () => {
  const png = await photoPng(800, 800);
  const truncated = png.subarray(0, Math.floor(png.length / 3));
  await assert.rejects(processProductImage(truncated, OPTIONS), { name: "ValidationError" });
});

test("rechaza formatos no admitidos (GIF, SVG)", async () => {
  const gif = await sharp(await photoPng(200, 200)).gif().toBuffer();
  await assert.rejects(processProductImage(gif, OPTIONS), { name: "ValidationError", message: /Formato no admitido/ });
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300"/></svg>');
  await assert.rejects(processProductImage(svg, OPTIONS), { name: "ValidationError", message: /Formato no admitido/ });
});

test("rechaza imágenes demasiado pequeñas", async () => {
  await assert.rejects(processProductImage(await photoPng(60, 60), OPTIONS), { name: "ValidationError", message: /al menos 100 px/ });
});

test("rechaza imágenes que exceden el límite de píxeles (bombas de descompresión)", async () => {
  const input = await photoPng(1000, 1000);
  await assert.rejects(processProductImage(input, { ...OPTIONS, maxInputPixels: 500_000 }), { name: "ValidationError" });
});

test("respeta la calidad configurada", async () => {
  const input = await photoPng(1000, 1000);
  const low = await processProductImage(input, { ...OPTIONS, webpQuality: 40 });
  const high = await processProductImage(input, { ...OPTIONS, webpQuality: 95 });
  assert.ok(low.data.length < high.data.length);
});
