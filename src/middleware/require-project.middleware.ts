import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

export const requireProjectMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const project = await prisma.project.findFirst({
    where: { userId: req.user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, ingestKey: true, userId: true },
  });

  if (!project) {
    return res.status(403).json({ error: "No project is associated with this account." });
  }

  req.project = project;
  return next();
};
