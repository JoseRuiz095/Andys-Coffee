// Must be the first import: points prisma and the app at the local test database.
import "../setup/test-env";
import { expect, test } from "@playwright/test";
import { createUserFactory, frontendOrigin, login, startApp, stopApp } from "./support/app-harness";

// QA-AUT-01/03, QA-PER-02/03, QA-NAV-01/02, QA-ERR-01: session notices, permission-aware
// landing views and deep links, tab state in the URL, and error states that never look empty.

const users = createUserFactory("shell-e2e");
let readerEmail: string;
let adminEmail: string;

test.beforeAll(async () => {
  // Can read orders and inventory, but can't sell nor open Administración.
  readerEmail = (await users.create("lector", ["sales.read", "inventory.view"])).email;
  adminEmail = (await users.create("admin", ["sales.read", "dashboard.read"])).email;
  await startApp();
});

test.afterAll(async () => {
  await users.cleanup();
  await stopApp();
});

test("una contraseña incorrecta muestra el error del formulario, no 'Sesión expirada'", async ({ page }) => {
  await page.goto(`${frontendOrigin}/login`);
  await page.locator('input[name="email"]').fill(readerEmail);
  await page.locator('input[name="password"]').fill("ContraseñaIncorrecta123");
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: /incorrect|inválid|credenciales/i })).toBeVisible();
  await expect(page.getByText("Sesión expirada")).toHaveCount(0);
});

test("la vista inicial y los enlaces respetan permisos; recargar y Atrás conservan la pestaña", async ({ page }) => {
  await login(page, readerEmail, users.password);
  // Without sales.create the POS is not the landing view.
  await expect(page.getByRole("button", { name: "Órdenes", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: "Venta", exact: true })).toHaveCount(0);

  // A link to a view the user can't open falls back to an allowed one.
  await page.goto(`${frontendOrigin}/dashboard?view=admin`);
  await expect(page.getByRole("button", { name: "Órdenes", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: "Administración", exact: true })).toHaveCount(0);

  // Tabs live in the URL: reload keeps them, Back walks them back.
  await page.getByRole("button", { name: "Inventario", exact: true }).click();
  await expect(page).toHaveURL(/view=inventario/);
  // Purchases group "Nueva compra · Por recibir · Sugerencias" under one section; it opens on its first view.
  await page.getByRole("tab", { name: "Compras", exact: true }).click();
  await expect(page).toHaveURL(/inv=add-entry/);
  await page.getByRole("tab", { name: "Por recibir", exact: true }).click();
  await expect(page).toHaveURL(/inv=entries/);
  await page.reload();
  await expect(page.getByRole("tab", { name: "Por recibir", exact: true })).toHaveAttribute("aria-selected", "true");

  await page.goBack();
  await expect(page.getByRole("tab", { name: "Nueva compra", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.goBack();
  await expect(page.getByRole("tab", { name: "Existencias", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.goBack();
  await expect(page.getByRole("button", { name: "Órdenes", exact: true })).toHaveAttribute("aria-current", "page");
});

test("un error de la API se muestra como error y no como lista vacía", async ({ page }) => {
  await page.route("**/api/orders/payments/pending", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Error interno de prueba." }) }),
  );
  await login(page, adminEmail, users.password);
  await page.goto(`${frontendOrigin}/dashboard?view=admin&admin=pending-payments`);
  await expect(page.getByText("No se pudieron cargar los pagos pendientes.")).toBeVisible();
  await expect(page.getByText("Error interno de prueba.")).toBeVisible();
  await expect(page.getByText("No hay pagos pendientes de cobro.")).toHaveCount(0);
});

test("al cerrar sesión el siguiente usuario entra a su propia vista", async ({ page }) => {
  await login(page, adminEmail, users.password);
  await page.goto(`${frontendOrigin}/dashboard?view=admin`);
  await expect(page.getByRole("tab", { name: "Resumen", exact: true })).toBeVisible();

  // The old ?tab=session link opens "Mi cuenta", where the logout now lives.
  await page.goto(`${frontendOrigin}/settings?tab=session`);
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(`${frontendOrigin}/login`);

  await login(page, readerEmail, users.password);
  await expect(page.getByRole("button", { name: "Administración", exact: true })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Resumen", exact: true })).toHaveCount(0);
  await expect(page.getByText("Sesión expirada")).toHaveCount(0);
});
