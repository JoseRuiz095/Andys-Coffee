import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { prisma } from "../../src/config/prisma";
import type { AuthUser } from "../../src/services/auth.service";
import { ExtraService } from "../../src/services/extra.service";
import { MenuService } from "../../src/services/menu.service";
import { ProductFamilyService } from "../../src/services/product-family.service";
import { ProductService } from "../../src/services/product.service";
import { RecipeService } from "../../src/services/recipe.service";

// Plan F3 (decision D-5): a product is saved with its recipe per size, extras and options in
// one transaction; recipes are converted to the ingredient's base unit and require
// inventory.manage_recipes. Extras may subtract ingredients.

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "true";
const testId = randomUUID();
const tag = testId.slice(0, 8);

let admin: AuthUser;
let cashier: AuthUser;
let adminId: string;
let beverageId: string;
let foodId: string;
let coffeeId: string;
let milkId: string;
let cupId: string;
let kiloId: string;
let pieceId: string;
const productIds: string[] = [];
const extraIds: string[] = [];
const familyIds: string[] = [];
const ingredientIds: string[] = [];

const recipeOf = (lines: { ingredientId: string; quantity: number; unitId?: string }[]) => lines;

before(async () => {
  if (!integrationEnabled) return;
  const gram = await prisma.inventoryUnit.findFirstOrThrow({ where: { abbreviation: "gr" } });
  const milliliter = await prisma.inventoryUnit.findFirstOrThrow({ where: { abbreviation: "ml" } });
  pieceId = (await prisma.inventoryUnit.findFirstOrThrow({ where: { abbreviation: "pz" } })).id;
  kiloId = (await prisma.inventoryUnit.findFirstOrThrow({ where: { abbreviation: "kg" } })).id;

  coffeeId = (await prisma.ingredient.create({ data: { name: `Café ${tag}`, sku: `R-CAF-${tag}`, unitId: gram.id, averageCost: 0.5 } })).id;
  milkId = (await prisma.ingredient.create({ data: { name: `Leche ${tag}`, sku: `R-LEC-${tag}`, unitId: milliliter.id, averageCost: 0.02 } })).id;
  cupId = (await prisma.ingredient.create({ data: { name: `Vaso ${tag}`, sku: `R-VAS-${tag}`, unitId: pieceId, averageCost: 1.5 } })).id;
  ingredientIds.push(coffeeId, milkId, cupId);

  beverageId = (await prisma.category.create({ data: { name: `Bebidas ${tag}`, isBeverage: true } })).id;
  foodId = (await prisma.category.create({ data: { name: `Comida ${tag}` } })).id;

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { name: "ADMIN" },
    include: { permissions: { include: { permission: true } } },
  });
  const record = await prisma.user.create({
    data: { email: `recipe-admin-${testId}@test.local`, name: "Recipe Admin", passwordHash: "unused", roleId: adminRole.id },
  });
  adminId = record.id;
  admin = {
    id: record.id, name: record.name, email: record.email, roleId: adminRole.id, roleName: "ADMIN", isActive: true,
    permissions: adminRole.permissions.map(({ permission }) => permission.name),
  };
  cashier = { ...admin, permissions: (admin.permissions ?? []).filter((name) => name !== "inventory.manage_recipes") };
});

after(async () => {
  if (!integrationEnabled) return;
  await prisma.auditLog.deleteMany({ where: { userId: adminId } });
  await prisma.productExtra.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  await prisma.extra.deleteMany({ where: { id: { in: extraIds } } });
  await prisma.productFamily.deleteMany({ where: { id: { in: familyIds } } });
  await prisma.category.deleteMany({ where: { id: { in: [beverageId, foodId] } } });
  await prisma.ingredient.deleteMany({ where: { id: { in: ingredientIds } } });
  await prisma.user.deleteMany({ where: { id: adminId } });
});

