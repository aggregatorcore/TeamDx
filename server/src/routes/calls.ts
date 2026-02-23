import express, { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, authorize, AuthenticatedRequest } from "../middleware/roleAuth";
import {
  createTaskFromMissedCall,
  createTaskFromIncomingCall,
  createTaskFromCallback,
} from "../services/taskAutoCreationService";
import { autoCompleteTaskFromCall } from "../services/taskAutoCompleteService";

const router = express.Router();

// Action rule types (matching tagActionRunner.ts)
interface ActionRule {
  attempts: Array<{
    attemptNumber: number;
    delayMinutes: number;
    actions: Array<{
      type: string;
      params: Record<string, any>;
    }>;
  }>;
  finalAttempt?: {
    delayMinutes: number;
    actions: Array<{
      type: string;
      params: Record<string, any>;
    }>;
  };
}

/**
 * Helper function to create TagActionInstance when tag has actions
 * This is called automatically when a tag with actions is applied
 */
async function createTagActionInstance(
  tagApplicationId: string,
  tagFlowId: string,
  entityType: string,
  entityId: string,
  actionsJson: string | null
): Promise<void> {
  try {
    // If no actions, skip instance creation
    if (!actionsJson || actionsJson.trim() === "") {
      return;
    }

    // Parse action rules JSON
    let actionRule: ActionRule;
    try {
      actionRule = JSON.parse(actionsJson);
    } catch (parseError: any) {
      console.error(`[TagActionInstance] Failed to parse action rules for tag ${tagFlowId}:`, parseError);
      return; // Don't throw, just skip instance creation
    }

    // Validate action rule structure
    if (!actionRule || !actionRule.attempts || actionRule.attempts.length === 0) {
      console.warn(`[TagActionInstance] No valid attempts found in action rules for tag ${tagFlowId}`);
      return;
    }

    // Get first attempt configuration
    const firstAttempt = actionRule.attempts[0];
    if (!firstAttempt || !firstAttempt.delayMinutes) {
      console.warn(`[TagActionInstance] First attempt missing delayMinutes for tag ${tagFlowId}`);
      return;
    }

    // Calculate nextRunAt: current time + delayMinutes from first attempt
    const nextRunAt = new Date();
    nextRunAt.setMinutes(nextRunAt.getMinutes() + firstAttempt.delayMinutes);

    // Calculate maxAttempts: number of attempts + finalAttempt (if exists)
    const maxAttempts = actionRule.attempts.length + (actionRule.finalAttempt ? 1 : 0);

    // Create TagActionInstance
    await prisma.tagActionInstance.create({
      data: {
        tagApplicationId,
        tagFlowId,
        entityType,
        entityId,
        currentAttempt: 1,
        maxAttempts,
        nextRunAt,
        status: "pending",
        actionRuleJson: actionsJson, // Store the full action rule JSON
      },
    });

    console.log(
      `[TagActionInstance] Created instance for tag ${tagFlowId} on ${entityType} ${entityId}. ` +
      `Next run: ${nextRunAt.toISOString()}, Max attempts: ${maxAttempts}`
    );
  } catch (error: any) {
    // Log error but don't fail the tag application
    console.error(`[TagActionInstance] Failed to create instance for tag ${tagFlowId}:`, error);
  }
}

// All routes require authentication
router.use(authenticate);

const createCallSchema = z.object({
  leadId: z.string().optional(),
  phoneNumber: z.string().min(1, "Phone number is required"),
  callType: z.enum(["outgoing", "incoming"]).optional().default("outgoing"),
  status: z.enum(["completed", "missed", "no_answer", "busy", "callback"]).optional().default("completed"),
  duration: z.number().int().positive().optional(),
  notes: z.string().optional(),
  callDate: z.string().optional(),
});

