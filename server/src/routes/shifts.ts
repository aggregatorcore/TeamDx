import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, authorize } from "../middleware/roleAuth";

const router = Router();

// Validation schemas
const shiftConfigSchema = z.object({
  roleId: z.string().optional(),
  userId: z.string().optional(),
  shiftStart: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:mm)"),
  shiftEnd: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:mm)"),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/shifts/telecaller
 * Get default telecaller shift configuration
 */
router.get("/telecaller", authenticate, async (req, res) => {
  try {
    // Find TELECALLER role
    const telecallerRole = await prisma.role.findUnique({
      where: { name: "TELECALLER" },
    });

    if (!telecallerRole) {
      // Return default if role doesn't exist
      return res.json({
        shiftStart: "09:30",
        shiftEnd: "17:30",
        isDefault: true,
      });
    }

    // Find role-based shift config
    const shiftConfig = await prisma.shiftConfig.findFirst({
      where: {
        roleId: telecallerRole.id,
        userId: null, // Role-based, not user-specific
        isActive: true,
      },
    });

    if (shiftConfig) {
      return res.json({
        shiftStart: shiftConfig.shiftStart,
        shiftEnd: shiftConfig.shiftEnd,
        isDefault: false,
      });
    }

    // Return default if no config found
    res.json({
      shiftStart: "09:30",
      shiftEnd: "17:30",
      isDefault: true,
    });
  } catch (error: any) {
    console.error("Error fetching telecaller shift:", error);
    res.status(500).json({ error: error.message || "Failed to fetch shift config" });
  }
});

/**
 * GET /api/shifts/user/:userId
 * Get user-specific shift configuration (falls back to role-based, then default)
 */
router.get("/user/:userId", authenticate, async (req, res) => {
  try {
    const { userId } = req.params;

    // Check user-specific shift config first
    const userShiftConfig = await prisma.shiftConfig.findFirst({
      where: {
        userId,
        isActive: true,
      },
      include: {
        user: {
          include: {
            role: true,
          },
        },
      },
    });

    if (userShiftConfig) {
      return res.json({
        shiftStart: userShiftConfig.shiftStart,
        shiftEnd: userShiftConfig.shiftEnd,
        source: "user",
        isDefault: false,
      });
    }

    // Fall back to role-based config
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (user?.role) {
      const roleShiftConfig = await prisma.shiftConfig.findFirst({
        where: {
          roleId: user.role.id,
          userId: null,
          isActive: true,
        },
      });

      if (roleShiftConfig) {
        return res.json({
          shiftStart: roleShiftConfig.shiftStart,
          shiftEnd: roleShiftConfig.shiftEnd,
          source: "role",
          isDefault: false,
        });
      }
    }

    // Return default
    res.json({
      shiftStart: "09:30",
      shiftEnd: "17:30",
      source: "default",
      isDefault: true,
    });
  } catch (error: any) {
    console.error("Error fetching user shift:", error);
    res.status(500).json({ error: error.message || "Failed to fetch shift config" });
  }
});

/**
 * GET /api/shifts
 * Get all shift configurations (Admin only)
 */
router.get("/", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const shiftConfigs = await prisma.shiftConfig.findMany({
      include: {
        role: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: [
        { roleId: "asc" },
        { userId: "asc" },
      ],
    });

    res.json({ shiftConfigs });
  } catch (error: any) {
    console.error("Error fetching shift configs:", error);
    res.status(500).json({ error: error.message || "Failed to fetch shift configs" });
  }
});

/**
 * POST /api/shifts
 * Create shift configuration (Admin only)
 */
router.post("/", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const validatedData = shiftConfigSchema.parse(req.body);

    // Validate that either roleId or userId is provided, but not both
    if (!validatedData.roleId && !validatedData.userId) {
      return res.status(400).json({ error: "Either roleId or userId must be provided" });
    }

    if (validatedData.roleId && validatedData.userId) {
      return res.status(400).json({ error: "Cannot set both roleId and userId. Use userId for user-specific override." });
    }

    // Validate time range
    const [startHour, startMin] = validatedData.shiftStart.split(':').map(Number);
    const [endHour, endMin] = validatedData.shiftEnd.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (endMinutes <= startMinutes) {
      return res.status(400).json({ error: "shiftEnd must be after shiftStart" });
    }

    // Check if config already exists
    const existing = await prisma.shiftConfig.findUnique({
      where: {
        roleId_userId: {
          roleId: validatedData.roleId || null,
          userId: validatedData.userId || null,
        },
      },
    });

    if (existing) {
      // Update existing
      const updated = await prisma.shiftConfig.update({
        where: { id: existing.id },
        data: {
          shiftStart: validatedData.shiftStart,
          shiftEnd: validatedData.shiftEnd,
          isActive: validatedData.isActive ?? true,
        },
      });

      return res.json({ shiftConfig: updated, message: "Shift config updated" });
    }

    // Create new
    const shiftConfig = await prisma.shiftConfig.create({
      data: {
        roleId: validatedData.roleId || null,
        userId: validatedData.userId || null,
        shiftStart: validatedData.shiftStart,
        shiftEnd: validatedData.shiftEnd,
        isActive: validatedData.isActive ?? true,
      },
    });

    res.status(201).json({ shiftConfig, message: "Shift config created" });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Error creating shift config:", error);
    res.status(500).json({ error: error.message || "Failed to create shift config" });
  }
});

/**
 * PUT /api/shifts/:id
 * Update shift configuration (Admin only)
 */
router.put("/:id", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = shiftConfigSchema.partial().parse(req.body);

    // Validate time range if both times are provided
    if (validatedData.shiftStart && validatedData.shiftEnd) {
      const [startHour, startMin] = validatedData.shiftStart.split(':').map(Number);
      const [endHour, endMin] = validatedData.shiftEnd.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      if (endMinutes <= startMinutes) {
        return res.status(400).json({ error: "shiftEnd must be after shiftStart" });
      }
    }

    const shiftConfig = await prisma.shiftConfig.update({
      where: { id },
      data: validatedData,
    });

    res.json({ shiftConfig, message: "Shift config updated" });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Error updating shift config:", error);
    res.status(500).json({ error: error.message || "Failed to update shift config" });
  }
});

/**
 * DELETE /api/shifts/:id
 * Delete shift configuration (Admin only)
 */
router.delete("/:id", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.shiftConfig.delete({
      where: { id },
    });

    res.json({ message: "Shift config deleted" });
  } catch (error: any) {
    console.error("Error deleting shift config:", error);
    res.status(500).json({ error: error.message || "Failed to delete shift config" });
  }
});

export default router;

