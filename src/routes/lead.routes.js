import { Router } from 'express';
import * as crm from '../controllers/crm.controller.js';
import { ROLES } from '../constants/roles.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  assignmentSchema,
  convertLeadSchema,
  createLeadSchema,
  leadIdSchema,
  leadQuerySchema,
  leadStatusSchema,
  updateLeadSchema,
} from '../validators/lead.validators.js';

const router = Router();
const staff = [authenticate, authorize(ROLES.ADMIN, ROLES.SALES_MANAGER, ROLES.SALES_EXECUTIVE)];

router.post('/', ...staff, validate(createLeadSchema), crm.createLead);
router.get('/', ...staff, validate(leadQuerySchema), crm.listLeads);
router.get('/:id', ...staff, validate(leadIdSchema), crm.getLead);
router.patch('/:id/status', ...staff, validate(leadStatusSchema), crm.updateLeadStatus);
router.patch('/:id/assignment', ...staff, validate(assignmentSchema), crm.assignLead);
router.post('/:id/convert', ...staff, validate(convertLeadSchema), crm.convertLead);
router.patch('/:id', ...staff, validate(updateLeadSchema), crm.updateLead);
router.delete('/:id', ...staff, validate(leadIdSchema), crm.deleteLead);

export default router;
