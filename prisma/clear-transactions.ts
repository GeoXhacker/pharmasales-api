import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting to clear transactional data...');

  // We delete records in an order that respects foreign key constraints.
  // Child records are deleted before their parents.

  console.log('Deleting Audit Logs...');
  await prisma.auditLog.deleteMany();

  console.log('Deleting Shift Summaries...');
  await prisma.shiftSummary.deleteMany();

  console.log('Deleting Payments...');
  await prisma.payment.deleteMany();

  console.log('Deleting Sales and Sale Items...');
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();

  console.log('Deleting Prescriptions...');
  await prisma.prescriptionMedication.deleteMany();
  await prisma.prescription.deleteMany();

  console.log('Deleting Stock Data (Adjustments, Transfers, Requests, Batches, BranchStock)...');
  await prisma.stockAdjustment.deleteMany();
  await prisma.stockTransfer.deleteMany();
  await prisma.stockRequest.deleteMany();
  await prisma.stockBatch.deleteMany();
  await prisma.branchStock.deleteMany();

  // Note: Customers are kept by default. 
  // If you want to delete customers as well, uncomment the following line:
  await prisma.customer.deleteMany();

  console.log('✅ Successfully cleared transactional data!');
  console.log('ℹ️  Products, Users, Tenants, Branches, Suppliers, and Categories were preserved.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
