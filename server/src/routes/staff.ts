import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, authorize } from "../middleware/roleAuth";

const router = Router();

// Validation schemas
const createAttendanceSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  date: z.string().optional(),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  status: z.enum(["present", "absent", "late", "half_day", "on_leave"]).optional(),
  workHours: z.number().optional(),
  notes: z.string().optional(),
});

const updateAttendanceSchema = createAttendanceSchema.partial().extend({
  userId: z.string().optional(),
});

const createLeaveRequestSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  leaveType: z.enum(["casual", "sick", "annual", "emergency", "unpaid"]),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  reason: z.string().min(1, "Reason is required"),
});

const updateLeaveRequestSchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "cancelled"]),
  rejectionReason: z.string().optional(),
});

const createPerformanceReviewSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  reviewPeriod: z.string().min(1, "Review period is required"),
  reviewDate: z.string().optional(),
  rating: z.number().min(1).max(5),
  goals: z.string().optional(),
  achievements: z.string().optional(),
  areasForImprovement: z.string().optional(),
  comments: z.string().optional(),
  nextReviewDate: z.string().optional(),
});

/**
 * GET /api/staff
 * Get all staff members with HR data
 * Accessible by: Admin, Branch Manager, HR Team, Receptionist (for attendance marking), Team Leader, Counselor, and Telecaller (for assignment purposes)
 */
