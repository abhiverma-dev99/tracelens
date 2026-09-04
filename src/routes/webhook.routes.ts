import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

// Expecting URL: /api/webhooks/github/<INGEST_KEY>
router.post('/github/:ingestKey', async (req: Request, res: Response) => {
  try {
    const { ingestKey } = req.params;
    const payload = req.body;

    // 1. Verify Project
    const project = await prisma.project.findUnique({ where: { ingestKey } });
    if (!project) {
      return res.status(401).json({ error: "Invalid webhook key" });
    }

    // 2. Process push event
    if (payload.commits && payload.commits.length > 0) {
      const latestCommit = payload.commits[0]; 

      const deployment = await prisma.deployment.create({
        data: {
          commitHash: latestCommit.id.substring(0, 7),
          message: latestCommit.message,
          author: latestCommit.author.name || latestCommit.author.username || 'Unknown',
          repository: payload.repository.name,
          branch: payload.ref.replace('refs/heads/', ''),
          projectId: project.id // <-- Link to project
        }
      });
      console.log(`✅ [Webhook]: Deployment recorded - ${deployment.commitHash}`);
    }

    return res.status(200).json({ status: 'received' });
  } catch (error) {
    console.error('❌ [Webhook Error]:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;