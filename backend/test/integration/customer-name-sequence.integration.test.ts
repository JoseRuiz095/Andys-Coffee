import assert from "node:assert/strict";
import { test } from "node:test";
import { OrderRepository } from "../../src/repositories/order.repository";
import { prisma } from "../../src/config/prisma";

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "true";

test("la secuencia asigna nombres de cliente únicos bajo concurrencia", { skip: !integrationEnabled }, async () => {
  const names = await Promise.all(
    Array.from({ length: 20 }, async () => prisma.$transaction((tx) => OrderRepository.nextCustomerName(tx))),
  );
  assert.equal(new Set(names).size, names.length);
  assert.ok(names.every((name) => /^Cliente \d+$/.test(name)));
});