import express, { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { authenticate, authorize } from "../middleware/roleAuth";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/reports/team-leader
 * Get team statistics for Team Leader, Branch Manager, or Admin
 */
router.get("/team-leader", authorize("TEAM_LEADER", "BRANCH_MANAGER", "ADMIN"), async (req: any, res) => {
  try {
    const user = req.user;
    const userId = user?.userId || user?.id;
    const userRole = user?.role;

    // Get all team members
    // For ADMIN/BRANCH_MANAGER: show all active users (or all team leaders' teams)
    // For TEAM_LEADER: show only their team members
    let teamMembers: any[] = [];
    try {
      if (userRole === "ADMIN" || userRole === "BRANCH_MANAGER") {
        // For ADMIN/BRANCH_MANAGER, show all active users (or all team leaders and their members)
        // Option 1: Show all active users
        teamMembers = await prisma.user.findMany({
          where: {
            isActive: true,
            role: {
              name: {
                in: ["TELECALLER", "COUNSELOR", "TEAM_LEADER"],
              },
            },
          },
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
        });
      } else {
        // For TEAM_LEADER, show only their team members
        teamMembers = await prisma.user.findMany({
          where: {
            teamLeaderId: userId,
            isActive: true,
          },
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
        });
      }
    } catch (error: any) {
      // If teamLeaderId field doesn't exist, try alternative approach
      console.warn("Error fetching team members with teamLeaderId, trying alternative...");
      // Get Telecallers under this Team Leader's role
      const telecallerRole = await prisma.role.findUnique({
        where: { name: "TELECALLER" },
      });
      if (telecallerRole) {
        teamMembers = await prisma.user.findMany({
          where: {
            roleId: telecallerRole.id,
            isActive: true,
          },
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
        });
      }
    }

    const teamMemberIds = teamMembers.map((member) => member.id);
    const allTeamUserIds = userRole === "ADMIN" || userRole === "BRANCH_MANAGER" 
      ? teamMemberIds // For ADMIN/BRANCH_MANAGER, don't include self
      : [userId, ...teamMemberIds]; // For TEAM_LEADER, include team leader

    // Get leads assigned to team members
    // For ADMIN/BRANCH_MANAGER: get all leads
    // For TEAM_LEADER: get only team leads
    const teamLeadsWhere = userRole === "ADMIN" || userRole === "BRANCH_MANAGER"
      ? {} // Get all leads for ADMIN/BRANCH_MANAGER
      : {
          assignedToId: {
            in: allTeamUserIds,
          },
        };
    
    const teamLeads = await prisma.lead.findMany({
      where: teamLeadsWhere,
      select: {
        id: true,
        status: true,
        assignedToId: true,
        createdAt: true,
      },
    });

    // Get calls made by team members
    // For ADMIN/BRANCH_MANAGER: get all calls
    // For TEAM_LEADER: get only team calls
    const teamCallsWhere = userRole === "ADMIN" || userRole === "BRANCH_MANAGER"
      ? {} // Get all calls for ADMIN/BRANCH_MANAGER
      : {
          createdById: {
            in: allTeamUserIds,
          },
        };
    
    const teamCalls = await prisma.call.findMany({
      where: teamCallsWhere,
      select: {
        id: true,
        status: true,
        duration: true,
        callType: true,
        createdById: true,
        callDate: true,
      },
    });

    // Calculate statistics
    const totalLeads = teamLeads.length;
    const leadsByStatus = {
      new: teamLeads.filter((l) => l.status === "new").length,
      contacted: teamLeads.filter((l) => l.status === "contacted").length,
      qualified: teamLeads.filter((l) => l.status === "qualified").length,
      converted: teamLeads.filter((l) => l.status === "converted").length,
      lost: teamLeads.filter((l) => l.status === "lost").length,
    };

    const totalCalls = teamCalls.length;
    const callsByStatus = {
      completed: teamCalls.filter((c) => c.status === "completed").length,
      missed: teamCalls.filter((c) => c.status === "missed").length,
      no_answer: teamCalls.filter((c) => c.status === "no_answer").length,
      busy: teamCalls.filter((c) => c.status === "busy").length,
      callback: teamCalls.filter((c) => c.status === "callback").length,
    };

    const totalCallDuration = teamCalls
      .filter((c) => c.duration)
      .reduce((sum, c) => sum + (c.duration || 0), 0);
    const avgCallDuration = totalCalls > 0 ? Math.round(totalCallDuration / totalCalls) : 0;

    const conversionRate =
      totalLeads > 0 ? ((leadsByStatus.converted / totalLeads) * 100).toFixed(1) : "0.0";

    // Team member performance
    const memberPerformance = teamMembers.map((member) => {
      const memberLeads = teamLeads.filter((l) => l.assignedToId === member.id);
      const memberCalls = teamCalls.filter((c) => c.createdById === member.id);
      const memberConverted = memberLeads.filter((l) => l.status === "converted").length;

      return {
        id: member.id,
        name: `${member.firstName} ${member.lastName}`,
        email: member.email,
        role: member.role.name,
        totalLeads: memberLeads.length,
        convertedLeads: memberConverted,
        conversionRate:
          memberLeads.length > 0
            ? ((memberConverted / memberLeads.length) * 100).toFixed(1)
            : "0.0",
        totalCalls: memberCalls.length,
        completedCalls: memberCalls.filter((c) => c.status === "completed").length,
        totalCallDuration: memberCalls
          .filter((c) => c.duration)
          .reduce((sum, c) => sum + (c.duration || 0), 0),
      };
    });

    // Daily statistics (last 7 days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      date.setHours(0, 0, 0, 0);
      return date;
    });

    const dailyStats = last7Days.map((date) => {
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);

      const dayLeads = teamLeads.filter(
        (l) => l.createdAt >= date && l.createdAt < nextDay
      ).length;
      const dayCalls = teamCalls.filter(
        (c) => c.callDate >= date && c.callDate < nextDay
      ).length;

      return {
        date: date.toISOString().split("T")[0],
        leads: dayLeads,
        calls: dayCalls,
      };
    });

    res.json({
      teamStats: {
        totalTeamMembers: teamMembers.length,
        totalLeads,
        totalCalls,
        conversionRate: parseFloat(conversionRate),
        avgCallDuration,
        leadsByStatus,
        callsByStatus,
      },
      memberPerformance,
      dailyStats,
    });
  } catch (error) {
    console.error("Get team leader reports error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/reports/team-member/:id
 * Get detailed statistics for a specific team member
 */
router.get("/team-member/:id", authorize("TEAM_LEADER"), async (req: any, res) => {
  try {
    const user = req.user;
    const teamLeaderId = user?.userId || user?.id;
    const { id: memberId } = req.params;

    // Verify that the member belongs to this team leader
    let teamMember: any = null;
    try {
      teamMember = await prisma.user.findFirst({
        where: {
          id: memberId,
          teamLeaderId: teamLeaderId,
          isActive: true,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: {
            select: {
              name: true,
              description: true,
            },
          },
          createdAt: true,
        },
      });
    } catch (error: any) {
      // Fallback: check if user is a Telecaller
      const telecallerRole = await prisma.role.findUnique({
        where: { name: "TELECALLER" },
      });
      if (telecallerRole) {
        teamMember = await prisma.user.findFirst({
          where: {
            id: memberId,
            roleId: telecallerRole.id,
            isActive: true,
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            role: {
              select: {
                name: true,
                description: true,
              },
            },
            createdAt: true,
          },
        });
      }
    }

    if (!teamMember) {
      return res.status(404).json({ error: "Team member not found" });
    }

    // Get all leads assigned to this member
    const memberLeads = await prisma.lead.findMany({
      where: {
        assignedToId: memberId,
      },
      include: {
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Get all calls made by this member
    const memberCalls = await prisma.call.findMany({
      where: {
        createdById: memberId,
      },
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: {
        callDate: "desc",
      },
    });

    // Calculate statistics
    const leadsByStatus = {
      new: memberLeads.filter((l) => l.status === "new").length,
      contacted: memberLeads.filter((l) => l.status === "contacted").length,
      qualified: memberLeads.filter((l) => l.status === "qualified").length,
      converted: memberLeads.filter((l) => l.status === "converted").length,
      lost: memberLeads.filter((l) => l.status === "lost").length,
    };

    const callsByStatus = {
      completed: memberCalls.filter((c) => c.status === "completed").length,
      missed: memberCalls.filter((c) => c.status === "missed").length,
      no_answer: memberCalls.filter((c) => c.status === "no_answer").length,
      busy: memberCalls.filter((c) => c.status === "busy").length,
      callback: memberCalls.filter((c) => c.status === "callback").length,
    };

    const totalCallDuration = memberCalls
      .filter((c) => c.duration)
      .reduce((sum, c) => sum + (c.duration || 0), 0);
    const avgCallDuration =
      memberCalls.length > 0 ? Math.round(totalCallDuration / memberCalls.length) : 0;

    const conversionRate =
      memberLeads.length > 0
        ? ((leadsByStatus.converted / memberLeads.length) * 100).toFixed(1)
        : "0.0";

    res.json({
      member: teamMember,
      stats: {
        totalLeads: memberLeads.length,
        totalCalls: memberCalls.length,
        conversionRate: parseFloat(conversionRate),
        avgCallDuration,
        leadsByStatus,
        callsByStatus,
      },
      leads: memberLeads,
      calls: memberCalls,
    });
  } catch (error) {
    console.error("Get team member details error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
