import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getDrinkTemperature } from '../src/utils/productTemperature';
import { createProductSchema } from '../src/validators/product.validator';
import { isJumboLatteProduct } from '../src/utils/productTemperature';

test('identifica temperatura solo cuando el nombre termina en una etiqueta conocida', () => {
  assert.equal(getDrinkTemperature('Latte Vainilla Frío', 'Bebidas'), 'COLD');
  assert.equal(getDrinkTemperature('Latte Vainilla frio', 'Bebidas'), 'COLD');
  assert.equal(getDrinkTemperature('Latte Vanilla Iced', 'Bebidas'), 'COLD');
  assert.equal(getDrinkTemperature('Latte Vainilla Caliente', 'Bebidas'), 'HOT');
  assert.equal(getDrinkTemperature('Americano Hot', 'Bebidas'), 'HOT');
  assert.equal(getDrinkTemperature('Latte Vainilla', 'Bebidas'), 'HOT');
  assert.equal(getDrinkTemperature('Latte Vainilla', 'Bagels'), null);
  assert.equal(getDrinkTemperature('Bagel frío', 'Bagels'), null);
  assert.equal(getDrinkTemperature('Coffee Cream', 'Bebidas'), null);
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
  assert.equal(isJumboLatteProduct('Latte Biscoff', 'Bebidas'), true);
  assert.equal(isJumboLatteProduct('Latte Jumbo', 'Bebidas'), false);
  assert.equal(isJumboLatteProduct('Bagel Jumbo', 'Bagels'), false);
});