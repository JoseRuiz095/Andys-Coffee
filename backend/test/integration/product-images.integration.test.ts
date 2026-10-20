import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { after, before, beforeEach, test } from "node:test";
import sharp from "sharp";
import { app } from "../../src/app";
import { createJwtToken, type AuthUser } from "../../src/services/auth.service";
import { prisma } from "../../src/config/prisma";
import { ImageStorageRepository, type ImageStorage } from "../../src/repositories/image-storage.repository";

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "true";
const testId = randomUUID();
const permissionNames = ["products.read", "products.update", "products.delete"];
const PUBLIC_PREFIX = "http://localhost:54321/storage/v1/object/public/Img/";

let server: Server;
let baseUrl: string;
let manager: AuthUser;
let viewer: AuthUser;
let categoryId: string;
let productId: string;
let otherProductId: string;

/** In-memory storage: what the API uploads and deletes, without Supabase. */
const files = new Map<string, Buffer>();
const fakeStorage: ImageStorage = {
  async upload(key, data) {
    if (files.has(key)) throw new Error("exists");
    files.set(key, data);
  },
  async remove(key) {
    files.delete(key);
  },
};

const photo = (width = 1800, height = 1200) =>
  sharp({ create: { width, height, channels: 3, background: { r: 150, g: 90, b: 50 }, noise: { type: "gaussian", mean: 120, sigma: 30 } } })
    .png()
    .toBuffer();

async function csrf() {
  const response = await fetch(`${baseUrl}/api/auth/csrf`);
  const token = (await response.json() as { token: string }).token;
  return { Cookie: response.headers.get("set-cookie")!.split(";")[0], "X-CSRF-TOKEN": token };
}

async function uploadImage(id: string, data: Buffer | null, user?: AuthUser, type = "image/png") {
  const form = new FormData();
  if (data) form.append("image", new Blob([new Uint8Array(data)], { type }), "foto.png");
  const headers: Record<string, string> = await csrf();
  if (user) headers.Authorization = `Bearer ${createJwtToken(user)}`;
  return fetch(`${baseUrl}/api/products/${id}/image`, { method: "PATCH", body: form, headers });
}

async function removeImage(id: string, user?: AuthUser) {
  const headers: Record<string, string> = await csrf();
  if (user) headers.Authorization = `Bearer ${createJwtToken(user)}`;
  return fetch(`${baseUrl}/api/products/${id}/image`, { method: "DELETE", headers });
}

const storedImage = async (id: string) => (await prisma.product.findUniqueOrThrow({ where: { id }, select: { imageUrl: true } })).imageUrl;

