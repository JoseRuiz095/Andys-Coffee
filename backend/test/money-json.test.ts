import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "@prisma/client";
import { withMoneyAsFixed } from "../src/utils/moneyJson";

// D-07 (QA audit 2026-11-18): order money is always "200.50", like POST /orders/quote.

test("withMoneyAsFixed deja los importes con 2 decimales en orden, líneas, extras y pagos", () => {
  const D = (v: string) => new Prisma.Decimal(v);
  const order = {
    id: "o1", orderNumber: BigInt(7), total: D("200.5"), subtotal: D("200.5"), discount: D("0"),
    createdAt: new Date("2026-11-18T12:00:00Z"),
    items: [{ quantity: D("2.000"), unitPrice: D("45"), subtotal: D("90"), extras: [{ unitPrice: D("7.5"), subtotal: D("7.5") }] }],
    payments: [{ amount: D("200.5"), method: "cash" }],
    note: null,
  };
  const out = withMoneyAsFixed(order);
  assert.equal(out.total as unknown, "200.50");
  assert.equal(out.discount as unknown, "0.00");
  assert.equal(out.items[0].unitPrice as unknown, "45.00");
  assert.equal(out.items[0].extras[0].subtotal as unknown, "7.50");
  assert.equal(out.payments[0].amount as unknown, "200.50");
  // Not money: quantity keeps its precision, dates and bigints untouched.
  assert.ok(Prisma.Decimal.isDecimal(out.items[0].quantity));
  assert.ok(out.createdAt instanceof Date);
  assert.equal(out.orderNumber, BigInt(7));
  assert.equal(out.note, null);
});
