import assert from 'node:assert/strict';
import { test } from 'node:test';
import { errorHandler } from '../src/middleware/errorHandler';

function responseRecorder() {
  let statusCode = 200;
  let body: unknown;
  return {
    response: {
      headersSent: false,
      status(code: number) { statusCode = code; return this; },
      json(value: unknown) { body = value; return this; },
    } as any,
    result: () => ({ statusCode, body }),
  };
}

const request = { method: 'GET', path: '/api/test' } as any;
const next = () => undefined;

test('mapea errores de dominio a códigos HTTP consistentes', () => {
  for (const [name, expectedStatus] of [
    ['AuthenticationError', 401],
    ['AuthorizationError', 403],
    ['NotFoundError', 404],
    ['BusinessRuleError', 409],
  ] as const) {
    const recorder = responseRecorder();
    errorHandler(Object.assign(new Error('detalle interno'), { name }), request, recorder.response, next);
    assert.equal(recorder.result().statusCode, expectedStatus);
  }
});

test('no expone detalles internos para errores desconocidos', () => {
  const recorder = responseRecorder();
  errorHandler(new Error('password=secret SQL stack trace'), request, recorder.response, next);
  assert.deepEqual(recorder.result(), {
    statusCode: 500,
    body: { message: 'Ocurrió un error inesperado en el servidor.' },
  });
});
test('L-03: ConflictError y DuplicateError se mapean a 409 sin try/catch en el controller', async () => {
  const { ConflictError, DuplicateError } = await import('../src/utils/errors');

  const conflict = responseRecorder();
  errorHandler(new ConflictError('No se puede eliminar.'), request, conflict.response, next);
  // Same shape the inventory/supplier/user/role controllers returned before their try/catch was removed.
  assert.deepEqual(conflict.result(), { statusCode: 409, body: { error: 'CONFLICT_ERROR', message: 'No se puede eliminar.' } });

  const duplicate = responseRecorder();
  errorHandler(new DuplicateError('SUPPLIER', 'Ya existe.', 'abc-123'), request, duplicate.response, next);
  assert.deepEqual(duplicate.result(), {
    statusCode: 409,
    body: { error: 'DUPLICATE_ERROR', message: 'Ya existe.', details: { type: 'SUPPLIER', existingId: 'abc-123' } },
  });
});

test('L-10: una violación de CHECK de la BD (P2004) responde 409 en lugar de 500', async () => {
  const { Prisma } = await import('@prisma/client');
  const recorder = responseRecorder();
  const error = new Prisma.PrismaClientKnownRequestError('check violation', { code: 'P2004', clientVersion: 'test' });
  errorHandler(error, request, recorder.response, next);
  assert.equal(recorder.result().statusCode, 409);
});

test('L-02: validate() responde con el mismo formato que el handler global', async () => {
  const { z } = await import('zod');
  const { validate } = await import('../src/middleware/validate');
  const recorder = responseRecorder();
  await validate(z.object({ amount: z.number() }))({ body: { amount: 'x' } } as any, recorder.response, next);
  const { statusCode, body } = recorder.result() as { statusCode: number; body: { message: string; errors: Record<string, string[]> } };
  assert.equal(statusCode, 400);
  assert.equal(body.message, 'Error de validación.');
  assert.ok(Array.isArray(body.errors.amount), 'errors must be field errors, not a serialized string');
});
