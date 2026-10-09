import { Router } from 'express';
import * as crm from '../controllers/crm.controller.js';
import { ROLES } from '../constants/roles.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  activityIdSchema,
  activityQuerySchema,
  createActivitySchema,
  updateActivitySchema,
} from '../validators/activity.validators.js';

const router = Router();
const staff = [authenticate, authorize(ROLES.ADMIN, ROLES.SALES_MANAGER, ROLES.SALES_EXECUTIVE)];

router.post('/', ...staff, validate(createActivitySchema), crm.createActivity);
router.get('/', ...staff, validate(activityQuerySchema), crm.listActivities);
router.get('/:id', ...staff, validate(activityIdSchema), crm.getActivity);
router.patch('/:id/complete', ...staff, validate(activityIdSchema), crm.completeActivity);
router.patch('/:id', ...staff, validate(updateActivitySchema), crm.updateActivity);
router.delete('/:id', ...staff, validate(activityIdSchema), crm.deleteActivity);

export default router;
