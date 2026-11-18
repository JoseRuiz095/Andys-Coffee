/**
 * Shared helpers for the QA audit suites (qa-*.integration.test.ts, 2026-11-18).
 * Not a test file (the integration glob only runs *.integration.test.ts).
 *
 * Every request goes through the real Express app (helmet, CSRF, requireAuth, checkPermission,
 * validate, controller, service, repository) against the Docker test database. Test data uses
 * the `qa-<uuid>` prefix so it never collides with seed data.
 */
import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { app } from "../../src/app";
import { prisma } from "../../src/config/prisma";
import { createJwtToken, type AuthUser } from "../../src/services/auth.service";

export const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "true";

export type QaUser = AuthUser & { password: string };

export class QaHarness {
  readonly id = randomUUID().slice(0, 8);
  baseUrl = "";
  private server?: Server;
  readonly userIds: string[] = [];
  readonly roleIds: string[] = [];

  tag(name: string) {
    return `qa-${this.id}-${name}`;
  }

  async start() {
    this.server = app.listen(0);
    await new Promise<void>((resolve) => this.server!.once("listening", resolve));
    this.baseUrl = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  /**
   * Deactivates (never deletes: sales and purchases reference them) every catalog row this suite
   * created, so later suites and E2E specs see a POS menu without dozens of qa-* categories.
   */
  async retireCatalog() {
    const prefix = { startsWith: `qa-${this.id}-` };
    await prisma.product.updateMany({ where: { OR: [{ name: prefix }, { sku: prefix }] }, data: { isActive: false } });
    await prisma.category.updateMany({ where: { name: prefix }, data: { isActive: false } });
    await prisma.ingredient.updateMany({ where: { name: prefix }, data: { isActive: false } });
    await prisma.supplier.updateMany({ where: { name: prefix }, data: { isActive: false } });
  }

  async stop() {
    await this.retireCatalog();
    if (this.server) await new Promise<void>((resolve) => this.server!.close(() => resolve()));
  }

  /** Creates a role with exactly these permissions (seeded names) and a user in it. */
  async user(name: string, permissions: string[] | "ADMIN" | "CAJERO", password = "QaPassw0rd!") {
    let roleId: string;
    let roleName: string;
    if (permissions === "ADMIN" || permissions === "CAJERO") {
      const role = await prisma.role.findUniqueOrThrow({ where: { name: permissions } });
      roleId = role.id;
      roleName = role.name;
    } else {
      const perms = await prisma.permission.findMany({ where: { name: { in: permissions } } });
      assert.equal(perms.length, permissions.length, `unknown permission in ${permissions.join(",")}`);
      const role = await prisma.role.create({
        data: { name: this.tag(`role-${name}`), permissions: { create: perms.map((p) => ({ permissionId: p.id })) } },
      });
      this.roleIds.push(role.id);
      roleId = role.id;
      roleName = role.name;
    }
    const record = await prisma.user.create({
      data: { name: `QA ${name}`, email: `${this.tag(name)}@qa.local`, passwordHash: await bcrypt.hash(password, 4), roleId },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    this.userIds.push(record.id);
    return {
      id: record.id,
      name: record.name,
      email: record.email,
      roleId,
      roleName,
      isActive: true,
      permissions: record.role.permissions.map((p) => p.permission.name),
      password,
    } satisfies QaUser;
  }

  async csrf() {
    const response = await fetch(`${this.baseUrl}/api/auth/csrf`);
    const token = ((await response.json()) as { token: string }).token;
    return { token, cookie: response.headers.get("set-cookie")!.split(";")[0] };
  }

  /**
   * HTTP request. `auth` = a user (Bearer JWT for its current tokenVersion), a raw JWT string,
   * or undefined (anonymous). CSRF is sent on mutations unless `csrf: false`.
   */
  async req(method: string, path: string, opts: { auth?: QaUser | AuthUser | string; body?: unknown; headers?: Record<string, string>; csrf?: boolean; rawBody?: string } = {}) {
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    if (opts.auth) {
      const token = typeof opts.auth === "string" ? opts.auth : await this.tokenFor(opts.auth);
      headers.Authorization = `Bearer ${token}`;
    }
    const mutating = method !== "GET" && method !== "HEAD";
    if (mutating && opts.csrf !== false) {
      const { token, cookie } = await this.csrf();
      headers["X-CSRF-TOKEN"] = token;
      headers.Cookie = headers.Cookie ? `${headers.Cookie}; ${cookie}` : cookie;
    }
    if (opts.body !== undefined || opts.rawBody !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: opts.rawBody ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    });
    const text = await response.text();
    let json: any = undefined;
    try { json = text ? JSON.parse(text) : undefined; } catch { /* not JSON */ }
    return { status: response.status, json, text, headers: response.headers };
  }

  private async tokenFor(user: AuthUser) {
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { tokenVersion: true } });
    return createJwtToken(user, row.tokenVersion);
  }

