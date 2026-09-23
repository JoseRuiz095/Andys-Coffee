import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import { validate } from '../src/middleware/validate';
import { createExpenseSchema } from '../src/validators/expense.validator';

// N-03: createExpenseSchema had an async .refine() while validate() used a synchronous
// parse(); Zod threw "Encountered Promise during synchronous parse" and every
// POST /api/expenses answered 500.

function runValidate(schema: z.ZodType, body: unknown) {
  return new Promise<{ status?: number; body?: unknown; nextError?: unknown; parsed?: unknown }>((resolve) => {
    const req = { body } as { body: unknown };
    const res = {
      status(code: number) {
        return { json: (payload: unknown) => resolve({ status: code, body: payload }) };
      },
    };
    void validate(schema)(req as never, res as never, (error?: unknown) => resolve({ nextError: error, parsed: req.body }));
  });
}

test('N-03: validate() acepta esquemas con refinamientos asíncronos', async () => {
  const asyncSchema = z.object({ name: z.string() }).refine(async (data) => data.name !== 'prohibido', 'Nombre no permitido');

  const ok = await runValidate(asyncSchema, { name: 'válido' });
  assert.equal(ok.nextError, undefined);
  assert.deepEqual(ok.parsed, { name: 'válido' });

  const rejected = await runValidate(asyncSchema, { name: 'prohibido' });
  assert.equal(rejected.status, 400);
});

test('N-03: un gasto válido pasa por validate(createExpenseSchema)', async () => {
  const result = await runValidate(createExpenseSchema, { category: 'insumos', description: 'Leche', amount: 50, paymentMethod: 'cash' });
  assert.equal(result.nextError, undefined);
  assert.equal((result.parsed as { amount: number }).amount, 50);
});
