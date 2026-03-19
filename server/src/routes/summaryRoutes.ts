import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware';
import * as aiSummaryService from '../services/aiSummaryService';

export const summaryRouter = Router();

summaryRouter.use(authMiddleware);

// POST /api/summaries/generate
summaryRouter.post('/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { type, target } = req.body;
    const summary = await aiSummaryService.generate(userId, type, target);
    res.status(201).json(summary);
  } catch (err) {
    if (err instanceof Error && err.message.includes('AI 总结生成失败')) {
      return res.status(502).json({ error: err.message });
    }
    next(err);
  }
});

// GET /api/summaries
summaryRouter.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const summaries = aiSummaryService.list(userId);
    res.json(summaries);
  } catch (err) {
    next(err);
  }
});

// GET /api/summaries/:id
summaryRouter.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    const summary = aiSummaryService.getById(userId, id);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});
