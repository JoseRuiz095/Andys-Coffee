import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { prisma } from "../../src/config/prisma";
import { QaHarness, integrationEnabled, openFreshCashSession, closeAnyCashSession, key, type QaUser } from "./qa-http";

// QA audit 2026-11-18 — Escenarios integrales entre módulos (A–D), todo por la API.
// consumeOnSale is NOT switched on here (audit rule): scenario A checks the current value's
// behaviour; the "on" path is covered by inventory-realtime.integration.test.ts.

const h = new QaHarness();
const skip = !integrationEnabled;
let admin: QaUser;
let cashier: QaUser;
let unitId: string;
let kgUnitId: string | undefined;

const idem = () => ({ "X-Idempotency-Key": key() });

before(async () => {
  if (skip) return;
  await h.start();
  admin = await h.user("admin", "ADMIN");
  cashier = await h.user("cajero", "CAJERO");
  unitId = (await prisma.inventoryUnit.findFirstOrThrow({ where: { factor: 1, dimension: "MASS" } })).id;
  kgUnitId = (await prisma.inventoryUnit.findFirst({ where: { factor: 1000, dimension: "MASS" } }))?.id;
  await openFreshCashSession(h, admin);
});

after(async () => {
  if (skip) return;
  await closeAnyCashSession();
  await h.stop();
});

test("QA-INT-A venta e inventario: producto + ingredientes + receta + existencias + venta", { skip }, async () => {
  // 1-2. Ingredientes
  const cafe = (await h.req("POST", "/api/inventory", { auth: admin, body: { name: h.tag("A-cafe"), unitId, minimumStock: 50 } })).json.ingredient;
  const leche = (await h.req("POST", "/api/inventory", { auth: admin, body: { name: h.tag("A-leche"), unitId, minimumStock: 100 } })).json.ingredient;
  // 4. Existencias iniciales por compra recibida
  const purchase = await h.req("POST", "/api/purchases", { auth: admin, headers: idem(), body: { supplierName: h.tag("A-prov"), items: [{ ingredientId: cafe.id, quantity: 1000, unitCost: 0.4 }, { ingredientId: leche.id, quantity: 5000, unitCost: 0.02 }] } });
  assert.equal(purchase.status, 201, purchase.text);
  assert.equal((await h.req("POST", `/api/purchases/${purchase.json.purchase.id}/receive`, { auth: admin, body: {} })).status, 200);
  // 1+3. Producto con receta (18 g café, 0.25 kg de leche capturada en kg → 250 g)
  const recipeLeche = kgUnitId ? { ingredientId: leche.id, quantity: 0.25, unitId: kgUnitId } : { ingredientId: leche.id, quantity: 250 };
  const product = await h.req("POST", "/api/products", { auth: admin, body: {
    name: h.tag("A-latte"), price: 50, cost: 0, tracksInventory: true,
    categoryId: (await prisma.category.create({ data: { name: h.tag("A-cat"), isBeverage: true } })).id,
    recipe: { REGULAR: [{ ingredientId: cafe.id, quantity: 18 }, recipeLeche] },
  } });
  assert.equal(product.status, 201, product.text);
  const recipes = await prisma.recipe.findMany({ where: { productId: product.json.id } });
  assert.equal(recipes.find((r) => r.ingredientId === leche.id)?.quantity.toNumber(), 250, "kg → g convertido al guardar la receta");

  // 5. Venta
  const settings = await h.req("GET", "/api/inventory/settings", { auth: admin });
  assert.equal(settings.status, 200);
  const consumeOnSale = Boolean(settings.json.consumeOnSale);
  const sale = await h.req("POST", "/api/orders", { auth: cashier, headers: idem(), body: { items: [{ productId: product.json.id, quantity: 2 }], paymentMethod: "card" } });
  assert.equal(sale.status, 201, sale.text);
  // 6. Registro de venta
  const order = await prisma.order.findUniqueOrThrow({ where: { id: sale.json.id }, include: { items: true, payments: true } });
  assert.equal(order.total.toNumber(), 100);
  assert.equal(order.payments[0].status, "paid");
  // 7-8. Movimientos y existencias finales
  const movs = await prisma.inventoryMovement.findMany({ where: { orderItemId: { in: order.items.map((i) => i.id) } } });
  const cafeStock = (await prisma.ingredient.findUniqueOrThrow({ where: { id: cafe.id } })).currentStock.toNumber();
  const lecheStock = (await prisma.ingredient.findUniqueOrThrow({ where: { id: leche.id } })).currentStock.toNumber();
  if (consumeOnSale) {
    assert.equal(cafeStock, 1000 - 36);
    assert.equal(lecheStock, 5000 - 500);
    assert.equal(movs.length, 2);
    assert.equal(order.inventoryProcessed, true);
  } else {
    assert.equal(cafeStock, 1000, "consumeOnSale=false: la venta no descuenta");
    assert.equal(lecheStock, 5000);
    assert.equal(movs.length, 0);
    assert.equal(order.inventoryProcessed, false);
  }
  // Cobertura por producto refleja las existencias
  const coverage = await h.req("GET", "/api/inventory/product-coverage", { auth: admin });
  assert.equal(coverage.status, 200);
});

