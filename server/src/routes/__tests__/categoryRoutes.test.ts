import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

vi.mock('../../services/categoryService', () => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteCategory: vi.fn(),
}));

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
  AuthenticatedRequest: {},
}));

import * as categoryService from '../../services/categoryService';
import categoryRouter from '../categoryRoutes';

const mockedList = vi.mocked(categoryService.list);
const mockedCreate = vi.mocked(categoryService.create);
const mockedUpdate = vi.mocked(categoryService.update);
const mockedDelete = vi.mocked(categoryService.deleteCategory);

// Extract route handlers - skip the first layer (authMiddleware) and find by path
function getHandler(method: string, path: string) {
  const layer = (categoryRouter as any).stack.find(
    (l: any) => l.route?.path === path && l.route?.methods[method]
  );
  return layer?.route?.stack[0]?.handle;
}

function createMockReq(overrides: Partial<Request> & { userId?: number } = {}): Partial<Request> & { userId: number } {
  return {
    userId: 1,
    body: {},
    params: {} as any,
    query: {} as any,
    ...overrides,
  } as any;
}

function createMockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Partial<Response>;
}

describe('categoryRoutes', () => {
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn();
  });

  describe('GET /', () => {
    const handler = getHandler('get', '/');

    it('should return categories list', () => {
      const categories = [
        { id: 1, userId: 1, name: '高管', color: '#FFB5B5', isDefault: false, createdAt: '2025-01-01', workEntryCount: 3, objectiveCount: 1 },
      ];
      mockedList.mockReturnValue(categories);

      const req = createMockReq();
      const res = createMockRes();

      handler(req, res, next);

      expect(mockedList).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith(categories);
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass errors to next()', () => {
      const error = new Error('db error');
      mockedList.mockImplementation(() => { throw error; });

      const req = createMockReq();
      const res = createMockRes();

      handler(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('POST /', () => {
    const handler = getHandler('post', '/');

    it('should create category and return 201', () => {
      const category = { id: 10, userId: 1, name: '新分类', color: '#FFD5E5', isDefault: false, createdAt: '2025-01-01' };
      mockedCreate.mockReturnValue(category);

      const req = createMockReq({ body: { name: '新分类' } });
      const res = createMockRes();

      handler(req, res, next);

      expect(mockedCreate).toHaveBeenCalledWith(1, '新分类');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(category);
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass errors to next()', () => {
      const error = new Error('分类名称不能为空');
      mockedCreate.mockImplementation(() => { throw error; });

      const req = createMockReq({ body: { name: '' } });
      const res = createMockRes();

      handler(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('PUT /:id', () => {
    const handler = getHandler('put', '/:id');

    it('should update category and return updated data', () => {
      const category = { id: 1, userId: 1, name: '更新名称', color: '#FFB5B5', isDefault: false, createdAt: '2025-01-01' };
      mockedUpdate.mockReturnValue(category);

      const req = createMockReq({ params: { id: '1' } as any, body: { name: '更新名称' } });
      const res = createMockRes();

      handler(req, res, next);

      expect(mockedUpdate).toHaveBeenCalledWith(1, 1, '更新名称');
      expect(res.json).toHaveBeenCalledWith(category);
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass errors to next()', () => {
      const error = new Error('分类不存在');
      mockedUpdate.mockImplementation(() => { throw error; });

      const req = createMockReq({ params: { id: '999' } as any, body: { name: 'test' } });
      const res = createMockRes();

      handler(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('DELETE /:id', () => {
    const handler = getHandler('delete', '/:id');

    it('should delete category and return success message', () => {
      mockedDelete.mockReturnValue(undefined);

      const req = createMockReq({ params: { id: '5' } as any });
      const res = createMockRes();

      handler(req, res, next);

      expect(mockedDelete).toHaveBeenCalledWith(1, 5, undefined);
      expect(res.json).toHaveBeenCalledWith({ message: '分类已删除' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass migrateToId query parameter', () => {
      mockedDelete.mockReturnValue(undefined);

      const req = createMockReq({ params: { id: '5' } as any, query: { migrateToId: '2' } as any });
      const res = createMockRes();

      handler(req, res, next);

      expect(mockedDelete).toHaveBeenCalledWith(1, 5, 2);
    });

    it('should pass errors to next()', () => {
      const error = new Error('默认分类不可删除');
      mockedDelete.mockImplementation(() => { throw error; });

      const req = createMockReq({ params: { id: '1' } as any });
      const res = createMockRes();

      handler(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
