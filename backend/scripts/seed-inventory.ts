import { prisma } from '../src/config/prisma';

const products = [
  { id: 'PROD-001', name: 'Café entero', unit: 'g' },
  { id: 'PROD-002', name: 'Café molido', unit: 'g' },
  { id: 'PROD-003', name: 'Cajeta', unit: 'g' },
  { id: 'PROD-004', name: 'Canela', unit: 'g' },
  { id: 'PROD-005', name: 'Chai Guayaba', unit: 'g' },
  { id: 'PROD-006', name: 'Chai Vainilla', unit: 'g' },
  { id: 'PROD-007', name: 'Crema de biscoff', unit: 'g' },
  { id: 'PROD-008', name: 'Endulzante', unit: 'ml' },
  { id: 'PROD-009', name: 'Hersheys', unit: 'g' },
  { id: 'PROD-010', name: 'Leche condensada', unit: 'g' },
  { id: 'PROD-011', name: 'Syrup Vainilla', unit: 'g' },
  { id: 'PROD-012', name: 'French Vainilla', unit: 'g' },
  { id: 'PROD-013', name: 'Caramel Machiato', unit: 'g' },
  { id: 'PROD-014', name: 'Caramelo', unit: 'kg' },
  { id: 'PROD-015', name: 'Galletas', unit: 'pieza' },
  { id: 'PROD-016', name: 'Papa Hashbrown', unit: 'pieza' },
  { id: 'PROD-017', name: 'Papas a la francesa', unit: 'kg' },
  { id: 'PROD-018', name: 'Nieve', unit: 'g' },
  { id: 'PROD-019', name: 'Bandeja transportadora café', unit: 'pieza' },
  { id: 'PROD-020', name: 'Batidor para café', unit: 'g' },
  { id: 'PROD-021', name: 'Bolsa camiseta amarilla', unit: 'g' },
  { id: 'PROD-022', name: 'Bolsa celofan para cubiertos', unit: 'g' },
  { id: 'PROD-023', name: 'Contenedor negro', unit: 'pieza' },
  { id: 'PROD-024', name: 'Contenedor transparente', unit: 'pieza' },
  { id: 'PROD-025', name: 'Cuchillo', unit: 'pieza' },
  { id: 'PROD-026', name: 'Fajo de carton', unit: 'g' },
  { id: 'PROD-027', name: 'Papel decorativo', unit: 'g' },
  { id: 'PROD-028', name: 'Popotes', unit: 'g' },
  { id: 'PROD-029', name: 'Servilletas', unit: 'g' },
  { id: 'PROD-030', name: 'Tapa contenedor negro', unit: 'pieza' },
  { id: 'PROD-031', name: 'Contenedor carton', unit: 'pieza' },
  { id: 'PROD-032', name: 'Tapa contenedor carton', unit: 'pieza' },
  { id: 'PROD-033', name: 'Vaso chico con tapa', unit: 'pieza' },
  { id: 'PROD-034', name: 'Vaso mini con tapa', unit: 'g' },
  { id: 'PROD-035', name: 'Vaso espresso con tapa', unit: 'pieza' },
  { id: 'PROD-036', name: 'Tapa vaso caliente', unit: 'g' },
  { id: 'PROD-037', name: 'Tapa vaso frio', unit: 'pieza' },
  { id: 'PROD-038', name: 'Tenedores', unit: 'pieza' },
  { id: 'PROD-039', name: 'Vaso café caliente', unit: 'g' },
  { id: 'PROD-040', name: 'Vaso café frio', unit: 'pieza' },
  { id: 'PROD-041', name: 'Sello para café', unit: 'g' },
  { id: 'PROD-042', name: 'Crema lala', unit: 'g' },
  { id: 'PROD-043', name: 'Crema para batir', unit: 'g' },
  { id: 'PROD-044', name: 'Leche deslactosada', unit: 'L' },
  { id: 'PROD-045', name: 'Manteca', unit: 'g' },
  { id: 'PROD-046', name: 'Mantequilla', unit: 'g' },
  { id: 'PROD-047', name: 'Queso Fresco', unit: 'g' },
  { id: 'PROD-048', name: 'Mezcla de quesos', unit: 'g' },
  { id: 'PROD-049', name: 'Queso philadelphia', unit: 'g' },
  { id: 'PROD-050', name: 'Queso Amarillo', unit: 'g' },
  { id: 'PROD-051', name: 'Azucar', unit: 'g' },
  { id: 'PROD-052', name: 'Bagels', unit: 'pieza' },
  { id: 'PROD-053', name: 'Chispas chocolate', unit: 'g' },
  { id: 'PROD-054', name: 'Croissants', unit: 'pieza' },
  { id: 'PROD-055', name: 'Harina', unit: 'g' },
  { id: 'PROD-056', name: 'Nuez molida', unit: 'g' },
  { id: 'PROD-057', name: 'Totopos', unit: 'g' },
  { id: 'PROD-058', name: 'Polvo para hornear', unit: 'g' },
  { id: 'PROD-059', name: 'Maizena', unit: 'g' },
  { id: 'PROD-060', name: 'Miel mapple', unit: 'g' },
  { id: 'PROD-061', name: 'Salsa verde', unit: 'L' },
  { id: 'PROD-062', name: 'Salsa roja', unit: 'L' },
  { id: 'PROD-063', name: 'Bote chipotle', unit: 'pieza' },
  { id: 'PROD-064', name: 'Bote jalapeño', unit: 'pieza' },
  { id: 'PROD-065', name: 'Bote cebolla', unit: 'pieza' },
  { id: 'PROD-066', name: 'Cubiertos (tenedor)', unit: 'pieza' },
  { id: 'PROD-067', name: 'Cubiertos (tenedor, cuchillo)', unit: 'pieza' },
  { id: 'PROD-068', name: 'Masa waffles', unit: 'L' },
  { id: 'PROD-069', name: 'Bote mantequilla', unit: 'bote' },
  { id: 'PROD-070', name: 'Bote lechera', unit: 'pieza' },
  { id: 'PROD-071', name: 'Waffles', unit: 'pieza' },
  { id: 'PROD-072', name: 'Aderezo chipotle', unit: 'g' },
  { id: 'PROD-073', name: 'Pan frances', unit: 'pieza' },
  { id: 'PROD-074', name: 'Ensalada', unit: 'pieza' },
  { id: 'PROD-075', name: 'Arrachera', unit: 'g' },
  { id: 'PROD-076', name: 'Huevo', unit: 'pieza' },
  { id: 'PROD-077', name: 'Pollo', unit: 'g' },
  { id: 'PROD-078', name: 'Tocino', unit: 'g' },
  { id: 'PROD-079', name: 'Jamon', unit: 'g' },
  { id: 'PROD-080', name: 'Extracto Vainilla', unit: 'ml' },
  { id: 'PROD-081', name: 'Knorr suiza pollo', unit: 'g' },
  { id: 'PROD-082', name: 'Pimienta', unit: 'g' },
  { id: 'PROD-083', name: 'Sal', unit: 'g' },
  { id: 'PROD-084', name: 'Aceite para freir', unit: 'L' },
  { id: 'PROD-085', name: 'Agua', unit: 'ml' },
  { id: 'PROD-086', name: 'Pan blanco', unit: 'pieza' },
  { id: 'PROD-086b', name: 'Hielo', unit: 'g' },
  { id: 'PROD-087', name: 'Vinagreta', unit: 'pieza' },
  { id: 'PROD-087b', name: 'Sobrecito azucar', unit: 'g' },
  { id: 'PROD-088', name: 'Sobrecito catsup', unit: 'g' },
  { id: 'PROD-089', name: 'Sobrecito crema en polvo', unit: 'g' },
  { id: 'PROD-090', name: 'Aguacate', unit: 'pieza' },
  { id: 'PROD-091', name: 'Ajo', unit: 'g' },
  { id: 'PROD-092', name: 'Calabacita', unit: 'g' },
  { id: 'PROD-093', name: 'Cebolla', unit: 'kg' },
  { id: 'PROD-094', name: 'Chile chipotle', unit: 'g' },
  { id: 'PROD-095', name: 'Chile serrano', unit: 'pieza' },
  { id: 'PROD-096', name: 'Cilantro', unit: 'g' },
  { id: 'PROD-097', name: 'Jalapeño curtido', unit: 'paquete' },
  { id: 'PROD-098', name: 'Lechuga', unit: 'g' },
  { id: 'PROD-099', name: 'Pepino', unit: 'pieza' },
  { id: 'PROD-100', name: 'Tomate cherry', unit: 'g' },
  { id: 'PROD-101', name: 'Jitomate', unit: 'kg' },
  { id: 'PROD-102', name: 'Tomate verde', unit: 'kg' },
  { id: 'PROD-103', name: 'Desinfectante', unit: 'g' },
  { id: 'PROD-104', name: 'Chile Guajillo', unit: 'pieza' },
  { id: 'PROD-105', name: 'Azucar Mascabado', unit: 'g' },
  { id: 'PROD-106', name: 'Mayonesa', unit: 'g' },
  { id: 'PROD-107', name: 'Flan', unit: 'pieza' },
  { id: 'PROD-108', name: 'Bote mapple', unit: 'pieza' },
  { id: 'PROD-109', name: 'Ajo en polvo', unit: 'g' },
  { id: 'PROD-110', name: 'Mini bagel', unit: 'pieza' },
  { id: 'PROD-111', name: 'Bagel congelado', unit: 'pieza' },
  { id: 'PROD-112', name: 'Sticker ANDYS', unit: 'pieza' },
  { id: 'PROD-113', name: 'Sticker REDONDO', unit: 'pieza' },
  { id: 'PROD-114', name: 'Limon eureka', unit: 'g' },
  { id: 'PROD-115', name: 'Concentrado de limón', unit: 'ml' },
];

