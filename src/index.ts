import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import cors from "cors";
import { createServer } from 'http';
import { initSocket } from './lib/socket.js';

import incidentRoutes from './routes/incident.routes.js';
import webhookRoutes from './routes/webhook.routes.js';
import setupRoutes from './routes/setup.routes.js';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Health Check
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "success", message: "TraceLens API is running." });
});

// Register Routes
app.use('/api/setup', setupRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/webhooks', webhookRoutes);

// Initialize HTTP Server & Sockets
const httpServer = createServer(app);
initSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`[Server]: API is running at http://localhost:${PORT}`);
});