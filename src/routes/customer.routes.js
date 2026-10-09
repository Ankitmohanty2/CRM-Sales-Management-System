import { Router } from 'express';
import * as crm from '../controllers/crm.controller.js';
import { ROLES } from '../constants/roles.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  createCustomerSchema,
  customerIdSchema,
  customerQuerySchema,
  updateCustomerSchema,
} from '../validators/crm.validators.js';

const router = Router();
const staff = [authenticate, authorize(ROLES.ADMIN, ROLES.SALES_MANAGER, ROLES.SALES_EXECUTIVE)];

router.post('/', ...staff, validate(createCustomerSchema), crm.createCustomer);
router.get('/', ...staff, validate(customerQuerySchema), crm.listCustomers);
router.get('/:id', ...staff, validate(customerIdSchema), crm.getCustomer);
router.patch('/:id', ...staff, validate(updateCustomerSchema), crm.updateCustomer);
router.delete('/:id', ...staff, validate(customerIdSchema), crm.deleteCustomer);

export default router;
