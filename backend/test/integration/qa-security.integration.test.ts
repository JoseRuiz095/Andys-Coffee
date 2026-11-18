import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import jwt from "jsonwebtoken";
import { after, before, test } from "node:test";
import { prisma } from "../../src/config/prisma";
import { QaHarness, integrationEnabled, type QaUser } from "./qa-http";

// QA audit 2026-11-18 — Seguridad técnica: barrido de rutas, sesiones, inyección, CSRF, errores.

const h = new QaHarness();
const skip = !integrationEnabled;
let admin: QaUser;
let noPerms: QaUser;

type Route = { method: string; path: string };

/** Every route, read from src/routes/*.ts and the mount prefixes in src/app.ts. */
function allRoutes(): Route[] {
  const root = path.resolve("src");
  const appSource = fs.readFileSync(path.join(root, "app.ts"), "utf8");
  const imports = new Map([...appSource.matchAll(/import (\w+) from "\.\/routes\/([\w.-]+)"/g)].map((m) => [m[1], m[2]]));
  const routes: Route[] = [];
  for (const [, prefix, ident] of appSource.matchAll(/app\.use\("([^"]+)", (\w+)\)/g)) {
    const file = imports.get(ident);
    if (!file) continue;
    const source = fs.readFileSync(path.join(root, "routes", `${file}.ts`), "utf8");
    for (const [, method, sub] of source.matchAll(/router\.(get|post|patch|put|delete)\(\s*['"]([^'"]+)['"]/g)) {
      routes.push({ method: method.toUpperCase(), path: `${prefix}${sub === "/" ? "" : sub}` });
    }
  }
  return routes;
}

const UUID = "00000000-0000-4000-8000-000000000000";
const fill = (p: string) => p.replace(/:(\w+)/g, (_m, name: string) => (name === "sku" ? "QA-SKU" : name === "key" ? "qa.key" : UUID));

// Routes reachable without a session (by design).
const PUBLIC = new Set(["POST /api/auth/login", "POST /api/auth/logout", "GET /api/auth/csrf", "GET /api/menu", "GET /api/categories", "GET /api/categories/:id",
  // Business profile for the login screen (route-policy.test.ts PUBLIC, N-02).
  "GET /api/preferences/general"]);
// Routes any signed-in user may call (own data / ownership-scoped).
const ANY_USER = new Set([
  "GET /api/auth/me", "POST /api/auth/change-password", "PATCH /api/auth/profile",
  "GET /api/orders", "GET /api/orders/:id", "PATCH /api/orders/:id/status",
  // Own notifications only (NotificationRepository filters by userId; QA-SEC-14 checks it).
  "GET /api/notifications", "DELETE /api/notifications", "PATCH /api/notifications/:id/read",
  "POST /api/notifications/read-all", "DELETE /api/notifications/:id",
]);

before(async () => {
  if (skip) return;
  await h.start();
  admin = await h.user("admin", "ADMIN");
  noPerms = await h.user("nadie", []);
});

after(async () => {
  if (skip) return;
  await h.stop();
});

test("QA-SEC-01 inventario de rutas: se encontraron todas (≥130)", { skip }, () => {
  const routes = allRoutes();
  assert.ok(routes.length >= 130, `solo ${routes.length} rutas`);
});

test("QA-SEC-02 sin sesión: toda ruta no pública responde 401 (nunca 2xx ni 5xx)", { skip }, async () => {
  const problems: string[] = [];
  for (const r of allRoutes()) {
    const id = `${r.method} ${r.path}`;
    if (PUBLIC.has(id)) continue;
    const res = await h.req(r.method, fill(r.path), { body: r.method === "GET" ? undefined : {} });
    if (res.status !== 401) problems.push(`${id} → ${res.status}`);
  }
  assert.deepEqual(problems, []);
});

test("QA-SEC-03 usuario sin permisos: 403 en todo lo restringido; nunca 2xx ni 5xx", { skip }, async () => {
  const leaks: string[] = [];
  const errors: string[] = [];
  for (const r of allRoutes()) {
    const id = `${r.method} ${r.path}`;
    if (PUBLIC.has(id) || ANY_USER.has(id)) continue;
    const res = await h.req(r.method, fill(r.path), { auth: noPerms, body: r.method === "GET" ? undefined : {} });
    if (res.status >= 200 && res.status < 300) leaks.push(`${id} → ${res.status}`);
    if (res.status >= 500) errors.push(`${id} → ${res.status}`);
  }
  assert.deepEqual(errors, [], "5xx");
  assert.deepEqual(leaks, [], "rutas accesibles sin permiso");
});

test("QA-SEC-04 ADMIN con ids inexistentes y cuerpos vacíos: ninguna ruta responde 500", { skip }, async () => {
  const errors: string[] = [];
  for (const r of allRoutes()) {
    if (r.path.includes("/logout") || r.path.endsWith("/sessions/close")) continue;
    const res = await h.req(r.method, fill(r.path), { auth: admin, body: r.method === "GET" ? undefined : {} });
    if (res.status >= 500) errors.push(`${r.method} ${r.path} → ${res.status} ${res.text.slice(0, 80)}`);
  }
  assert.deepEqual(errors, []);
});

test("QA-SEC-05 ids con forma de inyección o no-UUID en la ruta: 4xx, nunca 500", { skip }, async () => {
  const errors: string[] = [];
  const evil = ["1' OR '1'='1", "../../etc/passwd", "%00", "a".repeat(300)];
  const targets = allRoutes().filter((r) => r.method === "GET" && /:\w+/.test(r.path));
  for (const r of targets) {
    for (const value of evil) {
      const url = r.path.replace(/:(\w+)/g, encodeURIComponent(value));
      const res = await h.req("GET", url, { auth: admin });
      if (res.status >= 500) errors.push(`${r.path} [${value.slice(0, 12)}] → ${res.status}`);
    }
  }
  assert.deepEqual(errors, []);
});

test("QA-SEC-06 inyección SQL en búsquedas: no devuelve filas extra y no rompe la BD", { skip }, async () => {
  const payloads = ["' OR 1=1 --", "'; DROP TABLE users; --", "%' OR '%'='", "\\'; SELECT pg_sleep(3); --"];
  const usersBefore = await prisma.user.count();
  for (const p of payloads) {
    const q = encodeURIComponent(p);
    for (const url of [`/api/users?search=${q}`, `/api/suppliers?search=${q}`, `/api/orders?search=${q}`, `/api/inventory?search=${q}`, `/api/products?search=${q}`, `/api/suppliers/search?q=${q}`, `/api/inventory/search?q=${q}`]) {
      const started = Date.now();
      const res = await h.req("GET", url, { auth: admin });
      assert.ok(res.status < 500, `${url} → ${res.status}`);
      assert.ok(Date.now() - started < 2500, `${url} tardó (pg_sleep ejecutado?)`);
      if (res.status === 200) {
        const rows = Array.isArray(res.json) ? res.json : res.json.data ?? [];
        assert.equal(rows.length, 0, `${url} devolvió ${rows.length} filas`);
      }
    }
  }
  assert.equal(await prisma.user.count(), usersBefore);
});

test("QA-SEC-07 CSRF: una mutación sin token o con token falso → 403 y no se aplica", { skip }, async () => {
  const before = (await prisma.user.findUniqueOrThrow({ where: { id: noPerms.id } })).name;
  const none = await h.req("PATCH", "/api/auth/profile", { auth: noPerms, body: { name: "CSRF" }, csrf: false });
  assert.equal(none.status, 403);
  const fake = await h.req("PATCH", "/api/auth/profile", { auth: noPerms, body: { name: "CSRF" }, csrf: false, headers: { "X-CSRF-TOKEN": "fake" } });
  assert.equal(fake.status, 403);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: noPerms.id } })).name, before);
});

