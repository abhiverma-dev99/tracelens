import { Server } from "socket.io";
import type { Server as HTTPServer } from "http";
import { prisma } from "./prisma.js";
import { verifyAccessToken } from "./auth.js";
import { getFrontendOrigins } from "./origins.js";

let io: Server;

export const initSocket = (server: HTTPServer) => {
  const origin = getFrontendOrigins();

  io = new Server(server, {
    cors: { origin, methods: ["GET", "POST"], credentials: true },
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error("Unauthorized"));
    }

    try {
      const payload = verifyAccessToken(token);
      const project = await prisma.project.findFirst({
        where: { userId: payload.sub },
        orderBy: { createdAt: "asc" },
      });

      if (!project) {
        return next(new Error("Unauthorized"));
      }

      socket.data.projectId = project.id;
      return next();
    } catch {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const projectId = socket.data.projectId as string;
    socket.join(`project:${projectId}`);
    console.log(`🔌 [Socket.io]: Client connected (${socket.id})`);
    socket.on("disconnect", () =>
      console.log("🔌 [Socket.io]: Client disconnected"),
    );
  });

  return io;
};

export const getIo = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};
