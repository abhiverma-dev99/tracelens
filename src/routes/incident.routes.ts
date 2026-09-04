// src/routes/incident.routes.ts
import { Router } from 'express';
import { createIncident, getAllIncidents, analyzeIncident, resolveIncident } from '../controllers/incident.controller.js';

const router = Router();

router.post('/', createIncident);
router.get('/', getAllIncidents);
router.post('/:id/analyze', analyzeIncident);
router.patch('/:id/resolve', resolveIncident);

export default router;