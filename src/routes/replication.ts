import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';
import { Prisma } from '@prisma/client';

const router = Router();

router.use(authenticateJWT);

// Handle Push Replication (Clients pushing local changes up)
// For now, only allow pushing sales, saleItems, customers, and payments to avoid conflicts on central catalog.
const ALLOWED_PUSH_COLLECTIONS = ['sales', 'saleItems', 'customers', 'payments'];

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
  saleItems: 'saleItem',
  prescriptions: 'prescription',
  stockRequests: 'stockRequest',
  payments: 'payment',
  auditLog: 'auditLog',
  shiftSummaries: 'shiftSummary',
  branches: 'branch',
  users: 'user',
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

    let isolationQuery: any = {};
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
    const bId = user.branchId;

    if (isAdmin) {
      if (modelName === 'stockBatch') {
        isolationQuery = { branchStock: { branch: { tenantId: user.tenantId } } };
      } else if (modelName === 'branchStock' || modelName === 'stockRequest') {
        isolationQuery = { branch: { tenantId: user.tenantId } };
      } else if (modelName === 'stockTransfer') {
        isolationQuery = { fromBranch: { tenantId: user.tenantId } };
      } else if (modelName === 'saleItem') {
        isolationQuery = { sale: { tenantId: user.tenantId } };
      } else {
        isolationQuery = { tenantId: user.tenantId };
      }
    } else {
      // Non-admin: Strict branch isolation for branch-specific entities
      if (modelName === 'stockBatch') {
        isolationQuery = { branchStock: { branchId: bId, branch: { tenantId: user.tenantId } } };
      } else if (modelName === 'branchStock' || modelName === 'stockRequest') {
        isolationQuery = { branchId: bId, branch: { tenantId: user.tenantId } };
      } else if (modelName === 'saleItem') {
        isolationQuery = { sale: { branchId: bId, tenantId: user.tenantId } };
      } else if (['sale', 'payment', 'shiftSummary', 'stockTransfer'].includes(modelName as string)) {
        isolationQuery = { branchId: bId, tenantId: user.tenantId };
      } else {
        // Reference entities are still tenant-wide
        isolationQuery = { tenantId: user.tenantId };
      }
    }

    const documents = await delegate.findMany({
      where: {
        ...isolationQuery,
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
      formatted.createdAt = formatted.createdAt ? new Date(formatted.createdAt).getTime() : undefined;
      formatted.updatedAt = formatted.updatedAt ? new Date(formatted.updatedAt).getTime() : undefined;
      formatted.deletedAt = formatted.deletedAt ? new Date(formatted.deletedAt).getTime() : undefined;
      formatted.expiryDate = formatted.expiryDate ? new Date(formatted.expiryDate).getTime() : undefined;
      formatted.startedAt = formatted.startedAt ? new Date(formatted.startedAt).getTime() : undefined;
      formatted.endedAt = formatted.endedAt ? new Date(formatted.endedAt).getTime() : undefined;
      
      // Convert Decimal to number
      for (const key of Object.keys(formatted)) {
        if (formatted[key] !== null && typeof formatted[key] === 'object' && typeof formatted[key].toNumber === 'function') {
           formatted[key] = formatted[key].toNumber();
        } else if (typeof formatted[key] === 'string' && ['buyingPrice', 'sellingPrice', 'totalAmount', 'discount', 'finalAmount', 'amountPaid', 'balance'].includes(key)) {
           formatted[key] = parseFloat(formatted[key]);
        }
      }

      // Sanitize User payload for security and schema compliance
      if (collection === 'users') {
        delete formatted.passwordHash;
        delete formatted.emailVerified;
        delete formatted.image;
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
    require('fs').appendFileSync('/home/geoxhacker/koodeyo/pharmapos/pharmasales-api/replication-error.log', new Date().toISOString() + ' ' + req.params.collection + ': ' + (error.stack || error.message) + '\n');
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

router.post('/:collection/push', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.sendStatus(401);

    const collection = req.params.collection as string;
    
    // Explicitly reject push to non-bidirectional collections or handled via atomic routes
    if (['products', 'branchStocks', 'stockBatches', 'categories', 'suppliers', 'auditLog', 'sales', 'users'].includes(collection)) {
      return res.status(403).json({ error: `Direct push to ${collection} is not allowed` });
    }

    const modelName = COLLECTION_MODEL_MAP[collection];
    if (!modelName) {
      return res.status(404).json({ error: `Collection ${collection} not found for replication` });
    }

    const isArray = Array.isArray(req.body);
    const { pushRow } = isArray ? { pushRow: null } : req.body;
    
    if (!isArray && !pushRow) {
      return res.status(400).json({ error: 'Missing pushRow or array payload' });
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
        
        // Ensure branch isolation for non-admins
        if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
            if (newDocState.branchId && newDocState.branchId !== user.branchId) {
                continue;
            }
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
        if (dataToSave.startedAt) dataToSave.startedAt = new Date(dataToSave.startedAt);
        if (dataToSave.endedAt) dataToSave.endedAt = new Date(dataToSave.endedAt);
        if (dataToSave.expiryDate) dataToSave.expiryDate = new Date(dataToSave.expiryDate);

        // Remove RxDB-specific meta fields that don't exist in Prisma schema
        delete dataToSave._deleted;
        delete dataToSave._meta;
        delete dataToSave._rev;
        delete dataToSave.isNewOffline;

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
