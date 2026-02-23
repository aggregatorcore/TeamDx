import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, authorize } from "../middleware/roleAuth";
import { broadcastDxEvent } from "../lib/socket";
import multer from "multer";
import path from "path";
import fs from "fs";
import { createTaskFromLeadStatusChange } from "../services/taskAutoCreationService";
import { ensureNoAnswerCallbackScheduled } from "../services/noAnswerCallbackService";
import { calculateBucket, BucketType } from "../utils/bucketCalculator";

const router = Router();

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

// Configure multer for profile photo uploads
const profilePhotoDir = path.join(process.cwd(), "uploads", "lead-photos");
if (!fs.existsSync(profilePhotoDir)) {
  try {
    fs.mkdirSync(profilePhotoDir, { recursive: true });
  } catch (error: any) {
    // Directory creation may fail due to permissions - will be created on first upload
    console.warn(`Warning: Could not create uploads directory: ${error.message}`);
  }
}

const profilePhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, profilePhotoDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `lead-${uniqueSuffix}${ext}`);
  },
});

const uploadProfilePhoto = multer({
  storage: profilePhotoStorage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit for passport size photos
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, and WebP images are allowed."));
    }
  },
});

// Helper function to generate next serial leadId
async function getNextLeadId(): Promise<number> {
  try {
    // Find the maximum leadId (excluding null values)
    const maxLead = await prisma.lead.findFirst({
      where: {
        leadId: { not: null },
      },
      orderBy: { leadId: 'desc' },
      select: { leadId: true },
    });

    // Return next ID (start from 1 if no leads with leadId exist)
    return maxLead && maxLead.leadId ? maxLead.leadId + 1 : 1;
  } catch (error) {
    console.error("Error getting next leadId:", error);
    // Fallback: try to count existing leads and add 1
    try {
      const count = await prisma.lead.count();
      return count + 1;
    } catch {
      return 1;
    }
  }
}

// Validation schemas
const createLeadSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone number is required"),
  country: z.string().optional(),
  visaType: z.string().optional(),
  source: z.string().optional(),
  status: z.enum(["new", "contacted", "qualified", "converted", "lost"]).default("new"),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  score: z.union([z.number(), z.string()]).transform((val) => typeof val === "string" ? parseInt(val) || 0 : val).optional(),
  notes: z.string().optional(),
  assignedToId: z.string().optional(),
  // Immigration-specific fields
  budgetMin: z.union([z.number(), z.string()]).transform((val) => typeof val === "string" ? parseInt(val) || undefined : val).optional(),
  budgetMax: z.union([z.number(), z.string()]).transform((val) => typeof val === "string" ? parseInt(val) || undefined : val).optional(),
  qualification: z.string().optional(),
  address: z.string().optional(),
  passportNumber: z.string().optional(),
  passportIssueDate: z.string().optional(),
  passportExpiryDate: z.string().optional(),
  passportType: z.string().optional(),
  occupation: z.string().optional(),
  employerName: z.string().optional(),
  salary: z.union([z.number(), z.string()]).transform((val) => typeof val === "string" ? parseInt(val) || undefined : val).optional(),
  designation: z.string().optional(),
  experience: z.union([z.number(), z.string()]).transform((val) => typeof val === "string" ? parseInt(val) || undefined : val).optional(),
  businessName: z.string().optional(),
  businessType: z.string().optional(),
  businessAddress: z.string().optional(),
  travelHistory: z.string().optional(),
  refusalCount: z.union([z.number(), z.string()]).transform((val) => typeof val === "string" ? parseInt(val) || 0 : val).optional(),
  refusalCountry: z.string().optional(),
  refusalReasons: z.string().optional(),
  profilePhoto: z.string().optional(),
});

const updateLeadSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email("Invalid email address").optional(),
  phone: z.string().optional(),
  country: z.string().optional(),
  visaType: z.string().optional(),
  source: z.string().optional(),
  status: z.enum(["new", "contacted", "qualified", "converted", "lost"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  score: z.union([z.number(), z.string()]).transform((val) => typeof val === "string" ? parseInt(val) || 0 : val).optional(),
  notes: z.string().optional(),
  assignedToId: z.string().optional(),
  // Call status fields
  callStatus: z.string().optional(),
  callbackScheduledAt: z.string().optional(),
  discussionType: z.string().optional(),
  discussionNotes: z.string().optional(),
  documentsReceived: z.array(z.string()).optional(),
  // Immigration-specific fields
  budgetMin: z.union([z.number(), z.string()]).transform((val) => typeof val === "string" ? parseInt(val) || undefined : val).optional(),
  budgetMax: z.union([z.number(), z.string()]).transform((val) => typeof val === "string" ? parseInt(val) || undefined : val).optional(),
  qualification: z.string().optional(),
  address: z.string().optional(),
  passportNumber: z.string().optional(),
  passportIssueDate: z.string().optional(),
  passportExpiryDate: z.string().optional(),
  passportType: z.string().optional(),
  occupation: z.string().optional(),
  employerName: z.string().optional(),
  salary: z.union([z.number(), z.string()]).transform((val) => typeof val === "string" ? parseInt(val) || undefined : val).optional(),
  designation: z.string().optional(),
  experience: z.union([z.number(), z.string()]).transform((val) => typeof val === "string" ? parseInt(val) || undefined : val).optional(),
  businessName: z.string().optional(),
  businessType: z.string().optional(),
  businessAddress: z.string().optional(),
  travelHistory: z.string().optional(),
  refusalCount: z.union([z.number(), z.string()]).transform((val) => typeof val === "string" ? parseInt(val) || 0 : val).optional(),
  refusalCountry: z.string().optional(),
  refusalReasons: z.string().optional(),
  profilePhoto: z.string().optional(),
  // Collaboration fields
  previousAssignedToId: z.string().optional(),
  movedAt: z.string().optional(),
  movedFromRole: z.string().optional(),
  collaborationActive: z.boolean().optional(),
  moveToRole: z.string().optional(), // For role-based assignment (e.g., "COUNSELOR")
});

/**
 * GET /api/leads
 * Get all leads (Admin, Branch Manager, Team Leader, Counselor, Telecaller)
 * Supports filters: status, assignedToUserId, search (name/phone/email)
 * Queries leverage Prisma indices (status, assignedToId, createdAt)
 */
