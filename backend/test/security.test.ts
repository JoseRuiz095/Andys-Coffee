import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import jwt from "jsonwebtoken";

// npm scripts run from backend/; __dirname is not available because the package is ESM.
const backendRoot = process.cwd();
const validSecret = "test-secret-with-enough-entropy-123456789";
const csrfSecret = "12345678901234567890123456789012";

function runTsx(code: string, env: NodeJS.ProcessEnv = {}) {
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    JWT_SECRET: validSecret,
    CSRF_SECRET: csrfSecret,
    DATABASE_URL: "postgresql://user:password@localhost:5432/coffee?sslmode=require",
    DATABASE_SSL_CA: "test-ca",
    ...env,
  };

  for (const [key, value] of Object.entries(childEnv)) {
    if (value === undefined) {
      delete childEnv[key];
    }
  }

  return execFileSync(process.execPath, ["--import", "tsx", "-e", code], {
    cwd: backendRoot,
    env: childEnv,
    encoding: "utf8",
  });
}

test("JWT_SECRET ausente o inseguro impide arrancar", () => {
  for (const secret of [undefined, "replace-me-with-a-long-random-string", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]) {
    assert.throws(() => runTsx("import './src/config/security.ts'", { JWT_SECRET: secret }), /JWT_SECRET/);
  }
});

test("los tokens exigen issuer, audience, algoritmo y expiración válidos", async () => {
  process.env.JWT_SECRET = validSecret;
  const { createJwtToken, verifyJwtToken } = await import("../src/services/auth.service");
  const user = { id: "user-1", name: "Test User", email: "test@example.com", roleId: "role-1", roleName: "admin", isActive: true, permissions: ["manage:products"] };
  const token = createJwtToken(user);
  assert.equal(verifyJwtToken(token).sub, user.id);
  assert.throws(() => verifyJwtToken(jwt.sign({ sub: user.id }, validSecret, { issuer: "wrong", audience: "Andys-Coffee-Client", expiresIn: "1h" })), /issuer/);
  assert.throws(() => verifyJwtToken(jwt.sign({ sub: user.id }, validSecret, { issuer: "Andys-Coffee-API", audience: "wrong", expiresIn: "1h" })), /audience/);
  assert.throws(() => verifyJwtToken(jwt.sign({ sub: user.id }, validSecret, { issuer: "Andys-Coffee-API", audience: "Andys-Coffee-Client", expiresIn: -1 })), /expired/);
});

test("rotar JWT_SECRET invalida tokens firmados con la clave anterior", async () => {
  process.env.JWT_SECRET = validSecret;
  const { createJwtToken } = await import("../src/services/auth.service");
  const token = createJwtToken({ id: "user-1", name: "Test User", email: "test@example.com", roleId: "role-1", isActive: true });
  const rotatedSecret = "rotated-secret-with-enough-entropy-123456";
  const rotatedToken = jwt.sign({ sub: "user-1" }, rotatedSecret, { issuer: "Andys-Coffee-API", audience: "Andys-Coffee-Client", expiresIn: "1h" });
  assert.throws(() => jwt.verify(token, rotatedSecret));
  assert.doesNotThrow(() => jwt.verify(rotatedToken, rotatedSecret));
});

test("la configuración de Prisma rechaza sslmode inseguro y exige CA", () => {
  assert.throws(() => runTsx("import './src/config/prisma.ts'", { DATABASE_URL: "postgresql://user:password@localhost:5432/coffee?sslmode=disable" }), /Database connection must use SSL/);
  assert.throws(() => runTsx("import './src/config/prisma.ts'", { DATABASE_URL: "postgresql://user:password@localhost:5432/coffee?sslmode=require", DATABASE_SSL_CA: undefined, DATABASE_SSL_CA_PATH: "missing-ca.crt" }), /ENOENT/);
  const caPath = resolve(backendRoot, "certs", "prod-ca-2021.crt");
  assert.ok(readFileSync(caPath, "utf8").length > 0);
  assert.doesNotThrow(() => runTsx("import './src/config/prisma.ts'", { DATABASE_URL: "postgresql://user:password@localhost:5432/coffee?sslmode=verify-full", DATABASE_SSL_CA_PATH: "certs/prod-ca-2021.crt" }));
});