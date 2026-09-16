import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { after, before, test } from "node:test";
import { app } from "../../src/app";
import { createJwtToken, type AuthUser } from "../../src/services/auth.service";
import { ProductService } from "../../src/services/product.service";
import { prisma } from "../../src/config/prisma";

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "true";
const testId = randomUUID();
// Matches the real permissions seeded in prisma/seed.ts and checked by product.routes.ts /
// ProductService. "manage:products" (the previous value here) doesn't exist in the seed
// data and isn't grantable through the role-management UI — using it masked a real bug
// where ProductService checked a permission the route layer never granted.
const permissionNames = ["products.create", "products.update", "products.delete"];
const roleName = `integration-role-${testId}`;
const managerEmail = `manager-${testId}@example.com`;
const viewerEmail = `viewer-${testId}@example.com`;
const productSku = `INT-${testId}`;

let server: Server;
let baseUrl: string;
let manager: AuthUser;
let viewer: AuthUser;
let productId: string;

async function getCsrfHeaders() {
  const response = await fetch(`${baseUrl}/api/auth/csrf`);
  assert.equal(response.status, 200);
  const token = (await response.json() as { token: string }).token;
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie);

  return {
    "Content-Type": "application/json",
    Cookie: setCookie.split(";")[0],
    "X-CSRF-TOKEN": token,
  };
}

function authHeaders(user: AuthUser, csrfHeaders: Record<string, string>) {
  return {
    ...csrfHeaders,
    Authorization: `Bearer ${createJwtToken(user)}`,
  };
}

async function requestProduct(
  path: string,
  init: RequestInit = {},
  user?: AuthUser,
) {
  const csrfHeaders = await getCsrfHeaders();
  const headers = user ? authHeaders(user, csrfHeaders) : csrfHeaders;

  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...headers, ...init.headers },
  });
}

before(async () => {
  if (!integrationEnabled) return;

  const permissions = await Promise.all(
    permissionNames.map((name) =>
      prisma.permission.upsert({ where: { name }, update: {}, create: { name } })
    ),
  );
  const role = await prisma.role.create({
    data: {
      name: roleName,
      permissions: { create: permissions.map((permission) => ({ permissionId: permission.id })) },
    },
  });

  const [managerRecord, viewerRole, managerRole] = await Promise.all([
    prisma.user.create({
      data: {
        name: "Integration Manager",
        email: managerEmail,
        passwordHash: "unused",
        roleId: role.id,
      },
    }),
    prisma.role.create({ data: { name: `${roleName}-viewer` } }),
    Promise.resolve(role),
  ]);

  const viewerRecord = await prisma.user.create({
    data: {
      name: "Integration Viewer",
      email: viewerEmail,
      passwordHash: "unused",
      roleId: viewerRole.id,
    },
  });

  manager = {
    id: managerRecord.id,
    name: managerRecord.name,
    email: managerRecord.email,
    roleId: managerRole.id,
    roleName: managerRole.name,
    isActive: true,
    permissions: permissionNames,
  };
  viewer = {
    id: viewerRecord.id,
    name: viewerRecord.name,
    email: viewerRecord.email,
    roleId: viewerRole.id,
    roleName: viewerRole.name,
    isActive: true,
    permissions: [],
  };

  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (!integrationEnabled) return;

  await prisma.product.deleteMany({ where: { sku: productSku } });
  await prisma.user.deleteMany({ where: { email: { in: [managerEmail, viewerEmail] } } });
  await prisma.role.deleteMany({ where: { name: { in: [roleName, `${roleName}-viewer`] } } });
  await prisma.$disconnect();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test("rechaza la mutación de productos sin autenticación con 401", { skip: !integrationEnabled }, async () => {
  for (const [path, method, body] of [
    ["/api/products", "POST", JSON.stringify({ name: "Anonymous Product", price: 10, cost: 5 })],
    [`/api/products/${randomUUID()}`, "PATCH", JSON.stringify({ name: "Anonymous Product" })],
    [`/api/products/${randomUUID()}`, "DELETE", undefined],
  ] as const) {
    const response = await requestProduct(path, { method, body });
    assert.equal(response.status, 401, method);
  }
});

test("rechaza la mutación de productos sin los permisos products.*", { skip: !integrationEnabled }, async () => {
  for (const [path, method, body] of [
    ["/api/products", "POST", JSON.stringify({ name: "Viewer Product", price: 10, cost: 5 })],
    [`/api/products/${randomUUID()}`, "PATCH", JSON.stringify({ name: "Viewer Product" })],
    [`/api/products/${randomUUID()}`, "DELETE", undefined],
  ] as const) {
    const response = await requestProduct(path, { method, body }, viewer);
    assert.equal(response.status, 403, method);
  }
});

test("permite crear, actualizar y eliminar productos con los permisos products.*", { skip: !integrationEnabled }, async () => {
  const createResponse = await requestProduct("/api/products", {
    method: "POST",
    body: JSON.stringify({ name: "Integration Product", price: 25, cost: 8, sku: productSku }),
  }, manager);
  assert.equal(createResponse.status, 201);
  const created = await createResponse.json() as { id: string; name: string };
  productId = created.id;
  assert.equal(created.name, "Integration Product");

  const updateResponse = await requestProduct(`/api/products/${productId}`, {
    method: "PATCH",
    body: JSON.stringify({ name: "Updated Integration Product", price: 30, cost: 9 }),
  }, manager);
  assert.equal(updateResponse.status, 200);
  assert.equal((await updateResponse.json() as { name: string }).name, "Updated Integration Product");

  const deleteResponse = await requestProduct(`/api/products/${productId}`, { method: "DELETE" }, manager);
  assert.equal(deleteResponse.status, 204);
  assert.equal(await prisma.product.findUnique({ where: { id: productId } }), null);
});

test("responde 404 para un producto inexistente", { skip: !integrationEnabled }, async () => {
  const missingId = randomUUID();
  const getResponse = await fetch(`${baseUrl}/api/products/${missingId}`);
  assert.equal(getResponse.status, 404);

  for (const [method, body] of [
    ["PATCH", JSON.stringify({ name: "Missing Product" })],
    ["DELETE", undefined],
  ] as const) {
    const response = await requestProduct(`/api/products/${missingId}`, { method, body }, manager);
    assert.equal(response.status, 404, method);
  }
});

test("ProductService mantiene la autorización fuera de las rutas", { skip: !integrationEnabled }, async () => {
  const unauthorizedUser = { ...viewer, permissions: [] };
  const productData = { name: "Service Product", price: 20, cost: 7, sku: `SVC-${testId}` };

  await assert.rejects(ProductService.create(productData, unauthorizedUser), (error: Error) => {
    assert.equal(error.name, "AuthorizationError");
    return true;
  });

  const product = await prisma.product.create({ data: productData });
  await assert.rejects(ProductService.update(product.id, { name: "Should Not Update" }, unauthorizedUser), (error: Error) => {
    assert.equal(error.name, "AuthorizationError");
    return true;
  });
  await assert.rejects(ProductService.remove(product.id, unauthorizedUser), (error: Error) => {
    assert.equal(error.name, "AuthorizationError");
    return true;
  });

  await prisma.product.delete({ where: { id: product.id } });
});