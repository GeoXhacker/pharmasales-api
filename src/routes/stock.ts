import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';
import { canUserPerform } from '../middleware/permissions';
import { StockAdjustmentReason, StockAdjustmentStatus, UserRole } from '@prisma/client';

const router = Router();

router.use(authenticateJWT);

// GET /stock/adjustments
router.get('/adjustments', async (req: AuthenticatedRequest, res) => {
    try {
        const user = req.user;
        if (!user) return res.sendStatus(401);
        const { branchId } = user;

        if (!branchId) {
            return res.status(400).json({ error: 'You must be assigned to a branch to view adjustments.' });
        }

        if (!canUserPerform('VIEW', 'STOCK', user)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const adjustments = await prisma.stockAdjustment.findMany({
            where: {
                stockBatch: {
                    branchStock: {
                        branchId: branchId
                    }
                }
            },
            include: {
                stockBatch: {
                    include: {
                        branchStock: {
                            include: {
                                product: true
                            }
                        }
                    }
                },
                user: {
                    select: {
                        name: true,
                        email: true
                    }
                },
                approvedBy: {
                    select: {
                        name: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        res.json(adjustments);
    } catch (error: any) {
        console.error('Error fetching adjustments:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /stock/adjust
router.post('/adjust', async (req: AuthenticatedRequest, res) => {
    try {
        const user = req.user;
        if (!user) return res.sendStatus(401);
        const { id: userId, branchId, role } = user;

        if (!branchId) {
            return res.status(400).json({ error: 'You must be assigned to a branch to make adjustments.' });
        }

        if (!canUserPerform('ADJUST', 'STOCK', user)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const AUTO_APPROVE_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN];
        const shouldAutoApprove = AUTO_APPROVE_ROLES.includes(role);

        const { stockBatchId, quantity, reason, notes } = req.body;

        if (!stockBatchId || quantity === undefined || !reason) {
            return res.status(400).json({ error: 'Missing required adjustment data' });
        }

        const quantityInt = parseInt(quantity, 10);
        if (isNaN(quantityInt)) {
            return res.status(400).json({ error: 'Quantity must be a number.' });
        }

        const result = await prisma.$transaction(async (tx) => {
            const batch = await tx.stockBatch.findUnique({
                where: { id: stockBatchId },
            });

            if (!batch) {
                throw new Error('Stock batch not found.');
            }

            if (shouldAutoApprove) {
                if (batch.quantity + quantityInt < 0) {
                    throw new Error('Adjustment would result in negative stock quantity.');
                }

                // Update StockBatch quantity
                const updatedBatch = await tx.stockBatch.update({
                    where: { id: stockBatchId },
                    data: { quantity: { increment: quantityInt } },
                });

                // Update parent BranchStock quantity to keep them in sync
                await tx.branchStock.update({
                    where: { id: batch.branchStockId },
                    data: { quantity: { increment: quantityInt } },
                });

                const adjustment = await tx.stockAdjustment.create({
                    data: {
                        stockBatchId,
                        quantity: quantityInt,
                        reason,
                        notes,
                        userId,
                        status: StockAdjustmentStatus.APPROVED,
                        approvedById: userId,
                        approvedAt: new Date(),
                    },
                });

                return { updatedBatch, adjustment };
            } else {
                // Not auto-approved, just create a PENDING adjustment
                const adjustment = await tx.stockAdjustment.create({
                    data: {
                        stockBatchId,
                        quantity: quantityInt,
                        reason,
                        notes,
                        userId,
                        status: StockAdjustmentStatus.PENDING,
                    },
                });

                return { adjustment };
            }
        });

        res.status(200).json(result);
    } catch (error: any) {
        console.error('Error creating stock adjustment:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

// PATCH /stock/adjustments/:id/approve
router.patch('/adjustments/:id/approve', async (req: AuthenticatedRequest, res) => {
    try {
        const user = req.user;
        if (!user) return res.sendStatus(401);
        const { id: userId, role } = user;
        const adjustmentId = req.params.id as string;

        if (!canUserPerform('MANAGE', 'STOCK', user)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const ALLOWED_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN];
        if (!ALLOWED_ROLES.includes(role)) {
            return res.status(403).json({ error: 'Unauthorized: Only managers and admins can approve adjustments.' });
        }

        const { action } = req.body; // 'APPROVE' or 'REJECT'

        if (!['APPROVE', 'REJECT'].includes(action)) {
            return res.status(400).json({ error: 'Invalid action. Must be APPROVE or REJECT.' });
        }

        const adjustment = await prisma.stockAdjustment.findUnique({
            where: { id: adjustmentId },
            include: { stockBatch: true }
        });

        if (!adjustment) {
            return res.status(404).json({ error: 'Adjustment not found.' });
        }

        if (adjustment.status !== 'PENDING') {
            return res.status(400).json({ error: 'Adjustment is already processed.' });
        }

        const result = await prisma.$transaction(async (tx) => {
            if (action === 'APPROVE') {
                if (adjustment.stockBatch.quantity + adjustment.quantity < 0) {
                    throw new Error('Approval would result in negative stock quantity.');
                }

                await tx.stockBatch.update({
                    where: { id: adjustment.stockBatchId },
                    data: { quantity: { increment: adjustment.quantity } }
                });

                await tx.branchStock.update({
                    where: { id: adjustment.stockBatch.branchStockId },
                    data: { quantity: { increment: adjustment.quantity } }
                });

                return await tx.stockAdjustment.update({
                    where: { id: adjustmentId },
                    data: {
                        status: 'APPROVED',
                        approvedById: userId,
                        approvedAt: new Date()
                    }
                });
            } else {
                return await tx.stockAdjustment.update({
                    where: { id: adjustmentId },
                    data: {
                        status: 'REJECTED',
                        approvedById: userId,
                        approvedAt: new Date()
                    }
                });
            }
        });

        res.json(result);
    } catch (error: any) {
        console.error('Error processing adjustment:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

// POST /stock/transfers
router.post('/transfers', async (req: AuthenticatedRequest, res) => {
    try {
        const user = req.user;
        if (!user) return res.sendStatus(401);

        const { stockBatchId, toBranchId, quantity, notes } = req.body;
        const fromBranchId = user.branchId;

        if (!fromBranchId) {
            return res.status(400).json({ error: 'You must be assigned to a branch to initiate transfers.' });
        }
        if (!stockBatchId || !toBranchId || !quantity) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (fromBranchId === toBranchId) {
            return res.status(400).json({ error: 'Cannot transfer to the same branch.' });
        }

        const quantityInt = parseInt(quantity, 10);
        if (isNaN(quantityInt) || quantityInt <= 0) {
            return res.status(400).json({ error: 'Invalid quantity.' });
        }

        const result = await prisma.$transaction(async (tx) => {
            // Verify batch exists and has enough quantity in the source branch
            const batch = await tx.stockBatch.findUnique({
                where: { id: stockBatchId },
                include: { branchStock: true }
            });

            if (!batch) {
                throw new Error('Batch not found');
            }
            if (batch.branchStock.branchId !== fromBranchId) {
                throw new Error('Batch does not belong to your branch');
            }
            if (batch.quantity < quantityInt) {
                throw new Error('Insufficient quantity in batch');
            }

            // Deduct from source batch and branchStock
            await tx.stockBatch.update({
                where: { id: stockBatchId },
                data: { quantity: { decrement: quantityInt } }
            });
            await tx.branchStock.update({
                where: { id: batch.branchStockId },
                data: { quantity: { decrement: quantityInt } }
            });

            // Find or create destination BranchStock
            let destBranchStock = await tx.branchStock.findUnique({
                where: {
                    branchId_productId: {
                        branchId: toBranchId,
                        productId: batch.branchStock.productId
                    }
                }
            });

            if (!destBranchStock) {
                destBranchStock = await tx.branchStock.create({
                    data: {
                        branchId: toBranchId,
                        productId: batch.branchStock.productId,
                        sellingPrice: batch.branchStock.sellingPrice,
                        minStockLevel: batch.branchStock.minStockLevel,
                        quantity: quantityInt
                    }
                });
            } else {
                await tx.branchStock.update({
                    where: { id: destBranchStock.id },
                    data: { quantity: { increment: quantityInt } }
                });
            }

            // Find or create destination StockBatch
            const destBatch = await tx.stockBatch.findUnique({
                where: {
                    branchStockId_batchNumber: {
                        branchStockId: destBranchStock.id,
                        batchNumber: batch.batchNumber
                    }
                }
            });

            if (destBatch) {
                await tx.stockBatch.update({
                    where: { id: destBatch.id },
                    data: { quantity: { increment: quantityInt } }
                });
            } else {
                await tx.stockBatch.create({
                    data: {
                        branchStockId: destBranchStock.id,
                        batchNumber: batch.batchNumber,
                        expiryDate: batch.expiryDate,
                        buyingPrice: batch.buyingPrice,
                        quantity: quantityInt
                    }
                });
            }

            // Create the transfer record
            const transfer = await tx.stockTransfer.create({
                data: {
                    fromBranchId,
                    toBranchId,
                    stockBatchId,
                    quantity: quantityInt,
                    requestedById: user.id,
                    approvedById: user.id,
                    status: 'COMPLETED',
                }
            });

            return transfer;
        });

        res.status(200).json(result);
    } catch (error: any) {
        console.error('Error creating stock transfer:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

export default router;
