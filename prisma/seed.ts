// @ts-nocheck
import { PrismaClient, DosageUnit, DrugFormulation } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // Clean up existing data
  await prisma.stockAdjustment.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.saleItem.deleteMany({});
  await prisma.sale.deleteMany({});
  await prisma.stockBatch.deleteMany({});
  await prisma.branchStock.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.branch.deleteMany({});
  await prisma.tenant.deleteMany({});

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
      email: 'admin@pharmasales.com',
      name: 'Admin User',
      passwordHash: '$2b$10$9/snceOIPYfTJbfLBwhb3OZl1Lk7p5VnCZnO5c5GmFY.QQi8pWNeu', // password123
      role: 'ADMIN',
      tenantId: tenant.id,
      branchId: branch.id,
    },
  });

  // Create Categories
  const category1 = await prisma.category.create({
    data: {
      name: 'Painkillers',
      tenantId: tenant.id,
    }
  });

  const category2 = await prisma.category.create({
    data: {
      name: 'Antibiotics',
      tenantId: tenant.id,
    }
  });

  // Create Products
  const prod1 = await prisma.product.create({
    data: {
        name: 'Paracetamol 500mg',
        brand: 'Panadol',
        dosage: '500mg',
        dosageUnit: DosageUnit.MG,
        formulation: DrugFormulation.TABLET,
        categoryId: category1.id,
        tenantId: tenant.id,
        requiresPrescription: false
    }
  });

  const prod2 = await prisma.product.create({
    data: {
        name: 'Amoxicillin 250mg',
        brand: 'Amoxil',
        dosage: '250mg',
        dosageUnit: DosageUnit.MG,
        formulation: DrugFormulation.CAPSULE,
        categoryId: category2.id,
        tenantId: tenant.id,
        requiresPrescription: true
    }
  });

  // Create Branch Stocks
  const bs1 = await prisma.branchStock.create({
    data: {
        productId: prod1.id,
        branchId: branch.id,
        quantity: 100,
        minStockLevel: 20,
        sellingPrice: 1.50
    }
  });

  const bs2 = await prisma.branchStock.create({
    data: {
        productId: prod2.id,
        branchId: branch.id,
        quantity: 50,
        minStockLevel: 10,
        sellingPrice: 5.00
    }
  });

  // Create Stock Batches
  await prisma.stockBatch.create({
    data: {
        batchNumber: 'BATCH-001',
        branchStockId: bs1.id,
        quantity: 100,
        buyingPrice: 0.50,
        expiryDate: new Date('2027-12-31')
    }
  });

  await prisma.stockBatch.create({
    data: {
        batchNumber: 'BATCH-002',
        branchStockId: bs2.id,
        quantity: 50,
        buyingPrice: 2.00,
        expiryDate: new Date('2028-06-30')
    }
  });

  console.log('Seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