async function seedInventory() {
  try {
    console.log('🌱 Iniciando seed de inventario...');

    // Obtener o crear unidades
    const unitMap = new Map<string, string>();
    const uniqueUnits = Array.from(new Set(products.map(p => p.unit)));

    for (const unitName of uniqueUnits) {
      let unit = await prisma.inventoryUnit.findFirst({
        where: { name: unitName },
      });

      if (!unit) {
        unit = await prisma.inventoryUnit.create({
          data: {
            name: unitName,
            abbreviation: unitName.substring(0, 3).toUpperCase(),
          },
        });
      }
      unitMap.set(unitName, unit.id);
    }

    console.log(`✅ Se crearon/verificaron ${uniqueUnits.length} unidades`);

    // Crear o actualizar ingredientes
    let created = 0;
    for (const product of products) {
      const unitId = unitMap.get(product.unit);
      if (!unitId) {
        console.error(`⚠️ No se encontró unitId para: ${product.unit}`);
        continue;
      }

      await prisma.ingredient.upsert({
        where: { id: product.id },
        update: {
          name: product.name,
          unitId,
          sku: product.id,
        },
        create: {
          id: product.id,
          name: product.name,
          unitId,
          sku: product.id,
        },
      });
      created++;
    }

    console.log(`✅ Se cargaron ${created} ingredientes exitosamente`);
    console.log('✅ Seed de inventario completado');
  } catch (error) {
    console.error('❌ Error durante seed de inventario:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedInventory();
