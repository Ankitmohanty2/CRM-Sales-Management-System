import { Router } from 'express';
import { health } from '../controllers/health.controller.js';
import activityRoutes from './activity.routes.js';
import analyticsRoutes from './analytics.routes.js';
import authRoutes from './auth.routes.js';
import configRoutes from './config.routes.js';
import customerRoutes from './customer.routes.js';
import dealRoutes from './deal.routes.js';
import leadRoutes from './lead.routes.js';
import timelineRoutes from './timeline.routes.js';
import userRoutes from './user.routes.js';

const router = Router();

router.get('/health', health);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/leads', leadRoutes);
router.use('/customers', customerRoutes);
router.use('/deals', dealRoutes);
router.use('/activities', activityRoutes);
router.use('/timeline', timelineRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/config', configRoutes);

export default router;
