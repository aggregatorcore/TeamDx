import { Request, Response, NextFunction } from "express";
import { RoleName } from "../types/roles";
import { extractTokenFromHeader, verifyToken } from "../lib/auth";
import { supabase } from "../lib/supabase";

// Extend Express Request to include user information
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: RoleName;
    roleId: string;
  };
}

/**
 * Middleware to check if user is authenticated
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Extract token from Authorization header
    const token = extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      console.warn(`[Auth] No token provided for ${req.method} ${req.path}`);
      return res.status(401).json({ error: "Authentication required", message: "No token provided. Please login again." });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error: any) {
      console.warn(`[Auth] Token verification failed for ${req.method} ${req.path}:`, error.message);
      return res.status(401).json({
        error: "Invalid or expired token",
        message: "Your session has expired. Please login again."
      });
    }

    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("id, email, isActive, roleId")
      .eq("id", decoded.userId)
      .single();

    if (userError || !userRow) {
      return res.status(401).json({ error: "User not found" });
    }

    const { data: roleRow, error: roleError } = await supabase
      .from("roles")
      .select("id, name, isActive")
      .eq("id", userRow.roleId)
      .single();

    if (roleError || !roleRow) {
      return res.status(401).json({ error: "Role not found" });
    }

    if (!userRow.isActive) {
      return res.status(403).json({ error: "Account is deactivated" });
    }

    if (!roleRow.isActive) {
      return res.status(403).json({ error: "User role is deactivated" });
    }

    req.user = {
      userId: userRow.id,
      email: userRow.email,
      role: roleRow.name as RoleName,
      roleId: userRow.roleId,
    };

    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Middleware to check if user has required role(s)
 * @param allowedRoles - Array of roles that can access the route
 */
export const authorize = (...allowedRoles: RoleName[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    console.log(`[Auth] Checking authorization:`, {
      userRole: req.user.role,
      allowedRoles: allowedRoles,
      path: req.path,
      method: req.method,
    });

    // Case-insensitive role comparison
    const userRoleUpper = req.user.role.toUpperCase();
    const allowedRolesUpper = allowedRoles.map(r => r.toUpperCase());
    const hasAccess = allowedRolesUpper.includes(userRoleUpper);

    if (!hasAccess) {
      const errorMessage = `This route requires one of: ${allowedRoles.join(", ")}. Your role: ${req.user.role}`;
      console.log(`[Auth] Access denied: User role "${req.user.role}" (normalized: "${userRoleUpper}") not in allowed roles:`, allowedRoles);
      console.log(`[Auth] Full error message: ${errorMessage}`);
      return res.status(403).json({
        error: "Insufficient permissions",
        message: errorMessage,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
      });
    }

    console.log(`[Auth] Access granted for role: ${req.user.role}`);
    next();
  };
};

/**
 * Middleware to check if user has required permission
 * @param module - Module name (e.g., "users", "applications")
 * @param action - Action name (e.g., "create", "read", "update", "delete")
 */
export const requirePermission = (module: string, action: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const { data: permission } = await supabase
        .from("permissions")
        .select("id")
        .eq("module", module)
        .eq("action", action)
        .single();

      if (!permission) {
        return res.status(403).json({
          error: "Insufficient permissions",
          message: `Permission required: ${module}.${action}`,
        });
      }

      const { data: rolePerm } = await supabase
        .from("role_permissions")
        .select("id")
        .eq("roleId", req.user.roleId)
        .eq("permissionId", permission.id)
        .maybeSingle();

      if (!rolePerm) {
        return res.status(403).json({
          error: "Insufficient permissions",
          message: `Permission required: ${module}.${action}`,
        });
      }

      next();
    } catch (error) {
      console.error("Permission check error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  };
};

/**
 * Middleware to check if user can access resources at a certain hierarchy level
 * @param maxLevel - Maximum hierarchy level user can access
 */
export const checkHierarchyLevel = (maxLevel: number) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const { data: role } = await supabase
        .from("roles")
        .select("level")
        .eq("id", req.user.roleId)
        .single();

      if (!role) {
        return res.status(404).json({ error: "Role not found" });
      }

      if (role.level > maxLevel) {
        return res.status(403).json({
          error: "Insufficient permissions",
          message: "You don't have access to this resource level",
        });
      }

      next();
    } catch (error) {
      console.error("Hierarchy check error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  };
};

