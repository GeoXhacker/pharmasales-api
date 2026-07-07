import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';

export interface AuthUser {
  id: string;
  role: UserRole;
  tenantId: string;
  branchId?: string | null;
  name?: string | null;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export const authenticateJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-for-dev', (err, user) => {
      if (err) {
        return res.sendStatus(403);
      }

      req.user = user as AuthUser;
      next();
    });
  } else {
    res.sendStatus(401);
  }
};
