import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    let user = await prisma.user.findUnique({ where: { email: "test@tracelens.dev" }});
    
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: "test@tracelens.dev",
          name: "TraceLens Admin",
          projects: {
            create: { name: "Production App" }
          }
        }
      });
    }

    const project = await prisma.project.findFirst({ where: { userId: user.id }});
    
    res.json({ 
      message: "Setup complete!", 
      userEmail: user.email,
      projectName: project?.name,
      ingestKey: project?.ingestKey
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Setup failed" });
  }
});

export default router;