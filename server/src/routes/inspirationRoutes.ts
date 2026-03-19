import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware';
import * as inspirationService from '../services/inspirationService';

export const inspirationRouter = Router();
export const inspirationCategoryRouter = Router();

inspirationRouter.use(authMiddleware);
inspirationCategoryRouter.use(authMiddleware);

// ============================================================
// Inspiration Entries: /api/inspirations
// ============================================================

// GET /api/inspirations
inspirationRouter.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    inspirationService.ensureDefaults(userId);
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
    const entries = inspirationService.list(userId, categoryId);
    res.json(entries);
  } catch (err) {
    next(err);
  }
});

// POST /api/inspirations
inspirationRouter.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const entry = inspirationService.create(userId, req.body);
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
});

// PUT /api/inspirations/:id
inspirationRouter.put('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    const entry = inspirationService.update(userId, id, req.body);
    res.json(entry);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/inspirations/:id
inspirationRouter.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    inspirationService.deleteEntry(userId, id);
    res.json({ message: '灵感条目已删除' });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Inspiration Categories: /api/inspiration-categories
// ============================================================

// GET /api/inspiration-categories
inspirationCategoryRouter.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    inspirationService.ensureDefaults(userId);
    const categories = inspirationService.listCategories(userId);
    res.json(categories);
  } catch (err) {
    next(err);
  }
});

// POST /api/inspiration-categories
inspirationCategoryRouter.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { name } = req.body;
    const category = inspirationService.createCategory(userId, name);
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
});

// PUT /api/inspiration-categories/:id
inspirationCategoryRouter.put('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    const { name } = req.body;
    const category = inspirationService.updateCategory(userId, id, name);
    res.json(category);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/inspiration-categories/:id
inspirationCategoryRouter.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    inspirationService.deleteCategory(userId, id);
    res.json({ message: '灵感分类已删除' });
  } catch (err) {
    next(err);
  }
});
