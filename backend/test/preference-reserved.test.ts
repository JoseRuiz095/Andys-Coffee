import assert from "node:assert/strict";
import { test } from "node:test";
import { PreferenceService } from "../src/services/preference.service";
import type { AuthUser } from "../src/services/auth.service";
import { ValidationError } from "../src/utils/errors";

const admin: AuthUser = {
  id: "admin",
  name: "Admin",
  email: "admin@test.local",
  roleId: "role",
  roleName: "ADMIN",
  isActive: true,
  permissions: ["settings.manage"],
};

test("las preferencias inventory.* no se cambian por el endpoint genérico (se activan con su validación)", async () => {
  await assert.rejects(
    () => PreferenceService.updatePreference("inventory.consumeOnSale", "true", "boolean", undefined, undefined, admin),
    (error: unknown) => error instanceof ValidationError && /reservada/.test(error.message),
  );
});
