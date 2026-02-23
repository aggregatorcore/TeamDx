import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, authorize, AuthenticatedRequest } from "../middleware/roleAuth";

const router = Router();

// Validation schemas
const createClientVisitSchema = z.object({
  clientId: z.string().optional(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(1, "Phone number is required"),
  visitDate: z.string().optional(),
  inTime: z.string().optional(),
  purpose: z.string().min(1, "Purpose is required"),
  assignedToId: z.string().optional(),
  notes: z.string().optional(),
});

const updateClientVisitSchema = createClientVisitSchema.partial().extend({
  outTime: z.string().optional(),
});

/**
 * GET /api/client-visits
 * Get all client visits (with filters)
 */
router.get("/", authenticate, authorize("ADMIN", "BRANCH_MANAGER", "COUNSELOR", "RECEPTIONIST"), async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const { date, clientId, assignedToId } = req.query;

    const whereClause: any = {};

    // Role-based filtering
    if (userRole === "COUNSELOR") {
      whereClause.assignedToId = userId;
    }

    // Date filter
    if (date) {
      const filterDate = new Date(date as string);
      const startOfDay = new Date(filterDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(filterDate.setHours(23, 59, 59, 999));
      whereClause.visitDate = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    // Client filter
    if (clientId) {
      whereClause.clientId = clientId as string;
    }

    // Assigned to filter
    if (assignedToId) {
      whereClause.assignedToId = assignedToId as string;
    }

    const visits = await prisma.clientVisit.findMany({
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
      },
      orderBy: {
        visitDate: "desc",
      },
    });

    res.json({ visits });
  } catch (error) {
    console.error("Get client visits error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/client-visits/:id
 * Get client visit by ID
 */
router.get("/:id", authenticate, authorize("ADMIN", "BRANCH_MANAGER", "COUNSELOR", "RECEPTIONIST"), async (req, res) => {
  try {
    const { id } = req.params;

    const visit = await prisma.clientVisit.findUnique({
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
      },
    });

    if (!visit) {
      return res.status(404).json({ error: "Client visit not found" });
    }

    res.json({ visit });
  } catch (error) {
    console.error("Get client visit error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/client-visits
 * Create new client visit
 */
router.post("/", authenticate, authorize("ADMIN", "RECEPTIONIST"), async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User ID not found in request" });
    }
    const validatedData = createClientVisitSchema.parse(req.body);

    // Helper function to safely parse dates
    const parseDate = (dateValue: string | Date | undefined | null): Date => {
      if (!dateValue) return new Date();
      if (dateValue instanceof Date) {
        // Check if Date is valid
        if (isNaN(dateValue.getTime())) return new Date();
        return dateValue;
      }
      const parsed = new Date(dateValue);
      // Check if parsed date is valid
      if (isNaN(parsed.getTime())) return new Date();
      return parsed;
    };

    const visitData: any = {
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      email: validatedData.email && validatedData.email !== "" ? validatedData.email : null,
      phone: validatedData.phone,
      purpose: validatedData.purpose,
      notes: validatedData.notes,
      assignedToId: validatedData.assignedToId || null,
      clientId: validatedData.clientId || null,
      createdById: userId,
      visitDate: parseDate(validatedData.visitDate),
      inTime: parseDate(validatedData.inTime),
    };

    const visit = await prisma.clientVisit.create({
      data: visitData,
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
      message: "Client visit recorded successfully",
      visit,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Create client visit error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PUT /api/client-visits/:id
 * Update client visit (e.g., set out time)
 */
router.put("/:id", authenticate, authorize("ADMIN", "RECEPTIONIST", "COUNSELOR"), async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = updateClientVisitSchema.parse(req.body);

    const existingVisit = await prisma.clientVisit.findUnique({
      where: { id },
    });

    if (!existingVisit) {
      return res.status(404).json({ error: "Client visit not found" });
    }

    // Helper function to safely parse dates (reuse from POST endpoint)
    const parseDate = (dateValue: string | Date | undefined | null): Date | undefined => {
      if (!dateValue) return undefined;
      if (dateValue instanceof Date) {
        // Check if Date is valid
        if (isNaN(dateValue.getTime())) return undefined;
        return dateValue;
      }
      const parsed = new Date(dateValue);
      // Check if parsed date is valid
      if (isNaN(parsed.getTime())) return undefined;
      return parsed;
    };

    const updateData: any = { ...validatedData };
    if (validatedData.outTime) {
      const parsedOutTime = parseDate(validatedData.outTime);
      if (parsedOutTime) {
        updateData.outTime = parsedOutTime;
      } else {
        // Remove invalid date from update
        delete updateData.outTime;
      }
    }
    if (validatedData.visitDate) {
      const parsedVisitDate = parseDate(validatedData.visitDate);
      if (parsedVisitDate) {
        updateData.visitDate = parsedVisitDate;
      } else {
        delete updateData.visitDate;
      }
    }
    if (validatedData.inTime) {
      const parsedInTime = parseDate(validatedData.inTime);
      if (parsedInTime) {
        updateData.inTime = parsedInTime;
      } else {
        delete updateData.inTime;
      }
    }
    if (validatedData.email === "") {
      updateData.email = null;
    }

    const visit = await prisma.clientVisit.update({
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
      message: "Client visit updated successfully",
      visit,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Update client visit error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /api/client-visits/:id
 * Delete client visit
 */
router.delete("/:id", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;

    const visit = await prisma.clientVisit.findUnique({
      where: { id },
    });

    if (!visit) {
      return res.status(404).json({ error: "Client visit not found" });
    }

    await prisma.clientVisit.delete({
      where: { id },
    });

    res.json({ message: "Client visit deleted successfully" });
  } catch (error) {
    console.error("Delete client visit error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

