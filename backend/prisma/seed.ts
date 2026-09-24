import { prisma } from "../src/config/prisma";
import { PromotionType } from "@prisma/client";
import bcrypt from "bcrypt";
import { readCatalogExport, seedCatalogFromExport } from "./seed-catalog";
import dotenv from 'dotenv';

// Cargar variables de entorno desde el archivo .env
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;

if (!SUPABASE_URL) {
  throw new Error("La variable de entorno SUPABASE_URL no está definida.");
}

// URL de la imagen por defecto que debe estar en tu bucket de Supabase
const DEFAULT_IMAGE_URL = `Menu/LogoAndysVector.svg`;

// ============================================================
// CATEGORÍAS
// ============================================================

const categories = [
  {
    name: "Bebidas",
    description: "Café, té y otras bebidas calientes y frías.",
    displayOrder: 1,
  },
  {
    name: "Bagels",
    description: "Bagels artesanales con diferentes rellenos.",
    displayOrder: 2,
  },
  {
    name: "Desayunos",
    description: "Platillos completos para empezar el día.",
    displayOrder: 3,
  },
  {
    name: "Combos",
    description: "Paquetes especiales.",
    displayOrder: 4,
  },
  {
    name: "Otros",
    description: "Productos adicionales y de temporada.",
    displayOrder: 5,
  },
];

interface SeedProduct {
  sku: string;
  name: string;
  description: string;
  price: number;
  cost: number;
  category: string;
  displayOrder: number;
  imageUrl?: string;
}

// ============================================================
// PRODUCTOS
// ============================================================

