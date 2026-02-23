// Load environment variables first
import "dotenv/config";

// Register TypeScript path mappings for tsx
import { register } from "tsconfig-paths";
import { resolve } from "path";
register({
  baseUrl: resolve(__dirname, "../"),
  paths: {
    "@tvf/shared-auth": ["../packages/shared-auth/src/index.ts"]
  }
});

import express from "express";
import cors from "cors";
import path from "path";
import { createServer } from "http";

let authRoutes, roleRoutes, userRoutes, leadRoutes, sheetSyncRoutes, callRoutes, reportRoutes;
let applicationRoutes, clientRoutes, clientVisitRoutes, staffRoutes, sessionRoutes, shiftRoutes;
let documentRoutes, googleDocsRoutes, tagFlowRoutes, tagApplicationRoutes, workflowRoutes, leadActivityRoutes, mobileRoutes, taskRoutes, auditRoutes;
let initializeSocket, startSheetSyncScheduler, startDxScheduler, stopDxScheduler, getIO;

try {
  authRoutes = require("./routes/auth").default;
  roleRoutes = require("./routes/roles").default;
  userRoutes = require("./routes/users").default;
  leadRoutes = require("./routes/leads").default;
  sheetSyncRoutes = require("./routes/sheetSync").default;
  callRoutes = require("./routes/calls").default;
  reportRoutes = require("./routes/reports").default;
  applicationRoutes = require("./routes/applications").default;
  clientRoutes = require("./routes/clients").default;
  clientVisitRoutes = require("./routes/clientVisits").default;
  staffRoutes = require("./routes/staff").default;
  sessionRoutes = require("./routes/sessions").default;
  shiftRoutes = require("./routes/shifts").default;
  documentRoutes = require("./routes/documents").default;
  googleDocsRoutes = require("./routes/googleDocs").default;
  tagFlowRoutes = require("./routes/tagFlows").default;
  tagApplicationRoutes = require("./routes/tagApplications").default;
  workflowRoutes = require("./routes/workflows").default;
  leadActivityRoutes = require("./routes/leadActivities").default;
  mobileRoutes = require("./routes/mobile").default;
  taskRoutes = require("./routes/tasks").default;
  auditRoutes = require("./routes/audit").default;
} catch (error: any) {
  console.error("Failed to import routes:", error);
  process.exit(1);
}

try {
  const socketModule = require("./lib/socket");
  initializeSocket = socketModule.initializeSocket;
  getIO = socketModule.getIO;
  const schedulerModule = require("./services/sheetSyncScheduler");
  startSheetSyncScheduler = schedulerModule.startSheetSyncScheduler;
  const dxSchedulerModule = require("./services/dxScheduler");
  startDxScheduler = dxSchedulerModule.startDxScheduler;
  stopDxScheduler = dxSchedulerModule.stopDxScheduler;
} catch (error: any) {
  console.error("Failed to import socket/scheduler:", error);
  process.exit(1);
}

const app = express();
const PORT = Number(process.env.PORT) || 5000;

