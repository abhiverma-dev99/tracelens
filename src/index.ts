import "dotenv/config";
import express, { type Request, type Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { getFrontendOrigins } from "./lib/origins.js";
import { isSmtpConfigured } from "./services/email.service.js";
import { initSocket } from "./lib/socket.js";

import incidentRoutes from "./routes/incident.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";
import setupRoutes from "./routes/setup.routes.js";
import deploymentRoutes from "./routes/deployment.routes.js";
import authRoutes from "./routes/auth.routes.js";
import { initCronJobs } from "./jobs/retention.job.js";

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const frontendOrigins = getFrontendOrigins();

app.use(
  cors({
    origin: frontendOrigins,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "success",
    message: "TraceLens API is running.",
    emailDelivery: isSmtpConfigured() ? "smtp" : "console",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/setup", setupRoutes);
app.use("/api/incidents", incidentRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/deployments", deploymentRoutes);

const httpServer = createServer(app);
initSocket(httpServer);
initCronJobs();
httpServer.listen(PORT, () => {
  console.log(`[Server]: API is running at http://localhost:${PORT}`);
});
