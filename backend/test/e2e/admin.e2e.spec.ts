// Must be the first import: points prisma and the app at the local test database.
import "../setup/test-env";
import { expect, test } from "@playwright/test";
import { prisma } from "../../src/config/prisma";
import { closeLeftoverCashSessions, createUserFactory, frontendOrigin, login, startApp, stopApp } from "./support/app-harness";

// QA-ADM (UX audit of Administración, 2026-11-14): users, roles and permissions, business and
// finance settings, the regrouped navigation and cash-cut reopening. The UI only offers what the
// backend accepts. Separate users per group of cases: the login limiter allows 5 tries per email.

const users = createUserFactory("admin-e2e");
const { testId } = users;
const createdEmail = `admin-e2e-nuevo-${testId}@example.com`;
let managerEmail: string;
let readOnlyEmail: string;
let expensesReaderEmail: string;
let cashierEmail: string;
let staffRoleId: string;
let staffRole2Name: string;
const extraRoleIds: string[] = [];
let registerId: string | undefined;
let configEmail: string;
let delegateEmail: string;
let delegateRoleName: string;
let revokedEmail: string;
let revokedRoleId: string;
let emptyRoleName: string;
// Business and fixed-expense settings are global: saved before the run and restored after it.
type PreferenceRow = { key: string; value: string; type: string; label: string | null; description: string | null };
let savedPreferences: PreferenceRow[] = [];
const SETTINGS_PREFIXES = ["general.", "expenses.fixed."];

const MANAGER_PERMISSIONS = [
  "users.read", "users.create", "users.update", "users.delete",
  "dashboard.read", "sales.read", "cash.read", "expenses.read", "settings.manage",
];

test.beforeAll(async () => {
  managerEmail = (await users.create("encargado", MANAGER_PERMISSIONS)).email;
  readOnlyEmail = (await users.create("lector", ["users.read"])).email;
  expensesReaderEmail = (await users.create("gastos", ["dashboard.read", "expenses.read"])).email;
  cashierEmail = (await users.create("caja", ["dashboard.read", "cash.read", "cash.correct"])).email;

  const salesRead = await prisma.permission.findUniqueOrThrow({ where: { name: "sales.read" } });
  const staff = await prisma.role.create({
    data: { name: `admin-e2e-staff-${testId}`, permissions: { create: [{ permissionId: salesRead.id }] } },
  });
  const staff2 = await prisma.role.create({ data: { name: `admin-e2e-staff2-${testId}` } });
  const empty = await prisma.role.create({ data: { name: `admin-e2e-vacio-${testId}` } });
  emptyRoleName = empty.name;
  extraRoleIds.push(empty.id);

  configEmail = (await users.create("config", ["users.read", "users.create", "users.update", "dashboard.read", "settings.manage"])).email;
  const delegate = await users.create("delegado", ["users.read", "users.update", "users.delete", "dashboard.read"]);
  delegateEmail = delegate.email;
  delegateRoleName = `admin-e2e-delegado-${testId}`;
  const revoked = await users.create("revocado", ["users.read", "users.update"]);
  revokedEmail = revoked.email;
  revokedRoleId = revoked.roleId;

  savedPreferences = await prisma.systemPreference.findMany({
    where: { OR: SETTINGS_PREFIXES.map((prefix) => ({ key: { startsWith: prefix } })) },
    select: { key: true, value: true, type: true, label: true, description: true },
  });
  staffRoleId = staff.id;
  staffRole2Name = staff2.name;
  extraRoleIds.push(staff.id, staff2.id);
  await startApp();
});

