import { prisma } from "../src/config/prisma";
import bcrypt from "bcrypt";
import dotenv from 'dotenv';

// Cargar variables de entorno desde el archivo .env
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;

if (!SUPABASE_URL) {
  throw new Error("La variable de entorno SUPABASE_URL no está definida.");
}

// URL de la imagen por defecto que debe estar en tu bucket de Supabase
const DEFAULT_IMAGE_URL = `${SUPABASE_URL}/storage/v1/object/public/Img/public/LogoAndysVector.svg`;

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
    name: "Promociones",
    description: "Combos y ofertas especiales.",
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
    imageUrl: `${SUPABASE_URL}/storage/v1/object/public/Img/public/espresso.png`, // Asegúrate de que esta imagen exista en tu bucket
  },
  {
    sku: "BEV-002",
    name: "Latte regular",
    description: "Espresso con leche deslactosada y una fina capa de espuma.",
    price: 55,
    cost: 15.23,
    category: "Bebidas",
    displayOrder: 2,
    imageUrl: `${SUPABASE_URL}/storage/v1/object/public/Img/public/Andys.png`, // Asegúrate de que esta imagen exista en tu bucket
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
    imageUrl: `${SUPABASE_URL}/storage/v1/object/public/Img/public/Caramelo.png`
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
    imageUrl: `${SUPABASE_URL}/storage/v1/object/public/Img/public/Biscoff.png`
  },
  {
    sku: "BEV-007",
    name: "Latte Andy's",
    description: "La especialidad de la casa, un secreto delicioso.",
    price: 65,
    cost: 21.83,
    category: "Bebidas",
    displayOrder: 7,
    imageUrl: `${SUPABASE_URL}/storage/v1/object/public/Img/public/Andys.png`
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
    imageUrl: `${SUPABASE_URL}/storage/v1/object/public/Img/public/Caramelo.png`
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
    imageUrl: `${SUPABASE_URL}/storage/v1/object/public/Img/public/Biscoff.png`
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
    imageUrl: `${SUPABASE_URL}/storage/v1/object/public/Img/public/CoffeeCream.png`
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
    imageUrl: `${SUPABASE_URL}/storage/v1/object/public/Img/public/Limonada.png`
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
    imageUrl: `${SUPABASE_URL}/storage/v1/object/public/Img/public/Bloom.png`
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
    imageUrl: `${SUPABASE_URL}/storage/v1/object/public/Img/public/Taro.png`
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
    imageUrl: `${SUPABASE_URL}/storage/v1/object/public/Img/public/Campirano.png`
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
    imageUrl: `${SUPABASE_URL}/storage/v1/object/public/Img/public/Pollo.png`
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
    imageUrl: `${SUPABASE_URL}/storage/v1/object/public/Img/public/Carnivoro.png`
  },
  {
    sku: "BAG-005",
    name: "Mini bagel philadelphia",
    description:
      "Pequeño bagel con queso crema Philadelphia.",
    price: 28,
    cost: 13.47,
    category: "Bagels",
    displayOrder: 5,
    imageUrl: `${SUPABASE_URL}/storage/v1/object/public/Img/public/MiniPhila.png`
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
    imageUrl: `${SUPABASE_URL}/storage/v1/object/public/Img/public/Canadiense.png`
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
    imageUrl: `${SUPABASE_URL}/storage/v1/object/public/Img/public/Viajero.png`
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
    imageUrl: `${SUPABASE_URL}/storage/v1/object/public/Img/public/Continental.png`
  },

  // =========================
  // PROMOCIONES *Revisar*
  // =========================

  {
    sku: "PRO-001",
    name: "Promo Latte Andy´s 2x1",
    description:
      "Disfruta de dos Lattes Andy's al precio de uno.",
    price: 65,
    cost: 26,
    category: "Promociones",
    displayOrder: 1,
  },
  {
    sku: "PRO-002",
    name: "Promo BomDia",
    description:
      "Café americano y croissant por un precio especial.",
    price: 60,
    cost: 20,
    category: "Promociones",
    displayOrder: 2,
  },
  {
    sku: "PRO-003",
    name: "4to desayuno gratis (Viajero)",
    description:
      "Acumula 3 desayunos Viajero y el 4to es gratis.",
    price: 0,
    cost: 32,
    category: "Promociones",
    displayOrder: 3,
  },
  {
    sku: "PRO-004",
    name: "Promo mochilero",
    description:
      "Bagel americano y refresco a precio de paquete.",
    price: 95,
    cost: 35,
    category: "Promociones",
    displayOrder: 4,
  },
  {
    sku: "PRO-005",
    name: "Promo limonadas",
    description:
      "Dos limonadas por un precio especial.",
    price: 70,
    cost: 16,
    category: "Promociones",
    displayOrder: 5,
  },
];

// ============================================================
// ROLES
// ============================================================

const roles = [
  {
    name: "ADMIN",
    description: "Administrador del sistema",
  },
  {
    name: "CAJERO",
    description: "Usuario encargado de caja y ventas",
  },
];

// ============================================================
// PERMISOS
// ============================================================