router.get("/", authenticate, authorize("ADMIN", "BRANCH_MANAGER", "TEAM_LEADER", "COUNSELOR", "TELECALLER"), async (req, res) => {
  try {
    const user = (req as any).user;

    // Validate user object
    if (!user) {
      console.error("❌ No user object in request");
      return res.status(401).json({ error: "Authentication required" });
    }

    const userRole = user?.role;
    const userId = user?.userId || user?.id;

    if (!userId) {
      console.error("❌ No userId found in user object:", user);
      return res.status(401).json({ error: "Invalid user data" });
    }

    // Extract query parameters for filtering (leverages indices)
    const { status, assignedToUserId, search } = req.query;

    console.log("📋 Get leads request:", { userRole, userId, userEmail: user?.email, filters: { status, assignedToUserId, search } });

    // Build where clause based on user role and query filters
    let whereClause: any = {};

    // Apply query filters (these leverage Prisma indices)
    if (status && typeof status === "string") {
      whereClause.status = status; // Uses @@index([status])
    }

    if (assignedToUserId && typeof assignedToUserId === "string") {
      whereClause.assignedToId = assignedToUserId; // Uses @@index([assignedToId])
    }

    // Filter out future callback leads - only show callbacks scheduled for today or earlier
    // This prevents tomorrow's callbacks from appearing today
    // Only apply this filter to leads that have callbackScheduledAt set
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today (include all of today)

    // Add callback date filter: either no callback date, or callback date is today or earlier
    whereClause.OR = [
      // Leads without callbackScheduledAt (not callbacks - show all)
      { callbackScheduledAt: null },
      // Callbacks scheduled for today or earlier (show these)
      { callbackScheduledAt: { lte: today } },
    ];

    // Search filter (name, phone, email) - applied after role-based filtering
    if (search && typeof search === "string" && search.trim()) {
      const searchTerm = search.trim();
      const searchConditions = [
        { firstName: { contains: searchTerm, mode: "insensitive" } },
        { lastName: { contains: searchTerm, mode: "insensitive" } },
        { phone: { contains: searchTerm } },
        { email: { contains: searchTerm, mode: "insensitive" } },
      ];

      // Combine callback filter with search filter using AND
      whereClause.AND = [
        {
          OR: whereClause.OR, // Callback date filter
        },
        {
          OR: searchConditions, // Search filter
        },
      ];
      delete whereClause.OR; // Remove OR from root level since it's now in AND
    }

    // Role-based access control (applied after query filters) (BE_BUCKET_04)
    // Telecaller only sees leads assigned to them (allowed/assigned leads only)
    if (userRole === "TELECALLER") {
      // TELECALLER can only see leads assigned to them
      // This prevents all-users leads from leaking to telecallers
      whereClause.assignedToId = userId; // Uses @@index([assignedToId])

      // Also ensure they can't see leads assigned to others even if assignedToUserId filter is provided
      if (assignedToUserId && typeof assignedToUserId === "string" && assignedToUserId !== userId) {
        return res.status(403).json({
          error: "Access denied",
          message: "Telecallers can only view leads assigned to them"
        });
      }
    }
    // Team Leader sees leads assigned to them or their team members (telecallers)
    else if (userRole === "TEAM_LEADER") {
      try {
        // Get all telecallers under this team leader
        const teamLeader = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            teamMembers: {
              include: {
                role: true,
              },
            },
          },
        });

        if (!teamLeader) {
          console.warn("⚠️ Team leader not found, showing only own leads");
          whereClause.assignedToId = userId; // Uses @@index([assignedToId])
        } else {
          // Filter team members to only TELECALLERs who are active
          const teamMemberIds = (teamLeader.teamMembers || [])
            .filter((member) => member.role?.name === "TELECALLER" && member.isActive)
            .map((m) => m.id);

          teamMemberIds.push(userId); // Include team leader's own assigned leads

          console.log("👥 Team Leader team member IDs:", teamMemberIds);

          if (teamMemberIds.length > 0) {
            // If assignedToUserId filter is provided, ensure it's in team member list
            if (assignedToUserId && typeof assignedToUserId === "string") {
              if (!teamMemberIds.includes(assignedToUserId)) {
                return res.status(403).json({ error: "Access denied", message: "You can only view leads assigned to your team members" });
              }
            } else {
              whereClause.assignedToId = {
                in: teamMemberIds, // Uses @@index([assignedToId])
              };
            }
          } else {
            // No team members, show only own leads
            whereClause.assignedToId = userId; // Uses @@index([assignedToId])
          }
        }
      } catch (teamQueryError: any) {
        console.error("❌ Error fetching team members:", teamQueryError);
        console.error("Error details:", teamQueryError?.message, teamQueryError?.stack);
        // Fallback: only show leads assigned to the team leader
        whereClause.assignedToId = userId; // Uses @@index([assignedToId])
      }
    }
    // Counselor sees leads assigned to them
    else if (userRole === "COUNSELOR") {
      // If assignedToUserId filter is provided, ensure it matches current user
      if (assignedToUserId && typeof assignedToUserId === "string" && assignedToUserId !== userId) {
        return res.status(403).json({ error: "Access denied", message: "You can only view leads assigned to you" });
      }
      whereClause.assignedToId = userId; // Uses @@index([assignedToId])
    }
    // Admin and Branch Manager see all leads (no additional filter - query filters already applied)

    console.log("🔍 Where clause:", JSON.stringify(whereClause, null, 2));

    // Test database connection first
    try {
      await prisma.$connect();
      console.log("✅ Database connection OK");
    } catch (dbError: any) {
      console.error("❌ Database connection error:", dbError);
      return res.status(500).json({
        error: "Database connection failed",
        message: dbError?.message || "Unable to connect to database"
      });
    }

    // Execute query with error handling
    let leads;
    try {
      // Build include object - only include relations that exist
      const includeObj: any = {};

      // Only include assignedTo if it's a relation in schema
      includeObj.assignedTo = {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      };

      includeObj.assignedBy = {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      };

      includeObj.createdBy = {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      };

      // Include previousAssignedTo for collaboration tracking
      includeObj.previousAssignedTo = {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      };

      // Include LeadCurrentTagState for efficient callbackAt lookup (BE_BUCKET_05)
      includeObj.currentTagState = {
        include: {
          childTag: {
            include: {
              tagFlow: {
                select: {
                  id: true,
                  name: true,
                  requiresCallback: true,
                },
              },
            },
          },
        },
      };

      // Include active TagApplication with callbackAt (for bucket calculation)
      // Get the most recent active tag application (ALL active tags, not just ones with callbackAt)
      // This ensures UI can see all active tags including "No Answer" tags that might have NULL callbackAt
      includeObj.tagApplications = {
        where: {
          isActive: true,
          entityType: "lead",
          // REMOVED: callbackAt: { not: null } - This was filtering out tags with NULL callbackAt!
          // We need ALL active tags so UI can show warning for NULL callbackAt
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1, // Only get the most recent one
        select: {
          id: true,
          tagFlowId: true,
          callbackAt: true, // EXPLICITLY include callbackAt (even if NULL)
          followUpAt: true,
          createdAt: true,
          isActive: true,
          tagFlow: {
            select: {
              id: true,
              name: true,
              tagValue: true, // UI needs this to identify "no_answer" tag
              color: true,
              icon: true,
              category: true,
            },
          },
        },
      };

      console.log("🔍 Executing Prisma query...");

      leads = await prisma.lead.findMany({
        where: whereClause,
        include: includeObj,
        orderBy: {
          createdAt: "desc", // Uses @@index([createdAt])
        },
      });

      console.log("✅ Prisma query successful");
    } catch (queryError: any) {
      console.error("❌ Prisma query error:", queryError);
      console.error("Query error name:", queryError?.name);
      console.error("Query error message:", queryError?.message);
      console.error("Query error code:", queryError?.code);
      console.error("Query error meta:", JSON.stringify(queryError?.meta, null, 2));
      console.error("Full error:", queryError);

      // Try a simpler query without includes to see if that works
      console.log("🔄 Trying simpler query without relations...");
      try {
        leads = await prisma.lead.findMany({
          where: whereClause,
          orderBy: {
            createdAt: "desc", // Uses @@index([createdAt])
          },
        });
        console.log("✅ Simple query worked, found", leads.length, "leads");
      } catch (simpleQueryError: any) {
        console.error("❌ Even simple query failed:", simpleQueryError);
        throw queryError; // Throw original error
      }
    }

    console.log(`✅ Found ${leads.length} leads`);

    // Exhausted: prefer Lead.isExhausted (state); fallback to LeadActivity EXHAUSTED for backward compat
    const leadIds = leads.map((l: any) => l.id);
    const exhaustedActivities = leadIds.length > 0
      ? await prisma.leadActivity.findMany({
          where: { leadId: { in: leadIds }, activityType: "EXHAUSTED" },
          orderBy: { createdAt: "desc" },
          select: { leadId: true, createdAt: true },
        })
      : [];
    const exhaustedMap = new Map<string, Date>();
    for (const a of exhaustedActivities) {
      if (!exhaustedMap.has(a.leadId)) exhaustedMap.set(a.leadId, a.createdAt);
    }

    // Format leads and calculate bucket (BE_BUCKET_01, BE_BUCKET_02, BE_BUCKET_03)
    // Use async loop so we can auto-fix "No Answer" with null callbackAt (fix-on-read)
    const formattedLeads: any[] = [];
    for (const lead of leads) {
      const formattedLead = { ...lead };
      const fromDb = (lead as any).isExhausted === true && (lead as any).exhaustedAt;
      const fromActivity = exhaustedMap.get(lead.id);
      formattedLead.isExhausted = !!fromDb || !!fromActivity;
      formattedLead.exhaustedAt = fromDb
        ? ((lead as any).exhaustedAt instanceof Date ? (lead as any).exhaustedAt.toISOString() : (lead as any).exhaustedAt)
        : (fromActivity ? fromActivity.toISOString() : null);
      formattedLead.exhaustReason = (lead as any).exhaustReason ?? null;

      // Parse documentsReceived from JSON string to array if it exists
      if (formattedLead.documentsReceived && typeof formattedLead.documentsReceived === 'string') {
        try {
          formattedLead.documentsReceived = JSON.parse(formattedLead.documentsReceived);
        } catch (e) {
          formattedLead.documentsReceived = [];
        }
      } else if (!formattedLead.documentsReceived) {
        formattedLead.documentsReceived = [];
      }

      let callbackAt: string | Date | null = null;
      let callbackAtISO: string | null = null;

      if (formattedLead.tagApplications && formattedLead.tagApplications.length > 0) {
        const activeTagApp = formattedLead.tagApplications[0];
        const tagValue = activeTagApp.tagFlow?.tagValue;
        const hasNoAnswerWithoutCallback = tagValue === "no_answer" && !activeTagApp.callbackAt;

        // Auto-fix: if "No Answer" tag has no callback, schedule it now (so user never sees warning)
        if (hasNoAnswerWithoutCallback) {
          const fixedISO = await ensureNoAnswerCallbackScheduled(lead.id);
          if (fixedISO) {
            callbackAtISO = fixedISO;
            callbackAt = new Date(fixedISO);
            formattedLead.tagApplications[0] = { ...activeTagApp, callbackAt: fixedISO };
          }
        }
        // Auto-fix 1/3 with wrong callback (e.g. 58h): if no_answer has callback >2h from createdAt, recalc to 60m+shift
        if (tagValue === "no_answer" && activeTagApp.callbackAt && activeTagApp.createdAt && !callbackAtISO) {
          const createdMs = new Date(activeTagApp.createdAt).getTime();
          const cbMs = new Date(activeTagApp.callbackAt).getTime();
          if (cbMs - createdMs > 2 * 60 * 60 * 1000) {
            const fixedISO = await ensureNoAnswerCallbackScheduled(lead.id);
            if (fixedISO) {
              callbackAtISO = fixedISO;
              callbackAt = new Date(fixedISO);
              formattedLead.tagApplications[0] = { ...activeTagApp, callbackAt: fixedISO };
            }
          }
        }
        if (!callbackAtISO && activeTagApp.callbackAt) {
          callbackAt = activeTagApp.callbackAt;
          callbackAtISO = activeTagApp.callbackAt instanceof Date
            ? activeTagApp.callbackAt.toISOString()
            : new Date(activeTagApp.callbackAt).toISOString();
        }
      }

      if (!callbackAt && formattedLead.callbackScheduledAt) {
        callbackAt = formattedLead.callbackScheduledAt;
        callbackAtISO = formattedLead.callbackScheduledAt instanceof Date
          ? formattedLead.callbackScheduledAt.toISOString()
          : new Date(formattedLead.callbackScheduledAt).toISOString();
      }

      // Calculate bucket using FINAL bucket rules (BE_BUCKET_02, BE_BUCKET_03, ANKIT_API_02)
      // Priority order: callbackAt > status > fresh > green
      // Uses server UTC time for consistent calculation (ANKIT_API_02)
      const bucket = calculateBucket({
        status: formattedLead.status,
        callStatus: formattedLead.callStatus,
        callbackAt: callbackAt,
        currentTagState: formattedLead.currentTagState,
      });

      // Add bucket field to response (BE_BUCKET_01, ANKIT_API_02)
      // Bucket is computed, not stored in DB (ANKIT_API_02)
      formattedLead.bucket = bucket;

      // ANKIT_API_01: Ensure callbackAt & callStatus are consistently returned
      // Always return callbackAt in UTC ISO format
      formattedLead.callbackAt = callbackAtISO;

      // Ensure callStatus is consistently returned (even if null)
      // callStatus is already in formattedLead from the query, but ensure it's always present
      if (formattedLead.callStatus === undefined) {
        formattedLead.callStatus = null;
      }

      // currentTag: ONLY from active TagApplication — no currentTagState. Shuffled leads have no active tag, so they show as new.
      const activeTagApp = formattedLead.tagApplications && formattedLead.tagApplications.length > 0 ? formattedLead.tagApplications[0] : null;
      if (activeTagApp?.tagFlow) {
        formattedLead.currentTag = {
          id: activeTagApp.tagFlow.id,
          tagFlowId: activeTagApp.tagFlowId,
          tagFlow: {
            id: activeTagApp.tagFlow.id,
            name: activeTagApp.tagFlow.name ?? "",
            color: activeTagApp.tagFlow.color ?? null,
            icon: activeTagApp.tagFlow.icon ?? null,
          },
          callbackAt: callbackAtISO,
        };
      } else {
        formattedLead.currentTag = {
          id: null,
          tagFlowId: null,
          tagFlow: null,
          callbackAt: callbackAtISO,
        };
      }

      formattedLeads.push(formattedLead);
    }

    // Exhausted leads: do not show to telecallers (lead moves to exhaust bucket, TL/Manager only)
    let leadsToReturn = formattedLeads;
    if (userRole === "TELECALLER") {
      leadsToReturn = formattedLeads.filter((l: any) => !l.isExhausted);
    }

    res.json({ leads: leadsToReturn });
  } catch (error: any) {
    console.error("❌ Get leads error:", error);
    console.error("Error name:", error?.name);
    console.error("Error message:", error?.message);
    console.error("Error code:", error?.code);
    console.error("Error stack:", error?.stack);

    // Send detailed error in development
    const errorResponse: any = {
      error: "Internal server error",
      message: error?.message || "Unknown error",
    };

    if (process.env.NODE_ENV === "development") {
      errorResponse.details = {
        name: error?.name,
        code: error?.code,
        stack: error?.stack,
      };
    }

    res.status(500).json(errorResponse);
  }
});

/**
 * POST /api/leads/import/google-sheets
 * Import leads from Google Sheets (Admin only)
 * Uses Google Sheets CSV export (works for publicly accessible sheets)
 */
