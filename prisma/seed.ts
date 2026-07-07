// @ts-nocheck
import { PrismaClient, DosageUnit, DrugFormulation } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // Clean up existing data
  await prisma.stockAdjustment.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.sale.deleteMany({});
  await prisma.stockBatch.deleteMany({});
  await prisma.branchStock.deleteMany({});
  await prisma.product.deleteMany({ where: { name: { in: ['Test Product for Stock', 'Test Product for Sales'] } } });
  await prisma.user.deleteMany({ where: { email: 'admin@bristolpharmacy.com' } });
  await prisma.tenant.deleteMany({ where: { slug: 'bristol-pharmacy' } });

  // Create Tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Bristol Pharmacy',
      slug: 'bristol-pharmacy',
      email: 'contact@bristolpharmacy.com',
    },
  });

  // Create Branch
  const branch = await prisma.branch.create({
    data: {
      name: 'Main Branch',
      code: 'MAIN',
      address: '123 Pharmacy Lane',
      tenantId: tenant.id,
    },
  });

  // Create Admin User
  await prisma.user.create({
    data: {
      email: 'admin@bristolpharmacy.com',
      name: 'Admin User',
      passwordHash: '$2a$10$1.Vw2e.1r8b7K1yXn4zM9uF.n/L5n5Qj3X.X0zJ2.0zJ2.0zJ2.0z', // password123
      role: 'ADMIN',
      tenantId: tenant.id,
      branchId: branch.id,
    },
  });

  // Create Test Products
  await prisma.product.create({
    data: {
        name: 'Test Product for Stock',
        brand: 'Test Brand',
        dosage: '500mg',
        dosageUnit: DosageUnit.MG,
        formulation: DrugFormulation.TABLET,
        tenantId: tenant.id,
    }
  });

  await prisma.product.create({
    data: {
        name: 'Test Product for Sales',
        brand: 'Test Brand',
        dosage: '250mg',
        dosageUnit: DosageUnit.MG,
        formulation: DrugFormulation.CAPSULE,
        tenantId: tenant.id,
    }
  });

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