test.afterAll(async () => {
  await prisma.systemPreference.deleteMany({ where: { OR: SETTINGS_PREFIXES.map((prefix) => ({ key: { startsWith: prefix } })) } });
  if (savedPreferences.length > 0) await prisma.systemPreference.createMany({ data: savedPreferences });
  await prisma.user.deleteMany({ where: { email: createdEmail } });
  await prisma.role.deleteMany({ where: { OR: [{ id: { in: extraRoleIds } }, { name: `admin-e2e-rol-${testId}` }] } });
  if (registerId) {
    const sessionIds = (await prisma.cashSession.findMany({ where: { cashRegisterId: registerId }, select: { id: true } })).map((s) => s.id);
    // The reopening notifies every cash user; its notification refers to the session.
    const notificationIds = (await prisma.notification.findMany({ where: { referenceId: { in: sessionIds } }, select: { id: true } })).map((n) => n.id);
    await prisma.notificationRecipient.deleteMany({ where: { notificationId: { in: notificationIds } } });
    await prisma.notification.deleteMany({ where: { id: { in: notificationIds } } });
    await prisma.auditLog.deleteMany({ where: { cashSessionId: { in: sessionIds } } });
    await prisma.cashMovement.deleteMany({ where: { cashSessionId: { in: sessionIds } } });
    await prisma.cashSession.deleteMany({ where: { id: { in: sessionIds } } });
    await prisma.cashRegister.deleteMany({ where: { id: registerId } });
  }
  await users.cleanup();
  await stopApp();
});

test("QA-ADM-03/04/06/10: crear un usuario (errores junto al campo), cambiarle el rol y desactivarlo", async ({ page }) => {
  await login(page, managerEmail, users.password);
  await page.goto(`${frontendOrigin}/settings?tab=users`);
  await page.getByRole("button", { name: "+ Nuevo usuario" }).click();

  const form = page.getByRole("dialog", { name: "Nuevo usuario" });
  await form.getByRole("button", { name: "Crear usuario" }).click();
  await expect(form.getByText("Ingresa el nombre completo.")).toBeVisible();
  await expect(form.getByText("Ingresa una contraseña.")).toBeVisible();

  await form.getByLabel("Nombre completo").fill(`Nuevo ${testId}`);
  await form.getByLabel("Correo").fill(createdEmail);
  await form.getByLabel(/^Rol/).selectOption(staffRoleId);
  // QA-ADM-04: the password is stored as typed (trailing space included).
  await form.getByLabel("Contraseña inicial").fill("Clave1234 ");
  await form.getByRole("button", { name: "Crear usuario" }).click();
  await expect(form).toHaveCount(0);

  const created = await prisma.user.findUniqueOrThrow({ where: { email: createdEmail } });
  expect(created.roleId).toBe(staffRoleId);

  // Filters: search + status.
  await page.getByLabel("Buscar").fill(testId);
  const row = page.getByRole("row", { name: new RegExp(`Nuevo ${testId}`) });
  await expect(row).toBeVisible();

  // QA-ADM-10: change the role from the row; the confirmation names both roles.
  await row.getByRole("button", { name: `Cambiar rol de Nuevo ${testId}` }).click();
  const drawer = page.getByRole("dialog", { name: `Nuevo ${testId}` });
  await drawer.getByLabel("Nuevo rol").selectOption({ label: staffRole2Name });
  await drawer.getByRole("button", { name: "Guardar cambios" }).click();
  const confirmRole = page.getByRole("dialog", { name: "Confirmar cambio de rol" });
  await expect(confirmRole.getByText(new RegExp(staffRole2Name))).toBeVisible();
  await confirmRole.getByRole("button", { name: "Cambiar rol" }).click();
  await expect.poll(async () => (await prisma.user.findUniqueOrThrow({ where: { email: createdEmail } })).roleId).not.toBe(staffRoleId);

  // QA-ADM-06: deactivate (with confirmation) from the detail.
  await drawer.getByRole("button", { name: "Desactivar" }).click();
  await page.getByRole("dialog", { name: "Desactivar usuario" }).getByRole("button", { name: "Desactivar" }).click();
  await expect.poll(async () => (await prisma.user.findUniqueOrThrow({ where: { email: createdEmail } })).isActive).toBe(false);
  await drawer.getByRole("button", { name: "← Usuarios" }).click();

  await page.getByLabel("Estado").selectOption("inactive");
  await expect(page.getByRole("row", { name: new RegExp(`Nuevo ${testId}`) }).getByText("Inactivo")).toBeVisible();

  // QA-ADM-07: your own account offers no role change nor deactivation.
  await page.getByRole("button", { name: "Limpiar filtros" }).click();
  await page.getByLabel("Buscar").fill("admin-e2e-encargado");
  const ownRow = page.getByRole("row", { name: /\(tú\)/ });
  await expect(ownRow.getByRole("button", { name: /Cambiar rol/ })).toHaveCount(0);
  await expect(ownRow.getByRole("button", { name: /Desactivar/ })).toHaveCount(0);
});