router.post("/import/google-sheets", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { sheetUrl } = req.body;

    if (!sheetUrl || typeof sheetUrl !== "string") {
      return res.status(400).json({ error: "Google Sheet URL is required" });
    }

    // Extract sheet ID from URL
    const sheetIdMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!sheetIdMatch) {
      return res.status(400).json({ error: "Invalid Google Sheet URL format. Expected: https://docs.google.com/spreadsheets/d/SHEET_ID/edit" });
    }

    const sheetId = sheetIdMatch[1];
    const user = (req as any).user;
    const userId = user?.userId || user?.id;

    // Convert to CSV export URL
    // Format: https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv&gid=0
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;

    // Fetch CSV data from Google Sheets
    let csvText: string;
    try {
      const response = await fetch(csvUrl);
      if (!response.ok) {
        if (response.status === 403) {
          return res.status(400).json({
            error: "Google Sheet is not publicly accessible. Please make the sheet public or use 'Anyone with the link can view' permission.",
            hint: "To make it public: Share > Change to 'Anyone with the link' > Viewer",
          });
        }
        throw new Error(`Failed to fetch Google Sheet: ${response.status} ${response.statusText}`);
      }
      csvText = await response.text();
    } catch (fetchError: any) {
      console.error("Error fetching Google Sheet:", fetchError);
      return res.status(400).json({
        error: "Failed to fetch Google Sheet data",
        details: fetchError.message || "Please ensure the sheet is publicly accessible",
      });
    }

    if (!csvText || csvText.trim().length === 0) {
      return res.status(400).json({ error: "Google Sheet appears to be empty" });
    }

    // Parse CSV text (same logic as bulk upload)
    const lines = csvText.trim().split("\n");
    if (lines.length < 2) {
      return res.status(400).json({ error: "Google Sheet must have at least a header row and one data row" });
    }

    // Parse header - more flexible matching
    const rawHeaders = lines[0].split(",").map((h) => h.trim());
    const headers = rawHeaders.map((h) => h.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, ""));

    console.log("📊 Google Sheet Import Debug:");
    console.log("Raw Headers:", rawHeaders);
    console.log("Normalized Headers:", headers);

    const headerMap: { [key: string]: number } = {};

    // Create flexible mapping for common variations
    const fieldVariations: { [key: string]: string[] } = {
      firstname: ["firstname", "first", "fname"],
      lastname: ["lastname", "last", "lname", "surname"],
      email: ["email", "emailaddress", "emailid"],
      phone: ["phone", "phonenumber", "mobile", "contact", "number"],
      country: ["country", "targetcountry", "destination", "place"],
      visatype: ["visatype", "visa", "visacategory"],
      source: ["source", "leadsource", "origin"],
      status: ["status", "leadstatus", "state"],
      notes: ["notes", "note", "comments", "remarks", "description"],
      assignedto: ["assignedto", "assigned", "assignee", "counselor"],
      process: ["process", "processing"],
      passportstatus: ["passportstatus", "passport"],
    };

    // Map headers to field names - check both normalized and raw headers
    headers.forEach((h, i) => {
      const rawHeader = rawHeaders[i].toLowerCase().trim();
      const rawNoSpace = rawHeader.replace(/\s+/g, "");

      // Priority 1: Exact match with raw no-space header
      let matched = false;
      for (const [fieldName, variations] of Object.entries(fieldVariations)) {
        if (variations.includes(rawNoSpace)) {
          if (!headerMap[fieldName]) { // Only map if not already mapped
            headerMap[fieldName] = i;
            console.log(`✅ Exact match: "${rawHeaders[i]}" (index ${i}) → "${fieldName}"`);
            matched = true;
            break;
          }
        }
      }

      // Priority 2: Partial match (only if exact didn't match)
      if (!matched) {
        for (const [fieldName, variations] of Object.entries(fieldVariations)) {
          const partialMatch = variations.some((v) => {
            return h.includes(v) || v.includes(h) || rawNoSpace.includes(v);
          });

          if (partialMatch && !headerMap[fieldName]) {
            headerMap[fieldName] = i;
            console.log(`✅ Partial match: "${rawHeaders[i]}" (index ${i}) → "${fieldName}"`);
            matched = true;
            break;
          }
        }
      }

      // Also store direct mappings
      headerMap[h] = i;
      headerMap[rawNoSpace] = i;
    });

    console.log("📋 Final Header Map:", headerMap);

    // Only phone number is required - check if phone column exists
    const phoneColumnFound = headerMap["phone"] !== undefined || rawHeaders.some((rawH) => {
      const normalized = rawH.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
      const phoneVariations = fieldVariations["phone"] || [];
      return phoneVariations.some((v) => normalized.includes(v) || v.includes(normalized));
    });

    if (!phoneColumnFound) {
      return res.status(400).json({
        error: `Missing required column: Phone Number`,
        expectedColumns: ["Phone Number (required)", "Name (optional)", "Place (optional)", "Visa Type (optional)", "Source (optional)", "Email (optional)", "Process (optional)", "Passport Status (optional)"],
        foundColumns: rawHeaders,
        hint: "Phone number is mandatory. Other fields are optional. Column names are case-insensitive.",
      });
    }

    // Parse data rows
    const errors: string[] = [];
    let imported = 0;
    let updated = 0;
    const changes: any[] = [];

    console.log("📊 Starting to parse data rows...");
    console.log("Header Map:", headerMap);

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Handle CSV with quoted values
      const values: string[] = [];
      let currentValue = "";
      let inQuotes = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          values.push(currentValue.trim());
          currentValue = "";
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim()); // Add last value

      console.log(`\n📋 Row ${i + 1} - Raw values:`, values);

      try {
        // Helper function to get value from header map
        const getValue = (fieldName: string): string => {
          if (headerMap[fieldName] !== undefined) {
            const val = values[headerMap[fieldName]] || "";
            console.log(`  getValue("${fieldName}") from index ${headerMap[fieldName]} = "${val}"`);
            return val;
          }
          // Try to find by variations
          for (const [key, variations] of Object.entries(fieldVariations)) {
            if (key === fieldName) {
              for (const variation of variations) {
                const normalized = variation.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
                if (headerMap[normalized] !== undefined) {
                  const val = values[headerMap[normalized]] || "";
                  console.log(`  getValue("${fieldName}") via variation "${variation}" from index ${headerMap[normalized]} = "${val}"`);
                  return val;
                }
              }
            }
          }
          console.log(`  getValue("${fieldName}") = NOT FOUND`);
          return "";
        };

        // Get phone number - MANDATORY
        const phone = getValue("phone").trim();

        // If no phone number, skip this row entirely
        if (!phone) {
          errors.push(`Row ${i + 1}: Phone number is required - skipping row`);
          continue;
        }

        // Get all other fields (optional)
        let firstName = getValue("firstname").trim();
        let lastName = getValue("lastname").trim();

        console.log(`🔍 Row ${i + 1} - Name fields:`, { firstName, lastName });

        // If firstName is empty but we have "name" column, try to split it
        if (!firstName) {
          const fullName = getValue("name").trim();
          console.log(`🔍 Row ${i + 1} - Trying "name" column: "${fullName}"`);

          if (fullName) {
            const nameParts = fullName.split(/\s+/);
            firstName = nameParts[0] || "Unknown";
            lastName = nameParts.slice(1).join(" ") || "";
            console.log(`✅ Row ${i + 1}: Split name "${fullName}" → First: "${firstName}", Last: "${lastName}"`);
          } else {
            console.log(`⚠️ Row ${i + 1}: No name found, using "Unknown"`);
            firstName = "Unknown";
          }
        } else {
          console.log(`✅ Row ${i + 1}: Using firstName from column: "${firstName}"`);
        }

        const email = getValue("email").trim();
        const country = getValue("country").trim() || getValue("place").trim() || undefined;
        const visaType = getValue("visatype").trim() || undefined;
        const source = getValue("source").trim() || undefined;
        const process = getValue("process").trim() || undefined;
        const passportStatus = getValue("passportstatus").trim() || undefined;

        // Build notes from process and passport status if available
        let notes = getValue("notes").trim();
        const additionalNotes: string[] = [];
        if (process) additionalNotes.push(`Process: ${process}`);
        if (passportStatus) additionalNotes.push(`Passport Status: ${passportStatus}`);
        if (additionalNotes.length > 0) {
          notes = notes ? `${notes}\n${additionalNotes.join(", ")}` : additionalNotes.join(", ");
        }

        const leadData: any = {
          firstName: firstName || "Unknown",
          lastName: lastName || "",
          phone: phone,
          country: country,
          visaType: visaType,
          source: source,
          status: (getValue("status").trim() || "new") as "new" | "contacted" | "qualified" | "converted" | "lost",
          notes: notes || undefined,
          assignedToId: getValue("assignedto").trim() || undefined,
        };

        // Only add email if it exists and is valid (email is now optional in schema)
        if (email) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (emailRegex.test(email)) {
            leadData.email = email;
          } else {
            errors.push(`Row ${i + 1}: Invalid email address - ${email} (skipping email)`);
          }
        }

        // Check if lead already exists by phone number (phone is unique - one phone = one lead)
        try {
          const existingLead = await prisma.lead.findUnique({
            where: { phone: leadData.phone },
          });

          if (existingLead) {
            // Detect changes
            const detectedChanges: string[] = [];

            if (existingLead.firstName !== leadData.firstName) {
              detectedChanges.push(`Name: "${existingLead.firstName}" → "${leadData.firstName}"`);
            }
            if (existingLead.lastName !== (leadData.lastName || "")) {
              detectedChanges.push(`Last Name: "${existingLead.lastName}" → "${leadData.lastName || ""}"`);
            }
            if (existingLead.email !== (leadData.email || null)) {
              detectedChanges.push(`Email: "${existingLead.email || "N/A"}" → "${leadData.email || "N/A"}"`);
            }
            if (existingLead.country !== (leadData.country || null)) {
              detectedChanges.push(`Country: "${existingLead.country || "N/A"}" → "${leadData.country || "N/A"}"`);
            }
            if (existingLead.visaType !== (leadData.visaType || null)) {
              detectedChanges.push(`Visa Type: "${existingLead.visaType || "N/A"}" → "${leadData.visaType || "N/A"}"`);
            }
            if (existingLead.status !== leadData.status) {
              detectedChanges.push(`Status: "${existingLead.status}" → "${leadData.status}"`);
            }

            if (detectedChanges.length > 0) {
              changes.push({
                phone: leadData.phone,
                leadId: existingLead.leadId,
                name: `${leadData.firstName} ${leadData.lastName}`,
                changes: detectedChanges,
                oldData: {
                  firstName: existingLead.firstName,
                  lastName: existingLead.lastName,
                  email: existingLead.email,
                  country: existingLead.country,
                  visaType: existingLead.visaType,
                  status: existingLead.status,
                },
                newData: leadData,
              });
              console.log(`🔄 Changes detected for ${leadData.phone}:`, detectedChanges);
            }

            // Update existing lead with new data (phone number is unique identifier)
            // CRITICAL: leadId is PERMANENT - only assign if it doesn't exist
            const updateData: any = {
              firstName: leadData.firstName,
              lastName: leadData.lastName,
              email: leadData.email,
              country: leadData.country,
              visaType: leadData.visaType,
              source: leadData.source,
              status: leadData.status,
              notes: leadData.notes,
              assignedToId: leadData.assignedToId,
            };

            // CRITICAL: leadId is PERMANENT - only assign if it doesn't exist
            if (!existingLead.leadId) {
              updateData.leadId = await getNextLeadId();
            }

            const updatedLead = await prisma.lead.update({
              where: { phone: leadData.phone },
              data: updateData,
            });
            updated++;
            console.log(`✅ UPDATED lead #${updatedLead.leadId}: "${updatedLead.firstName} ${updatedLead.lastName}" (Phone: ${updatedLead.phone})`);
            console.log(`   Old: "${existingLead.firstName} ${existingLead.lastName}" → New: "${updatedLead.firstName} ${updatedLead.lastName}"`);
            continue;
          }
        } catch (duplicateCheckError: any) {
          console.error(`Error checking duplicate for row ${i + 1}:`, duplicateCheckError);
          errors.push(`Row ${i + 1}: Error checking duplicates - ${duplicateCheckError.message}`);
          continue;
        }

        // Create new lead (phone number doesn't exist)
        try {
          // Generate next serial leadId
          const nextLeadId = await getNextLeadId();

          await prisma.lead.create({
            data: {
              ...leadData,
              leadId: nextLeadId,
              createdById: userId,
            },
          });
          imported++;
          console.log(`✓ Imported new lead: ${leadData.firstName} ${leadData.lastName} (Lead ID: ${nextLeadId}, Phone: ${leadData.phone}${leadData.email ? `, Email: ${leadData.email}` : ""})`);
        } catch (createError: any) {
          // Handle unique constraint violation
          if (createError.code === 'P2002' || createError.message?.includes('Unique constraint')) {
            errors.push(`Row ${i + 1}: Phone number ${leadData.phone} already exists (unique constraint)`);
          } else {
            console.error(`✗ Failed to create lead for row ${i + 1}:`, createError);
            errors.push(`Row ${i + 1}: ${createError.message || "Failed to create lead"}`);
          }
        }
      } catch (error: any) {
        console.error(`✗ Error processing row ${i + 1}:`, error);
        errors.push(`Row ${i + 1}: ${error.message || "Failed to process row"}`);
      }
    }

    console.log(`\n📊 Google Sheets Import Summary:`);
    console.log(`   Total rows: ${lines.length - 1}`);
    console.log(`   New leads: ${imported}`);
    console.log(`   Updated leads: ${updated}`);
    console.log(`   Changes detected: ${changes.length}`);
    console.log(`   Errors: ${errors.length}\n`);

    res.json({
      message: `Successfully processed ${imported + updated} lead(s) from Google Sheets`,
      imported: imported,
      updated: updated,
      changes: changes,
      errors: errors.length > 0 ? errors : undefined,
      total: lines.length - 1,
    });
  } catch (error) {
    console.error("Google Sheets import error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/leads/import/file
 * Import leads from CSV/Excel file (Admin only)
 */
router.post("/import/file", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    // TODO: Implement multer for file upload
    // For now, return a placeholder response
    res.status(501).json({
      error: "File upload is not yet implemented. Please use bulk upload for now.",
      message: "This feature will be available soon",
    });
  } catch (error) {
    console.error("File import error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/leads/import/bulk
 * Bulk upload leads from CSV text (Admin only)
 */
router.post("/import/bulk", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { csvText } = req.body;

    if (!csvText || typeof csvText !== "string") {
      return res.status(400).json({ error: "CSV text is required" });
    }

    const user = (req as any).user;
    const userId = user?.userId || user?.id;

    // Parse CSV text
    const lines = csvText.trim().split("\n");
    if (lines.length < 2) {
      return res.status(400).json({ error: "CSV must have at least a header row and one data row" });
    }

    // Parse header - more flexible matching (same as Google Sheets)
    const rawHeaders = lines[0].split(",").map((h) => h.trim());
    const headers = rawHeaders.map((h) => h.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, ""));
    const headerMap: { [key: string]: number } = {};

    // Create flexible mapping for common variations
    const fieldVariations: { [key: string]: string[] } = {
      firstname: ["firstname", "first", "fname", "first_name", "name"],
      lastname: ["lastname", "last", "lname", "surname", "last_name"],
      email: ["email", "e-mail", "emailaddress", "email_address", "emailid"],
      phone: ["phone", "phonenumber", "mobile", "contact", "phone_number", "tel", "number"],
      country: ["country", "targetcountry", "destination", "target_country", "place"],
      visatype: ["visatype", "visa", "visa_type", "visacategory", "visa type"],
      source: ["source", "leadsource", "lead_source", "origin"],
      status: ["status", "leadstatus", "lead_status", "state"],
      notes: ["notes", "note", "comments", "remarks", "description"],
      assignedto: ["assignedto", "assigned", "assigned_to", "assignee", "counselor"],
      process: ["process", "processing", "process_status", "process status"],
      passportstatus: ["passportstatus", "passport_status", "passport status", "passport"],
    };

    // Map headers to field names
    headers.forEach((h, i) => {
      // Try to find matching field
      for (const [fieldName, variations] of Object.entries(fieldVariations)) {
        if (variations.some((v) => h.includes(v) || v.includes(h))) {
          headerMap[fieldName] = i;
          break;
        }
      }
      // Also store direct mapping
      headerMap[h] = i;
    });

    // Only phone number is required - check if phone column exists
    const phoneColumnFound = headerMap["phone"] !== undefined || rawHeaders.some((rawH) => {
      const normalized = rawH.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
      const phoneVariations = fieldVariations["phone"] || [];
      return phoneVariations.some((v) => normalized.includes(v) || v.includes(normalized));
    });

    if (!phoneColumnFound) {
      return res.status(400).json({
        error: `Missing required column: Phone Number`,
        expectedColumns: ["Phone Number (required)", "Name (optional)", "Place (optional)", "Visa Type (optional)", "Source (optional)", "Email (optional)", "Process (optional)", "Passport Status (optional)"],
        foundColumns: rawHeaders,
        hint: "Phone number is mandatory. Other fields are optional. Column names are case-insensitive.",
      });
    }

    // Parse data rows
    const leads = [];
    const errors: string[] = [];
    let imported = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(",").map((v) => v.trim());

      try {
        // Helper function to get value from header map
        const getValue = (fieldName: string): string => {
          if (headerMap[fieldName] !== undefined) {
            return values[headerMap[fieldName]] || "";
          }
          // Try to find by variations
          for (const [key, variations] of Object.entries(fieldVariations)) {
            if (key === fieldName) {
              for (const variation of variations) {
                const normalized = variation.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
                if (headerMap[normalized] !== undefined) {
                  return values[headerMap[normalized]] || "";
                }
              }
            }
          }
          return "";
        };

        // Get phone number - MANDATORY
        const phone = getValue("phone").trim();

        // If no phone number, skip this row entirely
        if (!phone) {
          errors.push(`Row ${i + 1}: Phone number is required - skipping row`);
          continue;
        }

        // Get all other fields (optional)
        let firstName = getValue("firstname").trim();
        let lastName = getValue("lastname").trim();

        // If firstName is empty but we have "name" column, try to split it
        if (!firstName) {
          const fullName = getValue("name").trim();
          if (fullName) {
            const nameParts = fullName.split(/\s+/);
            firstName = nameParts[0] || "Unknown";
            lastName = nameParts.slice(1).join(" ") || "";
            console.log(`📝 Row ${i + 1}: Split name "${fullName}" → "${firstName}" "${lastName}"`);
          }
        }

        const email = getValue("email").trim();
        const country = getValue("country").trim() || getValue("place").trim() || undefined;
        const visaType = getValue("visatype").trim() || undefined;
        const source = getValue("source").trim() || undefined;
        const process = getValue("process").trim() || undefined;
        const passportStatus = getValue("passportstatus").trim() || undefined;

        // Build notes from process and passport status if available
        let notes = getValue("notes").trim();
        const additionalNotes: string[] = [];
        if (process) additionalNotes.push(`Process: ${process}`);
        if (passportStatus) additionalNotes.push(`Passport Status: ${passportStatus}`);
        if (additionalNotes.length > 0) {
          notes = notes ? `${notes}\n${additionalNotes.join(", ")}` : additionalNotes.join(", ");
        }

        const leadData: any = {
          firstName: firstName || "Unknown",
          lastName: lastName || "",
          phone: phone,
          country: country,
          visaType: visaType,
          source: source,
          status: (getValue("status").trim() || "new") as "new" | "contacted" | "qualified" | "converted" | "lost",
          notes: notes || undefined,
          assignedToId: getValue("assignedto").trim() || undefined,
        };

        // Only add email if it exists and is valid (email is now optional in schema)
        if (email) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (emailRegex.test(email)) {
            leadData.email = email;
          } else {
            errors.push(`Row ${i + 1}: Invalid email address - ${email} (skipping email)`);
          }
        }

        // Check if lead already exists by phone number (phone is unique - one phone = one lead)
        try {
          const existingLead = await prisma.lead.findUnique({
            where: { phone: leadData.phone },
          });

          if (existingLead) {
            // Detect changes
            const detectedChanges: string[] = [];

            if (existingLead.firstName !== leadData.firstName) {
              detectedChanges.push(`Name: "${existingLead.firstName}" → "${leadData.firstName}"`);
            }
            if (existingLead.lastName !== (leadData.lastName || "")) {
              detectedChanges.push(`Last Name: "${existingLead.lastName}" → "${leadData.lastName || ""}"`);
            }
            if (existingLead.email !== (leadData.email || null)) {
              detectedChanges.push(`Email: "${existingLead.email || "N/A"}" → "${leadData.email || "N/A"}"`);
            }
            if (existingLead.country !== (leadData.country || null)) {
              detectedChanges.push(`Country: "${existingLead.country || "N/A"}" → "${leadData.country || "N/A"}"`);
            }
            if (existingLead.visaType !== (leadData.visaType || null)) {
              detectedChanges.push(`Visa Type: "${existingLead.visaType || "N/A"}" → "${leadData.visaType || "N/A"}"`);
            }
            if (existingLead.status !== leadData.status) {
              detectedChanges.push(`Status: "${existingLead.status}" → "${leadData.status}"`);
            }

            if (detectedChanges.length > 0) {
              changes.push({
                phone: leadData.phone,
                leadId: existingLead.leadId,
                name: `${leadData.firstName} ${leadData.lastName}`,
                changes: detectedChanges,
                oldData: {
                  firstName: existingLead.firstName,
                  lastName: existingLead.lastName,
                  email: existingLead.email,
                  country: existingLead.country,
                  visaType: existingLead.visaType,
                  status: existingLead.status,
                },
                newData: leadData,
              });
              console.log(`🔄 Changes detected for ${leadData.phone}:`, detectedChanges);
            }

            // Update existing lead with new data (phone number is unique identifier)
            // CRITICAL: leadId is PERMANENT - only assign if it doesn't exist
            const updateData: any = {
              firstName: leadData.firstName,
              lastName: leadData.lastName,
              email: leadData.email,
              country: leadData.country,
              visaType: leadData.visaType,
              source: leadData.source,
              status: leadData.status,
              notes: leadData.notes,
              assignedToId: leadData.assignedToId,
            };

            // CRITICAL: leadId is PERMANENT - only assign if it doesn't exist
            if (!existingLead.leadId) {
              updateData.leadId = await getNextLeadId();
            }

            const updatedLead = await prisma.lead.update({
              where: { phone: leadData.phone },
              data: updateData,
            });
            updated++;
            console.log(`✅ UPDATED lead #${updatedLead.leadId}: "${updatedLead.firstName} ${updatedLead.lastName}" (Phone: ${updatedLead.phone})`);
            console.log(`   Old: "${existingLead.firstName} ${existingLead.lastName}" → New: "${updatedLead.firstName} ${updatedLead.lastName}"`);
            continue;
          }
        } catch (duplicateCheckError: any) {
          console.error(`Error checking duplicate for row ${i + 1}:`, duplicateCheckError);
          errors.push(`Row ${i + 1}: Error checking duplicates - ${duplicateCheckError.message}`);
          continue;
        }

        // Create new lead (phone number doesn't exist)
        try {
          // Generate next serial leadId
          const nextLeadId = await getNextLeadId();

          await prisma.lead.create({
            data: {
              ...leadData,
              leadId: nextLeadId,
              createdById: userId,
            },
          });
          imported++;
          console.log(`✓ Imported new lead: ${leadData.firstName} ${leadData.lastName} (Lead ID: ${nextLeadId}, Phone: ${leadData.phone}${leadData.email ? `, Email: ${leadData.email}` : ""})`);
        } catch (createError: any) {
          // Handle unique constraint violation
          if (createError.code === 'P2002' || createError.message?.includes('Unique constraint')) {
            errors.push(`Row ${i + 1}: Phone number ${leadData.phone} already exists (unique constraint)`);
          } else {
            console.error(`✗ Failed to create lead for row ${i + 1}:`, createError);
            errors.push(`Row ${i + 1}: ${createError.message || "Failed to create lead"}`);
          }
        }
      } catch (error: any) {
        console.error(`✗ Error processing row ${i + 1}:`, error);
        errors.push(`Row ${i + 1}: ${error.message || "Failed to process row"}`);
      }
    }

    console.log(`\n📊 Bulk Upload Summary:`);
    console.log(`   Total rows: ${lines.length - 1}`);
    console.log(`   Imported: ${imported}`);
    console.log(`   Errors: ${errors.length}\n`);

    res.json({
      message: `Successfully imported ${imported} lead(s)`,
      imported,
      errors: errors.length > 0 ? errors : undefined,
      total: lines.length - 1,
    });
  } catch (error) {
    console.error("Bulk import error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/leads/duplicates
 * Find all duplicate leads (Admin only)
 * Duplicates are identified by email or phone
 * NOTE: This must be defined BEFORE /:id route to avoid route conflict
 */
router.get("/duplicates", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    // Get all leads
    const allLeads = await prisma.lead.findMany({
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        createdBy: {
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

    // Helper function to normalize phone number (remove spaces, dashes, parentheses, etc.)
    const normalizePhone = (phone: string): string => {
      if (!phone) return "";
      // Remove all non-digit characters except +
      return phone.replace(/[\s\-\(\)\.]/g, "").trim();
    };

    // Group by email (case-insensitive)
    const emailGroups: { [key: string]: typeof allLeads } = {};
    const phoneGroups: { [key: string]: typeof allLeads } = {};

    console.log(`\n🔍 Checking ${allLeads.length} leads for duplicates...`);

    allLeads.forEach((lead) => {
      // Normalize email (only if email exists - email is now optional)
      if (lead.email) {
        const emailKey = lead.email.toLowerCase().trim();
        if (emailKey) { // Only group if email is not empty
          if (!emailGroups[emailKey]) {
            emailGroups[emailKey] = [];
          }
          emailGroups[emailKey].push(lead);
        }
      }

      // Normalize phone
      const phoneKey = normalizePhone(lead.phone);
      if (phoneKey) { // Only group if phone exists
        if (!phoneGroups[phoneKey]) {
          phoneGroups[phoneKey] = [];
        }
        phoneGroups[phoneKey].push(lead);
      }
    });

    // Log grouping results
    const emailDuplicates = Object.entries(emailGroups).filter(([_, leads]) => leads.length > 1);
    const phoneDuplicates = Object.entries(phoneGroups).filter(([_, leads]) => leads.length > 1);
    console.log(`📊 Email duplicates: ${emailDuplicates.length} groups`);
    console.log(`📊 Phone duplicates: ${phoneDuplicates.length} groups`);

    // Find duplicates (groups with more than 1 lead)
    const duplicateGroups: Array<{
      key: string;
      type: "email" | "phone";
      leads: typeof allLeads;
      count: number;
    }> = [];

    // Email duplicates
    Object.entries(emailGroups).forEach(([email, leads]) => {
      if (leads.length > 1) {
        duplicateGroups.push({
          key: email,
          type: "email",
          leads,
          count: leads.length,
        });
      }
    });

    // Phone duplicates (only if not already in email duplicates)
    Object.entries(phoneGroups).forEach(([phone, leads]) => {
      if (leads.length > 1) {
        // Check if this group is already covered by email duplicates
        const firstLeadEmail = leads[0].email;
        const emailKey = firstLeadEmail ? firstLeadEmail.toLowerCase().trim() : "";
        const alreadyInEmailGroup = emailKey && emailGroups[emailKey] && emailGroups[emailKey].length > 1;

        if (!alreadyInEmailGroup) {
          duplicateGroups.push({
            key: phone,
            type: "phone",
            leads,
            count: leads.length,
          });
        }
      }
    });

    // Calculate total duplicate leads (excluding the first one in each group)
    const totalDuplicateLeads = duplicateGroups.reduce((sum, group) => {
      return sum + (group.count - 1); // -1 because we keep the first one
    }, 0);

    // Get all duplicate lead IDs (excluding the first one in each group)
    const duplicateLeadIds: string[] = [];
    duplicateGroups.forEach((group) => {
      // Sort by createdAt to keep the oldest one
      const sorted = [...group.leads].sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      // Add all except the first (oldest) one
      sorted.slice(1).forEach((lead) => {
        if (!duplicateLeadIds.includes(lead.id)) {
          duplicateLeadIds.push(lead.id);
        }
      });
    });

    console.log(`✅ Found ${duplicateGroups.length} duplicate groups with ${totalDuplicateLeads} duplicate leads`);

    res.json({
      duplicates: duplicateGroups,
      totalGroups: duplicateGroups.length,
      totalDuplicateLeads,
      duplicateLeadIds,
      debug: {
        totalLeads: allLeads.length,
        emailGroups: Object.keys(emailGroups).length,
        phoneGroups: Object.keys(phoneGroups).length,
      },
    });
  } catch (error) {
    console.error("Find duplicates error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /api/leads/duplicates
 * Delete all duplicate leads (Admin only)
 * Keeps the oldest lead in each duplicate group
 * NOTE: This must be defined BEFORE /:id route to avoid route conflict
 */
router.delete("/duplicates", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    // Helper function to normalize phone number (same as in GET endpoint)
    const normalizePhone = (phone: string): string => {
      if (!phone) return "";
      // Remove all non-digit characters except +
      return phone.replace(/[\s\-\(\)\.]/g, "").trim();
    };

    // First, find all duplicates
    const allLeads = await prisma.lead.findMany({
      orderBy: {
        createdAt: "asc", // Oldest first
      },
    });

    // Group by email and phone
    const emailGroups: { [key: string]: typeof allLeads } = {};
    const phoneGroups: { [key: string]: typeof allLeads } = {};

    allLeads.forEach((lead) => {
      // Normalize email (only if email exists - email is now optional)
      if (lead.email) {
        const emailKey = lead.email.toLowerCase().trim();
        if (emailKey) { // Only group if email is not empty
          if (!emailGroups[emailKey]) {
            emailGroups[emailKey] = [];
          }
          emailGroups[emailKey].push(lead);
        }
      }

      const phoneKey = normalizePhone(lead.phone);
      if (phoneKey) { // Only group if phone exists
        if (!phoneGroups[phoneKey]) {
          phoneGroups[phoneKey] = [];
        }
        phoneGroups[phoneKey].push(lead);
      }
    });

    // Find IDs to delete (all except the first/oldest in each group)
    const idsToKeep = new Set<string>();
    const idsToDelete: string[] = [];

    // Process email duplicates
    Object.values(emailGroups).forEach((leads) => {
      if (leads.length > 1) {
        // Keep the first (oldest) one
        idsToKeep.add(leads[0].id);
        // Mark others for deletion
        leads.slice(1).forEach((lead) => {
          if (!idsToKeep.has(lead.id)) {
            idsToDelete.push(lead.id);
          }
        });
      } else {
        idsToKeep.add(leads[0].id);
      }
    });

    // Process phone duplicates (only if not already handled by email)
    Object.values(phoneGroups).forEach((leads) => {
      if (leads.length > 1) {
        // Check if already handled by email group
        const firstLeadEmail = leads[0].email;
        const emailKey = firstLeadEmail ? firstLeadEmail.toLowerCase().trim() : "";
        const alreadyHandled = emailKey && emailGroups[emailKey] && emailGroups[emailKey].length > 1;

        if (!alreadyHandled) {
          // Keep the first (oldest) one
          if (!idsToKeep.has(leads[0].id)) {
            idsToKeep.add(leads[0].id);
          }
          // Mark others for deletion
          leads.slice(1).forEach((lead) => {
            if (!idsToKeep.has(lead.id) && !idsToDelete.includes(lead.id)) {
              idsToDelete.push(lead.id);
            }
          });
        }
      } else if (!idsToKeep.has(leads[0].id)) {
        idsToKeep.add(leads[0].id);
      }
    });

    // Delete duplicates
    let deletedCount = 0;
    if (idsToDelete.length > 0) {
      const result = await prisma.lead.deleteMany({
        where: {
          id: {
            in: idsToDelete,
          },
        },
      });
      deletedCount = result.count;
    }

    res.json({
      message: `Successfully deleted ${deletedCount} duplicate lead(s)`,
      deletedCount,
      keptCount: idsToKeep.size,
    });
  } catch (error) {
    console.error("Delete duplicates error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/leads/assignment-stats
 * Get today's assignment statistics for Team Leader
 * Shows: leads assigned to Team Leader today, leads distributed to telecallers today
 * NOTE: Must be defined BEFORE /:id route to avoid route conflict
 */
router.get("/assignment-stats", authenticate, authorize("TEAM_LEADER"), async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role.name;

    // Get today's date range (start and end of today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get Team Leader's team members
    const teamLeader = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        teamMembers: {
          where: {
            role: {
              name: { in: ["TELECALLER", "COUNSELOR"] },
            },
            isActive: true,
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    const teamMemberIds = teamLeader?.teamMembers.map((m) => m.id) || [];

    // 1. Leads assigned TO Team Leader today (assignedToId = userId, assignedAt = today)
    const leadsAssignedToTeamLeader = await prisma.lead.findMany({
      where: {
        assignedToId: userId,
        assignedAt: {
          gte: today,
          lt: tomorrow,
        },
      },
      select: {
        id: true,
        leadId: true,
        firstName: true,
        lastName: true,
        assignedAt: true,
        assignedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        assignedAt: "desc",
      },
    });

    // 2. Leads distributed BY Team Leader to telecallers today (assignedById = userId, assignedAt = today)
    const leadsDistributedToTelecallers = await prisma.lead.findMany({
      where: {
        assignedById: userId,
        assignedAt: {
          gte: today,
          lt: tomorrow,
        },
        assignedToId: {
          in: teamMemberIds.length > 0 ? teamMemberIds : [],
        },
      },
      select: {
        id: true,
        leadId: true,
        firstName: true,
        lastName: true,
        assignedAt: true,
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        assignedAt: "desc",
      },
    });

    res.json({
      today: today.toISOString(),
      stats: {
        leadsAssignedToTeamLeader: leadsAssignedToTeamLeader.length,
        leadsDistributedToTelecallers: leadsDistributedToTelecallers.length,
      },
      leadsAssignedToTeamLeader: leadsAssignedToTeamLeader.map((lead) => ({
        leadId: lead.leadId,
        id: lead.id,
        name: `${lead.firstName} ${lead.lastName}`,
        assignedAt: lead.assignedAt,
        assignedBy: lead.assignedBy
          ? `${lead.assignedBy.firstName} ${lead.assignedBy.lastName}`
          : null,
      })),
      leadsDistributedToTelecallers: leadsDistributedToTelecallers.map((lead) => ({
        leadId: lead.leadId,
        id: lead.id,
        name: `${lead.firstName} ${lead.lastName}`,
        assignedTo: lead.assignedTo
          ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}`
          : null,
        assignedToId: lead.assignedTo?.id,
        assignedAt: lead.assignedAt,
      })),
    });
  } catch (error) {
    console.error("Get assignment stats error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/leads/:id
 * Get lead by ID with notes (LeadActivity)
 */
router.get("/:id", authenticate, authorize("ADMIN", "BRANCH_MANAGER", "TEAM_LEADER", "COUNSELOR", "TELECALLER"), async (req, res) => {
  try {
    const { id } = req.params;

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        assignedTo: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        previousAssignedTo: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        activities: {
          include: {
            createdBy: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    // Run No Answer callback auto-fix (e.g. 1/3 wrong 58h → next day) so tags/detail show correct time
    try {
      await ensureNoAnswerCallbackScheduled(id);
    } catch (_) {
      // non-fatal
    }

    res.json({ lead });
  } catch (error) {
    console.error("Get lead error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/leads
 * Create new lead (Admin, Branch Manager, Counselor, Telecaller)
 * Phone number is unique - if phone exists, lead will be updated instead of created
 */
router.post("/", authenticate, authorize("ADMIN", "BRANCH_MANAGER", "COUNSELOR", "TELECALLER"), async (req, res) => {
  try {
    const validatedData = createLeadSchema.parse(req.body);
    const user = (req as any).user;
    const userId = user?.userId || user?.id;

    // Check if assigned user exists (if provided)
    if (validatedData.assignedToId) {
      const assignedUser = await prisma.user.findUnique({
        where: { id: validatedData.assignedToId },
      });

      if (!assignedUser) {
        return res.status(400).json({ error: "Assigned user not found" });
      }
    }

    // Check if lead with this phone number already exists (phone is unique)
    const existingLead = await prisma.lead.findUnique({
      where: { phone: validatedData.phone },
    });

    let lead;
    if (existingLead) {
      // Update existing lead (phone number is unique identifier)
      // If lead doesn't have leadId, assign one
      const updateData: any = {
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        email: validatedData.email,
        country: validatedData.country,
        visaType: validatedData.visaType,
        source: validatedData.source,
        status: validatedData.status,
        notes: validatedData.notes,
        assignedToId: validatedData.assignedToId,
        // Don't update createdById - keep original creator
      };

      // CRITICAL: leadId is PERMANENT - only assign if it doesn't exist
      // Never change an existing leadId, even during imports/updates
      if (!existingLead.leadId) {
        updateData.leadId = await getNextLeadId();
      } else {
        // Explicitly preserve existing leadId - never update it
        delete (updateData as any).leadId;
      }

      lead = await prisma.lead.update({
        where: { phone: validatedData.phone },
        data: updateData,
        include: {
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      return res.json({
        message: "Lead updated successfully (phone number already exists)",
        lead,
      });
    } else {
      // Create new lead
      // Generate next serial leadId
      const nextLeadId = await getNextLeadId();

      lead = await prisma.lead.create({
        data: {
          ...validatedData,
          leadId: nextLeadId,
          createdById: userId,
          status: validatedData.status || "new", // Default status = NEW
        },
        include: {
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      // Emit realtime event: lead:created
      try {
        broadcastDxEvent("system", {
          type: "lead:created",
          leadId: lead.id,
          byUserId: userId,
        });
      } catch (eventError) {
        console.error("Failed to emit lead:created event:", eventError);
        // Don't fail the request if event emission fails
      }

      return res.status(201).json({
        message: "Lead created successfully",
        lead,
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    // Handle unique constraint violation
    if ((error as any).code === 'P2002' || (error as any).message?.includes('Unique constraint')) {
      return res.status(400).json({
        error: "Phone number already exists",
        message: "Each phone number can only have one lead. Please use update endpoint to modify existing lead."
      });
    }
    console.error("Create lead error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PATCH /api/leads/:id
 * Update lead status or basic fields (partial update)
 * Emits dx:event for status changes
 */
router.patch("/:id", authenticate, authorize("ADMIN", "BRANCH_MANAGER", "COUNSELOR", "TELECALLER"), async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const userId = user?.userId || user?.id;

    const patchSchema = z.object({
      status: z.enum(["new", "contacted", "qualified", "converted", "lost"]).optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      score: z.union([z.number(), z.string()]).transform((val) => typeof val === "string" ? parseInt(val) || 0 : val).optional(),
      notes: z.string().optional(),
      // Allow other basic fields
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
      email: z.string().email("Invalid email address").optional(),
      phone: z.string().optional(),
      country: z.string().optional(),
      visaType: z.string().optional(),
      source: z.string().optional(),
    });

    const validatedData = patchSchema.parse(req.body);

    // Check if lead exists
    const existingLead = await prisma.lead.findUnique({
      where: { id },
    });

    if (!existingLead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    // Track if status changed
    const statusChanged = validatedData.status && validatedData.status !== existingLead.status;

    // Update lead
    const lead = await prisma.lead.update({
      where: { id },
      data: validatedData,
      include: {
        assignedTo: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Emit realtime event if status changed
    if (statusChanged) {
      try {
        broadcastDxEvent("system", {
          type: "lead:statusChanged",
          leadId: lead.id,
          status: lead.status,
          byUserId: userId,
        });
      } catch (eventError) {
        console.error("Failed to emit lead:statusChanged event:", eventError);
        // Don't fail the request if event emission fails
      }

      // Phase 2: Auto-create task from lead status change
      try {
        const oldStatus = existingLead.status;
        const newStatus = validatedData.status!;
        await createTaskFromLeadStatusChange(lead, oldStatus, newStatus);
      } catch (taskError) {
        // Don't fail the lead update if task creation fails
        console.error("[TASK AUTO-CREATE] Error creating task from lead status change:", taskError);
      }
    }

    res.json({
      message: "Lead updated successfully",
      lead,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Patch lead error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PUT /api/leads/:id
 * Update lead (Admin, Branch Manager, Counselor, Telecaller)
 * Phone number is unique - cannot update to a phone that already exists
 */
router.put("/:id", authenticate, authorize("ADMIN", "BRANCH_MANAGER", "COUNSELOR", "TELECALLER"), async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const userId = user?.userId || user?.id;
    console.log("📝 Update lead request body:", req.body);

    let validatedData;
    try {
      // Pre-process: convert empty strings to undefined for optional fields
      const processedBody: any = {};
      for (const [key, value] of Object.entries(req.body)) {
        // Skip empty strings for optional fields (treat as undefined)
        if (value === "" || value === null) {
          continue; // Skip empty/null values
        }
        processedBody[key] = value;
      }

      console.log("📝 Processed request body:", processedBody);
      validatedData = updateLeadSchema.parse(processedBody);
    } catch (validationError: any) {
      console.error("❌ Validation error details:", JSON.stringify(validationError.errors, null, 2));
      console.error("❌ Received body:", JSON.stringify(req.body, null, 2));
      return res.status(400).json({
        error: "Validation error",
        details: validationError.errors,
        received: req.body,
      });
    }

    // Check if lead exists
    const existingLead = await prisma.lead.findUnique({
      where: { id },
    });

    if (!existingLead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    // If phone number is being updated, check if it already exists for another lead
    if (validatedData.phone && validatedData.phone !== existingLead.phone) {
      const phoneExists = await prisma.lead.findUnique({
        where: { phone: validatedData.phone },
      });

      if (phoneExists && phoneExists.id !== id) {
        return res.status(400).json({
          error: "Phone number already exists",
          message: `Phone number ${validatedData.phone} is already assigned to another lead. Each phone number can only have one lead.`
        });
      }
    }

    // Check if assigned user exists (if provided)
    if (validatedData.assignedToId) {
      const assignedUser = await prisma.user.findUnique({
        where: { id: validatedData.assignedToId },
      });

      if (!assignedUser) {
        return res.status(400).json({ error: "Assigned user not found" });
      }
    }

    // CRITICAL: leadId is PERMANENT and must NEVER be changed
    // Even if someone tries to send leadId in the request, we exclude it
    // leadId is assigned only once when the lead is created and stays forever
    const { leadId: _, ...updateData } = validatedData as any;

    // Double-check: explicitly exclude leadId from update data
    delete (updateData as any).leadId;

    // Convert documentsReceived array to JSON string if provided
    if (updateData.documentsReceived && Array.isArray(updateData.documentsReceived)) {
      updateData.documentsReceived = JSON.stringify(updateData.documentsReceived);
    }

    // Convert callbackScheduledAt string to DateTime if provided
    if (updateData.callbackScheduledAt && typeof updateData.callbackScheduledAt === 'string') {
      try {
        const dateValue = new Date(updateData.callbackScheduledAt);
        if (isNaN(dateValue.getTime())) {
          console.warn("⚠️ Invalid callbackScheduledAt date:", updateData.callbackScheduledAt);
          delete updateData.callbackScheduledAt; // Remove invalid date
        } else {
          updateData.callbackScheduledAt = dateValue;
        }
      } catch (error) {
        console.warn("⚠️ Error parsing callbackScheduledAt:", error);
        delete updateData.callbackScheduledAt; // Remove invalid date
      }
    }

    // Convert movedAt string to DateTime if provided
    if (updateData.movedAt && typeof updateData.movedAt === 'string') {
      updateData.movedAt = new Date(updateData.movedAt);
    }

    // Handle role-based assignment (for Telecaller moving leads to Counselor, etc.)
    let moveToRole: string | undefined = undefined;
    if ((updateData as any).moveToRole) {
      moveToRole = (updateData as any).moveToRole;
      delete (updateData as any).moveToRole; // Remove from updateData

      // Find an active user with the specified role
      const targetUser = await prisma.user.findFirst({
        where: {
          role: {
            name: moveToRole,
          },
          isActive: true,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      });

      if (targetUser) {
        updateData.assignedToId = targetUser.id;
        console.log(`✅ Found user for role ${moveToRole}: ${targetUser.firstName} ${targetUser.lastName}`);
      } else {
        console.warn(`⚠️ No active user found with role ${moveToRole}`);
        return res.status(400).json({
          error: "No user available",
          message: `No active user found with role ${moveToRole}. Please contact admin.`
        });
      }
    }

    console.log("📝 Updating lead with data:", JSON.stringify(updateData, null, 2));

    // Track if status changed
    const statusChanged = updateData.status && updateData.status !== existingLead.status;
    // Track if assignment changed
    const assignmentChanged = updateData.assignedToId && updateData.assignedToId !== existingLead.assignedToId;

    // If assignment is being changed, track who assigned and when
    if (assignmentChanged && updateData.assignedToId) {
      updateData.assignedById = userId;
      updateData.assignedAt = new Date();
      updateData.previousAssignedToId = existingLead.assignedToId || null;
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: updateData, // leadId is permanently excluded - never changes
      include: {
        assignedTo: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        previousAssignedTo: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Emit realtime events
    if (statusChanged) {
      try {
        broadcastDxEvent("system", {
          type: "lead:statusChanged",
          leadId: lead.id,
          status: lead.status,
          byUserId: userId,
        });
      } catch (eventError) {
        console.error("Failed to emit lead:statusChanged event:", eventError);
      }

      // Phase 2: Auto-create task from lead status change
      try {
        const oldStatus = existingLead.status;
        const newStatus = updateData.status!;
        await createTaskFromLeadStatusChange(lead, oldStatus, newStatus);
      } catch (taskError) {
        // Don't fail the lead update if task creation fails
        console.error("[TASK AUTO-CREATE] Error creating task from lead status change:", taskError);
      }
    }

    if (assignmentChanged && lead.assignedToId) {
      try {
        broadcastDxEvent("system", {
          type: "lead:assigned",
          leadId: lead.id,
          toUserId: lead.assignedToId,
          byUserId: userId,
        });
      } catch (eventError) {
        console.error("Failed to emit lead:assigned event:", eventError);
      }
    }

    // Format lead to parse documentsReceived from JSON string to array
    const formattedLead = { ...lead };
    if (formattedLead.documentsReceived && typeof formattedLead.documentsReceived === 'string') {
      try {
        formattedLead.documentsReceived = JSON.parse(formattedLead.documentsReceived);
      } catch (e) {
        formattedLead.documentsReceived = [];
      }
    } else if (!formattedLead.documentsReceived) {
      formattedLead.documentsReceived = [];
    }

    res.json({
      message: "Lead updated successfully",
      lead: formattedLead,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    // Handle unique constraint violation
    if ((error as any).code === 'P2002' || (error as any).message?.includes('Unique constraint')) {
      return res.status(400).json({
        error: "Phone number already exists",
        message: "Each phone number can only have one lead. Please use a different phone number."
      });
    }
    console.error("Update lead error:", error);
    console.error("Error name:", error?.name);
    console.error("Error message:", error?.message);
    console.error("Error code:", (error as any)?.code);
    console.error("Error meta:", JSON.stringify((error as any)?.meta, null, 2));
    res.status(500).json({
      error: "Internal server error",
      message: error?.message || "Unknown error",
      details: process.env.NODE_ENV === "development" ? {
        name: error?.name,
        code: (error as any)?.code,
        meta: (error as any)?.meta,
      } : undefined
    });
  }
});


/**
 * POST /api/leads/:id/assign
 * Assign lead to a user
 * RBAC enforced - requires appropriate permissions
 * Emits dx:event: lead:assigned
 */
router.post("/:id/assign", authenticate, authorize("ADMIN", "BRANCH_MANAGER", "TEAM_LEADER"), async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const userId = user?.userId || user?.id;

    const assignSchema = z.object({
      assignedToId: z.string().min(1, "Assigned user ID is required"),
    });

    const validatedData = assignSchema.parse(req.body);

    // Check if lead exists
    const lead = await prisma.lead.findUnique({
      where: { id },
    });

    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    // Check if assigned user exists
    const assignedUser = await prisma.user.findUnique({
      where: { id: validatedData.assignedToId },
      include: {
        role: true,
      },
    });

    if (!assignedUser) {
      return res.status(400).json({ error: "Assigned user not found" });
    }

    if (!assignedUser.isActive) {
      return res.status(400).json({ error: "Cannot assign to inactive user" });
    }

    // RBAC: Team Leader can only assign to their team members
    if (user.role === "TEAM_LEADER") {
      const teamLeader = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          teamMembers: {
            where: {
              isActive: true,
            },
          },
        },
      });

      if (!teamLeader) {
        return res.status(404).json({ error: "Team Leader not found" });
      }

      const teamMemberIds = teamLeader.teamMembers.map((m) => m.id);
      if (!teamMemberIds.includes(validatedData.assignedToId)) {
        return res.status(403).json({
          error: "Insufficient permissions",
          message: "Team Leaders can only assign leads to their team members",
        });
      }
    }

    // Update lead assignment
    const previousAssignedToId = lead.assignedToId;
    const updatedLead = await prisma.lead.update({
      where: { id },
      data: {
        assignedToId: validatedData.assignedToId,
        assignedById: userId,
        assignedAt: new Date(),
        previousAssignedToId: previousAssignedToId,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Emit realtime event: lead:assigned
    try {
      broadcastDxEvent("system", {
        type: "lead:assigned",
        leadId: updatedLead.id,
        toUserId: validatedData.assignedToId,
        byUserId: userId,
      });
    } catch (eventError) {
      console.error("Failed to emit lead:assigned event:", eventError);
      // Don't fail the request if event emission fails
    }

    res.json({
      message: "Lead assigned successfully",
      lead: updatedLead,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Assign lead error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/leads/:id/reopen
 * Senior only: clear exhaust state (e.g. after "Wrong Number" — edit number & reopen or reassign).
 * Optionally set assignedToId (reassign) and/or phone (edit number).
 */
router.post("/:id/reopen", authenticate, authorize("ADMIN", "BRANCH_MANAGER", "TEAM_LEADER"), async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const userId = user?.userId || user?.id;

    const reopenSchema = z.object({
      assignedToId: z.string().optional(),
      phone: z.string().optional(),
      note: z.string().optional(),
    });
    const body = reopenSchema.parse(req.body);

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const updateData: any = {
      isExhausted: false,
      exhaustedAt: null,
      exhaustReason: null,
      callStatus: null,
      callbackScheduledAt: null,
    };
    if (body.phone != null) updateData.phone = body.phone;
    if (body.assignedToId != null) {
      updateData.assignedToId = body.assignedToId;
      updateData.assignedById = userId;
      updateData.assignedAt = new Date();
      updateData.previousAssignedToId = lead.assignedToId;
    }

    const updatedLead = await prisma.lead.update({
      where: { id },
      data: updateData,
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    await prisma.leadActivity.create({
      data: {
        leadId: id,
        activityType: "REOPENED",
        title: "Lead reopened",
        description: body.note || (body.assignedToId ? "Exhaust cleared; lead reassigned." : "Exhaust cleared; lead back in pool."),
        createdById: userId,
      },
    });

    res.json({
      message: "Lead reopened successfully",
      lead: updatedLead,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Reopen lead error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/leads/:id/notes
 * Add LeadNote (via LeadActivity with activityType: "note")
 * createdByUserId from auth context
 */
router.post("/:id/notes", authenticate, authorize("ADMIN", "BRANCH_MANAGER", "TEAM_LEADER", "COUNSELOR", "TELECALLER"), async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const userId = user?.userId || user?.id;

    const noteSchema = z.object({
      title: z.string().min(1, "Title is required"),
      description: z.string().optional(),
      metadata: z.string().optional(), // JSON string for additional data
    });

    const validatedData = noteSchema.parse(req.body);

    // Check if lead exists
    const lead = await prisma.lead.findUnique({
      where: { id },
    });

    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    // Create LeadActivity with activityType: "note"
    const activity = await prisma.leadActivity.create({
      data: {
        leadId: id,
        activityType: "note",
        title: validatedData.title,
        description: validatedData.description || null,
        metadata: validatedData.metadata || null,
        createdById: userId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    res.status(201).json({
      message: "Note added successfully",
      activity,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Add note error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /api/leads/:id
 * Delete lead (Admin only)
 */
router.delete("/:id", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;

    const lead = await prisma.lead.findUnique({
      where: { id },
    });

    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    await prisma.lead.delete({
      where: { id },
    });

    res.json({ message: "Lead deleted successfully" });
  } catch (error) {
    console.error("Delete lead error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/leads/distribute
 * Distribute leads from Team Leader to Telecallers (or Admin)
 * Methods: round_robin, direct_assignment, equal_distribution
 */
router.post("/distribute", authenticate, authorize("TEAM_LEADER", "ADMIN"), async (req, res) => {
  try {
    const user = (req as any).user;
    const userId = user?.userId || user?.id;

    const { method, leadIds, telecallerIds } = req.body;

    // Validate input
    if (!method || !["round_robin", "direct_assignment", "equal_distribution"].includes(method)) {
      return res.status(400).json({ error: "Invalid distribution method" });
    }

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ error: "Lead IDs are required" });
    }

    // Get Team Leader's team members (telecallers)
    const teamLeader = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        teamMembers: {
          where: {
            role: {
              name: "TELECALLER",
            },
            isActive: true,
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!teamLeader) {
      return res.status(404).json({ error: "Team Leader not found" });
    }

    const telecallers = teamLeader.teamMembers;

    if (telecallers.length === 0) {
      return res.status(400).json({ error: "No telecallers found in your team" });
    }

    // Get leads assigned to Team Leader
    const leads = await prisma.lead.findMany({
      where: {
        id: { in: leadIds },
        assignedToId: userId, // Only leads assigned to this Team Leader
      },
    });

    if (leads.length === 0) {
      return res.status(400).json({ error: "No leads found or leads are not assigned to you" });
    }

    let assignments: { leadId: string; telecallerId: string }[] = [];

    if (method === "round_robin") {
      // Round Robin: Distribute leads evenly in rotation
      leads.forEach((lead, index) => {
        const telecallerIndex = index % telecallers.length;
        assignments.push({
          leadId: lead.id,
          telecallerId: telecallers[telecallerIndex].id,
        });
      });
    } else if (method === "equal_distribution") {
      // Equal Distribution: Divide leads equally among telecallers
      const leadsPerTelecaller = Math.ceil(leads.length / telecallers.length);
      leads.forEach((lead, index) => {
        const telecallerIndex = Math.floor(index / leadsPerTelecaller);
        if (telecallerIndex < telecallers.length) {
          assignments.push({
            leadId: lead.id,
            telecallerId: telecallers[telecallerIndex].id,
          });
        }
      });
    } else if (method === "direct_assignment") {
      // Direct Assignment: Assign specific leads to specific telecallers
      if (!telecallerIds || !Array.isArray(telecallerIds) || telecallerIds.length !== leadIds.length) {
        return res.status(400).json({
          error: "For direct assignment, telecallerIds array must match leadIds array length"
        });
      }

      // Validate telecaller IDs belong to team
      const validTelecallerIds = new Set(telecallers.map(t => t.id));
      for (const telId of telecallerIds) {
        if (!validTelecallerIds.has(telId)) {
          return res.status(400).json({
            error: `Telecaller ${telId} is not in your team`
          });
        }
      }

      assignments = leadIds.map((leadId: string, index: number) => ({
        leadId,
        telecallerId: telecallerIds[index],
      }));
    }

    // Update leads with new assignments (track who assigned and when)
    const updatePromises = assignments.map(({ leadId, telecallerId }) =>
      prisma.lead.update({
        where: { id: leadId },
        data: {
          assignedToId: telecallerId,
          assignedById: userId, // Track which Team Leader assigned
          assignedAt: new Date(), // Track when assigned
        },
      })
    );

    await Promise.all(updatePromises);

    // Get updated leads with telecaller info
    const updatedLeads = await prisma.lead.findMany({
      where: {
        id: { in: leadIds },
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    res.json({
      message: `Successfully distributed ${assignments.length} lead(s)`,
      method,
      assignments: assignments.map(a => ({
        leadId: a.leadId,
        telecaller: telecallers.find(t => t.id === a.telecallerId),
      })),
      leads: updatedLeads,
    });
  } catch (error) {
    console.error("Distribute leads error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/leads/:id/profile-photo
 * Upload profile photo for a lead (passport size image)
 */
router.post(
  "/:id/profile-photo",
  authenticate,
  authorize("ADMIN", "BRANCH_MANAGER", "COUNSELOR", "TELECALLER"),
  (req, res, next) => {
    uploadProfilePhoto.single("photo")(req, res, (err: any) => {
      if (err) {
        console.error("Multer error:", err);
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            error: "File too large",
            message: "File size must be less than 2MB"
          });
        }
        if (err.message && err.message.includes("Invalid file type")) {
          return res.status(400).json({
            error: "Invalid file type",
            message: "Only JPEG, PNG, and WebP images are allowed"
          });
        }
        return res.status(400).json({
          error: "File upload error",
          message: err.message || "Failed to process file upload"
        });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const { id } = req.params;
      const file = req.file;

      console.log("📤 Profile photo upload request:", { leadId: id, file: file ? { name: file.filename, size: file.size } : null });

      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Check if lead exists
      const lead = await prisma.lead.findUnique({
        where: { id },
      });

      if (!lead) {
        // Delete uploaded file if lead doesn't exist
        fs.unlinkSync(file.path);
        return res.status(404).json({ error: "Lead not found" });
      }

      // Delete old photo if exists
      if (lead.profilePhoto) {
        const oldPhotoPath = path.join(process.cwd(), lead.profilePhoto);
        if (fs.existsSync(oldPhotoPath)) {
          fs.unlinkSync(oldPhotoPath);
        }
      }

      // Update lead with new photo URL
      const photoUrl = `/uploads/lead-photos/${file.filename}`;
      console.log("💾 Saving photo URL to database:", photoUrl);

      const updatedLead = await prisma.lead.update({
        where: { id },
        data: { profilePhoto: photoUrl },
      });

      console.log("✅ Profile photo uploaded successfully:", {
        leadId: id,
        photoUrl: updatedLead.profilePhoto,
        fileSize: file.size,
        fileName: file.filename
      });

      res.json({
        message: "Profile photo uploaded successfully",
        photoUrl: updatedLead.profilePhoto,
      });
    } catch (error: any) {
      console.error("Upload profile photo error:", error);
      if (req.file) {
        // Delete uploaded file on error
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({
        error: "Failed to upload profile photo",
        details: error.message
      });
    }
  }
);

/**
 * GET /api/leads/search-by-phone
 * Search lead by phone number with assigned user and role information
 */
router.get("/search-by-phone", authenticate, async (req, res) => {
  try {
    const phone = req.query.phone as string;

    if (!phone) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    // Normalize phone number (remove spaces, dashes, etc.)
    const normalizedPhone = phone.replace(/[\s\-\(\)]/g, "");

    const lead = await prisma.lead.findUnique({
      where: { phone: normalizedPhone },
      include: {
        assignedTo: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
            role: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    res.json({
      lead,
      // Include whether lead is assigned to another user/role
      isAssignedToOther: lead ? (lead.assignedTo ? {
        userId: lead.assignedTo.id,
        userName: `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}`,
        userEmail: lead.assignedTo.email,
        employeeCode: lead.assignedTo.employeeCode,
        role: lead.assignedTo.role.name,
        roleDescription: lead.assignedTo.role.description,
      } : null) : null,
    });
  } catch (error) {
    console.error("Search lead by phone error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/leads/auto-create
 * Auto-create lead from incoming call
 */
router.post("/auto-create", authenticate, async (req: any, res) => {
  try {
    const { phone, source } = req.body;
    const userId = req.user?.userId || req.user?.id;

    if (!phone) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    // Normalize phone number
    const normalizedPhone = phone.replace(/[\s\-\(\)]/g, "");

    // Check if lead already exists
    const existingLead = await prisma.lead.findUnique({
      where: { phone: normalizedPhone },
    });

    if (existingLead) {
      return res.json({
        message: "Lead already exists",
        lead: existingLead,
        created: false,
      });
    }

    // Get next leadId
    const nextLeadId = await getNextLeadId();

    // Create new lead
    const lead = await prisma.lead.create({
      data: {
        leadId: nextLeadId,
        firstName: "Unknown",
        lastName: "Caller",
        email: "",
        phone: normalizedPhone,
        status: "new",
        source: source || "incoming_call",
        createdById: userId,
      },
    });

    res.status(201).json({
      message: "Lead auto-created successfully",
      lead,
      created: true,
    });
  } catch (error) {
    console.error("Auto-create lead error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================
// Tag Application Endpoints (Phase 1.2)
// ============================================

// Apply tag to lead
router.post("/:id/tags", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Delegate to tag-applications route
    // Create a mock request object for the tag-applications route
    const tagReq = {
      ...req,
      params: { entityType: "lead", entityId: id },
      body: req.body,
    };

    // Import and use the tag applications router
    const tagApplicationRouter = require("./tagApplications").default;

    // We'll handle this by calling the logic directly
    // For now, let's use the generic endpoint pattern
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
    if (tagFlow.appliesTo !== "all" && tagFlow.appliesTo !== "lead") {
      return res.status(400).json({
        error: `Tag does not apply to lead. This tag applies to: ${tagFlow.appliesTo}`,
      });
    }

    // Verify lead exists
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    // No Answer: 3 attempts ke baad jab dubara same tag apply ho to auto-shuffle — lead dusre telecaller ko transfer, previous owner ki list se hatao
    if (tagFlow.tagValue === "no_answer") {
      const activeWorkflow = await prisma.workflow.findFirst({
        where: { isActive: true },
        orderBy: { updatedAt: "desc" },
      });
      let tagConfig: any = null;
      if (activeWorkflow) {
        const workflowData: any = typeof activeWorkflow.workflowData === "string"
          ? JSON.parse(activeWorkflow.workflowData)
          : activeWorkflow.workflowData;
        if (workflowData.tags) {
          const tag = Object.values(workflowData.tags).find((t: any) =>
            t.tagValue === "no_answer" || t.id === tagFlowId
          ) as any;
          if (tag?.tagConfig) tagConfig = tag.tagConfig;
        }
        if (!tagConfig && workflowData.tagGroups) {
          const allTags = [
            ...(workflowData.tagGroups.connected || []),
            ...(workflowData.tagGroups.notConnected || []),
          ];
          const tag = allTags.find((t: any) =>
            t.tagValue === "no_answer" || t.id === tagFlowId
          ) as any;
          if (tag?.tagConfig) tagConfig = tag.tagConfig;
        }
      }
      const maxAttempts = tagConfig?.retryPolicy?.maxAttempts ?? 3;
      const existingByOwner = await prisma.tagApplication.count({
        where: {
          entityType: "lead",
          entityId: id,
          tagFlowId,
          appliedById: userId,
        },
      });
      if (existingByOwner >= maxAttempts) {
        const {
          getShuffleConfig,
          selectNextOwner,
          executeShuffle,
          markLeadExhausted,
        } = require("../services/shuffleEscalationService");
        const shuffleConfig = getShuffleConfig(tagConfig?.shuffleEscalation);
        const nextOwner = await selectNextOwner(prisma, id, userId, shuffleConfig, tagFlowId);
        if (nextOwner) {
          const shuffleResult = await executeShuffle(prisma, {
            leadId: id,
            currentOwnerId: userId,
            newOwnerId: nextOwner.newOwnerId,
            newOwnerName: nextOwner.newOwnerName,
            noAnswerTagFlowId: tagFlowId,
            config: shuffleConfig,
            shuffleIndex: nextOwner.shuffleIndex,
          });
          return res.status(200).json({
            shuffled: true,
            message: `Lead transferred to ${nextOwner.newOwnerName}. It will appear as new in their list.`,
            newOwnerId: shuffleResult.newOwnerId,
            newOwnerName: shuffleResult.newOwnerName,
            callbackAt: shuffleResult.callbackAt ? shuffleResult.callbackAt.toISOString() : null,
            tagApplicationId: shuffleResult.tagApplicationId ?? null,
            shuffleIndex: shuffleResult.shuffleIndex,
          });
        }
        const exhaustResult = await markLeadExhausted(prisma, { leadId: id, createdById: userId });
        try {
          const seniorUsers = await prisma.user.findMany({
            where: {
              isActive: true,
              role: { name: { in: ["TEAM_LEADER", "BRANCH_MANAGER", "ADMIN"] } },
            },
            select: { id: true },
          });
          const { getIO } = await import("../lib/socket");
          const io = getIO();
          if (io) {
            const payload = {
              leadId: exhaustResult.lead.id,
              leadName: `${exhaustResult.lead.firstName} ${exhaustResult.lead.lastName}`,
              phone: exhaustResult.lead.phone,
              exhaustedBy: exhaustResult.createdById,
            };
            for (const u of seniorUsers) {
              io.to(`user:${u.id}`).emit("lead:exhausted", payload);
            }
          }
        } catch (notifyErr) {
          // non-fatal
        }
        return res.status(409).json({
          error: "Pool exhausted",
          message: "Pool exhausted. TL/Manager will reassign or escalate.",
          attemptCount: existingByOwner,
          maxAttempts,
          exhausted: true,
        });
      }
    }

    // Validate required fields
    if (tagFlow.requiresNote && (!note || note.trim() === "")) {
      return res.status(400).json({ error: "Note is required for this tag" });
    }

    if (tagFlow.requiresCallback && !callbackAt && tagFlow.tagValue !== "no_answer") {
      return res.status(400).json({ error: "Callback date/time is required for this tag" });
    }

    if (tagFlow.requiresFollowUp && !followUpAt) {
      return res.status(400).json({ error: "Follow-up date/time is required for this tag" });
    }

    // Check exclusive (remove other tags if exclusive)
    if (tagFlow.isExclusive) {
      await prisma.tagApplication.updateMany({
        where: {
          entityType: "lead",
          entityId: id,
          isActive: true,
        },
        data: { isActive: false },
      });
    }

    // Create TagApplication
    const tagApplication = await prisma.tagApplication.create({
      data: {
        entityType: "lead",
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
        "lead",
        id,
        tagFlow.actions
      );
    }

    // Update LeadCurrentTagState
    const parentTagId = tagFlow.parentId || (tagFlow.parentId ? tagFlow.id : null);
    const childTagId = tagFlow.parentId ? tagFlow.id : null;

    await prisma.leadCurrentTagState.upsert({
      where: { leadId: id },
      update: {
        parentTagId: parentTagId || null,
        childTagId: childTagId || null,
      },
      create: {
        leadId: id,
        parentTagId: parentTagId || null,
        childTagId: childTagId || null,
      },
    });

    // Create LeadActivity
    await prisma.leadActivity.create({
      data: {
        leadId: id,
        activityType: "tag_applied",
        title: `Tagged as ${tagFlow.name}`,
        description: note || null,
        metadata: JSON.stringify({
          tagFlowId,
          tagFlowName: tagFlow.name,
          tagValue: tagFlow.tagValue,
          category: tagFlow.category,
        }),
        createdById: userId,
      },
    });

    // Trigger workflow execution for this tag application
    console.log(`[LEAD TAG] 🏷️ Tag applied to lead ${id}, tagFlowId: ${tagFlowId}, triggering workflow...`);
    try {
      const { startWorkflowExecution } = require("../services/workflowRunner");

      // Get active workflow
      console.log(`[LEAD TAG] 🔍 Looking for active workflow...`);
      const activeWorkflow = await prisma.workflow.findFirst({
        where: { isActive: true },
        orderBy: { updatedAt: "desc" },
      });

      if (!activeWorkflow) {
        console.log(`[LEAD TAG] ⚠️ No active workflow found`);
      } else {
        console.log(`[LEAD TAG] ✅ Found active workflow: ${activeWorkflow.id} (${activeWorkflow.name})`);
      }

      if (activeWorkflow) {
        // Parse workflow data
        const workflowData: any = typeof activeWorkflow.workflowData === "string"
          ? JSON.parse(activeWorkflow.workflowData)
          : activeWorkflow.workflowData;

        if (workflowData.nodes && Array.isArray(workflowData.nodes)) {
          // Find matching trigger nodes (childButton or tagButton with matching tagId)
          const matchingTriggerNodes = workflowData.nodes.filter((node: any) => {
            if (node.type !== "childButton" && node.type !== "tagButton") {
              return false;
            }
            const nodeData = node.data || {};
            return nodeData.tagId === tagFlowId || nodeData.tagFlowId === tagFlowId;
          });

          console.log(`[LEAD TAG] Found ${matchingTriggerNodes.length} matching trigger nodes for tag ${tagFlowId}`);

          // Trigger workflow for each matching trigger node
          for (const triggerNode of matchingTriggerNodes) {
            try {
              await startWorkflowExecution({
                workflowId: activeWorkflow.id,
                leadId: id,
                triggerNodeId: triggerNode.id,
                userId,
                tagId: tagFlowId, // Pass tagId to workflow execution context
              });

              console.log(
                `[LEAD TAG] ✅ Triggered workflow ${activeWorkflow.id} for tag ${tagFlowId} on lead ${id}`
              );
            } catch (execError: any) {
              console.error(
                `[LEAD TAG] ❌ Error starting workflow execution for trigger node ${triggerNode.id}:`,
                execError
              );
              // Continue with other trigger nodes
            }
          }
        }
      }
    } catch (workflowError: any) {
      console.error("[LEAD TAG] Error triggering workflow:", workflowError);
      // Don't fail tag application if workflow trigger fails
    }

    res.status(201).json({ tagApplication });
  } catch (error: any) {
    console.error("Error applying tag to lead:", error);
    res.status(500).json({ error: error.message || "Failed to apply tag" });
  }
});

// Remove tag from lead
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
        entityType: "lead",
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

    // Create LeadActivity
    await prisma.leadActivity.create({
      data: {
        leadId: id,
        activityType: "tag_removed",
        title: `Removed tag: ${tagApplication.tagFlow.name}`,
        description: null,
        metadata: JSON.stringify({
          tagFlowId: tagApplication.tagFlowId,
          tagFlowName: tagApplication.tagFlow.name,
        }),
        createdById: userId,
      },
    });

    res.json({ message: "Tag removed successfully" });
  } catch (error: any) {
    console.error("Error removing tag from lead:", error);
    res.status(500).json({ error: error.message || "Failed to remove tag" });
  }
});

// Get all tags for a lead (optional: includeInactive=true for full history in Notes & Timeline)
router.get("/:id/tags", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const includeInactive = req.query.includeInactive === "true";

    if (!includeInactive) {
      await ensureNoAnswerCallbackScheduled(id);
    }

    const whereClause: { entityType: string; entityId: string; isActive?: boolean } = {
      entityType: "lead",
      entityId: id,
    };
    if (!includeInactive) {
      whereClause.isActive = true;
    }

    const tagApplications = await prisma.tagApplication.findMany({
      where: whereClause,
      select: {
        id: true,
        tagFlowId: true,
        note: true,
        callbackAt: true,
        followUpAt: true,
        createdAt: true,
        isActive: true,
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
    console.error("Error fetching tags for lead:", error);
    res.status(500).json({ error: error.message || "Failed to fetch tags" });
  }
});

/**
 * POST /api/leads/:id/schedule-callback
 * Backfill callbackAt for a lead that has "No Answer" tag but callback was not scheduled.
 */
router.post("/:id/schedule-callback", authenticate, authorize("ADMIN", "BRANCH_MANAGER", "TEAM_LEADER", "COUNSELOR", "TELECALLER"), async (req: AuthenticatedRequest, res) => {
  try {
    const { id: leadId } = req.params;
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }
    let callbackAtISO: string | null = await ensureNoAnswerCallbackScheduled(leadId);
    const noAnswerOr = [
      { tagFlow: { tagValue: "no_answer" } },
      { tagFlow: { name: { equals: "No Answer", mode: "insensitive" as const } } },
    ];
    let noAnswerNodeIds: string[] = [];
    const activeWf = await prisma.workflow.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    });
    if (activeWf) {
      const wfData: any = typeof activeWf.workflowData === "string" ? JSON.parse(activeWf.workflowData) : activeWf.workflowData;
      const nodes = wfData?.nodes || [];
      noAnswerNodeIds = nodes
        .filter(
          (n: any) =>
            (n.data?.tagValue || "").toLowerCase() === "no_answer" ||
            (n.label || n.data?.label || "").toLowerCase() === "no answer"
        )
        .map((n: any) => n.id || n.data?.id)
        .filter(Boolean);
    }
    const tagAppWhere =
      noAnswerNodeIds.length > 0
        ? { entityType: "lead" as const, entityId: leadId, isActive: true, OR: [...noAnswerOr, { tagFlowId: { in: noAnswerNodeIds } }] }
        : { entityType: "lead" as const, entityId: leadId, isActive: true, OR: noAnswerOr };
    const tagApp = await prisma.tagApplication.findFirst({
      where: tagAppWhere,
      select: { id: true, callbackAt: true, tagFlow: { select: { id: true, name: true, tagValue: true, color: true } } },
    });
    if (!callbackAtISO && tagApp?.callbackAt) {
      callbackAtISO = tagApp.callbackAt instanceof Date ? tagApp.callbackAt.toISOString() : String(tagApp.callbackAt);
    }
    if (!callbackAtISO) {
      return res.status(400).json({ error: "No unscheduled 'No Answer' tag found for this lead, or workflow/config missing." });
    }
    res.json({
      message: "Callback scheduled successfully",
      tagApplication: { ...tagApp, callbackAt: callbackAtISO },
    });
  } catch (error: any) {
    console.error("Error scheduling callback:", error);
    res.status(500).json({ error: "Internal server error", message: error.message });
  }
});

/**
 * POST /api/leads/:id/escalate
 * Escalate a lead to manager. Model B: escalation is auto-only (24h alert, 48h reassign).
 * Telecaller cannot manually escalate; only TL/BM/Admin may call this (e.g. for ad-hoc reassignment).
 */
router.post("/:id/escalate", authenticate, authorize("ADMIN", "BRANCH_MANAGER", "TEAM_LEADER"), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get lead
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        assignedTo: {
          include: {
            role: true,
            teamLeader: {
              include: {
                role: true,
              },
            },
          },
        },
      },
    });

    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    // Find manager (Team Leader or Branch Manager)
    let managerId: string | null = null;
    let managerRole: string | null = null;

    if (lead.assignedTo?.teamLeader) {
      // Escalate to team leader
      managerId = lead.assignedTo.teamLeader.id;
      managerRole = "TEAM_LEADER";
    } else {
      // Find branch manager
      const branchManager = await prisma.user.findFirst({
        where: {
          role: {
            name: "BRANCH_MANAGER",
          },
          isActive: true,
        },
      });
      if (branchManager) {
        managerId = branchManager.id;
        managerRole = "BRANCH_MANAGER";
      }
    }

    if (!managerId) {
      return res.status(404).json({ error: "No manager found to escalate to" });
    }

    // Reassign lead to manager
    await prisma.lead.update({
      where: { id },
      data: {
        assignedToId: managerId,
        previousAssignedToId: lead.assignedToId,
      },
    });

    // Create activity log
    await prisma.leadActivity.create({
      data: {
        leadId: id,
        activityType: "ESCALATED",
        title: "Lead Escalated",
        description: reason || `Lead escalated to ${managerRole} due to overdue callback`,
        createdById: userId,
      },
    });

    // Send WebSocket notification to manager
    try {
      const { getIO } = await import("../lib/socket");
      const io = getIO();
      if (io) {
        io.to(`user:${managerId}`).emit("lead:escalated", {
          leadId: id,
          leadName: `${lead.firstName} ${lead.lastName}`,
          escalatedBy: userId,
          reason: reason || "Overdue callback",
        });
      }
    } catch (wsError) {
      console.error("WebSocket notification error:", wsError);
    }

    res.json({
      message: "Lead escalated successfully",
      lead: {
        id: lead.id,
        assignedToId: managerId,
        managerRole,
      },
    });
  } catch (error: any) {
    console.error("Error escalating lead:", error);
    res.status(500).json({ error: "Internal server error", message: error.message });
  }
});

export default router;

