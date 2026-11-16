// Must be the first import: points prisma and the app at the local test database.
import "../setup/test-env";
import { expect, test, type Page } from "@playwright/test";
import { prisma } from "../../src/config/prisma";
import {
  closeLeftoverCashSessions,
  createSellableProduct,
  createUserFactory,
  login,
  startApp,
  stopApp,
} from "./support/app-harness";

// QA-CAJ-01/02/03, QA-VEN-01/03/04, QA-TAB-01: a cashier opens the drawer, sells in cash with
// change (double-clicking "Confirmar pago" charges once), survives a failed server quote, and
// closes with a counted shortage after correcting a typo. Also on a tablet viewport.

const users = createUserFactory("pos-e2e");
let catalog: Awaited<ReturnType<typeof createSellableProduct>>;
let cashierEmail: string;

test.beforeAll(async () => {
  await closeLeftoverCashSessions();
  const cashier = await users.create("cajero", ["sales.create", "sales.read", "cash.open", "cash.close", "cash.read"]);
  cashierEmail = cashier.email;
  catalog = await createSellableProduct(users.testId, 45);
  await startApp();
});

test.afterEach(async () => {
  await closeLeftoverCashSessions();
});

test.afterAll(async () => {
  await users.cleanup();
  await catalog?.cleanup();
  await stopApp();
});

async function openDrawer(page: Page, amount: string) {
  await expect(page.getByText("Abre la caja para comenzar")).toBeVisible();
  await page.getByLabel("Fondo inicial").fill(amount);
  await page.getByRole("button", { name: "Abrir caja" }).click();
  await expect(page.getByRole("button", { name: "Procesar orden" })).toBeVisible();
}

async function addProduct(page: Page, times: number) {
  await page.getByRole("button", { name: catalog.category.name }).click();
  // The menu card's name starts with the product name (the cart buttons start with an action).
  const productCard = page.getByRole("button", { name: new RegExp(`^${catalog.product.name}`) });
  for (let i = 0; i < times; i += 1) await productCard.click();
  await expect(page.getByLabel(`Quitar una unidad de ${catalog.product.name}`)).toBeVisible();
}

async function activeSession() {
  return prisma.cashSession.findFirstOrThrow({ where: { openedBy: { email: cashierEmail }, status: "open" } });
}

test("abre caja, vende en efectivo con cambio una sola vez y cierra con diferencia", async ({ page }) => {
  await login(page, cashierEmail, users.password);
  await openDrawer(page, "500");
  await addProduct(page, 2);

  await page.getByRole("button", { name: "Procesar orden" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("$90.00").first()).toBeVisible();
  await dialog.getByLabel("Monto recibido").fill("100");
  await expect(dialog.getByText("$10.00")).toBeVisible();
  await dialog.getByRole("button", { name: "Confirmar pago" }).dblclick();
  await expect(dialog).toHaveCount(0);

  const session = await activeSession();
  await expect.poll(() => prisma.order.count({ where: { cashSessionId: session.id } })).toBe(1);
  const order = await prisma.order.findFirstOrThrow({ where: { cashSessionId: session.id }, include: { payments: true } });
  expect(Number(order.total)).toBe(90);
  expect(order.payments.map((payment) => payment.method)).toEqual(["cash"]);
  await expect
    .poll(async () => Number((await prisma.cashSession.findUniqueOrThrow({ where: { id: session.id } })).expectedAmount))
    .toBe(590);

  // Closing: an empty count can't continue; a typo is fixed with "Regresar" (C-01).
  await page.getByRole("button", { name: "Cerrar caja" }).click();
  const closing = page.getByRole("dialog");
  await expect(closing.getByRole("button", { name: "Continuar" })).toBeDisabled();
  await closing.getByRole("spinbutton").fill("5800");
  await closing.getByRole("button", { name: "Continuar" }).click();
  await expect(closing.getByText("Resumen del corte")).toBeVisible();
  await closing.getByRole("button", { name: "Regresar" }).click();
  await expect(closing.getByRole("spinbutton")).toHaveValue("5800");
  await closing.getByRole("spinbutton").fill("580");
  await closing.getByRole("button", { name: "Continuar" }).click();
  await expect(closing.getByText("-$10.00")).toBeVisible();
  await closing.locator("select").selectOption({ index: 1 });
  await closing.getByRole("button", { name: "Confirmar cierre" }).click();

  await expect.poll(async () => (await prisma.cashSession.findUniqueOrThrow({ where: { id: session.id } })).status).toBe("closed");
  const closed = await prisma.cashSession.findUniqueOrThrow({ where: { id: session.id } });
  expect(Number(closed.closingAmount)).toBe(580);
  expect(Number(closed.difference)).toBe(-10);
  await expect(page.getByText("Abre la caja para comenzar")).toBeVisible();
});

test("si falla la cotización ofrece reintentar y nunca cobra sin el total del servidor", async ({ page }) => {
  let failQuotes = true;
  await page.route("**/api/orders/quote", (route) =>
    failQuotes
      ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Servicio no disponible." }) })
      : route.continue(),
  );

  await login(page, cashierEmail, users.password);
  await openDrawer(page, "100");
  await addProduct(page, 1);

  await page.getByRole("button", { name: "Procesar orden" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("alert")).toContainText("Servicio no disponible.");
  await dialog.getByLabel("Monto recibido").fill("50");
  await expect(dialog.getByRole("button", { name: "Confirmar pago" })).toBeDisabled();

  failQuotes = false;
  await dialog.getByRole("button", { name: "Reintentar" }).click();
  await expect(dialog.getByText("$45.00").first()).toBeVisible();
  await dialog.getByRole("button", { name: "Confirmar pago" }).click();
  await expect(dialog).toHaveCount(0);

  const session = await activeSession();
  await expect.poll(() => prisma.order.count({ where: { cashSessionId: session.id } })).toBe(1);
});

test("en tablet (768×1024) se vende sin scroll horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await login(page, cashierEmail, users.password);
  await openDrawer(page, "100");
  await addProduct(page, 1);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  // The order panel (with the process button) stays beside the menu.
  await expect(page.getByRole("button", { name: "Procesar orden" })).toBeInViewport();

  await page.getByRole("button", { name: "Procesar orden" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Monto recibido").fill("45");
  await dialog.getByRole("button", { name: "Confirmar pago" }).click();
  await expect(dialog).toHaveCount(0);
  await page.screenshot({ path: "test-results/pos-tablet.png", fullPage: true });
});
