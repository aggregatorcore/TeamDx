import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, authorize, AuthenticatedRequest } from "../middleware/roleAuth";

const router = Router();

// Validation schemas
const startBreakSchema = z.object({
  breakType: z.enum(["break", "meeting", "bio_break", "lunch", "tea_break"]),
  reason: z.string().optional(),
});

const setStatusSchema = z.object({
  status: z.enum(["available", "unavailable"]),
});

/**
 * POST /api/sessions/start
 * Start a new session (called automatically on login)
 */
router.post("/start", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user.userId;

    // Check if there's an active session for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingSession = await prisma.userSession.findFirst({
      where: {
        userId,
        loginTime: {
          gte: today,
          lt: tomorrow,
        },
        logoutTime: null, // Active session
      },
    });

    // Find shift for user's role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            roleShifts: {
              include: {
                shift: true,
              },
            },
          },
        },
      },
    });

    let shiftId: string | undefined;
    if (user?.role.roleShifts.length > 0) {
      // Get the first active shift for this role
      const activeShift = user.role.roleShifts.find((rs) => rs.shift?.isActive);
      if (activeShift?.shift) {
        shiftId = activeShift.shift.id;
      }
    }

    if (existingSession) {
      // If existing session doesn't have a shift but we found one, update it
      if (!existingSession.shiftId && shiftId) {
        const updatedSession = await prisma.userSession.update({
          where: { id: existingSession.id },
          data: { shiftId },
          include: {
            user: {
              select: {
                id: true,
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
            shift: true,
            currentBreak: true,
            breaks: {
              orderBy: {
                startTime: "desc",
              },
            },
          },
        });
        return res.json({
          session: updatedSession,
          message: "Session already active",
        });
      }
      
      // Return existing session with shift included
      const sessionWithShift = await prisma.userSession.findUnique({
        where: { id: existingSession.id },
        include: {
          user: {
            select: {
              id: true,
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
          shift: true,
          currentBreak: true,
          breaks: {
            orderBy: {
              startTime: "desc",
            },
          },
        },
      });
      
      return res.json({
        session: sessionWithShift,
        message: "Session already active",
      });
    }

    // Create new session
    const session = await prisma.userSession.create({
      data: {
        userId,
        shiftId,
        loginTime: new Date(),
        status: "available",
      },
      include: {
        user: {
          select: {
            id: true,
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
        shift: true,
      },
    });

    res.json({
      session,
      message: "Session started successfully",
    });
  } catch (error: any) {
    console.error("Start session error:", error);
    res.status(500).json({ error: "Failed to start session", details: error.message });
  }
});

/**
 * GET /api/sessions/current
 * Get current active session
 */
router.get("/current", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user.userId;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const session = await prisma.userSession.findFirst({
      where: {
        userId,
        loginTime: {
          gte: today,
          lt: tomorrow,
        },
        logoutTime: null,
      },
      include: {
        user: {
          select: {
            id: true,
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
        shift: true,
        currentBreak: true,
        breaks: {
          orderBy: {
            startTime: "desc",
          },
        },
      },
    });

    // If session exists but doesn't have a shift, try to assign one
    if (session && !session.shiftId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          role: {
            include: {
              roleShifts: {
                include: {
                  shift: true,
                },
              },
            },
          },
        },
      });

      if (user?.role.roleShifts.length > 0) {
        const activeShift = user.role.roleShifts.find((rs) => rs.shift?.isActive);
        if (activeShift?.shift) {
          await prisma.userSession.update({
            where: { id: session.id },
            data: { shiftId: activeShift.shift.id },
          });
          // Refetch session with shift
          const updatedSession = await prisma.userSession.findUnique({
            where: { id: session.id },
            include: {
              user: {
                select: {
                  id: true,
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
              shift: true,
              currentBreak: true,
              breaks: {
                orderBy: {
                  startTime: "desc",
                },
              },
            },
          });
          if (updatedSession) {
            // Calculate current work time for updated session
            const now = new Date();
            const totalSessionTime = Math.floor((now.getTime() - updatedSession.loginTime.getTime()) / 1000);
            const totalWorkTime = Math.max(0, totalSessionTime - (updatedSession.totalBreakTime || 0));
            
            const sessionWithWorkTime = {
              ...updatedSession,
              totalWorkTime,
              sessionStartTime: updatedSession.loginTime.toISOString(),
              currentBreak: updatedSession.currentBreak ? {
                id: updatedSession.currentBreak.id,
                startTime: updatedSession.currentBreak.startTime.toISOString(),
                breakType: updatedSession.currentBreak.breakType,
                reason: updatedSession.currentBreak.reason,
              } : null,
            };
            
            return res.json({ session: sessionWithWorkTime });
          }
        }
      }
    }

    if (!session) {
      // Return 200 with null session instead of 404 - this is expected when user hasn't started a session yet
      return res.json({ session: null });
    }

    // Calculate current work time: total session time - total break time
    const now = new Date();
    const totalSessionTime = Math.floor((now.getTime() - session.loginTime.getTime()) / 1000);
    const totalWorkTime = Math.max(0, totalSessionTime - (session.totalBreakTime || 0));

    // Add calculated work time to session response
    const sessionWithWorkTime = {
      ...session,
      totalWorkTime, // Add calculated work time
      sessionStartTime: session.loginTime.toISOString(), // For frontend compatibility
      currentBreak: session.currentBreak ? {
        id: session.currentBreak.id,
        startTime: session.currentBreak.startTime.toISOString(),
        breakType: session.currentBreak.breakType,
        reason: session.currentBreak.reason,
      } : null,
    };

    res.json({ session: sessionWithWorkTime });
  } catch (error: any) {
    console.error("Get current session error:", error);
    res.status(500).json({ error: "Failed to get session", details: error.message });
  }
});

/**
 * GET /api/sessions/logs
 * Get detailed login/logout/break logs for HR Team
 */
router.get("/logs", authenticate, authorize("HR_TEAM", "ADMIN"), async (req: AuthenticatedRequest, res) => {
  try {
    const { userId, roleId, startDate, endDate, period } = req.query;

    let start: Date;
    let end: Date;

    if (period === "today") {
      start = new Date();
      start.setHours(0, 0, 0, 0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
    } else if (period === "week") {
      end = new Date();
      end.setHours(23, 59, 59, 999);
      start = new Date(end);
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
    } else if (period === "month") {
      end = new Date();
      end.setHours(23, 59, 59, 999);
      start = new Date(end);
      start.setMonth(start.getMonth() - 1);
      start.setHours(0, 0, 0, 0);
    } else if (startDate && endDate) {
      start = new Date(startDate as string);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
    } else {
      // Default to today
      start = new Date();
      start.setHours(0, 0, 0, 0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
    }

    const where: any = {
      loginTime: {
        gte: start,
        lte: end,
      },
    };

    if (userId) {
      where.userId = userId as string;
    }

    if (roleId) {
      where.user = {
        roleId: roleId as string,
      };
    }

    const sessions = await prisma.userSession.findMany({
      where,
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
                id: true,
                name: true,
              },
            },
          },
        },
        shift: true,
        currentBreak: true,
        breaks: {
          orderBy: {
            startTime: "asc",
          },
        },
      },
      orderBy: {
        loginTime: "desc",
      },
    });

    res.json({ sessions, period: { start, end } });
  } catch (error: any) {
    console.error("Get session logs error:", error);
    res.status(500).json({ error: "Failed to fetch session logs", details: error.message });
  }
});

