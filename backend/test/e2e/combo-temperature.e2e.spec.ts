// Must be the first import: points prisma and the app at the local test database.
import "../setup/test-env";
import { expect, test } from "@playwright/test";
import { prisma } from "../../src/config/prisma";
import { closeLeftoverCashSessions, createUserFactory, login, startApp, stopApp } from "./support/app-harness";

// Audit 2026-11-17 (A3): a combo whose drink is sold hot and cold asks the temperature, and the
// sale stores it on the drink's line (so it consumes the cold cup and ice, and the board shows it).

const users = createUserFactory("combo-temp");
let cashierEmail: string;
let categoryId: string;
let productId: string;
let comboId: string;
let comboName: string;

test.beforeAll(async () => {
  await closeLeftoverCashSessions();
  const cashier = await users.create("cajero", ["sales.create", "sales.read", "cash.open", "cash.close", "cash.read"]);
  cashierEmail = cashier.email;
  const tag = users.testId.slice(0, 8);
  categoryId = (await prisma.category.create({ data: { name: `E2E Combos ${tag}`, displayOrder: -1000, isBeverage: true } })).id;
  productId = (await prisma.product.create({
    data: { name: `Latte E2E ${tag}`, sku: `E2E-CT-${tag}`, price: 60, categoryId, temperature: "BOTH", tracksInventory: false },
  })).id;
  comboName = `Combo E2E ${tag}`;
  comboId = (await prisma.combo.create({
    data: { name: comboName, price: 90, categoryId, isActive: true, activeOnDays: [], items: { create: [{ productId, quantity: 1 }] } },
  })).id;
  await startApp();
});

test.afterAll(async () => {
  await closeLeftoverCashSessions();
  const items = await prisma.orderItem.findMany({ where: { productId }, select: { orderId: true } });
  const orderIds = [...new Set(items.map(({ orderId }) => orderId))];
  await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.combo.deleteMany({ where: { id: comboId } });
  await prisma.product.deleteMany({ where: { id: productId } });
  await users.cleanup();
  await prisma.category.deleteMany({ where: { id: categoryId } });
  await stopApp();
});

test("un combo con bebida fría/caliente pide la temperatura y la venta la guarda", async ({ page }) => {
  await login(page, cashierEmail, users.password);
  await expect(page.getByText("Abre la caja para comenzar")).toBeVisible();
  await page.getByLabel("Fondo inicial").fill("200");
  await page.getByRole("button", { name: "Abrir caja" }).click();

  await page.getByRole("button", { name: `E2E Combos ${users.testId.slice(0, 8)}` }).click();
  await page.getByRole("button", { name: new RegExp(`^${comboName}`) }).click();
  const dialog = page.getByRole("dialog");
  const add = dialog.getByRole("button", { name: "Agregar al pedido" });
  await expect(add).toBeDisabled();
  await dialog.getByRole("button", { name: "Frío" }).click();
  await add.click();
  await expect(page.getByText(/Latte E2E .* frío/)).toBeVisible();

  await page.getByRole("button", { name: "Procesar orden" }).click();
  const payment = page.getByRole("dialog");
  await payment.getByLabel("Monto recibido").fill("100");
  await payment.getByRole("button", { name: "Confirmar pago" }).click();
  await expect(payment).toHaveCount(0);

  await expect.poll(() => prisma.orderItem.count({ where: { productId } })).toBe(1);
  const line = await prisma.orderItem.findFirstOrThrow({ where: { productId } });
  expect(line.temperature).toBe("COLD");
  expect(line.sourceComboId).toBe(comboId);
});
