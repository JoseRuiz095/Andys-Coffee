import assert from "node:assert/strict";
import { test } from "node:test";
import { prisma } from "../../src/config/prisma";
import { OrderRepository } from "../../src/repositories/order.repository";
import { priceSale, type SaleItemInput } from "../../src/services/sale-pricing.service";
import { getCalendarDateAsUtc } from "../../src/utils/businessDate";

// The seeded promotions (prisma/seed.ts) priced on the day they run and on a day they don't,
// with the same catalog query and pricing function a real sale uses (OrderService.create and
// the POS quote). Business rule (2026-10-20): a quantity promotion pools every unit it covers,
// whatever line, temperature or note the cashier used.

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "true";

// Week of 2026-10-19 (Monday) in the business calendar.
const MONDAY = "2026-10-19";
const TUESDAY = "2026-10-20";
const WEDNESDAY = "2026-10-21";
const FRIDAY = "2026-10-23";

async function product(name: string) {
  return prisma.product.findFirstOrThrow({ where: { name, isActive: true }, select: { id: true, price: true } });
}

async function price(day: string, items: SaleItemInput[]) {
  const { date: businessDate, weekday } = getCalendarDateAsUtc(day);
  const catalog = await OrderRepository.loadSaleCatalog({
    productIds: items.map((item) => item.productId).filter(Boolean) as string[],
    comboIds: [],
    extraIds: [],
    businessDate,
    weekday,
  });
  return priceSale(items, catalog);
}

test("las promociones del seed están vinculadas a productos o categorías existentes", { skip: !integrationEnabled }, async () => {
  const promotions = await prisma.promotion.findMany({
    where: { isActive: true },
    select: { name: true, _count: { select: { products: true, categories: true } } },
  });
  assert.ok(promotions.length >= 3, "seed creates the three weekday promotions");
  for (const promotion of promotions) {
    assert.ok(
      promotion._count.products + promotion._count.categories > 0,
      `"${promotion.name}" is linked to nothing, so it never applies`,
    );
  }
});

test("Lunes 2x1 Latte Andy's: dos en la misma línea, uno gratis", { skip: !integrationEnabled }, async () => {
  const latte = await product("Latte Andy's");
  const result = await price(MONDAY, [{ productId: latte.id, quantity: 2, temperature: "HOT" }]);
  assert.equal(result.discount.toNumber(), latte.price.toNumber());
  assert.equal(result.total.toNumber(), latte.price.toNumber());
});

test("Lunes 2x1 Latte Andy's: uno caliente y uno frío (dos líneas) también es 2x1", { skip: !integrationEnabled }, async () => {
  const latte = await product("Latte Andy's");
  const result = await price(MONDAY, [
    { productId: latte.id, quantity: 1, temperature: "HOT" },
    { productId: latte.id, quantity: 1, temperature: "COLD", note: "Deslactosada" },
  ]);
  assert.equal(result.discount.toNumber(), latte.price.toNumber());
  assert.equal(result.total.toNumber(), latte.price.toNumber());
});

test("Lunes 2x1 Latte Andy's: tres lattes, solo uno gratis", { skip: !integrationEnabled }, async () => {
  const latte = await product("Latte Andy's");
  const result = await price(MONDAY, [{ productId: latte.id, quantity: 3, temperature: "COLD" }]);
  assert.equal(result.discount.toNumber(), latte.price.toNumber());
  assert.equal(result.total.toNumber(), latte.price.toNumber() * 2);
});

test("el 2x1 de los lunes no aplica en martes", { skip: !integrationEnabled }, async () => {
  const latte = await product("Latte Andy's");
  const result = await price(TUESDAY, [{ productId: latte.id, quantity: 2, temperature: "HOT" }]);
  assert.equal(result.discount.toNumber(), 0);
  assert.equal(result.total.toNumber(), latte.price.toNumber() * 2);
});

test("Miércoles: todos los bagels a $75 (promoción por categoría)", { skip: !integrationEnabled }, async () => {
  const bagel = await prisma.product.findFirstOrThrow({
    where: { isActive: true, category: { name: "Bagels" }, price: { gt: 75 } },
    select: { id: true, price: true },
  });
  const result = await price(WEDNESDAY, [{ productId: bagel.id, quantity: 2 }]);
  assert.equal(result.total.toNumber(), 150);
  assert.equal(result.discount.toNumber(), bagel.price.toNumber() * 2 - 150);

  const thursday = await price("2026-10-22", [{ productId: bagel.id, quantity: 2 }]);
  assert.equal(thursday.discount.toNumber(), 0);
});

test("Viernes: 2 cafés de sabor por $99, también si son de sabores distintos", { skip: !integrationEnabled }, async () => {
  const vainilla = await product("Latte Vainilla");
  const moka = await product("Latte Moka");

  const sameFlavor = await price(FRIDAY, [{ productId: vainilla.id, quantity: 2, temperature: "HOT" }]);
  assert.equal(sameFlavor.total.toNumber(), 99);

  const mixed = await price(FRIDAY, [
    { productId: vainilla.id, quantity: 1, temperature: "HOT" },
    { productId: moka.id, quantity: 1, temperature: "COLD" },
  ]);
  assert.equal(mixed.total.toNumber(), 99);
  // The discount is spread over the lines and adds up to the order discount.
  const lineDiscounts = mixed.items.reduce((sum, item) => sum + item.discount.toNumber(), 0);
  assert.equal(Math.round(lineDiscounts * 100), Math.round(mixed.discount.toNumber() * 100));

  const thursday = await price("2026-10-22", [{ productId: vainilla.id, quantity: 2, temperature: "HOT" }]);
  assert.equal(thursday.discount.toNumber(), 0);
});
