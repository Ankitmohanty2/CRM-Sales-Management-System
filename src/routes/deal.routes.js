import { Router } from 'express';
import * as crm from '../controllers/crm.controller.js';
import { ROLES } from '../constants/roles.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { assignmentSchema } from '../validators/lead.validators.js';
import {
  createDealSchema,
  dealIdSchema,
  dealQuerySchema,
  dealStageSchema,
  reopenDealSchema,
  updateDealSchema,
} from '../validators/crm.validators.js';

const router = Router();
const staff = [authenticate, authorize(ROLES.ADMIN, ROLES.SALES_MANAGER, ROLES.SALES_EXECUTIVE)];

router.post('/', ...staff, validate(createDealSchema), crm.createDeal);
router.get('/', ...staff, validate(dealQuerySchema), crm.listDeals);
router.get('/:id', ...staff, validate(dealIdSchema), crm.getDeal);
router.patch('/:id/stage', ...staff, validate(dealStageSchema), crm.updateDealStage);
router.patch('/:id/assignment', ...staff, validate(assignmentSchema), crm.assignDeal);
router.post('/:id/reopen', ...staff, validate(reopenDealSchema), crm.reopenDeal);
router.patch('/:id', ...staff, validate(updateDealSchema), crm.updateDeal);
router.delete('/:id', ...staff, validate(dealIdSchema), crm.deleteDeal);

export default router;
