// Must be the first import: points prisma and the app at the local test database.
import "../setup/test-env";
import { expect, test, type Page } from "@playwright/test";
import { prisma } from "../../src/config/prisma";
import { createIngredientFactory, createUserFactory, frontendOrigin, login, startApp, stopApp } from "./support/app-harness";

// Regression net of the inventory module (QA-INV-*): stock view, purchase → receipt, manual exit,
// physical count, ingredient catalog and permission notices. Written before the UX simplification
// so every capability is proven to survive it; views are opened by URL (?view=inventario&inv=…),
// which the new navigation keeps compatible.

const users = createUserFactory("inv-e2e");
const ingredients = createIngredientFactory(users.testId);
let managerEmail: string;
let viewerEmail: string;
// Second manager for the newer cases: login is rate limited to 5 attempts per user and IP.
let manager2Email: string;

test.beforeAll(async () => {
  managerEmail = (
    await users.create("encargado", [
      "inventory.view",
      "inventory.create_entry",
      "inventory.create_exit",
      "inventory.physical_count",
      "inventory.adjust",
      "inventory.create_ingredient",
      "inventory.delete_ingredient",
      "inventory.manage_suppliers",
    ])
  ).email;
  viewerEmail = (await users.create("consulta", ["inventory.view"])).email;
  manager2Email = (
    await users.create("encargado2", ["inventory.view", "inventory.create_entry", "inventory.create_exit", "inventory.physical_count"])
  ).email;
  await startApp();
});

test.afterAll(async () => {
  await users.cleanup();
  await ingredients.cleanup();
  await stopApp();
});

async function openInventory(page: Page, view: string, extra = "") {
  await page.goto(`${frontendOrigin}/dashboard?view=inventario&inv=${view}${extra}`);
}

async function stockOf(id: string) {
  return Number((await prisma.ingredient.findUniqueOrThrow({ where: { id } })).currentStock);
}

/** Picks an ingredient in the search-as-you-type fields (purchase and physical count). */
async function pickIngredient(page: Page, placeholder: string | RegExp, name: string) {
  await page.getByPlaceholder(placeholder).fill(name.split(" ")[0]);
  await page.getByRole("button", { name: new RegExp(name) }).first().click();
}

test("existencias: totales, búsqueda y estado de un insumo agotado", async ({ page }) => {
  const empty = await ingredients.create("Canela", { currentStock: 0, minimumStock: 100 });
  await login(page, managerEmail, users.password);
  await openInventory(page, "current");

  await page.getByPlaceholder(/Café, CAF-001|Buscar por nombre o SKU/).fill(empty.name);
  const row = page.getByRole("row", { name: new RegExp(empty.name) });
  await expect(row).toBeVisible();
  await expect(row.getByText("Agotado")).toBeVisible();
  await expect(page.getByText("Agotados").first()).toBeVisible();
});

test("compra: se crea, se recibe y sube el stock", async ({ page }) => {
  const milk = await ingredients.create("Leche", { currentStock: 100 });
  await login(page, managerEmail, users.password);
  await openInventory(page, "add-entry");

  await pickIngredient(page, /Buscar por nombre\.\.\./, milk.name);
  await page.getByLabel("Cantidad", { exact: true }).fill("500");
  await page.getByLabel("Costo Total", { exact: true }).fill("250");
  await page.getByRole("button", { name: "Agregar item" }).click();
  await page.getByRole("button", { name: "Crear compra" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();

  await expect.poll(() => prisma.purchase.count({ where: { createdBy: { email: managerEmail }, status: "draft" } })).toBe(1);
  const purchase = await prisma.purchase.findFirstOrThrow({ where: { createdBy: { email: managerEmail }, status: "draft" } });

  await openInventory(page, "entries");
  await page.getByRole("button", { name: /\$250\.00/ }).first().click();
  await page.getByRole("button", { name: "Recibir compra" }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();

  await expect.poll(async () => (await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } })).status).toBe("received");
  await expect.poll(() => stockOf(milk.id)).toBe(600);
});

