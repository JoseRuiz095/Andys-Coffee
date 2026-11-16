// Must be the first import: points prisma and the app at the local test database.
import "../setup/test-env";
import { readdirSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { prisma } from "../../src/config/prisma";
import { closeLeftoverCashSessions, createUserFactory, frontendOrigin, login, startApp, stopApp } from "./support/app-harness";

// QA-TAB-02: layout of the sales screen (POS) on the tablets it is used on and on laptops.
// Viewports are the real browser viewport (screen minus the browser bars), not the screen.
// With a 6-line order: no horizontal scroll, the total and "Procesar orden" fully visible,
// enough products visible without scrolling, and touch-sized controls on touch screens.
// Screenshots land in test-results/pos-layout/<POS_SHOTS or "current">/.

interface Viewport {
  name: string;
  width: number;
  height: number;
  touch: boolean;
  /**
   * Menu cards fully visible without scrolling (columns × complete rows), with a 6-line order and
   * 6 categories, with the larger cards the owner asked for (16-nov-2026). Before the redesign:
   * 4–5 on every tablet and laptop, 8 on the desktop.
   */
  minCards: number;
}

const viewports: Viewport[] = [
  { name: "ipad-9-vertical", width: 810, height: 1006, touch: true, minCards: 6 },
  { name: "ipad-mini-vertical", width: 768, height: 954, touch: true, minCards: 6 },
  { name: "ipad-air-vertical", width: 820, height: 1106, touch: true, minCards: 6 },
  { name: "android-vertical", width: 800, height: 1150, touch: true, minCards: 6 },
  { name: "ipad-mini-horizontal", width: 1024, height: 698, touch: true, minCards: 6 },
  { name: "ipad-9-horizontal", width: 1080, height: 736, touch: true, minCards: 6 },
  { name: "ipad-air-horizontal", width: 1180, height: 746, touch: true, minCards: 8 },
  { name: "android-horizontal", width: 1280, height: 670, touch: true, minCards: 8 },
  { name: "laptop-1366", width: 1366, height: 657, touch: false, minCards: 10 },
  { name: "desktop-1920", width: 1920, height: 969, touch: false, minCards: 18 },
];

const shotsDir = `test-results/pos-layout/${process.env.POS_SHOTS ?? "current"}`;
// One login for every viewport: the login limiter allows 5 attempts per user every 15 minutes.
const authState = `test-results/pos-layout/.auth-${process.pid}.json`;
let isLoggedIn = false;
// The real menu photos (square cut-outs, transparent or white background): products point at
// them with an `e2e-menu/` key and the browser gets them from disk instead of Supabase Storage.
const menuImagesDir = path.resolve("assets/menu-images");
const menuImages = readdirSync(menuImagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((dir) => readdirSync(path.join(menuImagesDir, dir.name)).map((file) => `${dir.name}/${file}`));
const imageKey = (i: number) => `e2e-menu/${menuImages[i % menuImages.length]}`;
const users = createUserFactory("pos-layout");
const productPrefix = `Producto E2E ${users.testId}`;
let cashierEmail: string;
let categoryName: string;
let familyName: string;
const createdIds: { category?: string; family?: string } = {};

test.beforeAll(async () => {
  await closeLeftoverCashSessions();
  const cashier = await users.create("cajero", ["sales.create", "sales.read", "cash.open", "cash.close", "cash.read"]);
  cashierEmail = cashier.email;
  // Similar length to the real categories ("Desayunos").
  categoryName = `Prueba ${users.testId.slice(0, 4)}`;
  const category = await prisma.category.create({ data: { name: categoryName, displayOrder: -2000 } });
  createdIds.category = category.id;
  // 24 single products (names of different lengths) and one family with 7 flavors.
  await prisma.product.createMany({
    data: Array.from({ length: 24 }, (_, i) => ({
      name: `${productPrefix} ${String(i + 1).padStart(2, "0")}${i % 3 === 0 ? " con nombre largo de prueba" : ""}`,
      sku: `E2E-LAY-${users.testId}-${i}`,
      price: 30 + i * 5,
      categoryId: category.id,
      imageUrl: imageKey(i),
      tracksInventory: false,
    })),
  });
  familyName = `Familia E2E ${users.testId}`;
  const family = await prisma.productFamily.create({ data: { name: familyName, categoryId: category.id } });
  createdIds.family = family.id;
  await prisma.product.createMany({
    data: Array.from({ length: 7 }, (_, i) => ({
      name: `${familyName} Sabor ${i + 1}`,
      sku: `E2E-LAY-FAM-${users.testId}-${i}`,
      price: 50 + i * 5,
      categoryId: category.id,
      familyId: family.id,
      variantLabel: `Sabor ${i + 1}`,
      temperature: "BOTH" as const,
      imageUrl: imageKey(i + 3),
      tracksInventory: false,
    })),
  });
  await startApp();
});

test.afterAll(async () => {
  await rm(authState, { force: true });
  await closeLeftoverCashSessions();
  await users.cleanup();
  await prisma.product.deleteMany({ where: { categoryId: createdIds.category } });
  await prisma.productFamily.deleteMany({ where: { id: createdIds.family } });
  await prisma.category.deleteMany({ where: { id: createdIds.category } });
  await stopApp();
});

async function openPos(browser: Browser, viewport: Viewport, theme: "light" | "dark") {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    hasTouch: viewport.touch,
    ...(isLoggedIn && { storageState: authState }),
  });
  await context.addInitScript((mode) => window.localStorage.setItem("andy-theme", mode), theme);
  await context.route("**/storage/v1/object/public/**", (route) => {
    const relative = decodeURIComponent(new URL(route.request().url()).pathname).split("/e2e-menu/")[1];
    return relative ? route.fulfill({ path: path.join(menuImagesDir, relative) }) : route.fulfill({ status: 404 });
  });
  const page = await context.newPage();
  if (isLoggedIn) {
    await page.goto(`${frontendOrigin}/dashboard`);
  } else {
    await login(page, cashierEmail, users.password);
    await context.storageState({ path: authState });
    isLoggedIn = true;
  }
  // From the POS on (the login page itself probes the session with an expected 401).
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  const processButton = page.getByRole("button", { name: "Procesar orden" });
  const openingAmount = page.getByLabel("Fondo inicial");
  // Wait for the cash session to load: either the POS (drawer already open) or the opening panel.
  await expect(processButton.or(openingAmount)).toBeVisible();
  if (await openingAmount.isVisible()) {
    await openingAmount.fill("500");
    await page.getByRole("button", { name: "Abrir caja" }).click();
  }
  await expect(processButton).toBeVisible();
  await page.getByRole("button", { name: categoryName, exact: true }).click();
  return { context, page, consoleErrors };
}

