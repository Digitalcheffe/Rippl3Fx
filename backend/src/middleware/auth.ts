import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../auth/jwt';
import { getCookie } from '../utils/cookies';

export interface AuthRequest extends Request {
  user?: { userId: number };
}

// Route-level middleware — always requires a valid token
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = getCookie(req, 'token');
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Global middleware — protects /api/* except /api/auth/* and /api/health
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.path.startsWith('/api/auth') || req.path === '/api/health') {
    next();
    return;
  }

  if (!req.path.startsWith('/api')) {
    next();
    return;
  }

  requireAuth(req, res, next);
}
