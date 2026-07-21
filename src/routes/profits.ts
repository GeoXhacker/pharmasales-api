import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';
import { canUserPerform } from '../middleware/permissions';
import { 
    calculateProfitForSales, 
    getDailySalesSummary, 
    getHourlySales, 
    getDailySalesByBranch, 
    getDailySalesByPaymentMethod, 
    getTopSellingProducts, 
    getUnsoldProducts, 
    calculateExpiredStockLoss, 
    calculateStockAdjustmentImpact, 
    calculateProfitByCustomerSegment, 
    calculateProfitByBranch 
} from '../services/profit-service';

const router = Router();

router.use(authenticateJWT);

const parseDateRange = (startDateStr?: string, endDateStr?: string) => {
    const to = endDateStr ? new Date(endDateStr) : new Date();
    const from = startDateStr ? new Date(startDateStr) : new Date(new Date().setDate(to.getDate() - 30));
    return { from, to };
};

// GET /profits/overview
router.get('/overview', async (req: AuthenticatedRequest, res) => {
    try {
        const user = req.user;
        if (!user) return res.sendStatus(401);

        if (!canUserPerform('VIEW', 'FINANCIAL_REPORTS', user)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const { startDate, endDate } = req.query as { startDate?: string, endDate?: string };
        const { from, to } = parseDateRange(startDate, endDate);

        const sales = await prisma.sale.findMany({
            where: {
                tenantId: user.tenantId,
                createdAt: {
                    gte: from,
                    lte: to,
                },
            },
        });

        if (sales.length === 0) {
            return res.json({
                totalProfit: 0,
                totalRevenue: 0,
                totalCost: 0,
                dailyData: []
            });
        }

        const profitData = await calculateProfitForSales(sales);
        res.json(profitData);
    } catch (error: any) {
        console.error('Error fetching profits overview:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /profits/daily
router.get('/daily', async (req: AuthenticatedRequest, res) => {
    try {
        const user = req.user;
        if (!user) return res.sendStatus(401);

        if (!canUserPerform('VIEW', 'FINANCIAL_REPORTS', user)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const dateStr = req.query.date as string;
        const date = dateStr ? new Date(dateStr) : new Date();

        const [
            summary,
            hourlySales,
            branchSales,
            paymentMethodSales,
            topProducts,
            unsoldProducts,
        ] = await Promise.all([
            getDailySalesSummary(user.tenantId, date),
            getHourlySales(user.tenantId, date),
            getDailySalesByBranch(user.tenantId, date),
            getDailySalesByPaymentMethod(user.tenantId, date),
            getTopSellingProducts(user.tenantId, date),
            getUnsoldProducts(user.tenantId, date),
        ]);

        res.json({
            summary,
            hourlySales,
            branchSales,
            paymentMethodSales,
            topProducts,
            unsoldProducts,
        });
    } catch (error: any) {
        console.error('Error fetching daily profits:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /profits/costs
router.get('/costs', async (req: AuthenticatedRequest, res) => {
    try {
        const user = req.user;
        if (!user) return res.sendStatus(401);

        if (!canUserPerform('VIEW', 'FINANCIAL_REPORTS', user)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const { startDate, endDate } = req.query as { startDate?: string, endDate?: string };
        const { from, to } = parseDateRange(startDate, endDate);

        const [expiredStockLoss, stockAdjustmentImpact] = await Promise.all([
            calculateExpiredStockLoss(user.tenantId, { from, to }),
            calculateStockAdjustmentImpact(user.tenantId, { from, to }),
        ]);

        res.json({
            expiredStockLoss,
            stockAdjustmentImpact,
        });
    } catch (error: any) {
        console.error('Error fetching profits costs:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /profits/customers
router.get('/customers', async (req: AuthenticatedRequest, res) => {
    try {
        const user = req.user;
        if (!user) return res.sendStatus(401);

        if (!canUserPerform('VIEW', 'FINANCIAL_REPORTS', user)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const { startDate, endDate } = req.query as { startDate?: string, endDate?: string };
        const { from, to } = parseDateRange(startDate, endDate);

        const customerSegmentData = await calculateProfitByCustomerSegment(user.tenantId, { from, to });

        res.json(customerSegmentData);
    } catch (error: any) {
        console.error('Error fetching profit by customers:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /profits/branches
router.get('/branches', async (req: AuthenticatedRequest, res) => {
    try {
        const user = req.user;
        if (!user) return res.sendStatus(401);

        if (!canUserPerform('VIEW', 'FINANCIAL_REPORTS', user)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const { startDate, endDate } = req.query as { startDate?: string, endDate?: string };
        const { from, to } = parseDateRange(startDate, endDate);

        const branchProfitData = await calculateProfitByBranch(user.tenantId, { from, to });

        res.json(branchProfitData);
    } catch (error: any) {
        console.error('Error fetching profits by branches:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