/** Lets the visible photos finish loading (they load lazily) before a screenshot. */
async function imagesLoaded(page: Page) {
  await page.waitForFunction(() => Array.from(document.images).every((image) => image.loading === "lazy" && !image.getBoundingClientRect().height ? true : image.complete));
}

/** Waits for the dialog's opening animation (scale and opacity) before measuring or capturing it. */
async function settledDialog(page: Page) {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveCSS("opacity", "1");
  return dialog;
}

/** Menu cards (products and the family) entirely visible: inside the window and the area that scrolls them. */
async function fullyVisibleCards(page: Page) {
  return page.getByRole("button", { name: new RegExp(`^(${productPrefix}|${familyName})`) }).evaluateAll((cards) =>
    cards.filter((card) => {
      const rect = card.getBoundingClientRect();
      let top = 0;
      let bottom = window.innerHeight;
      for (let node = card.parentElement; node; node = node.parentElement) {
        const overflowY = getComputedStyle(node).overflowY;
        const clips = overflowY === "auto" || overflowY === "scroll" || overflowY === "hidden";
        if (clips && node.scrollHeight > node.clientHeight + 1) {
          const box = node.getBoundingClientRect();
          top = Math.max(top, box.top);
          bottom = Math.min(bottom, box.bottom);
        }
      }
      return rect.top >= top - 1 && rect.bottom <= bottom + 1 && rect.left >= 0 && rect.right <= window.innerWidth + 1;
    }).length,
  );
}