/**
 * POST /api/sessions/start-break
 * Start a break
 */
router.post("/start-break", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user.userId;
    const validatedData = startBreakSchema.parse(req.body);

    // Get current active session
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const session = await prisma.userSession.findFirst({
      where: {
        userId,
        loginTime: {
          gte: today,
          lt: tomorrow,
        },
        logoutTime: null,
      },
    });

    if (!session) {
      return res.status(404).json({ error: "No active session found" });
    }

    if (session.currentBreakId) {
      return res.status(400).json({ error: "Break already in progress" });
    }

    // Create break record
    const breakRecord = await prisma.breakRecord.create({
      data: {
        sessionId: session.id,
        breakType: validatedData.breakType,
        reason: validatedData.reason,
        startTime: new Date(),
      },
    });

    // Update session
    const updatedSession = await prisma.userSession.update({
      where: { id: session.id },
      data: {
        status: "unavailable",
        currentBreakId: breakRecord.id,
      },
      include: {
        user: {
          select: {
            id: true,
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
        currentBreak: true,
        breaks: {
          orderBy: {
            startTime: "desc",
          },
        },
      },
    });

    res.json({
      session: updatedSession,
      message: "Break started successfully",
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Start break error:", error);
    res.status(500).json({ error: "Failed to start break", details: error.message });
  }
});

/**
 * POST /api/sessions/end-break
 * End current break and resume work
 */
router.post("/end-break", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user.userId;

    // Get current active session
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const session = await prisma.userSession.findFirst({
      where: {
        userId,
        loginTime: {
          gte: today,
          lt: tomorrow,
        },
        logoutTime: null,
      },
      include: {
        currentBreak: true,
      },
    });

    if (!session) {
      return res.status(404).json({ error: "No active session found" });
    }

    if (!session.currentBreakId || !session.currentBreak) {
      return res.status(400).json({ error: "No active break found" });
    }

    const endTime = new Date();
    const duration = Math.floor((endTime.getTime() - session.currentBreak.startTime.getTime()) / 1000);

    // Update break record
    await prisma.breakRecord.update({
      where: { id: session.currentBreakId },
      data: {
        endTime,
        duration,
      },
    });

    // Update session
    const updatedSession = await prisma.userSession.update({
      where: { id: session.id },
      data: {
        status: "available",
        currentBreakId: null,
        totalBreakTime: {
          increment: duration,
        },
      },
      include: {
        user: {
          select: {
            id: true,
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
        currentBreak: true,
        breaks: {
          orderBy: {
            startTime: "desc",
          },
        },
      },
    });

    res.json({
      session: updatedSession,
      message: "Break ended successfully",
    });
  } catch (error: any) {
    console.error("End break error:", error);
    res.status(500).json({ error: "Failed to end break", details: error.message });
  }
});

/**
 * POST /api/sessions/set-status
 * Set user status (available/unavailable)
 */
router.post("/set-status", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user.userId;
    const validatedData = setStatusSchema.parse(req.body);

    // Get current active session
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const session = await prisma.userSession.findFirst({
      where: {
        userId,
        loginTime: {
          gte: today,
          lt: tomorrow,
        },
        logoutTime: null,
      },
    });

    if (!session) {
      return res.status(404).json({ error: "No active session found" });
    }

    // Don't allow status change if break is active
    if (session.currentBreakId && validatedData.status === "available") {
      return res.status(400).json({ error: "Cannot set available while break is active. Please end break first." });
    }

    // Update session status
    const updatedSession = await prisma.userSession.update({
      where: { id: session.id },
      data: {
        status: validatedData.status,
      },
      include: {
        user: {
          select: {
            id: true,
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
        currentBreak: true,
        breaks: {
          orderBy: {
            startTime: "desc",
          },
        },
      },
    });

    res.json({
      session: updatedSession,
      message: `Status set to ${validatedData.status}`,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Set status error:", error);
    res.status(500).json({ error: "Failed to set status", details: error.message });
  }
});

/**
 * POST /api/sessions/end
 * End current session (called on logout)
 */
router.post("/end", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;

    // Check attendance check-out status (only for non-receptionist roles)
    if (userRole !== "RECEPTIONIST" && userRole !== "ADMIN") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayAttendance = await prisma.attendance.findUnique({
        where: {
          userId_date: {
            userId,
            date: today,
          },
        },
      });

      // If checked in but not checked out, block logout
      if (todayAttendance && todayAttendance.checkIn && !todayAttendance.checkOut) {
        return res.status(400).json({ 
          error: "Check-out required",
          message: "Pehle logout karna hoga fir checkout hoga. Please get checked out by receptionist before logging out.",
          requiresCheckOut: true,
        });
      }
    }

    // Get current active session
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const session = await prisma.userSession.findFirst({
      where: {
        userId,
        loginTime: {
          gte: today,
          lt: tomorrow,
        },
        logoutTime: null,
      },
      include: {
        currentBreak: true,
      },
    });

    if (!session) {
      return res.json({ message: "No active session to end" });
    }

    const logoutTime = new Date();
    const totalSessionTime = Math.floor((logoutTime.getTime() - session.loginTime.getTime()) / 1000);
    const totalWorkTime = totalSessionTime - session.totalBreakTime;

    // End any active break
    if (session.currentBreakId && session.currentBreak) {
      const endTime = logoutTime;
      const duration = Math.floor((endTime.getTime() - session.currentBreak.startTime.getTime()) / 1000);

      await prisma.breakRecord.update({
        where: { id: session.currentBreakId },
        data: {
          endTime,
          duration,
        },
      });
    }

    // Update session
    await prisma.userSession.update({
      where: { id: session.id },
      data: {
        logoutTime,
        totalWorkTime,
        status: "unavailable",
        currentBreakId: null,
      },
    });

    res.json({ message: "Session ended successfully" });
  } catch (error: any) {
    console.error("End session error:", error);
    res.status(500).json({ error: "Failed to end session", details: error.message });
  }
});

export default router;

