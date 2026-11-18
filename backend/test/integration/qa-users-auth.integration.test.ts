import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { prisma } from "../../src/config/prisma";
import { QaHarness, integrationEnabled, type QaUser } from "./qa-http";

// QA audit 2026-11-18 — Administración de usuarios, contraseñas y sesiones.

const h = new QaHarness();
const skip = !integrationEnabled;
let admin: QaUser;
let cashier: QaUser;
let userAdmin: QaUser; // users.read/create/update/delete but not every ADMIN permission
let cajeroRoleId: string;
let adminRoleId: string;
const createdIds: string[] = [];

const HASH = /\$2[aby]\$\d{2}\$/;

async function createViaApi(body: Record<string, unknown>, auth: QaUser = admin) {
  const res = await h.req("POST", "/api/users", { auth, body });
  if (res.status === 201) createdIds.push(res.json.user.id);
  return res;
}

before(async () => {
  if (skip) return;
  await h.start();
  admin = await h.user("admin", "ADMIN");
  cashier = await h.user("cajero", "CAJERO");
  userAdmin = await h.user("useradmin", ["users.read", "users.create", "users.update", "users.delete", "sales.read", "sales.create", "products.read", "cash.open", "cash.close", "cash.read", "inventory.view"]);
  cajeroRoleId = (await prisma.role.findUniqueOrThrow({ where: { name: "CAJERO" } })).id;
  adminRoleId = (await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" } })).id;
});

after(async () => {
  if (skip) return;
  await prisma.user.deleteMany({ where: { id: { in: createdIds } } }).catch(() => undefined);
  await h.stop();
});

test("QA-USR-01 consultar usuarios: paginado y sin contraseñas ni hashes en ninguna respuesta", { skip }, async () => {
  const list = await h.req("GET", "/api/users?limit=100", { auth: admin });
  assert.equal(list.status, 200);
  assert.ok(list.json.data.length > 0);
  for (const path of ["/api/users?limit=100", `/api/users/${cashier.id}`, "/api/auth/me"]) {
    const res = await h.req("GET", path, { auth: admin });
    assert.ok(!/passwordHash|password"|tokenVersion/.test(res.text) && !HASH.test(res.text), `${path} expone credenciales`);
  }
  const search = await h.req("GET", `/api/users?search=${encodeURIComponent(h.tag("cajero"))}`, { auth: admin });
  assert.deepEqual(search.json.data.map((u: { id: string }) => u.id), [cashier.id]);
});

test("QA-USR-02 crear usuario: 201, bcrypt de 12 rondas en BD, respuesta sin hash, puede iniciar sesión", { skip }, async () => {
  const email = `${h.tag("nuevo")}@qa.local`;
  const res = await createViaApi({ name: "QA Nuevo", email, roleId: cajeroRoleId, password: "Segura123" });
  assert.equal(res.status, 201, res.text);
  assert.ok(!HASH.test(res.text) && !res.text.includes("passwordHash"));
  const row = await prisma.user.findUniqueOrThrow({ where: { email } });
  assert.match(row.passwordHash, /^\$2[aby]\$12\$/);
  assert.notEqual(row.passwordHash, "Segura123");
  const login = await h.login(email, "Segura123");
  assert.equal(login.status, 200);
  assert.ok(!HASH.test(login.body) && !login.body.includes("passwordHash"));
});

test("QA-USR-03 contraseñas que incumplen la política se rechazan (400)", { skip }, async () => {
  for (const password of ["", "Ab1", "sololetras", "12345678", "a".repeat(71) + "1x", undefined]) {
    const res = await createViaApi({ name: "QA Débil", email: `${h.tag(`debil-${String(password?.length)}`)}@qa.local`, roleId: cajeroRoleId, password });
    assert.equal(res.status, 400, `password=${JSON.stringify(password)?.slice(0, 20)} → ${res.status}`);
  }
});

test("QA-USR-04 datos incompletos o inválidos al crear: nombre vacío, email inválido, rol inexistente", { skip }, async () => {
  const base = { name: "QA X", email: `${h.tag("x")}@qa.local`, roleId: cajeroRoleId, password: "Segura123" };
  for (const [label, override] of [
    ["nombre vacío", { name: "" }],
    ["nombre en blanco", { name: "   " }],
    ["email inválido", { email: "no-es-email" }],
    ["roleId no uuid", { roleId: "abc" }],
    ["rol inexistente", { roleId: "00000000-0000-4000-8000-000000000000" }],
  ] as const) {
    const res = await createViaApi({ ...base, ...override });
    assert.equal(res.status, 400, `${label} → ${res.status} ${res.text}`);
  }
});

test("QA-USR-05 email duplicado (incluso con otras mayúsculas) → 409", { skip }, async () => {
  const res = await createViaApi({ name: "QA Dup", email: cashier.email.toUpperCase(), roleId: cajeroRoleId, password: "Segura123" });
  assert.equal(res.status, 409, res.text);
});

test("QA-USR-06 el login no distingue mayúsculas en el email (igual que el control de duplicados)", { skip }, async () => {
  const email = `${h.tag("Mayus")}@QA.local`;
  const res = await createViaApi({ name: "QA Mayus", email, roleId: cajeroRoleId, password: "Segura123" });
  assert.equal(res.status, 201);
  assert.equal((await h.login(email, "Segura123")).status, 200, "login con el email tal cual");
  const lower = await h.login(email.toLowerCase(), "Segura123");
  assert.equal(lower.status, 200, `login con el email en minúsculas → ${lower.status}`);
});

test("QA-USR-07 editar usuario: nombre y email persisten; nombre en blanco se rechaza", { skip }, async () => {
  const created = await createViaApi({ name: "QA Editar", email: `${h.tag("editar")}@qa.local`, roleId: cajeroRoleId, password: "Segura123" });
  const id = created.json.user.id;
  const newEmail = `${h.tag("editado")}@qa.local`;
  const ok = await h.req("PATCH", `/api/users/${id}`, { auth: admin, body: { name: "QA Editado", email: newEmail } });
  assert.equal(ok.status, 200, ok.text);
  const row = await prisma.user.findUniqueOrThrow({ where: { id } });
  assert.equal(row.name, "QA Editado");
  assert.equal(row.email, newEmail);
  const blank = await h.req("PATCH", `/api/users/${id}`, { auth: admin, body: { name: "   " } });
  const after = await prisma.user.findUniqueOrThrow({ where: { id } });
  assert.equal(blank.status, 400, `nombre "   " → ${blank.status}, guardado como ${JSON.stringify(after.name)}`);
});

test("QA-USR-08 asignación de masa: el body no puede fijar hash, isActive ni tokenVersion", { skip }, async () => {
  const created = await createViaApi({ name: "QA Masa", email: `${h.tag("masa")}@qa.local`, roleId: cajeroRoleId, password: "Segura123", isActive: false, passwordHash: "x", tokenVersion: 99 });
  assert.equal(created.status, 201);
  const row = await prisma.user.findUniqueOrThrow({ where: { id: created.json.user.id } });
  assert.equal(row.isActive, true);
  assert.notEqual(row.passwordHash, "x");
  assert.equal(row.tokenVersion, 0);
  const patch = await h.req("PATCH", `/api/users/${row.id}`, { auth: admin, body: { password: "Otra12345", passwordHash: "y", isActive: false } });
  assert.ok([200, 400].includes(patch.status));
  const again = await prisma.user.findUniqueOrThrow({ where: { id: row.id } });
  assert.equal(again.passwordHash, row.passwordHash, "PATCH /users no cambia la contraseña");
  assert.equal(again.isActive, true);
});

test("QA-USR-09 desactivar usuario corta su sesión activa y su login; reactivar lo devuelve", { skip }, async () => {
  const created = await createViaApi({ name: "QA Desactivar", email: `${h.tag("desact")}@qa.local`, roleId: cajeroRoleId, password: "Segura123" });
  const { id, email } = created.json.user;
  const session = (await h.login(email, "Segura123")).token!;
  assert.equal((await h.req("GET", "/api/auth/me", { auth: session })).status, 200);
  assert.equal((await h.req("PATCH", `/api/users/${id}/active`, { auth: admin, body: { isActive: false } })).status, 200);
  assert.equal((await h.req("GET", "/api/auth/me", { auth: session })).status, 401, "sesión activa cortada");
  assert.equal((await h.login(email, "Segura123")).status, 401);
  assert.equal((await h.req("PATCH", `/api/users/${id}/active`, { auth: admin, body: { isActive: true } })).status, 200);
  assert.equal((await h.login(email, "Segura123")).status, 200);
});

test("QA-USR-10 eliminar: sin historial se borra; con historial → 409; a sí mismo → 400", { skip }, async () => {
  const created = await createViaApi({ name: "QA Borrar", email: `${h.tag("borrar")}@qa.local`, roleId: cajeroRoleId, password: "Segura123" });
  const del = await h.req("DELETE", `/api/users/${created.json.user.id}`, { auth: admin });
  assert.equal(del.status, 200, del.text);
  assert.equal(await prisma.user.count({ where: { id: created.json.user.id } }), 0);
  const ghost = await h.req("DELETE", `/api/users/${created.json.user.id}`, { auth: admin });
  assert.equal(ghost.status, 404);
  await prisma.auditLog.create({ data: { userId: cashier.id, action: "QA_HISTORY" } });
  const withHistory = await h.req("DELETE", `/api/users/${cashier.id}`, { auth: admin });
  assert.equal(withHistory.status, 409, withHistory.text);
  await prisma.auditLog.deleteMany({ where: { userId: cashier.id, action: "QA_HISTORY" } });
  const self = await h.req("DELETE", `/api/users/${admin.id}`, { auth: admin });
  assert.equal(self.status, 400);
  const selfOff = await h.req("PATCH", `/api/users/${admin.id}/active`, { auth: admin, body: { isActive: false } });
  assert.equal(selfOff.status, 400);
});

test("QA-USR-11 cambio de contraseña: actual incorrecta, vacía o nueva débil se rechazan", { skip }, async () => {
  const u = await h.user("pwbad", ["sales.read"], "Original123");
  const wrong = await h.req("POST", "/api/auth/change-password", { auth: u, body: { currentPassword: "Incorrecta1", newPassword: "Nueva12345" } });
  assert.ok([400, 401, 403].includes(wrong.status), `actual incorrecta → ${wrong.status}`);
  const empty = await h.req("POST", "/api/auth/change-password", { auth: u, body: { currentPassword: "", newPassword: "Nueva12345" } });
  assert.equal(empty.status, 400);
  const weak = await h.req("POST", "/api/auth/change-password", { auth: u, body: { currentPassword: "Original123", newPassword: "corta" } });
  assert.equal(weak.status, 400);
  assert.equal((await h.login(u.email, "Original123")).status, 200, "la contraseña no cambió");
});

test("QA-USR-12 cambio de contraseña correcto: la anterior deja de servir y la nueva sí", { skip }, async () => {
  const u = await h.user("pwok", ["sales.read"], "Original123");
  const session = (await h.login(u.email, "Original123")).token!;
  const res = await h.req("POST", "/api/auth/change-password", { auth: session, body: { currentPassword: "Original123", newPassword: "Cambiada456" } });
  assert.equal(res.status, 200, res.text);
  assert.equal((await h.login(u.email, "Original123")).status, 401);
  assert.equal((await h.login(u.email, "Cambiada456")).status, 200);
  assert.equal((await h.req("GET", "/api/auth/me", { auth: session })).status, 401, "el token anterior queda revocado");
});

test("QA-USR-13 cambio de contraseña limitado a 3 intentos por usuario (429)", { skip }, async () => {
  const u = await h.user("pwrate", ["sales.read"], "Original123");
  const statuses: number[] = [];
  for (let i = 0; i < 4; i++) {
    statuses.push((await h.req("POST", "/api/auth/change-password", { auth: u, body: { currentPassword: "Mala12345", newPassword: "Nueva12345" } })).status);
  }
  assert.equal(statuses[3], 429, statuses.join(","));
});

test("QA-USR-14 login: mensaje genérico, 5 intentos por IP+email y luego 429", { skip }, async () => {
  const u = await h.user("loginrate", [], "Original123");
  const wrong = await h.login(u.email, "Mala12345");
  const unknown = await h.login(`${h.tag("noexiste")}@qa.local`, "Mala12345");
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.equal(JSON.parse(wrong.body).message, JSON.parse(unknown.body).message, "no revela si el email existe");
  const statuses = [wrong.status];
  for (let i = 0; i < 5; i++) statuses.push((await h.login(u.email, "Mala12345")).status);
  assert.equal(statuses[5], 429, statuses.join(","));
  const empty = await h.login("", "");
  assert.equal(empty.status, 400);
});

test("QA-USR-15 logout revoca el token en el servidor", { skip }, async () => {
  const u = await h.user("logout", [], "Original123");
  const token = (await h.login(u.email, "Original123")).token!;
  assert.equal((await h.req("POST", "/api/auth/logout", { auth: token })).status, 204);
  assert.equal((await h.req("GET", "/api/auth/me", { auth: token })).status, 401);
});

test("QA-USR-16 cambio de rol: los permisos nuevos aplican en la siguiente petición", { skip }, async () => {
  const created = await createViaApi({ name: "QA Rol", email: `${h.tag("rol")}@qa.local`, roleId: cajeroRoleId, password: "Segura123" });
  const { id, email } = created.json.user;
  const token = (await h.login(email, "Segura123")).token!;
  assert.equal((await h.req("GET", "/api/users", { auth: token })).status, 403);
  assert.equal((await h.req("PATCH", `/api/users/${id}`, { auth: admin, body: { roleId: adminRoleId } })).status, 200);
  assert.equal((await h.req("GET", "/api/users", { auth: token })).status, 200, "ahora es ADMIN");
  assert.equal((await h.req("PATCH", `/api/users/${id}`, { auth: admin, body: { roleId: cajeroRoleId } })).status, 200);
  assert.equal((await h.req("GET", "/api/users", { auth: token })).status, 403, "vuelve a CAJERO");
});

test("QA-USR-17 un administrador parcial no puede crear ADMIN ni editar/desactivar/borrar a un ADMIN", { skip }, async () => {
  const mint = await createViaApi({ name: "QA Escala", email: `${h.tag("escala")}@qa.local`, roleId: adminRoleId, password: "Segura123" }, userAdmin);
  assert.equal(mint.status, 403, mint.text);
  for (const [method, path, body] of [
    ["PATCH", `/api/users/${admin.id}`, { email: `${h.tag("robado")}@qa.local` }],
    ["PATCH", `/api/users/${admin.id}`, { roleId: cajeroRoleId }],
    ["PATCH", `/api/users/${admin.id}/active`, { isActive: false }],
    ["DELETE", `/api/users/${admin.id}`, undefined],
  ] as const) {
    const res = await h.req(method, path, { auth: userAdmin, body });
    assert.equal(res.status, 403, `${method} ${path} ${JSON.stringify(body)} → ${res.status}`);
  }
  const selfPromote = await h.req("PATCH", `/api/users/${userAdmin.id}`, { auth: userAdmin, body: { roleId: adminRoleId } });
  assert.ok([400, 403].includes(selfPromote.status), `auto-promoción → ${selfPromote.status}`);
  const row = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
  assert.equal(row.roleId, adminRoleId);
  assert.equal(row.isActive, true);
});

test("QA-USR-18 un CAJERO no administra usuarios ni roles", { skip }, async () => {
  for (const [method, path, body] of [
    ["GET", "/api/users", undefined],
    ["POST", "/api/users", { name: "x", email: `${h.tag("c")}@qa.local`, roleId: cajeroRoleId, password: "Segura123" }],
    ["PATCH", `/api/users/${admin.id}`, { name: "hack" }],
    ["DELETE", `/api/users/${admin.id}`, undefined],
    ["GET", "/api/roles", undefined],
    ["PATCH", `/api/roles/${adminRoleId}/permissions`, { permissionIds: [] }],
    ["PATCH", `/api/roles/${cajeroRoleId}`, { name: "hack" }],
  ] as const) {
    const res = await h.req(method, path, { auth: cashier, body });
    assert.equal(res.status, 403, `${method} ${path} → ${res.status}`);
  }
});

test("QA-USR-19 perfil propio: cambia el nombre y rechaza nombre vacío", { skip }, async () => {
  const u = await h.user("perfil", []);
  assert.equal((await h.req("PATCH", "/api/auth/profile", { auth: u, body: { name: "QA Perfil Nuevo" } })).status, 200);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).name, "QA Perfil Nuevo");
  assert.equal((await h.req("PATCH", "/api/auth/profile", { auth: u, body: { name: "" } })).status, 400);
  const blank = await h.req("PATCH", "/api/auth/profile", { auth: u, body: { name: "   " } });
  assert.equal(blank.status, 400);
});
