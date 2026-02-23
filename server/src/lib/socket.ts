import { Server as HTTPServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { verifyToken } from "./auth";
import { prisma } from "./prisma";
import { autoCompleteTaskFromCallback } from "../services/taskAutoCompleteService";

let io: SocketIOServer | null = null;

export function initializeSocket(server: HTTPServer) {
  io = new SocketIOServer(server, {
    cors: {
      // Match Express CORS configuration - allow all origins in development
      origin: process.env.NODE_ENV === 'production' 
        ? (process.env.FRONTEND_URL || "http://localhost:3000")
        : '*', // Allow all origins in development (for emulator access and different ports)
      methods: ["GET", "POST"],
      credentials: true,
    },
    // Increase timeout settings to prevent disconnections
    pingTimeout: 60000, // 60 seconds - how long to wait for pong response
    pingInterval: 25000, // 25 seconds - how often to send ping packets
    // Allow longer connection timeouts for mobile devices
    transports: ['websocket', 'polling'],
    // Increase maxHttpBufferSize for better stability
    maxHttpBufferSize: 1e6, // 1MB
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("Authentication error"));
      }

      const decoded = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { role: true },
      });

      if (!user || !user.isActive) {
        return next(new Error("User not found or inactive"));
      }

      (socket as any).userId = user.id;
      (socket as any).userRole = user.role.name;
      next();
    } catch (error) {
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = (socket as any).userId;

    console.log(`[ws] User ${userId} connected to WebSocket`);

    // Join user's room
    socket.join(`user:${userId}`);

    // Automatically join device room if user has a device registered
    // This ensures the socket is in the correct room even if device:register event isn't emitted
    try {
      const device = await prisma.mobileDevice.findUnique({
        where: { userId },
      });

      if (device && device.deviceId) {
        socket.join(`device:${device.deviceId}`);
        console.log(`Socket automatically joined device room: device:${device.deviceId} for user ${userId}`);
      } else {
        console.log(`No device found for user ${userId} - socket not joining device room`);
      }
    } catch (error) {
      console.error(`Error joining device room for user ${userId}:`, error);
    }

    // Handle call request from web
    socket.on("call:request", async (data: { requestId: string; phoneNumber: string; leadId?: string }) => {
      // Get user's device
      const device = await prisma.mobileDevice.findUnique({
        where: { userId },
      });

      if (device && device.isOnline) {
        // Emit to mobile app (if connected)
        io?.to(`device:${device.deviceId}`).emit("call:initiate", data);
        
        // Update call request status
        await prisma.callRequest.update({
          where: { id: data.requestId },
          data: { status: "sent", sentAt: new Date() },
        });
      }
    });

    // Handle device registration
    socket.on("device:register", async (data: { deviceId: string }) => {
      // Get device from database (source of truth)
      const device = await prisma.mobileDevice.findUnique({
        where: { userId },
      });

      // Use deviceId from database (source of truth), not from client
      // This ensures the socket joins the correct room even if client sends wrong deviceId
      if (device && device.deviceId) {
        socket.join(`device:${device.deviceId}`);
        console.log(`Device ${device.deviceId} registered for user ${userId} (socket joined to room device:${device.deviceId})`);
      } else {
        console.log(`⚠️ Device registration failed for user ${userId}: no device found in database`);
      }
    });

    // Handle call status update from mobile
    socket.on("call:status", async (data: { callId: string; status: string; phoneNumber: string }) => {
      // Broadcast to web app
      io?.to(`user:${userId}`).emit("call:status", data);
    });

    // Handle call:intentOpened event from mobile
    // This is fired when Android call intent is opened (user picks up the call)
    socket.on("call:intentOpened", async (data: { 
      requestId: string; 
      phoneNumber: string; 
      leadId?: string;
      deviceId: string;
      startTime?: string;
    }) => {
      try {
        console.log(`[ws] call:intentOpened received from user ${userId}`, { requestId: data.requestId, phoneNumber: data.phoneNumber });
        
        // Find CallRequest by requestId
        const callRequest = await prisma.callRequest.findUnique({
          where: { id: data.requestId },
          include: { lead: true },
        });

        if (!callRequest) {
          console.error(`[ws] CallRequest not found: ${data.requestId}`);
          return;
        }

        // Update CallRequest status to completed
        const updatedCallRequest = await prisma.callRequest.update({
          where: { id: data.requestId },
          data: { 
            status: "completed",
            completedAt: new Date(),
          },
        });

        // Phase 2: Auto-complete task from callback
        try {
          await autoCompleteTaskFromCallback(updatedCallRequest);
        } catch (taskError) {
          // Don't fail the call request update if task completion fails
          console.error("[TASK AUTO-COMPLETE] Error auto-completing task from callback:", taskError);
        }

        // Create or update Call record with status "intentOpened"
        const startTime = data.startTime ? new Date(data.startTime) : new Date();
        
        // Check if Call already exists (linked to CallRequest)
        let call = await prisma.call.findUnique({
          where: { id: callRequest.callId || "" },
        });

        if (call) {
          // Update existing call
          call = await prisma.call.update({
            where: { id: call.id },
            data: {
              status: "intentOpened",
              startTime,
              deviceId: data.deviceId,
              initiatedFrom: "mobile",
              callDate: startTime,
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
        } else {
          // Create new Call record
          call = await prisma.call.create({
            data: {
              phoneNumber: data.phoneNumber,
              leadId: data.leadId || callRequest.leadId || undefined,
              callType: "outgoing",
              status: "intentOpened",
              startTime,
              deviceId: data.deviceId,
              initiatedFrom: "mobile",
              callDate: startTime,
              createdById: userId,
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

          // Link Call to CallRequest
          await prisma.callRequest.update({
            where: { id: data.requestId },
            data: { callId: call.id },
          });
        }

        // Broadcast to web clients
        // Fix 2: Ensure timestamps are returned in UTC ISO 8601 format
        io?.to(`user:${userId}`).emit("call:intentOpened", {
          requestId: data.requestId,
          callId: call.id,
          phoneNumber: call.phoneNumber,
          leadId: call.leadId,
          startTime: call.startTime ? call.startTime.toISOString() : null,
          status: call.status,
          lead: call.lead,
        });

        console.log(`[ws] call:intentOpened processed and broadcasted`, { requestId: data.requestId, callId: call.id });
      } catch (error: any) {
        console.error(`[ws] Error handling call:intentOpened:`, error);
      }
    });

    // Handle call:ended event from mobile
    // This is fired when Android call ends
    socket.on("call:ended", async (data: { 
      requestId: string; 
      phoneNumber: string;
      duration?: number;
      endTime?: string;
      connectTime?: string;  // V2 Standard: Accept connectTime from Flutter
      deviceId: string;
      callId?: string;  // Fix 1: Optional callId for validation
    }) => {
      try {
        console.log(`[ws] call:ended received from user ${userId}`, { 
          requestId: data.requestId, 
          phoneNumber: data.phoneNumber, 
          duration: data.duration,
          connectTime: data.connectTime,  // Log connectTime for verification
          callId: data.callId  // Log callId if provided
        });
        
        // Fix 1: Validate callId if provided
        if (data.callId && (!data.callId || data.callId.trim() === '')) {
          console.warn(`[ws] call:ended rejected - invalid callId from user ${userId}`, {
            requestId: data.requestId,
            callId: data.callId,
            timestamp: new Date().toISOString(),
          });
          socket.emit('error', { message: 'callId is required and must be non-empty' });
          return;
        }
        
        // Find CallRequest by requestId
        const callRequest = await prisma.callRequest.findUnique({
          where: { id: data.requestId },
        });

        if (!callRequest) {
          console.error(`[ws] CallRequest not found: ${data.requestId}`);
          socket.emit('error', { message: 'CallRequest not found' });
          return;
        }

        // Fix 1: Validate that CallRequest has a callId (call must exist)
        if (!callRequest.callId || callRequest.callId.trim() === '') {
          console.warn(`[ws] call:ended rejected - CallRequest has no callId from user ${userId}`, {
            requestId: data.requestId,
            callRequestId: callRequest.id,
            timestamp: new Date().toISOString(),
          });
          socket.emit('error', { message: 'Call record not found: callId is required' });
          return;
        }

        // Find Call record (should exist from call:intentOpened)
        let call = await prisma.call.findUnique({
          where: { id: callRequest.callId },
        });

        // Fix 1: Call must exist (callId is required, no fallback creation)
        if (!call) {
          console.error(`[ws] Call not found for callId: ${callRequest.callId}`, {
            requestId: data.requestId,
            callId: callRequest.callId,
            userId,
            timestamp: new Date().toISOString(),
          });
          socket.emit('error', { message: 'Call record not found: invalid callId' });
          return;
        }
        
        // Update existing Call record
        // Fix 2: Ensure UTC storage - Parse ISO 8601 timestamp (stored as UTC in PostgreSQL)
        const endTime = data.endTime ? new Date(data.endTime) : new Date();
        if (data.endTime && isNaN(endTime.getTime())) {
          console.error(`[ws] Invalid endTime format from user ${userId}`, {
            requestId: data.requestId,
            endTime: data.endTime,
            timestamp: new Date().toISOString(),
          });
          socket.emit('error', { message: 'Invalid endTime format. Must be ISO 8601 (UTC)' });
          return;
        }
        
        call = await prisma.call.update({
            where: { id: call.id },
            data: {
              status: "completed",  // V2 Standard: Use "completed" instead of "ended"
              duration: data.duration || call.duration,
              endTime,  // Stored as UTC in PostgreSQL
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

        // Broadcast to web clients (for tagging modal)
        // Fix 2: Ensure timestamps are returned in UTC ISO 8601 format
        io?.to(`user:${userId}`).emit("call:ended", {
          requestId: data.requestId,
          callId: call.id,
          phoneNumber: call.phoneNumber,
          leadId: call.leadId,
          duration: call.duration,
          startTime: call.startTime ? call.startTime.toISOString() : null,
          endTime: call.endTime ? call.endTime.toISOString() : null,
          status: call.status,
          lead: call.lead,
          createdBy: call.createdBy,
        });

        console.log(`[ws] call:ended processed and broadcasted`, { requestId: data.requestId, callId: call.id, duration: call.duration });
      } catch (error: any) {
        console.error(`[ws] Error handling call:ended:`, error);
      }
    });

    socket.on("disconnect", () => {
      console.log(`[ws] User ${userId} disconnected from WebSocket`);
    });
  });

  // DX Events Channel - Broadcast heartbeat and system events
  // This channel is for TVF DX operations/CRM events only
  console.log("[ws] DX events channel initialized");

  return io;
}

/**
 * Broadcast DX event to all connected clients
 * Event types: "heartbeat", "system", "task:dueSoon", "task:overdue"
 */
export function broadcastDxEvent(
  eventType: "heartbeat" | "system" | "task:dueSoon" | "task:overdue",
  payload: { [key: string]: any }
): void {
  if (!io) {
    console.warn("[ws] Cannot broadcast DX event: Socket.IO not initialized");
    return;
  }

  const event = {
    type: eventType,
    timestamp: new Date().toISOString(),
    payload: {
      ...payload,
      // Ensure no PII beyond userId if absolutely required
      // Remove sensitive fields before broadcasting
    },
  };

  io.emit("dx:event", event);
  console.log(`[ws] Broadcasted DX event: ${eventType}`);
}

/**
 * Broadcast DX event to a specific user's room
 * Event types: "task:dueSoon", "task:overdue"
 */
export function broadcastDxEventToUser(
  userId: string,
  eventType: "task:dueSoon" | "task:overdue",
  payload: { [key: string]: any }
): void {
  if (!io) {
    console.warn("[ws] Cannot broadcast DX event: Socket.IO not initialized");
    return;
  }

  const event = {
    type: eventType,
    timestamp: new Date().toISOString(),
    payload: {
      ...payload,
      // Ensure no PII beyond userId if absolutely required
      // Remove sensitive fields before broadcasting
    },
  };

  io.to(`user:${userId}`).emit("dx:event", event);
  console.log(`[ws] Broadcasted DX event: ${eventType} to user:${userId}`);
}

/**
 * Broadcast audit event to all connected clients
 * Emits audit:event:created event with full audit event data
 * @param auditEvent - Audit event object from database (with user relation)
 */
export function broadcastAuditEvent(auditEvent: any): void {
  if (!io) {
    console.warn("[ws] Cannot broadcast audit event: Socket.IO not initialized");
    return;
  }

  // Parse JSON fields from database strings
  const oldValue = auditEvent.oldValue ? JSON.parse(auditEvent.oldValue) : null;
  const newValue = auditEvent.newValue ? JSON.parse(auditEvent.newValue) : null;
  const changes = auditEvent.changes ? JSON.parse(auditEvent.changes) : null;
  const metadata = auditEvent.metadata ? JSON.parse(auditEvent.metadata) : null;

  // Build event payload according to requirements
  const event = {
    type: "audit:event:created",
    timestamp: new Date().toISOString(),
    data: {
      id: auditEvent.id,
      entityType: auditEvent.entityType,
      entityId: auditEvent.entityId,
      action: auditEvent.action,
      userId: auditEvent.userId,
      oldValue,
      newValue,
      changes,
      description: auditEvent.description,
      metadata,
      createdAt: auditEvent.createdAt.toISOString(),
      user: auditEvent.user
        ? {
            id: auditEvent.user.id,
            firstName: auditEvent.user.firstName,
            lastName: auditEvent.user.lastName,
            employeeCode: auditEvent.user.employeeCode,
          }
        : null,
    },
  };

  // Broadcast to all connected clients
  io.emit("audit:event:created", event);
  console.log(`[ws] Broadcasted audit event: ${auditEvent.id} (${auditEvent.entityType}:${auditEvent.action})`);
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error("Socket.IO not initialized");
  }
  return io;
}

