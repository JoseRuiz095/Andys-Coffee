// Must be the first import: points prisma and the app at the local test database.
import "../setup/test-env";
import { expect, test } from "@playwright/test";
import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { prisma } from "../../src/config/prisma";

// Playwright runs from backend/ (npm scripts); __dirname is unavailable in this ESM package.
const backendRoot = process.cwd();
const frontendRoot = path.resolve(backendRoot, "../frontend");
const frontendOrigin = "http://127.0.0.1:5173";
const backendOrigin = "http://127.0.0.1:4000";
const testEmail = `sec006-${randomUUID()}@example.com`;
const testPassword = `SEC006-${randomUUID()}-Password!`;
const testRoleName = `sec006-role-${randomUUID()}`;
let testRoleId: string;
let cashRegisterId: string;
let cashSessionId: string;
let backendServer: Server;
let viteServer: ChildProcess;

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
      // El servidor todavía está iniciando.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timeout esperando ${url}`);
}

function startVite() {
  const vitePath = path.resolve(frontendRoot, "node_modules/vite/bin/vite.js");
  return spawn(process.execPath, [vitePath, "--host", "127.0.0.1", "--port", "5173"], {
    cwd: frontendRoot,
    stdio: "ignore",
    windowsHide: true,
  });
}

function stopProcess(process?: ChildProcess) {
  if (process && process.exitCode === null) process.kill();
}

test.beforeAll(async () => {
  process.env.CORS_ORIGINS = frontendOrigin;
  process.env.NODE_ENV = "development";

  const role = await prisma.role.create({
    data: { name: testRoleName },
  });
  testRoleId = role.id;

  const user = await prisma.user.create({
    data: {
      name: "SEC-006 E2E User",
      email: testEmail,
      passwordHash: await bcrypt.hash(testPassword, 4),
      roleId: testRoleId,
    },
  });

  // R-08: an open cash drawer must survive the user logging out.
  const register = await prisma.cashRegister.create({ data: { name: `sec006-register-${randomUUID()}` } });
  cashRegisterId = register.id;
  const cashSession = await prisma.cashSession.create({
    data: { cashRegisterId, openedById: user.id, status: "open", openingAmount: 100, expectedAmount: 100 },
  });
  cashSessionId = cashSession.id;

  const { app } = await import("../../src/app");
  backendServer = createServer(app);
  await new Promise<void>((resolve) => backendServer.listen(4000, "127.0.0.1", resolve));

  viteServer = startVite();
  await Promise.all([
    waitForHttp(`${backendOrigin}/health`),
    waitForHttp(`${frontendOrigin}/login`, viteServer),
  ]);
});

test.afterAll(async () => {
  await prisma.cashSession.deleteMany({ where: { cashRegisterId } });
  await prisma.cashRegister.deleteMany({ where: { id: cashRegisterId } });
  await prisma.user.deleteMany({ where: { email: testEmail } });
  if (testRoleId) await prisma.role.delete({ where: { id: testRoleId } });
  stopProcess(viteServer);
  await new Promise<void>((resolve, reject) =>
    backendServer?.close((error) => (error ? reject(error) : resolve())),
  );
  await prisma.$disconnect();
});

test("SEC-006: sesión segura, refresh y logout", async ({ page, context }) => {
  await page.goto(`${frontendOrigin}/login`);

  await page.locator('input[name="email"]').fill(testEmail);
  await page.locator('input[name="password"]').fill(testPassword);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();

  await expect(page).toHaveURL(`${frontendOrigin}/dashboard`);

  const storage = await page.evaluate(() => ({
    token: localStorage.getItem("token"),
    accessToken: localStorage.getItem("accessToken"),
    jwt: localStorage.getItem("jwt"),
    session: localStorage.getItem("andys-auth-session"),
  }));

  expect(storage.token).toBeNull();
  expect(storage.accessToken).toBeNull();
  expect(storage.jwt).toBeNull();
  expect(storage.session).toBeNull();

  const cookies = await context.cookies();
  const sessionCookie = cookies.find((cookie) => cookie.name === "token");

  expect(sessionCookie).toBeDefined();
  expect(sessionCookie).toMatchObject({
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
  });

  const documentCookie = await page.evaluate(() => document.cookie);

  expect(documentCookie).not.toContain("token=");

  expect(
    (await page.request.get(`${backendOrigin}/api/auth/me`)).status(),
  ).toBe(200);

  await page.reload();
  await expect(page).toHaveURL(/dashboard/);

  await page.goto(`${frontendOrigin}/settings`);
  await expect(page).toHaveURL(`${frontendOrigin}/settings`);
  // The logout button lives in the "Sesión" tab of Configuración.
  await page.getByRole("button", { name: /^sesi[oó]n$/i }).click();
  await page.getByRole("button", { name: /cerrar sesi[oó]n|logout/i }).click();
  await expect(page).toHaveURL(/login/);

  expect(
    (await page.request.get(`${backendOrigin}/api/auth/me`)).status(),
  ).toBe(401);

  // R-08: logging out does not close (nor fake a count for) the open cash drawer.
  const drawer = await prisma.cashSession.findUniqueOrThrow({ where: { id: cashSessionId } });
  expect(drawer.status).toBe("open");
  expect(drawer.closingAmount).toBeNull();

  await page.reload();
  await expect(page).toHaveURL(/login/);
});
