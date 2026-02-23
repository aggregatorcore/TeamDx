import express, { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, authorize, AuthenticatedRequest } from "../middleware/roleAuth";

const router = Router();

// PUBLIC test endpoint (must be before authenticate middleware)
router.get("/test", async (req, res) => {
  res.json({ 
    message: "Mobile routes working",
    timestamp: new Date().toISOString(),
    hasAutoRegistration: true,
    codeVersion: "2024-01-30-auto-registration"
  });
});

// All other routes require authentication
router.use(authenticate);

const registerDeviceSchema = z.object({
  deviceId: z.string().min(1, "Device ID is required"),
  deviceName: z.string().optional(),
  fcmToken: z.string().optional(),
  phoneNumber: z.string().optional(),
});

const heartbeatSchema = z.object({
  deviceId: z.string().min(1, "Device ID is required"),
});

/**
 * POST /api/mobile/register
 * Register mobile device for user
 */
router.post("/register", async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = registerDeviceSchema.parse(req.body);
    const userId = req.user!.userId;

    // Check if device already exists for this user
    const existingDevice = await prisma.mobileDevice.findUnique({
      where: { userId },
    });

    let device;
    if (existingDevice) {
      // Update existing device
      console.log('🔄 [DEBUG] Updating existing device', { userId, deviceId: validatedData.deviceId.substring(0, 8) });
      device = await prisma.mobileDevice.update({
        where: { userId },
        data: {
          deviceId: validatedData.deviceId,
          deviceName: validatedData.deviceName,
          fcmToken: validatedData.fcmToken,
          phoneNumber: validatedData.phoneNumber,
          isOnline: true,
          lastSeen: new Date(),
          isActive: true,
        },
      });
    } else {
      // Create new device
      console.log('➕ [DEBUG] Creating new device', { userId, deviceId: validatedData.deviceId.substring(0, 8) });
      device = await prisma.mobileDevice.create({
        data: {
          userId,
          deviceId: validatedData.deviceId,
          deviceName: validatedData.deviceName,
          fcmToken: validatedData.fcmToken,
          phoneNumber: validatedData.phoneNumber,
          isOnline: true,
          lastSeen: new Date(),
        },
      });
    }

    res.json({ message: "Device registered successfully", device });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("Register device error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/mobile/heartbeat
 * Update device online status
 */
router.post("/heartbeat", async (req: AuthenticatedRequest, res) => {
  // VERSION MARKER: Auto-registration v2 - 2024-01-30
  try {
    const validatedData = heartbeatSchema.parse(req.body);
    const userId = req.user!.userId;

    let device = await prisma.mobileDevice.findUnique({
      where: { userId },
    });
    
    if (!device) {
      // Auto-register device if not found
      try {
        const newDevice = await prisma.mobileDevice.create({
          data: {
            userId,
            deviceId: validatedData.deviceId,
            deviceName: `Auto-registered-${Date.now()}`,
            isOnline: true,
            isActive: true,
            lastSeen: new Date(),
          },
        });
        // Update device reference for rest of function
        const updatedDevice = await prisma.mobileDevice.findUnique({
          where: { userId },
        });
        if (updatedDevice) {
          device = updatedDevice;
        } else {
          console.log('❌ [DEBUG] Failed to retrieve auto-registered device', { userId });
          return res.status(500).json({ error: "Device registration failed" });
        }
      } catch (regError: any) {
        return res.status(500).json({ error: "Device registration failed", details: regError.message });
      }
    }

    if (device.deviceId !== validatedData.deviceId) {
      return res.status(403).json({ error: "Device ID mismatch" });
    }

    await prisma.mobileDevice.update({
      where: { userId },
      data: {
        isOnline: true,
        isActive: true, // Ensure isActive is set
        lastSeen: new Date(),
      },
    });

    res.json({ message: "Heartbeat received", isOnline: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("Heartbeat error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/mobile/status
 * Get mobile device status for current user
 */
router.get("/status", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;

    const device = await prisma.mobileDevice.findUnique({
      where: { userId },
      select: {
        id: true,
        deviceId: true,
        deviceName: true,
        isOnline: true,
        lastSeen: true,
        isActive: true,
      },
    });

    if (!device) {
      return res.json({ 
        isRegistered: false,
        isOnline: false,
      });
    }

    // Check if device is still online (within last 60 seconds - stricter for call reliability)
    const lastSeenSeconds = device.lastSeen 
      ? Math.floor((Date.now() - device.lastSeen.getTime()) / 1000)
      : Infinity;
    
    // Check WebSocket connection status - device must have active WebSocket connection
    const { getIO } = await import("../lib/socket");
    const io = getIO();
    const deviceRoom = `device:${device.deviceId}`;
    const socketsInRoom = io.sockets.adapter.rooms.get(deviceRoom)?.size || 0;
    const hasWebSocketConnection = socketsInRoom > 0;
    
    // Device is online if:
    // 1. isOnline flag is true AND
    // 2. lastSeen is within 60 seconds (heartbeat is sent every 25 seconds) AND
    // 3. WebSocket connection is active (socketsInRoom > 0)
    const isOnline = device.isOnline && lastSeenSeconds < 60 && hasWebSocketConnection;

    console.log(`📱 [MOBILE STATUS] User ${userId}: device=${device.deviceId?.substring(0, 8) || 'unknown'}, isOnline=${device.isOnline}, lastSeen=${lastSeenSeconds}s ago, isActive=${device.isActive}, socketsInRoom=${socketsInRoom}, hasWS=${hasWebSocketConnection}, calculated=${isOnline}`);

    res.json({
      isRegistered: true,
      isOnline,
      device: {
        id: device.id,
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        isOnline: device.isOnline,
        lastSeen: device.lastSeen,
        isActive: device.isActive,
        lastSeenSeconds, // Include for debugging
        hasWebSocketConnection, // Include WebSocket status
        socketsInRoom, // Include socket count for debugging
      },
    });
  } catch (error) {
    console.error("Get mobile status error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