test("QA-SEC-08 JWT manipulado, de otro emisor, con alg=none o expirado → 401", { skip }, async () => {
  const claims = { sub: admin.id, permissions: ["users.read"], tv: 0 };
  const tokens = {
    otherSecret: jwt.sign(claims, "x".repeat(48), { issuer: "Andys-Coffee-API", audience: "Andys-Coffee-Client" }),
    wrongIssuer: jwt.sign(claims, process.env.JWT_SECRET!, { issuer: "evil", audience: "Andys-Coffee-Client" }),
    expired: jwt.sign({ ...claims, exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET!, { issuer: "Andys-Coffee-API", audience: "Andys-Coffee-Client" }),
    algNone: `${Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url")}.${Buffer.from(JSON.stringify({ ...claims, iss: "Andys-Coffee-API", aud: "Andys-Coffee-Client" })).toString("base64url")}.`,
    garbage: "abc.def.ghi",
  };
  for (const [name, token] of Object.entries(tokens)) {
    const res = await h.req("GET", "/api/users", { auth: token });
    assert.equal(res.status, 401, `${name} → ${res.status}`);
  }
});

test("QA-SEC-09 los permisos del JWT se ignoran: manda la BD", { skip }, async () => {
  const forged = jwt.sign({ sub: noPerms.id, permissions: ["users.read", "users.create"], roleName: "ADMIN", tv: 0 }, process.env.JWT_SECRET!, { issuer: "Andys-Coffee-API", audience: "Andys-Coffee-Client", expiresIn: "1h" });
  assert.equal((await h.req("GET", "/api/users", { auth: forged })).status, 403);
});

test("QA-SEC-10 JSON malformado → 400; errores sin stack ni detalles internos", { skip }, async () => {
  const res = await h.req("PATCH", "/api/auth/profile", { auth: admin, rawBody: "{name: oops" });
  assert.equal(res.status, 400, res.text);
  const notFound = await h.req("GET", `/api/products/${UUID}`, { auth: admin });
  assert.equal(notFound.status, 404);
  for (const r of [res, notFound]) {
    assert.ok(!/at .*\.ts:\d+|node_modules|prisma\.|PrismaClient/.test(r.text), `filtra internals: ${r.text}`);
    assert.ok(typeof r.json?.message === "string", "forma { message }");
  }
});

test("QA-SEC-11 cabeceras de seguridad (helmet) y sin x-powered-by; cookie de sesión HttpOnly", { skip }, async () => {
  const res = await h.req("GET", "/health");
  assert.equal(res.headers.get("x-powered-by"), null);
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.ok(res.headers.get("content-security-policy"));
  const u = await h.user("cookie", [], "Original123");
  const { token, cookie } = await h.csrf();
  const login = await fetch(`${h.baseUrl}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-TOKEN": token, Cookie: cookie }, body: JSON.stringify({ email: u.email, password: "Original123" }) });
  const session = login.headers.getSetCookie().find((c) => c.startsWith("token="))!;
  assert.match(session, /HttpOnly/i);
  assert.match(session, /SameSite=Lax/i);
  assert.ok(!(await login.text()).includes(session.split(";")[0].slice(6)), "el JWT no va en el body");
});

test("QA-SEC-12 CORS: un origen no permitido no recibe credenciales", { skip }, async () => {
  const res = await fetch(`${h.baseUrl}/api/auth/csrf`, { headers: { Origin: "https://evil.example" } });
  assert.notEqual(res.headers.get("access-control-allow-origin"), "https://evil.example");
  assert.ok(res.status === 403 || !res.headers.get("access-control-allow-credentials"));
});

test("QA-SEC-13 tipos inesperados en el body (objetos/arrays donde va texto) → 400, no 500", { skip }, async () => {
  const cases: [string, string, unknown][] = [
    ["POST", "/api/suppliers", { name: { $ne: null } }],
    ["POST", "/api/users", { name: ["a"], email: "a@b.co", roleId: UUID, password: "Segura123" }],
    ["POST", "/api/orders/quote", { items: "todo" }],
    ["PATCH", "/api/auth/profile", { name: 123 }],
    ["POST", "/api/auth/login", { email: { a: 1 }, password: "x" }],
  ];
  for (const [method, url, body] of cases) {
    const res = await h.req(method, url, { auth: admin, body });
    assert.equal(res.status, 400, `${method} ${url} → ${res.status}`);
  }
});

test("QA-SEC-14 notificaciones: un usuario no lee, marca ni borra las de otro", { skip }, async () => {
  const n = await prisma.notification.create({ data: { title: h.tag("aviso"), message: "privado", recipients: { create: [{ userId: admin.id }] } } });
  const list = await h.req("GET", "/api/notifications", { auth: noPerms });
  assert.ok(!list.text.includes(h.tag("aviso")), "ve notificaciones ajenas");
  await h.req("PATCH", `/api/notifications/${n.id}/read`, { auth: noPerms, body: {} });
  await h.req("DELETE", `/api/notifications/${n.id}`, { auth: noPerms });
  await h.req("DELETE", "/api/notifications", { auth: noPerms });
  const row = await prisma.notificationRecipient.findUnique({ where: { notificationId_userId: { notificationId: n.id, userId: admin.id } } });
  assert.ok(row, "la notificación del admin sigue");
  assert.equal(row.readAt, null, "sigue sin leer");
  await prisma.notification.delete({ where: { id: n.id } });
});
