import { PrismaClient, Sale } from '@prisma/client';
import { format } from 'date-fns';
import { prisma } from '../prisma';

export type DailyProfitData = {
  date: string;
  profit: number;
  revenue: number;
  cost: number;
};

export type ProfitData = {
  totalProfit: number;
  totalRevenue: number;
  totalCost: number;
  dailyData: DailyProfitData[];
};

export async function calculateProfitForSales(sales: Sale[]): Promise<ProfitData> {
  let totalProfit = 0;
  let totalRevenue = 0;
  let totalCost = 0;
  const dailyDataMap = new Map<string, { profit: number; revenue: number; cost: number }>();

  const saleIds = sales.map((sale) => sale.id);

  const saleItems = await prisma.saleItem.findMany({
    where: {
      saleId: {
        in: saleIds,
      },
    },
    include: {
      stockBatch: true,
      sale: true,
    },
  });

  for (const item of saleItems) {
    const cost = item.quantity * Number(item.stockBatch.buyingPrice);
    const revenue = Number(item.total);
    const profit = revenue - cost;

    totalCost += cost;
    totalRevenue += revenue;
    totalProfit += profit;

    const date = format(new Date(item.sale.createdAt), 'yyyy-MM-dd');
    const dayData = dailyDataMap.get(date) || { profit: 0, revenue: 0, cost: 0 };

    dayData.profit += profit;
    dayData.revenue += revenue;
    dayData.cost += cost;

    dailyDataMap.set(date, dayData);
  }

  const dailyData = Array.from(dailyDataMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    totalProfit,
    totalRevenue,
    totalCost,
    dailyData,
  };
}

export type BranchProfitData = {
  branchId: string;
  branchName: string;
  totalProfit: number;
  totalRevenue: number;
  totalCost: number;
};

export async function calculateProfitByBranch(
  tenantId: string,
  dateRange: { from: Date; to: Date }
): Promise<BranchProfitData[]> {
  const saleItems = await prisma.saleItem.findMany({
    where: {
      sale: {
        tenantId: tenantId,
        createdAt: {
          gte: dateRange.from,
          lte: dateRange.to,
        },
      },
    },
    include: {
      stockBatch: true,
      sale: {
        include: {
          branch: true,
        },
      },
    },
  });

  const branchDataMap = new Map<string, { branchName: string; totalProfit: number; totalRevenue: number; totalCost: number }>();

  for (const item of saleItems) {
    const cost = item.quantity * Number(item.stockBatch.buyingPrice);
    const revenue = Number(item.total);
    const profit = revenue - cost;

    const branchId = item.sale.branchId;
    const branchName = item.sale.branch.name;

    const currentBranchData = branchDataMap.get(branchId) || {
      branchName,
      totalProfit: 0,
      totalRevenue: 0,
      totalCost: 0,
    };

    currentBranchData.totalProfit += profit;
    currentBranchData.totalRevenue += revenue;
    currentBranchData.totalCost += cost;

    branchDataMap.set(branchId, currentBranchData);
  }

  const result: BranchProfitData[] = Array.from(branchDataMap.entries()).map(
    ([branchId, data]) => ({
      branchId,
      ...data,
    })
  ).sort((a, b) => b.totalProfit - a.totalProfit);

  return result;
}

export type DailySalesSummary = {
  grossSales: number;
  netSales: number;
  totalTransactions: number;
  averageTransactionValue: number;
};

export async function getDailySalesSummary(tenantId: string, date: Date): Promise<DailySalesSummary> {
  const startDate = new Date(date.setHours(0, 0, 0, 0));
  const endDate = new Date(date.setHours(23, 59, 59, 999));

  const sales = await prisma.sale.findMany({
    where: {
      tenantId,
      createdAt: { gte: startDate, lte: endDate },
    },
  });

  const totalTransactions = sales.length;
  if (totalTransactions === 0) {
    return { grossSales: 0, netSales: 0, totalTransactions: 0, averageTransactionValue: 0 };
  }

  const netSales = sales.reduce((sum, sale) => sum + Number(sale.finalAmount), 0);
  const grossSales = sales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0);
  const averageTransactionValue = netSales / totalTransactions;

  return { grossSales, netSales, totalTransactions, averageTransactionValue };
}

export type HourlySales = { hour: string; sales: number };

