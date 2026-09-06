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