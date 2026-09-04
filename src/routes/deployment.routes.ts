import { Router } from 'express';
import { getDeployments } from '../controllers/deployment.controller.js';

const router = Router();
router.get('/', getDeployments);

export default router;