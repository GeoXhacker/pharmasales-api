import { Router, Response } from 'express';
import { prisma } from '../prisma';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Protect all admin routes
router.use(authenticateJWT);

import bcrypt from 'bcryptjs';

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
      select: { id: true, name: true, code: true, address: true, phone: true, email: true, isActive: true },
      orderBy: { name: 'asc' }
    });

    res.json(branches);
  } catch (error: any) {
    console.error('Error fetching branches:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /admin/branches
router.post('/branches', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user || !user.tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { name, code, address, phone, email } = req.body;
    
    if (!name || !code || !address) {
      return res.status(400).json({ error: 'Name, code, and address are required' });
    }

    const newBranch = await prisma.branch.create({
      data: {
        name,
        code,
        address,
        phone,
        email,
        tenantId: user.tenantId
      }
    });

    res.status(201).json(newBranch);
  } catch (error: any) {
    console.error('Error creating branch:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /admin/branches/:id
router.patch('/branches/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user || !user.tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const { name, code, address, phone, email, isActive } = req.body;

    const dataToUpdate: any = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (code !== undefined) dataToUpdate.code = code;
    if (address !== undefined) dataToUpdate.address = address;
    if (phone !== undefined) dataToUpdate.phone = phone;
    if (email !== undefined) dataToUpdate.email = email;
    if (isActive !== undefined) dataToUpdate.isActive = isActive;

    const updatedBranch = await prisma.branch.update({
      where: { id, tenantId: user.tenantId },
      data: dataToUpdate
    });

    res.json(updatedBranch);
  } catch (error: any) {
    console.error('Error updating branch:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /admin/users
router.post('/users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user || !user.tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // A real implementation would enforce that the caller has MANAGER/ADMIN role
    const { name, email, password, role } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
        data: {
            name,
            email,
            passwordHash: hashedPassword,
            role: role || 'CASHIER',
            tenantId: user.tenantId,
            branchId: user.branchId, // Or assignable if caller is super admin
        },
    });

    res.status(201).json({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      isActive: newUser.isActive,
      createdAt: newUser.createdAt
    });
  } catch (error: any) {
    console.error('Failed to create user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /admin/users/:id
router.patch('/users/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user || !user.tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const { name, role, isActive, branchId, password } = req.body;

    const dataToUpdate: any = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (role !== undefined) dataToUpdate.role = role;
    if (isActive !== undefined) dataToUpdate.isActive = isActive;
    if (branchId !== undefined) dataToUpdate.branchId = branchId;

    if (password) {
      dataToUpdate.passwordHash = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
        where: { id, tenantId: user.tenantId },
        data: dataToUpdate,
    });

    res.json({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      isActive: updatedUser.isActive,
    });
  } catch (error: any) {
    console.error('Failed to update user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
