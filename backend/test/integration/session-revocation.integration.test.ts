import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { after, before, test } from "node:test";
import bcrypt from "bcrypt";
import { app } from "../../src/app";
import { prisma } from "../../src/config/prisma";
import { createJwtToken } from "../../src/services/auth.service";

// M-06: logout and password change revoke existing sessions server-side (User.tokenVersion),
// instead of leaving a copied JWT valid until it expires.

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "true";
const testId = randomUUID();
const email = `session-${testId}@test.local`;
const password = `Session-${testId}-Pass1!`;
const newPassword = `Session-${testId}-Pass2!`;

let server: Server;
let baseUrl: string;
let userId: string;
let roleId: string;

async function csrf() {
  const response = await fetch(`${baseUrl}/api/auth/csrf`);
  const token = ((await response.json()) as { token: string }).token;
  return { token, cookie: response.headers.get("set-cookie")!.split(";")[0] };
}

async function post(path: string, body: unknown, sessionToken?: string) {
  const { token, cookie } = await csrf();
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": token,
      Cookie: sessionToken ? `${cookie}; token=${encodeURIComponent(sessionToken)}` : cookie,
    },
    body: JSON.stringify(body),
  });
}

/** Logs in over HTTP and returns the session JWT from the HttpOnly cookie. */
async function login(pass = password) {
  const response = await post("/api/auth/login", { email, password: pass });
  assert.equal(response.status, 200);
  return sessionTokenFrom(response);
}

function sessionTokenFrom(response: Response) {
  const cookie = response.headers.getSetCookie().find((c) => c.startsWith("token="));
  assert.ok(cookie, "expected a session cookie");
  return decodeURIComponent(cookie.split(";")[0].slice("token=".length));
}

async function me(sessionToken: string) {
  return (await fetch(`${baseUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${sessionToken}` } })).status;
}

before(async () => {
  if (!integrationEnabled) return;
  const role = await prisma.role.create({ data: { name: `session-role-${testId}` } });
  roleId = role.id;
  const user = await prisma.user.create({
    data: { email, name: "Session Tester", passwordHash: await bcrypt.hash(password, 4), roleId },
  });
  userId = user.id;

  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  if (!integrationEnabled) return;
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.role.deleteMany({ where: { id: roleId } });
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

test("M-06: después del logout el mismo token ya no sirve, aunque no haya expirado", { skip: !integrationEnabled }, async () => {
  const token = await login();
  assert.equal(await me(token), 200);

  const logout = await post("/api/auth/logout", {}, token);
  assert.equal(logout.status, 204);

  assert.equal(await me(token), 401);
});

test("M-06: cambiar la contraseña cierra las demás sesiones y mantiene la actual", { skip: !integrationEnabled }, async () => {
  const thisDevice = await login();
  const otherDevice = await login();
  assert.equal(await me(otherDevice), 200);

  const change = await post("/api/auth/change-password", { currentPassword: password, newPassword }, thisDevice);
  assert.equal(change.status, 200, await change.clone().text());
  const renewed = sessionTokenFrom(change);

  assert.equal(await me(otherDevice), 401, "other sessions are revoked");
  assert.equal(await me(thisDevice), 401, "the pre-change token is revoked too");
  assert.equal(await me(renewed), 200, "the device that changed the password stays signed in");

  // The new password works for a fresh login.
  assert.equal(await me(await login(newPassword)), 200);
});

test("M-06: un token firmado para una versión anterior (o sin claim tv) se rechaza", { skip: !integrationEnabled }, async () => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  assert.ok(user.tokenVersion > 0);
  const authUser = { id: user.id, name: user.name, email: user.email, roleId: user.roleId, isActive: true };
  assert.equal(await me(createJwtToken(authUser)), 401); // legacy tokens count as version 0
  assert.equal(await me(createJwtToken(authUser, user.tokenVersion)), 200);
});
