import { Router } from "express";
import { getDeployments } from "../controllers/deployment.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireProjectMiddleware } from "../middleware/require-project.middleware.js";

const router = Router();
router.get("/", authMiddleware, requireProjectMiddleware, getDeployments);

export default router;
