import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/roleAuth";
import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/auth";
import { generateEmployeeCode } from "../lib/employeeCode";

const router = Router();

// All routes require authentication
router.use(authenticate);

const createUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().optional(),
  roleId: z.string().min(1, "Role ID is required"),
  teamMemberIds: z.array(z.string()).optional(), // For Team Leader: users to assign
  teamName: z.string().optional(), // Team name (only for Team Leaders, e.g., "Team 1", "Team 2")
});

const updateUserSchema = z.object({
  email: z.string().email("Invalid email address").optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  roleId: z.string().optional(),
  isActive: z.boolean().optional(),
  teamMemberIds: z.array(z.string()).optional(), // For Team Leader: users to assign
  teamName: z.string().optional(), // Team name (only for Team Leaders)
});

/**
 * GET /api/users
 * Get all users (Admin and Branch Manager only)
 */
router.get("/", authorize("ADMIN", "BRANCH_MANAGER"), async (req, res) => {
  try {
    // Fetch users - try with teamLeaderId first, fallback if field doesn't exist
    let users;
    
    // Check if teamLeaderId field exists by trying a simple query
    try {
      // Try to query with teamLeaderId
      users = await prisma.user.findMany({
        select: {
          id: true,
          employeeCode: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          isActive: true,
          roleId: true,
          teamLeaderId: true,
          teamName: true,
          teamLeader: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          role: {
            select: {
              id: true,
              name: true,
              description: true,
              level: true,
            },
          },
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    } catch (schemaError: any) {
      // If error occurs, try without teamLeaderId
      console.warn("Error fetching with teamLeaderId, trying without it...");
      console.warn("Error details:", schemaError?.message || schemaError);
      
      try {
        users = await prisma.user.findMany({
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            isActive: true,
            roleId: true,
            teamName: true,
            role: {
              select: {
                id: true,
                name: true,
                description: true,
                level: true,
              },
            },
            createdAt: true,
            updatedAt: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        });
        
        // Add null teamLeaderId for compatibility
        users = users.map((user: any) => ({
          ...user,
          teamLeaderId: null,
          teamLeader: null,
        }));
        
        console.log("Successfully fetched users without teamLeaderId field");
      } catch (fallbackError: any) {
        console.error("Fallback query also failed:", fallbackError);
        throw fallbackError;
      }
    }

    res.json({
      users,
    });
  } catch (error: any) {
    console.error("Get users error:", error);
    console.error("Error stack:", error?.stack);
    res.status(500).json({ 
      error: "Internal server error", 
      details: error?.message || "Unknown error",
      hint: "Check server console for detailed error logs"
    });
  }
});

/**
 * GET /api/users/my-team
 * Get current Team Leader's team members (for Team Leader only)
 */
router.get("/my-team", authorize("TEAM_LEADER"), async (req, res) => {
  try {
    const user = (req as any).user;
    const userId = user?.userId || user?.id;

    // Get Team Leader's team members
    const teamLeader = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        teamMembers: {
          where: {
            isActive: true,
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            isActive: true,
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!teamLeader) {
      return res.status(404).json({ error: "Team Leader not found" });
    }

    // Filter only TELECALLER and COUNSELOR roles
    const telecallers = teamLeader.teamMembers.filter(
      (member) => member.role.name === "TELECALLER" || member.role.name === "COUNSELOR"
    );

    res.json({
      teamLeader: {
        id: teamLeader.id,
        firstName: teamLeader.firstName,
        lastName: teamLeader.lastName,
        email: teamLeader.email,
        teamName: (teamLeader as any).teamName,
      },
      members: telecallers,
      totalMembers: telecallers.length,
    });
  } catch (error) {
    console.error("Get my team error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/users/teams
 * Get all teams (Team Leaders with their team members count)
 * NOTE: This route must come BEFORE /:id to avoid route conflicts
 */
router.get("/teams", authorize("ADMIN", "BRANCH_MANAGER"), async (req, res) => {
  try {
    // Get all Team Leaders
    const teamLeaders = await prisma.user.findMany({
      where: {
        role: {
          name: "TEAM_LEADER",
        },
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        teamName: true,
        teamMembers: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            isActive: true,
          },
          where: {
            isActive: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        firstName: "asc",
      },
    });

    // Format teams with member count
    const teams = teamLeaders.map((leader) => ({
      id: leader.id,
      teamLeaderId: leader.id,
      teamName: leader.teamName || `${leader.firstName} ${leader.lastName}'s Team`,
      teamLeaderName: `${leader.firstName} ${leader.lastName}`,
      teamLeaderEmail: leader.email,
      teamLeaderPhone: leader.phone,
      memberCount: leader.teamMembers.length,
      members: leader.teamMembers,
      role: leader.role,
    }));

    res.json({
      teams,
      totalTeams: teams.length,
    });
  } catch (error) {
    console.error("Get teams error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/users/:id
 * Get user by ID
 */
router.get("/:id", authorize("ADMIN", "BRANCH_MANAGER"), async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        employeeCode: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        roleId: true,
        role: {
          select: {
            id: true,
            name: true,
            description: true,
            level: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      user,
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/users
 * Create new user (Admin only)
 */
router.post("/", authorize("ADMIN"), async (req, res) => {
  try {
    const validatedData = createUserSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return res.status(400).json({ error: "User with this email already exists" });
    }

    // Check if role exists
    const role = await prisma.role.findUnique({
      where: { id: validatedData.roleId },
    });

    if (!role) {
      return res.status(400).json({ error: "Invalid role ID" });
    }

    // Hash password
    const hashedPassword = await hashPassword(validatedData.password);

    // Generate unique employee code
    const employeeCode = await generateEmployeeCode();
    console.log(`🔵 [USER CREATE] Generated employee code: ${employeeCode}`);

    // Create user
    const user = await prisma.user.create({
      data: {
        employeeCode,
        email: validatedData.email,
        password: hashedPassword,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        phone: validatedData.phone,
        roleId: validatedData.roleId,
        teamName: validatedData.teamName || null,
      },
      select: {
        id: true,
        employeeCode: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        roleId: true,
        role: {
          select: {
            id: true,
            name: true,
            description: true,
            level: true,
          },
        },
        createdAt: true,
      },
    });

    // If teamMemberIds provided and user is Team Leader, assign team members
    if (validatedData.teamMemberIds && validatedData.teamMemberIds.length > 0 && role.name === "TEAM_LEADER") {
      try {
        console.log(`Assigning ${validatedData.teamMemberIds.length} team members to Team Leader ${user.id}`);
        console.log("Team member IDs:", validatedData.teamMemberIds);
        
        const updateResult = await prisma.user.updateMany({
          where: {
            id: { in: validatedData.teamMemberIds },
          },
          data: {
            teamLeaderId: user.id,
          },
        });
        
        console.log(`Successfully assigned ${updateResult.count} team members to Team Leader ${user.id}`);
      } catch (teamError: any) {
        console.error("Error assigning team members:", teamError);
        console.error("Error details:", teamError?.message);
        console.warn("Could not assign team members (teamLeaderId field may not exist):", teamError?.message);
        console.warn("To enable team assignment, run: npx prisma db push");
        // Continue without failing - team assignment is optional
      }
    }

    res.status(201).json({
      message: "User created successfully",
      user,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Create user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/users/assign-employee-codes
 * Assign employee codes to existing users who don't have one (Admin only)
 */
router.post("/assign-employee-codes", authorize("ADMIN"), async (req, res) => {
  try {
    // Find all users without employee codes
    const usersWithoutCode = await prisma.user.findMany({
      where: {
        employeeCode: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    if (usersWithoutCode.length === 0) {
      return res.json({
        message: "All users already have employee codes",
        assigned: 0,
      });
    }

    // Assign employee codes to each user
    const assignedCodes: Array<{ userId: string; employeeCode: string }> = [];
    
    for (const user of usersWithoutCode) {
      try {
        const employeeCode = await generateEmployeeCode();
        await prisma.user.update({
          where: { id: user.id },
          data: { employeeCode },
        });
        assignedCodes.push({
          userId: user.id,
          employeeCode,
        });
        console.log(`✅ Assigned employee code ${employeeCode} to ${user.firstName} ${user.lastName}`);
      } catch (error: any) {
        console.error(`❌ Failed to assign code to user ${user.id}:`, error.message);
      }
    }

    res.json({
      message: `Assigned employee codes to ${assignedCodes.length} user(s)`,
      assigned: assignedCodes.length,
      codes: assignedCodes,
    });
  } catch (error: any) {
    console.error("Assign employee codes error:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

/**
 * PUT /api/users/:id
 * Update user (Admin only)
 */
router.put("/:id", authorize("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = updateUserSchema.parse(req.body);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // If email is being updated, check if it's already taken
    if (validatedData.email && validatedData.email !== existingUser.email) {
      const emailTaken = await prisma.user.findUnique({
        where: { email: validatedData.email },
      });

      if (emailTaken) {
        return res.status(400).json({ error: "Email already taken" });
      }
    }

    // If role is being updated, verify it exists
    if (validatedData.roleId) {
      const role = await prisma.role.findUnique({
        where: { id: validatedData.roleId },
      });

      if (!role) {
        return res.status(400).json({ error: "Invalid role ID" });
      }
    }

    // Extract teamMemberIds if provided
    const { teamMemberIds, ...updateData } = validatedData;

    // Get current user role to check if it's Team Leader
    const currentUser = await prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });

    // Update user
    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        employeeCode: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        roleId: true,
        role: {
          select: {
            id: true,
            name: true,
            description: true,
            level: true,
          },
        },
        updatedAt: true,
      },
    });

    // Handle team member assignments if teamMemberIds provided
    if (teamMemberIds !== undefined) {
      try {
        console.log(`Updating team assignments for Team Leader ${id}`);
        console.log("Team member IDs to assign:", teamMemberIds);
        
        // First, remove all existing team assignments for this team leader
        const removeResult = await prisma.user.updateMany({
          where: {
            teamLeaderId: id,
          },
          data: {
            teamLeaderId: null,
          },
        });
        console.log(`Removed ${removeResult.count} existing team assignments`);

        // Then, assign new team members if provided and user is Team Leader
        const finalRole = user.role.name === "TEAM_LEADER" ? user.role : currentUser?.role;
        if (teamMemberIds.length > 0 && finalRole?.name === "TEAM_LEADER") {
          const assignResult = await prisma.user.updateMany({
            where: {
              id: { in: teamMemberIds },
            },
            data: {
              teamLeaderId: id,
            },
          });
          console.log(`Successfully assigned ${assignResult.count} team members to Team Leader ${id}`);
        } else {
          console.log("No team members to assign or user is not Team Leader");
        }
      } catch (teamError: any) {
        console.error("Error updating team assignments:", teamError);
        console.error("Error details:", teamError?.message);
        console.error("Error stack:", teamError?.stack);
        console.warn("Could not update team assignments (teamLeaderId field may not exist):", teamError?.message);
        console.warn("To enable team assignment, run: npx prisma db push");
        // Continue without failing - team assignment is optional
      }
    }

    res.json({
      message: "User updated successfully",
      user,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Update user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /api/users/:id
 * Delete user (Admin only)
 */
router.delete("/:id", authorize("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Don't allow deleting yourself
    if (user.id === req.user?.userId) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    // Delete user
    await prisma.user.delete({
      where: { id },
    });

    res.json({
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

