import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware';
import * as ledgerService from '../services/ledgerService';
import * as ledgerAIService from '../services/ledgerAIService';

const router = Router();

router.use(authMiddleware);

// ============================================================
// Management Subjects: /api/ledger/subjects
// ============================================================

// GET /subjects - list all management subjects for current user
router.get('/subjects', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const subjects = ledgerService.listSubjects(userId);
    res.json(subjects);
  } catch (err) {
    next(err);
  }
});

// POST /subjects - create a management subject
router.post('/subjects', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const subject = ledgerService.createSubject(userId, req.body);
    res.status(201).json(subject);
  } catch (err) {
    next(err);
  }
});

// PUT /subjects/:id - update a management subject
router.put('/subjects/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    const subject = ledgerService.updateSubject(userId, id, req.body);
    res.json(subject);
  } catch (err) {
    next(err);
  }
});

// DELETE /subjects/:id - delete a management subject
router.delete('/subjects/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    ledgerService.deleteSubject(userId, id);
    res.json({ message: '管理对象已删除' });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Expense Categories Budget
// ============================================================

// GET /subjects/:subjectId/categories - list categories with summary
router.get('/subjects/:subjectId/categories', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const subjectId = Number(req.params.subjectId);
    const categories = ledgerService.listCategoriesWithSummary(userId, subjectId);
    res.json(categories);
  } catch (err) {
    next(err);
  }
});

// PUT /categories/:id/budget - update category budget
router.put('/categories/:id/budget', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    const category = ledgerService.updateCategoryBudget(userId, id, req.body);
    res.json(category);
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Expense Entries: /api/ledger/subjects/:subjectId/expenses
// ============================================================

// GET /subjects/:subjectId/expenses - list expenses for a subject
router.get('/subjects/:subjectId/expenses', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const subjectId = Number(req.params.subjectId);
    const filters = {
      categoryName: req.query.categoryName as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      keyword: req.query.keyword as string | undefined,
    };
    const expenses = ledgerService.listExpenses(userId, subjectId, filters);
    res.json(expenses);
  } catch (err) {
    next(err);
  }
});

// POST /subjects/:subjectId/expenses - create an expense entry
router.post('/subjects/:subjectId/expenses', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const subjectId = Number(req.params.subjectId);
    const expense = ledgerService.createExpense(userId, subjectId, req.body);
    res.status(201).json(expense);
  } catch (err) {
    next(err);
  }
});

// PUT /expenses/:id - update an expense entry
router.put('/expenses/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    const expense = ledgerService.updateExpense(userId, id, req.body);
    res.json(expense);
  } catch (err) {
    next(err);
  }
});

// DELETE /expenses/:id - delete an expense entry
router.delete('/expenses/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    ledgerService.deleteExpense(userId, id);
    res.json({ message: '开销条目已删除' });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Summary & AI Analysis
// ============================================================

// GET /subjects/:subjectId/summary - get budget summary for a subject
router.get('/subjects/:subjectId/summary', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const subjectId = Number(req.params.subjectId);
    const summary = ledgerService.getSubjectSummary(userId, subjectId);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// POST /subjects/:subjectId/analyze - AI budget analysis (whole subject)
router.post('/subjects/:subjectId/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const subjectId = Number(req.params.subjectId);
    const result = await ledgerAIService.analyzeBudget(userId, subjectId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /categories/:id/analyze - AI analysis for a single category
router.post('/categories/:id/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const categoryId = Number(req.params.id);
    const result = await ledgerAIService.analyzeCategoryBudget(userId, categoryId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
