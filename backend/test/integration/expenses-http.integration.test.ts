import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { after, before, test } from "node:test";
import { app } from "../../src/app";
import { prisma } from "../../src/config/prisma";
import { createJwtToken, type AuthUser } from "../../src/services/auth.service";

// N-03: the expense endpoints must work over HTTP (the service-level tests could not catch the
// async-schema crash in validate(), which made every POST /api/expenses answer 500).

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "true";
const testId = randomUUID();

let server: Server;
let baseUrl: string;
let user: AuthUser;
let roleId: string;
const expenseIds: string[] = [];

async function send(method: string, path: string, body?: unknown) {
  const csrf = await fetch(`${baseUrl}/api/auth/csrf`);
  const token = ((await csrf.json()) as { token: string }).token;
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": token,
      Cookie: csrf.headers.get("set-cookie")!.split(";")[0],
      Authorization: `Bearer ${createJwtToken(user)}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

before(async () => {
  if (!integrationEnabled) return;
  const permissions = await Promise.all(
    ["expenses.read", "expenses.create", "expenses.update", "expenses.delete"].map((name) =>
      prisma.permission.upsert({ where: { name }, update: {}, create: { name } }),
    ),
  );
  const role = await prisma.role.create({
    data: { name: `expenses-http-${testId}`, permissions: { create: permissions.map(({ id }) => ({ permissionId: id })) } },
  });
  roleId = role.id;
  const record = await prisma.user.create({
    data: { email: `expenses-http-${testId}@test.local`, name: "Expenses HTTP", passwordHash: "unused", roleId },
  });
  user = { id: record.id, name: record.name, email: record.email, roleId, roleName: role.name, isActive: true, permissions: permissions.map((p) => p.name) };

  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  if (!integrationEnabled) return;
  await prisma.expense.deleteMany({ where: { createdById: user.id } });
  await prisma.user.deleteMany({ where: { id: user.id } });
  await prisma.role.deleteMany({ where: { id: roleId } });
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

test("N-03: registrar, editar y eliminar un gasto por HTTP", { skip: !integrationEnabled }, async () => {
  const created = await send("POST", "/api/expenses", { category: "insumos", description: "Leche", amount: 50, paymentMethod: "transfer" });
  assert.equal(created.status, 201, await created.clone().text());
  const { expense } = (await created.json()) as { expense: { id: string; amount: string | number } };
  expenseIds.push(expense.id);
  assert.equal(Number(expense.amount), 50);

  const updated = await send("PATCH", `/api/expenses/${expense.id}`, { amount: 60 });
  assert.equal(updated.status, 200, await updated.clone().text());

  const invalid = await send("POST", "/api/expenses", { category: "inventada", description: "x", amount: -1 });
  assert.equal(invalid.status, 400);
  const invalidBody = (await invalid.json()) as { message: string; errors: Record<string, string[]> };
  assert.ok(invalidBody.errors.category && invalidBody.errors.amount);

  const deleted = await send("DELETE", `/api/expenses/${expense.id}`);
  assert.ok(deleted.status === 200 || deleted.status === 204, String(deleted.status));
});