const permissions = [
  {
    name: "users.read",
    description: "Consultar usuarios",
  },
  {
    name: "users.create",
    description: "Crear usuarios",
  },
  {
    name: "users.update",
    description: "Actualizar usuarios",
  },
  {
    name: "users.delete",
    description: "Eliminar usuarios",
  },
  {
    name: "products.read",
    description: "Consultar productos",
  },
  {
    name: "products.create",
    description: "Crear productos",
  },
  {
    name: "products.update",
    description: "Actualizar productos",
  },
  {
    name: "products.delete",
    description: "Eliminar productos",
  },
  {
    name: "sales.read",
    description: "Consultar ventas",
  },
  {
    name: "sales.create",
    description: "Crear ventas",
  },
  {
    name: "sales.cancel",
    description: "Cancelar ventas",
  },
  {
    name: "cash.open",
    description: "Abrir caja",
  },
  {
    name: "cash.close",
    description: "Cerrar caja",
  },
  {
    name: "reports.read",
    description: "Consultar reportes",
  },
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
      where: {
        name: role.name,
      },
      update: {
        description: role.description,
      },
      create: {
        name: role.name,
        description: role.description,
      },
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

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: {
        name: permission.name,
      },
      update: {
        description: permission.description,
      },
      create: permission,
    });
  }

  const allPermissions = await prisma.permission.findMany();

  // ==========================================================
  // PERMISOS ADMIN
  // ==========================================================

  console.log("Asignando permisos de administrador...");

  await prisma.rolePermission.createMany({
    data: allPermissions.map((permission) => ({
      roleId: adminRoleId,
      permissionId: permission.id,
    })),
    skipDuplicates: true,
  });

  // ==========================================================
  // PERMISOS CAJERO
  // ==========================================================

  console.log("Asignando permisos de cajero...");

  const cashierPermissionNames = [
    "products.read",
    "sales.read",
    "sales.create",
    "cash.open",
    "cash.close",
  ];

  const cashierPermissions = allPermissions.filter((permission) =>
    cashierPermissionNames.includes(permission.name),
  );

  await prisma.rolePermission.createMany({
    data: cashierPermissions.map((permission) => ({
      roleId: cashierRoleId,
      permissionId: permission.id,
    })),
    skipDuplicates: true,
  });

  // ==========================================================
  // USUARIO ADMINISTRADOR
  // ==========================================================

  console.log("Creando usuario administrador...");

  const adminPassword = process.env.ADMIN_SEED_PASSWORD;
  if (!adminPassword) {
    console.warn(
      "ADVERTENCIA: La variable de entorno ADMIN_SEED_PASSWORD no está definida. Usando una contraseña insegura por defecto. No uses esto en producción.",
    );
  }

  const passwordToHash = adminPassword || "CambiarEstaPassword123!";

  const passwordHash = await bcrypt.hash(passwordToHash, 12);

  await prisma.user.upsert({
    where: {
      email: "admin@andyscoffee.local",
    },
    update: {
      roleId: adminRoleId,
    },
    create: {
      name: "Administrador",
      email: "admin@andyscoffee.local",
      passwordHash,
      roleId: adminRoleId,
    },
  });

  // ==========================================================
  // CATEGORÍAS
  // ==========================================================

  console.log("Creando categorías...");

  const categoryMap = new Map<string, string>();

  for (const category of categories) {
    let dbCategory = await prisma.category.findFirst({
      where: { name: category.name },
    });

    if (dbCategory) {
      dbCategory = await prisma.category.update({
        where: { id: dbCategory.id },
        data: {
          description: category.description,
          displayOrder: category.displayOrder,
          isActive: true,
        },
      });
    } else {
      dbCategory = await prisma.category.create({
        data: {
          name: category.name,
          description: category.description,
          displayOrder: category.displayOrder,
          isActive: true,
        },
      });
    }

    categoryMap.set(category.name, dbCategory.id);
  }

  // ==========================================================
  // PRODUCTOS
  // ==========================================================

  console.log(`Creando ${products.length} productos...`);

  for (const product of products) {
    const categoryId = categoryMap.get(product.category);

    if (!categoryId) {
      throw new Error(
        `No se encontró la categoría "${product.category}" para "${product.name}".`,
      );
    }

    const imageUrl = product.imageUrl || DEFAULT_IMAGE_URL;

    const productData = {
      name: product.name,
      description: product.description,
      imageUrl: imageUrl,
      price: product.price,
      cost: product.cost,
      categoryId,
      displayOrder: product.displayOrder,
      isActive: true,
    };

    const existingProduct = await prisma.product.findFirst({
      where: { sku: product.sku },
    });

    if (existingProduct) {
      await prisma.product.update({
        where: { id: existingProduct.id },
        data: productData,
      });
    } else {
      await prisma.product.create({
        data: {
          ...productData,
          sku: product.sku,
        },
      });
    }
  }

  // ==========================================================
  // RESUMEN
  // ==========================================================

  const categoryCount = await prisma.category.count();
  const productCount = await prisma.product.count();
  const roleCount = await prisma.role.count();
  const permissionCount = await prisma.permission.count();

  console.log("\n========================================");
  console.log("       SEED EJECUTADO CORRECTAMENTE");
  console.log("========================================");
  console.log(`Categorías:   ${categoryCount}`);
  console.log(`Productos:    ${productCount}`);
  console.log(`Roles:        ${roleCount}`);
  console.log(`Permisos:     ${permissionCount}`);
  console.log("========================================");
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