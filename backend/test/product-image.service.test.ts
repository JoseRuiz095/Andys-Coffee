import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import sharp from "sharp";
import { ProductImageService } from "../src/services/product-image.service";
import { ProductRepository } from "../src/repositories/product.repository";
import { ImageReferenceRepository } from "../src/repositories/image-reference.repository";
import { ImageStorageRepository, type ImageStorage } from "../src/repositories/image-storage.repository";
import type { AuthUser } from "../src/services/auth.service";

const PRODUCT_ID = "0b6c8b4e-1111-4222-8333-944445555666";
const OLD_KEY = `products/${PRODUCT_ID}/old.webp`;
const editor = { id: "u1", name: "Admin", permissions: ["products.update"] } as unknown as AuthUser;
const cashier = { id: "u2", name: "Cajero", permissions: ["products.read"] } as unknown as AuthUser;

type FakeStorage = ImageStorage & { files: Map<string, Buffer>; failUpload: boolean; failRemove: boolean };

let storage: FakeStorage;
let dbImage: string | null;
let references: number;

function fakeStorage(initial: string[] = []): FakeStorage {
  const files = new Map<string, Buffer>(initial.map((key) => [key, Buffer.from("old")]));
  const fake: FakeStorage = {
    files,
    failUpload: false,
    failRemove: false,
    async upload(key, data) {
      if (fake.failUpload) throw Object.assign(new Error("No se pudo guardar"), { name: "StorageError" });
      if (files.has(key)) throw new Error("exists");
      files.set(key, data);
    },
    async remove(key) {
      if (fake.failRemove) throw new Error("storage down");
      files.delete(key);
    },
  };
  return fake;
}

const validImage = () =>
  sharp({ create: { width: 1600, height: 1600, channels: 3, background: { r: 120, g: 80, b: 40 } } }).png().toBuffer();

beforeEach(() => {
  dbImage = OLD_KEY;
  references = 0;
  storage = fakeStorage([OLD_KEY]);
  ImageStorageRepository.setForTests(storage);
  mock.method(ProductRepository, "findImageById", async (id: string) => (id === PRODUCT_ID ? { id, imageUrl: dbImage } : null));
  mock.method(ProductRepository, "replaceImageIfUnchanged", async (_id: string, expected: string | null, next: string | null) => {
    if (dbImage !== expected) return false;
    dbImage = next;
    return true;
  });
  mock.method(ImageReferenceRepository, "count", async () => references);
});

afterEach(() => {
  mock.restoreAll();
  ImageStorageRepository.setForTests(null);
});

test("sube la imagen como WebP, la asigna y borra la anterior si nadie más la usa", async () => {
  const result = await ProductImageService.replace(PRODUCT_ID, await validImage(), editor);

  assert.match(dbImage ?? "", new RegExp(`^products/${PRODUCT_ID}/[0-9a-f-]{36}\\.webp$`));
  assert.equal((await sharp(storage.files.get(dbImage!)!).metadata()).format, "webp");
  assert.equal(result.width, 1200);
  assert.equal(result.imageUrl, `http://localhost:54321/storage/v1/object/public/Img/${dbImage}`);
  assert.equal(storage.files.has(OLD_KEY), false, "la imagen anterior se elimina");
});

test("un archivo inválido no cambia nada: se conserva la imagen anterior", async () => {
  await assert.rejects(ProductImageService.replace(PRODUCT_ID, Buffer.from("no soy imagen"), editor), { name: "ValidationError" });
  assert.equal(dbImage, OLD_KEY);
  assert.deepEqual([...storage.files.keys()], [OLD_KEY]);
});

test("si falla el almacenamiento, la base de datos no cambia", async () => {
  storage.failUpload = true;
  await assert.rejects(ProductImageService.replace(PRODUCT_ID, await validImage(), editor), { name: "StorageError" });
  assert.equal(dbImage, OLD_KEY);
  assert.deepEqual([...storage.files.keys()], [OLD_KEY]);
});

test("si falla la base de datos, se borra el archivo recién subido y se conserva el anterior", async () => {
  mock.method(ProductRepository, "replaceImageIfUnchanged", async () => {
    throw new Error("db down");
  });
  await assert.rejects(ProductImageService.replace(PRODUCT_ID, await validImage(), editor), /db down/);
  assert.equal(dbImage, OLD_KEY);
  assert.deepEqual([...storage.files.keys()], [OLD_KEY], "no quedan archivos huérfanos");
});

test("si la imagen cambió en paralelo, responde conflicto y limpia la subida", async () => {
  mock.method(ProductRepository, "replaceImageIfUnchanged", async () => false);
  await assert.rejects(ProductImageService.replace(PRODUCT_ID, await validImage(), editor), { name: "ConflictError" });
  assert.deepEqual([...storage.files.keys()], [OLD_KEY]);
});

test("no borra un archivo compartido con otro producto", async () => {
  references = 1;
  await ProductImageService.replace(PRODUCT_ID, await validImage(), editor);
  assert.equal(storage.files.has(OLD_KEY), true);
});

test("nunca borra imágenes del catálogo ni URLs externas", async () => {
  for (const previous of ["catalog/Drinks/Andys.webp", "Menu/Andys.png", "https://cdn.example.com/a.webp"]) {
    dbImage = previous;
    storage.files.set(previous, Buffer.from("x"));
    await ProductImageService.replace(PRODUCT_ID, await validImage(), editor);
    assert.equal(storage.files.has(previous), true, previous);
  }
});

test("eliminar la imagen quita la referencia y el archivo", async () => {
  await ProductImageService.remove(PRODUCT_ID, editor);
  assert.equal(dbImage, null);
  assert.equal(storage.files.has(OLD_KEY), false);
});

test("eliminar la imagen conserva el archivo si está compartido", async () => {
  references = 2;
  await ProductImageService.remove(PRODUCT_ID, editor);
  assert.equal(dbImage, null);
  assert.equal(storage.files.has(OLD_KEY), true);
});

test("un fallo al borrar el archivo no revierte la operación (queda registrado como huérfano)", async () => {
  storage.failRemove = true;
  await ProductImageService.remove(PRODUCT_ID, editor);
  assert.equal(dbImage, null);
  assert.equal(await ProductImageService.release(OLD_KEY), "orphaned");
});

test("sin permiso products.update no se sube ni se elimina nada", async () => {
  await assert.rejects(ProductImageService.replace(PRODUCT_ID, await validImage(), cashier), { name: "AuthorizationError" });
  await assert.rejects(ProductImageService.remove(PRODUCT_ID, cashier), { name: "AuthorizationError" });
  assert.equal(dbImage, OLD_KEY);
  assert.deepEqual([...storage.files.keys()], [OLD_KEY]);
});

test("producto inexistente: 404 sin tocar el almacenamiento", async () => {
  await assert.rejects(ProductImageService.replace("otro", await validImage(), editor), { name: "NotFoundError" });
  assert.deepEqual([...storage.files.keys()], [OLD_KEY]);
});
