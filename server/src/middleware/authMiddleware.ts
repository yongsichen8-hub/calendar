import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/authService';

export interface AuthenticatedRequest extends Request {
  userId: number;
  username: string;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.token;

  if (!token) {
    res.status(401).json({ error: '未授权，请重新登录' });
    return;
  }

  try {
    const { userId, username } = verifyToken(token);
    (req as AuthenticatedRequest).userId = userId;
    (req as AuthenticatedRequest).username = username;
    next();
  } catch {
    res.status(401).json({ error: '未授权，请重新登录' });
  }
}
