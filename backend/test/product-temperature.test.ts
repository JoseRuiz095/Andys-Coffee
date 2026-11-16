import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getDrinkTemperature } from '../src/utils/productTemperature';
import { createProductSchema } from '../src/validators/product.validator';
import { isJumboAvailable } from '../src/utils/productTemperature';

test('respaldo por nombre: sólo para bebidas y con etiquetas conocidas', () => {
  assert.equal(getDrinkTemperature('Latte Vainilla Frío', true), 'COLD');
  assert.equal(getDrinkTemperature('Latte Vainilla frio', true), 'COLD');
  assert.equal(getDrinkTemperature('Latte Vanilla Iced', true), 'COLD');
  assert.equal(getDrinkTemperature('Latte Vainilla Caliente', true), 'HOT');
  assert.equal(getDrinkTemperature('Americano Hot', true), 'HOT');
  assert.equal(getDrinkTemperature('Latte Vainilla', true), 'HOT');
  assert.equal(getDrinkTemperature('Latte Vainilla', false), null);
  assert.equal(getDrinkTemperature('Bagel frío', false), null);
  assert.equal(getDrinkTemperature('Coffee Cream', true), null);
});

test('el esquema de producto acepta solo temperaturas HOT y COLD', () => {
  const product = { name: 'Latte', price: 60, cost: 20 };
  assert.equal(createProductSchema.safeParse({ ...product, temperature: 'HOT' }).success, true);
  assert.equal(createProductSchema.safeParse({ ...product, temperature: 'COLD' }).success, true);
  assert.equal(createProductSchema.safeParse({ ...product, temperature: 'BOTH' }).success, true);
  assert.equal(createProductSchema.safeParse({ ...product, temperature: 'WARM' }).success, false);
});

test('el producto Latte Biscoff permite configurar precio Jumbo independiente', () => {
  const product = { name: 'Latte Biscoff', price: 70, cost: 26.74 };
  assert.equal(createProductSchema.safeParse({ ...product, jumboPrice: 110 }).success, true);
  assert.equal(createProductSchema.safeParse({ ...product, jumboPrice: 0 }).success, false);
  assert.equal(isJumboAvailable({ jumboPrice: 110 }, true), true);
  assert.equal(isJumboAvailable({ jumboPrice: null }, true), false, 'sin precio Jumbo no hay tamaño Jumbo');
  assert.equal(isJumboAvailable({ jumboPrice: 110 }, false), false, 'sólo las bebidas tienen tamaño Jumbo');
});