import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../constants/roles.js';
import {
  createUserSchema,
  updateUserSchema,
  userIdSchema,
  userQuerySchema,
  userStatusSchema,
} from '../validators/auth.validators.js';

const router = Router();
const admin = [authenticate, authorize(ROLES.ADMIN)];

router.post('/', ...admin, validate(createUserSchema), userController.createUser);
router.get('/', ...admin, validate(userQuerySchema), userController.listUsers);
router.get('/:id', ...admin, validate(userIdSchema), userController.getUser);
router.patch('/:id/status', ...admin, validate(userStatusSchema), userController.updateUserStatus);
router.patch('/:id', ...admin, validate(updateUserSchema), userController.updateUser);
router.delete('/:id', ...admin, validate(userIdSchema), userController.deleteUser);

export default router;
