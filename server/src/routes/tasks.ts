import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, authorize } from "../middleware/roleAuth";
import {
  calculateOverdueDays,
  removeOverdueTag,
} from "../services/taskOverdueService";
import { sendTaskNotification } from "../services/notificationService";

const router = Router();

// Validation schemas
const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  type: z.enum(["FOLLOW_UP", "INTERNAL", "CALL", "MEETING"]).default("FOLLOW_UP"),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).default("PENDING"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueAt: z.union([z.string().datetime(), z.string().transform((val) => new Date(val)), z.date()]).transform((val) => (val instanceof Date ? val : new Date(val))),
  assignedToUserId: z.string().min(1, "Assigned user ID is required"),
  leadId: z.string().optional(),
  // Phase 2: New fields
  tags: z.union([z.array(z.string()), z.string()]).optional().transform((val) => {
    if (Array.isArray(val)) return JSON.stringify(val);
    if (typeof val === "string") {
      try {
        JSON.parse(val); // Validate JSON
        return val;
      } catch {
        return JSON.stringify([val]); // Single tag as array
      }
    }
    return null;
  }),
  source: z.string().optional(),
  phoneNumber: z.string().optional(),
  relatedCallId: z.string().optional(),
  relatedCallRequestId: z.string().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  type: z.enum(["FOLLOW_UP", "INTERNAL", "CALL", "MEETING"]).optional(),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueAt: z.string().datetime().or(z.date()).transform((val) => (typeof val === "string" ? new Date(val) : val)).optional(),
  assignedToUserId: z.string().min(1).optional(),
  leadId: z.string().optional().nullable(),
  // Phase 2: New fields
  tags: z.union([z.array(z.string()), z.string()]).optional().transform((val) => {
    if (val === undefined || val === null) return undefined;
    if (Array.isArray(val)) return JSON.stringify(val);
    if (typeof val === "string") {
      try {
        JSON.parse(val); // Validate JSON
        return val;
      } catch {
        return JSON.stringify([val]); // Single tag as array
      }
    }
    return undefined;
  }),
  source: z.string().optional(),
  phoneNumber: z.string().optional(),
});

const addActivitySchema = z.object({
  note: z.string().min(1, "Note is required"),
});

/**
 * Helper function to create TaskActivity entry
 */
async function createTaskActivity(
  taskId: string,
  action: string,
  createdById: string,
  note?: string
): Promise<void> {
  try {
    await prisma.taskActivity.create({
      data: {
        taskId,
        action,
        note: note || null,
        createdById,
      },
    });
  } catch (error) {
    console.error(`Failed to create TaskActivity for task ${taskId}:`, error);
    // Don't throw - activity logging failure shouldn't break the main operation
  }
}

/**
 * POST /api/tasks
 * Create new task
 * - createdByUserId from auth context
 * - Create TaskActivity: action=CREATED
 */
