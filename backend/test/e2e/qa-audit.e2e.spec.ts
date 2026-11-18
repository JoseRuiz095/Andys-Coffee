// Must be the first import: points prisma and the app at the local test database.
import "../setup/test-env";
import { expect, test, type Page } from "@playwright/test";
import { prisma } from "../../src/config/prisma";
import { closeLeftoverCashSessions, createSellableProduct, createUserFactory, frontendOrigin, login, startApp, stopApp } from "./support/app-harness";

// QA audit 2026-11-18 (QA-E2E-xx): POS cart arithmetic on screen vs. database, the orders board
// seen by two users at once, permission-driven actions, and dark theme rendering.

const users = createUserFactory("qa-audit");
let pan: Awaited<ReturnType<typeof createSellableProduct>>;
let cafe: { id: string; name: string };
let cashierEmail: string;
let adminEmail: string;

test.beforeAll(async () => {
  await closeLeftoverCashSessions();
  cashierEmail = (await users.create("cajero", ["sales.create", "sales.read", "cash.open", "cash.close", "cash.read", "products.read"])).email;
  adminEmail = (await users.create("admin", ["sales.create", "sales.read", "sales.cancel", "sales.approve_cancellation", "cash.open", "cash.close", "cash.read", "products.read", "users.read"])).email;
  pan = await createSellableProduct(users.testId, 45);
  cafe = await prisma.product.create({ data: { name: `Cafe QA ${users.testId}`, sku: `QA-CAFE-${users.testId}`, price: 30, categoryId: pan.category.id, tracksInventory: false } });
  await startApp();
});

test.afterEach(async () => {
  await closeLeftoverCashSessions();
});

test.afterAll(async () => {
  await users.cleanup();
  await prisma.product.deleteMany({ where: { id: cafe.id } });
  await pan?.cleanup();
  await stopApp();
});

async function openDrawer(page: Page) {
  await expect(page.getByText("Abre la caja para comenzar")).toBeVisible();
  await page.getByLabel("Fondo inicial").fill("200");
  await page.getByRole("button", { name: "Abrir caja" }).click();
  await expect(page.getByRole("button", { name: "Procesar orden" })).toBeVisible();
}

async function tap(page: Page, productName: string, times = 1) {
  await page.getByRole("button", { name: pan.category.name }).click();
  const card = page.getByRole("button", { name: new RegExp(`^${productName}`) });
  for (let i = 0; i < times; i += 1) await card.click();
}

async function sellCash(page: Page, received: string) {
  await page.getByRole("button", { name: "Procesar orden" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Monto recibido").fill(received);
  await dialog.getByRole("button", { name: "Confirmar pago" }).click();
  await expect(dialog).toHaveCount(0);
}

test("QA-E2E-01 carrito: agregar, ±, eliminar; el total en pantalla es el que se guarda", async ({ page }) => {
  await login(page, cashierEmail, users.password);
  await openDrawer(page);
  await tap(page, pan.product.name, 2);
  await tap(page, cafe.name, 1);
  await expect(page.getByText("$120.00").first()).toBeVisible(); // 2×45 + 30
  await page.getByLabel(`Quitar una unidad de ${pan.product.name}`).click();
  await expect(page.getByText("$75.00").first()).toBeVisible();
  await page.getByLabel(`Eliminar ${cafe.name} de la orden`).click();
  await expect(page.getByLabel(`Quitar una unidad de ${cafe.name}`)).toHaveCount(0);
  await page.getByLabel(`Agregar una unidad de ${pan.product.name}`).click();
  await expect(page.getByText("$90.00").first()).toBeVisible();

  await sellCash(page, "100");
  const session = await prisma.cashSession.findFirstOrThrow({ where: { openedBy: { email: cashierEmail }, status: "open" } });
  await expect.poll(() => prisma.order.count({ where: { cashSessionId: session.id } })).toBe(1);
  const order = await prisma.order.findFirstOrThrow({ where: { cashSessionId: session.id }, include: { items: true } });
  expect(Number(order.total)).toBe(90);
  expect(order.items.map((i) => [i.productId, Number(i.quantity)])).toEqual([[pan.product.id, 2]]);
  // The cart is emptied after charging.
  await expect(page.getByLabel(`Quitar una unidad de ${pan.product.name}`)).toHaveCount(0);
});

test("QA-E2E-02 tablero: el cambio de estado de un usuario lo ve otro; el cajero no ve Cancelar", async ({ browser }) => {
  const cashierCtx = await browser.newContext();
  const adminCtx = await browser.newContext();
  const cashier = await cashierCtx.newPage();
  const admin = await adminCtx.newPage();
  try {
    await login(cashier, cashierEmail, users.password);
    await openDrawer(cashier);
    await tap(cashier, cafe.name, 1);
    await sellCash(cashier, "50");
    const pending = { createdBy: { email: cashierEmail }, status: "pending" as const, cashSession: { status: "open" as const } };
    await expect.poll(() => prisma.order.count({ where: pending })).toBe(1);
    const order = await prisma.order.findFirstOrThrow({ where: pending });
    const n = order.orderNumber.toString();

    await cashier.goto(`${frontendOrigin}/dashboard?view=ordenes`);
    await login(admin, adminEmail, users.password);
    await admin.goto(`${frontendOrigin}/dashboard?view=ordenes`);

    await expect(cashier.getByRole("button", { name: `Marcar orden #${n} como Preparando` })).toBeVisible();
    await expect(cashier.getByRole("button", { name: `Cancelar orden #${n}` })).toHaveCount(0);
    await expect(admin.getByRole("button", { name: `Cancelar orden #${n}` })).toBeVisible();

    await cashier.getByRole("button", { name: `Marcar orden #${n} como Preparando` }).click();
    await expect.poll(async () => (await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("preparing");
    // The other user's board refreshes by itself (polling) without a reload.
    await expect(admin.getByRole("button", { name: `Marcar orden #${n} como Lista` })).toBeVisible({ timeout: 25_000 });
  } finally {
    await cashierCtx.close();
    await adminCtx.close();
  }
});

test("QA-E2E-03 tema oscuro: se aplica a toda la app, persiste al recargar y el POS no da errores", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await login(page, cashierEmail, users.password);
  await page.evaluate(() => localStorage.setItem("andy-theme", "light"));
  await page.reload();
  const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.evaluate(() => localStorage.setItem("andy-theme", "dark"));
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(darkBg).not.toBe(lightBg);
  await openDrawer(page);
  await tap(page, cafe.name, 1);
  await expect(page.getByText("$30.00").first()).toBeVisible();
  expect(errors).toEqual([]);
});
