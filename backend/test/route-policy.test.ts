import assert from "node:assert/strict";
import { before, test } from "node:test";
import type { Router } from "express";

/**
 * Locks in the route convention (requireAuth → checkPermission → validate → controller):
 * a new endpoint without a permission check or body validation must be added to one of
 * the explicit exception lists below, with the reason, instead of slipping through.
 */

type RouteInfo = { key: string; method: string; handlers: string[]; routerAuth: boolean };

// Reachable without a session.
const PUBLIC = new Set([
  "POST /api/auth/login",
  "POST /api/auth/logout",
  "GET /api/auth/csrf",
  "GET /api/menu/",
  "GET /api/categories/",
  "GET /api/categories/:id",
  "GET /api/preferences/general",
]);

// Authenticated, but with no single route-level permission: the service scopes the data.
const SCOPED_IN_SERVICE = new Set([
  "GET /api/auth/me", // the caller's own session
  "POST /api/auth/change-password", // own account
  "PATCH /api/auth/profile", // own account
  "GET /api/orders/", // users without sales.read only see their own orders
  "GET /api/orders/:id", // same ownership rule
  "PATCH /api/orders/:id/status", // sales.create to advance, sales.cancel to cancel
  "GET /api/notifications/", // every query is filtered by the caller's userId
  "DELETE /api/notifications/",
  "PATCH /api/notifications/:id/read",
  "POST /api/notifications/read-all",
  "DELETE /api/notifications/:id",
]);

// Mutations whose only input is the URL (no body to validate).
const NO_BODY = new Set([
  "POST /api/auth/logout",
  "POST /api/inventory-counts/",
  "POST /api/inventory-counts/:countId/complete",
  "POST /api/inventory-counts/:countId/apply",
  "POST /api/purchases/:id/receive",
  "PATCH /api/notifications/:id/read",
  "POST /api/notifications/read-all",
  // Validated in the controller because the URL :key is part of the schema.
  "PATCH /api/preferences/:key",
]);

const routes: RouteInfo[] = [];

before(async () => {
  process.env.JWT_SECRET = "test-secret-with-enough-entropy-123456789";
  process.env.CSRF_SECRET = "12345678901234567890123456789012";
  process.env.DATABASE_URL = "postgresql://user:password@localhost:5432/coffee?sslmode=require";
  process.env.DATABASE_SSL_CA = "test-ca";

  const mounts: Array<[string, Promise<{ default: Router }>]> = [
    ["/api/auth", import("../src/routes/auth.routes")],
    ["/api/menu", import("../src/routes/menu.routes")],
    ["/api/categories", import("../src/routes/category.routes")],
    ["/api/products", import("../src/routes/product.routes")],
    ["/api/orders", import("../src/routes/order.routes")],
    ["/api/notifications", import("../src/routes/notification.routes")],
    ["/api/cash-register", import("../src/routes/cash.routes")],
    ["/api/inventory", import("../src/routes/inventory.routes")],
    ["/api/purchases", import("../src/routes/purchase.routes")],
    ["/api/inventory-counts", import("../src/routes/inventory-count.routes")],
    ["/api/suppliers", import("../src/routes/supplier.routes")],
    ["/api/users", import("../src/routes/user.routes")],
    ["/api/roles", import("../src/routes/role.routes")],
    ["/api/permissions", import("../src/routes/permission.routes")],
    ["/api/preferences", import("../src/routes/preference.routes")],
    ["/api/expenses", import("../src/routes/expense.routes")],
    ["/api/dashboard", import("../src/routes/dashboard.routes")],
    ["/api/income-statement", import("../src/routes/income-statement.routes")],
  ];

  for (const [mount, modulePromise] of mounts) {
    const router = (await modulePromise).default;
    let routerAuth = false;
    for (const layer of router.stack) {
      if (!layer.route) {
        if (layer.handle.name === "requireAuth") routerAuth = true;
        continue;
      }
      const handlers = layer.route.stack.map((routeLayer) => routeLayer.handle.name);
      const path = layer.route.path === "/" ? "/" : String(layer.route.path);
      for (const method of Object.keys((layer.route as unknown as { methods: Record<string, boolean> }).methods)) {
        const upper = method.toUpperCase();
        routes.push({ key: `${upper} ${mount}${path}`, method: upper, handlers, routerAuth });
      }
    }
  }
});

test("el inventario de rutas no está vacío", () => {
  assert.ok(routes.length > 60, `solo se encontraron ${routes.length} rutas`);
});

test("toda ruta no pública exige sesión", () => {
  const missing = routes
    .filter((route) => !PUBLIC.has(route.key))
    .filter((route) => !route.routerAuth && !route.handlers.includes("requireAuth"))
    .map((route) => route.key);
  assert.deepEqual(missing, []);
});

test("toda ruta autenticada declara su permiso (salvo las acotadas en el service)", () => {
  const missing = routes
    .filter((route) => !PUBLIC.has(route.key) && !SCOPED_IN_SERVICE.has(route.key))
    .filter((route) => !route.handlers.includes("checkPermissionMiddleware"))
    .map((route) => route.key);
  assert.deepEqual(missing, []);
});

test("toda mutación con body lo valida con Zod en la ruta", () => {
  const missing = routes
    .filter((route) => route.method === "POST" || route.method === "PATCH" || route.method === "PUT")
    .filter((route) => !NO_BODY.has(route.key))
    .filter((route) => !route.handlers.includes("validateBody"))
    .map((route) => route.key);
  assert.deepEqual(missing, []);
});

test("las listas de excepciones no tienen rutas que ya no existen", () => {
  const keys = new Set(routes.map((route) => route.key));
  const stale = [...PUBLIC, ...SCOPED_IN_SERVICE, ...NO_BODY].filter((key) => !keys.has(key));
  assert.deepEqual(stale, []);
});
