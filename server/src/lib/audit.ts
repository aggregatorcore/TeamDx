import { prisma } from "./prisma";

/**
 * Audit Event Data Interface
 */
export interface AuditEventData {
  entityType: string; // "LEAD", "CLIENT", "APPLICATION", "TASK", "USER", etc.
  entityId: string; // ID of the affected entity
  action: string; // "CREATE", "UPDATE", "DELETE", "ASSIGN", "STATUS_CHANGE", etc.
  userId: string; // User who performed the action
  oldValue?: any; // Old state (for UPDATE actions)
  newValue?: any; // New state (for UPDATE/CREATE actions)
  changes?: Record<string, { old: any; new: any }>; // Specific field changes
  description?: string; // Human-readable description
  metadata?: Record<string, any>; // Additional context (IP, user agent, etc.)
}

/**
 * Main function to log audit events
 * @param data - Audit event data
 * @returns Created audit event or null if logging fails
 */
export async function logAuditEvent(data: AuditEventData): Promise<any | null> {
  try {
    // Validate required fields
    if (!data.entityType || !data.entityId || !data.action || !data.userId) {
      console.error("[Audit] Missing required fields:", {
        hasEntityType: !!data.entityType,
        hasEntityId: !!data.entityId,
        hasAction: !!data.action,
        hasUserId: !!data.userId,
      });
      return null;
    }

    // Serialize JSON fields
    const oldValueJson = data.oldValue ? JSON.stringify(data.oldValue) : null;
    const newValueJson = data.newValue ? JSON.stringify(data.newValue) : null;
    const changesJson = data.changes ? JSON.stringify(data.changes) : null;
    const metadataJson = data.metadata ? JSON.stringify(data.metadata) : null;

    // Create audit event
    const auditEvent = await prisma.auditEvent.create({
      data: {
        entityType: data.entityType.toUpperCase(),
        entityId: data.entityId,
        action: data.action.toUpperCase(),
        userId: data.userId,
        oldValue: oldValueJson,
        newValue: newValueJson,
        changes: changesJson,
        description: data.description || null,
        metadata: metadataJson,
      },
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

    // Emit Socket.IO event for real-time updates
    try {
      const { broadcastAuditEvent } = require("./socket");
      broadcastAuditEvent(auditEvent);
    } catch (error: any) {
      // Don't fail audit logging if WebSocket broadcast fails
      console.warn("[Audit] Failed to broadcast audit event via WebSocket:", error.message);
    }

    return auditEvent;
  } catch (error: any) {
    // Don't throw - audit logging failure shouldn't break the main operation
    console.error("[Audit] Failed to log audit event:", error.message);
    return null;
  }
}

/**
 * Helper: Log CREATE action
 */
export async function logCreate(
  entityType: string,
  entityId: string,
  userId: string,
  newValue?: any,
  description?: string,
  metadata?: Record<string, any>
): Promise<any | null> {
  return logAuditEvent({
    entityType,
    entityId,
    action: "CREATE",
    userId,
    newValue,
    description: description || `${entityType} created`,
    metadata,
  });
}

/**
 * Helper: Log UPDATE action
 */
export async function logUpdate(
  entityType: string,
  entityId: string,
  userId: string,
  oldValue?: any,
  newValue?: any,
  changes?: Record<string, { old: any; new: any }>,
  description?: string,
  metadata?: Record<string, any>
): Promise<any | null> {
  return logAuditEvent({
    entityType,
    entityId,
    action: "UPDATE",
    userId,
    oldValue,
    newValue,
    changes,
    description: description || `${entityType} updated`,
    metadata,
  });
}

/**
 * Helper: Log DELETE action
 */
export async function logDelete(
  entityType: string,
  entityId: string,
  userId: string,
  oldValue?: any,
  description?: string,
  metadata?: Record<string, any>
): Promise<any | null> {
  return logAuditEvent({
    entityType,
    entityId,
    action: "DELETE",
    userId,
    oldValue,
    description: description || `${entityType} deleted`,
    metadata,
  });
}

/**
 * Helper: Log ASSIGN action
 */
export async function logAssign(
  entityType: string,
  entityId: string,
  userId: string,
  assignedToUserId?: string,
  assignedFromUserId?: string,
  description?: string,
  metadata?: Record<string, any>
): Promise<any | null> {
  const changes: Record<string, { old: any; new: any }> = {};
  if (assignedFromUserId) {
    changes.assignedToId = { old: assignedFromUserId, new: assignedToUserId || null };
  } else {
    changes.assignedToId = { old: null, new: assignedToUserId || null };
  }

  return logAuditEvent({
    entityType,
    entityId,
    action: "ASSIGN",
    userId,
    changes,
    description: description || `${entityType} assigned`,
    metadata: {
      ...metadata,
      assignedToUserId,
      assignedFromUserId,
    },
  });
}

/**
 * Helper: Log STATUS_CHANGE action
 */
export async function logStatusChange(
  entityType: string,
  entityId: string,
  userId: string,
  oldStatus: string,
  newStatus: string,
  description?: string,
  metadata?: Record<string, any>
): Promise<any | null> {
  return logAuditEvent({
    entityType,
    entityId,
    action: "STATUS_CHANGE",
    userId,
    changes: {
      status: { old: oldStatus, new: newStatus },
    },
    description: description || `${entityType} status changed from ${oldStatus} to ${newStatus}`,
    metadata,
  });
}

/**
 * Helper: Log TAG_APPLIED action
 */
export async function logTagApplied(
  entityType: string,
  entityId: string,
  userId: string,
  tagValue: string,
  description?: string,
  metadata?: Record<string, any>
): Promise<any | null> {
  return logAuditEvent({
    entityType,
    entityId,
    action: "TAG_APPLIED",
    userId,
    changes: {
      tag: { old: null, new: tagValue },
    },
    description: description || `Tag "${tagValue}" applied to ${entityType}`,
    metadata: {
      ...metadata,
      tagValue,
    },
  });
}

/**
 * Helper: Log ROLE_CHANGE action (for users)
 */
export async function logRoleChange(
  userId: string,
  actorUserId: string,
  oldRoleId: string,
  newRoleId: string,
  description?: string,
  metadata?: Record<string, any>
): Promise<any | null> {
  return logAuditEvent({
    entityType: "USER",
    entityId: userId,
    action: "ROLE_CHANGE",
    userId: actorUserId,
    changes: {
      roleId: { old: oldRoleId, new: newRoleId },
    },
    description: description || `User role changed`,
    metadata,
  });
}

