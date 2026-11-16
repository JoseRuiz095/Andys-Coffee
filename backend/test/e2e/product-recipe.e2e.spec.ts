// Must be the first import: points prisma and the app at the local test database.
import "../setup/test-env";
import { expect, test } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { prisma } from "../../src/config/prisma";

// Plan F4 (decision D-5): from the product modal a beverage is created with its Regular and
// Jumbo recipe in one save; a quantity captured in kg is stored in grams, and saving without
// a recipe is refused before reaching the server.

const frontendRoot = path.resolve(process.cwd(), "../frontend");
// Same port override as support/app-harness.ts (to run next to the dev servers).
const backendPort = Number(process.env.E2E_BACKEND_PORT ?? 4000);
const frontendPort = Number(process.env.E2E_FRONTEND_PORT ?? 5173);
const frontendOrigin = `http://127.0.0.1:${frontendPort}`;
const backendOrigin = `http://127.0.0.1:${backendPort}`;
const tag = randomUUID().slice(0, 8);
const productName = `Latte E2E ${tag}`;
const productSku = `E2E-LAT-${tag}`;
const ingredientNames = { coffee: `CafeE2E ${tag}`, milk: `LecheE2E ${tag}`, cup: `VasoE2E ${tag}` };

let backendServer: Server;
let viteServer: ChildProcess;
const ingredientIds: string[] = [];

async function waitForHttp(url: string, process?: ChildProcess) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (process?.exitCode !== null && process?.exitCode !== undefined) throw new Error(`El proceso no pudo iniciar: ${url}`);
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) return;
    } catch {
      // Still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timeout esperando ${url}`);
}

test.beforeAll(async () => {
  const unit = (abbreviation: string) => prisma.inventoryUnit.findFirstOrThrow({ where: { abbreviation } });
  const [gram, milliliter, piece] = await Promise.all([unit("gr"), unit("ml"), unit("pz")]);
  for (const [name, unitId, averageCost] of [
    [ingredientNames.coffee, gram.id, 0.5],
    [ingredientNames.milk, milliliter.id, 0.02],
    [ingredientNames.cup, piece.id, 1.5],
  ] as const) {
    ingredientIds.push((await prisma.ingredient.create({ data: { name, sku: `E2E-${name}`, unitId, averageCost } })).id);
  }

  process.env.CORS_ORIGINS = frontendOrigin;
  process.env.NODE_ENV = "development";
  const { app } = await import("../../src/app");
  backendServer = createServer(app);
  await new Promise<void>((resolve) => backendServer.listen(backendPort, "127.0.0.1", resolve));
  viteServer = spawn(process.execPath, [path.resolve(frontendRoot, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", String(frontendPort)], {
    env: { ...process.env, BACKEND_PROXY_URL: backendOrigin },
    cwd: frontendRoot,
    stdio: "ignore",
    windowsHide: true,
  });
  await Promise.all([waitForHttp(`${backendOrigin}/health`), waitForHttp(`${frontendOrigin}/login`, viteServer)]);
});

test.afterAll(async () => {
  const product = await prisma.product.findFirst({ where: { sku: productSku }, select: { id: true } });
  if (product) {
    await prisma.recipe.deleteMany({ where: { productId: product.id } });
    await prisma.product.delete({ where: { id: product.id } });
  }
  await prisma.ingredient.deleteMany({ where: { id: { in: ingredientIds } } });
  if (viteServer && viteServer.exitCode === null) viteServer.kill();
  await new Promise<void>((resolve, reject) => backendServer?.close((error) => (error ? reject(error) : resolve())));
});

test("se crea una bebida con receta Regular y Jumbo desde el modal de producto", async ({ page }) => {
  await page.goto(`${frontendOrigin}/login`);
  await page.locator('input[name="email"]').fill("admin@andyscoffee.local");
  await page.locator('input[name="password"]').fill(process.env.ADMIN_SEED_PASSWORD!);
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page).toHaveURL(`${frontendOrigin}/dashboard`);

  await page.getByRole("button", { name: "Inventario", exact: true }).first().click();
  await page.getByRole("tab", { name: "Catálogo" }).click();
  await page.getByRole("tab", { name: "Productos", exact: true }).click();
  await page.getByRole("button", { name: "+ Nuevo producto" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("Nombre del producto").fill(productName);
  await dialog.getByPlaceholder("SKU único").fill(productSku);
  const bebidas = await prisma.category.findFirstOrThrow({ where: { name: "Bebidas" }, select: { id: true } });
  await dialog.locator("select").first().selectOption(bebidas.id);
  await dialog.getByRole("button", { name: "Ambas" }).click();
  await dialog.getByPlaceholder("0.00").nth(0).fill("65");
  await dialog.getByPlaceholder("0.00").nth(1).fill("20");
  await dialog.getByPlaceholder("Sin tamaño Jumbo").fill("98");

  // Without a recipe the form refuses to save (decision D-5).
  await dialog.getByRole("button", { name: "Crear", exact: true }).click();
  await expect(page.getByText(/Captura la receta/).first()).toBeVisible();

  const addIngredient = async (name: string, quantity: string) => {
    await dialog.getByLabel("Buscar ingrediente").fill(name.slice(0, 8));
    await dialog.getByRole("button", { name: new RegExp(name) }).click();
    await dialog.getByLabel(`Cantidad de ${name}`).fill(quantity);
  };
  await addIngredient(ingredientNames.coffee, "0.018");
  await dialog.getByLabel(`Unidad de ${ingredientNames.coffee}`).selectOption({ label: "kg" });
  await addIngredient(ingredientNames.milk, "200");
  await addIngredient(ingredientNames.cup, "1");

  // Jumbo: copy the regular recipe ×1.5.
  await dialog.getByRole("tab", { name: /Jumbo/ }).click();
  await dialog.getByRole("button", { name: "Copiar", exact: true }).click();
  await expect(dialog.getByRole("tab", { name: "Jumbo (3)" })).toBeVisible();
  // Cups don't scale with the size.
  await dialog.getByLabel(`Cantidad de ${ingredientNames.cup}`).fill("1");

  await dialog.getByRole("button", { name: "Crear", exact: true }).click();
  // Saved (the toast animates, so the database and the closed modal are what is checked).
  await expect.poll(() => prisma.product.count({ where: { sku: productSku } }), { timeout: 10_000 }).toBe(1);
  await expect(dialog).toHaveCount(0);

  const product = await prisma.product.findFirstOrThrow({
    where: { sku: productSku },
    include: { recipes: { include: { ingredient: { select: { name: true } } } } },
  });
  const quantities = Object.fromEntries(
    product.recipes.map((recipe) => [`${recipe.size}:${recipe.ingredient.name}`, recipe.quantity.toNumber()]),
  );
  expect(quantities).toEqual({
    [`REGULAR:${ingredientNames.coffee}`]: 18, // 0.018 kg stored as grams
    [`REGULAR:${ingredientNames.milk}`]: 200,
    [`REGULAR:${ingredientNames.cup}`]: 1,
    [`JUMBO:${ingredientNames.coffee}`]: 27,
    [`JUMBO:${ingredientNames.milk}`]: 300,
    [`JUMBO:${ingredientNames.cup}`]: 1,
  });
  expect(product.tracksInventory).toBe(true);
});
