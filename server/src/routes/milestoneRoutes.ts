import { Router, Response, NextFunction } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware';
import * as milestoneService from '../services/milestoneService';
import { ValidationError } from '../errors';

const router = Router();

router.use(authMiddleware);

// POST /api/milestones/identify
router.post('/identify', async (req, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { date, endDate } = req.body;
    if (!date) {
      throw new ValidationError('缺少 date 参数');
    }
    const result = await milestoneService.identifyMilestones(userId, date, endDate || date);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/milestones/save
router.post('/save', (req, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { keyResultId, date, milestones } = req.body;
    if (!keyResultId || !date || !Array.isArray(milestones) || milestones.length === 0) {
      throw new ValidationError('缺少必要参数: keyResultId, date, milestones');
    }
    const saved = milestoneService.saveMilestones(userId, keyResultId, date, milestones);
    res.json(saved);
  } catch (err) {
    next(err);
  }
});

// PUT /api/milestones/:id
router.put('/:id', (req, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    const { content, date } = req.body;
    if (content === undefined && date === undefined) {
      throw new ValidationError('至少需要提供 content 或 date');
    }
    const updated = milestoneService.updateMilestone(userId, id, { content, date });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/milestones/:id
router.delete('/:id', (req, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    milestoneService.deleteMilestone(userId, id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
