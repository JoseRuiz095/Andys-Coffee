import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

let server: Server;
let baseUrl: string;

before(async () => {
  process.env.JWT_SECRET = "test-secret-with-enough-entropy-123456789";
  process.env.CSRF_SECRET = "12345678901234567890123456789012";
  process.env.DATABASE_URL = "postgresql://user:password@localhost:5432/coffee?sslmode=require";
  process.env.DATABASE_SSL_CA = "test-ca";
  const { app } = await import("../src/app");
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("rechaza un origen CORS desconocido", async () => {
  const response = await fetch(`${baseUrl}/health`, { headers: { Origin: "https://evil.example" } });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { message: "This origin is not allowed." });
});

test("las mutaciones rechazan CSRF ausente o inválido", async () => {
  const response = await fetch(`${baseUrl}/api/products`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Unauthorized" }) });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { message: "CSRF token is invalid." });
});

test("las rutas sensibles exigen autenticación después de CSRF", async () => {
  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`);
  const csrfToken = (await csrfResponse.json() as { token: string }).token;
  const cookie = csrfResponse.headers.get("set-cookie");
  assert.ok(cookie);
  for (const [url, method] of [["/api/products", "POST"], ["/api/orders", "GET"]] as const) {
    const response: Response = await fetch(`${baseUrl}${url}`, {
      method,
      headers: { Cookie: cookie!, "X-CSRF-TOKEN": csrfToken, "Content-Type": "application/json" },
      body: method === "POST" ? JSON.stringify({}) : undefined,
    });
    assert.equal(response.status, 401, url);
  }
});