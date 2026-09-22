import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { after, before, test } from "node:test";
import { app } from "../../src/app";
import { createJwtToken, type AuthUser } from "../../src/services/auth.service";
import { OrderService } from "../../src/services/order.service";
import { prisma } from "../../src/config/prisma";

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "true";
const testId = randomUUID();
const ownerRoleName = `orders-owner-${testId}`;
const modifierRoleName = `orders-modifier-${testId}`;
const managerRoleName = `orders-manager-${testId}`;
const ownerEmail = `orders-owner-${testId}@example.com`;
const otherOwnerEmail = `orders-other-${testId}@example.com`;
const modifierEmail = `orders-modifier-${testId}@example.com`;
const managerEmail = `orders-manager-${testId}@example.com`;

let server: Server;
let baseUrl: string;
let owner: AuthUser;
let otherOwner: AuthUser;
let modifier: AuthUser;
let manager: AuthUser;
let ownerOrderId: string;
let otherOrderId: string;

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

async function requestOrder(path: string, init: RequestInit = {}, user?: AuthUser) {
  const csrfHeaders = await getCsrfHeaders();
  const headers = user
    ? { ...csrfHeaders, Authorization: `Bearer ${createJwtToken(user)}` }
    : csrfHeaders;

  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...headers, ...init.headers },
  });
}

function authUser(record: { id: string; name: string; email: string; roleId: string }, roleName: string, permissions: string[]): AuthUser {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    roleId: record.roleId,
    roleName,
    isActive: true,
    permissions,
  };
}

before(async () => {
  if (!integrationEnabled) return;

  const [salesRead, salesCreate, salesCancel] = await Promise.all([
    prisma.permission.upsert({ where: { name: "sales.read" }, update: {}, create: { name: "sales.read" } }),
    prisma.permission.upsert({ where: { name: "sales.create" }, update: {}, create: { name: "sales.create" } }),
    prisma.permission.upsert({ where: { name: "sales.cancel" }, update: {}, create: { name: "sales.cancel" } }),
  ]);
  const [ownerRole, modifierRole, managerRole] = await Promise.all([
    prisma.role.create({ data: { name: ownerRoleName } }),
    prisma.role.create({ data: { name: modifierRoleName, permissions: { create: { permissionId: salesCancel.id } } } }),
    prisma.role.create({
      data: {
        name: managerRoleName,
        permissions: { create: [{ permissionId: salesRead.id }, { permissionId: salesCreate.id }, { permissionId: salesCancel.id }] },
      },
    }),
  ]);
  const [ownerRecord, otherOwnerRecord, modifierRecord, managerRecord] = await Promise.all([
    prisma.user.create({ data: { name: "Order Owner", email: ownerEmail, passwordHash: "unused", roleId: ownerRole.id } }),
    prisma.user.create({ data: { name: "Other Order Owner", email: otherOwnerEmail, passwordHash: "unused", roleId: ownerRole.id } }),
    prisma.user.create({ data: { name: "Order Modifier", email: modifierEmail, passwordHash: "unused", roleId: modifierRole.id } }),
    prisma.user.create({ data: { name: "Order Manager", email: managerEmail, passwordHash: "unused", roleId: managerRole.id } }),
  ]);

  owner = authUser(ownerRecord, ownerRoleName, []);
  otherOwner = authUser(otherOwnerRecord, ownerRoleName, []);
  modifier = authUser(modifierRecord, modifierRoleName, ["sales.cancel"]);
  manager = authUser(managerRecord, managerRoleName, ["sales.read", "sales.create", "sales.cancel"]);

  const [ownerOrder, otherOrder] = await Promise.all([
    prisma.order.create({ data: { createdById: owner.id, customerName: "Owner order" } }),
    prisma.order.create({ data: { createdById: otherOwner.id, customerName: "Other order" } }),
  ]);
  ownerOrderId = ownerOrder.id;
  otherOrderId = otherOrder.id;

  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (!integrationEnabled) return;

  const userIds = [owner.id, otherOwner.id, modifier.id, manager.id];
  await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.order.deleteMany({ where: { createdById: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.role.deleteMany({ where: { name: { in: [ownerRoleName, modifierRoleName, managerRoleName] } } });
  await prisma.$disconnect();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("las rutas de pedidos devuelven 401 sin autenticación", { skip: !integrationEnabled }, async () => {
  const getList = await requestOrder("/api/orders");
  assert.equal(getList.status, 401);
  const getOne = await requestOrder(`/api/orders/${ownerOrderId}`);
  assert.equal(getOne.status, 401);
  const update = await requestOrder(`/api/orders/${ownerOrderId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: "completed" }),
  });
  assert.equal(update.status, 401);
});

test("impide el IDOR de lectura y modificación fuera del alcance", { skip: !integrationEnabled }, async () => {
  const readResponse = await requestOrder(`/api/orders/${otherOrderId}`, {}, owner);
  assert.equal(readResponse.status, 403);

  const updateResponse = await requestOrder(`/api/orders/${otherOrderId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: "completed" }),
  }, modifier);
  assert.equal(updateResponse.status, 403);
});

test("permite modificar con permiso y registra la auditoría del cambio", { skip: !integrationEnabled }, async () => {
  const response = await requestOrder(`/api/orders/${ownerOrderId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: "completed" }),
  }, owner);
  assert.equal(response.status, 403);

  const allowedResponse = await requestOrder(`/api/orders/${ownerOrderId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: "preparing" }),
  }, manager);
  assert.equal(allowedResponse.status, 200);

  const audit = await prisma.auditLog.findFirst({
    where: { userId: manager.id, action: "ORDER_STATUS_CHANGED" },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(audit);
  assert.deepEqual(audit.metadata, {
    orderId: ownerOrderId,
    previousStatus: "pending",
    newStatus: "preparing",
  });
});

test("devuelve 404 para un pedido inexistente", { skip: !integrationEnabled }, async () => {
  const missingId = randomUUID();
  const readResponse = await requestOrder(`/api/orders/${missingId}`, {}, manager);
  assert.equal(readResponse.status, 404);

  const updateResponse = await requestOrder(`/api/orders/${missingId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: "completed" }),
  }, manager);
  assert.equal(updateResponse.status, 404);
});

test("devuelve 409 para una transición inválida", { skip: !integrationEnabled }, async () => {
  const order = await prisma.order.create({ data: { createdById: manager.id, customerName: "Invalid transition order" } });
  const response = await requestOrder(`/api/orders/${order.id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: "pending" }),
  }, manager);
  assert.equal(response.status, 409);
});

test("OrderService aplica autorización y transición fuera de HTTP", { skip: !integrationEnabled }, async () => {
  await assert.rejects(
    OrderService.findOne(otherOrderId, owner),
    (error: Error) => error.name === "AuthorizationError",
  );
  await assert.rejects(
    OrderService.updateStatus(otherOrderId, { status: "completed" }, modifier),
    (error: Error) => error.name === "AuthorizationError",
  );
  const order = await prisma.order.create({ data: { createdById: manager.id, customerName: "Service transition order" } });
  await assert.rejects(
    OrderService.updateStatus(order.id, { status: "pending" }, manager),
    (error: Error) => error.name === "StateTransitionError",
  );
});