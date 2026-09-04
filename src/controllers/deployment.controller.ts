import { type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';

export const getDeployments = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const ingestKey = authHeader?.split(' ')[1]; 
    if (!ingestKey) return res.status(401).json({ error: "Unauthorized" });

    const project = await prisma.project.findUnique({ where: { ingestKey } });
    if (!project) return res.status(401).json({ error: "Unauthorized" });

    const deployments = await prisma.deployment.findMany({
      where: { projectId: project.id },
      orderBy: { deployedAt: 'desc' },
      take: 5 // Fetch only the 5 most recent pushes
    });

    return res.status(200).json({ status: 'success', data: deployments });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to fetch deployments" });
  }
};