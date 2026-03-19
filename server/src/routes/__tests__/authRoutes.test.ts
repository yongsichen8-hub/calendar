import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

vi.mock('../../services/authService', () => ({
  register: vi.fn(),
  login: vi.fn(),
}));

import { register, login } from '../../services/authService';
import authRouter from '../authRoutes';

const mockedRegister = vi.mocked(register);
const mockedLogin = vi.mocked(login);

// Extract route handlers from the router
function getHandler(method: string, path: string) {
  const layer = (authRouter as any).stack.find(
    (l: any) => l.route?.path === path && l.route?.methods[method]
  );
  return layer?.route?.stack[0]?.handle;
}

function createMockReq(body: Record<string, any> = {}): Partial<Request> {
  return { body };
}

function createMockRes(): Partial<Response> & { _cookies: Record<string, any>; _clearedCookies: string[] } {
  const res: any = { _cookies: {}, _clearedCookies: [] };
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.cookie = vi.fn((name: string, value: string, opts: any) => {
    res._cookies[name] = { value, opts };
    return res;
  });
  res.clearCookie = vi.fn((name: string, opts: any) => {
    res._clearedCookies.push(name);
    return res;
  });
  return res;
}

describe('authRoutes', () => {
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn();
  });

  describe('POST /register', () => {
    const handler = getHandler('post', '/register');

    it('should register user, set cookie, and return 201', async () => {
      const user = { id: 1, username: 'alice', createdAt: '2025-01-01' };
      mockedRegister.mockResolvedValue({ user, token: 'jwt-token-123' });

      const req = createMockReq({ username: 'alice', password: 'secret123' });
      const res = createMockRes();

      await handler(req, res, next);

      expect(mockedRegister).toHaveBeenCalledWith('alice', 'secret123');
      expect(res.cookie).toHaveBeenCalledWith('token', 'jwt-token-123', {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ user });
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass errors to next()', async () => {
      const error = new Error('用户名已存在');
      mockedRegister.mockRejectedValue(error);

      const req = createMockReq({ username: 'alice', password: 'secret123' });
      const res = createMockRes();

      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('POST /login', () => {
    const handler = getHandler('post', '/login');

    it('should login user, set cookie, and return user', async () => {
      const user = { id: 1, username: 'alice', createdAt: '2025-01-01' };
      mockedLogin.mockResolvedValue({ user, token: 'jwt-token-456' });

      const req = createMockReq({ username: 'alice', password: 'secret123' });
      const res = createMockRes();

      await handler(req, res, next);

      expect(mockedLogin).toHaveBeenCalledWith('alice', 'secret123');
      expect(res.cookie).toHaveBeenCalledWith('token', 'jwt-token-456', {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });
      expect(res.json).toHaveBeenCalledWith({ user });
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass errors to next()', async () => {
      const error = new Error('用户名或密码错误');
      mockedLogin.mockRejectedValue(error);

      const req = createMockReq({ username: 'alice', password: 'wrong' });
      const res = createMockRes();

      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('POST /logout', () => {
    const handler = getHandler('post', '/logout');

    it('should clear cookie and return success message', () => {
      const req = createMockReq();
      const res = createMockRes();

      handler(req, res, next);

      expect(res.clearCookie).toHaveBeenCalledWith('token', { path: '/' });
      expect(res.json).toHaveBeenCalledWith({ message: '已退出登录' });
    });
  });
});