export async function getHourlySales(tenantId: string, date: Date): Promise<HourlySales[]> {
    const startDate = new Date(date.setHours(0, 0, 0, 0));
    const endDate = new Date(date.setHours(23, 59, 59, 999));

    const sales = await prisma.sale.findMany({
        where: {
            tenantId,
            createdAt: { gte: startDate, lte: endDate },
        },
    });

    const hourlySales = new Array(24).fill(0).map((_, i) => ({
        hour: `${i.toString().padStart(2, '0')}:00`,
        sales: 0,
    }));

    for (const sale of sales) {
        const hour = new Date(sale.createdAt).getHours();
        hourlySales[hour].sales += Number(sale.finalAmount);
    }

    return hourlySales;
}

export type DailySalesByBranch = {
    branchName: string;
    sales: number;
    totalProfit: number;
    transactionCount: number;
};

export async function getDailySalesByBranch(tenantId: string, date: Date): Promise<DailySalesByBranch[]> {
    const startDate = new Date(date.setHours(0, 0, 0, 0));
    const endDate = new Date(date.setHours(23, 59, 59, 999));

    const saleItems = await prisma.saleItem.findMany({
        where: {
            sale: {
                tenantId: tenantId,
                createdAt: {
                    gte: startDate,
                    lte: endDate,
                },
            },
        },
        include: {
            stockBatch: true,
            sale: {
                include: {
                    branch: true,
                },
            },
        },
    });

    const branchDataMap = new Map<string, { branchName: string; sales: number; totalProfit: number; saleIds: Set<string> }>();

    for (const item of saleItems) {
        const cost = item.quantity * Number(item.stockBatch.buyingPrice);
        const revenue = Number(item.total);
        const profit = revenue - cost;

        const branchId = item.sale.branchId;
        const branchName = item.sale.branch.name;

        const currentBranchData = branchDataMap.get(branchId) || {
            branchName,
            sales: 0,
            totalProfit: 0,
            saleIds: new Set<string>(),
        };

        currentBranchData.sales += revenue;
        currentBranchData.totalProfit += profit;
        currentBranchData.saleIds.add(item.saleId);

        branchDataMap.set(branchId, currentBranchData);
    }

    return Array.from(branchDataMap.entries()).map(([branchId, data]) => ({
        branchName: data.branchName,
        sales: data.sales,
        totalProfit: data.totalProfit,
        transactionCount: data.saleIds.size,
    })).sort((a,b) => b.sales - a.sales);
}

export type DailySalesByPaymentMethod = { name: string; value: number };

export async function getDailySalesByPaymentMethod(tenantId: string, date: Date): Promise<DailySalesByPaymentMethod[]> {
    const startDate = new Date(date.setHours(0, 0, 0, 0));
    const endDate = new Date(date.setHours(23, 59, 59, 999));

    const salesByPaymentMethod = await prisma.sale.groupBy({
        by: ['paymentMethod'],
        where: {
            tenantId,
            createdAt: { gte: startDate, lte: endDate },
        },
        _sum: {
            finalAmount: true,
        },
    });

    return salesByPaymentMethod.map(item => ({
        name: item.paymentMethod.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value: Number(item._sum.finalAmount) || 0,
    })).sort((a,b) => b.value - a.value);
}

export type TopSellingProduct = {
    productId: string;
    productName: string;
    totalQuantity: number;
    totalRevenue: number;
};

export async function getTopSellingProducts(tenantId: string, date: Date, limit: number = 10): Promise<TopSellingProduct[]> {
    const startDate = new Date(date.setHours(0, 0, 0, 0));
    const endDate = new Date(date.setHours(23, 59, 59, 999));

    const saleItems = await prisma.saleItem.findMany({
        where: {
            sale: {
                tenantId,
                createdAt: { gte: startDate, lte: endDate },
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
            }
        }
    });

    const productMap = new Map<string, { productName: string; totalQuantity: number; totalRevenue: number }>();

    for(const item of saleItems) {
        const product = item.stockBatch.branchStock.product;
        const productData = productMap.get(product.id) || {
            productName: product.name,
            totalQuantity: 0,
            totalRevenue: 0,
        };
        productData.totalQuantity += item.quantity;
        productData.totalRevenue += Number(item.total);
        productMap.set(product.id, productData);
    }

    return Array.from(productMap.entries()).map(([productId, data]) => ({
        productId,
        ...data
    })).sort((a,b) => b.totalRevenue - a.totalRevenue).slice(0, limit);
}

export type UnsoldProduct = {
    productId: string;
    productName: string;
};