router.post("/", authenticate, authorize("ADMIN", "BRANCH_MANAGER", "TEAM_LEADER", "COUNSELOR", "TELECALLER"), async (req, res) => {
  try {
    const user = (req as any).user;
    const userId = user?.userId || user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Invalid user data" });
    }

    const validatedData = createTaskSchema.parse(req.body);

    // Check if assigned user exists
    const assignedUser = await prisma.user.findUnique({
      where: { id: validatedData.assignedToUserId },
    });

    if (!assignedUser) {
      return res.status(400).json({ error: "Assigned user not found" });
    }

    if (!assignedUser.isActive) {
      return res.status(400).json({ error: "Cannot assign to inactive user" });
    }

    // Check if lead exists (if provided)
    if (validatedData.leadId) {
      const lead = await prisma.lead.findUnique({
        where: { id: validatedData.leadId },
      });

      if (!lead) {
        return res.status(400).json({ error: "Lead not found" });
      }
    }

    // RBAC: Team Leader can only assign to their team members
    if (user.role === "TEAM_LEADER") {
      const teamLeader = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          teamMembers: {
            where: {
              isActive: true,
            },
          },
        },
      });

      if (!teamLeader) {
        return res.status(404).json({ error: "Team Leader not found" });
      }

      const teamMemberIds = teamLeader.teamMembers.map((m) => m.id);
      if (!teamMemberIds.includes(validatedData.assignedToUserId)) {
        return res.status(403).json({
          error: "Insufficient permissions",
          message: "Team Leaders can only assign tasks to their team members",
        });
      }
    }

    // Create task
    const task = await prisma.task.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        type: validatedData.type,
        status: validatedData.status,
        priority: validatedData.priority,
        dueAt: validatedData.dueAt,
        leadId: validatedData.leadId || null,
        assignedToId: validatedData.assignedToUserId,
        createdById: userId,
        // Phase 2: New fields
        tags: validatedData.tags || null,
        source: validatedData.source || null,
        phoneNumber: validatedData.phoneNumber || null,
        relatedCallId: validatedData.relatedCallId || null,
        relatedCallRequestId: validatedData.relatedCallRequestId || null,
        inProgressAt: validatedData.status === "IN_PROGRESS" ? new Date() : null,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        lead: {
          select: {
            id: true,
            leadId: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    });

    // Create TaskActivity: CREATED
    await createTaskActivity(task.id, "CREATED", userId, `Task created: ${task.title}`);

    // Phase 2: Format response
    let tagsArray: string[] = [];
    if (task.tags) {
      try {
        tagsArray = JSON.parse(task.tags) as string[];
      } catch {
        // Invalid JSON, leave as empty array
      }
    }

    const formattedTask = {
      ...task,
      tags: tagsArray, // Return as array instead of JSON string
      overdueDays: calculateOverdueDays(task),
      dueAt: task.dueAt.toISOString(),
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      inProgressAt: task.inProgressAt?.toISOString() || null,
      autoCompletedAt: task.autoCompletedAt?.toISOString() || null,
      completedAt: task.completedAt?.toISOString() || null,
    };

    res.status(201).json({
      message: "Task created successfully",
      task: formattedTask,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Create task error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/tasks
 * Get all tasks with filtering
 * Supports filters: status, priority, assignedToUserId, leadId, dueSoon, overdue
 * Queries leverage Prisma indices (status, priority, dueAt, assignedToId, leadId)
 */
router.get("/", authenticate, authorize("ADMIN", "BRANCH_MANAGER", "TEAM_LEADER", "COUNSELOR", "TELECALLER"), async (req, res) => {
  try {
    const user = (req as any).user;
    const userId = user?.userId || user?.id;
    const userRole = user?.role;

    if (!userId) {
      return res.status(401).json({ error: "Invalid user data" });
    }

    // Extract query parameters for filtering (leverages indices)
    const {
      status,
      priority,
      assignedToUserId,
      leadId,
      dueSoon,
      overdue,
      tags, // Phase 2: tags filter (comma-separated)
      source, // Phase 2: source filter
    } = req.query;

    // Build where clause
    let whereClause: any = {};

    // Apply query filters (these leverage Prisma indices)
    if (status && typeof status === "string") {
      whereClause.status = status; // Uses @@index([status])
    }

    if (priority && typeof priority === "string") {
      whereClause.priority = priority; // Uses @@index([priority])
    }

    if (assignedToUserId && typeof assignedToUserId === "string") {
      whereClause.assignedToId = assignedToUserId; // Uses @@index([assignedToId])
    }

    if (leadId && typeof leadId === "string") {
      whereClause.leadId = leadId; // Uses @@index([leadId])
    }

    // Due soon filter (tasks due within next 24 hours)
    if (dueSoon === "true" || dueSoon === true) {
      const now = new Date();
      const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      whereClause.dueAt = {
        gte: now,
        lte: next24Hours,
      };
      // Only show pending tasks for dueSoon
      whereClause.status = "PENDING";
    }

    // Overdue filter (tasks due before now and status != COMPLETED/CANCELLED)
    if (overdue === "true" || overdue === true) {
      const now = new Date();
      whereClause.dueAt = {
        lt: now,
      };
      whereClause.status = {
        notIn: ["COMPLETED", "CANCELLED"],
      };
    }

    // Phase 2: Tags filter (comma-separated, e.g., "missed_call,high")
    if (tags && typeof tags === "string") {
      const tagArray = tags.split(",").map((t) => t.trim()).filter(Boolean);
      if (tagArray.length > 0) {
        // Search for tasks that have any of the specified tags
        whereClause.OR = whereClause.OR || [];
        whereClause.OR.push(
          ...tagArray.map((tag) => ({
            tags: {
              contains: tag,
            },
          }))
        );
      }
    }

    // Phase 2: Source filter
    if (source && typeof source === "string") {
      whereClause.source = source; // Uses @@index([source])
    }

    // Store date filter separately - will combine with role filters later
    let dateFilter: any = null;
    
    // Filter out future tasks by default - only show tasks due today or earlier
    // This prevents tomorrow's tasks from appearing today (similar to callback filtering)
    // Only apply if no specific date filters are set (dueSoon, overdue)
    if (!dueSoon && !overdue) {
      const now = new Date();
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999); // End of today
      
      // Show tasks that are:
      // 1. Due today or earlier (dueAt <= end of today), OR
      // 2. Already completed/cancelled (regardless of due date)
      dateFilter = {
        OR: [
          // Tasks due today or earlier
          { dueAt: { lte: endOfToday } },
          // Completed or cancelled tasks (show all, even if future)
          { status: { in: ["COMPLETED", "CANCELLED"] } },
        ],
      };
    }

    // Role-based access control
    // Telecaller only sees tasks assigned to them
    if (userRole === "TELECALLER") {
      whereClause.assignedToId = userId; // Uses @@index([assignedToId])
    }
    // Team Leader sees tasks assigned to them or their team members
    else if (userRole === "TEAM_LEADER") {
      try {
        const teamLeader = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            teamMembers: {
              include: {
                role: true,
              },
            },
          },
        });

        if (!teamLeader) {
          whereClause.assignedToId = userId;
        } else {
          const teamMemberIds = (teamLeader.teamMembers || [])
            .filter((member) => member.role?.name === "TELECALLER" && member.isActive)
            .map((m) => m.id);

          teamMemberIds.push(userId);

          if (teamMemberIds.length > 0) {
            if (assignedToUserId && typeof assignedToUserId === "string") {
              if (!teamMemberIds.includes(assignedToUserId)) {
                return res.status(403).json({
                  error: "Access denied",
                  message: "You can only view tasks assigned to your team members",
                });
              }
            } else {
              whereClause.assignedToId = {
                in: teamMemberIds, // Uses @@index([assignedToId])
              };
            }
          } else {
            whereClause.assignedToId = userId;
          }
        }
      } catch (teamQueryError: any) {
        console.error("Error fetching team members:", teamQueryError);
        whereClause.assignedToId = userId;
      }
    }
    // Counselor sees tasks assigned to them
    else if (userRole === "COUNSELOR") {
      if (assignedToUserId && typeof assignedToUserId === "string" && assignedToUserId !== userId) {
        return res.status(403).json({
          error: "Access denied",
          message: "You can only view tasks assigned to you",
        });
      }
      whereClause.assignedToId = userId; // Uses @@index([assignedToId])
    }
    // Admin and Branch Manager see all tasks (no additional filter)

    // Filter out future tasks by default - only show tasks due today or earlier
    // This prevents tomorrow's tasks from appearing today (similar to callback filtering)
    // Only apply if no specific date filters are set (dueSoon, overdue)
    if (!dueSoon && !overdue) {
      const now = new Date();
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999); // End of today
      
      // If whereClause already has conditions, we need to combine with AND
      // Show tasks that are:
      // 1. Due today or earlier (dueAt <= end of today), OR
      // 2. Already completed/cancelled (regardless of due date)
      const dateFilter = {
        OR: [
          { dueAt: { lte: endOfToday } },
          { status: { in: ["COMPLETED", "CANCELLED"] } },
        ],
      };
      
      // Combine with existing whereClause using AND
      if (Object.keys(whereClause).length > 0) {
        whereClause = {
          AND: [
            whereClause,
            dateFilter,
          ],
        };
      } else {
        whereClause = dateFilter;
      }
    }

    // Execute query with error handling
    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        assignedTo: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        lead: {
          select: {
            id: true,
            leadId: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
      orderBy: [
        { dueAt: "asc" }, // Soonest first
        { createdAt: "desc" }, // Fallback to creation time
      ],
    });

    // Phase 2: Format response with new fields and overdueDays
    const formattedTasks = tasks.map((task) => {
      let tagsArray: string[] = [];
      if (task.tags) {
        try {
          tagsArray = JSON.parse(task.tags) as string[];
        } catch {
          // Invalid JSON, leave as empty array
        }
      }

      return {
        ...task,
        tags: tagsArray, // Return as array instead of JSON string
        overdueDays: calculateOverdueDays(task),
        dueAt: task.dueAt.toISOString(),
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        inProgressAt: task.inProgressAt?.toISOString() || null,
        autoCompletedAt: task.autoCompletedAt?.toISOString() || null,
        completedAt: task.completedAt?.toISOString() || null,
      };
    });

    res.json({ tasks: formattedTasks });
  } catch (error: any) {
    console.error("Get tasks error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error?.message || "Unknown error",
    });
  }
});

