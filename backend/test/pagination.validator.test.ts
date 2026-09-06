import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterQuerySchema as productFilterQuerySchema } from '../src/validators/product.validator';
import { filterQuerySchema as orderFilterQuerySchema } from '../src/validators/order.validator';

test('normaliza paginación válida y limita el tamaño de página', () => {
  const result = productFilterQuerySchema.safeParse({ page: '2', limit: '50', search: '  latte  ' });
  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data, { page: 2, limit: 50, search: 'latte' });
  }
  assert.equal(productFilterQuerySchema.safeParse({ limit: '101' }).success, false);
});

test('rechaza paginación inválida, filtros desconocidos y búsquedas excesivas', () => {
  for (const input of [
    { page: '0' },
    { page: '-1' },
    { page: '1.5' },
    { page: '1abc' },
    { limit: '0' },
    { limit: 'NaN' },
    { unexpected: 'filter' },
    { search: 'x'.repeat(101) },
  ]) {
    assert.equal(orderFilterQuerySchema.safeParse(input).success, false);
  }
});