test("C-17: un producto que controla inventario exige receta; 'No controla inventario' no", { skip: !integrationEnabled }, async () => {
  await assert.rejects(
    ProductService.create({ name: `Bagel ${tag}`, price: 80, cost: 30, categoryId: foodId }, admin),
    (error: Error) => error.name === "ValidationError" && /receta/.test(error.message),
  );
  assert.equal(await prisma.product.count({ where: { name: `Bagel ${tag}` } }), 0);

  const service = await ProductService.create({ name: `Servicio ${tag}`, price: 20, cost: 0, tracksInventory: false }, admin);
  productIds.push(service.id);
  assert.equal(service.tracksInventory, false);
});

test("C-18/C-20: receta por tamaño, convertida a la unidad base; Jumbo sólo en bebidas con precio Jumbo", { skip: !integrationEnabled }, async () => {
  const family = await ProductFamilyService.create({ name: `Latte ${tag}`, categoryId: beverageId });
  familyIds.push(family.id);
  const regular = recipeOf([
    { ingredientId: coffeeId, quantity: 18 },
    { ingredientId: milkId, quantity: 200 },
    { ingredientId: cupId, quantity: 1 },
  ]);

  // Jumbo price without the Jumbo recipe.
  await assert.rejects(
    ProductService.create({ name: `Latte Vainilla ${tag}`, price: 65, jumboPrice: 98, cost: 20, categoryId: beverageId, temperature: "BOTH", recipe: { REGULAR: regular } }, admin),
    (error: Error) => error.name === "ValidationError" && /Jumbo/.test(error.message),
  );
  // A capture unit of another dimension (pieces for an ingredient in grams).
  await assert.rejects(
    ProductService.create({ name: `Latte Vainilla ${tag}`, price: 65, cost: 20, categoryId: beverageId, recipe: { REGULAR: [{ ingredientId: coffeeId, quantity: 1, unitId: pieceId }] } }, admin),
    (error: Error) => error.name === "ValidationError" && /no se puede capturar/.test(error.message),
  );

  const latte = await ProductService.create({
    name: `Latte Vainilla ${tag}`, price: 65, jumboPrice: 98, cost: 20, categoryId: beverageId, temperature: "BOTH",
    familyId: family.id, variantLabel: "Vainilla",
    recipe: {
      REGULAR: regular,
      // 0.027 kg of coffee is stored as 27 g.
      JUMBO: [{ ingredientId: coffeeId, quantity: 0.027, unitId: kiloId }, { ingredientId: milkId, quantity: 300 }, { ingredientId: cupId, quantity: 1 }],
    },
  }, admin);
  productIds.push(latte.id);

  assert.deepEqual(latte.recipe.REGULAR.lines.map((line) => [line.ingredientName, line.quantity, line.unit]), [
    [`Café ${tag}`, 18, "gr"], [`Leche ${tag}`, 200, "ml"], [`Vaso ${tag}`, 1, "pz"],
  ]);
  assert.equal(latte.recipe.JUMBO.lines.find((line) => line.ingredientId === coffeeId)?.quantity, 27);
  // 18 × 0.5 + 200 × 0.02 + 1 × 1.5 = 14.5
  assert.equal(latte.recipe.REGULAR.cost, 14.5);
  assert.equal(latte.suggestedCost, 14.5);
  assert.equal(latte.family?.name, `Latte ${tag}`);

  const audit = await prisma.auditLog.findFirst({ where: { userId: adminId, action: "RECIPE_UPDATED" } });
  assert.ok(audit, "recipe changes are audited");

  // A non-beverage can't have a Jumbo recipe.
  await assert.rejects(
    ProductService.create({ name: `Bagel Jumbo ${tag}`, price: 80, cost: 30, categoryId: foodId, recipe: { REGULAR: regular, JUMBO: regular } }, admin),
    (error: Error) => error.name === "ValidationError" && /Jumbo/.test(error.message),
  );
});