try {
  // CORS configuration - allow frontend (port 3000) to access backend (port 5000)
  // With credentials: true, origin cannot be '*' — use explicit origins
  const allowedOrigins = process.env.NODE_ENV === 'production'
    ? [process.env.FRONTEND_URL || "http://localhost:3000"]
    : [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://10.0.2.2:3000", // Android emulator
      ];
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, origin);
      return cb(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }));
  app.use(express.json());
  // Serve uploaded files
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // Health check with DB readiness
  app.get("/health", async (req, res) => {
    try {
      const { prisma } = require("./lib/prisma");

      // Perform lightweight DB check
      await prisma.$queryRaw`SELECT 1 as health_check`;

      // DB is ready
      res.json({
        status: "ok",
        message: "Server is running",
        database: "ready"
      });
    } catch (error: any) {
      // DB is not ready, but server is running
      // Return 200 OK to satisfy Docker healthcheck, but indicate degraded state in response
      res.json({
        status: "degraded",
        message: "Server is running but database is unavailable",
        database: "unavailable"
      });
    }
  });

  // API Routes
  app.use("/api/auth", authRoutes);
  app.use("/api/roles", roleRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/leads", leadRoutes);
  app.use("/api/sheet-sync", sheetSyncRoutes);
  app.use("/api/calls", callRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/applications", applicationRoutes);
  app.use("/api/clients", clientRoutes);
  app.use("/api/client-visits", clientVisitRoutes);
  app.use("/api/staff", staffRoutes);
  app.use("/api/sessions", sessionRoutes);
  app.use("/api/shifts", shiftRoutes);
  app.use("/api/documents", documentRoutes);
  app.use("/api/google-docs", googleDocsRoutes);
  app.use("/api/tag-flows", tagFlowRoutes);
  app.use("/api/workflows", workflowRoutes);
  app.use("/api/tag-applications", tagApplicationRoutes);
  app.use("/api/lead-activities", leadActivityRoutes);
  app.use("/api/mobile", mobileRoutes);
  app.use("/api/tasks", taskRoutes);
  app.use("/api/audit", auditRoutes);

  // Test database connectivity
  (async () => {
    try {
      const { prisma } = require("./lib/prisma");
      await prisma.$connect();
      console.log("✓ Database connection established");
    } catch (error: any) {
      console.error("✗ Database connection failed:", error.message);
      console.error("Please check your DATABASE_URL in .env file and ensure PostgreSQL is running");
      // Don't exit - allow server to start even if DB is down (for debugging)
    }
  })();

  // Start Google Sheets sync scheduler
  try {
    startSheetSyncScheduler();
  } catch (error: any) {
    console.error("Failed to start sheet sync scheduler:", error);
    // Don't exit - scheduler failure shouldn't prevent server from starting
  }

  // Start DX baseline scheduler
  try {
    startDxScheduler();
    console.log("[scheduler] DX baseline scheduler started");
  } catch (error: any) {
    console.error("[scheduler] Failed to start DX baseline scheduler:", error);
    // Don't exit - scheduler failure shouldn't prevent server from starting
  }

  // Start task overdue cron job
  try {
    require("./cron/taskOverdueCron");
    console.log("[cron] Task overdue cron job initialized");
  } catch (error: any) {
    console.error("[cron] Failed to initialize task overdue cron job:", error);
    // Don't exit - cron failure shouldn't prevent server from starting
  }

  // Start tag action runner cron job
  try {
    require("./cron/tagActionCron");
    console.log("[cron] Tag action runner cron job initialized");
  } catch (error: any) {
    console.error("[cron] Failed to initialize tag action runner cron job:", error);
    // Don't exit - cron failure shouldn't prevent server from starting
  }

  // Start workflow retry cron job
  try {
    require("./cron/workflowRetryJob");
    console.log("[cron] Workflow retry cron job initialized");
  } catch (error: any) {
    console.error("[cron] Failed to initialize workflow retry cron job:", error);
    // Don't exit - cron failure shouldn't prevent server from starting
  }

  // Start fix missing callbacks cron job (PERMANENT SOLUTION)
  try {
    const { startFixMissingCallbacksCron } = require("./cron/fixMissingCallbacksCron");
    startFixMissingCallbacksCron();
  } catch (error: any) {
    console.error("[cron] Failed to initialize fix missing callbacks cron job:", error);
    // Don't exit - cron failure shouldn't prevent server from starting
  }

  // Start auto-escalation cron (no_answer + RED + overdue >= 24h)
  try {
    require("./cron/autoEscalationCron");
    console.log("[cron] Auto-escalation cron job initialized");
  } catch (error: any) {
    console.error("[cron] Failed to initialize auto-escalation cron job:", error);
  }

  // Start senior overdue notification cron (lead:overdue_telecaller_missed to TL/BM)
  try {
    require("./cron/seniorOverdueCron");
    console.log("[cron] Senior overdue notification cron job initialized");
  } catch (error: any) {
    console.error("[cron] Failed to initialize senior overdue cron job:", error);
  }

  // Create HTTP server and initialize WebSocket and initialize WebSocket
  try {
    const httpServer = createServer(app);

    // Initialize WebSocket
    let socketInitialized = false;
    try {
      const socketIO = initializeSocket(httpServer);
      if (socketIO) {
        socketInitialized = true;
        console.log("✓ WebSocket server initialized successfully");
      } else {
        console.error("✗ WebSocket server initialization returned null/undefined");
      }
    } catch (error: any) {
      console.error("✗ Failed to initialize WebSocket:", error);
      console.error("  Error details:", error.message, error.stack);
      // Don't exit - socket failure shouldn't prevent server from starting
      // but log a clear warning
      console.warn("⚠️  Server will start without WebSocket support. Socket.IO connections will fail.");
    }

    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`✓ Server is running on port ${PORT}`);
      console.log(`✓ Server is accessible from network at http://192.168.29.158:${PORT}`);
      if (socketInitialized) {
        console.log(`✓ WebSocket server is ready at ws://localhost:${PORT}/socket.io/`);
      } else {
        console.warn(`⚠️  WebSocket server is NOT available - Socket.IO connections will fail`);
      }
    });

    httpServer.on('error', (error: any) => {
      console.error("HTTP server error:", error);
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please stop the process using this port or change PORT in .env`);
      }
    });

  } catch (error: any) {
    console.error("Failed to create HTTP server:", error);
    process.exit(1);
  }

} catch (error: any) {
  console.error("Unhandled startup error:", error);
  process.exit(1);
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error("Uncaught exception:", error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error("Unhandled rejection:", reason);
});

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  // Stop DX scheduler
  try {
    if (stopDxScheduler) {
      stopDxScheduler();
    }
  } catch (error: any) {
    console.error("[scheduler] Error stopping DX scheduler:", error.message);
  }

  // Close WebSocket server
  try {
    if (getIO) {
      const io = getIO();
      io.close(() => {
        console.log("[ws] WebSocket server closed");
      });
    }
  } catch (error: any) {
    console.error("[ws] Error closing WebSocket server:", error.message);
  }

  // Close Prisma connection
  try {
    const { prisma } = require("./lib/prisma");
    await prisma.$disconnect();
    console.log("✓ Prisma connection closed");
  } catch (error: any) {
    console.error("Error closing Prisma connection:", error.message);
  }

  process.exit(0);
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

