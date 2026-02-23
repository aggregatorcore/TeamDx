import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, authorize } from "../middleware/roleAuth";

const router = Router();

// Validation schemas
const createClientSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(1, "Phone number is required"),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["active", "inactive", "archived"]).optional(),
  assignedToId: z.string().optional(),
});

const updateClientSchema = createClientSchema.partial();

/**
 * GET /api/clients
 * Get all clients (with role-based filtering)
 */
router.get("/", authenticate, authorize("ADMIN", "BRANCH_MANAGER", "COUNSELOR", "RECEPTIONIST", "TEAM_LEADER", "TELECALLER"), async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role.name;

    const whereClause: any = {};

    // Role-based filtering
    if (userRole === "COUNSELOR") {
      whereClause.assignedToId = userId;
    }
    // Admin and Branch Manager see all clients

    const clients = await prisma.client.findMany({
      where: whereClause,
      include: {
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
        _count: {
          select: {
            applications: true,
            visits: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({ clients });
  } catch (error) {
    console.error("Get clients error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/clients/:id
 * Get client by ID with full details
 */
router.get("/:id", authenticate, authorize("ADMIN", "BRANCH_MANAGER", "COUNSELOR", "RECEPTIONIST", "TEAM_LEADER", "TELECALLER"), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role.name;

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
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
        applications: {
          include: {
            assignedTo: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
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
        },
        visits: {
          include: {
            assignedTo: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            visitDate: "desc",
          },
        },
      },
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    // Check access (Counselor can only see assigned clients)
    if (userRole === "COUNSELOR" && client.assignedToId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({ client });
  } catch (error) {
    console.error("Get client error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/clients
 * Create new client
 */
router.post("/", authenticate, authorize("ADMIN", "BRANCH_MANAGER", "COUNSELOR", "RECEPTIONIST"), async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const validatedData = createClientSchema.parse(req.body);

    // Check if client with same phone or email already exists
    if (validatedData.phone) {
      const existingPhone = await prisma.client.findUnique({
        where: { phone: validatedData.phone },
      });
      if (existingPhone) {
        return res.status(400).json({ error: "Client with this phone number already exists" });
      }
    }

    if (validatedData.email && validatedData.email !== "") {
      const existingEmail = await prisma.client.findUnique({
        where: { email: validatedData.email },
      });
      if (existingEmail) {
        return res.status(400).json({ error: "Client with this email already exists" });
      }
    }

    const clientData: any = {
      ...validatedData,
      email: validatedData.email && validatedData.email !== "" ? validatedData.email : null,
      dateOfBirth: validatedData.dateOfBirth ? new Date(validatedData.dateOfBirth) : null,
      createdById: userId,
    };

    const client = await prisma.client.create({
      data: clientData,
      include: {
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
      message: "Client created successfully",
      client,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    if ((error as any).code === "P2002") {
      return res.status(400).json({ error: "Client with this phone or email already exists" });
    }
    console.error("Create client error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PUT /api/clients/:id
 * Update client
 */
router.put("/:id", authenticate, authorize("ADMIN", "BRANCH_MANAGER", "COUNSELOR", "RECEPTIONIST"), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role.name;
    const validatedData = updateClientSchema.parse(req.body);

    const existingClient = await prisma.client.findUnique({
      where: { id },
    });

    if (!existingClient) {
      return res.status(404).json({ error: "Client not found" });
    }

    // Check access (Counselor can only update assigned clients)
    if (userRole === "COUNSELOR" && existingClient.assignedToId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Check for duplicate phone/email if being updated
    if (validatedData.phone && validatedData.phone !== existingClient.phone) {
      const phoneExists = await prisma.client.findUnique({
        where: { phone: validatedData.phone },
      });
      if (phoneExists) {
        return res.status(400).json({ error: "Client with this phone number already exists" });
      }
    }

    if (validatedData.email && validatedData.email !== existingClient.email) {
      if (validatedData.email !== "") {
        const emailExists = await prisma.client.findUnique({
          where: { email: validatedData.email },
        });
        if (emailExists) {
          return res.status(400).json({ error: "Client with this email already exists" });
        }
      }
    }

    const updateData: any = { ...validatedData };
    if (validatedData.dateOfBirth) {
      updateData.dateOfBirth = new Date(validatedData.dateOfBirth);
    }
    if (validatedData.email === "") {
      updateData.email = null;
    }

    const client = await prisma.client.update({
      where: { id },
      data: updateData,
      include: {
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
      message: "Client updated successfully",
      client,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    if ((error as any).code === "P2002") {
      return res.status(400).json({ error: "Client with this phone or email already exists" });
    }
    console.error("Update client error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /api/clients/:id
 * Delete client (soft delete by archiving)
 */
router.delete("/:id", authenticate, authorize("ADMIN", "BRANCH_MANAGER"), async (req, res) => {
  try {
    const { id } = req.params;

    const client = await prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    // Soft delete by archiving
    await prisma.client.update({
      where: { id },
      data: { status: "archived" },
    });

    res.json({ message: "Client archived successfully" });
  } catch (error) {
    console.error("Delete client error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

