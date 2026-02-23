import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, authorize, AuthenticatedRequest } from "../middleware/roleAuth";

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/audit/feed
 * Activity feed (recent events across all entities)
 * Query params: limit, offset, userId (filter by actor)
 * Note: This route must come BEFORE /events/:id to avoid route matching conflicts
 */
router.get("/feed", async (req: AuthenticatedRequest, res) => {
  try {
    // Parse and validate query parameters
    const querySchema = z.object({
      limit: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().int().positive().max(100)).optional().default("50"),
      offset: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().int().nonnegative()).optional().default("0"),
      userId: z.string().optional(),
    });

    const validatedQuery = querySchema.parse({
      limit: req.query.limit || "50",
      offset: req.query.offset || "0",
      userId: req.query.userId,
    });

    // Build where clause
    const where: any = {};

    if (validatedQuery.userId) {
      where.userId = validatedQuery.userId;
    }

    // Fetch recent audit events
    const [events, total] = await Promise.all([
      prisma.auditEvent.findMany({
        where,
        include: {
          user: {
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
        take: validatedQuery.limit,
        skip: validatedQuery.offset,
      }),
      prisma.auditEvent.count({ where }),
    ]);

    // Helper function for safe JSON parsing
    const safeParseJson = (value: any): any => {
      if (!value) return null;
      if (typeof value === 'object') return value;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch (parseError) {
          console.warn(`[Audit] Failed to parse JSON field:`, parseError);
          return null;
        }
      }
      return null;
    };

    // Parse JSON fields for response
    const formattedEvents = events.map((event) => ({
      id: event.id,
      entityType: event.entityType,
      entityId: event.entityId,
      action: event.action,
      userId: event.userId,
      user: event.user,
      description: event.description,
      metadata: safeParseJson(event.metadata),
      createdAt: event.createdAt,
    }));

    return res.json({
      events: formattedEvents,
      pagination: {
        total,
        limit: validatedQuery.limit,
        offset: validatedQuery.offset,
        hasMore: validatedQuery.offset + validatedQuery.limit < total,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid query parameters",
        details: error.errors,
      });
    }

    console.error("[Audit] Error fetching activity feed:", error);
    return res.status(500).json({
      error: "Failed to fetch activity feed",
      message: error.message,
    });
  }
});

/**
 * GET /api/audit/events
 * List audit events with filters
 * Query params: entityType, entityId, userId, action, startDate, endDate, limit, offset
 * NOTE: This route MUST come before /events/:id to avoid route matching conflicts
 * Using exact match to prevent /events/:id from matching first
 * 
 * Permission logic:
 * - ADMIN, BRANCH_MANAGER, TEAM_LEADER: Can see all events
 * - Other roles: Can only see events for entities they own/are assigned to (e.g., their own leads)
 */
