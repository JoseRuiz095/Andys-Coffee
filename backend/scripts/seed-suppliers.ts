import { prisma } from '../src/config/prisma';

const suppliers = [
  { id: 'PROV-01', name: 'La Raya', phone: null },
  { id: 'PROV-02', name: 'Fruteria Parra', phone: '+52 311-216-2091' },
  { id: 'PROV-03', name: 'M. Primas Barajas', phone: '+52 311-122-6837' },
  { id: 'PROV-04', name: 'Fruteria Arcadia', phone: '+52 311-372-9496' },
  { id: 'PROV-05', name: 'Cremeria Mtz', phone: '+52 311-148-6828' },
  { id: 'PROV-06', name: 'Soriana Hiper', phone: null },
  { id: 'PROV-07', name: 'Oh Bagels', phone: '+52 311-235-0885' },
  { id: 'PROV-08', name: 'La chiripa', phone: '+52 311-212-5601' },
  { id: 'PROV-09', name: 'Aurrera', phone: null },
  { id: 'PROV-10', name: 'Carnes Selectas', phone: null },
  { id: 'PROV-11', name: 'Ley Rodeo', phone: null },
  { id: 'PROV-12', name: 'Ley Alica', phone: null },
  { id: 'PROV-13', name: 'Wendy´s', phone: null },
  { id: 'PROV-14', name: 'SAM´S', phone: null },
  { id: 'PROV-15', name: 'Carnicería El Granjero', phone: null },
];

async function main() {
  console.log('Loading suppliers...');

  for (const supplier of suppliers) {
    await prisma.supplier.upsert({
      where: { id: supplier.id },
      update: {
        name: supplier.name,
        phone: supplier.phone,
        isActive: true,
      },
      create: {
        id: supplier.id,
        name: supplier.name,
        phone: supplier.phone,
        isActive: true,
      },
    });
  }

  const count = await prisma.supplier.count();
  console.log(`✅ Successfully loaded ${count} suppliers`);
}

main()
  .catch((error) => {
    console.error('Error loading suppliers:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