test("C-19: si algo falla (un extra inexistente) no se guarda nada", { skip: !integrationEnabled }, async () => {
  await assert.rejects(
    ProductService.create({
      name: `Moka ${tag}`, price: 65, cost: 20, categoryId: beverageId,
      recipe: { REGULAR: [{ ingredientId: coffeeId, quantity: 18 }] }, extraIds: [randomUUID()],
    }, admin),
    (error: Error) => error.name === "ValidationError" && /extras/.test(error.message),
  );
  assert.equal(await prisma.product.count({ where: { name: `Moka ${tag}` } }), 0);
});

test("C-21: sin inventory.manage_recipes no se edita la receta, pero sí el resto del producto", { skip: !integrationEnabled }, async () => {
  const latteId = productIds[1];
  await assert.rejects(
    ProductService.update(latteId, { recipe: { REGULAR: [{ ingredientId: coffeeId, quantity: 20 }] } }, cashier),
    (error: Error) => error.name === "AuthorizationError",
  );
  const renamed = await ProductService.update(latteId, { price: 66 }, cashier);
  assert.equal(renamed.price, 66);
  assert.equal(renamed.recipe.REGULAR.lines.length, 3, "the recipe is untouched when not sent");
});

test("editar: reemplaza receta y extras; quitar el precio Jumbo obliga a quitar la receta Jumbo", { skip: !integrationEnabled }, async () => {
  const latteId = productIds[1];
  const shot = await ExtraService.create({
    name: `Shot ${tag}`, price: 15, cost: 5, recipe: [{ ingredientId: coffeeId, quantity: 9 }],
  }, admin);
  const noMilk = await ExtraService.create({
    name: `Sin leche ${tag}`, price: 0, cost: 0, recipe: [{ ingredientId: milkId, quantity: -200 }],
  }, admin);
  extraIds.push(shot.id, noMilk.id);
  assert.equal(noMilk.recipe.lines[0].quantity, -200, "an extra may subtract an ingredient");
  // (The API validator already rejects 0; the service refuses it too.)
  await assert.rejects(
    ExtraService.create({ name: `Vacío ${tag}`, price: 0, cost: 0, recipe: [{ ingredientId: milkId, quantity: 0 }] }, admin),
    (error: Error) => error.name === "ValidationError",
  );
  assert.equal(await prisma.extra.count({ where: { name: `Vacío ${tag}` } }), 0);

  await assert.rejects(
    ProductService.update(latteId, { jumboPrice: null }, admin),
    (error: Error) => error.name === "ValidationError" && /Jumbo/.test(error.message),
  );
  const updated = await ProductService.update(latteId, {
    jumboPrice: null,
    extraIds: [shot.id, noMilk.id],
    recipe: { REGULAR: [{ ingredientId: coffeeId, quantity: 20 }, { ingredientId: cupId, quantity: 1 }] },
  }, admin);
  assert.equal(updated.jumboPrice, null);
  assert.equal(updated.recipe.JUMBO.lines.length, 0);
  assert.deepEqual(updated.recipe.REGULAR.lines.map((line) => line.quantity), [20, 1]);
  assert.equal(updated.extras.length, 2);
});

test("productos sin receta, familias únicas y menú con familia/variante", { skip: !integrationEnabled }, async () => {
  const bare = await prisma.product.create({ data: { name: `Sin receta ${tag}`, sku: `SR-${testId}`, price: 30, categoryId: foodId } });
  productIds.push(bare.id);
  const missing = await RecipeService.findProductsMissingRecipe();
  assert.deepEqual(missing.find((product) => product.id === bare.id)?.missing, ["REGULAR"]);
  assert.equal(missing.some((product) => product.id === productIds[1]), false, "the latte has its recipe");
  assert.equal(missing.some((product) => product.id === productIds[0]), false, "products that don't track inventory don't count");

  await assert.rejects(ProductFamilyService.create({ name: ` latte ${tag.toUpperCase()} ` }), { name: "DuplicateError" });

  const latte = (await MenuService.getFullMenu()).flatMap((category) => category.items).find((item) => item.id === productIds[1]) as
    | { family?: { name: string } | null; variantLabel?: string | null }
    | undefined;
  assert.equal(latte?.family?.name, `Latte ${tag}`);
  assert.equal(latte?.variantLabel, "Vainilla");
});
