import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildProductImageKey,
  isManagedKey,
  publicUrlForKey,
  referenceVariants,
  resolveImageUrl,
  toStorageKey,
} from "../src/utils/imageKeys";

const config = { supabaseUrl: "https://abc.supabase.co", bucket: "Img" };
const PUBLIC = "https://abc.supabase.co/storage/v1/object/public/Img";

test("toStorageKey acepta claves y URLs públicas del propio bucket", () => {
  assert.equal(toStorageKey("products/p1/a.webp", config), "products/p1/a.webp");
  assert.equal(toStorageKey("/Menu/Andys.png", config), "Menu/Andys.png");
  assert.equal(toStorageKey(`${PUBLIC}/public/x%20y.png`, config), "public/x y.png");
});

test("toStorageKey rechaza URLs ajenas y rutas con traversal", () => {
  assert.equal(toStorageKey("https://evil.example.com/storage/v1/object/public/Img/products/a.webp", config), null);
  assert.equal(toStorageKey("https://abc.supabase.co/storage/v1/object/public/Otro/a.webp", config), null);
  assert.equal(toStorageKey("products/../secrets.txt", config), null);
  assert.equal(toStorageKey(`${PUBLIC}/products/..%2Fsecret.txt`, config), null);
  assert.equal(toStorageKey(null, config), null);
});

test("resolveImageUrl convierte claves en URL pública y respeta URLs absolutas", () => {
  assert.equal(resolveImageUrl("catalog/Drinks/Andys.webp", config), `${PUBLIC}/catalog/Drinks/Andys.webp`);
  assert.equal(resolveImageUrl("https://cdn.example.com/a.webp", config), "https://cdn.example.com/a.webp");
  assert.equal(resolveImageUrl(null, config), null);
  assert.equal(resolveImageUrl("catalog/a.webp", { supabaseUrl: undefined, bucket: "Img" }), null);
  assert.equal(publicUrlForKey("Menu/Coffee Cream.png", config), `${PUBLIC}/Menu/Coffee%20Cream.png`);
});

test("solo las subidas de la app se consideran administradas (borrables)", () => {
  assert.equal(isManagedKey("products/p1/a.webp"), true);
  assert.equal(isManagedKey("public/uuid.png"), true);
  assert.equal(isManagedKey("catalog/Drinks/Andys.webp"), false);
  assert.equal(isManagedKey("Menu/Andys.png"), false);
});

test("buildProductImageKey genera nombres únicos del servidor", () => {
  const a = buildProductImageKey("0b6c8b4e-1111-4222-8333-944445555666");
  const b = buildProductImageKey("0b6c8b4e-1111-4222-8333-944445555666");
  assert.match(a, /^products\/0b6c8b4e-1111-4222-8333-944445555666\/[0-9a-f-]{36}\.webp$/);
  assert.notEqual(a, b);
  assert.throws(() => buildProductImageKey("../x"));
});

test("referenceVariants cubre la clave y la URL pública del mismo archivo", () => {
  assert.deepEqual(new Set(referenceVariants("products/p1/a.webp", config)), new Set(["products/p1/a.webp", `${PUBLIC}/products/p1/a.webp`]));
  assert.deepEqual(
    new Set(referenceVariants(`${PUBLIC}/public/u.png`, config)),
    new Set([`${PUBLIC}/public/u.png`, "public/u.png"]),
  );
});
