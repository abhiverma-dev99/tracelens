import { type Request, type Response } from "express";
import { prisma } from "../lib/prisma.js";
import { analyzeIncidentWithAI } from "../lib/ai.js";
import { getIo } from "../lib/socket.js";

// POST Logic
export const createIncident = async (req: Request, res: Response) => {
  try {
    // 1. Extract the Ingest Key from headers
    const authHeader = req.headers.authorization;
    const ingestKey = authHeader?.split(" ")[1]; // Expects "Bearer <key>"

    if (!ingestKey) {
      return res
        .status(401)
        .json({ error: "Unauthorized", details: "Ingest key is missing." });
    }

    const project = await prisma.project.findUnique({ where: { ingestKey } });
    if (!project) {
      return res
        .status(401)
        .json({ error: "Unauthorized", details: "Invalid ingest key." });
    }

    const { message, service, stackTrace } = req.body;
    if (!message || !service) {
      return res.status(400).json({
        error: "Bad Request",
        details: "Message and service are required.",
      });
    }

    // 3. Save incident and link it to the project
    const newIncident = await prisma.incident.create({
      data: {
        message,
        service,
        stackTrace,
        projectId: project.id,
      },
    });

    getIo().emit("new-incident", newIncident);

    return res.status(201).json({ status: "success", data: newIncident });
  } catch (error) {
    console.error("[Database Error]: Failed to create incident", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to log the incident.",
    });
  }
};

// GET Logic
export const getAllIncidents = async (req: Request, res: Response) => {
  try {
    // 1. Extract Ingest Key
    const authHeader = req.headers.authorization;
    const ingestKey = authHeader?.split(" ")[1];

    if (!ingestKey) {
      return res
        .status(401)
        .json({ error: "Unauthorized", details: "Ingest key is missing." });
    }

    // 2. Validate Key
    const project = await prisma.project.findUnique({ where: { ingestKey } });
    if (!project) {
      return res
        .status(401)
        .json({ error: "Unauthorized", details: "Invalid ingest key." });
    }

    // Paginaton & Filter Parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const status = req.query.status as string;
    const services = req.query.services as string; // comma separated string

    const whereClause: any = { projectId: project.id };

    if (status && status !== "ALL") whereClause.status = status;
    if (services) whereClause.service = { in: services.split(",") };
    if (search) {
      whereClause.OR = [
        { message: { contains: search, mode: "insensitive" } },
        { service: { contains: search, mode: "insensitive" } },
      ];
    }

    // Parallel execution for Performance
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

// AI function
export const analyzeIncident = async (req: Request, res: Response) => {
  try {
    // 1. Verify Authentication
    const authHeader = req.headers.authorization;
    const ingestKey = authHeader?.split(" ")[1];
    if (!ingestKey) return res.status(401).json({ error: "Unauthorized" });

    const project = await prisma.project.findUnique({ where: { ingestKey } });
    if (!project) return res.status(401).json({ error: "Unauthorized" });

    const id = req.params.id as string;

    // FIX: Used findFirst instead of findUnique for multiple conditions
    const incident = await prisma.incident.findFirst({
      where: { id: id, projectId: project.id },
    });

    if (!incident) {
      return res
        .status(404)
        .json({ error: "Incident not found in your project" });
    }

    // 3. Fetch recent deployments for THIS project only
    const recentDeployments = await prisma.deployment.findMany({
      where: { projectId: project.id }, // <-- Security check
      take: 3,
      orderBy: { deployedAt: "desc" },
    });

    // 4. AI Analysis
    const aiResult = await analyzeIncidentWithAI(
      incident.message || "",
      incident.stackTrace || "",
      recentDeployments,
    );

    if (!aiResult)
      return res.status(500).json({ error: "AI failed to analyze" });

    // 5. Update Database
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

export const resolveIncident = async (req: Request, res: Response) => {
  try {
    // FIX: Added security checks to ensure only project owner can resolve
    const authHeader = req.headers.authorization;
    const ingestKey = authHeader?.split(" ")[1];
    if (!ingestKey) return res.status(401).json({ error: "Unauthorized" });

    const project = await prisma.project.findUnique({ where: { ingestKey } });
    if (!project) return res.status(401).json({ error: "Unauthorized" });

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
