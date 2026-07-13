import { Router, Response } from 'express';
import { prisma } from '../prisma';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Protect all admin routes
router.use(authenticateJWT);

// GET /admin/branches/all
router.get('/branches/all', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    
    // Only users with a tenantId should be able to fetch their branches
    if (!user || !user.tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Admins and Super Admins might need this, or any user to switch context if permitted
    const branches = await prisma.branch.findMany({
      where: { tenantId: user.tenantId },
      select: { id: true, name: true, code: true, address: true },
      orderBy: { name: 'asc' }
    });

    res.json(branches);
  } catch (error: any) {
    console.error('Error fetching branches:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
