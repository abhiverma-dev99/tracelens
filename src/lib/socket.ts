import { Server } from 'socket.io';
import type { Server as HTTPServer } from 'http';

let io: Server;

export const initSocket = (server: HTTPServer) => {
  io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
  });

  io.on("connection", (socket) => {
    console.log(`🔌 [Socket.io]: Client connected (${socket.id})`);
    socket.on("disconnect", () => console.log("🔌 [Socket.io]: Client disconnected"));
  });

  return io;
};

export const getIo = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};