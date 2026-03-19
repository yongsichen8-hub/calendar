import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware';
import * as travelOrderService from '../services/travelOrderService';

const router = Router();

router.use(authMiddleware);

// GET /subjects/:subjectId/travel-orders
router.get('/subjects/:subjectId/travel-orders', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const subjectId = Number(req.params.subjectId);
    const orders = travelOrderService.listTravelOrders(userId, subjectId);
    res.json(orders);
  } catch (err) { next(err); }
});

// POST /subjects/:subjectId/travel-orders
router.post('/subjects/:subjectId/travel-orders', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const subjectId = Number(req.params.subjectId);
    const order = travelOrderService.createTravelOrder(userId, subjectId, req.body);
    res.status(201).json(order);
  } catch (err) { next(err); }
});

// PUT /travel-orders/:id
router.put('/travel-orders/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    const order = travelOrderService.updateTravelOrder(userId, id, req.body);
    res.json(order);
  } catch (err) { next(err); }
});

// DELETE /travel-orders/:id
router.delete('/travel-orders/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    travelOrderService.deleteTravelOrder(userId, id);
    res.json({ message: '出差单已删除' });
  } catch (err) { next(err); }
});

// POST /travel-orders/:id/expenses - add expense to travel order
router.post('/travel-orders/:id/expenses', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    const order = travelOrderService.addTravelExpense(userId, id, req.body);
    res.status(201).json(order);
  } catch (err) { next(err); }
});

// PUT /travel-expenses/:id
router.put('/travel-expenses/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    const order = travelOrderService.updateTravelExpense(userId, id, req.body);
    res.json(order);
  } catch (err) { next(err); }
});

// DELETE /travel-expenses/:id
router.delete('/travel-expenses/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    const order = travelOrderService.deleteTravelExpense(userId, id);
    res.json(order);
  } catch (err) { next(err); }
});

export default router;
