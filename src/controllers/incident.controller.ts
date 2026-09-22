import { type Request, type Response } from "express";
import { prisma } from "../lib/prisma.js";
import { analyzeIncidentWithAI, analyzeIncidentWithAIStream } from "../lib/ai.js";
import { getIo } from "../lib/socket.js";

export const createIncident = async (req: Request, res: Response) => {
  try {
    const project = req.project;
    if (!project) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { message, service, stackTrace } = req.body;
    if (!message || !service) {
      return res.status(400).json({
        error: "Bad Request",
        details: "Message and service are required.",
      });
    }

    const newIncident = await prisma.incident.create({
      data: {
        message,
        service,
        stackTrace,
        projectId: project.id,
      },
    });

    getIo().to(`project:${project.id}`).emit("new-incident", newIncident);

    return res.status(201).json({ status: "success", data: newIncident });
  } catch (error) {
    console.error("[Database Error]: Failed to create incident", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to log the incident.",
    });
  }
};

export const getAllIncidents = async (req: Request, res: Response) => {
  try {
    const project = req.project;
    if (!project) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const status = req.query.status as string;
    const services = req.query.services as string;

    const whereClause: Record<string, unknown> = { projectId: project.id };

    if (status && status !== "ALL") whereClause.status = status;
    if (services) whereClause.service = { in: services.split(",") };
    if (search) {
      whereClause.OR = [
        { message: { contains: search, mode: "insensitive" } },
        { service: { contains: search, mode: "insensitive" } },
      ];
    }

    const [incidents, totalCount, serviceAgg] = await Promise.all([
      prisma.incident.findMany({
        where: whereClause,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.incident.count({ where: whereClause }),
      prisma.incident.groupBy({
        by: ["service"],
        where: { projectId: project.id },
        _count: { service: true },
      }),
    ]);

    const serviceCounts = serviceAgg.map((s) => ({
      name: s.service,
      count: s._count.service,
    }));

    return res.status(200).json({
      status: "ok",
      data: incidents,
      pagination: {
        total: totalCount,
        page,
        totalPages: Math.ceil(totalCount / limit),
      },
      serviceCounts,
    });
  } catch (error) {
    console.error("[Database Error]: Failed to find incident", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch incidents.",
    });
  }
};

export const analyzeIncident = async (req: Request, res: Response) => {
  try {
    const project = req.project;
    if (!project) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const id = req.params.id as string;

    const incident = await prisma.incident.findFirst({
      where: { id: id, projectId: project.id },
    });

    if (!incident) {
      return res
        .status(404)
        .json({ error: "Incident not found in your project" });
    }

    const recentDeployments = await prisma.deployment.findMany({
      where: { projectId: project.id },
      take: 3,
      orderBy: { deployedAt: "desc" },
    });

    const aiResult = await analyzeIncidentWithAI(
      incident.message || "",
      incident.stackTrace || "",
      recentDeployments,
    );

    if (!aiResult)
      return res.status(500).json({ error: "AI failed to analyze" });

    const updatedIncident = await prisma.incident.update({
      where: { id: id },
      data: {
        aiRootCause: aiResult.rootCause,
        aiSolution: aiResult.solution,
      },
    });

    return res.status(200).json({ status: "success", data: updatedIncident });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const streamAnalyzeIncident = async (req: Request, res: Response) => {
  const project = req.project;
  if (!project) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const id = req.params.id as string;
  const incident = await prisma.incident.findFirst({
    where: { id, projectId: project.id },
  });

  if (!incident) {
    return res.status(404).json({ error: "Incident not found in your project" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const abort = new AbortController();
  const onClose = () => abort.abort();
  req.on("close", onClose);

  const send = (payload: Record<string, unknown>) => {
    if (res.writableEnded) return;
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    const recentDeployments = await prisma.deployment.findMany({
      where: { projectId: project.id },
      take: 3,
      orderBy: { deployedAt: "desc" },
    });

    const result = await analyzeIncidentWithAIStream(
      incident.message || "",
      incident.stackTrace || "",
      recentDeployments,
      (section, text) => {
        send({ type: "chunk", section, text });
      },
      abort.signal,
    );

    if (!abort.signal.aborted) {
      await prisma.incident.update({
        where: { id },
        data: {
          aiRootCause: result.rootCause || incident.aiRootCause,
          aiSolution: result.solution || incident.aiSolution,
        },
      });
      send({ type: "done" });
    }
  } catch (error) {
    console.error("[AI Stream Error]:", error);
    send({ type: "error", message: "Unable to generate AI analysis" });
  } finally {
    req.off("close", onClose);
    if (!res.writableEnded) {
      res.end();
    }
  }
};

export const resolveIncident = async (req: Request, res: Response) => {
  try {
    const project = req.project;
    if (!project) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const id = req.params.id as string;

    const existingIncident = await prisma.incident.findFirst({
      where: { id: id, projectId: project.id },
    });

    if (!existingIncident) {
      return res
        .status(404)
        .json({ error: "Incident not found in your project" });
    }

    const updated = await prisma.incident.update({
      where: { id: id },
      data: { status: "RESOLVED" },
    });

    return res.status(200).json({ status: "success", data: updated });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to resolve" });
  }
};
