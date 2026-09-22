// Must be the first import: points prisma and the app at the local test database.
import "../setup/test-env";
import { expect, request as playwrightRequest, test, type Page } from "@playwright/test";
import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { prisma } from "../../src/config/prisma";

// Playwright runs from backend/ (npm scripts); __dirname is unavailable in this ESM package.
const backendRoot = process.cwd();
const frontendRoot = path.resolve(backendRoot, "../frontend");
const frontendOrigin = "http://127.0.0.1:5173";
const unauthorizedOrigin = "http://127.0.0.1:5174";
const e2eEmail = `sec003-${randomUUID()}@example.com`;
const e2ePassword = `E2E-${randomUUID()}-Password!`;
const e2eRoleName = `sec003-role-${randomUUID()}`;
const productSku = `E2E-${randomUUID()}`;
let e2eRoleId: string;

let backendServer: Server;
let viteServer: ChildProcess;
let unauthorizedViteServer: ChildProcess;
let backendUrl: string;

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

function startVite(port: number) {
  const vitePath = path.resolve(frontendRoot, "node_modules/vite/bin/vite.js");
  return spawn(process.execPath, [vitePath, "--host", "127.0.0.1", "--port", String(port)], {
    cwd: frontendRoot,
    stdio: "ignore",
    windowsHide: true,
  });
}