const products: SeedProduct[] = [
  // =========================
  // BEBIDAS
  // =========================

  {
    sku: "BEV-001",
    name: "Espresso",
    description: "Café solo, intenso y aromático.",
    price: 25,
    cost: 14,
    category: "Bebidas",
    displayOrder: 1,
    imageUrl: `Menu/espresso.png`, // Asegúrate de que esta imagen exista en tu bucket
  },
  {
    sku: "BEV-002",
    name: "Latte regular",
    description: "Espresso con leche deslactosada y una fina capa de espuma.",
    price: 55,
    cost: 15.23,
    category: "Bebidas",
    displayOrder: 2,
    imageUrl: `Menu/Andys.png`, // Asegúrate de que esta imagen exista en tu bucket
  },
  {
    sku: "BEV-003",
    name: "Latte Vainilla",
    description: "Latte endulzado con jarabe de vainilla.",
    price: 65,
    cost: 22.88,
    category: "Bebidas",
    displayOrder: 3,
  },
  {
    sku: "BEV-004",
    name: "Latte Caramel Macciato",
    description: "Espresso, leche deslactosada , vainilla y un toque de caramelo.",
    price: 65,
    cost: 19.95,
    category: "Bebidas",
    displayOrder: 4,
    imageUrl: `Menu/Caramelo.png`
  },
  {
    sku: "BEV-005",
    name: "Latte Moka",
    description: "La combinación perfecta de espresso, chocolate y leche.",
    price: 65,
    cost: 18.69,
    category: "Bebidas",
    displayOrder: 5,
  },
  {
    sku: "BEV-006",
    name: "Latte Biscoff",
    description: "Un delicioso latte con el sabor único de la galleta Biscoff.",
    price: 70,
    cost: 26.74,
    category: "Bebidas",
    displayOrder: 6,
    imageUrl: `Menu/Biscoff.png`
  },
  {
    sku: "BEV-007",
    name: "Latte Andy's",
    description: "La especialidad de la casa, un secreto delicioso.",
    price: 65,
    cost: 21.83,
    category: "Bebidas",
    displayOrder: 7,
    imageUrl: `Menu/Andys.png`
  },
  {
    sku: "BEV-008",
    name: "Americano",
    description:
      "Espresso diluido con agua caliente, suave pero con carácter.",
    price: 45,
    cost: 10.57,
    category: "Bebidas",
    displayOrder: 8,
  },
  {
    sku: "BEV-009",
    name: "Chai Guayaba",
    description:
      "Te Chai sabor guayaba con leche.",
    price: 70,
    cost: 22.37,
    category: "Bebidas",
    displayOrder: 9,
  },
  {
    sku: "BEV-010",
    name: "Chai-Vainilla",
    description:
      "Te Chai sabor Vainilla con leche.",
    price: 70,
    cost: 40.08,
    category: "Bebidas",
    displayOrder: 10,
  },
  {
    sku: "BEV-011",
    name: "Latte regular Frio",
    description:
      "Nuestro clásico latte, pero refrescante y con hielo.",
    price: 55,
    cost: 13.27,
    category: "Bebidas",
    displayOrder: 11,
  },
  {
    sku: "BEV-012",
    name: "Latte Vainilla Frio",
    description: "La dulzura de la vainilla en un latte helado.",
    price: 65,
    cost: 20.92,
    category: "Bebidas",
    displayOrder: 12,
  },
  {
    sku: "BEV-013",
    name: "Latte Caramel Macciato Frio",
    description:
      "La versión helada de nuestro popular Caramel Macchiato.",
    price: 65,
    cost: 20.26,
    category: "Bebidas",
    displayOrder: 13,
    imageUrl: `Menu/Caramelo.png`
  },
  {
    sku: "BEV-014",
    name: "Latte Biscoff Frio",
    description:
      "Galleta Biscoff y café en una bebida fría irresistible.",
    price: 70,
    cost: 27.04,
    category: "Bebidas",
    displayOrder: 14,
    imageUrl: `Menu/Biscoff.png`
  },
  {
    sku: "BEV-015",
    name: "Latte Moka Frio",
    description:
      "Chocolate y café en una refrescante bebida helada.",
    price: 65,
    cost: 16.73,
    category: "Bebidas",
    displayOrder: 15,
  },
  {
    sku: "BEV-016",
    name: "Latte Andy's Frio",
    description:
      "Nuestra especialidad secreta, ahora en versión fría.",
    price: 65,
    cost: 19.41,
    category: "Bebidas",
    displayOrder: 16,

  },
  {
    sku: "BEV-017",
    name: "Americano Iced",
    description: "Un americano clásico servido con hielo.",
    price: 45,
    cost: 10.80,
    category: "Bebidas",
    displayOrder: 17,
  },
  {
    sku: "BEV-018",
    name: "Coffee Cream",
    description: "Bebida cremosa de café, suave y deliciosa.",
    price: 45,
    cost: 16.19,
    category: "Bebidas",
    displayOrder: 18,
    imageUrl: `Menu/CoffeeCream.png`
  },
  {
    sku: "BEV-019",
    name: "Chai vainilla frio",
    description:
      "Té chai con un toque de vainilla, servido frío.",
    price: 70,
    cost: 36.26,
    category: "Bebidas",
    displayOrder: 19,
  },
  {
    sku: "BEV-020",
    name: "Chai Guayaba Frio",
    description:
      "Té chai especiado con leche y un toque de vainilla.",
    price: 70,
    cost: 18.54,
    category: "Bebidas",
    displayOrder: 20,
  },
  {
    sku: "BEV-021",
    name: "Limonada",
    description: "Refrescante limonada natural.",
    price: 50,
    cost: 11.27,
    category: "Bebidas",
    displayOrder: 21,
    imageUrl: `Menu/Limonada.png`
  },
  {
    sku: "BEV-022",
    name: "Bloom",
    description:
      "Bebida floral y refrescante, especialidad de la casa.",
    price: 45,
    cost: 19.41,
    category: "Bebidas",
    displayOrder: 22,
    imageUrl: `Menu/Bloom.png`
  },
  {
    sku: "BEV-023",
    name: "Taro",
    description:
      "Bebida refrescante sabor Taro.",
    price: 60,
    cost: 13.25, // Revisar costos
    category: "Bebidas",
    displayOrder: 23,
    imageUrl: `Menu/Taro.png`
  },
    {
    sku: "BEV-024",
    name: "Taro Frio",
    description:
      "Bebida refrescante sabor Taro fria.",
    price: 60,
    cost: 13.25, // Revisar costos
    category: "Bebidas",
    displayOrder: 24,
    imageUrl: `Menu/TaroFrio.png`
  },


  // =========================
  // BAGELS
  // =========================

  {
    sku: "BAG-001",
    name: "Bagel campirano",
    description:
      "Pan Bagel con huevo, tocino, jamon, con una seleccion de quesos deliciosos.",
    price: 85,
    cost: 34.75,
    category: "Bagels",
    displayOrder: 1,
    imageUrl: `Menu/Campirano.png`
  },
  {
    sku: "BAG-002",
    name: "Bagel de pollo",
    description:
      "Delicioso bagel relleno de pollo y verdura fresca.",
    price: 90,
    cost: 35.58,
    category: "Bagels",
    displayOrder: 2,
    imageUrl: `Menu/Pollo.png`
  },
  {
    sku: "BAG-003",
    name: "Bagel americano",
    description:
      "El clásico bagel con huevo y queso amarillo y oaxaca.",
    price: 80,
    cost: 28.88,
    category: "Bagels",
    displayOrder: 3,
  },
  {
    sku: "BAG-004",
    name: "Bagel carnivoro",
    description:
      "Para los amantes de la carne tipo arrachera y quesos.",
    price: 95,
    cost: 37.91,
    category: "Bagels",
    displayOrder: 4,
    imageUrl: `Menu/Carnivoro.png`
  },


  // =========================
  // DESAYUNOS
  // =========================

  {
    sku: "DES-001",
    name: "Chilaquiles naturales rojos",
    description:
      "Totopos bañados en salsa roja, con crema y queso.",
    price: 80,
    cost: 25.50,
    category: "Desayunos",
    displayOrder: 1,
  },
  {
    sku: "DES-002",
    name: "Chilaquiles naturales verdes",
    description:
      "Totopos bañados en salsa verde, con crema y queso.",
    price: 80,
    cost: 25.51,
    category: "Desayunos",
    displayOrder: 2,
  },
  {
    sku: "DES-003",
    name: "Chilaquiles pollo rojos",
    description:
      "Chilaquiles rojos con pollo deshebrado.",
    price: 90,
    cost: 32.70,
    category: "Desayunos",
    displayOrder: 3,
  },
  {
    sku: "DES-004",
    name: "Chilaquiles pollo verdes",
    description:
      "Chilaquiles verdes con pollo deshebrado.",
    price: 90,
    cost: 32.71,
    category: "Desayunos",
    displayOrder: 4,
  },
  {
    sku: "DES-005",
    name: "Chilaquiles huevo rojos",
    description:
      "Chilaquiles rojos acompañados de huevo estrellado o revuelto.",
    price: 90,
    cost: 28.55,
    category: "Desayunos",
    displayOrder: 5,
  },
  {
    sku: "DES-006",
    name: "Chilaquiles huevo verdes",
    description:
      "Chilaquiles verdes acompañados de huevo estrellado o revuelto.",
    price: 90,
    cost: 28.55,
    category: "Desayunos",
    displayOrder: 6,
  },
  {
    sku: "DES-007",
    name: "Chilaquiles arrachera rojos",
    description:
      "Chilaquiles rojos con jugosa arrachera.",
    price: 100,
    cost: 34.63,
    category: "Desayunos",
    displayOrder: 7,
  },
  {
    sku: "DES-008",
    name: "Chilaquiles arrachera verdes",
    description:
      "Chilaquiles verdes con jugosa arrachera.",
    price: 100,
    cost: 34.65,
    category: "Desayunos",
    displayOrder: 8,
  },
  {
    sku: "DES-009",
    name: "Canadiense",
    description:
      "Desayuno completo estilo canadiense.",
    price: 110,
    cost: 33.94,
    category: "Desayunos",
    displayOrder: 9,
    imageUrl: `Menu/Canadiense.png`
  },
  {
    sku: "DES-010",
    name: "Viajero",
    description:
      "Un desayuno práctico y delicioso para llevar.",
    price: 90,
    cost: 28.29,
    category: "Desayunos",
    displayOrder: 10,
    imageUrl: `Menu/Viajero.png`
  },
  {
    sku: "DES-011",
    name: "Duo continental",
    description:
      "Desayuno ligero con huevo al gusto, ensalada, pan frances.",
    price: 85,
    cost: 32.87,
    category: "Desayunos",
    displayOrder: 11,
    imageUrl: `Menu/Continental.png`
  },

  // ============================================================
  // Otros
  // ============================================================
  {
    sku: "OTR-001",
    name: "Croissant",
    description:
      "Un delicioso pan estilo croissant.",
    price: 28,
    cost: 22,
    category: "Otros",
    displayOrder: 1,
  },
  {
    sku: "OTR-002",
    name: "Croissant salado",
    description:
      "Un croissant relleno de jamón y queso.",
    price: 65,
    cost: 27.3,
    category: "Otros",
    displayOrder: 2,
  },
  {
    sku: "OTR-003",
    name: "Mini bagel philadelphia",
    description:
      "Pequeño bagel con queso crema Philadelphia.",
    price: 28,
    cost: 13.47,
    category: "Otros",
    displayOrder: 5,
    imageUrl: `Menu/MiniPhila.png`
  },
    {
    sku: "OTR-004",
    name: "Papa Hashbrown",
    description:
      "Pieza de papa hashbrown",
    price: 12,
    cost: 6.25,
    category: "Otros",
    displayOrder: 5,
    imageUrl: `Menu/Hash.png`
  },
];

