import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, authorize } from "../middleware/roleAuth";

const router = Router();

// Helper function to generate next application ID
async function getNextApplicationId(): Promise<string> {
  try {
    const year = new Date().getFullYear();
    const prefix = `APP-${year}-`;
    
    const lastApp = await prisma.application.findFirst({
      where: {
        applicationId: {
          startsWith: prefix,
        },
      },
      orderBy: {
        applicationId: "desc",
      },
      select: { applicationId: true },
    });

    if (lastApp && lastApp.applicationId) {
      const lastNumber = parseInt(lastApp.applicationId.split("-")[2] || "0");
      const nextNumber = lastNumber + 1;
      return `${prefix}${nextNumber.toString().padStart(4, "0")}`;
    }

    return `${prefix}0001`;
  } catch (error) {
    console.error("Error getting next application ID:", error);
    const year = new Date().getFullYear();
    const count = await prisma.application.count();
    return `APP-${year}-${(count + 1).toString().padStart(4, "0")}`;
  }
}

// Validation schemas
const createApplicationSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
  visaType: z.string().min(1, "Visa type is required"),
  targetCountry: z.string().min(1, "Target country is required"),
  status: z.enum(["draft", "submitted", "in_review", "approved", "rejected", "withdrawn"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  submissionDate: z.string().optional(),
  expiryDate: z.string().optional(),
  fees: z.number().optional(),
  notes: z.string().optional(),
  assignedToId: z.string().optional(),
});

const updateApplicationSchema = createApplicationSchema.partial().extend({
  clientId: z.string().optional(),
  visaType: z.string().optional(),
  targetCountry: z.string().optional(),
});

/**
 * GET /api/applications
 * Get all applications (with role-based filtering)
 */
router.get("/", authenticate, authorize("ADMIN", "BRANCH_MANAGER", "COUNSELOR", "RECEPTIONIST", "FILLING_OFFICER"), async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role.name;

    const whereClause: any = {};

    // Role-based filtering
    if (userRole === "COUNSELOR") {
      whereClause.assignedToId = userId;
    }
    // Admin and Branch Manager see all applications

    const applications = await prisma.application.findMany({
      where: whereClause,
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        documents: {
          select: {
            id: true,
            name: true,
            type: true,
            uploadedAt: true,
          },
          orderBy: {
            uploadedAt: "desc",
          },
        },
        _count: {
          select: {
            documents: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({ applications });
  } catch (error) {
    console.error("Get applications error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/applications/:id
 * Get application by ID
 */
router.get("/:id", authenticate, authorize("ADMIN", "BRANCH_MANAGER", "COUNSELOR", "RECEPTIONIST", "FILLING_OFFICER"), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role.name;

    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        client: true,
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        documents: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            uploadedAt: "desc",
          },
        },
      },
    });

    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    // Check if user has access (Counselor can only see assigned applications)
    if (userRole === "COUNSELOR" && application.assignedToId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({ application });
  } catch (error) {
    console.error("Get application error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/applications
 * Create new application
 */
router.post("/", authenticate, authorize("ADMIN", "BRANCH_MANAGER", "COUNSELOR", "RECEPTIONIST", "FILLING_OFFICER"), async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const validatedData = createApplicationSchema.parse(req.body);

    // Check if client exists
    const client = await prisma.client.findUnique({
      where: { id: validatedData.clientId },
    });

    if (!client) {
      return res.status(400).json({ error: "Client not found" });
    }

    // Generate application ID
    const applicationId = await getNextApplicationId();

    // Parse dates if provided
    const applicationData: any = {
      ...validatedData,
      applicationId,
      createdById: userId,
      submissionDate: validatedData.submissionDate ? new Date(validatedData.submissionDate) : null,
      expiryDate: validatedData.expiryDate ? new Date(validatedData.expiryDate) : null,
    };

    const application = await prisma.application.create({
      data: applicationData,
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    res.status(201).json({
      message: "Application created successfully",
      application,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Create application error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PUT /api/applications/:id
 * Update application
 */
router.put("/:id", authenticate, authorize("ADMIN", "BRANCH_MANAGER", "COUNSELOR", "RECEPTIONIST", "FILLING_OFFICER"), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role.name;
    const validatedData = updateApplicationSchema.parse(req.body);

    // Check if application exists
    const existingApplication = await prisma.application.findUnique({
      where: { id },
    });

    if (!existingApplication) {
      return res.status(404).json({ error: "Application not found" });
    }

    // Check access (Counselor can only update assigned applications)
    if (userRole === "COUNSELOR" && existingApplication.assignedToId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Parse dates if provided
    const updateData: any = { ...validatedData };
    if (validatedData.submissionDate) {
      updateData.submissionDate = new Date(validatedData.submissionDate);
    }
    if (validatedData.expiryDate) {
      updateData.expiryDate = new Date(validatedData.expiryDate);
    }

    const application = await prisma.application.update({
      where: { id },
      data: updateData,
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    res.json({
      message: "Application updated successfully",
      application,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Update application error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /api/applications/:id
 * Delete application
 */
router.delete("/:id", authenticate, authorize("ADMIN", "BRANCH_MANAGER"), async (req, res) => {
  try {
    const { id } = req.params;

    const application = await prisma.application.findUnique({
      where: { id },
    });

    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    await prisma.application.delete({
      where: { id },
    });

    res.json({ message: "Application deleted successfully" });
  } catch (error) {
    console.error("Delete application error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

