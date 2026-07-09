import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  await prisma.payment.deleteMany({});
  await prisma.saleItem.deleteMany({});
  await prisma.sale.deleteMany({});
  await prisma.stockBatch.deleteMany({});
  await prisma.branchStock.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.branch.deleteMany({});
  await prisma.tenant.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.deleteMany({});

  const tenant = await prisma.tenant.create({
    data: {
      id: 'tenant-1',
      name: 'Test Pharmacy',
      slug: 'test-pharmacy',
      email: 'test@pharmacy.com',
    }
  });

  const branch = await prisma.branch.create({
    data: {
      id: 'branch-1',
      name: 'Main Branch',
      code: 'MAIN',
      address: '123 Test St',
      tenantId: tenant.id
    }
  });

  const user = await prisma.user.create({
    data: {
      id: 'user-1',
      email: 'cashier@test.com',
      name: 'Test Cashier',
      passwordHash: await bcrypt.hash('password123', 10),
      tenantId: tenant.id,
      branchId: branch.id,
      role: 'CASHIER'
    }
  });

  const product = await prisma.product.create({
    data: {
      name: 'Paracetamol',
      genericName: 'Acetaminophen',
      dosage: '500mg',
      dosageUnit: 'MG',
      formulation: 'TABLET',
      tenantId: tenant.id
    }
  });

  const branchStock = await prisma.branchStock.create({
    data: {
      productId: product.id,
      branchId: branch.id,
      quantity: 100,
      minStockLevel: 10,
      sellingPrice: 10.00
    }
  });

  const stockBatch = await prisma.stockBatch.create({
    data: {
      branchStockId: branchStock.id,
      batchNumber: 'BATCH-001',
      expiryDate: new Date('2027-01-01'),
      quantity: 100,
      buyingPrice: 5.00
    }
  });

  console.log('Seeded successfully!');
  console.log(`TENANT_ID: ${tenant.id}`);
  console.log(`BRANCH_ID: ${branch.id}`);
  console.log(`USER_ID: ${user.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
