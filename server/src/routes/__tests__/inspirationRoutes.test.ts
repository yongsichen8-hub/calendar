import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

vi.mock('../../services/inspirationService', () => ({
  ensureDefaults: vi.fn(),
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteEntry: vi.fn(),
}));

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
  AuthenticatedRequest: {},
}));

import * as inspirationService from '../../services/inspirationService';
import { inspirationRouter, inspirationCategoryRouter } from '../inspirationRoutes';

const mockedEnsureDefaults = vi.mocked(inspirationService.ensureDefaults);
const mockedListCategories = vi.mocked(inspirationService.listCategories);
const mockedCreateCategory = vi.mocked(inspirationService.createCategory);
const mockedUpdateCategory = vi.mocked(inspirationService.updateCategory);
const mockedDeleteCategory = vi.mocked(inspirationService.deleteCategory);
const mockedList = vi.mocked(inspirationService.list);
const mockedCreate = vi.mocked(inspirationService.create);
const mockedUpdate = vi.mocked(inspirationService.update);
const mockedDeleteEntry = vi.mocked(inspirationService.deleteEntry);

function getHandler(router: any, method: string, path: string) {
  const layer = router.stack.find(
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

describe('inspirationRoutes - entries', () => {
  let next: NextFunction;

  beforeEach(() => {
    vi.resetAllMocks();
    next = vi.fn();
  });

  describe('GET /', () => {
    const handler = getHandler(inspirationRouter, 'get', '/');

    it('should call ensureDefaults and return entries list', () => {
      const entries = [
        { id: 1, userId: 1, categoryId: 1, content: '灵感1', type: 'inspiration' as const, completed: false, createdAt: '2025-01-01', updatedAt: '2025-01-01' },
      ];
      mockedList.mockReturnValue(entries);

      const req = createMockReq();
      const res = createMockRes();

      handler(req, res, next);

      expect(mockedEnsureDefaults).toHaveBeenCalledWith(1);
      expect(mockedList).toHaveBeenCalledWith(1, undefined);
      expect(res.json).toHaveBeenCalledWith(entries);
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass categoryId filter when provided', () => {
      mockedList.mockReturnValue([]);

      const req = createMockReq({ query: { categoryId: '3' } as any });
      const res = createMockRes();

      handler(req, res, next);

      expect(mockedList).toHaveBeenCalledWith(1, 3);
    });

    it('should pass errors to next()', () => {
      const error = new Error('db error');
      mockedEnsureDefaults.mockImplementation(() => { throw error; });

      const req = createMockReq();
      const res = createMockRes();

      handler(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('POST /', () => {
    const handler = getHandler(inspirationRouter, 'post', '/');

    it('should create entry and return 201', () => {
      const entry = { id: 1, userId: 1, categoryId: 1, content: '新灵感', type: 'inspiration' as const, completed: false, createdAt: '2025-01-01', updatedAt: '2025-01-01' };
      mockedCreate.mockReturnValue(entry);

      const body = { content: '新灵感', type: 'inspiration', categoryId: 1 };
      const req = createMockReq({ body });
      const res = createMockRes();

      handler(req, res, next);

      expect(mockedCreate).toHaveBeenCalledWith(1, body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(entry);
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass errors to next()', () => {
      const error = new Error('灵感内容不能为空');
      mockedCreate.mockImplementation(() => { throw error; });

      const req = createMockReq({ body: {} });
      const res = createMockRes();

      handler(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('PUT /:id', () => {
    const handler = getHandler(inspirationRouter, 'put', '/:id');

    it('should update entry and return updated data', () => {
      const entry = { id: 1, userId: 1, categoryId: 1, content: '更新内容', type: 'todo' as const, completed: true, createdAt: '2025-01-01', updatedAt: '2025-01-02' };
      mockedUpdate.mockReturnValue(entry);

      const body = { content: '更新内容', completed: true };
      const req = createMockReq({ params: { id: '1' } as any, body });
      const res = createMockRes();

      handler(req, res, next);

      expect(mockedUpdate).toHaveBeenCalledWith(1, 1, body);
      expect(res.json).toHaveBeenCalledWith(entry);
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass errors to next()', () => {
      const error = new Error('灵感条目不存在');
      mockedUpdate.mockImplementation(() => { throw error; });

      const req = createMockReq({ params: { id: '999' } as any, body: {} });
      const res = createMockRes();

      handler(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('DELETE /:id', () => {
    const handler = getHandler(inspirationRouter, 'delete', '/:id');

    it('should delete entry and return success message', () => {
      mockedDeleteEntry.mockReturnValue(undefined);

      const req = createMockReq({ params: { id: '5' } as any });
      const res = createMockRes();

      handler(req, res, next);

      expect(mockedDeleteEntry).toHaveBeenCalledWith(1, 5);
      expect(res.json).toHaveBeenCalledWith({ message: '灵感条目已删除' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass errors to next()', () => {
      const error = new Error('灵感条目不存在');
      mockedDeleteEntry.mockImplementation(() => { throw error; });

      const req = createMockReq({ params: { id: '1' } as any });
      const res = createMockRes();

      handler(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});

describe('inspirationRoutes - categories', () => {
  let next: NextFunction;

  beforeEach(() => {
    vi.resetAllMocks();
    next = vi.fn();
  });

  describe('GET /', () => {
    const handler = getHandler(inspirationCategoryRouter, 'get', '/');

    it('should call ensureDefaults and return categories list', () => {
      const categories = [
        { id: 1, userId: 1, name: '工作', createdAt: '2025-01-01' },
        { id: 2, userId: 1, name: '学习', createdAt: '2025-01-01' },
      ];
      mockedListCategories.mockReturnValue(categories);

      const req = createMockReq();
      const res = createMockRes();

      handler(req, res, next);

      expect(mockedEnsureDefaults).toHaveBeenCalledWith(1);
      expect(mockedListCategories).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith(categories);
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass errors to next()', () => {
      const error = new Error('db error');
      mockedEnsureDefaults.mockImplementation(() => { throw error; });

      const req = createMockReq();
      const res = createMockRes();

      handler(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('POST /', () => {
    const handler = getHandler(inspirationCategoryRouter, 'post', '/');

    it('should create category and return 201', () => {
      const category = { id: 10, userId: 1, name: '新分类', createdAt: '2025-01-01' };
      mockedCreateCategory.mockReturnValue(category);

      const req = createMockReq({ body: { name: '新分类' } });
      const res = createMockRes();

      handler(req, res, next);

      expect(mockedCreateCategory).toHaveBeenCalledWith(1, '新分类');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(category);
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass errors to next()', () => {
      const error = new Error('灵感分类名称不能为空');
      mockedCreateCategory.mockImplementation(() => { throw error; });

      const req = createMockReq({ body: { name: '' } });
      const res = createMockRes();

      handler(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('PUT /:id', () => {
    const handler = getHandler(inspirationCategoryRouter, 'put', '/:id');

    it('should update category and return updated data', () => {
      const category = { id: 1, userId: 1, name: '更新名称', createdAt: '2025-01-01' };
      mockedUpdateCategory.mockReturnValue(category);

      const req = createMockReq({ params: { id: '1' } as any, body: { name: '更新名称' } });
      const res = createMockRes();

      handler(req, res, next);

      expect(mockedUpdateCategory).toHaveBeenCalledWith(1, 1, '更新名称');
      expect(res.json).toHaveBeenCalledWith(category);
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass errors to next()', () => {
      const error = new Error('灵感分类不存在');
      mockedUpdateCategory.mockImplementation(() => { throw error; });

      const req = createMockReq({ params: { id: '999' } as any, body: { name: 'test' } });
      const res = createMockRes();

      handler(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('DELETE /:id', () => {
    const handler = getHandler(inspirationCategoryRouter, 'delete', '/:id');

    it('should delete category and return success message', () => {
      mockedDeleteCategory.mockReturnValue(undefined);

      const req = createMockReq({ params: { id: '5' } as any });
      const res = createMockRes();

      handler(req, res, next);

      expect(mockedDeleteCategory).toHaveBeenCalledWith(1, 5);
      expect(res.json).toHaveBeenCalledWith({ message: '灵感分类已删除' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass errors to next()', () => {
      const error = new Error('灵感分类不存在');
      mockedDeleteCategory.mockImplementation(() => { throw error; });

      const req = createMockReq({ params: { id: '1' } as any });
      const res = createMockRes();

      handler(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
