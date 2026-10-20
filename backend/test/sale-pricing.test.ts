import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Prisma, PromotionType } from '@prisma/client';
import { priceSale, type SaleCatalog } from '../src/services/sale-pricing.service';

// priceSale is the single pricing function behind POST /orders and POST /orders/quote: the
// POS total and the charged total come from here, so its rules are pinned down without a DB.

const money = (value: number) => new Prisma.Decimal(value);
const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_PRODUCT_ID = '22222222-2222-4222-8222-222222222222';
const COMBO_ID = '33333333-3333-4333-8333-333333333333';
const EXTRA_ID = '44444444-4444-4444-8444-444444444444';
const CATEGORY_ID = '55555555-5555-4555-8555-555555555555';

function catalog(overrides: Partial<SaleCatalog> = {}): SaleCatalog {
  return {
    products: [
      { id: PRODUCT_ID, name: 'Bagel', temperature: null, jumboPrice: null, categoryId: CATEGORY_ID, category: { name: 'Bagels' }, price: money(50), cost: money(20) },
      { id: OTHER_PRODUCT_ID, name: 'Latte Vainilla', temperature: 'BOTH', jumboPrice: money(70), categoryId: null, category: { name: 'Bebidas' }, price: money(60), cost: money(15) },
    ],
    combos: [{
      id: COMBO_ID,
      name: 'Desayuno',
      price: money(100),
      items: [
        { productId: PRODUCT_ID, quantity: money(1), product: { id: PRODUCT_ID, name: 'Bagel', cost: money(20), isActive: true } },
        { productId: OTHER_PRODUCT_ID, quantity: money(2), product: { id: OTHER_PRODUCT_ID, name: 'Latte Vainilla', cost: money(15), isActive: true } },
      ],
    }],
    extras: [{ id: EXTRA_ID, name: 'Queso', price: money(10), cost: money(4) }],
    productExtras: [{ productId: PRODUCT_ID, extraId: EXTRA_ID, isDefault: false, createdAt: new Date() }],
    promotions: [],
    ...overrides,
  } as unknown as SaleCatalog;
}

const bogo = {
  id: 'bogo',
  type: PromotionType.BOGO,
  discountValue: money(100),
  buyQuantity: 1,
  getQuantity: 1,
  products: [{ productId: PRODUCT_ID }],
  categories: [],
};

test('aplica la promoción por cantidad y la refleja en la línea y en el total', () => {
  const result = priceSale([{ productId: PRODUCT_ID, quantity: 2 }], catalog({ promotions: [bogo] } as Partial<SaleCatalog>));

  assert.equal(result.subtotal.toNumber(), 100);
  assert.equal(result.discount.toNumber(), 50);
  assert.equal(result.total.toNumber(), 50);
  assert.equal(result.items[0].net.toNumber(), 50);
  const [line] = result.items[0].lines;
  assert.equal(line.discount.toNumber(), 50);
  assert.equal(line.subtotal.toNumber(), 50, 'the line amount is net of its discount');
  assert.equal(result.totalCost.toNumber(), 40);
});

test('los extras suman al total y a su costo, pero no reciben descuento', () => {
  const result = priceSale(
    [{ productId: PRODUCT_ID, quantity: 1, extras: [{ extraId: EXTRA_ID, quantity: 2 }] }],
    catalog(),
  );

  assert.equal(result.total.toNumber(), 70);
  assert.equal(result.items[0].gross.toNumber(), 70);
  assert.equal(result.items[0].lines[0].subtotal.toNumber(), 50, 'extras are priced on their own rows');
  assert.equal(result.items[0].lines[0].extras[0].subtotal.toNumber(), 20);
  assert.equal(result.totalCost.toNumber(), 28);
});

test('un combo se reparte entre sus productos y sus líneas suman su precio', () => {
  const result = priceSale([{ comboId: COMBO_ID, quantity: 3 }], catalog());

  assert.equal(result.total.toNumber(), 300);
  const lines = result.items[0].lines;
  assert.equal(lines.length, 2);
  assert.equal(lines.reduce((sum, line) => sum + line.subtotal.toNumber(), 0), 300);
  assert.equal(lines[1].quantity.toNumber(), 6);
  assert.equal(result.discount.toNumber(), 0);
});

test('Jumbo usa su precio y la temperatura es obligatoria en bebidas que admiten ambas', () => {
  const jumbo = priceSale([{ productId: OTHER_PRODUCT_ID, quantity: 1, size: 'JUMBO', temperature: 'COLD' }], catalog());
  assert.equal(jumbo.total.toNumber(), 70);
  assert.equal(jumbo.items[0].lines[0].productName, 'Latte Vainilla Jumbo');
  assert.equal(jumbo.items[0].lines[0].temperature, 'COLD');

  assert.throws(() => priceSale([{ productId: OTHER_PRODUCT_ID, quantity: 1 }], catalog()), { name: 'ValidationError' });
  assert.throws(() => priceSale([{ productId: PRODUCT_ID, quantity: 1, size: 'JUMBO' }], catalog()), { name: 'ValidationError' });
});

test('rechaza productos fuera del catálogo y extras que no pertenecen al producto', () => {
  assert.throws(
    () => priceSale([{ productId: PRODUCT_ID, quantity: 1 }], catalog({ products: [] } as Partial<SaleCatalog>)),
    { name: 'ValidationError' },
  );
  assert.throws(
    () => priceSale([{ productId: OTHER_PRODUCT_ID, quantity: 1, temperature: 'HOT', extras: [{ extraId: EXTRA_ID, quantity: 1 }] }], catalog()),
    { name: 'ValidationError' },
  );
});

test('el extra es por unidad: dos productos con "2 de queso" llevan cuatro', () => {
  const result = priceSale(
    [{ productId: PRODUCT_ID, quantity: 2, extras: [{ extraId: EXTRA_ID, quantity: 2 }] }],
    catalog(),
  );

  const [extra] = result.items[0].lines[0].extras;
  assert.equal(extra.quantity, 4);
  assert.equal(extra.subtotal.toNumber(), 40);
  assert.equal(result.total.toNumber(), 100 + 40);
  assert.equal(result.totalCost.toNumber(), 40 + 16);
});