router.get("/", authenticate, authorize("ADMIN", "BRANCH_MANAGER", "HR_TEAM", "RECEPTIONIST", "TEAM_LEADER", "COUNSELOR", "TELECALLER"), async (req, res) => {
  try {
    const { role, status } = req.query;

    const whereClause: any = {};
    if (role) {
      whereClause.role = {
        name: role as string,
      };
    }
    if (status === "active") {
      whereClause.isActive = true;
    } else if (status === "inactive") {
      whereClause.isActive = false;
    }

    const staff = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        isActive: true,
        role: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        teamLeader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: {
            attendanceRecords: true,
            leaveRequests: true,
            performanceReviews: true,
          },
        },
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({ staff });
  } catch (error) {
    console.error("Get staff error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/staff/attendance
 * Get attendance records (all or filtered by user)
 * NOTE: This route MUST be before /:id to avoid route conflicts
 */
router.get(
  "/attendance",
  authenticate,
  authorize("ADMIN", "BRANCH_MANAGER", "HR_TEAM", "RECEPTIONIST"),
  async (req, res) => {
    try {
      const { userId, startDate, endDate } = req.query;

      const whereClause: any = {};

      if (userId && userId !== "all") {
        whereClause.userId = userId as string;
      }

      if (startDate && endDate) {
        whereClause.date = {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string),
        };
      }

      const attendance = await prisma.attendance.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              email: true,
              role: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          date: "desc",
        },
      });

      res.json({ attendance });
    } catch (error) {
      console.error("Get attendance error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * POST /api/staff/attendance
 * Create or update attendance record
 */
router.post(
  "/attendance",
  authenticate,
  authorize("ADMIN", "BRANCH_MANAGER", "HR_TEAM", "RECEPTIONIST"),
  async (req, res) => {
    try {
      const validatedData = createAttendanceSchema.parse(req.body);

      const date = validatedData.date ? new Date(validatedData.date) : new Date();
      date.setHours(0, 0, 0, 0);

      const attendanceData: any = {
        userId: validatedData.userId,
        date,
        status: validatedData.status || "present",
        checkIn: validatedData.checkIn ? new Date(validatedData.checkIn) : null,
        checkOut: validatedData.checkOut ? new Date(validatedData.checkOut) : null,
        workHours: validatedData.workHours || null,
        notes: validatedData.notes || null,
      };

      const attendance = await prisma.attendance.upsert({
        where: {
          userId_date: {
            userId: validatedData.userId,
            date,
          },
        },
        update: attendanceData,
        create: attendanceData,
      });

      // Emit WebSocket notification to user when checked in
      if (attendance.checkIn && !attendance.checkOut) {
        const { getIO } = require("../lib/socket");
        const io = getIO();
        if (io) {
          io.to(`user:${validatedData.userId}`).emit("attendance:checked-in", {
            attendanceId: attendance.id,
            checkIn: attendance.checkIn,
            timestamp: new Date().toISOString(),
          });
        }
      }

      res.status(201).json({
        message: "Attendance recorded successfully",
        attendance,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Create attendance error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * PUT /api/staff/attendance/:id
 * Update attendance record
 */
router.put(
  "/attendance/:id",
  authenticate,
  authorize("ADMIN", "BRANCH_MANAGER", "HR_TEAM", "RECEPTIONIST"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateAttendanceSchema.parse(req.body);

      const updateData: any = {};
      if (validatedData.checkIn) updateData.checkIn = new Date(validatedData.checkIn);
      if (validatedData.checkOut) updateData.checkOut = new Date(validatedData.checkOut);
      if (validatedData.status) updateData.status = validatedData.status;
      if (validatedData.workHours !== undefined) updateData.workHours = validatedData.workHours;
      if (validatedData.notes !== undefined) updateData.notes = validatedData.notes;

      const attendance = await prisma.attendance.update({
        where: { id },
        data: updateData,
        include: {
          user: {
            select: {
              id: true,
            },
          },
        },
      });

      // Emit WebSocket notification when checked out
      if (updateData.checkOut) {
        const { getIO } = require("../lib/socket");
        const io = getIO();
        if (io) {
          io.to(`user:${attendance.userId}`).emit("attendance:checked-out", {
            attendanceId: attendance.id,
            checkOut: attendance.checkOut,
            timestamp: new Date().toISOString(),
          });
        }
      }

      res.json({
        message: "Attendance updated successfully",
        attendance,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Update attendance error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * GET /api/staff/leave-requests
 * Get all leave requests
 */
router.get(
  "/leave-requests",
  authenticate,
  authorize("ADMIN", "BRANCH_MANAGER", "HR_TEAM"),
  async (req, res) => {
    try {
      const { status, userId } = req.query;

      const whereClause: any = {};
      if (status) {
        whereClause.status = status as string;
      }
      if (userId) {
        whereClause.userId = userId as string;
      }

      const leaveRequests = await prisma.leaveRequest.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              email: true,
              role: {
                select: {
                  name: true,
                },
              },
            },
          },
          approvedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      res.json({ leaveRequests });
    } catch (error) {
      console.error("Get leave requests error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * POST /api/staff/leave-requests
 * Create leave request
 */
router.post(
  "/leave-requests",
  authenticate,
  authorize("ADMIN", "BRANCH_MANAGER", "HR_TEAM"),
  async (req, res) => {
    try {
      const validatedData = createLeaveRequestSchema.parse(req.body);

      const startDate = new Date(validatedData.startDate);
      const endDate = new Date(validatedData.endDate);
      const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      const leaveRequest = await prisma.leaveRequest.create({
        data: {
          userId: validatedData.userId,
          leaveType: validatedData.leaveType,
          startDate,
          endDate,
          days,
          reason: validatedData.reason,
        },
        include: {
          user: {
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
        message: "Leave request created successfully",
        leaveRequest,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Create leave request error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * PUT /api/staff/leave-requests/:id
 * Update leave request (approve/reject)
 */
router.put(
  "/leave-requests/:id",
  authenticate,
  authorize("ADMIN", "BRANCH_MANAGER", "HR_TEAM"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;
      const validatedData = updateLeaveRequestSchema.parse(req.body);

      const updateData: any = {
        status: validatedData.status,
      };

      if (validatedData.status === "approved") {
        updateData.approvedById = userId;
        updateData.approvedAt = new Date();
      } else if (validatedData.status === "rejected") {
        updateData.rejectionReason = validatedData.rejectionReason || null;
      }

      const leaveRequest = await prisma.leaveRequest.update({
        where: { id },
        data: updateData,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      res.json({
        message: `Leave request ${validatedData.status} successfully`,
        leaveRequest,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Update leave request error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * GET /api/staff/performance-reviews
 * Get all performance reviews
 */
router.get(
  "/performance-reviews",
  authenticate,
  authorize("ADMIN", "BRANCH_MANAGER", "HR_TEAM"),
  async (req, res) => {
    try {
      const { userId } = req.query;

      const whereClause: any = {};
      if (userId) {
        whereClause.userId = userId as string;
      }

      const reviews = await prisma.performanceReview.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              email: true,
              role: {
                select: {
                  name: true,
                },
              },
            },
          },
          reviewedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          reviewDate: "desc",
        },
      });

      res.json({ reviews });
    } catch (error) {
      console.error("Get performance reviews error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * POST /api/staff/performance-reviews
 * Create performance review
 */
router.post(
  "/performance-reviews",
  authenticate,
  authorize("ADMIN", "BRANCH_MANAGER", "HR_TEAM"),
  async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const validatedData = createPerformanceReviewSchema.parse(req.body);

      const review = await prisma.performanceReview.create({
        data: {
          userId: validatedData.userId,
          reviewPeriod: validatedData.reviewPeriod,
          reviewDate: validatedData.reviewDate ? new Date(validatedData.reviewDate) : new Date(),
          reviewedById: userId,
          rating: validatedData.rating,
          goals: validatedData.goals || null,
          achievements: validatedData.achievements || null,
          areasForImprovement: validatedData.areasForImprovement || null,
          comments: validatedData.comments || null,
          nextReviewDate: validatedData.nextReviewDate ? new Date(validatedData.nextReviewDate) : null,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          reviewedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      res.status(201).json({
        message: "Performance review created successfully",
        review,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Create performance review error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * GET /api/staff/:id
 * Get staff member details with HR data
 * NOTE: This route MUST be AFTER all specific routes (attendance, leave-requests, etc.)
 */
router.get("/:id", authenticate, authorize("ADMIN", "BRANCH_MANAGER", "HR_TEAM"), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if id is a reserved route name
    if (["attendance", "leave-requests", "performance-reviews"].includes(id)) {
      return res.status(404).json({ error: "Invalid staff member ID" });
    }

    const staff = await prisma.user.findUnique({
      where: { id },
      include: {
        role: true,
        teamLeader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        teamMembers: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            isActive: true,
          },
        },
        attendanceRecords: {
          orderBy: {
            date: "desc",
          },
          take: 30, // Last 30 days
        },
        leaveRequests: {
          orderBy: {
            createdAt: "desc",
          },
          include: {
            approvedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        performanceReviews: {
          orderBy: {
            reviewDate: "desc",
          },
          include: {
            reviewedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!staff) {
      return res.status(404).json({ error: "Staff member not found" });
    }

    res.json({ staff });
  } catch (error) {
    console.error("Get staff member error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

