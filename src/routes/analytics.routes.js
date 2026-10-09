import { Router } from 'express';
import * as crm from '../controllers/crm.controller.js';
import { ROLES } from '../constants/roles.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { analyticsQuerySchema } from '../validators/activity.validators.js';

const router = Router();
const staff = [authenticate, authorize(ROLES.ADMIN, ROLES.SALES_MANAGER, ROLES.SALES_EXECUTIVE)];

router.get('/overview', ...staff, validate(analyticsQuerySchema), crm.overview);
router.get('/pipeline', ...staff, validate(analyticsQuerySchema), crm.pipeline);
router.get('/team-performance', ...staff, validate(analyticsQuerySchema), crm.teamPerformance);

export default router;
