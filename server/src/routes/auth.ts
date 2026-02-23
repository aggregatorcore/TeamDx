import { Router } from "express";
import { z } from "zod";
import { authenticate, AuthenticatedRequest } from "../middleware/roleAuth";
import { supabase } from "../lib/supabase";
import { verifyPassword, generateToken } from "../lib/auth";
import { generateEmployeeCode } from "../lib/employeeCode";

const router = Router();

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().optional(),
  roleId: z.string().min(1, "Role ID is required"),
});

/**
 * POST /api/auth/register
 */
router.post("/register", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user?.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admin can register users" });
    }

    const validatedData = registerSchema.parse(req.body);

    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", validatedData.email)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: "User with this email already exists" });
    }

    const { data: role } = await supabase
      .from("roles")
      .select("id")
      .eq("id", validatedData.roleId)
      .single();

    if (!role) {
      return res.status(400).json({ error: "Invalid role ID" });
    }

    const { hashPassword } = await import("../lib/auth");
    const hashedPassword = await hashPassword(validatedData.password);
    const employeeCode = await generateEmployeeCode();

    const { data: user, error: insertError } = await supabase
      .from("users")
      .insert({
        employeeCode,
        email: validatedData.email,
        password: hashedPassword,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        phone: validatedData.phone ?? null,
        roleId: validatedData.roleId,
        isActive: true,
        updatedAt: new Date().toISOString(),
      })
      .select("id, employeeCode, email, firstName, lastName, phone, isActive, roleId, createdAt")
      .single();

    if (insertError) {
      console.error("Registration insert error:", insertError);
      return res.status(500).json({ error: "Internal server error" });
    }

    const { data: roleDetail } = await supabase
      .from("roles")
      .select("id, name, description, level")
      .eq("id", validatedData.roleId)
      .single();

    res.status(201).json({
      message: "User created successfully",
      user: { ...user, role: roleDetail ?? {} },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Registration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/auth/login
 */
router.post("/login", async (req, res) => {
  console.log(`[AUTH] Login attempt received:`, {
    email: req.body?.email ? "provided" : "not provided",
    hasPassword: !!req.body?.password,
    timestamp: new Date().toISOString(),
  });

  try {
    const validatedData = loginSchema.parse(req.body);
    const email = String(validatedData.email).trim().toLowerCase();
    if (!email) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (userError || !userRow) {
      console.log(`[AUTH] Login failed - user not found: ${email}`);
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const { data: role, error: roleError } = await supabase
      .from("roles")
      .select("*")
      .eq("id", userRow.roleId)
      .single();

    if (roleError || !role) {
      console.error("[AUTH] User has missing role:", userRow.id, userRow.roleId);
      return res.status(500).json({ error: "Account configuration error" });
    }

    const user = { ...userRow, role };

    if (!user.isActive) {
      console.log(`[AUTH] Login failed - account deactivated: ${user.email}`);
      return res.status(403).json({ error: "Account is deactivated" });
    }

    const isValidPassword = await verifyPassword(validatedData.password, user.password);
    if (!isValidPassword) {
      console.log(`[AUTH] Login failed - invalid password: ${user.email}`);
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: role.name as any,
      roleId: user.roleId,
    });

    console.log(`[AUTH] Login successful: ${user.email} (userId: ${user.id}, role: ${role.name})`);

    let requiresCheckIn = false;
    if (role.name !== "RECEPTIONIST" && role.name !== "ADMIN") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: todayAttendance } = await supabase
        .from("attendance")
        .select("checkIn")
        .eq("userId", user.id)
        .gte("date", today.toISOString())
        .lt("date", tomorrow.toISOString())
        .limit(1)
        .maybeSingle();

      if (!todayAttendance || !todayAttendance.checkIn) {
        requiresCheckIn = true;
        try {
          const { getIO } = require("../lib/socket");
          const io = getIO();
          const { data: receptionistRole } = await supabase.from("roles").select("id").eq("name", "RECEPTIONIST").single();
          if (receptionistRole?.id) {
            const { data: receptionists } = await supabase
              .from("users")
              .select("id")
              .eq("roleId", receptionistRole.id)
              .eq("isActive", true);
            receptionists?.forEach((r: { id: string }) => {
              io.to(`user:${r.id}`).emit("attendance:checkin-required", {
                userId: user.id,
                userName: `${user.firstName} ${user.lastName}`,
                employeeCode: user.employeeCode,
                timestamp: new Date().toISOString(),
              });
            });
          }
        } catch (_) {}
      }
    }

    const { data: activeSessions } = await supabase
      .from("user_sessions")
      .select("id")
      .eq("userId", user.id)
      .is("logoutTime", null);

    const now = new Date().toISOString();
    if (activeSessions?.length) {
      for (const session of activeSessions) {
        await supabase
          .from("user_sessions")
          .update({ logoutTime: now, status: "unavailable", updatedAt: now })
          .eq("id", session.id);
      }
    }

    const sessionId = require("crypto").randomUUID();
    await supabase.from("user_sessions").insert({
      id: sessionId,
      userId: user.id,
      loginTime: now,
      status: "available",
      updatedAt: now,
    });

    const { password: _p, ...userWithoutPassword } = user;
    res.json({
      message: "Login successful",
      token,
      sessionId,
      requiresCheckIn,
      user: {
        id: user.id,
        employeeCode: user.employeeCode,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: {
          id: role.id,
          name: role.name,
          description: role.description,
          level: role.level,
        },
        isActive: user.isActive,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Login error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: "Internal server error", message: msg });
  }
});

/**
 * POST /api/auth/logout
 */
router.post("/logout", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    console.log(`[AUTH] Logout: ${req.user.email} (userId: ${req.user.userId})`);

    const { data: activeSessions } = await supabase
      .from("user_sessions")
      .select("id")
      .eq("userId", req.user.userId)
      .is("logoutTime", null);

    const now = new Date().toISOString();
    if (activeSessions?.length) {
      for (const session of activeSessions) {
        await supabase
          .from("user_sessions")
          .update({ logoutTime: now, status: "unavailable", updatedAt: now })
          .eq("id", session.id);
      }
    }

    res.json({ message: "Logged out successfully", sessionsEnded: activeSessions?.length ?? 0 });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/auth/me
 */
router.get("/me", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const { data: userRow, error } = await supabase
      .from("users")
      .select("id, employeeCode, email, firstName, lastName, phone, isActive, roleId, createdAt, updatedAt")
      .eq("id", req.user.userId)
      .single();

    if (error || !userRow) {
      return res.status(404).json({ error: "User not found" });
    }

    const { data: role } = await supabase
      .from("roles")
      .select("id, name, description, level, isActive")
      .eq("id", userRow.roleId)
      .single();

    res.json({ user: { ...userRow, role: role ?? {} } });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