// ============================================================
// ROLES
// ============================================================

const roles = [
  {
    name: "ADMIN",
    description: "Administrador del sistema",
    isSystem: true,
  },
  {
    name: "CAJERO",
    description: "Usuario encargado de caja y ventas",
    isSystem: true,
  },
];

// ============================================================
// PERMISOS
// ============================================================

const permissions = [
  { name: "users.read", description: "Consultar usuarios" },
  { name: "users.create", description: "Crear usuarios" },
  { name: "users.update", description: "Actualizar usuarios" },
  { name: "users.delete", description: "Eliminar usuarios" },
  { name: "roles.manage_system_permissions", description: "Gestionar permisos de roles del sistema" },
  { name: "products.read", description: "Consultar productos" },
  { name: "products.create", description: "Crear productos" },
  { name: "products.update", description: "Actualizar productos" },
  { name: "products.delete", description: "Eliminar productos" },
  { name: "categories.create", description: "Crear categorías" },
  { name: "categories.update", description: "Actualizar categorías" },
  { name: "sales.read", description: "Consultar ventas" },
  { name: "sales.create", description: "Crear ventas" },
  { name: "sales.update", description: "Editar datos informativos de ventas" },
  { name: "sales.cancel", description: "Cancelar ventas" },
  { name: "cash.open", description: "Abrir caja" },
  { name: "cash.close", description: "Cerrar caja" },
  { name: "cash.correct", description: "Corregir un cierre de caja" },
  { name: "cash.read", description: "Consultar historial de cortes de caja" },
  { name: "dashboard.read", description: "Consultar dashboard y métricas" },
  { name: "expenses.read", description: "Consultar gastos" },
  { name: "expenses.create", description: "Registrar gastos" },
  { name: "expenses.update", description: "Actualizar gastos" },
  { name: "expenses.delete", description: "Eliminar gastos" },
  { name: "reports.read", description: "Consultar reportes" },
  { name: "inventory.view", description: "Ver inventario" },
  { name: "inventory.create_entry", description: "Registrar entradas de inventario" },
  { name: "inventory.create_exit", description: "Registrar salidas de inventario" },
  { name: "inventory.adjust", description: "Ajustar inventario" },
  { name: "inventory.physical_count", description: "Realizar conteos físicos" },
  { name: "inventory.create_ingredient", description: "Crear y editar ingredientes" },
  { name: "inventory.manage_suppliers", description: "Gestionar proveedores" },
  { name: "inventory.delete_ingredient", description: "Eliminar ingredientes" },
  { name: "inventory.delete_supplier", description: "Eliminar proveedores" },
];

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log("========================================");
  console.log("   ANDY'S COFFEE - INICIANDO SEED");
  console.log("========================================");

  // ==========================================================
  // ROLES
  // ==========================================================

  console.log("\nCreando roles...");
  const roleMap = new Map<string, string>();
  for (const role of roles) {
    const result = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description, isSystem: role.isSystem },
      create: role,
    });
    roleMap.set(role.name, result.id);
  }
  const adminRoleId = roleMap.get("ADMIN");
  const cashierRoleId = roleMap.get("CAJERO");
  if (!adminRoleId || !cashierRoleId) {
    throw new Error("No se pudieron crear los roles.");
  }

  // ==========================================================
  // PERMISOS
  // ==========================================================

  console.log("Creando permisos...");
  await prisma.permission.createMany({
    data: permissions,
    skipDuplicates: true,
  });
  const allPermissions = await prisma.permission.findMany();

  // ==========================================================
  // ASIGNACIÓN DE PERMISOS
  // ==========================================================

  console.log("Asignando permisos a roles...");
  // Additive only: re-running the seed must not wipe permissions an admin customized.
  await prisma.rolePermission.createMany({
    data: allPermissions.map((p) => ({ roleId: adminRoleId, permissionId: p.id })),
    skipDuplicates: true,
  });

  const cashierPermissionNames = ["products.read", "sales.read", "sales.create", "cash.open", "cash.close", "cash.read", "inventory.view"];
  const cashierPermissions = allPermissions.filter((p) => cashierPermissionNames.includes(p.name));
  await prisma.rolePermission.createMany({
    data: cashierPermissions.map((p) => ({ roleId: cashierRoleId, permissionId: p.id })),
    skipDuplicates: true,
  });

  // ==========================================================
  // USUARIO ADMINISTRADOR
  // ==========================================================

  console.log("Creando usuario administrador...");
  if (!process.env.ADMIN_SEED_PASSWORD && process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_SEED_PASSWORD es obligatorio para ejecutar el seed en producción.");
  }
  const adminPassword = process.env.ADMIN_SEED_PASSWORD || "CambiarEstaPassword123!";
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  // The password is only set when the admin is first created; re-seeding never resets it.
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@andyscoffee.local" },
    update: { roleId: adminRoleId },
    create: {
      name: "Administrador",
      email: "admin@andyscoffee.local",
      passwordHash,
      roleId: adminRoleId,
    },
  });

  // ==========================================================
  // CATÁLOGO
  // ==========================================================
  // prisma/seed-data/catalog.json (scripts/export-catalog.ts) holds the real catalog;
  // without it (e.g. the Docker test database) the built-in sample catalog is loaded.
  const catalog = readCatalogExport();
  if (catalog) {
    await seedCatalogFromExport(catalog, adminUser.id);
  } else {
    await seedSampleCatalog();
  }

  // ==========================================================
  // PREFERENCIAS: DISTRIBUCIÓN DEL ESTADO DE RESULTADOS
  // ==========================================================
  // Idempotente (update: {}) para no pisar valores ya configurados por un admin.

  const distributionPreferences = [
    {
      key: "income_statement.distribution.savings_percent",
      value: "10",
      type: "number",
      label: "Ahorro (%)",
      description: "Porcentaje de la ganancia neta diaria destinado a Ahorro.",
    },
    {
      key: "income_statement.distribution.business_fund_percent",
      value: "20",
      type: "number",
      label: "Fondo del Negocio (%)",
      description: "Porcentaje de la ganancia neta diaria destinado al Fondo del Negocio.",
    },
    {
      key: "income_statement.distribution.supplies_percent",
      value: "70",
      type: "number",
      label: "Surtido (%)",
      description: "Porcentaje de la ganancia neta diaria destinado a Surtido.",
    },
  ];

  for (const pref of distributionPreferences) {
    await prisma.systemPreference.upsert({
      where: { key: pref.key },
      update: {},
      create: pref,
    });
  }

  // ==========================================================
  // RESUMEN
  // ==========================================================

  const counts = await prisma.$transaction([
    prisma.category.count(),
    prisma.product.count(),
    prisma.combo.count(),
    prisma.promotion.count(),
    prisma.role.count(),
    prisma.permission.count(),
    prisma.inventoryUnit.count(),
  ]);

  console.log("\n========================================");
  console.log("       SEED EJECUTADO CORRECTAMENTE");
  console.log("========================================");
  console.log(`Categorías:      ${counts[0]}`);
  console.log(`Productos:       ${counts[1]}`);
  console.log(`Combos:          ${counts[2]}`);
  console.log(`Promociones:     ${counts[3]}`);
  console.log(`Roles:           ${counts[4]}`);
  console.log(`Permisos:        ${counts[5]}`);
  console.log(`Unidades:        ${counts[6]}`);
  console.log("========================================");
}

