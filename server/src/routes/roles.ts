import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/roleAuth";
import { RoleName } from "../types/roles";
import { prisma } from "../lib/prisma";

const router = Router();

// All routes require authentication
router.use(authenticate);

const updatePermissionsSchema = z.object({
  permissionIds: z.array(z.string()).min(1, "At least one permission is required"),
});

/**
 * GET /api/roles
 * Get all roles with their permissions
 * Accessible by ADMIN and HR_TEAM (HR needs to assign roles to shifts)
 */
router.get("/", authorize("ADMIN", "HR_TEAM"), async (req, res) => {
  try {
    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
        children: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: {
        level: "asc",
      },
    });

    const formattedRoles = roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      level: role.level,
      parentId: role.parentId,
      parent: role.parent,
      children: role.children,
      isActive: role.isActive,
      userCount: role._count.users,
      permissions: role.permissions.map((rp) => ({
        id: rp.permission.id,
        name: rp.permission.name,
        module: rp.permission.module,
        action: rp.permission.action,
        description: rp.permission.description,
      })),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    }));

    res.json({
      roles: formattedRoles,
    });
  } catch (error) {
    console.error("Get roles error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/roles/:id
 * Get role by ID with permissions
 */
router.get("/:id", authorize("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;

    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        parent: {
          select: {
            id: true,
            name: true,
            level: true,
          },
        },
        children: {
          select: {
            id: true,
            name: true,
            level: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    if (!role) {
      return res.status(404).json({ error: "Role not found" });
    }

    const formattedRole = {
      id: role.id,
      name: role.name,
      description: role.description,
      level: role.level,
      parentId: role.parentId,
      parent: role.parent,
      children: role.children,
      isActive: role.isActive,
      userCount: role._count.users,
      permissions: role.permissions.map((rp) => ({
        id: rp.permission.id,
        name: rp.permission.name,
        module: rp.permission.module,
        action: rp.permission.action,
        description: rp.permission.description,
      })),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };

    res.json({
      role: formattedRole,
    });
  } catch (error) {
    console.error("Get role error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PUT /api/roles/:id/permissions
 * Update role permissions
 */
router.put("/:id/permissions", authorize("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = updatePermissionsSchema.parse(req.body);

    // Check if role exists
    const role = await prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      return res.status(404).json({ error: "Role not found" });
    }

    // Verify all permissions exist
    const permissions = await prisma.permission.findMany({
      where: {
        id: {
          in: validatedData.permissionIds,
        },
      },
    });

    if (permissions.length !== validatedData.permissionIds.length) {
      return res.status(400).json({ error: "One or more permissions not found" });
    }

    // Delete existing permissions
    await prisma.rolePermission.deleteMany({
      where: {
        roleId: id,
      },
    });

    // Create new permissions
    await prisma.rolePermission.createMany({
      data: validatedData.permissionIds.map((permissionId) => ({
        roleId: id,
        permissionId,
      })),
    });

    // Fetch updated role with permissions
    const updatedRole = await prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    res.json({
      message: "Permissions updated successfully",
      role: {
        id: updatedRole!.id,
        name: updatedRole!.name,
        permissions: updatedRole!.permissions.map((rp) => ({
          id: rp.permission.id,
          name: rp.permission.name,
          module: rp.permission.module,
          action: rp.permission.action,
        })),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Update permissions error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/roles/permissions/all
 * Get all available permissions
 */
router.get("/permissions/all", authorize("ADMIN"), async (req, res) => {
  try {
    const permissions = await prisma.permission.findMany({
      orderBy: [
        { module: "asc" },
        { action: "asc" },
      ],
    });

    res.json({
      permissions,
    });
  } catch (error) {
    console.error("Get permissions error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

