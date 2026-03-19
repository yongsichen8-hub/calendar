import { Router, Response, NextFunction } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware';
import * as workEntryService from '../services/workEntryService';
import { ValidationError } from '../errors';

const router = Router();

router.use(authMiddleware);

// GET /api/work-entries?week=
router.get('/', (req, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const week = req.query.week as string | undefined;
    if (!week) {
      throw new ValidationError('缺少 week 查询参数');
    }
    const entries = workEntryService.getByWeek(userId, week);
    res.json(entries);
  } catch (err) {
    next(err);
  }
});

// POST /api/work-entries
router.post('/', (req, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { entries } = req.body;
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new ValidationError('entries 必须是非空数组');
    }
    const saved = workEntryService.save(userId, entries);
    res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/work-entries/:id
router.delete('/:id', (req, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    workEntryService.deleteEntry(userId, id);
    res.json({ message: '工作条目已删除' });
  } catch (err) {
    next(err);
  }
});

export default router;
