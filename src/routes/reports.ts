import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';
import { canUserPerform } from '../middleware/permissions';
import { UserRole } from '@prisma/client';
import { addDays } from 'date-fns';

const router = Router();

router.use(authenticateJWT);

// GET /reports/expiry-alerts
router.get('/expiry-alerts', async (req: AuthenticatedRequest, res) => {
    try {
        const user = req.user;
        if (!user) return res.sendStatus(401);
        
        if (!canUserPerform('VIEW', 'REPORTS', user)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const days = parseInt(req.query.days as string || '30', 10);
        const targetDate = addDays(new Date(), days);

        const expiringBatches = await prisma.stockBatch.findMany({
            where: {
                expiryDate: {
                    lte: targetDate,
                    gte: new Date(),
                },
                branchStock: {
                    product: {
                        tenantId: user.tenantId,
                    },
                },
            },
            include: {
                branchStock: {
                    include: {
                        product: true,
                        branch: true,
                    },
                },
            },
            orderBy: {
                expiryDate: 'asc',
            },
        });

        res.json(expiringBatches);
    } catch (error: any) {
        console.error('Error fetching expiry alert report:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

// GET /reports/inventory-value
router.get('/inventory-value', async (req: AuthenticatedRequest, res) => {
    try {
        const user = req.user;
        if (!user) return res.sendStatus(401);

        if (!canUserPerform('VIEW', 'STOCK', user)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const branchStockFilter: any = {
            product: {
                tenantId: user.tenantId,
            },
        };

        if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
            if (user.branchId) {
                branchStockFilter.branchId = user.branchId;
            }
        }

        const batches = await prisma.stockBatch.findMany({
            where: {
                branchStock: branchStockFilter,
                quantity: {
                    gt: 0,
                },
            },
            select: {
                quantity: true,
                buyingPrice: true,
            },
        });

        const totalValue = batches.reduce((acc, batch) => {
            return acc + (batch.quantity * Number(batch.buyingPrice));
        }, 0);

        res.json({ totalValue });
    } catch (error: any) {
        console.error('Error calculating inventory value:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

// GET /reports/stock-levels
router.get('/stock-levels', async (req: AuthenticatedRequest, res) => {
    try {
        const user = req.user;
        if (!user) return res.sendStatus(401);

        if (!canUserPerform('VIEW', 'REPORTS', user)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const stockLevels = await prisma.branchStock.findMany({
            where: {
                product: {
                    tenantId: user.tenantId,
                },
            },
            include: {
                product: true,
                branch: true,
                batches: true,
            },
            orderBy: [
                {
                    branch: {
                        name: 'asc',
                    },
                },
                {
                    product: {
                        name: 'asc',
                    },
                },
            ],
        });

        res.json(stockLevels);
    } catch (error: any) {
        console.error('Error fetching stock level report:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

export default router;