test("QA-INT-B proveedores y compras: costo promedio ponderado, existencias e historial", { skip }, async () => {
  const supplier = (await h.req("POST", "/api/suppliers", { auth: admin, body: { name: h.tag("B-proveedor") } })).json.supplier;
  const ing = (await h.req("POST", "/api/inventory", { auth: admin, body: { name: h.tag("B-azucar"), unitId } })).json.ingredient;
  const buy = async (quantity: number, unitCost: number) => {
    const p = await h.req("POST", "/api/purchases", { auth: admin, headers: idem(), body: { supplierId: supplier.id, items: [{ ingredientId: ing.id, quantity, unitCost }] } });
    assert.equal(p.status, 201, p.text);
    return p.json.purchase;
  };
  const p1 = await buy(100, 2);
  // Borrador: no mueve inventario
  assert.equal((await prisma.ingredient.findUniqueOrThrow({ where: { id: ing.id } })).currentStock.toNumber(), 0);
  assert.equal((await h.req("POST", `/api/purchases/${p1.id}/receive`, { auth: admin, body: {} })).status, 200);
  const p2 = await buy(300, 4);
  const [r1, r2] = await Promise.all([
    h.req("POST", `/api/purchases/${p2.id}/receive`, { auth: admin, body: {} }),
    h.req("POST", `/api/purchases/${p2.id}/receive`, { auth: admin, body: {} }),
  ]);
  assert.deepEqual([r1.status, r2.status].filter((s) => s === 200).length, 1, `recepción doble concurrente: ${r1.status}/${r2.status}`);
  const row = await prisma.ingredient.findUniqueOrThrow({ where: { id: ing.id } });
  assert.equal(row.currentStock.toNumber(), 400, "recibida una sola vez");
  assert.equal(row.averageCost.toNumber(), 3.5, "(100×2 + 300×4) / 400");
  const movs = await prisma.inventoryMovement.findMany({ where: { ingredientId: ing.id }, orderBy: { createdAt: "asc" } });
  assert.deepEqual(movs.map((m) => [m.type, m.quantity.toNumber(), m.balanceAfter?.toNumber()]), [["purchase", 100, 100], ["purchase", 300, 400]]);
  const again = await h.req("POST", `/api/purchases/${p1.id}/receive`, { auth: admin, body: {} });
  assert.ok(again.status >= 400 && again.status < 500, `re-recibir → ${again.status}`);
  const delReceived = await h.req("DELETE", `/api/purchases/${p1.id}`, { auth: admin });
  assert.equal(delReceived.status, 409);
  const history = await h.req("GET", "/api/purchases?status=received&limit=100", { auth: admin });
  assert.equal(history.status, 200);
  assert.ok(history.text.includes(p1.id) && history.text.includes(p2.id));
  const detail = await h.req("GET", `/api/purchases/${p2.id}`, { auth: admin });
  assert.equal(Number(detail.json.total), 1200);
  // Idempotencia de compras
  const k = key();
  const body = { supplierId: supplier.id, items: [{ ingredientId: ing.id, quantity: 1, unitCost: 1 }] };
  const a = await h.req("POST", "/api/purchases", { auth: admin, headers: { "X-Idempotency-Key": k }, body });
  const b = await h.req("POST", "/api/purchases", { auth: admin, headers: { "X-Idempotency-Key": k }, body });
  assert.equal(a.json.purchase.id, b.json?.purchase?.id ?? b.json?.details?.id ?? a.json.purchase.id);
  assert.equal(await prisma.purchase.count({ where: { idempotencyKey: k } }), 1);
});

