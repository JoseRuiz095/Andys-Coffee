// Must be the first import: points prisma and the app at the local test database.
import "../setup/test-env";
import { expect, test, type Page } from "@playwright/test";
import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { prisma } from "../../src/config/prisma";

// M-11: the cash-cut history and closing correction are reachable from Configuración,
// and the "Corregir" action only appears with cash.correct.

const backendRoot = process.cwd();
const frontendRoot = path.resolve(backendRoot, "../frontend");
const frontendOrigin = "http://127.0.0.1:5173";
const backendOrigin = "http://127.0.0.1:4000";
const testId = randomUUID();
const password = `CashE2E-${testId}-Password!`;
const correctorEmail = `cash-corrector-${testId}@example.com`;
const readerEmail = `cash-reader-${testId}@example.com`;

let backendServer: Server;
let viteServer: ChildProcess;
const roleIds: string[] = [];
let registerId: string;
let sessionId: string;

async function waitForHttp(url: string, process?: ChildProcess) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (process?.exitCode !== null && process?.exitCode !== undefined) {
      throw new Error(`El proceso no pudo iniciar: ${url}`);
    }
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

async function createUserWithPermissions(email: string, permissionNames: string[]) {
  const permissions = await Promise.all(
    permissionNames.map((name) => prisma.permission.upsert({ where: { name }, update: {}, create: { name } })),
  );
  const role = await prisma.role.create({
    data: {
      name: `cash-e2e-${email}`,
      permissions: { create: permissions.map((permission) => ({ permissionId: permission.id })) },
    },
  });
  roleIds.push(role.id);
  return prisma.user.create({
    data: { name: `Cash E2E ${email.split("-")[1]}`, email, passwordHash: await bcrypt.hash(password, 4), roleId: role.id },
  });
}

async function login(page: Page, email: string) {
  await page.goto(`${frontendOrigin}/login`);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page).toHaveURL(`${frontendOrigin}/dashboard`);
}

async function openCashHistory(page: Page) {
  await page.goto(`${frontendOrigin}/settings`);
  await page.getByRole("button", { name: "Cortes de caja", exact: true }).click();
  await expect(page.getByRole("cell", { name: "$300.00" }).first()).toBeVisible();
}

test.beforeAll(async () => {
  process.env.CORS_ORIGINS = frontendOrigin;
  process.env.NODE_ENV = "development";

  const corrector = await createUserWithPermissions(correctorEmail, ["cash.read", "cash.correct"]);
  await createUserWithPermissions(readerEmail, ["cash.read"]);

  // A closed cut: expected 300, counted 290 (difference -10).
  const register = await prisma.cashRegister.create({ data: { name: `cash-e2e-register-${testId}` } });
  registerId = register.id;
  const session = await prisma.cashSession.create({
    data: {
      cashRegisterId: registerId,
      openedById: corrector.id,
      closedById: corrector.id,
      status: "closed",
      openingAmount: 300,
      expectedAmount: 300,
      closingAmount: 290,
      difference: -10,
      closedAt: new Date(),
      closingReason: "Faltante",
    },
  });
  sessionId = session.id;

  // An uncounted end-of-day auto-close (R-08): the list must say so instead of "$0.00".
  // config/app is imported here, not at the top: it reads CORS_ORIGINS when first loaded.
  const { AUTO_CLOSE_REASON } = await import("../../src/config/app");
  await prisma.cashSession.create({
    data: {
      cashRegisterId: registerId,
      openedById: corrector.id,
      closedById: corrector.id,
      status: "closed",
      openingAmount: 150,
      expectedAmount: 150,
      closingAmount: 150,
      difference: 0,
      closedAt: new Date(Date.now() - 60_000),
      closingReason: AUTO_CLOSE_REASON,
    },
  });

  const { app } = await import("../../src/app");
  backendServer = createServer(app);
  await new Promise<void>((resolve) => backendServer.listen(4000, "127.0.0.1", resolve));

  viteServer = spawn(process.execPath, [path.resolve(frontendRoot, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "5173"], {
    cwd: frontendRoot,
    stdio: "ignore",
    windowsHide: true,
  });
  await Promise.all([waitForHttp(`${backendOrigin}/health`), waitForHttp(`${frontendOrigin}/login`, viteServer)]);
});

test.afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { cashSessionId: sessionId } });
  await prisma.cashSession.deleteMany({ where: { cashRegisterId: registerId } });
  await prisma.cashRegister.deleteMany({ where: { id: registerId } });
  await prisma.user.deleteMany({ where: { email: { in: [correctorEmail, readerEmail] } } });
  await prisma.role.deleteMany({ where: { id: { in: roleIds } } });
  if (viteServer && viteServer.exitCode === null) viteServer.kill();
  await new Promise<void>((resolve, reject) => backendServer?.close((error) => (error ? reject(error) : resolve())));
  await prisma.$disconnect();
});

test("M-11: con cash.correct se corrige un corte desde Configuración → Cortes de caja", async ({ page }) => {
  await login(page, correctorEmail);
  await openCashHistory(page);
  await page.screenshot({ path: "test-results/cash-history-light.png", fullPage: true });

  await page.getByRole("row", { name: /\$290\.00/ }).getByRole("button", { name: "Corregir" }).click();
  await page.getByLabel(/Nuevo monto de cierre/).fill("300");
  await page.locator("select").first().selectOption({ index: 1 });
  await page.getByRole("button", { name: "Guardar" }).click();

  await expect.poll(async () => (await prisma.cashSession.findUniqueOrThrow({ where: { id: sessionId } })).closingAmount?.toNumber())
    .toBe(300);
  const audit = await prisma.auditLog.findFirst({ where: { cashSessionId: sessionId, action: "CASH_SESSION_CLOSING_CORRECTED" } });
  expect(audit).not.toBeNull();

  // Same screen in dark mode, for the manual theme checklist.
  await page.evaluate(() => localStorage.setItem("andy-theme", "dark"));
  await page.reload();
  await page.getByRole("button", { name: "Cortes de caja", exact: true }).click();
  await expect(page.getByRole("cell", { name: "$300.00" }).first()).toBeVisible();
  await page.screenshot({ path: "test-results/cash-history-dark.png", fullPage: true });
});

test("M-11: solo con cash.read se ve el historial pero no el botón Corregir", async ({ page }) => {
  await login(page, readerEmail);
  await openCashHistory(page);
  await expect(page.getByRole("button", { name: "Corregir" })).toHaveCount(0);
  await expect(page.getByRole("cell", { name: "Sin conteo" })).toBeVisible();
});
