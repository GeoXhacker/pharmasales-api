import { Prisma, StockBatch } from '@prisma/client';
import { prisma } from '../prisma';

export type StockDeductionStrategy = 'FEFO' | 'FIFO' | 'RANDOM';

type SaleItemData = {
  productId: string;
  quantity: number;
  sellingPrice: number;
};

type DeductionResult = {
  saleItems: Omit<Prisma.SaleItemCreateManySaleInput, 'saleId'>[];
  adjustments: Omit<Prisma.StockAdjustmentCreateManyInput, 'userId'>[];
  updatedBatches: { id: string; quantity: number }[];
  updatedBranchStocks: { id: string; quantity: number }[];
};

export async function deductStockForSale(
  items: SaleItemData[],
  strategy: StockDeductionStrategy,
  branchId: string,
  userId: string
): Promise<DeductionResult> {
  const result: DeductionResult = {
    saleItems: [],
    adjustments: [],
    updatedBatches: [],
    updatedBranchStocks: [],
  };

  for (const item of items) {
    const branchStock = await prisma.branchStock.findUnique({
      where: { branchId_productId: { branchId, productId: item.productId } },
      include: { batches: true },
    });

    if (!branchStock) {
      throw new Error(`Product not found in this branch.`);
    }

    if (branchStock.quantity < item.quantity) {
      throw new Error(`Insufficient stock for product. Available: ${branchStock.quantity}, Required: ${item.quantity}`);
    }

    let batchesToDeductFrom: StockBatch[] = [];
    switch (strategy) {
      case 'FEFO':
        batchesToDeductFrom = branchStock.batches
          .filter((b) => b.quantity > 0)
          .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
        break;
      case 'FIFO':
        batchesToDeductFrom = branchStock.batches
          .filter((b) => b.quantity > 0)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'RANDOM':
        // For RANDOM, we just use the default order from the database.
        batchesToDeductFrom = branchStock.batches.filter((b) => b.quantity > 0);
        break;
    }

    let remainingQuantityToDeduct = item.quantity;
    for (const batch of batchesToDeductFrom) {
      if (remainingQuantityToDeduct <= 0) break;

      const quantityToDeductFromBatch = Math.min(batch.quantity, remainingQuantityToDeduct);

      result.saleItems.push({
        stockBatchId: batch.id,
        quantity: quantityToDeductFromBatch,
        unitPrice: item.sellingPrice,
        total: item.sellingPrice * quantityToDeductFromBatch,
      });

      result.adjustments.push({
        stockBatchId: batch.id,
        quantity: -quantityToDeductFromBatch,
        reason: 'SALE',
        notes: `Sale of ${item.quantity} units.`,
      });

      result.updatedBatches.push({
        id: batch.id,
        quantity: batch.quantity - quantityToDeductFromBatch,
      });

      remainingQuantityToDeduct -= quantityToDeductFromBatch;
    }

    result.updatedBranchStocks.push({
      id: branchStock.id,
      quantity: branchStock.quantity - item.quantity,
    });
  }

  return result;
}