router.get("/events", async (req: AuthenticatedRequest, res) => {
  console.log("[Audit] GET /api/audit/events - Route hit", { query: req.query, userRole: req.user?.role });
  try {
    // Check if user has admin-level access
    const hasAdminAccess = ["ADMIN", "BRANCH_MANAGER", "TEAM_LEADER"].includes(req.user?.role || "");
    
    // Parse and validate query parameters
    const querySchema = z.object({
      entityType: z.string().optional(),
      entityId: z.string().optional(),
      userId: z.string().optional(),
      action: z.string().optional(),
      startDate: z.string().optional().transform((val) => {
        if (!val) return undefined;
        // Accept both date (YYYY-MM-DD) and datetime formats
        const date = new Date(val);
        return isNaN(date.getTime()) ? undefined : date.toISOString();
      }),
      endDate: z.string().optional().transform((val) => {
        if (!val) return undefined;
        // Accept both date (YYYY-MM-DD) and datetime formats
        const date = new Date(val);
        return isNaN(date.getTime()) ? undefined : date.toISOString();
      }),
      limit: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().int().positive().max(100)).optional().default("50"),
      offset: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().int().nonnegative()).optional().default("0"),
    });

    const validatedQuery = querySchema.parse({
      entityType: req.query.entityType,
      entityId: req.query.entityId,
      userId: req.query.userId,
      action: req.query.action,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: req.query.limit || "50",
      offset: req.query.offset || "0",
    });

    // Build where clause
    const where: any = {};

    if (validatedQuery.entityType) {
      where.entityType = validatedQuery.entityType.toUpperCase();
    }

    if (validatedQuery.entityId) {
      where.entityId = validatedQuery.entityId;
    }
    
    // If user doesn't have admin access, restrict to their own entities
    // For LEAD entityType, allow if user is assigned to that lead
    if (!hasAdminAccess) {
      if (validatedQuery.entityType === "LEAD" && validatedQuery.entityId) {
        // Check if user is assigned to this lead
        const lead = await prisma.lead.findUnique({
          where: { id: validatedQuery.entityId },
          select: { assignedToId: true },
        });
        
        if (!lead || lead.assignedToId !== req.user?.userId) {
          return res.status(403).json({
            error: "Insufficient permissions",
            message: "You can only view audit events for leads assigned to you",
          });
        }
        // User is assigned to this lead, allow access
      } else {
        // For other entity types or no specific entity, restrict to user's own events
        where.userId = req.user?.userId;
      }
    }

    if (validatedQuery.userId) {
      where.userId = validatedQuery.userId;
    }

    if (validatedQuery.action) {
      where.action = validatedQuery.action.toUpperCase();
    }

    if (validatedQuery.startDate || validatedQuery.endDate) {
      where.createdAt = {};
      if (validatedQuery.startDate) {
        // Set to start of day
        const startDate = new Date(validatedQuery.startDate);
        startDate.setHours(0, 0, 0, 0);
        where.createdAt.gte = startDate;
      }
      if (validatedQuery.endDate) {
        // Set to end of day
        const endDate = new Date(validatedQuery.endDate);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    // Fetch audit events
    const [events, total] = await Promise.all([
      prisma.auditEvent.findMany({
        where,
        include: {
          user: {
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
        take: validatedQuery.limit,
        skip: validatedQuery.offset,
      }),
      prisma.auditEvent.count({ where }),
    ]);

    // Helper function for safe JSON parsing
    const safeParseJson = (value: any): any => {
      if (!value) return null;
      if (typeof value === 'object') return value;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch (parseError) {
          console.warn(`[Audit] Failed to parse JSON field:`, parseError);
          return null;
        }
      }
      return null;
    };

    // Parse JSON fields for response
    const formattedEvents = events.map((event) => ({
      id: event.id,
      entityType: event.entityType,
      entityId: event.entityId,
      action: event.action,
      userId: event.userId,
      user: event.user,
      oldValue: safeParseJson(event.oldValue),
      newValue: safeParseJson(event.newValue),
      changes: safeParseJson(event.changes),
      description: event.description,
      metadata: safeParseJson(event.metadata),
      createdAt: event.createdAt,
    }));

    return res.json({
      events: formattedEvents,
      pagination: {
        total,
        limit: validatedQuery.limit,
        offset: validatedQuery.offset,
        hasMore: validatedQuery.offset + validatedQuery.limit < total,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid query parameters",
        details: error.errors,
      });
    }

    console.error("[Audit] Error fetching audit events:", error);
    return res.status(500).json({
      error: "Failed to fetch audit events",
      message: error.message,
    });
  }
});

/**
 * GET /api/audit/events/:id
 * Get single audit event details
 * NOTE: This route MUST come AFTER /events to avoid route matching conflicts
 */
router.get("/events/:id", authorize("ADMIN", "BRANCH_MANAGER", "TEAM_LEADER"), async (req: AuthenticatedRequest, res) => {
  console.log("[Audit] GET /api/audit/events/:id - Route hit with id:", req.params.id);
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Event ID is required" });
    }

    const event = await prisma.auditEvent.findUnique({
      where: { id },
      include: {
        user: {
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

    if (!event) {
      return res.status(404).json({ error: "Audit event not found" });
    }

    // Helper function for safe JSON parsing
    const safeParseJson = (value: any): any => {
      if (!value) return null;
      if (typeof value === 'object') return value;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch (parseError) {
          console.warn(`[Audit] Failed to parse JSON field:`, parseError);
          return null;
        }
      }
      return null;
    };

    // Parse JSON fields for response
    const formattedEvent = {
      id: event.id,
      entityType: event.entityType,
      entityId: event.entityId,
      action: event.action,
      userId: event.userId,
      user: event.user,
      oldValue: safeParseJson(event.oldValue),
      newValue: safeParseJson(event.newValue),
      changes: safeParseJson(event.changes),
      description: event.description,
      metadata: safeParseJson(event.metadata),
      createdAt: event.createdAt,
    };

    return res.json(formattedEvent);
  } catch (error: any) {
    console.error("[Audit] Error fetching audit event:", error);
    return res.status(500).json({
      error: "Failed to fetch audit event",
      message: error.message,
    });
  }
});

export default router;


