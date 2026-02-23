import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, authorize } from "../middleware/roleAuth";

const router = Router();

// All routes require authentication
router.use(authenticate);

const createActivitySchema = z.object({
  leadId: z.string().min(1, "Lead ID is required"),
  activityType: z.string().min(1, "Activity type is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  metadata: z.string().optional(), // JSON string
});

/**
 * POST /api/lead-activities
 * Create a new activity for a lead
 */
router.post("/", authorize("ADMIN", "BRANCH_MANAGER", "TEAM_LEADER", "COUNSELOR", "TELECALLER"), async (req, res) => {
  try {
    const user = (req as any).user;
    const userId = user?.userId || user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const validatedData = createActivitySchema.parse(req.body);

    // Check if lead exists
    const lead = await prisma.lead.findUnique({
      where: { id: validatedData.leadId },
    });

    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    // Create activity
    const activity = await prisma.leadActivity.create({
      data: {
        leadId: validatedData.leadId,
        activityType: validatedData.activityType,
        title: validatedData.title,
        description: validatedData.description || null,
        metadata: validatedData.metadata || null,
        createdById: userId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeCode: true,
          },
        },
      },
    });

    res.status(201).json({
      message: "Activity created successfully",
      activity,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Create activity error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/lead-activities/:leadId
 * Get all activities for a specific lead
 */
router.get("/:leadId", authorize("ADMIN", "BRANCH_MANAGER", "TEAM_LEADER", "COUNSELOR", "TELECALLER"), async (req, res) => {
  try {
    const { leadId } = req.params;

    // Check if lead exists
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    // Get all activities for this lead, ordered by most recent first
    const activities = await prisma.leadActivity.findMany({
      where: { leadId },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeCode: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({
      activities,
      count: activities.length,
    });
  } catch (error) {
    console.error("Get activities error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;






























