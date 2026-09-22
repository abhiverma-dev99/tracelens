import { Router } from "express";
import {
  analyzeIncident,
  createIncident,
  getAllIncidents,
  resolveIncident,
  streamAnalyzeIncident,
} from "../controllers/incident.controller.js";
import { apiKeyMiddleware } from "../middleware/api-key.middleware.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireProjectMiddleware } from "../middleware/require-project.middleware.js";

const router = Router();
const dashboardAuth = [authMiddleware, requireProjectMiddleware];

router.post("/", apiKeyMiddleware, createIncident);
router.get("/", ...dashboardAuth, getAllIncidents);
router.get("/:id/analyze/stream", ...dashboardAuth, streamAnalyzeIncident);
router.post("/:id/analyze", ...dashboardAuth, analyzeIncident);
router.patch("/:id/resolve", ...dashboardAuth, resolveIncident);

export default router;
