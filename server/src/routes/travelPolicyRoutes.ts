import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware';
import * as travelPolicyService from '../services/travelPolicyService';

const router = Router();

router.use(authMiddleware);

// GET /travel-policy
router.get('/travel-policy', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const policy = travelPolicyService.getPolicy(userId);
    res.json(policy);
  } catch (err) { next(err); }
});

// PUT /travel-policy
router.put('/travel-policy', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const policy = travelPolicyService.updatePolicy(userId, req.body);
    res.json(policy);
  } catch (err) { next(err); }
});

// GET /travel-policy/cities — returns city tier lists for frontend dropdown
router.get('/travel-policy/cities', (_req: Request, res: Response) => {
  res.json(travelPolicyService.getCityLists());
});

export default router;
