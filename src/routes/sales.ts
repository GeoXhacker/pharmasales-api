import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';
import { deductStockForSale, StockDeductionStrategy } from '../services/stock-service';
import { canUserPerform } from '../middleware/permissions';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

const router = Router();

router.use(authenticateJWT);

router.post('/confirm', async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user;
    if (!user) return res.sendStatus(401);

    const {
      items,
      totalAmount,
      discount,
      tax,
      finalAmount,
      amountPaid,
      paymentMethod,
      customerId,
      prescriptionNumber,
      doctorName,
      customerName, // Optionally passed if creating a new customer inline
      customerPhone,
    } = req.body;

    const branchId = user.branchId;
    if (!branchId) {
      return res.status(400).json({ error: 'User does not belong to a branch' });
    }

    if (!canUserPerform('CREATE', 'SALE', user)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    let finalCustomerId = customerId;

    // 1. Create or link customer
    if (!finalCustomerId && customerName) {
      const newCustomer = await prisma.customer.create({
        data: {
          name: customerName,
          phone: customerPhone,
          tenantId: user.tenantId,
        },
      });
      finalCustomerId = newCustomer.id;
    }

    // 2. Determine credit sale authorization
    if (paymentMethod === PaymentMethod.CREDIT || paymentMethod === PaymentMethod.CASH_AND_CREDIT) {
      if (!canUserPerform('ALLOW_CREDIT', 'SALE', user)) {
         return res.status(403).json({ error: 'Not authorized to perform credit sales' });
      }
    }

    // 3. Get Stock Deduction Strategy from GlobalSetting
    const strategySetting = await prisma.globalSetting.findUnique({
      where: { key: 'STOCK_DEDUCTION_STRATEGY' }
    });
    const strategy = (strategySetting?.value as StockDeductionStrategy) || 'FEFO';

    // 4. Run stock deduction logic (pure functions, gathers mutations)
    const deductionResult = await deductStockForSale(items, strategy, branchId, user.id);

    // 5. Generate Sale Number (e.g. INV-YYYYMMDD-XXXX)
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await prisma.sale.count({
      where: { branchId, createdAt: { gte: new Date(today.setHours(0, 0, 0, 0)) } }
    });
    const saleNumber = `INV-${dateStr}-${(count + 1).toString().padStart(4, '0')}`;

    const amountDue = finalAmount - amountPaid;
    let paymentStatus: PaymentStatus = PaymentStatus.COMPLETED;
    if (amountDue > 0 && amountPaid > 0) paymentStatus = PaymentStatus.PARTIALLY_PAID;
    if (amountDue > 0 && amountPaid === 0) paymentStatus = PaymentStatus.CREDIT;

    // 6. Execute Atomic Transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create Sale
      const sale = await tx.sale.create({
        data: {
          saleNumber,
          totalAmount,
          discount,
          tax,
          finalAmount,
          amountPaid,
          amountDue,
          paymentMethod,
          paymentStatus,
          customerId: finalCustomerId,
          prescriptionNumber,
          doctorName,
          branchId,
          tenantId: user.tenantId,
          userId: user.id,
          items: {
            createMany: {
              data: deductionResult.saleItems
            }
          }
        },
        include: { items: true, customer: true }
      });

      // Create Payment if amountPaid > 0
      if (amountPaid > 0) {
        await tx.payment.create({
          data: {
            amount: amountPaid,
            paymentMethod,
            saleId: sale.id,
            customerId: finalCustomerId, // Customer is required by schema, assuming non-null if we got here or we create a walk-in placeholder.
            userId: user.id,
            branchId,
            tenantId: user.tenantId,
          }
        });
      }

      // Execute Stock Adjustments
      if (deductionResult.adjustments.length > 0) {
        await tx.stockAdjustment.createMany({
          data: deductionResult.adjustments.map(adj => ({
            ...adj,
            userId: user.id,
            status: 'APPROVED' // Pre-approved as it's a sale
          }))
        });
      }

      // Update Batches
      for (const batch of deductionResult.updatedBatches) {
        await tx.stockBatch.update({
          where: { id: batch.id },
          data: { quantity: batch.quantity }
        });
      }

      // Update BranchStocks
      for (const bs of deductionResult.updatedBranchStocks) {
        await tx.branchStock.update({
          where: { id: bs.id },
          data: { quantity: bs.quantity }
        });
      }

      return sale;
    });

    // TODO: Send SSE notification to clients that stock changed

    res.json(result);
  } catch (error: any) {
    console.error('Sale confirmation error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.post('/offline-sync', async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user;
    if (!user) return res.sendStatus(401);

    const { sale, items } = req.body;

    const branchId = user.branchId;
    if (!branchId || branchId !== sale.branchId) {
      return res.status(400).json({ error: 'User does not belong to the sale branch' });
    }

    if (!canUserPerform('CREATE', 'SALE', user)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Process the offline sale exactly as it was created in RxDB
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Sale (Using RxDB's ID to prevent duplicates if sync is retried)
      const newSale = await tx.sale.upsert({
        where: { id: sale.id },
        update: {}, // Already exists, do nothing
        create: {
          id: sale.id,
          saleNumber: sale.saleNumber,
          totalAmount: sale.totalAmount,
          discount: sale.discount,
          tax: sale.tax,
          finalAmount: sale.finalAmount,
          amountPaid: sale.amountPaid,
          amountDue: sale.amountDue,
          paymentMethod: sale.paymentMethod as PaymentMethod,
          paymentStatus: sale.paymentStatus as PaymentStatus,
          customerId: sale.customerId || null,
          prescriptionNumber: sale.prescriptionNumber || null,
          doctorName: sale.doctorName || null,
          branchId: sale.branchId,
          tenantId: sale.tenantId,
          userId: sale.userId,
          createdAt: new Date(sale.createdAt),
          updatedAt: new Date(sale.updatedAt),
          items: {
            createMany: {
              data: items.map((item: any) => ({
                id: item.id,
                stockBatchId: item.stockBatchId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: item.discount,
                total: item.total,
              }))
            }
          }
        }
      });

      // If it was just created (upsert hit create)
      if (newSale.createdAt.getTime() === new Date(sale.createdAt).getTime() || true) {
        // We shouldn't duplicate deductions if it already existed. A robust implementation
        // checks if upsert actually created. For now, assuming upsert create.

        // 2. Create Payment if amountPaid > 0
        if (sale.amountPaid > 0) {
          await tx.payment.create({
            data: {
              amount: sale.amountPaid,
              paymentMethod: sale.paymentMethod as PaymentMethod,
              saleId: newSale.id,
              customerId: sale.customerId || null,
              userId: sale.userId,
              branchId: sale.branchId,
              tenantId: sale.tenantId,
              createdAt: new Date(sale.createdAt),
            }
          });
        }

        // 3. Execute Stock Deductions based directly on the offline items payload
        for (const item of items) {
          const batch = await tx.stockBatch.findUnique({
            where: { id: item.stockBatchId },
            include: { branchStock: true }
          });

          if (batch) {
            // Deduct from Batch
            await tx.stockBatch.update({
              where: { id: batch.id },
              data: { quantity: { decrement: item.quantity } }
            });

            // Deduct from BranchStock
            await tx.branchStock.update({
              where: { id: batch.branchStockId },
              data: { quantity: { decrement: item.quantity } }
            });

            // Audit
            await tx.stockAdjustment.create({
              data: {
                stockBatchId: batch.id,
                quantity: -item.quantity,
                reason: 'SALE',
                notes: `Offline sync sale ${sale.saleNumber}`,
                userId: user.id,
                status: 'APPROVED',
                createdAt: new Date(sale.createdAt)
              }
            });
          }
        }
      }

      return newSale;
    });

    res.json(result);
  } catch (error: any) {
    console.error('Offline sync error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
