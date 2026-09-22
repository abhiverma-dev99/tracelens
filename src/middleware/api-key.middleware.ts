import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

const extractIngestKey = (req: Request) => {
  const headerKey = req.header("x-tracelens-api-key");
  if (headerKey) return headerKey.trim();

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  return undefined;
};

export const apiKeyMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const ingestKey = extractIngestKey(req);

  if (!ingestKey) {
    return res.status(401).json({
      error: "Unauthorized",
      details: "Ingest key is missing.",
    });
  }

  const project = await prisma.project.findUnique({
    where: { ingestKey },
    select: { id: true, name: true, ingestKey: true, userId: true },
  });

  if (!project) {
    return res.status(401).json({
      error: "Unauthorized",
      details: "Invalid ingest key.",
    });
  }

  req.project = project;
  return next();
};
