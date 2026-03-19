import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

vi.mock('../../services/workEntryService', () => ({
  getByWeek: vi.fn(),
  save: vi.fn(),
  deleteEntry: vi.fn(),
}));

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
  AuthenticatedRequest: {},
}));

import * as workEntryService from '../../services/workEntryService';
import workEntryRouter from '../workEntryRoutes';

const mockedGetByWeek = vi.mocked(workEntryService.getByWeek);
const mockedSave = vi.mocked(workEntryService.save);
const mockedDeleteEntry = vi.mocked(workEntryService.deleteEntry);

function getHandler(method: string, path: string) {
  const layer = (workEntryRouter as any).stack.find(
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

describe('workEntryRoutes', () => {
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn();
  });

  describe('GET /', () => {
    const handler = getHandler('get', '/');

    it('should return work entries for the given week', () => {
      const entries = [
        { id: 1, userId: 1, categoryId: 1, date: '2025-01-06', timeSlot: '09:00-10:00', subCategory: '', description: 'test', createdAt: '2025-01-06', updatedAt: '2025-01-06' },
      ];
      mockedGetByWeek.mockReturnValue(entries);

      const req = createMockReq({ query: { week: '2025-01-06' } as any });
      const res = createMockRes();

      handler(req, res, next);

      expect(mockedGetByWeek).toHaveBeenCalledWith(1, '2025-01-06');
      expect(res.json).toHaveBeenCalledWith(entries);
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass error to next() when week param is missing', () => {
      const req = createMockReq();
      const res = createMockRes();

      handler(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = (next as any).mock.calls[0][0];
      expect(error.message).toBe('缺少 week 查询参数');
    });

    it('should pass errors to next()', () => {
      const error = new Error('db error');
      mockedGetByWeek.mockImplementation(() => { throw error; });

      const req = createMockReq({ query: { week: '2025-01-06' } as any });
      const res = createMockRes();

      handler(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('POST /', () => {
    const handler = getHandler('post', '/');

    it('should save entries and return 201', () => {
      const inputEntries = [
        { date: '2025-01-06', timeSlot: '09:00-10:00', categoryId: 1, subCategory: '', description: 'work' },
      ];
      const savedEntries = [
        { id: 1, userId: 1, categoryId: 1, date: '2025-01-06', timeSlot: '09:00-10:00', subCategory: '', description: 'work', createdAt: '2025-01-06', updatedAt: '2025-01-06' },
      ];
      mockedSave.mockReturnValue(savedEntries);

      const req = createMockReq({ body: { entries: inputEntries } });
      const res = createMockRes();

      handler(req, res, next);

      expect(mockedSave).toHaveBeenCalledWith(1, inputEntries);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(savedEntries);
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass error to next() when entries is not an array', () => {
      const req = createMockReq({ body: { entries: 'not-array' } });
      const res = createMockRes();

      handler(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = (next as any).mock.calls[0][0];
      expect(error.message).toBe('entries 必须是非空数组');
    });

    it('should pass error to next() when entries is empty', () => {
      const req = createMockReq({ body: { entries: [] } });
      const res = createMockRes();

      handler(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = (next as any).mock.calls[0][0];
      expect(error.message).toBe('entries 必须是非空数组');
    });

    it('should pass errors to next()', () => {
      const error = new Error('db error');
      mockedSave.mockImplementation(() => { throw error; });

      const req = createMockReq({ body: { entries: [{ date: '2025-01-06', timeSlot: '09:00-10:00', categoryId: 1, subCategory: '', description: '' }] } });
      const res = createMockRes();

      handler(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('DELETE /:id', () => {
    const handler = getHandler('delete', '/:id');

    it('should delete entry and return success message', () => {
      mockedDeleteEntry.mockReturnValue(undefined);

      const req = createMockReq({ params: { id: '5' } as any });
      const res = createMockRes();

      handler(req, res, next);

      expect(mockedDeleteEntry).toHaveBeenCalledWith(1, 5);
      expect(res.json).toHaveBeenCalledWith({ message: '工作条目已删除' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass errors to next()', () => {
      const error = new Error('工作条目不存在');
      mockedDeleteEntry.mockImplementation(() => { throw error; });

      const req = createMockReq({ params: { id: '999' } as any });
      const res = createMockRes();

      handler(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
