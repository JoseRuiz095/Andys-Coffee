import assert from "node:assert/strict";
import { test } from "node:test";
import { DeliveryResponsible, ExpenseCategory } from "@prisma/client";
import { expenseCategories } from "../src/validators/expense.validator";
import { deliveryResponsibleSchema } from "../src/validators/order.validator";

// The database enums (migration 20260923100000_enums_and_expense_fk) and the API validators
// must accept exactly the same values: a value the validator lets through but the enum
// rejects would turn into a 500 instead of a 400.
test("las categorías de gasto del validador coinciden con el enum de la BD", () => {
  assert.deepEqual([...expenseCategories].sort(), Object.values(ExpenseCategory).sort());
});

test("los responsables del mandadito del validador coinciden con el enum de la BD", () => {
  assert.deepEqual([...deliveryResponsibleSchema.options].sort(), Object.values(DeliveryResponsible).sort());
});