async function startProductionApi() {
  const source = `const { app } = require('./src/app'); const server = app.listen(0, '127.0.0.1', () => console.log('E2E_PORT=' + server.address().port));`;
  const child = spawn(globalThis.process.execPath, ["-r", "tsx/cjs", "-e", source], {
    cwd: backendRoot,
    env: {
      ...globalThis.process.env,
      NODE_ENV: "production",
      CORS_ORIGINS: frontendOrigin,
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  const port = await new Promise<number>((resolve, reject) => {
    let output = "";
    const onData = (chunk: Buffer) => {
      output += chunk.toString();
      const match = output.match(/E2E_PORT=(\d+)/);
      if (match) resolve(Number(match[1]));
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      if (child.exitCode !== null) reject(new Error(output));
    });
    child.on("exit", (code: number | null) => {
      if (code !== null && code !== 0) reject(new Error(output));
    });
  });

  return { process: child, url: `http://127.0.0.1:${port}` };
}

async function loginThroughFrontend(page: Page) {
  await page.goto(`${frontendOrigin}/login`);
  await page.locator('input[name="email"]').fill(e2eEmail);
  await page.locator('input[name="password"]').fill(e2ePassword);
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page).toHaveURL(`${frontendOrigin}/dashboard`);
}

async function csrfToken(page: Page) {
  return page.evaluate(async (url) => {
    const response = await fetch(`${url}/api/auth/csrf`, { credentials: "include" });
    const body = await response.json() as { token: string };
    return body.token;
  }, backendUrl);
}

async function productMutation(
  page: Page,
  method: string,
  url: string,
  body?: object,
  token?: string,
) {
  return page.evaluate(
    async ({ method, url, body, token }) => {
      const headers = new Headers({
        "Content-Type": "application/json",
      });

      if (token) {
        headers.set("X-CSRF-TOKEN", token);
      }

      const response = await fetch(url, {
        method,
        credentials: "include",
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      return {
        status: response.status,
        body: await response.text(),
      };
    },
    { method, url, body, token },
  );
}

function stopProcess(process?: ChildProcess) {
  if (process && process.exitCode === null) process.kill();
}

test.beforeAll(async () => {
  process.env.CORS_ORIGINS = `${frontendOrigin}`;
  process.env.NODE_ENV = "development";

  // Matches the real permissions seeded in prisma/seed.ts and checked by
  // product.routes.ts / ProductService (see products.integration.test.ts for the
  // same fix and why "manage:products" was wrong).
  const permissionNames = ["products.read", "products.create", "products.update", "products.delete"];
  const permissions = await Promise.all(
    permissionNames.map((name) =>
      prisma.permission.upsert({ where: { name }, update: {}, create: { name } })
    ),
  );
  const role = await prisma.role.create({
    data: {
      name: e2eRoleName,
      permissions: { create: permissions.map((permission) => ({ permissionId: permission.id })) },
    },
  });
  e2eRoleId = role.id;
  await prisma.user.create({
    data: {
      name: "SEC-003 E2E User",
      email: e2eEmail,
      passwordHash: await bcrypt.hash(e2ePassword, 4),
      roleId: role.id,
    },
  });

  const { app } = await import("../../src/app");
  backendServer = createServer(app);
  await new Promise<void>((resolve) => backendServer.listen(4000, "127.0.0.1", resolve));
  backendUrl = `http://127.0.0.1:${(backendServer.address() as AddressInfo).port}`;

  viteServer = startVite(5173);
  unauthorizedViteServer = startVite(5174);
  await Promise.all([
    waitForHttp(`${backendUrl}/health`),
    waitForHttp(`${frontendOrigin}/login`, viteServer),
    waitForHttp(`${unauthorizedOrigin}/login`, unauthorizedViteServer),
  ]);
});

test.afterAll(async () => {
  await prisma.product.deleteMany({ where: { sku: productSku } });
  await prisma.user.deleteMany({ where: { email: e2eEmail } });
  if (e2eRoleId) await prisma.role.delete({ where: { id: e2eRoleId } });
  stopProcess(viteServer);
  stopProcess(unauthorizedViteServer);
  await new Promise<void>((resolve, reject) => backendServer?.close((error) => error ? reject(error) : resolve()));
  await prisma.$disconnect();
});

test("SEC-003 protege CORS, cookies, CSRF, GET y mutaciones reales", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginThroughFrontend(page);

  const cookies = await context.cookies();
  const authCookie = cookies.find(({ name }) => name === "token");
  const csrfCookie = cookies.find(({ name }) => name === "csrfToken");
  expect(authCookie).toMatchObject({ httpOnly: true, secure: false, sameSite: "Lax" });
  expect(csrfCookie).toMatchObject({ httpOnly: true, secure: false, sameSite: "Strict" });

  const getResponse = await page.evaluate(async (url) => {
    const response = await fetch(`${url}/api/products`, { credentials: "include" });
    return response.status;
  }, backendUrl);
  expect(getResponse).toBe(200);

  expect((await productMutation(page, "POST", `${backendUrl}/api/products`, { name: "CSRF missing", price: 10, cost: 2, sku: productSku })).status).toBe(403);
  expect((await productMutation(page, "POST", `${backendUrl}/api/products`, { name: "CSRF invalid", price: 10, cost: 2, sku: productSku }, "invalid-token")).status).toBe(403);

  const token = await csrfToken(page);
  const createResponse = await productMutation(page, "POST", `${backendUrl}/api/products`, { name: "E2E Product", price: 25, cost: 8, sku: productSku }, token);
  expect(createResponse.status, createResponse.body).toBe(201);
  const created = JSON.parse(createResponse.body) as { id: string };

  const updateResponse = await productMutation(page, "PATCH", `${backendUrl}/api/products/${created.id}`, { name: "E2E Product Updated" }, await csrfToken(page));
  expect(updateResponse.status).toBe(200);
  expect((JSON.parse(updateResponse.body) as { name: string }).name).toBe("E2E Product Updated");

  const deleteResponse = await productMutation(page, "DELETE", `${backendUrl}/api/products/${created.id}`, undefined, await csrfToken(page));
  expect(deleteResponse.status).toBe(204);
  expect(await prisma.product.findUnique({ where: { id: created.id } })).toBeNull();

  await context.close();

  const unauthorizedContext = await browser.newContext();
  const unauthorizedPage = await unauthorizedContext.newPage();
  await unauthorizedPage.goto(`${unauthorizedOrigin}/login`);
  const blocked = await unauthorizedPage.evaluate(async (url) => {
    try {
      const response = await fetch(`${url}/api/products`, { credentials: "include" });
      return { status: response.status, accessControlAllowOrigin: response.headers.get("access-control-allow-origin") };
    } catch (error) {
      return { error: error instanceof Error ? error.name : String(error) };
    }
  }, backendUrl);
  expect(blocked).toEqual({ error: "TypeError" });
  await unauthorizedContext.close();
});

test("SEC-003 no usa origin arbitrario y fija cookies de producción", async () => {
  const appSource = await readFile(path.resolve(backendRoot, "src/app.ts"), "utf8");
  expect(appSource).not.toMatch(/origin\s*:\s*true/);
  expect(appSource).not.toMatch(/origin\s*:\s*[^,\n]+credentials\s*:\s*true/);

  const production = await startProductionApi();
  try {
    const productionRequest = await playwrightRequest.newContext({
      baseURL: production.url,
      extraHTTPHeaders: { Origin: frontendOrigin },
    });
    const csrfResponse = await productionRequest.get("/api/auth/csrf");
    expect(csrfResponse.status()).toBe(200);
    const csrfToken = (await csrfResponse.json() as { token: string }).token;
    const csrfCookie = csrfResponse.headers()["set-cookie"];
    const csrfCookiePair = csrfCookie.match(/csrfToken=[^;]+/i)?.[0];
    expect(csrfCookiePair).toBeTruthy();
    expect(csrfCookie).toMatch(/HttpOnly/i);
    expect(csrfCookie).toMatch(/Secure/i);
    expect(csrfCookie).toMatch(/SameSite=Strict/i);

    const loginResponse = await productionRequest.post("/api/auth/login", {
      data: { email: e2eEmail, password: e2ePassword },
      headers: { "X-CSRF-TOKEN": csrfToken, Cookie: csrfCookiePair! },
    });
    expect(loginResponse.status()).toBe(200);
    const authCookie = loginResponse.headers()["set-cookie"];
    expect(authCookie).toMatch(/HttpOnly/i);
    expect(authCookie).toMatch(/Secure/i);
    expect(authCookie).toMatch(/SameSite=Lax/i);
    await productionRequest.dispose();
  } finally {
    stopProcess(production.process);
  }
});
