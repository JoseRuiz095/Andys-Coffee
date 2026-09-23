// Must be the first import: points prisma and the app at the local test database.
import "../setup/test-env";
import { expect, test } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { prisma } from "../../src/config/prisma";

// Smoke test for the views loaded on demand (React.lazy): each one must render without
// hitting the error boundary or logging console errors. Uses the seeded admin.

const frontendRoot = path.resolve(process.cwd(), "../frontend");
const frontendOrigin = "http://127.0.0.1:5173";
const backendOrigin = "http://127.0.0.1:4000";

let backendServer: Server;
let viteServer: ChildProcess;

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
  process.env.CORS_ORIGINS = frontendOrigin;
  process.env.NODE_ENV = "development";
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
  await prisma.expense.deleteMany({ where: { description: { startsWith: "Gasto E2E " } } });
  if (viteServer && viteServer.exitCode === null) viteServer.kill();
  await new Promise<void>((resolve, reject) => backendServer?.close((error) => (error ? reject(error) : resolve())));
});

test("las vistas cargadas bajo demanda se muestran sin errores", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  // N-02: opening the app without a session must not show "Sesión expirada".
  await page.goto(`${frontendOrigin}/login`);
  await page.waitForLoadState("networkidle"); // the toast would appear after the preferences request
  await expect(page.getByText("Sesión expirada")).toHaveCount(0);

  await page.locator('input[name="email"]').fill("admin@andyscoffee.local");
  await page.locator('input[name="password"]').fill(process.env.ADMIN_SEED_PASSWORD!);
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page).toHaveURL(`${frontendOrigin}/dashboard`);

  for (const view of ["Ordenes", "Inventario", "Administracion"]) {
    await page.getByRole("button", { name: view, exact: true }).first().click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Reintentar")).toHaveCount(0);
  }

  await page.goto(`${frontendOrigin}/settings`);
  await expect(page.getByRole("button", { name: "Mi Perfil" })).toBeVisible();

  // N-03/N-04: expenses can be registered from Configuración → Gastos (the page was not
  // mounted anywhere and POST /api/expenses always answered 500).
  const description = `Gasto E2E ${Date.now()}`;
  await page.getByRole("button", { name: "Gastos", exact: true }).click();
  await page.getByRole("button", { name: "Nuevo gasto" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("select").first().selectOption("insumos");
  await dialog.getByPlaceholder("Describe el gasto").fill(description);
  await dialog.getByPlaceholder("0.00").fill("42.50");
  await dialog.getByRole("button", { name: "Crear" }).click();
  await expect(page.getByText(description)).toBeVisible();

  // 401/403 responses the app handles are logged by the browser as resource errors; ignore those.
  const unexpected = consoleErrors.filter((text) => !/Failed to load resource/.test(text));
  expect(unexpected).toEqual([]);
});
