import { prisma } from "../src/config/prisma";
import bcrypt from "bcrypt";

const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Database connection URL is missing.");
}

async function main() {
  console.log("Iniciando seed...");

  // =========================
  // ROLES
  // =========================

  const adminRole = await prisma.role.upsert({
    where: {
      name: "ADMIN",
    },
    update: {},
    create: {
      name: "ADMIN",
      description: "Administrador del sistema",
    },
  });

  const cashierRole = await prisma.role.upsert({
    where: {
      name: "CAJERO",
    },
    update: {},
    create: {
      name: "CAJERO",
      description: "Usuario encargado de caja y ventas",
    },
  });

  // =========================
  // PERMISOS
  // =========================

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

  // =========================
  // PERMISOS ADMIN
  // =========================

  await prisma.rolePermission.createMany({
    data: allPermissions.map((permission) => ({
      roleId: adminRole.id,
      permissionId: permission.id,
    })),
    skipDuplicates: true,
  });

  // =========================
  // PERMISOS CAJERO
  // =========================

  const cashierPermissions = allPermissions.filter((permission) =>
    [
      "products.read",
      "sales.read",
      "sales.create",
      "cash.open",
      "cash.close",
    ].includes(permission.name),
  );

  await prisma.rolePermission.createMany({
    data: cashierPermissions.map((permission) => ({
      roleId: cashierRole.id,
      permissionId: permission.id,
    })),
    skipDuplicates: true,
  });

  // =========================
  // USUARIO ADMINISTRADOR
  // =========================

  const passwordHash = await bcrypt.hash(
    "CambiarEstaPassword123!",
    12,
  );

  await prisma.user.upsert({
    where: {
      email: "admin@andyscoffee.local",
    },
    update: {},
    create: {
      name: "Administrador",
      email: "admin@andyscoffee.local",
      passwordHash,
      roleId: adminRole.id,
    },
  });

  console.log("Seed ejecutado correctamente.");
}

main()
  .catch((error) => {
    console.error("Error ejecutando seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });