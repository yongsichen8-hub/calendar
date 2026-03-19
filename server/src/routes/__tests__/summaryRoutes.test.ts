import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

vi.mock('../../services/aiSummaryService', () => ({
  generate: vi.fn(),
  list: vi.fn(),
  getById: vi.fn(),
}));

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
  AuthenticatedRequest: {},
}));

import * as aiSummaryService from '../../services/aiSummaryService';
import { summaryRouter } from '../summaryRoutes';

const mockedGenerate = vi.mocked(aiSummaryService.generate);
const mockedList = vi.mocked(aiSummaryService.list);
const mockedGetById = vi.mocked(aiSummaryService.getById);

function getHandler(method: string, path: string) {
  const layer = (summaryRouter as any).stack.find(
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

describe('summaryRoutes', () => {
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn();
  });

  describe('POST /generate', () => {
    const handler = getHandler('post', '/generate');

    it('should generate summary and return 201', async () => {
      const summary = {
        id: 1,
        userId: 1,
        type: 'daily' as const,
        target: '2025-01-06',
        content: '今日工作总结...',
        createdAt: '2025-01-06',
      };
      mockedGenerate.mockResolvedValue(summary);

      const req = createMockReq({ body: { type: 'daily', target: '2025-01-06' } });
      const res = createMockRes();

      await handler(req, res, next);

      expect(mockedGenerate).toHaveBeenCalledWith(1, 'daily', '2025-01-06');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(summary);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 502 when AI generation fails', async () => {
      mockedGenerate.mockRejectedValue(new Error('AI 总结生成失败，请稍后重试'));

      const req = createMockReq({ body: { type: 'weekly', target: '2025-W02' } });
      const res = createMockRes();

      await handler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.json).toHaveBeenCalledWith({ error: 'AI 总结生成失败，请稍后重试' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass non-AI errors to next()', async () => {
      const error = new Error('db error');
      mockedGenerate.mockRejectedValue(error);

      const req = createMockReq({ body: { type: 'daily', target: '2025-01-06' } });
      const res = createMockRes();

      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('GET /', () => {
    const handler = getHandler('get', '/');

    it('should return summaries list', () => {
      const summaries = [
        { id: 1, userId: 1, type: 'daily' as const, target: '2025-01-06', content: '总结1', createdAt: '2025-01-06' },
        { id: 2, userId: 1, type: 'weekly' as const, target: '2025-W02', content: '总结2', createdAt: '2025-01-07' },
      ];
      mockedList.mockReturnValue(summaries);

      const req = createMockReq();
      const res = createMockRes();

      handler(req, res, next);

      expect(mockedList).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith(summaries);
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

  describe('GET /:id', () => {
    const handler = getHandler('get', '/:id');

    it('should return summary by id', () => {
      const summary = { id: 1, userId: 1, type: 'daily' as const, target: '2025-01-06', content: '总结内容', createdAt: '2025-01-06' };
      mockedGetById.mockReturnValue(summary);

      const req = createMockReq({ params: { id: '1' } as any });
      const res = createMockRes();

      handler(req, res, next);

      expect(mockedGetById).toHaveBeenCalledWith(1, 1);
      expect(res.json).toHaveBeenCalledWith(summary);
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass errors to next() (e.g. NotFoundError)', () => {
      const error = new Error('总结不存在');
      mockedGetById.mockImplementation(() => { throw error; });

      const req = createMockReq({ params: { id: '999' } as any });
      const res = createMockRes();

      handler(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