test("QA-ADM-11/12/13: crear un rol, otorgarle un permiso; los roles del sistema son de solo lectura", async ({ page }) => {
  await login(page, managerEmail, users.password);
  await page.goto(`${frontendOrigin}/settings?tab=roles`);
  await page.getByRole("button", { name: "+ Nuevo rol" }).click();
  const form = page.getByRole("dialog", { name: "Nuevo rol" });
  await form.getByLabel("Nombre").fill(`admin-e2e-rol-${testId}`);
  await form.getByRole("button", { name: "Crear rol" }).click();

  // A new role opens its permissions right away.
  const drawer = page.getByRole("dialog", { name: `Permisos del rol admin-e2e-rol-${testId}` });
  await expect(drawer).toBeVisible();
  // QA-ADM-13: a permission the manager doesn't hold can't be granted.
  await expect(drawer.getByRole("checkbox", { name: /Cancelar ventas/ })).toBeDisabled();
  await drawer.getByRole("checkbox", { name: /Consultar ventas/ }).check();
  await expect(drawer.getByText("+ Ventas → Consultar ventas")).toBeVisible();
  await drawer.getByRole("button", { name: "Guardar cambios" }).click();
  await page.getByRole("dialog", { name: /Modificar permisos del rol/ }).getByRole("button", { name: "Guardar cambios" }).click();
  await expect
    .poll(async () => {
      const role = await prisma.role.findUniqueOrThrow({ where: { name: `admin-e2e-rol-${testId}` }, include: { permissions: { include: { permission: true } } } });
      return role.permissions.map((p) => p.permission.name);
    })
    .toEqual(["sales.read"]);
  await drawer.getByRole("button", { name: "← Volver" }).click();

  // QA-ADM-12: CAJERO is a system role; without roles.manage_system_permissions it is read-only.
  await page.getByRole("button", { name: "Ver permisos del rol CAJERO" }).click();
  const system = page.getByRole("dialog", { name: "Permisos del rol CAJERO" });
  await expect(system.getByText(/Es un rol del sistema/)).toBeVisible();
  await expect(system.getByRole("checkbox").first()).toBeDisabled();
});

test("QA-ADM-19: si la distribución no carga se ve el error y no valores por defecto guardables", async ({ page }) => {
  await page.route("**/api/income-statement/settings/distribution", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Fallo de prueba." }) })
      : route.continue(),
  );
  await login(page, managerEmail, users.password);
  await page.goto(`${frontendOrigin}/settings?tab=finance`);
  await expect(page.getByText("No se pudo cargar la distribución.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Guardar distribución" })).toHaveCount(0);
  await expect(page.getByLabel("Ahorro (%)")).toHaveCount(0);
});

