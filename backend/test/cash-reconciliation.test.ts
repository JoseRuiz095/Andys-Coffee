import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Prisma } from '@prisma/client';
import { expectedAmountEffect } from '../src/jobs/cashReconciliation.job';
import { reopenCashSessionSchema } from '../src/validators/cash.validator';

const d = (value: number | string) => new Prisma.Decimal(value);

/** Replays movements exactly as the services write them and returns the reconciled total. */
function reconcile(movements: Array<[type: string, amount: number]>) {
  return movements.reduce((sum, [type, amount]) => sum.plus(expectedAmountEffect(type, d(amount))), d(0));
}

test('M-03: a normal day reconciles to expectedAmount (CLOSING is ignored)', () => {
  // opening 500, cash sale 120, cash expense 30, closing counted 590
  // expectedAmount written by the services: 500 + 120 - 30 = 590
  const total = reconcile([
    ['OPENING', 500],
    ['sale', 120],
    ['expense', -30],
    ['CLOSING', 590],
  ]);
  assert.equal(total.toString(), '590');
});

test('TD-10: every movement is stored as its signed drawer effect', () => {
  // order.service: sale +80, cancellation sale_reversal -80
  // expense.service: expense 50 (-50), edited to 40 → expense_adjustment +10, deleted → expense_reversal +40
  // mandadito: delivery_collected +25, delivery_handoff -25
  const total = reconcile([
    ['OPENING', 100],
    ['sale', 80],
    ['sale_reversal', -80],
    ['expense', -50],
    ['expense_adjustment', 10],
    ['expense_reversal', 40],
    ['delivery_collected', 25],
    ['delivery_handoff', -25],
  ]);
  // 100 + 80 - 80 - 50 + 10 + 40 + 25 - 25 = 100
  assert.equal(total.toString(), '100');
});

test('M-02: reopening a cash session requires a non-empty reason', () => {
  assert.equal(reopenCashSessionSchema.safeParse({}).success, false);
  assert.equal(reopenCashSessionSchema.safeParse({ reason: '   ' }).success, false);
  assert.equal(reopenCashSessionSchema.safeParse({ reason: 'x'.repeat(121) }).success, false);
  assert.deepEqual(reopenCashSessionSchema.parse({ reason: '  Conteo mal capturado ' }), { reason: 'Conteo mal capturado' });
});
