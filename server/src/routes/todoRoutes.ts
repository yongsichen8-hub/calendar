import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import * as todoService from '../services/todoService';
import { ValidationError } from '../errors';

const router = Router();

// GET /api/todos/deadline-reminders
router.get('/deadline-reminders', (req, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const todos = todoService.getDeadlineReminders(userId, todayStr);
    res.json(todos);
  } catch (err) {
    next(err);
  }
});

// GET /api/todos?date=YYYY-MM-DD
router.get('/', (req, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const date = req.query.date as string | undefined;
    if (!date) {
      throw new ValidationError('缺少 date 查询参数');
    }
    const todos = todoService.getByDate(userId, date);
    res.json(todos);
  } catch (err) {
    next(err);
  }
});

// POST /api/todos
router.post('/', (req, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { date, content, deadline } = req.body;
    if (!date || !content) {
      throw new ValidationError('缺少 date 或 content 参数');
    }
    const todo = todoService.create(userId, date, content, deadline);
    res.status(201).json(todo);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/todos/:id
router.patch('/:id', (req, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as unknown as AuthenticatedRequest;
    const id = Number(req.params.id);
    const { completed } = req.body;
    if (completed === undefined) {
      throw new ValidationError('缺少 completed 参数');
    }
    const todo = todoService.updateCompleted(userId, id, completed);
    res.json(todo);
  } catch (err) {
    next(err);
  }
});

// POST /api/todos/:id/postpone
router.post('/:id/postpone', (req, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as unknown as AuthenticatedRequest;
    const id = Number(req.params.id);
    const todo = todoService.postpone(userId, id);
    res.json(todo);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/todos/:id
router.delete('/:id', (req, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as unknown as AuthenticatedRequest;
    const id = Number(req.params.id);
    todoService.deleteTodo(userId, id);
    res.json({ message: '待办事项已删除' });
  } catch (err) {
    next(err);
  }
});

export default router;
