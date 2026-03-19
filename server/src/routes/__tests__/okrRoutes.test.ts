import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

vi.mock('../../services/okrService', () => ({
  getByQuarter: vi.fn(),
  createObjective: vi.fn(),
  updateObjective: vi.fn(),
  deleteObjective: vi.fn(),
  createKeyResult: vi.fn(),
  updateKeyResult: vi.fn(),
  deleteKeyResult: vi.fn(),
}));

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
  AuthenticatedRequest: {},
}));

import * as okrService from '../../services/okrService';
import okrRouter from '../okrRoutes';

const mockedGetByQuarter = vi.mocked(okrService.getByQuarter);
const mockedCreateObjective = vi.mocked(okrService.createObjective);
const mockedUpdateObjective = vi.mocked(okrService.updateObjective);
const mockedDeleteObjective = vi.mocked(okrService.deleteObjective);
const mockedCreateKeyResult = vi.mocked(okrService.createKeyResult);
const mockedUpdateKeyResult = vi.mocked(okrService.updateKeyResult);
const mockedDeleteKeyResult = vi.mocked(okrService.deleteKeyResult);

function getHandler(method: string, path: string) {
  const layer = (okrRouter as any).stack.find(
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

describe('okrRoutes', () => {
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn();
  });

  describe('GET /', () => {
    const handler = getHandler('get', '/');

    it('should return OKR data for the given quarter', () => {
      const data = { quarter: '2025-Q1', objectives: [] };
      mockedGetByQuarter.mockReturnValue(data);

      const req = createMockReq({ query: { quarter: '2025-Q1' } as any });
      const res = createMockRes();

      handler(req, res, next);

      expect(mockedGetByQuarter).toHaveBeenCalledWith(1, '2025-Q1');
      expect(res.json).toHaveBeenCalledWith(data);
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass ValidationError to next() when quarter is missing', () => {
      const req = createMockReq();
      const res = createMockRes();

      handler(req, res, next);

      expect(next).toHaveBeenCalled();
      const err = (next as any).mock.calls[0][0];
      expect(err.message).toBe('缺少 quarter 查询参数');
    });

    it('should pass errors to next()', () => {
      const error = new Error('db error');
      mockedGetByQuarter.mockImplementation(() => { throw error; });

      const req = createMockReq({ query: { quarter: '2025-Q1' } as any });
      const res = createMockRes();

      handler(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('POST /objectives', () => {
    const handler = getHandler('post', '/objectives');

    it('should create objective and return 201', () => {
      const objective = { id: 1, userId: 1, categoryId: 2, quarter: '2025-Q1', title: 'Test', description: '', keyResults: [], createdAt: '', updatedAt: '' };
      mockedCreateObjective.mockReturnValue(objective);

      const body = { categoryId: 2, quarter: '2025-Q1', title: 'Test', description: '' };
      const req = createMockReq({ body });
      const res = createMockRes();

      handler(req, res, next);

      expect(mockedCreateObjective).toHaveBeenCalledWith(1, body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(objective);
    });

    it('should pass errors to next()', () => {
      const error = new Error('Objective 标题不能为空');
      mockedCreateObjective.mockImplementation(() => { throw error; });

      const req = createMockReq({ body: {} });
      const res = createMockRes();

      handler(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('PUT /objectives/:id', () => {
    const handler = getHandler('put', '/objectives/:id');

    it('should update objective and return updated data', () => {
      const objective = { id: 1, userId: 1, categoryId: 2, quarter: '2025-Q1', title: 'Updated', description: '', keyResults: [], createdAt: '', updatedAt: '' };
      mockedUpdateObjective.mockReturnValue(objective);

      const body = { title: 'Updated' };
      const req = createMockReq({ params: { id: '1' } as any, body });
      const res = createMockRes();

      handler(req, res, next);

      expect(mockedUpdateObjective).toHaveBeenCalledWith(1, 1, body);
      expect(res.json).toHaveBeenCalledWith(objective);
    });

    it('should pass errors to next()', () => {
      const error = new Error('Objective 不存在');
      mockedUpdateObjective.mockImplementation(() => { throw error; });

      const req = createMockReq({ params: { id: '999' } as any, body: {} });
      const res = createMockRes();

      handler(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('DELETE /objectives/:id', () => {
    const handler = getHandler('delete', '/objectives/:id');

    it('should delete objective and return success message', () => {
      mockedDeleteObjective.mockReturnValue(undefined);

      const req = createMockReq({ params: { id: '3' } as any });
      const res = createMockRes();

      handler(req, res, next);

      expect(mockedDeleteObjective).toHaveBeenCalledWith(1, 3);
      expect(res.json).toHaveBeenCalledWith({ message: 'Objective 已删除' });
    });

    it('should pass errors to next()', () => {
      const error = new Error('Objective 不存在');
      mockedDeleteObjective.mockImplementation(() => { throw error; });

      const req = createMockReq({ params: { id: '1' } as any });
      const res = createMockRes();

      handler(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('POST /key-results', () => {
    const handler = getHandler('post', '/key-results');

    it('should create key result and return 201', () => {
      const kr = { id: 1, objectiveId: 1, description: 'KR1', progress: 0, createdAt: '', updatedAt: '' };
      mockedCreateKeyResult.mockReturnValue(kr);

      const body = { objectiveId: 1, description: 'KR1' };
      const req = createMockReq({ body });
      const res = createMockRes();

      handler(req, res, next);

      expect(mockedCreateKeyResult).toHaveBeenCalledWith(1, body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(kr);
    });

    it('should pass errors to next()', () => {
      const error = new Error('Key Result 描述不能为空');
      mockedCreateKeyResult.mockImplementation(() => { throw error; });

      const req = createMockReq({ body: {} });
      const res = createMockRes();

      handler(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('PUT /key-results/:id', () => {
    const handler = getHandler('put', '/key-results/:id');

    it('should update key result and return updated data', () => {
      const kr = { id: 1, objectiveId: 1, description: 'Updated KR', progress: 75, createdAt: '', updatedAt: '' };
      mockedUpdateKeyResult.mockReturnValue(kr);

      const body = { description: 'Updated KR', progress: 75 };
      const req = createMockReq({ params: { id: '1' } as any, body });
      const res = createMockRes();

      handler(req, res, next);

      expect(mockedUpdateKeyResult).toHaveBeenCalledWith(1, 1, body);
      expect(res.json).toHaveBeenCalledWith(kr);
    });

    it('should pass errors to next()', () => {
      const error = new Error('Key Result 不存在');
      mockedUpdateKeyResult.mockImplementation(() => { throw error; });

      const req = createMockReq({ params: { id: '999' } as any, body: {} });
      const res = createMockRes();

      handler(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('DELETE /key-results/:id', () => {
    const handler = getHandler('delete', '/key-results/:id');

    it('should delete key result and return success message', () => {
      mockedDeleteKeyResult.mockReturnValue(undefined);

      const req = createMockReq({ params: { id: '5' } as any });
      const res = createMockRes();

      handler(req, res, next);

      expect(mockedDeleteKeyResult).toHaveBeenCalledWith(1, 5);
      expect(res.json).toHaveBeenCalledWith({ message: 'Key Result 已删除' });
    });

    it('should pass errors to next()', () => {
      const error = new Error('Key Result 不存在');
      mockedDeleteKeyResult.mockImplementation(() => { throw error; });

      const req = createMockReq({ params: { id: '1' } as any });
      const res = createMockRes();

      handler(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
