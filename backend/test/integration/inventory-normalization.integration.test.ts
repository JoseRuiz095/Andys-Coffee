import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { prisma } from "../../src/config/prisma";
import type { AuthUser } from "../../src/services/auth.service";
import { InventoryService } from "../../src/services/inventory.service";
import { ProductService } from "../../src/services/product.service";

// Plan F2: ingredients always get a SKU and a base unit, maximum >= minimum, an ingredient
// used by an active recipe can't be deactivated, the low-stock filter pages correctly and
// active products can't repeat a name.

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "true";
const testId = randomUUID();
const tag = testId.slice(0, 8);

let admin: AuthUser;
let gramId: string;
let kiloId: string;
const ingredientIds: string[] = [];
const productIds: string[] = [];
let adminId: string;

before(async () => {
  if (!integrationEnabled) return;
  gramId = (await prisma.inventoryUnit.findFirstOrThrow({ where: { abbreviation: "gr" } })).id;
  kiloId = (await prisma.inventoryUnit.findFirstOrThrow({ where: { abbreviation: "kg" } })).id;

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { name: "ADMIN" },
    include: { permissions: { include: { permission: true } } },
  });
  const record = await prisma.user.create({
    data: { email: `norm-admin-${testId}@test.local`, name: "Norm Admin", passwordHash: "unused", roleId: adminRole.id },
  });
  adminId = record.id;
  admin = {
    id: record.id, name: record.name, email: record.email, roleId: adminRole.id, roleName: "ADMIN", isActive: true,
    permissions: adminRole.permissions.map(({ permission }) => permission.name),
  };
});

after(async () => {
  if (!integrationEnabled) return;
  await prisma.recipe.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  await prisma.inventoryMovement.deleteMany({ where: { ingredientId: { in: ingredientIds } } });
  await prisma.ingredient.deleteMany({ where: { id: { in: ingredientIds } } });
  await prisma.user.deleteMany({ where: { id: adminId } });
});

test("alta de insumo: SKU INS-### automático, sólo unidades base y máximo >= mínimo", { skip: !integrationEnabled }, async () => {
  const first = await InventoryService.createIngredient({ name: `Café ${tag}`, unitId: gramId, minimumStock: "100", maximumStock: "500" }, admin);
  ingredientIds.push(first.id);
  assert.match(first.sku ?? "", /^INS-\d{3,}$/);
  assert.equal(first.maximumStock?.toNumber(), 500);

  const second = await InventoryService.createIngredient({ name: `Leche ${tag}`, unitId: gramId }, admin);
  ingredientIds.push(second.id);
  assert.ok(Number(second.sku!.slice(4)) > Number(first.sku!.slice(4)), "SKUs keep increasing");

  await assert.rejects(
    InventoryService.createIngredient({ name: `Harina ${tag}`, unitId: kiloId }, admin),
    (error: Error) => error.name === "ValidationError" && /unidad base/.test(error.message),
  );
  await assert.rejects(
    InventoryService.createIngredient({ name: `Azúcar ${tag}`, unitId: gramId, minimumStock: "10", maximumStock: "5" }, admin),
    (error: Error) => error.name === "ValidationError" && /máximo/.test(error.message),
  );
  await assert.rejects(
    InventoryService.updateIngredient(first.id, { minimumStock: "600" }, admin),
    (error: Error) => error.name === "ValidationError" && /máximo/.test(error.message),
    "raising the minimum above the stored maximum is rejected too",
  );
  await assert.rejects(
    InventoryService.createIngredient({ name: `Otro ${tag}`, sku: first.sku!, unitId: gramId }, admin),
    (error: Error) => error.name === "ConflictError",
  );
});

test("un insumo usado en la receta de un producto activo no se puede desactivar", { skip: !integrationEnabled }, async () => {
  const ingredientId = ingredientIds[0];
  const product = await prisma.product.create({ data: { name: `Latte ${tag}`, sku: `NRM-${testId}`, price: 60 } });
  productIds.push(product.id);
  await prisma.recipe.create({ data: { productId: product.id, ingredientId, quantity: 18 } });

  await assert.rejects(
    InventoryService.setIngredientActive(ingredientId, false, admin),
    (error: Error) => error.name === "ConflictError" && error.message.includes(product.name),
  );

  // Once the product is inactive the ingredient can be deactivated.
  await prisma.product.update({ where: { id: product.id }, data: { isActive: false } });
  const deactivated = await InventoryService.setIngredientActive(ingredientId, false, admin);
  assert.equal(deactivated.isActive, false);
  await InventoryService.setIngredientActive(ingredientId, true, admin);
});

test("filtro de stock bajo: se aplica en la consulta, así las páginas vienen completas", { skip: !integrationEnabled }, async () => {
  // Three low-stock ingredients sorted first by name, with a normal one in between.
  for (const [suffix, stock] of [["a", 1], ["b", 50], ["c", 2], ["d", 3]] as const) {
    const ingredient = await prisma.ingredient.create({
      data: { name: `000-low-${tag}-${suffix}`, sku: `LOW-${tag}-${suffix}`, unitId: gramId, currentStock: stock, minimumStock: 10 },
    });
    ingredientIds.push(ingredient.id);
  }
  const page = await InventoryService.findAll({ page: 1, limit: 2, status: "low_stock", isActive: true, search: `000-low-${tag}` }, admin);
  assert.deepEqual(page.data.map((i) => i.name.slice(-1)), ["a", "c"]);
  assert.equal(page.pagination.total, 3);

  const normal = await InventoryService.findAll({ page: 1, limit: 10, status: "normal", isActive: true, search: `000-low-${tag}` }, admin);
  assert.deepEqual(normal.data.map((i) => i.name.slice(-1)), ["b"]);
});

test("productos activos: el nombre no se repite (sin importar mayúsculas)", { skip: !integrationEnabled }, async () => {
  const product = await ProductService.create({ name: `Bagel ${tag}`, price: 80, cost: 30, sku: `BAG-${testId}`, tracksInventory: false }, admin);
  productIds.push(product.id);

  await assert.rejects(
    ProductService.create({ name: `  bagel ${tag.toUpperCase()}`, price: 80, cost: 30, sku: `BAG2-${testId}`, tracksInventory: false }, admin),
    (error: Error) => error.name === "DuplicateError",
  );
  // The database index backs the service check.
  await assert.rejects(
    prisma.product.create({ data: { name: `BAGEL ${tag}`, sku: `BAG3-${testId}`, price: 80 } }),
    /Unique constraint|products_name_normalized_unique/,
  );
  // An inactive product doesn't hold the name.
  await prisma.product.update({ where: { id: product.id }, data: { isActive: false } });
  const reused = await ProductService.create({ name: `Bagel ${tag}`, price: 85, cost: 30, sku: `BAG4-${testId}`, tracksInventory: false }, admin);
  productIds.push(reused.id);
});