/**
 * GET /api/tasks/overdue
 * Get all overdue tasks
 */
router.get("/overdue", authenticate, authorize("ADMIN", "BRANCH_MANAGER", "TEAM_LEADER", "COUNSELOR", "TELECALLER"), async (req, res) => {
  try {
    const user = (req as any).user;
    const userId = user?.userId || user?.id;
    const userRole = user?.role;

    const now = new Date();

    // Base where clause: overdue tasks
    let whereClause: any = {
      dueAt: {
        lt: now,
      },
      status: {
        in: ["PENDING", "IN_PROGRESS"],
      },
    };

    // Role-based access control (same as GET /api/tasks)
    if (userRole === "TELECALLER") {
      whereClause.assignedToId = userId;
    } else if (userRole === "TEAM_LEADER") {
      try {
        const teamLeader = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            teamMembers: {
              where: { isActive: true },
              select: { id: true },
            },
          },
        });

        if (teamLeader) {
          const teamMemberIds = [
            userId, // Include team leader
            ...(teamLeader.teamMembers?.map((m: any) => m.id) || []),
          ];
          whereClause.assignedToId = {
            in: teamMemberIds,
          };
        }
      } catch (error) {
        // If team leader query fails, fallback to only their tasks
        whereClause.assignedToId = userId;
      }
    }
    // ADMIN, BRANCH_MANAGER, COUNSELOR see all tasks (no filter)

    // Find all overdue tasks
    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        assignedTo: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
      orderBy: [
        { dueAt: "asc" }, // Most overdue first
        { createdAt: "desc" },
      ],
    });

    // Phase 2: Format response with new fields and overdueDays
    const formattedTasks = tasks.map((task) => {
      let tagsArray: string[] = [];
      if (task.tags) {
        try {
          tagsArray = JSON.parse(task.tags) as string[];
        } catch {
          // Invalid JSON, leave as empty array
        }
      }

      return {
        ...task,
        tags: tagsArray, // Return as array instead of JSON string
        overdueDays: calculateOverdueDays(task),
        dueAt: task.dueAt.toISOString(),
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        inProgressAt: task.inProgressAt?.toISOString() || null,
        autoCompletedAt: task.autoCompletedAt?.toISOString() || null,
        completedAt: task.completedAt?.toISOString() || null,
      };
    });

    res.json({ tasks: formattedTasks });
  } catch (error: any) {
    console.error("Get overdue tasks error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error?.message || "Unknown error",
    });
  }
});