test("QA-ADM-01/02: Administración en 3 secciones; los enlaces viejos abren la vista equivalente", async ({ page }) => {
  await login(page, managerEmail, users.password);
  await page.goto(`${frontendOrigin}/dashboard?view=admin&admin=pending-deliveries`);
  await expect(page.getByRole("tab", { name: "Pendientes", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Mandaditos", exact: true })).toHaveAttribute("aria-selected", "true");

  // Keyboard on the section tabs.
  await page.getByRole("tab", { name: "Pendientes", exact: true }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("tab", { name: "Finanzas", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(/admin=income-statement/);

  // The old Configuración › Cortes de caja link goes to Administración › Finanzas.
  await page.goto(`${frontendOrigin}/settings?tab=cash-history`);
  await expect(page).toHaveURL(/view=admin&admin=cash-history/);
  await expect(page.getByRole("tab", { name: "Cortes de caja", exact: true })).toHaveAttribute("aria-selected", "true");

  // And the old "Preferencias del Sistema" opens "Datos del negocio".
  await page.goto(`${frontendOrigin}/settings?tab=system-preferences`);
  await expect(page).toHaveURL(/tab=business/);
  await expect(page.getByRole("heading", { name: "Datos del negocio" })).toBeVisible();

  // Screens in both themes, for the manual theme checklist (test-results/admin-*.png).
  for (const theme of ["light", "dark"] as const) {
    await page.evaluate((value) => localStorage.setItem("andy-theme", value), theme);
    await page.goto(`${frontendOrigin}/dashboard?view=admin`);
    await expect(page.getByRole("heading", { name: "Resumen del negocio" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `test-results/admin-resumen-${theme}.png`, fullPage: true });
    await page.goto(`${frontendOrigin}/settings?tab=users`);
    await expect(page.getByRole("heading", { name: "Usuarios" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `test-results/admin-usuarios-${theme}.png`, fullPage: true });
    await page.goto(`${frontendOrigin}/settings?tab=business`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `test-results/admin-negocio-${theme}.png`, fullPage: true });
  }
  // Tablet: the settings menu becomes a row above the content.
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(`${frontendOrigin}/settings?tab=roles`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "test-results/admin-roles-tablet-dark.png", fullPage: true });
  await page.evaluate(() => localStorage.removeItem("andy-theme"));
});

test("QA-ADM-18: con users.read sin settings.manage la configuración es de solo lectura", async ({ page }) => {
  await login(page, readOnlyEmail, users.password);
  await page.goto(`${frontendOrigin}/settings?tab=business`);
  await expect(page.getByText("No tienes permiso para cambiar los datos del negocio.", { exact: false })).toBeVisible();
  await expect(page.getByLabel(/Nombre del negocio/)).toBeDisabled();
  await expect(page.getByRole("button", { name: "Guardar cambios" })).toHaveCount(0);

  // Finance settings need Administración (dashboard.read) to be read at all.
  await page.getByRole("button", { name: "Finanzas", exact: true }).click();
  await expect(page.getByText(/requiere acceso a Administración/)).toBeVisible();

  // Roles: only "Ver permisos", no edit nor delete.
  await page.getByRole("button", { name: "Roles y permisos", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ver permisos del rol CAJERO" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Editar el rol/ })).toHaveCount(0);
});

test("QA-ADM-22: con solo expenses.read no se ofrece registrar, editar ni eliminar gastos", async ({ page }) => {
  await login(page, expensesReaderEmail, users.password);
  await page.goto(`${frontendOrigin}/dashboard?view=admin&admin=expenses`);
  await expect(page.getByRole("heading", { name: "Gastos" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Nuevo gasto" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Eliminar" })).toHaveCount(0);
});

test("QA-ADM-25b: el último corte se puede reabrir con motivo (queda auditado)", async ({ page }) => {
  await closeLeftoverCashSessions();
  const cashier = await prisma.user.findUniqueOrThrow({ where: { email: cashierEmail } });
  const register = await prisma.cashRegister.create({ data: { name: `admin-e2e-caja-${testId}` } });
  registerId = register.id;
  const session = await prisma.cashSession.create({
    data: {
      cashRegisterId: register.id,
      openedById: cashier.id,
      closedById: cashier.id,
      status: "closed",
      openingAmount: 200,
      expectedAmount: 450,
      closingAmount: 440,
      difference: -10,
      closedAt: new Date(),
      closingReason: "Faltante",
    },
  });

  await login(page, cashierEmail, users.password);
  await page.goto(`${frontendOrigin}/dashboard?view=admin&admin=cash-history`);
  const row = page.getByRole("row", { name: /\$440\.00/ });
  await row.getByRole("button", { name: "Reabrir la caja de este corte" }).click();
  const dialog = page.getByRole("dialog", { name: "Reabrir caja" });
  await dialog.getByRole("button", { name: "Reabrir caja" }).click();
  await expect(dialog.getByText("Escribe el motivo: queda en la auditoría.")).toBeVisible();
  await dialog.getByLabel("Motivo").fill("Faltó registrar una venta");
  await dialog.getByRole("button", { name: "Reabrir caja" }).click();

  await expect.poll(async () => (await prisma.cashSession.findUniqueOrThrow({ where: { id: session.id } })).status).toBe("open");
  const audit = await prisma.auditLog.findFirst({ where: { cashSessionId: session.id, action: "CASH_SESSION_REOPENED" } });
  expect(audit).not.toBeNull();
  // With a drawer open, no cut offers "Reabrir".
  await expect(page.getByRole("button", { name: "Reabrir la caja de este corte" })).toHaveCount(0);
  await closeLeftoverCashSessions();
});

test("QA-ADM-16: guardar los datos del negocio (Descartar, validación junto al campo y guardado)", async ({ page }) => {
  await login(page, configEmail, users.password);
  await page.goto(`${frontendOrigin}/settings?tab=business`);
  const save = page.getByRole("button", { name: "Guardar cambios" });
  await expect(save).toBeDisabled();

  const name = page.getByLabel(/Nombre del negocio/);
  const original = await name.inputValue();
  await name.fill("Otro nombre");
  await page.getByRole("button", { name: "Descartar" }).click();
  await expect(name).toHaveValue(original);

  // The close time before the open time is shown next to the field.
  await page.getByLabel(/^Cierre/).fill("06:00");
  await save.click();
  await expect(page.getByText("El cierre debe ser después de la apertura.")).toBeVisible();
  await page.getByLabel(/^Cierre/).fill("22:00");

  await name.fill(`Andy's E2E ${testId}`);
  await page.getByLabel(/Teléfono/).fill("(55) 1234-5678");
  await save.click();
  await expect
    .poll(async () => (await prisma.systemPreference.findUnique({ where: { key: "general.business_name" } }))?.value)
    .toBe(`Andy's E2E ${testId}`);
  expect((await prisma.systemPreference.findUnique({ where: { key: "general.phone" } }))?.value).toBe("(55) 1234-5678");
  // After saving, the form starts from what is stored: nothing left to save.
  await expect(save).toBeDisabled();
});

test("QA-ADM-21: gastos fijos — agregar, evitar duplicados, editar el monto y eliminar", async ({ page }) => {
  const label = `Agua E2E ${testId}`;
  await login(page, configEmail, users.password);
  await page.goto(`${frontendOrigin}/settings?tab=finance`);
  await expect(page.getByRole("heading", { name: "Gastos fijos diarios" })).toBeVisible();

  const newConcept = page.getByLabel("Nuevo concepto");
  await newConcept.fill(label);
  await page.getByRole("button", { name: "Agregar", exact: true }).click();
  await expect(page.getByText(label, { exact: true })).toBeVisible();

  // The same name again is rejected (it would reset the amount to 0).
  await newConcept.fill(label);
  await page.getByRole("button", { name: "Agregar", exact: true }).click();
  await expect(page.getByText(`Ya existe el concepto "${label}". Edítalo para cambiar su monto.`)).toBeVisible();
  await newConcept.fill("");

  await page.getByRole("button", { name: `Editar ${label}` }).click();
  await page.getByLabel("Monto diario").fill("45");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("$45.00 por día")).toBeVisible();
  const conceptRow = async () => prisma.systemPreference.findFirst({ where: { key: { startsWith: "expenses.fixed." }, label } });
  await expect.poll(async () => (await conceptRow())?.value).toBe("45");

  await page.getByRole("button", { name: `Eliminar ${label}` }).click();
  await page.getByRole("dialog", { name: "Eliminar concepto" }).getByRole("button", { name: "Eliminar" }).click();
  await expect(page.getByText(label, { exact: true })).toHaveCount(0);
  await expect.poll(conceptRow).toBeNull();
});

test("QA-ADM-15: quien edita los permisos de su propio rol ve el cambio sin recargar", async ({ page }) => {
  await login(page, delegateEmail, users.password);
  await page.goto(`${frontendOrigin}/settings?tab=roles`);
  const deleteEmptyRole = page.getByRole("button", { name: `Eliminar el rol ${emptyRoleName}` });
  await expect(deleteEmptyRole).toBeVisible();

  await page.getByRole("button", { name: `Editar permisos del rol ${delegateRoleName}` }).click();
  const drawer = page.getByRole("dialog", { name: `Permisos del rol ${delegateRoleName}` });
  await drawer.getByRole("checkbox", { name: /Eliminar usuarios y roles/ }).uncheck();
  await drawer.getByRole("button", { name: "Guardar cambios" }).click();
  await page.getByRole("dialog", { name: /Modificar permisos del rol/ }).getByRole("button", { name: "Guardar cambios" }).click();
  await expect(drawer.getByText("Cambios pendientes")).toHaveCount(0);
  await drawer.getByRole("button", { name: "← Volver" }).click();

  // The session was re-read at once: deleting roles is no longer offered.
  await expect(deleteEmptyRole).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ver permisos del rol CAJERO" })).toBeVisible();
});

test("QA-ADM-28: si a la sesión le quitan un permiso, el 403 retira la acción de la interfaz", async ({ page }) => {
  await login(page, revokedEmail, users.password);
  await page.goto(`${frontendOrigin}/settings?tab=users`);
  await page.getByLabel("Buscar").fill("admin-e2e-lector");
  const row = page.getByRole("row", { name: /admin-e2e lector/ });
  await expect(row.getByRole("button", { name: /^Desactivar/ })).toBeVisible();

  // An administrator removes users.update from this user's role while their page is open.
  await prisma.rolePermission.deleteMany({ where: { roleId: revokedRoleId, permission: { name: "users.update" } } });

  await row.getByRole("button", { name: /^Desactivar/ }).click();
  const confirm = page.getByRole("dialog", { name: "Desactivar usuario" });
  await confirm.getByRole("button", { name: "Desactivar" }).click();
  await expect(page.getByText("No se pudo desactivar el usuario")).toBeVisible();
  await confirm.getByRole("button", { name: "Cancelar" }).click();

  await expect(row.getByRole("button", { name: /^Desactivar/ })).toHaveCount(0);
  await expect(row.getByRole("button", { name: /^Cambiar rol/ })).toHaveCount(0);
  const lector = await prisma.user.findUniqueOrThrow({ where: { email: readOnlyEmail } });
  expect(lector.isActive).toBe(true);
});

test("QA-ADM-30: el modal atrapa el foco y al cerrarlo vuelve al botón que lo abrió", async ({ page }) => {
  await login(page, configEmail, users.password);
  await page.goto(`${frontendOrigin}/settings?tab=users`);
  const opener = page.getByRole("button", { name: "+ Nuevo usuario" });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Nuevo usuario" });
  await expect(dialog.getByLabel("Nombre completo")).toBeFocused();

  // Shift+Tab from the first field wraps to the last control of the dialog, never the page.
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Crear usuario" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByLabel("Nombre completo")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});
