// Shared bootstrap for the frontend E2E specs: starts the API on :4000 and Vite on :5173,
// creates throw-away users with exact permissions and cleans up what they created.
// Specs must import "../setup/test-env" BEFORE this module (it loads prisma).
import { expect, type Page } from "@playwright/test";
import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { prisma } from "../../../src/config/prisma";

// Ports can be moved (E2E_BACKEND_PORT / E2E_FRONTEND_PORT) to run the specs while the dev
// servers are up on 4000/5173; CI uses the defaults.
const backendPort = Number(process.env.E2E_BACKEND_PORT ?? 4000);
const frontendPort = Number(process.env.E2E_FRONTEND_PORT ?? 5173);
export const frontendOrigin = `http://127.0.0.1:${frontendPort}`;
export const backendOrigin = `http://127.0.0.1:${backendPort}`;
const frontendRoot = path.resolve(process.cwd(), "../frontend");

let backendServer: Server | undefined;
let viteServer: ChildProcess | undefined;

async function waitForHttp(url: string, child?: ChildProcess) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) throw new Error(`El proceso no pudo iniciar: ${url}`);
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

export async function startApp() {
  process.env.CORS_ORIGINS = frontendOrigin;
  process.env.NODE_ENV = "development";
  const { app } = await import("../../../src/app");
  backendServer = createServer(app);
  await new Promise<void>((resolve) => backendServer!.listen(backendPort, "127.0.0.1", resolve));
  viteServer = spawn(process.execPath, [path.resolve(frontendRoot, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", String(frontendPort)], {
    cwd: frontendRoot,
    // The dev proxy (/api) must reach this test backend.
    env: { ...process.env, BACKEND_PROXY_URL: backendOrigin },
    stdio: "ignore",
    windowsHide: true,
  });
  await Promise.all([waitForHttp(`${backendOrigin}/health`), waitForHttp(`${frontendOrigin}/login`, viteServer)]);
}

export async function stopApp() {
  if (viteServer && viteServer.exitCode === null) viteServer.kill();
  await new Promise<void>((resolve, reject) => (backendServer ? backendServer.close((error) => (error ? reject(error) : resolve())) : resolve()));
  await prisma.$disconnect();
}

/** Throw-away users with an exact permission set; `cleanup()` removes them and what they created. */
export function createUserFactory(prefix: string) {
  const testId = randomUUID().slice(0, 8);
  const password = `E2E-${testId}-Password!`;
  const userIds: string[] = [];
  const roleIds: string[] = [];

  return {
    testId,
    password,
    async create(label: string, permissionNames: string[]) {
      const permissions = await Promise.all(
        permissionNames.map((name) => prisma.permission.upsert({ where: { name }, update: {}, create: { name } })),
      );
      const role = await prisma.role.create({
        data: {
          name: `${prefix}-${label}-${testId}`,
          permissions: { create: permissions.map((permission) => ({ permissionId: permission.id })) },
        },
      });
      roleIds.push(role.id);
      const user = await prisma.user.create({
        data: {
          name: `${prefix} ${label} ${testId}`,
          email: `${prefix}-${label}-${testId}@example.com`,
          passwordHash: await bcrypt.hash(password, 4),
          roleId: role.id,
        },
      });
      userIds.push(user.id);
      return user;
    },
    async cleanup() {
      if (userIds.length === 0) return;
      const sessions = await prisma.cashSession.findMany({ where: { openedById: { in: userIds } }, select: { id: true } });
      const sessionIds = sessions.map((session) => session.id);
      const orders = await prisma.order.findMany({
        where: { OR: [{ createdById: { in: userIds } }, { cashSessionId: { in: sessionIds } }] },
        select: { id: true },
      });
      const orderIds = orders.map((order) => order.id);
      await prisma.orderCancellationRequest.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.inventoryMovement.deleteMany({ where: { OR: [{ createdById: { in: userIds } }, { orderItem: { orderId: { in: orderIds } } }] } });
      await prisma.expense.deleteMany({
        where: { OR: [{ createdById: { in: userIds } }, { sourceOrderId: { in: orderIds } }, { cashSessionId: { in: sessionIds } }] },
      });
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } }); // items, extras, payments cascade
      await prisma.cashMovement.deleteMany({ where: { OR: [{ cashSessionId: { in: sessionIds } }, { createdById: { in: userIds } }] } });
      await prisma.auditLog.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { cashSessionId: { in: sessionIds } }] } });
      await prisma.cashSession.deleteMany({ where: { id: { in: sessionIds } } });
      await prisma.purchase.deleteMany({ where: { createdById: { in: userIds } } }); // items cascade
      await prisma.inventoryCount.deleteMany({
        where: { OR: [{ createdById: { in: userIds } }, { completedById: { in: userIds } }] },
      }); // items cascade
      await prisma.notificationRecipient.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.role.deleteMany({ where: { id: { in: roleIds } } });
    },
  };
}

export async function login(page: Page, email: string, password: string) {
  await page.goto(`${frontendOrigin}/login`);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`^${frontendOrigin}/dashboard`));
}

/**
 * The active cash session is global: a leftover open session (from an aborted run) would hide
 * the opening panel. Only ever runs against the Docker test database (see test-env).
 */
export async function closeLeftoverCashSessions() {
  await prisma.cashSession.updateMany({ where: { status: "open" }, data: { status: "closed", closedAt: new Date() } });
}

/** A sellable product without recipe in its own category, so specs don't depend on the seed catalog. */
export async function createSellableProduct(testId: string, price: number) {
  const category = await prisma.category.create({ data: { name: `E2E POS ${testId}`, displayOrder: -1000 } });
  const product = await prisma.product.create({
    data: {
      name: `Pan E2E ${testId}`,
      sku: `E2E-POS-${testId}`,
      price,
      categoryId: category.id,
      tracksInventory: false,
    },
  });
  return {
    category,
    product,
    async cleanup() {
      await prisma.product.deleteMany({ where: { id: product.id } });
      await prisma.category.deleteMany({ where: { id: category.id } });
    },
  };
}

/** Ingredients (in grams) owned by a spec; `cleanup()` removes them with their movements. */
export function createIngredientFactory(testId: string) {
  const ids: string[] = [];
  return {
    async create(label: string, data: { currentStock?: number; minimumStock?: number; averageCost?: number } = {}) {
      const unit = await prisma.inventoryUnit.findFirstOrThrow({ where: { abbreviation: "gr" } });
      const ingredient = await prisma.ingredient.create({
        data: {
          name: `${label} E2E ${testId}`,
          sku: `E2E-${label.slice(0, 3).toUpperCase()}-${testId}`,
          unitId: unit.id,
          currentStock: data.currentStock ?? 0,
          minimumStock: data.minimumStock ?? 0,
          averageCost: data.averageCost ?? 0,
        },
      });
      ids.push(ingredient.id);
      return ingredient;
    },
    /** Track an ingredient created through the UI so it is removed too. */
    track(id: string) {
      ids.push(id);
    },
    async cleanup() {
      if (ids.length === 0) return;
      await prisma.inventoryMovement.deleteMany({ where: { ingredientId: { in: ids } } });
      await prisma.inventoryCountItem.deleteMany({ where: { ingredientId: { in: ids } } });
      await prisma.purchaseItem.deleteMany({ where: { ingredientId: { in: ids } } });
      await prisma.ingredient.deleteMany({ where: { id: { in: ids } } });
    },
  };
}