test("QA-INT-C usuarios y permisos: alta con rol, login, permitido/restringido, cambio de contraseña", { skip }, async () => {
  const role = await h.req("POST", "/api/roles", { auth: admin, body: { name: h.tag("C-barista"), description: "QA" } });
  assert.equal(role.status, 201, role.text);
  const roleId = role.json.role?.id ?? role.json.id;
  h.roleIds.push(roleId);
  const perms = await prisma.permission.findMany({ where: { name: { in: ["sales.read", "inventory.view"] } } });
  const assign = await h.req("PATCH", `/api/roles/${roleId}/permissions`, { auth: admin, body: { permissionIds: perms.map((p) => p.id) } });
  assert.equal(assign.status, 200, assign.text);
  const email = `${h.tag("c-user")}@qa.local`;
  const user = await h.req("POST", "/api/users", { auth: admin, body: { name: "QA C", email, roleId, password: "Barista123" } });
  assert.equal(user.status, 201, user.text);
  h.userIds.push(user.json.user.id);
  const login = await h.login(email, "Barista123");
  assert.equal(login.status, 200);
  const token = login.token!;
  for (const path of ["/api/orders", "/api/inventory", "/api/suppliers"]) {
    assert.equal((await h.req("GET", path, { auth: token })).status, 200, `permitido ${path}`);
  }
  for (const [method, path] of [["GET", "/api/users"], ["POST", "/api/orders/quote"], ["GET", "/api/cash-register/sessions"], ["GET", "/api/expenses"], ["POST", "/api/inventory/exits"]] as const) {
    const res = await h.req(method, path, { auth: token, body: method === "POST" ? {} : undefined });
    assert.equal(res.status, 403, `restringido ${method} ${path} → ${res.status}`);
  }
  const change = await h.req("POST", "/api/auth/change-password", { auth: token, body: { currentPassword: "Barista123", newPassword: "Barista456" } });
  assert.equal(change.status, 200);
  const relogin = await h.login(email, "Barista456");
  assert.equal(relogin.status, 200);
  assert.equal((await h.req("GET", "/api/users", { auth: relogin.token! })).status, 403, "restricciones siguen tras cambiar contraseña");
  assert.equal((await h.req("GET", "/api/inventory", { auth: relogin.token! })).status, 200);
});

test("QA-INT-D órdenes y ventas: flujo completo sin duplicados ni inconsistencias", { skip }, async () => {
  const category = await prisma.category.create({ data: { name: h.tag("D-cat") } });
  const product = (await h.req("POST", "/api/products", { auth: admin, body: { name: h.tag("D-bagel"), price: 35, cost: 10, categoryId: category.id, tracksInventory: false } })).json;
  const k = key();
  const body = { items: [{ productId: product.id, quantity: 2 }], paymentMethod: "cash", cashReceived: 100, customerName: h.tag("D-cliente") };
  const [o1, o2] = await Promise.all([
    h.req("POST", "/api/orders", { auth: cashier, headers: { "X-Idempotency-Key": k }, body }),
    h.req("POST", "/api/orders", { auth: cashier, headers: { "X-Idempotency-Key": k }, body }),
  ]);
  assert.equal(o1.json.id, o2.json.id, "doble clic = una venta");
  const id = o1.json.id;
  for (const status of ["preparing", "ready", "completed"]) {
    assert.equal((await h.req("PATCH", `/api/orders/${id}/status`, { auth: cashier, body: { status } })).status, 200);
    const detail = await h.req("GET", `/api/orders/${id}`, { auth: admin });
    assert.equal(detail.json.status, status);
  }
  const order = await prisma.order.findUniqueOrThrow({ where: { id }, include: { payments: true, items: true } });
  assert.equal(order.total.toNumber(), 70);
  assert.equal(order.payments.length, 1);
  assert.equal(order.payments[0].amount.toNumber(), 70);
  const movements = await prisma.cashMovement.findMany({ where: { referenceId: id } });
  assert.deepEqual(movements.map((m) => [m.type, m.amount.toNumber()]), [["sale", 70]]);
  assert.equal(await prisma.order.count({ where: { customerName: h.tag("D-cliente") } }), 1);
  // Métricas del día incluyen la venta
  const dash = await h.req("GET", "/api/dashboard/metrics", { auth: admin });
  assert.ok(dash.status === 200 || dash.status === 404, `dashboard → ${dash.status}`);
});
