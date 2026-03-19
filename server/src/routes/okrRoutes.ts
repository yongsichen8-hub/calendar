import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware';
import * as okrService from '../services/okrService';
import { ValidationError } from '../errors';

const router = Router();

router.use(authMiddleware);

// GET /api/okr?quarter=
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const quarter = req.query.quarter as string | undefined;
    if (!quarter) {
      throw new ValidationError('缺少 quarter 查询参数');
    }
    const data = okrService.getByQuarter(userId, quarter);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/okr/objectives
router.post('/objectives', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const objective = okrService.createObjective(userId, req.body);
    res.status(201).json(objective);
  } catch (err) {
    next(err);
  }
});

// PUT /api/okr/objectives/:id
router.put('/objectives/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    const objective = okrService.updateObjective(userId, id, req.body);
    res.json(objective);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/okr/objectives/:id
router.delete('/objectives/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    okrService.deleteObjective(userId, id);
    res.json({ message: 'Objective 已删除' });
  } catch (err) {
    next(err);
  }
});

// POST /api/okr/key-results
router.post('/key-results', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const keyResult = okrService.createKeyResult(userId, req.body);
    res.status(201).json(keyResult);
  } catch (err) {
    next(err);
  }
});

// PUT /api/okr/key-results/:id
router.put('/key-results/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    const keyResult = okrService.updateKeyResult(userId, id, req.body);
    res.json(keyResult);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/okr/key-results/:id
router.delete('/key-results/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    okrService.deleteKeyResult(userId, id);
    res.json({ message: 'Key Result 已删除' });
  } catch (err) {
    next(err);
  }
});

export default router;