  /** Real login over HTTP; returns the session JWT from the HttpOnly cookie (or null). */
  async login(email: string, password: string) {
    const { token, cookie } = await this.csrf();
    const response = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-TOKEN": token, Cookie: cookie },
      body: JSON.stringify({ email, password }),
    });
    const body = await response.text();
    const session = response.headers.getSetCookie().find((c) => c.startsWith("token="));
    return { status: response.status, body, token: session ? decodeURIComponent(session.split(";")[0].slice(6)) : null };
  }

  async cleanupUsers() {
    if (this.userIds.length) {
      await prisma.notificationRecipient.deleteMany({ where: { userId: { in: this.userIds } } }).catch(() => undefined);
      await prisma.user.deleteMany({ where: { id: { in: this.userIds } } }).catch(() => undefined);
    }
    if (this.roleIds.length) await prisma.role.deleteMany({ where: { id: { in: this.roleIds } } }).catch(() => undefined);
  }
}

/** Closes whatever cash session is open (other suites leave none, but be safe) and opens one. */
export async function openFreshCashSession(h: QaHarness, admin: QaUser, openingAmount = 500) {
  const active = await h.req("GET", "/api/cash-register/sessions/active", { auth: admin });
  if (active.status === 200 && active.json?.session?.id) {
    await h.req("POST", "/api/cash-register/sessions/close", { auth: admin, body: { closingAmount: Number(active.json.session.expectedAmount) } });
  }
  await prisma.cashSession.updateMany({ where: { status: "open" }, data: { status: "closed", closedAt: new Date() } });
  const opened = await h.req("POST", "/api/cash-register/sessions", { auth: admin, body: { openingAmount } });
  assert.equal(opened.status, 201, `open cash: ${opened.text}`);
  return opened.json.session as { id: string; expectedAmount: string };
}

export async function closeAnyCashSession() {
  await prisma.cashSession.updateMany({ where: { status: "open" }, data: { status: "closed", closedAt: new Date() } });
}

/** A product with a fixed price in a fresh category; optional recipe (ingredientId → qty). */
export async function qaProduct(h: QaHarness, name: string, price: number, opts: { recipe?: Record<string, number>; temperature?: "HOT" | "COLD" | "BOTH"; jumboPrice?: number; tracksInventory?: boolean } = {}) {
  const isBeverage = Boolean(opts.temperature || opts.jumboPrice);
  const category = await prisma.category.create({ data: { name: h.tag(`cat-${name}`), isBeverage } });
  return prisma.product.create({
    data: {
      name: h.tag(name),
      sku: h.tag(`sku-${name}`),
      price,
      cost: price / 4,
      categoryId: category.id,
      temperature: opts.temperature ?? null,
      jumboPrice: opts.jumboPrice ?? null,
      tracksInventory: opts.tracksInventory ?? Boolean(opts.recipe),
      recipes: opts.recipe ? { create: Object.entries(opts.recipe).map(([ingredientId, quantity]) => ({ ingredientId, quantity })) } : undefined,
    },
  });
}

export async function qaIngredient(h: QaHarness, name: string, stock: number, averageCost = 1, minimumStock = 0) {
  const unit = await prisma.inventoryUnit.findFirstOrThrow({ where: { factor: 1, dimension: "MASS" } });
  return prisma.ingredient.create({ data: { name: h.tag(name), unitId: unit.id, currentStock: stock, averageCost, minimumStock } });
}

export function sale(items: unknown[], extra: Record<string, unknown> = {}) {
  return { items, paymentMethod: "cash", ...extra };
}

export const key = () => randomUUID();