for (const viewport of viewports) {
  test(`POS en ${viewport.name} (${viewport.width}×${viewport.height})`, async ({ browser }) => {
    test.setTimeout(120_000);
    const { context, page, consoleErrors } = await openPos(browser, viewport, "light");

    // Before the order: what the cashier sees when starting a sale.
    await imagesLoaded(page);
    await page.screenshot({ path: `${shotsDir}/${viewport.name}-vacia-claro.png` });

    for (let i = 1; i <= 6; i += 1) {
      await page.getByRole("button", { name: new RegExp(`^${productPrefix} ${String(i).padStart(2, "0")}`) }).click();
    }
    await expect(page.getByLabel(new RegExp(`^Quitar una unidad de ${productPrefix} 06`))).toBeVisible();
    // Back to the top of the page and of the menu (clicking scrolled them).
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      document.querySelectorAll("*").forEach((node) => {
        if (node.scrollTop) node.scrollTop = 0;
      });
    });
    await imagesLoaded(page);
    await page.screenshot({ path: `${shotsDir}/${viewport.name}-6-lineas-claro.png` });

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect.soft(overflow, "sin scroll horizontal").toBeLessThanOrEqual(0);
    await expect.soft(page.getByRole("button", { name: "Procesar orden" }), "Procesar orden completo a la vista").toBeInViewport({ ratio: 1, timeout: 1_000 });
    await expect.soft(page.getByTestId("pos-total"), "total a la vista").toBeInViewport({ ratio: 1, timeout: 1_000 });
    expect.soft(await fullyVisibleCards(page), "productos visibles sin desplazarse").toBeGreaterThanOrEqual(viewport.minCards);

    if (viewport.touch) {
      for (const label of [`Quitar una unidad de ${productPrefix} 06`, `Agregar una unidad de ${productPrefix} 06`]) {
        const box = await page.getByLabel(new RegExp(`^${label}`)).boundingBox();
        expect.soft(Math.min(box?.width ?? 0, box?.height ?? 0), `${label}: objetivo táctil ≥ 40px`).toBeGreaterThanOrEqual(40);
      }
      const processBox = await page.getByRole("button", { name: "Procesar orden" }).boundingBox();
      expect.soft(processBox?.height ?? 0, "Procesar orden ≥ 44px").toBeGreaterThanOrEqual(44);
    }

    // Family dialog: every flavor visible without horizontal scrolling.
    await page.getByRole("button", { name: new RegExp(`^${familyName}`) }).click();
    const familyDialog = await settledDialog(page);
    await imagesLoaded(page);
    await page.screenshot({ path: `${shotsDir}/${viewport.name}-familia-claro.png` });
    for (let i = 1; i <= 7; i += 1) {
      await expect.soft(familyDialog.getByRole("button", { name: new RegExp(`Sabor ${i}\\b`) }), `sabor ${i} visible`).toBeInViewport({ ratio: 1, timeout: 1_000 });
    }
    await familyDialog.getByRole("button", { name: "Cancelar" }).click();

    // Cash dialog.
    await page.getByRole("button", { name: "Procesar orden" }).click();
    const cashDialog = await settledDialog(page);
    await expect(cashDialog.getByLabel("Monto recibido")).toBeVisible();
    await imagesLoaded(page);
    await page.screenshot({ path: `${shotsDir}/${viewport.name}-cobro-claro.png` });
    await expect.soft(cashDialog.getByRole("button", { name: "Confirmar pago" }), "Confirmar pago a la vista").toBeInViewport({ ratio: 1, timeout: 1_000 });
    await cashDialog.getByRole("button", { name: "Cancelar" }).click();

    // Same order in the dark theme (the order survives the reload).
    await page.evaluate(() => window.localStorage.setItem("andy-theme", "dark"));
    await context.addInitScript(() => window.localStorage.setItem("andy-theme", "dark"));
    await page.reload();
    await expect(page.getByRole("button", { name: "Procesar orden" })).toBeVisible();
    await page.getByRole("button", { name: categoryName, exact: true }).click();
    await imagesLoaded(page);
    await page.screenshot({ path: `${shotsDir}/${viewport.name}-6-lineas-oscuro.png` });

    expect.soft(consoleErrors, "sin errores de consola").toEqual([]);
    await context.close();
  });
}