const updateCallSchema = z.object({
  status: z.enum(["completed", "missed", "no_answer", "busy", "callback"]).optional(),
  duration: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

const initiateCallSchema = z.object({
  phoneNumber: z.string().min(1, "Phone number is required"),
  leadId: z.string().optional(),
});

const mobileCallLogSchema = z.object({
  callId: z.string().min(1, "callId is required"), // Required: must be provided and non-empty
  phoneNumber: z.string().min(1, "Phone number is required"),
  callType: z.enum(["outgoing", "incoming"]),
  state: z.enum(["ringing", "connected", "ended", "missed", "offhook", "idle"]),
  startTime: z.string().optional(),
  connectTime: z.string().optional(),
  endTime: z.string().optional(),
  duration: z.number().int().optional(),
  wasConnected: z.boolean().optional().default(false),
  recordingPath: z.string().optional(),
  deviceId: z.string().optional(),
});

/**
 * GET /api/calls
 * Get all calls (filtered by user role)
 */
router.get("/", authorize("ADMIN", "BRANCH_MANAGER", "TEAM_LEADER", "TELECALLER"), async (req: any, res) => {
  try {
    const user = req.user;
    const userId = user?.userId || user?.id;

    // Build query based on role
    let where: any = {};

    // Telecallers can only see their own calls
    if (user?.role === "TELECALLER") {
      where.createdById = userId;
    }
    // Team Leaders can see calls from their team (Telecallers)
    else if (user?.role === "TEAM_LEADER") {
      // Get all Telecallers under this Team Leader
      const telecallerRole = await prisma.role.findUnique({
        where: { name: "TELECALLER" },
      });

      if (telecallerRole) {
        const telecallers = await prisma.user.findMany({
          where: {
            roleId: telecallerRole.id,
            isActive: true,
          },
          select: { id: true },
        });

        where.createdById = {
          in: telecallers.map((t) => t.id),
        };
      }
    }
    // Admin and Branch Manager can see all calls (where remains empty {})

    // Log query details for debugging
    console.log(`[Calls API] Request from user:`, {
      role: user?.role,
      userId: userId,
      whereClause: where,
      timestamp: new Date().toISOString(),
    });

    const calls = await prisma.call.findMany({
      where,
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
        createdBy: {
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
        callDate: "desc",
      },
    });

    // Log results with more details
    console.log(`[Calls API] Query result:`, {
      totalCalls: calls.length,
      userRole: user?.role,
      callsByType: {
        incoming: calls.filter(c => c.callType === "incoming").length,
        outgoing: calls.filter(c => c.callType === "outgoing").length,
      },
      callsBySource: {
        mobile: calls.filter(c => c.initiatedFrom === "mobile").length,
        web: calls.filter(c => c.initiatedFrom === "web" || !c.initiatedFrom).length,
      },
    });

    res.json({ calls });
  } catch (error) {
    console.error("Get calls error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/calls/:id
 * Get call by ID
 */
router.get("/:id", authorize("ADMIN", "BRANCH_MANAGER", "TEAM_LEADER", "TELECALLER"), async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user as any;
    const userId = user?.userId || user?.id;

    const call = await prisma.call.findUnique({
      where: { id },
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            country: true,
            visaType: true,
            status: true,
          },
        },
        createdBy: {
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

    if (!call) {
      return res.status(404).json({ error: "Call not found" });
    }

    // Telecallers can only view their own calls
    if (user?.role === "TELECALLER" && call.createdById !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({ call });
  } catch (error) {
    console.error("Get call error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/calls
 * Create new call (Telecaller, Team Leader, Admin, Branch Manager)
 */
router.post("/", authorize("ADMIN", "BRANCH_MANAGER", "TEAM_LEADER", "TELECALLER"), async (req: any, res) => {
  try {
    const validatedData = createCallSchema.parse(req.body);
    const user = req.user;
    const userId = user?.userId || user?.id;

    const call = await prisma.call.create({
      data: {
        leadId: validatedData.leadId || undefined,
        phoneNumber: validatedData.phoneNumber,
        callType: validatedData.callType || "outgoing",
        status: validatedData.status || "completed",
        duration: validatedData.duration || undefined,
        notes: validatedData.notes || undefined,
        callDate: validatedData.callDate ? new Date(validatedData.callDate) : new Date(),
        createdById: userId,
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
        createdBy: {
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

    res.status(201).json({ message: "Call logged successfully", call });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("Create call error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PUT /api/calls/:id
 * Update call (Telecaller can only update their own calls)
 */
router.put("/:id", authorize("ADMIN", "BRANCH_MANAGER", "TEAM_LEADER", "TELECALLER"), async (req: any, res) => {
  try {
    const { id } = req.params;
    const validatedData = updateCallSchema.parse(req.body);
    const user = req.user;
    const userId = user?.userId || user?.id;

    // Check if call exists
    const existingCall = await prisma.call.findUnique({
      where: { id },
    });

    if (!existingCall) {
      return res.status(404).json({ error: "Call not found" });
    }

    // Telecallers can only update their own calls
    if (user?.role === "TELECALLER" && existingCall.createdById !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const call = await prisma.call.update({
      where: { id },
      data: {
        status: validatedData.status,
        duration: validatedData.duration,
        notes: validatedData.notes,
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
        createdBy: {
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

    res.json({ message: "Call updated successfully", call });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("Update call error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /api/calls/:id
 * Delete call (Admin, Branch Manager, Team Leader only)
 */
router.delete("/:id", authorize("ADMIN", "BRANCH_MANAGER", "TEAM_LEADER"), async (req, res) => {
  try {
    const { id } = req.params;

    const call = await prisma.call.findUnique({
      where: { id },
    });

    if (!call) {
      return res.status(404).json({ error: "Call not found" });
    }

    await prisma.call.delete({
      where: { id },
    });

    res.json({ message: "Call deleted successfully" });
  } catch (error) {
    console.error("Delete call error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/calls/initiate
 * Initiate call from web app to mobile
 */
router.post("/initiate", authorize("ADMIN", "BRANCH_MANAGER", "TEAM_LEADER", "TELECALLER"), async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = initiateCallSchema.parse(req.body);
    const userId = req.user!.userId;

    // Check if user has mobile device online
    const device = await prisma.mobileDevice.findUnique({
      where: { userId },
    });

    if (!device || !device.isOnline) {
      return res.status(400).json({ 
        error: "Mobile device is not online",
        isOnline: false,
      });
    }

    // Check last seen (should be within 60 seconds)
    const lastSeenSeconds = device.lastSeen 
      ? Math.floor((Date.now() - device.lastSeen.getTime()) / 1000)
      : Infinity;
    
    if (lastSeenSeconds >= 60) {
      return res.status(400).json({ 
        error: "Mobile device is offline",
        isOnline: false,
      });
    }

    // Create call request
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + 30); // 30 seconds expiry

    const callRequest = await prisma.callRequest.create({
      data: {
        userId,
        phoneNumber: validatedData.phoneNumber,
        leadId: validatedData.leadId || undefined,
        deviceId: device.deviceId,
        expiresAt,
        status: "pending",
      },
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    });

    // Phase 2: Auto-create task from callback request
    try {
      if (callRequest.status === "pending") {
        await createTaskFromCallback(callRequest);
      }
    } catch (taskError) {
      // Don't fail the call request if task creation fails
      console.error("[TASK AUTO-CREATE] Error creating task from callback:", taskError);
    }

    // Broadcast call request via WebSocket to mobile app
    try {
      const { getIO } = await import("../lib/socket");
      const io = getIO();
      
      const deviceRoom = `device:${device.deviceId}`;
      const payload = {
        requestId: callRequest.id,
        phoneNumber: validatedData.phoneNumber,
        leadId: validatedData.leadId,
        lead: callRequest.lead,
      };
      
      // Check if any sockets are in the room
      const socketsInRoom = await io.in(deviceRoom).fetchSockets();
      const socketCount = socketsInRoom.length;

      if (socketCount === 0) {
        console.warn(`⚠️ No sockets in room ${deviceRoom} - broadcast will not be delivered`);
      } else {
        console.log(`✅ Broadcasting to room ${deviceRoom} with ${socketCount} socket(s)`);
      }
      
      // Emit to device room for mobile app to receive
      io.to(deviceRoom).emit("call:initiate", payload);
      
      // Update call request status to sent
      await prisma.callRequest.update({
        where: { id: callRequest.id },
        data: { status: "sent", sentAt: new Date() },
      });
    } catch (wsError) {
      console.error("❌ [BACKEND] WebSocket broadcast error:", wsError);
      // Don't fail the request if WebSocket fails - call request is still created
    }

    res.json({
      message: "Call request sent to mobile device",
      requestId: callRequest.id,
      callRequest,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("Initiate call error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/calls/mobile/log
 * Log call from mobile app
 */
router.post("/mobile/log", authorize("ADMIN", "BRANCH_MANAGER", "TEAM_LEADER", "TELECALLER"), async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = mobileCallLogSchema.parse(req.body);
    const userId = req.user!.userId;
    
    // Fix: Validate callId is provided and non-empty
    if (!validatedData.callId || validatedData.callId.trim() === '') {
      console.warn(`[CALL LOG] Rejected log without callId from user ${userId}`, {
        phoneNumber: validatedData.phoneNumber,
        callType: validatedData.callType,
        state: validatedData.state,
        timestamp: new Date().toISOString(),
      });
      return res.status(400).json({ error: 'callId is required' });
    }
    
    // Check if callId exists in database
    let existingCallById = await prisma.call.findUnique({
      where: { id: validatedData.callId },
    });
    
    // FIX: If callId doesn't exist, CREATE the Call record (don't reject)
    if (!existingCallById) {
      console.log(`[CALL LOG] Creating new Call record with callId: ${validatedData.callId}`, {
        callId: validatedData.callId,
        phoneNumber: validatedData.phoneNumber,
        userId,
        timestamp: new Date().toISOString(),
      });
      // Will create below with the full callData
    } else {
      console.log(`[CALL LOG] Updating existing Call record with callId: ${validatedData.callId}`, {
        callId: validatedData.callId,
        phoneNumber: validatedData.phoneNumber,
        userId,
        timestamp: new Date().toISOString(),
      });
    }

    // Verify device
    const device = await prisma.mobileDevice.findUnique({
      where: { userId },
    });

    if (!device || device.deviceId !== validatedData.deviceId) {
      return res.status(403).json({ error: "Device not registered or mismatch" });
    }

    // Search for lead by phone number
    let lead = await prisma.lead.findUnique({
      where: { phone: validatedData.phoneNumber },
    });

    let autoCreatedLead = false;
    
    // If incoming call and lead not found, auto-create
    if (validatedData.callType === "incoming" && !lead) {
      // Get next leadId
      const maxLead = await prisma.lead.findFirst({
        where: { leadId: { not: null } },
        orderBy: { leadId: 'desc' },
        select: { leadId: true },
      });
      const nextLeadId = maxLead && maxLead.leadId ? maxLead.leadId + 1 : 1;

      lead = await prisma.lead.create({
        data: {
          leadId: nextLeadId,
          firstName: "Unknown",
          lastName: "Caller",
          phone: validatedData.phoneNumber,
          email: "",
          status: "new",
          source: "incoming_call",
          createdById: userId,
        },
      });
      autoCreatedLead = true;
    }

    // Determine call status based on wasConnected flag and duration
    // This is more accurate than relying on state alone
    let callStatus = "completed";
    
    if (validatedData.state === "ringing") {
      // Still ringing - not yet determined
      callStatus = validatedData.callType === "incoming" ? "missed" : "no_answer";
    } else if (validatedData.state === "ended" || validatedData.state === "idle") {
      // Call has ended - check if it was connected
      if (validatedData.wasConnected && validatedData.duration && validatedData.duration > 0) {
        callStatus = "completed";
      } else {
        // Call ended without being connected
        callStatus = validatedData.callType === "incoming" ? "missed" : "no_answer";
      }
    } else if (validatedData.state === "offhook" || validatedData.state === "connected") {
      // Call is connected
      if (validatedData.wasConnected && validatedData.duration && validatedData.duration > 0) {
        callStatus = "completed";
      } else {
        // Still connecting
        callStatus = "completed";
      }
    } else if (validatedData.state === "missed") {
      callStatus = validatedData.callType === "incoming" ? "missed" : "no_answer";
    } else if (validatedData.state === "rejected") {
      // V2 Standard: rejected → missed (for incoming) or no_answer (for outgoing)
      callStatus = validatedData.callType === "incoming" ? "missed" : "no_answer";
    } else if (validatedData.state === "busy" || validatedData.state === "engaged") {
      // V2 Standard: All connection failures → busy
      callStatus = "busy";
    }
    
    // If call is currently active (ringing or offhook), mark as live
    const isLive = validatedData.state === "ringing" || validatedData.state === "offhook";

    // Create or update call record
    const callData: any = {
      phoneNumber: validatedData.phoneNumber,
      callType: validatedData.callType,
      status: callStatus,
      duration: validatedData.duration,
      deviceId: validatedData.deviceId,
      initiatedFrom: "mobile",
      autoCreatedLead,
      recordingPath: validatedData.recordingPath,
      createdById: userId,
    };

    if (lead) {
      callData.leadId = lead.id;
    }

    // Fix 2: Ensure UTC storage - Parse ISO 8601 timestamps (stored as UTC in PostgreSQL)
    if (validatedData.startTime) {
      // Validate and parse ISO 8601 timestamp (UTC)
      const startTime = new Date(validatedData.startTime);
      if (isNaN(startTime.getTime())) {
        return res.status(400).json({ error: 'Invalid startTime format. Must be ISO 8601 (UTC)' });
      }
      callData.startTime = startTime; // Stored as UTC in PostgreSQL
    }

    // Note: connectTime is tracked but not stored in DB schema yet
    // We use wasConnected flag and duration for status determination

    // Fix 2: Ensure UTC storage - Parse ISO 8601 timestamps (stored as UTC in PostgreSQL)
    if (validatedData.endTime) {
      // Validate and parse ISO 8601 timestamp (UTC)
      const endTime = new Date(validatedData.endTime);
      if (isNaN(endTime.getTime())) {
        return res.status(400).json({ error: 'Invalid endTime format. Must be ISO 8601 (UTC)' });
      }
      callData.endTime = endTime; // Stored as UTC in PostgreSQL
    }

    if (validatedData.state === "ringing") {
      callData.callDate = validatedData.startTime ? new Date(validatedData.startTime) : new Date();
    } else {
      callData.callDate = validatedData.startTime ? new Date(validatedData.startTime) : new Date();
    }

    // FIX: Create if doesn't exist, update if exists
    let call;
    if (existingCallById) {
      // Update existing call
      call = await prisma.call.update({
        where: { id: validatedData.callId },
          data: callData,
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
            createdBy: {
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
      console.log(`✅ [CALL LOG] Updated existing call: ${call.id}`);
    } else {
      // Create new call with callId as ID
      call = await prisma.call.create({
        data: {
          id: validatedData.callId, // Use callId as database ID
          ...callData,
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
        createdBy: {
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
      console.log(`✅ [CALL LOG] Created new call: ${call.id}`);
    }

    // Phase 2: Auto-create task from missed call or incoming call
    try {
      if (callStatus === "missed" || callStatus === "no_answer") {
        await createTaskFromMissedCall(call);
      }

      // If incoming call completed, optionally create task (if enabled)
      if (
        validatedData.callType === "incoming" &&
        callStatus === "completed" &&
        validatedData.duration &&
        validatedData.duration > 0
      ) {
        await createTaskFromIncomingCall(call);
      }
    } catch (taskError) {
      // Don't fail the call logging if task creation fails
      console.error("[TASK AUTO-CREATE] Error creating task from call:", taskError);
    }

    // Phase 2: Auto-complete task from completed call
    try {
      if (callStatus === "completed" && validatedData.duration && validatedData.duration > 0) {
        await autoCompleteTaskFromCall(call);
      }
    } catch (taskError) {
      // Don't fail the call logging if task completion fails
      console.error("[TASK AUTO-COMPLETE] Error auto-completing task from call:", taskError);
    }

    // Broadcast via WebSocket to web app for real-time notifications
    try {
      const { getIO } = await import("../lib/socket");
      const io = getIO();
      
      // Emit to user's room for real-time call notification
      // Fix 2: Ensure timestamps are returned in UTC ISO 8601 format
      io.to(`user:${userId}`).emit("call:new", {
        callId: call.id,
        phoneNumber: call.phoneNumber,
        callType: call.callType,
        status: call.status,
        duration: call.duration,
        callDate: call.callDate ? call.callDate.toISOString() : null,
        startTime: call.startTime ? call.startTime.toISOString() : null,
        endTime: call.endTime ? call.endTime.toISOString() : null,
        lead: call.lead,
        createdBy: call.createdBy,
        isLive: isLive,
        state: validatedData.state,
      });
      
      console.log(`📞 WebSocket: Broadcasted call notification to user ${userId}`);
    } catch (wsError) {
      console.error("WebSocket broadcast error:", wsError);
      // Don't fail the request if WebSocket fails
    }

    // Fix 2: Ensure API response returns timestamps in UTC ISO 8601 format
    const responseCall = {
      ...call,
      // Explicitly format timestamps as UTC ISO 8601 strings
      startTime: call.startTime ? call.startTime.toISOString() : null,
      endTime: call.endTime ? call.endTime.toISOString() : null,
      callDate: call.callDate ? call.callDate.toISOString() : null,
      createdAt: call.createdAt ? call.createdAt.toISOString() : null,
      updatedAt: call.updatedAt ? call.updatedAt.toISOString() : null,
    };

    res.json({
      message: "Call logged successfully",
      call: responseCall,
      leadCreated: autoCreatedLead,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("Mobile call log error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/calls/lead/:leadId
 * Get all calls for a specific lead
 */
router.get("/lead/:leadId", authorize("ADMIN", "BRANCH_MANAGER", "TEAM_LEADER", "TELECALLER"), async (req: any, res) => {
  try {
    const { leadId } = req.params;
    const user = req.user;
    const userId = user?.userId || user?.id;

    const calls = await prisma.call.findMany({
      where: {
        leadId,
        // Telecallers can only see their own calls
        ...(user?.role === "TELECALLER" ? { createdById: userId } : {}),
      },
      include: {
        createdBy: {
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
        callDate: "desc",
      },
    });

    res.json({ calls });
  } catch (error) {
    console.error("Get lead calls error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================
// Tag Application Endpoints (Phase 1.2)
// ============================================

// Apply tag to call
router.post("/:id/tags", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { tagFlowId, parentId, note, callbackAt, followUpAt } = req.body;

    // Validate required fields
    if (!tagFlowId) {
      return res.status(400).json({ error: "tagFlowId is required" });
    }

    // Get tag flow
    const tagFlow = await prisma.tagFlow.findUnique({
      where: { id: tagFlowId },
    });

    if (!tagFlow) {
      return res.status(404).json({ error: "Tag not found" });
    }

    if (!tagFlow.isActive) {
      return res.status(400).json({ error: "Tag is not active" });
    }

    // Check appliesTo scope
    if (tagFlow.appliesTo !== "all" && tagFlow.appliesTo !== "call") {
      return res.status(400).json({
        error: `Tag does not apply to call. This tag applies to: ${tagFlow.appliesTo}`,
      });
    }

    // Verify call exists
    const call = await prisma.call.findUnique({ where: { id } });
    if (!call) {
      return res.status(404).json({ error: "Call not found" });
    }

    // Validate required fields
    if (tagFlow.requiresNote && (!note || note.trim() === "")) {
      return res.status(400).json({ error: "Note is required for this tag" });
    }

    if (tagFlow.requiresCallback && !callbackAt) {
      return res.status(400).json({ error: "Callback date/time is required for this tag" });
    }

    if (tagFlow.requiresFollowUp && !followUpAt) {
      return res.status(400).json({ error: "Follow-up date/time is required for this tag" });
    }

    // Check exclusive (remove other tags if exclusive)
    if (tagFlow.isExclusive) {
      await prisma.tagApplication.updateMany({
        where: {
          entityType: "call",
          entityId: id,
          isActive: true,
        },
        data: { isActive: false },
      });
    }

    // Create TagApplication
    const tagApplication = await prisma.tagApplication.create({
      data: {
        entityType: "call",
        entityId: id,
        tagFlowId,
        parentId: parentId || null,
        appliedById: userId,
        note: note || null,
        callbackAt: callbackAt ? new Date(callbackAt) : null,
        followUpAt: followUpAt ? new Date(followUpAt) : null,
        isActive: true,
      },
      include: {
        tagFlow: {
          select: {
            id: true,
            name: true,
            tagValue: true,
            color: true,
            icon: true,
            category: true,
          },
        },
        appliedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Increment usage count
    await prisma.tagFlow.update({
      where: { id: tagFlowId },
      data: { usageCount: { increment: 1 } },
    });

    // Create TagActionInstance if tag has actions (Phase 3.3)
    if (tagFlow.actions) {
      await createTagActionInstance(
        tagApplication.id,
        tagFlowId,
        "call",
        id,
        tagFlow.actions
      );
    }

    res.status(201).json({ tagApplication });
  } catch (error: any) {
    console.error("Error applying tag to call:", error);
    res.status(500).json({ error: error.message || "Failed to apply tag" });
  }
});

// Remove tag from call
router.delete("/:id/tags/:tagApplicationId", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { id, tagApplicationId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Find the tag application
    const tagApplication = await prisma.tagApplication.findFirst({
      where: {
        id: tagApplicationId,
        entityType: "call",
        entityId: id,
        isActive: true,
      },
      include: {
        tagFlow: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!tagApplication) {
      return res.status(404).json({ error: "Tag application not found" });
    }

    // Soft delete (set isActive to false)
    await prisma.tagApplication.update({
      where: { id: tagApplicationId },
      data: { isActive: false },
    });

    res.json({ message: "Tag removed successfully" });
  } catch (error: any) {
    console.error("Error removing tag from call:", error);
    res.status(500).json({ error: error.message || "Failed to remove tag" });
  }
});

// Get all tags for a call
router.get("/:id/tags", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    // Get all active tag applications for this call
    const tagApplications = await prisma.tagApplication.findMany({
      where: {
        entityType: "call",
        entityId: id,
        isActive: true,
      },
      include: {
        tagFlow: {
          select: {
            id: true,
            name: true,
            tagValue: true,
            color: true,
            icon: true,
            category: true,
            isExclusive: true,
          },
        },
        appliedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({ tagApplications });
  } catch (error: any) {
    console.error("Error fetching tags for call:", error);
    res.status(500).json({ error: error.message || "Failed to fetch tags" });
  }
});

export default router;