export async function getUnsoldProducts(tenantId: string, date: Date): Promise<UnsoldProduct[]> {
    const startDate = new Date(date.setHours(0, 0, 0, 0));
    const endDate = new Date(date.setHours(23, 59, 59, 999));

    const saleItems = await prisma.saleItem.findMany({
        where: {
            sale: {
                tenantId,
                createdAt: { gte: startDate, lte: endDate },
            }
        },
        include: {
            stockBatch: {
                select: {
                    branchStock: {
                        select: {
                            productId: true
                        }
                    }
                }
            }
        }
    });
    const soldProductIds = new Set(saleItems.map(item => item.stockBatch.branchStock.productId));

    const allProducts = await prisma.product.findMany({
        where: {
            tenantId,
            id: {
                notIn: Array.from(soldProductIds)
            }
        },
        select: {
            id: true,
            name: true,
        }
    });

    return allProducts.map(p => ({ productId: p.id, productName: p.name }));
}

export type ExpiredStockLossData = {
  totalLoss: number;
  expiredBatchesCount: number;
};

export async function calculateExpiredStockLoss(
  tenantId: string,
  dateRange: { from: Date; to: Date }
): Promise<ExpiredStockLossData> {
  const expiredBatches = await prisma.stockBatch.findMany({
    where: {
      branchStock: {
        branch: {
          tenantId: tenantId,
        },
      },
      expiryDate: {
        gte: dateRange.from,
        lte: dateRange.to,
      },
      quantity: {
        gt: 0,
      },
    },
  });

  const totalLoss = expiredBatches.reduce((acc, batch) => {
    return acc + batch.quantity * Number(batch.buyingPrice);
  }, 0);

  return {
    totalLoss,
    expiredBatchesCount: expiredBatches.length,
  };
}

export type StockAdjustmentImpactData = {
  reason: string;
  totalImpact: number;
  transactionCount: number;
};

export async function calculateStockAdjustmentImpact(
  tenantId: string,
  dateRange: { from: Date; to: Date }
): Promise<StockAdjustmentImpactData[]> {
  const adjustments = await prisma.stockAdjustment.findMany({
    where: {
      stockBatch: {
        branchStock: {
          branch: {
            tenantId: tenantId,
          },
        },
      },
      createdAt: {
        gte: dateRange.from,
        lte: dateRange.to,
      },
      quantity: {
        lt: 0, // Only consider negative adjustments as a cost impact
      },
    },
    include: {
      stockBatch: true,
    },
  });

  const impactMap = new Map<string, { totalImpact: number; transactionCount: number }>();

  for (const adj of adjustments) {
    const impact = -1 * adj.quantity * Number(adj.stockBatch.buyingPrice);
    const reason = adj.reason;

    const currentImpact = impactMap.get(reason) || { totalImpact: 0, transactionCount: 0 };

    currentImpact.totalImpact += impact;
    currentImpact.transactionCount += 1;

    impactMap.set(reason, currentImpact);
  }

  const result: StockAdjustmentImpactData[] = Array.from(impactMap.entries()).map(
    ([reason, data]) => ({
      reason,
      ...data,
    })
  ).sort((a, b) => b.totalImpact - a.totalImpact);

  return result;
}

export type CustomerSegmentProfitData = {
  segment: string;
  totalProfit: number;
  totalRevenue: number;
  totalCost: number;
  transactionCount: number;
};

export async function calculateProfitByCustomerSegment(
  tenantId: string,
  dateRange: { from: Date; to: Date }
): Promise<CustomerSegmentProfitData[]> {
  const saleItems = await prisma.saleItem.findMany({
    where: {
      sale: {
        tenantId: tenantId,
        createdAt: {
          gte: dateRange.from,
          lte: dateRange.to,
        },
      },
    },
    include: {
      stockBatch: true,
      sale: true,
    },
  });

  const segmentDataMap = new Map<string, { totalProfit: number; totalRevenue: number; totalCost: number; saleIds: Set<string> }>();

  for (const item of saleItems) {
    const cost = item.quantity * Number(item.stockBatch.buyingPrice);
    const revenue = Number(item.total);
    const profit = revenue - cost;

    const segment = item.sale.paymentMethod;

    const currentSegmentData = segmentDataMap.get(segment) || {
      totalProfit: 0,
      totalRevenue: 0,
      totalCost: 0,
      saleIds: new Set<string>(),
    };

    currentSegmentData.totalProfit += profit;
    currentSegmentData.totalRevenue += revenue;
    currentSegmentData.totalCost += cost;
    currentSegmentData.saleIds.add(item.saleId);

    segmentDataMap.set(segment, currentSegmentData);
  }

  const result: CustomerSegmentProfitData[] = Array.from(segmentDataMap.entries()).map(
    ([segment, data]) => ({
      segment,
      totalProfit: data.totalProfit,
      totalRevenue: data.totalRevenue,
      totalCost: data.totalCost,
      transactionCount: data.saleIds.size,
    })
  ).sort((a, b) => b.totalProfit - a.totalProfit);

  return result;
}
