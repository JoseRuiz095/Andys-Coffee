import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { after, before, test } from "node:test";
import { app } from "../../src/app";

// N-02: the business profile (name, hours, currency...) is shown on the login screen and to
// every role, so reading it needs no session; changing it still requires authentication.

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "true";

let server: Server;
let baseUrl: string;

before(async () => {
  if (!integrationEnabled) return;
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  if (!integrationEnabled) return;
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

test("N-02: GET /api/preferences/general es público y solo expone el perfil del negocio", { skip: !integrationEnabled }, async () => {
  const response = await fetch(`${baseUrl}/api/preferences/general`);
  assert.equal(response.status, 200);
  const { data } = (await response.json()) as { data: Record<string, unknown> };
  assert.deepEqual(
    Object.keys(data).sort(),
    ["address", "businessHoursClose", "businessHoursOpen", "businessName", "currency", "currencySymbol", "phone"],
  );
});

test("N-02: modificar preferencias y leer el resto sigue exigiendo sesión", { skip: !integrationEnabled }, async () => {
  assert.equal((await fetch(`${baseUrl}/api/preferences`)).status, 401);

  const csrf = await fetch(`${baseUrl}/api/auth/csrf`);
  const token = ((await csrf.json()) as { token: string }).token;
  const response = await fetch(`${baseUrl}/api/preferences/general`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-CSRF-TOKEN": token, Cookie: csrf.headers.get("set-cookie")!.split(";")[0] },
    body: JSON.stringify({ businessName: "Intruso" }),
  });
  assert.equal(response.status, 401);
});
