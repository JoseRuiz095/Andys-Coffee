import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { after, before, test } from 'node:test';
import { app } from '../../src/app';
import { createJwtToken, type AuthUser } from '../../src/services/auth.service';
import { prisma } from '../../src/config/prisma';
import { getTodayInZone } from '../../src/utils/businessDate';

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === 'true';
const testId = randomUUID();
const testEmail = `daily-orders-test-${testId}@example.com`;
const testRoleName = `daily-orders-tester-${testId}`;

let server: Server;
let baseUrl: string;
let testUser: AuthUser;

async function getCsrfHeaders() {
  const response = await fetch(`${baseUrl}/api/auth/csrf`);
  assert.equal(response.status, 200);
  const token = (await response.json() as { token: string }).token;
  const setCookie = response.headers.get('set-cookie');
  assert.ok(setCookie);

  return {
    'Content-Type': 'application/json',
    Cookie: setCookie.split(';')[0],
    'X-CSRF-TOKEN': token,
  };
}

async function makeRequest(path: string, init: RequestInit = {}, user?: AuthUser) {
  const csrfHeaders = await getCsrfHeaders();
  const headers = user
    ? { ...csrfHeaders, Authorization: `Bearer ${createJwtToken(user)}` }
    : csrfHeaders;

  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...headers, ...init.headers },
  });
}

before(async () => {
  if (!integrationEnabled) return;

  server = app.listen(0);
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;

  // Create test role with necessary permissions
  const salesRead = await prisma.permission.upsert({
    where: { name: 'sales.read' },
    update: {},
    create: { name: 'sales.read' },
  });
  const role = await prisma.role.create({
    data: {
      name: testRoleName,
      permissions: { create: { permissionId: salesRead.id } },
    },
  });

  // Create test user
  const user = await prisma.user.create({
    data: {
      email: testEmail,
      passwordHash: 'unused',
      name: 'Daily Orders Tester',
      roleId: role.id,
    },
  });

  testUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    roleId: user.roleId,
    roleName: testRoleName,
    isActive: user.isActive,
    permissions: ['sales.read'],
  };
});

after(async () => {
  if (!integrationEnabled) return;

  // Cleanup
  await prisma.user.deleteMany({ where: { email: testEmail } }).catch(() => {});
  await prisma.role.deleteMany({ where: { name: testRoleName } }).catch(() => {});

  server.close();
});

test('GET /orders/by-date returns array when authenticated', { skip: !integrationEnabled }, async () => {
  const today = getTodayInZone();
  const response = await makeRequest(`/api/orders/by-date?date=${today}`, {}, testUser);

  assert.equal(response.status, 200, 'Endpoint should return 200 when authenticated');
  const orders = await response.json() as any[];
  assert.ok(Array.isArray(orders), 'Response should be an array');
});

test('GET /orders/by-date requires authentication', { skip: !integrationEnabled }, async () => {
  const today = getTodayInZone();
  const response = await makeRequest(`/api/orders/by-date?date=${today}`);

  assert.equal(response.status, 401, 'Should return 401 without authentication');
});

test('GET /orders/by-date validates date format', { skip: !integrationEnabled }, async () => {
  const invalidDate = 'invalid-date';
  const response = await makeRequest(`/api/orders/by-date?date=${invalidDate}`, {}, testUser);

  assert.equal(response.status, 400, 'Should return 400 for invalid date format');
});
