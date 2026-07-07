import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';
import { Prisma } from '@prisma/client';

const router = Router();

router.use(authenticateJWT);

// Collection mapping to Prisma models
// Ensures we only replicate allowed models and have the correct prisma delegate.
const COLLECTION_MODEL_MAP: Record<string, keyof typeof prisma> = {
  products: 'product',
  branchStocks: 'branchStock',
  stockBatches: 'stockBatch',
  categories: 'category',
  suppliers: 'supplier',
  customers: 'customer',
  sales: 'sale',
  prescriptions: 'prescription',
  stockRequests: 'stockRequest',
  payments: 'payment',
  auditLog: 'auditLog',
  shiftSummary: 'shiftSummary',
};

// Types for Replication Handlers
type RxDBCheckpoint = {
  id: string;
  updatedAt: number; // Unix timestamp
};

router.get('/:collection/pull', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.sendStatus(401);

    const collection = req.params.collection as string;
    const modelName = COLLECTION_MODEL_MAP[collection];

    if (!modelName) {
      return res.status(404).json({ error: `Collection ${collection} not found for replication` });
    }

    const checkpointId = req.query.id as string || '';
    const checkpointUpdatedAt = req.query.updatedAt ? new Date(parseInt(req.query.updatedAt as string, 10)) : new Date(0);
    const batchSize = parseInt(req.query.batchSize as string, 10) || 50;

    const delegate = prisma[modelName] as any;

    let tenantIsolationQuery: any = { tenantId: user.tenantId };
    
    if (modelName === 'stockBatch') {
      tenantIsolationQuery = { branchStock: { branch: { tenantId: user.tenantId } } };
    } else if (modelName === 'branchStock') {
      tenantIsolationQuery = { branch: { tenantId: user.tenantId } };
    }

    const documents = await delegate.findMany({
      where: {
        ...tenantIsolationQuery,
        OR: [
          { updatedAt: { gt: checkpointUpdatedAt } },
          { updatedAt: checkpointUpdatedAt, id: { gt: checkpointId } }
        ]
      },
      orderBy: [
        { updatedAt: 'asc' },
        { id: 'asc' }
      ],
      take: batchSize
    });

    const formattedDocuments = documents.map((doc: any) => {
      const formatted = { ...doc };
      formatted.createdAt = new Date(formatted.createdAt).getTime();
      formatted.updatedAt = new Date(formatted.updatedAt).getTime();
      if (formatted.deletedAt) {
        formatted.deletedAt = new Date(formatted.deletedAt).getTime();
      }
      
      // Convert Decimal to number
      for (const key of Object.keys(formatted)) {
        if (formatted[key] !== null && typeof formatted[key] === 'object' && typeof formatted[key].toNumber === 'function') {
           formatted[key] = formatted[key].toNumber();
        } else if (typeof formatted[key] === 'string' && ['buyingPrice', 'sellingPrice', 'totalAmount', 'discount', 'finalAmount', 'amountPaid', 'balance'].includes(key)) {
           formatted[key] = parseFloat(formatted[key]);
        }
      }

      return formatted;
    });

    const lastDoc = formattedDocuments.length > 0 ? formattedDocuments[formattedDocuments.length - 1] : null;
    const checkpoint = lastDoc 
      ? { id: lastDoc.id, updatedAt: lastDoc.updatedAt } 
      : { id: checkpointId, updatedAt: checkpointUpdatedAt.getTime() };

    res.json({
      documents: formattedDocuments,
      checkpoint
    });

  } catch (error: any) {
    console.error('Pull replication error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:collection/push', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.sendStatus(401);

    const collection = req.params.collection as string;
    
    // Explicitly reject push to non-bidirectional collections or handled via atomic routes
    if (['products', 'branchStocks', 'stockBatches', 'categories', 'suppliers', 'payments', 'auditLog', 'sales'].includes(collection)) {
      return res.status(403).json({ error: `Direct push to ${collection} is not allowed` });
    }

    const modelName = COLLECTION_MODEL_MAP[collection];
    if (!modelName) {
      return res.status(404).json({ error: `Collection ${collection} not found for replication` });
    }

    const { pushRow } = req.body;
    if (!pushRow) {
      return res.status(400).json({ error: 'Missing pushRow' });
    }

    // In RxDB replication, push payload is an array of pushRows or a single pushRow array
    // This is a simplified handler. A robust one handles conflicts properly.
    const conflicts = [];
    const delegate = prisma[modelName] as any;

    for (const row of Array.isArray(req.body) ? req.body : [pushRow]) {
        const newDocState = row.newDocumentState;
        
        // Ensure tenant isolation
        if (newDocState.tenantId !== user.tenantId) {
            continue;
        }

        const existingDoc = await delegate.findUnique({ where: { id: newDocState.id } });

        if (existingDoc && new Date(existingDoc.updatedAt).getTime() > newDocState.updatedAt) {
            // Conflict: server is newer
            conflicts.push(existingDoc);
            continue;
        }

        // Prepare data for Prisma
        const dataToSave = { ...newDocState };
        dataToSave.updatedAt = new Date(dataToSave.updatedAt);
        if (dataToSave.createdAt) dataToSave.createdAt = new Date(dataToSave.createdAt);
        if (dataToSave.deletedAt) dataToSave.deletedAt = new Date(dataToSave.deletedAt);

        if (existingDoc) {
            await delegate.update({
                where: { id: newDocState.id },
                data: dataToSave
            });
        } else {
            await delegate.create({
                data: dataToSave
            });
        }
    }

    res.json(conflicts);

  } catch (error: any) {
    console.error('Push replication error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:collection/pull/stream', async (req: AuthenticatedRequest, res: Response) => {
  // Setup SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Keep connection alive
  const keepAlive = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(keepAlive);
  });

  // Note: For a fully functioning SSE system tied to Postgres changes, 
  // you would use pg_notify/LISTEN or an event emitter hooked to Prisma operations.
  // We stub this for now.
});

export default router;
