import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { verifyAccessToken } from "../lib/auth.js";

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, emailVerified: true },
    });

    if (!user || !user.emailVerified) {
      return res.status(401).json({ error: "Authentication required." });
    }

    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: "Authentication required." });
  }
};
