import { Router } from 'express';
import * as crm from '../controllers/crm.controller.js';
import { ROLES } from '../constants/roles.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { updateConfigSchema } from '../validators/activity.validators.js';

const router = Router();

router.use(authenticate, authorize(ROLES.ADMIN));
router.get('/', crm.getConfig);
router.patch('/', validate(updateConfigSchema), crm.updateConfig);

export default router;
