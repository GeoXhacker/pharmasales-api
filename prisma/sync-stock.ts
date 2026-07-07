import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting stock quantity synchronization...');

  const branchStocks = await prisma.branchStock.findMany({
    include: {
      batches: true,
    },
  });

  console.log(`Found ${branchStocks.length} branch stock records.`);

  for (const bs of branchStocks) {
    const totalBatchQuantity = bs.batches.reduce((sum, batch) => sum + batch.quantity, 0);

    if (bs.quantity !== totalBatchQuantity) {
      console.log(`Mismatch found for Product ID ${bs.productId} in Branch ID ${bs.branchId}:`);
      console.log(`  Current BranchStock.quantity: ${bs.quantity}`);
      console.log(`  Sum of all StockBatch.quantity: ${totalBatchQuantity}`);

      await prisma.branchStock.update({
        where: { id: bs.id },
        data: { quantity: totalBatchQuantity },
      });

      console.log(`  ✅ Fixed BranchStock quantity to ${totalBatchQuantity}`);
    }
  }

  console.log('Synchronization complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
