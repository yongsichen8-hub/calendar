import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../authMiddleware';

vi.mock('../../services/authService', () => ({
  verifyToken: vi.fn(),
}));

import { verifyToken } from '../../services/authService';

const mockedVerifyToken = vi.mocked(verifyToken);

function createMockReq(cookies: Record<string, string> = {}): Partial<Request> {
  return { cookies };
}

function createMockRes(): Partial<Response> {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('authMiddleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn();
  });

  it('should return 401 when no token cookie is present', () => {
    const req = createMockReq();
    const res = createMockRes();

    authMiddleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: '未授权，请重新登录' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when token is invalid', () => {
    const req = createMockReq({ token: 'invalid-token' });
    const res = createMockRes();

    mockedVerifyToken.mockImplementation(() => {
      throw new Error('invalid token');
    });

    authMiddleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: '未授权，请重新登录' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should inject userId and username and call next when token is valid', () => {
    const req = createMockReq({ token: 'valid-token' });
    const res = createMockRes();

    mockedVerifyToken.mockReturnValue({ userId: 42, username: 'testuser' });

    authMiddleware(req as Request, res as Response, next);

    const authReq = req as AuthenticatedRequest;
    expect(authReq.userId).toBe(42);
    expect(authReq.username).toBe('testuser');
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 401 when cookies object is undefined', () => {
    const req: Partial<Request> = {};
    const res = createMockRes();

    authMiddleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: '未授权，请重新登录' });
    expect(next).not.toHaveBeenCalled();
  });
});