// ============================================================
// CATÁLOGO DE EJEMPLO (sin prisma/seed-data/catalog.json)
// ============================================================

async function seedSampleCatalog() {
  // ==========================================================
  // CATEGORÍAS
  // ==========================================================

  console.log("Creando categorías...");
  const categoryMap = new Map<string, string>();
  for (const category of categories) {
    const dbCategory = await prisma.category.upsert({
      where: { name: category.name },
      update: category,
      create: category,
    });
    categoryMap.set(category.name, dbCategory.id);
  }

  // ==========================================================
  // PRODUCTOS
  // ==========================================================

  console.log(`Creando ${products.length} productos...`);
  for (const product of products) {
    const categoryId = categoryMap.get(product.category);
    if (!categoryId) {
      throw new Error(`No se encontró la categoría "${product.category}" para "${product.name}".`);
    }
    const imageUrl = product.imageUrl || DEFAULT_IMAGE_URL;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { category, ...productData } = product;
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: { ...productData, categoryId, imageUrl, isActive: true },
      create: { ...productData, categoryId, imageUrl, isActive: true },
    });
  }

  // ==========================================================
  // COMBOS
  // ==========================================================
  console.log("Creando combos...");

  const comboDefinitions = [
    {
      name: "Combo Matutino",
      description: "Un latte regular + croissant clasico.",
      price: 110,
      category: "Combos",
      imageUrl: "Menu/ComboMatutino.png",
      activeOnDays: [], // Disponible todos los días
      items: [
        { sku: "BEV-011", quantity: 1 },
        { sku: "OTR-002", quantity: 1 },
      ],
    },
    {
      name: "Combo de la casa",
      description: "Un bagel carnivoro + latte andy's.",
      price: 145,
      category: "Combos",
      imageUrl: "Menu/ComboCasa.png",
      activeOnDays: [], // Disponible todos los días
      items: [
        { sku: "BAG-004", quantity: 1 },
        { sku: "BEV-016", quantity: 1 },
      ],
    },
    {
      name: "Promo Jueves: 2 Viajeros por $170",
      description: "Llévate dos desayunos viajeros por solo 170 pesos.",
      price: 170,
      category: "Combos",
      imageUrl: "Menu/Viajero.png",
      activeOnDays: [4], // Jueves
      items: [{ sku: "DES-010", quantity: 2 }],
    },
  ];

  for (const comboDef of comboDefinitions) {
    const categoryId = categoryMap.get(comboDef.category);
    if (!categoryId) throw new Error(`Categoría "${comboDef.category}" no encontrada.`);

    let totalCost = 0;
    const comboItemsData = [];
    for (const itemDef of comboDef.items) {
      const product = await prisma.product.findUnique({ where: { sku: itemDef.sku } });
      if (!product) throw new Error(`Producto con SKU "${itemDef.sku}" no encontrado.`);
      totalCost += Number(product.cost) * itemDef.quantity;
      comboItemsData.push({ productId: product.id, quantity: itemDef.quantity });
    }

    const comboData = {
      name: comboDef.name,
      description: comboDef.description,
      price: comboDef.price,
      cost: totalCost,
      imageUrl: comboDef.imageUrl,
      isActive: true,
      activeOnDays: comboDef.activeOnDays,
    };
    
    await prisma.combo.upsert({
      where: { name: comboDef.name },
      update: { 
        ...comboData,
        category: { connect: { id: categoryId } },
        items: { deleteMany: {}, create: comboItemsData } 
      },
      create: { 
        ...comboData,
        category: { connect: { id: categoryId } },
        items: { create: comboItemsData }
      },
    });
  }

  // ==========================================================
  // PROMOCIONES
  // ==========================================================
  console.log("Creando promociones...");
  // Note: PromotionOnProduct y PromotionOnCategory fueron eliminadas
  // Las promociones ahora se crean sin relaciones directas a productos/categorías
  await prisma.promotion.deleteMany({});

  const promotionDefinitions = [
    {
      name: "Promo Lunes: Latte Andy's 2x1",
      description: "Disfruta de dos Lattes Andy's (caliente o frío) al precio de uno.",
      type: PromotionType.BOGO,
      discountValue: 100, // 100% de descuento en el segundo
      buyQuantity: 1,
      getQuantity: 1,
      activeOnDays: [1], // Lunes
      productNames: ["Latte Andy's", "Latte Andy's Frio"],
      categoryNames: [] as string[],
    },
    {
      name: "Promo Miércoles: Día del Bagel",
      description: "Todos los bagels a solo $75.",
      type: PromotionType.FIXED_PRICE,
      discountValue: 75,
      activeOnDays: [3], // Miércoles
      productNames: [] as string[],
      categoryNames: ["Bagels"],
    },
    {
      name: "Promo Viernes: 2 Cafés de Sabor por $99",
      description: "Disfruta de dos cafés de sabor (calientes o fríos) por un precio especial.",
      type: PromotionType.MULTIBUY_FIXED_PRICE,
      discountValue: 99,
      buyQuantity: 2,
      activeOnDays: [5], // Viernes
      productNames: [
        "Latte Vainilla", "Latte Caramel Macciato", "Latte Moka", "Latte Biscoff",
        "Latte Vainilla Frio", "Latte Caramel Macciato Frio", "Latte Biscoff Frio", "Latte Moka Frio",
      ],
      categoryNames: [] as string[],
    },
  ];

  for (const promoDef of promotionDefinitions) {
    const promoData = {
      name: promoDef.name,
      description: promoDef.description,
      type: promoDef.type,
      discountValue: promoDef.discountValue,
      buyQuantity: promoDef.buyQuantity,
      getQuantity: promoDef.getQuantity,
      activeOnDays: promoDef.activeOnDays,
      startDate: new Date("2024-01-01"),
      endDate: new Date("2099-12-31"),
      isActive: true,
    };

    // A promotion only applies to the products/categories it is linked to (N-01).
    const [linkedProducts, linkedCategories] = await Promise.all([
      prisma.product.findMany({ where: { name: { in: promoDef.productNames } }, select: { id: true } }),
      prisma.category.findMany({ where: { name: { in: promoDef.categoryNames } }, select: { id: true } }),
    ]);

    await prisma.promotion.create({
      data: {
        ...promoData,
        products: { create: linkedProducts.map(({ id }) => ({ productId: id })) },
        categories: { create: linkedCategories.map(({ id }) => ({ categoryId: id })) },
      },
    });
  }

  // ==========================================================
  // UNIDADES DE MEDIDA
  // ==========================================================
  console.log("Creando unidades de medida...");
  const units = [
    { name: "Mililitro", abbreviation: "ml" },
    { name: "Litro", abbreviation: "lt" },
    { name: "Pieza", abbreviation: "pz" },
    { name: "Gramo", abbreviation: "gr" },
    { name: "Kilogramo", abbreviation: "kg" },
  ];

  // Never delete here: this used to wipe every ingredient and inventory movement on each run.
  if ((await prisma.inventoryUnit.count()) === 0) {
    await prisma.inventoryUnit.createMany({ data: units });
  }
}

main()
  .catch((error) => {
    console.error("\nError ejecutando seed:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