test("salida manual: descuenta el stock con confirmación", async ({ page }) => {
  const sugar = await ingredients.create("Azucar", { currentStock: 1000 });
  await login(page, managerEmail, users.password);
  await openInventory(page, "exits");

  await page.getByLabel("Buscar ingrediente").fill(sugar.name);
  await page.getByLabel("Ingrediente", { exact: true }).selectOption(sugar.id);
  await page.getByLabel("Cantidad", { exact: true }).fill("150");
  await page.getByRole("button", { name: "Registrar Salida" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();

  await expect.poll(() => stockOf(sugar.id)).toBe(850);
});

test("conteo físico: crear, contar, completar y aplicar ajustes", async ({ page }) => {
  const coffee = await ingredients.create("Cafe", { currentStock: 300 });
  await login(page, managerEmail, users.password);
  await openInventory(page, "physical");

  await page.getByRole("button", { name: "Crear nuevo conteo" }).click();
  await pickIngredient(page, "Buscar por nombre o SKU...", coffee.name);
  await page.getByLabel("Cantidad Contada").fill("280");
  await page.getByRole("button", { name: "Agregar item" }).click();
  await expect(page.getByRole("row", { name: new RegExp(coffee.name) })).toBeVisible();

  await page.getByRole("button", { name: "Completar conteo" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Completar conteo" }).click();
  await page.getByRole("button", { name: "Aplicar ajustes" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();

  await expect.poll(() => stockOf(coffee.id)).toBe(280);
});

test("catálogo de ingredientes: crear y desactivar con confirmación", async ({ page }) => {
  const name = `Vainilla E2E ${users.testId}`;
  await login(page, managerEmail, users.password);
  await openInventory(page, "management", "&gestion=ingredients");

  await page.getByRole("button", { name: /Crear Ingrediente/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nombre del ingrediente").fill(name);
  await dialog.locator("select").first().selectOption({ index: 1 });
  await dialog.getByRole("button", { name: /Crear|Guardar/ }).last().click();

  await expect.poll(() => prisma.ingredient.count({ where: { name } })).toBe(1);
  const created = await prisma.ingredient.findFirstOrThrow({ where: { name } });
  ingredients.track(created.id);

  await page.getByPlaceholder(/Buscar por nombre o SKU/).fill(name);
  const row = page.getByRole("row", { name: new RegExp(name) });
  await row.getByRole("button", { name: "Desactivar" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Desactivar" }).click();
  await expect.poll(async () => (await prisma.ingredient.findUniqueOrThrow({ where: { id: created.id } })).isActive).toBe(false);
});

test("sin permiso: se avisa y no se puede registrar", async ({ page }) => {
  await login(page, viewerEmail, users.password);
  await openInventory(page, "exits");
  await expect(page.getByText(/No tienes permiso para registrar salidas/)).toBeVisible();
  await openInventory(page, "add-entry");
  await expect(page.getByText(/No tienes permiso para registrar compras/)).toBeVisible();
});

// ── Simplified UI (auditoría UX de inventario, 13-nov-2026) ─────────────────────────────────

test("existencias: los indicadores filtran la tabla y los ajustes son de solo lectura sin permiso", async ({ page }) => {
  const low = await ingredients.create("Jarabe", { currentStock: 5, minimumStock: 50 });
  await login(page, manager2Email, users.password);
  await openInventory(page, "current");

  // "Bajo" filters the table; clicking it again shows everything.
  const lowTile = page.getByRole("button", { name: /^Bajo/ });
  await lowTile.click();
  await expect(lowTile).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Filtrar por estado del stock")).toHaveValue("low_stock");
  await page.getByPlaceholder("Buscar por nombre o SKU").fill(low.name);
  await expect(page.getByRole("row", { name: new RegExp(low.name) })).toBeVisible();
  await page.getByRole("button", { name: "Limpiar filtros" }).click();
  await expect(page.getByLabel("Filtrar por estado del stock")).toHaveValue("all");

  // Settings moved to a menu: without settings.manage the switches are read-only.
  await page.getByRole("button", { name: "Ajustes del inventario" }).click();
  const settings = page.getByRole("dialog", { name: "Ajustes del inventario" });
  await expect(settings.getByRole("switch", { name: "Avisar stock bajo" })).toBeDisabled();
  await expect(settings.getByText("Solo un administrador puede cambiar estos ajustes.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(settings).toHaveCount(0);
});

test("navegación: secciones agrupadas y enlaces antiguos compatibles", async ({ page }) => {
  await login(page, manager2Email, users.password);
  for (const [view, section, sub] of [
    ["add-entry", "Compras", "Nueva compra"],
    ["replenishment", "Compras", "Sugerencias"],
    ["physical", "Ajustes", "Conteos"],
    ["exits", "Ajustes", "Salidas"],
  ] as const) {
    await openInventory(page, view);
    await expect(page.getByRole("tab", { name: section, exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: sub, exact: true })).toHaveAttribute("aria-selected", "true");
  }
  await openInventory(page, "management", "&gestion=suppliers");
  await expect(page.getByRole("tab", { name: "Catálogo", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Proveedores" })).toHaveAttribute("aria-selected", "true");

  // Keyboard on the segmented control.
  await openInventory(page, "entries");
  await page.getByRole("tab", { name: "Por recibir", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/inv=add-entry/);
});

test("movimientos: el detalle expandible conserva costo unitario y usuario", async ({ page }) => {
  const tea = await ingredients.create("Te", { currentStock: 500 });
  await prisma.inventoryMovement.create({
    data: {
      ingredientId: tea.id,
      type: "adjustment",
      quantity: 10,
      unitCost: 2.5,
      balanceAfter: 510,
      createdById: (await prisma.user.findUniqueOrThrow({ where: { email: manager2Email } })).id,
    },
  });
  await login(page, manager2Email, users.password);
  await openInventory(page, "movements");
  await page.getByLabel("Buscar ingrediente").fill(tea.name);
  const detail = page.getByRole("button", { name: new RegExp(`Ver detalle del movimiento de ${tea.name}`) });
  await detail.click();
  await expect(page.getByText("$2.50")).toBeVisible();
  await expect(page.getByText(/Registrado por:/)).toBeVisible();
});