before(async () => {
  if (!integrationEnabled) return;
  ImageStorageRepository.setForTests(fakeStorage);

  const permissions = await Promise.all(
    permissionNames.map((name) => prisma.permission.upsert({ where: { name }, update: {}, create: { name } })),
  );
  const role = await prisma.role.create({
    data: { name: `img-role-${testId}`, permissions: { create: permissions.map((p) => ({ permissionId: p.id })) } },
  });
  const viewerRole = await prisma.role.create({ data: { name: `img-viewer-${testId}` } });
  const [managerRecord, viewerRecord] = await Promise.all([
    prisma.user.create({ data: { name: "Img Manager", email: `img-m-${testId}@example.com`, passwordHash: "x", roleId: role.id } }),
    prisma.user.create({ data: { name: "Img Viewer", email: `img-v-${testId}@example.com`, passwordHash: "x", roleId: viewerRole.id } }),
  ]);
  manager = { id: managerRecord.id, name: managerRecord.name, email: managerRecord.email, roleId: role.id, roleName: role.name, isActive: true, permissions: permissionNames };
  viewer = { id: viewerRecord.id, name: viewerRecord.name, email: viewerRecord.email, roleId: viewerRole.id, roleName: viewerRole.name, isActive: true, permissions: [] };

  categoryId = (await prisma.category.create({ data: { name: `Img Cat ${testId}`, displayOrder: 999 } })).id;
  const base = { price: 50, cost: 10, categoryId, isActive: true };
  productId = (await prisma.product.create({ data: { ...base, name: "Img Product", sku: `IMG-A-${testId}`, imageUrl: "catalog/Drinks/Andys.webp" } })).id;
  otherProductId = (await prisma.product.create({ data: { ...base, name: "Img Other", sku: `IMG-B-${testId}` } })).id;

  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

beforeEach(() => files.clear());

after(async () => {
  if (!integrationEnabled) return;
  ImageStorageRepository.setForTests(null);
  await prisma.product.deleteMany({ where: { categoryId } });
  await prisma.category.deleteMany({ where: { id: categoryId } });
  await prisma.user.deleteMany({ where: { email: { in: [`img-m-${testId}@example.com`, `img-v-${testId}@example.com`] } } });
  await prisma.role.deleteMany({ where: { name: { in: [`img-role-${testId}`, `img-viewer-${testId}`] } } });
  await prisma.$disconnect();
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

test("subir o quitar imágenes exige sesión (401) y products.update (403)", { skip: !integrationEnabled }, async () => {
  const image = await photo();
  assert.equal((await uploadImage(productId, image)).status, 401);
  assert.equal((await removeImage(productId)).status, 401);
  assert.equal((await uploadImage(productId, image, viewer)).status, 403);
  assert.equal((await removeImage(productId, viewer)).status, 403);
  assert.equal(await storedImage(productId), "catalog/Drinks/Andys.webp");
  assert.equal(files.size, 0);
});

test("una imagen válida se convierte a WebP, se guarda y se refleja en catálogo y menú", { skip: !integrationEnabled }, async () => {
  const response = await uploadImage(productId, await photo(), manager);
  assert.equal(response.status, 200);
  const body = await response.json() as { imageUrl: string; width: number; bytes: number; originalBytes: number };

  const key = await storedImage(productId);
  assert.match(key ?? "", new RegExp(`^products/${productId}/[0-9a-f-]{36}\\.webp$`));
  assert.equal(body.imageUrl, `${PUBLIC_PREFIX}${key}`);
  assert.equal(body.width, 1200);
  assert.equal((await sharp(files.get(key!)!).metadata()).format, "webp");

  const headers = { ...(await csrf()), Authorization: `Bearer ${createJwtToken(manager)}` };
  const detail = await (await fetch(`${baseUrl}/api/products/${productId}`, { headers })).json() as { imageUrl: string };
  assert.equal(detail.imageUrl, body.imageUrl);

  const menu = await (await fetch(`${baseUrl}/api/menu`)).json() as { id: string; items: { id: string; imageUrl: string | null }[] }[];
  const menuItem = menu.find((category) => category.id === categoryId)?.items.find((item) => item.id === productId);
  assert.equal(menuItem?.imageUrl, body.imageUrl, "el menú de ventas usa la misma referencia persistida");
});

test("un reemplazo fallido conserva la imagen anterior", { skip: !integrationEnabled }, async () => {
  await uploadImage(productId, await photo(), manager);
  const before = await storedImage(productId);

  const corrupt = await uploadImage(productId, Buffer.from("no es una imagen"), manager);
  assert.equal(corrupt.status, 400);
  const notImage = await uploadImage(productId, Buffer.from("%PDF-1.4"), manager, "application/pdf");
  assert.equal(notImage.status, 400);
  const empty = await uploadImage(productId, null, manager);
  assert.equal(empty.status, 400);

  assert.equal(await storedImage(productId), before);
  assert.deepEqual([...files.keys()], [before]);
});

test("rechaza archivos que superan el límite de tamaño con 413", { skip: !integrationEnabled }, async () => {
  const before = await storedImage(productId);
  const response = await uploadImage(productId, Buffer.alloc(11 * 1024 * 1024, 1), manager);
  assert.equal(response.status, 413);
  assert.equal(await storedImage(productId), before);
});

test("al reemplazar se borra el archivo anterior, salvo si otro producto lo comparte", { skip: !integrationEnabled }, async () => {
  await uploadImage(productId, await photo(), manager);
  const first = (await storedImage(productId))!;

  await uploadImage(productId, await photo(), manager);
  const second = (await storedImage(productId))!;
  assert.notEqual(second, first);
  assert.equal(files.has(first), false, "el archivo anterior ya no se usa y se elimina");

  await prisma.product.update({ where: { id: otherProductId }, data: { imageUrl: second } });
  await uploadImage(productId, await photo(), manager);
  assert.equal(files.has(second), true, "el archivo compartido se conserva");
  await prisma.product.update({ where: { id: otherProductId }, data: { imageUrl: null } });
});

test("eliminar la imagen quita la referencia y el archivo", { skip: !integrationEnabled }, async () => {
  await uploadImage(productId, await photo(), manager);
  const key = (await storedImage(productId))!;

  const response = await removeImage(productId, manager);
  assert.equal(response.status, 204);
  assert.equal(await storedImage(productId), null);
  assert.equal(files.has(key), false);
  assert.equal((await removeImage(productId, manager)).status, 204, "es idempotente");
});

test("PATCH /products no permite fijar imageUrl arbitrarias", { skip: !integrationEnabled }, async () => {
  const headers = { ...(await csrf()), "Content-Type": "application/json", Authorization: `Bearer ${createJwtToken(manager)}` };
  const response = await fetch(`${baseUrl}/api/products/${productId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ imageUrl: "https://evil.example.com/x.png", description: "ok" }),
  });
  assert.equal(response.status, 200);
  assert.equal(await storedImage(productId), null);
});
