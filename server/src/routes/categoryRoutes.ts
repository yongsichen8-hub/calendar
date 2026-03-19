import { Router, Response, NextFunction } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware';
import * as categoryService from '../services/categoryService';

const router = Router();

router.use(authMiddleware);

// GET /api/categories
router.get('/', (req, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const categories = categoryService.list(userId);
    res.json(categories);
  } catch (err) {
    next(err);
  }
});

// POST /api/categories
router.post('/', (req, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { name } = req.body;
    const category = categoryService.create(userId, name);
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
});

// PUT /api/categories/:id
router.put('/:id', (req, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    const { name } = req.body;
    const category = categoryService.update(userId, id, name);
    res.json(category);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/categories/:id
router.delete('/:id', (req, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    const migrateToId = req.query.migrateToId ? Number(req.query.migrateToId) : undefined;
    categoryService.deleteCategory(userId, id, migrateToId);
    res.json({ message: '分类已删除' });
  } catch (err) {
    next(err);
  }
});

export default router;
