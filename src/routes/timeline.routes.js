import { Router } from 'express';
import * as crm from '../controllers/crm.controller.js';
import { ROLES } from '../constants/roles.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { timelineQuerySchema } from '../validators/activity.validators.js';

const router = Router();
const staff = [authenticate, authorize(ROLES.ADMIN, ROLES.SALES_MANAGER, ROLES.SALES_EXECUTIVE)];

router.get('/leads/:id', ...staff, validate(timelineQuerySchema), crm.leadTimeline);
router.get('/customers/:id', ...staff, validate(timelineQuerySchema), crm.customerTimeline);
router.get('/deals/:id', ...staff, validate(timelineQuerySchema), crm.dealTimeline);

export default router;