/**
 * GET /api/tasks/:id
 * Get single task by ID with TaskActivity list (most recent first)
 */
router.get("/:id", authenticate, authorize("ADMIN", "BRANCH_MANAGER", "TEAM_LEADER", "COUNSELOR", "TELECALLER"), async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const userId = user?.userId || user?.id;
    const userRole = user?.role;

    if (!userId) {
      return res.status(401).json({ error: "Invalid user data" });
    }

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignedTo: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        lead: {
          select: {
            id: true,
            leadId: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        activities: {
          include: {
            createdBy: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc", // Most recent first
          },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    // RBAC: Check if user can access this task
    if (userRole === "TELECALLER" || userRole === "COUNSELOR") {
      if (task.assignedToId !== userId) {
        return res.status(403).json({
          error: "Access denied",
          message: "You can only view tasks assigned to you",
        });
      }
    } else if (userRole === "TEAM_LEADER") {
      const teamLeader = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          teamMembers: {
            where: {
              isActive: true,
            },
          },
        },
      });

      if (teamLeader) {
        const teamMemberIds = teamLeader.teamMembers.map((m) => m.id);
        teamMemberIds.push(userId);

        if (!teamMemberIds.includes(task.assignedToId)) {
          return res.status(403).json({
            error: "Access denied",
            message: "You can only view tasks assigned to your team members",
          });
        }
      }
    }

    // Phase 2: Format response with new fields
    let tagsArray: string[] = [];
    if (task.tags) {
      try {
        tagsArray = JSON.parse(task.tags) as string[];
      } catch {
        // Invalid JSON, leave as empty array
      }
    }

    const formattedTask = {
      ...task,
      tags: tagsArray, // Return as array instead of JSON string
      overdueDays: calculateOverdueDays(task),
      dueAt: task.dueAt.toISOString(),
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      inProgressAt: task.inProgressAt?.toISOString() || null,
      autoCompletedAt: task.autoCompletedAt?.toISOString() || null,
      completedAt: task.completedAt?.toISOString() || null,
      activities: task.activities.map((activity) => ({
        ...activity,
        createdAt: activity.createdAt.toISOString(),
      })),
    };

    res.json({ task: formattedTask });
  } catch (error) {
    console.error("Get task error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PATCH /api/tasks/:id
 * Update task (partial update)
 * Create TaskActivity per change: STATUS_CHANGED, REASSIGNED, NOTE_ADDED, etc.
 */
router.patch("/:id", authenticate, authorize("ADMIN", "BRANCH_MANAGER", "TEAM_LEADER", "COUNSELOR", "TELECALLER"), async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const userId = user?.userId || user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Invalid user data" });
    }

    const validatedData = updateTaskSchema.parse(req.body);

    // Check if task exists
    const existingTask = await prisma.task.findUnique({
      where: { id },
    });

    if (!existingTask) {
      return res.status(404).json({ error: "Task not found" });
    }

    // RBAC: Check if user can update this task
    if (user.role === "TELECALLER" || user.role === "COUNSELOR") {
      if (existingTask.assignedToId !== userId) {
        return res.status(403).json({
          error: "Access denied",
          message: "You can only update tasks assigned to you",
        });
      }
    } else if (user.role === "TEAM_LEADER") {
      const teamLeader = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          teamMembers: {
            where: {
              isActive: true,
            },
          },
        },
      });

      if (teamLeader) {
        const teamMemberIds = teamLeader.teamMembers.map((m) => m.id);
        teamMemberIds.push(userId);

        if (!teamMemberIds.includes(existingTask.assignedToId)) {
          return res.status(403).json({
            error: "Access denied",
            message: "You can only update tasks assigned to your team members",
          });
        }
      }
    }

    // Check if assigned user exists (if reassigning)
    if (validatedData.assignedToUserId) {
      const assignedUser = await prisma.user.findUnique({
        where: { id: validatedData.assignedToUserId },
      });

      if (!assignedUser) {
        return res.status(400).json({ error: "Assigned user not found" });
      }

      if (!assignedUser.isActive) {
        return res.status(400).json({ error: "Cannot assign to inactive user" });
      }

      // RBAC: Team Leader can only reassign to team members
      if (user.role === "TEAM_LEADER") {
        const teamLeader = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            teamMembers: {
              where: {
                isActive: true,
              },
            },
          },
        });

        if (teamLeader) {
          const teamMemberIds = teamLeader.teamMembers.map((m) => m.id);
          teamMemberIds.push(userId);

          if (!teamMemberIds.includes(validatedData.assignedToUserId)) {
            return res.status(403).json({
              error: "Insufficient permissions",
              message: "Team Leaders can only reassign tasks to their team members",
            });
          }
        }
      }
    }

    // Check if lead exists (if provided)
    if (validatedData.leadId !== undefined) {
      if (validatedData.leadId) {
        const lead = await prisma.lead.findUnique({
          where: { id: validatedData.leadId },
        });

        if (!lead) {
          return res.status(400).json({ error: "Lead not found" });
        }
      }
    }

    // Build update data
    const updateData: any = {};

    if (validatedData.title !== undefined) updateData.title = validatedData.title;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.type !== undefined) updateData.type = validatedData.type;
    if (validatedData.priority !== undefined) updateData.priority = validatedData.priority;
    if (validatedData.dueAt !== undefined) updateData.dueAt = validatedData.dueAt;
    if (validatedData.leadId !== undefined) updateData.leadId = validatedData.leadId;

    // Track changes for TaskActivity
    const activityNotes: string[] = [];

    // Status change
    if (validatedData.status !== undefined && validatedData.status !== existingTask.status) {
      updateData.status = validatedData.status;
      if (validatedData.status === "COMPLETED") {
        updateData.completedAt = new Date();
      } else if (existingTask.status === "COMPLETED" && validatedData.status !== "COMPLETED") {
        updateData.completedAt = null;
      }
      // Phase 2: Set inProgressAt when status changes to IN_PROGRESS
      if (validatedData.status === "IN_PROGRESS" && existingTask.status !== "IN_PROGRESS") {
        updateData.inProgressAt = new Date();
      } else if (validatedData.status !== "IN_PROGRESS" && existingTask.status === "IN_PROGRESS") {
        updateData.inProgressAt = null;
      }
      activityNotes.push(`Status changed from ${existingTask.status} to ${validatedData.status}`);
    }

    // Reassignment
    if (validatedData.assignedToUserId !== undefined && validatedData.assignedToUserId !== existingTask.assignedToId) {
      const oldAssignee = await prisma.user.findUnique({
        where: { id: existingTask.assignedToId },
        select: { firstName: true, lastName: true },
      });
      const newAssignee = await prisma.user.findUnique({
        where: { id: validatedData.assignedToUserId },
        select: { firstName: true, lastName: true },
      });

      updateData.assignedToId = validatedData.assignedToUserId;
      activityNotes.push(
        `Reassigned from ${oldAssignee?.firstName} ${oldAssignee?.lastName} to ${newAssignee?.firstName} ${newAssignee?.lastName}`
      );
    }

    // Update task
    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        assignedTo: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        lead: {
          select: {
            id: true,
            leadId: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    });

    // Phase 2: Remove overdue tag if task is completed or due date updated to future
    try {
      if (validatedData.status === "COMPLETED" || validatedData.status === "CANCELLED") {
        await removeOverdueTag(task);
      } else if (validatedData.dueAt !== undefined) {
        // Check if new due date is in the future
        const now = new Date();
        if (validatedData.dueAt > now) {
          await removeOverdueTag(task);
        }
      }
    } catch (overdueError) {
      // Don't fail the update if overdue tag removal fails
      console.error("[TASK OVERDUE] Error removing overdue tag:", overdueError);
    }

    // Create TaskActivity entries for changes
    if (validatedData.status !== undefined && validatedData.status !== existingTask.status) {
      await createTaskActivity(
        task.id,
        "STATUS_CHANGED",
        userId,
        activityNotes.find((n) => n.includes("Status changed")) || undefined
      );

      // Phase 2: Send notification when task is completed
      if (validatedData.status === "COMPLETED") {
        try {
          await sendTaskNotification(task, "task_completed");
        } catch (notificationError) {
          console.error(
            "[TASK] Failed to send notification for completed task:",
            notificationError
          );
          // Don't fail update if notification fails
        }
      }
    }

    if (validatedData.assignedToUserId !== undefined && validatedData.assignedToUserId !== existingTask.assignedToId) {
      await createTaskActivity(
        task.id,
        "REASSIGNED",
        userId,
        activityNotes.find((n) => n.includes("Reassigned")) || undefined
      );
    }

    // Other field changes (title, description, priority, dueAt, type, leadId)
    const otherChanges: string[] = [];
    if (validatedData.title !== undefined && validatedData.title !== existingTask.title) {
      otherChanges.push(`Title: "${existingTask.title}" → "${validatedData.title}"`);
    }
    if (validatedData.description !== undefined && validatedData.description !== existingTask.description) {
      otherChanges.push("Description updated");
    }
    if (validatedData.priority !== undefined && validatedData.priority !== existingTask.priority) {
      otherChanges.push(`Priority: ${existingTask.priority} → ${validatedData.priority}`);
    }
    if (validatedData.dueAt !== undefined && validatedData.dueAt.getTime() !== existingTask.dueAt.getTime()) {
      otherChanges.push(`Due date updated`);
    }
    if (validatedData.type !== undefined && validatedData.type !== existingTask.type) {
      otherChanges.push(`Type: ${existingTask.type} → ${validatedData.type}`);
    }
    if (validatedData.leadId !== undefined && validatedData.leadId !== existingTask.leadId) {
      otherChanges.push("Lead association updated");
    }

    if (otherChanges.length > 0) {
      await createTaskActivity(task.id, "UPDATED", userId, otherChanges.join(", "));
    }

    res.json({
      message: "Task updated successfully",
      task,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Update task error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/tasks/:id/start
 * Start task (move to IN_PROGRESS)
 * Sets status=IN_PROGRESS, inProgressAt=now
 * Logs TaskActivity: STATUS_CHANGED
 */
router.post("/:id/start", authenticate, authorize("ADMIN", "BRANCH_MANAGER", "TEAM_LEADER", "COUNSELOR", "TELECALLER"), async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const userId = user?.userId || user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Invalid user data" });
    }

    // Check if task exists
    const task = await prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    // RBAC: Check if user can update this task
    if (user.role === "TELECALLER" || user.role === "COUNSELOR") {
      if (task.assignedToId !== userId) {
        return res.status(403).json({
          error: "Access denied",
          message: "You can only start tasks assigned to you",
        });
      }
    } else if (user.role === "TEAM_LEADER") {
      const teamLeader = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          teamMembers: {
            where: {
              isActive: true,
            },
          },
        },
      });

      if (teamLeader) {
        const teamMemberIds = teamLeader.teamMembers.map((m) => m.id);
        teamMemberIds.push(userId);

        if (!teamMemberIds.includes(task.assignedToId)) {
          return res.status(403).json({
            error: "Access denied",
            message: "You can only start tasks assigned to your team members",
          });
        }
      }
    }

    // Update status to IN_PROGRESS
    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        status: "IN_PROGRESS",
        inProgressAt: new Date(),
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        lead: {
          select: {
            id: true,
            leadId: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    });

    // Log TaskActivity
    await createTaskActivity(
      updatedTask.id,
      "STATUS_CHANGED",
      userId,
      `Status changed from ${task.status} to IN_PROGRESS`
    );

    // Phase 2: Format response
    let tagsArray: string[] = [];
    if (updatedTask.tags) {
      try {
        tagsArray = JSON.parse(updatedTask.tags) as string[];
      } catch {
        // Invalid JSON, leave as empty array
      }
    }

    const formattedTask = {
      ...updatedTask,
      tags: tagsArray,
      overdueDays: calculateOverdueDays(updatedTask),
      dueAt: updatedTask.dueAt.toISOString(),
      createdAt: updatedTask.createdAt.toISOString(),
      updatedAt: updatedTask.updatedAt.toISOString(),
      inProgressAt: updatedTask.inProgressAt?.toISOString() || null,
      autoCompletedAt: updatedTask.autoCompletedAt?.toISOString() || null,
      completedAt: updatedTask.completedAt?.toISOString() || null,
    };

    res.json({
      message: "Task started successfully",
      task: formattedTask,
    });
  } catch (error) {
    console.error("Start task error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/tasks/:id/complete
 * Convenience endpoint to complete a task
 * Sets status=COMPLETED, completedAt=now
 * Logs TaskActivity: COMPLETED
 */
router.post("/:id/complete", authenticate, authorize("ADMIN", "BRANCH_MANAGER", "TEAM_LEADER", "COUNSELOR", "TELECALLER"), async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const userId = user?.userId || user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Invalid user data" });
    }

    // Check if task exists
    const task = await prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    // RBAC: Check if user can complete this task
    if (user.role === "TELECALLER" || user.role === "COUNSELOR") {
      if (task.assignedToId !== userId) {
        return res.status(403).json({
          error: "Access denied",
          message: "You can only complete tasks assigned to you",
        });
      }
    } else if (user.role === "TEAM_LEADER") {
      const teamLeader = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          teamMembers: {
            where: {
              isActive: true,
            },
          },
        },
      });

      if (teamLeader) {
        const teamMemberIds = teamLeader.teamMembers.map((m) => m.id);
        teamMemberIds.push(userId);

        if (!teamMemberIds.includes(task.assignedToId)) {
          return res.status(403).json({
            error: "Access denied",
            message: "You can only complete tasks assigned to your team members",
          });
        }
      }
    }

    // Update task to completed
    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        lead: {
          select: {
            id: true,
            leadId: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    });

    // Phase 2: Remove overdue tag when task is completed
    try {
      await removeOverdueTag(updatedTask);
    } catch (overdueError) {
      // Don't fail the completion if overdue tag removal fails
      console.error("[TASK OVERDUE] Error removing overdue tag:", overdueError);
    }

    // Phase 2: Send notification when task is completed
    try {
      await sendTaskNotification(updatedTask, "task_completed");
    } catch (notificationError) {
      console.error(
        "[TASK] Failed to send notification for completed task:",
        notificationError
      );
      // Don't fail completion if notification fails
    }

    // Create TaskActivity: COMPLETED
    await createTaskActivity(updatedTask.id, "COMPLETED", userId, `Task completed: ${updatedTask.title}`);

    // Phase 2: Format response
    let tagsArray: string[] = [];
    if (updatedTask.tags) {
      try {
        tagsArray = JSON.parse(updatedTask.tags) as string[];
      } catch {
        // Invalid JSON, leave as empty array
      }
    }

    const formattedTask = {
      ...updatedTask,
      tags: tagsArray,
      overdueDays: calculateOverdueDays(updatedTask),
      dueAt: updatedTask.dueAt.toISOString(),
      createdAt: updatedTask.createdAt.toISOString(),
      updatedAt: updatedTask.updatedAt.toISOString(),
      inProgressAt: updatedTask.inProgressAt?.toISOString() || null,
      autoCompletedAt: updatedTask.autoCompletedAt?.toISOString() || null,
      completedAt: updatedTask.completedAt?.toISOString() || null,
    };

    res.json({
      message: "Task completed successfully",
      task: formattedTask,
    });
  } catch (error) {
    console.error("Complete task error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/tasks/:id/activity
 * Add manual note activity to task
 * Logs TaskActivity: NOTE_ADDED
 */
router.post("/:id/activity", authenticate, authorize("ADMIN", "BRANCH_MANAGER", "TEAM_LEADER", "COUNSELOR", "TELECALLER"), async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const userId = user?.userId || user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Invalid user data" });
    }

    const validatedData = addActivitySchema.parse(req.body);

    // Check if task exists
    const task = await prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    // RBAC: Check if user can add activity to this task
    if (user.role === "TELECALLER" || user.role === "COUNSELOR") {
      if (task.assignedToId !== userId) {
        return res.status(403).json({
          error: "Access denied",
          message: "You can only add activities to tasks assigned to you",
        });
      }
    } else if (user.role === "TEAM_LEADER") {
      const teamLeader = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          teamMembers: {
            where: {
              isActive: true,
            },
          },
        },
      });

      if (teamLeader) {
        const teamMemberIds = teamLeader.teamMembers.map((m) => m.id);
        teamMemberIds.push(userId);

        if (!teamMemberIds.includes(task.assignedToId)) {
          return res.status(403).json({
            error: "Access denied",
            message: "You can only add activities to tasks assigned to your team members",
          });
        }
      }
    }

    // Create TaskActivity: NOTE_ADDED
    const activity = await prisma.taskActivity.create({
      data: {
        taskId: id,
        action: "NOTE_ADDED",
        note: validatedData.note,
        createdById: userId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    res.status(201).json({
      message: "Activity added successfully",
      activity,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Add activity error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

