import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, authorize, AuthenticatedRequest } from "../middleware/roleAuth";

const router = Router();

// Debug endpoint to check current user's role
router.get("/debug-user", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    res.json({
      user: req.user,
      message: "Current user information",
      allowedRoles: ["ADMIN", "BRANCH_MANAGER"],
      hasAccess: req.user?.role === "ADMIN" || req.user?.role === "BRANCH_MANAGER"
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all active tag flows (for call status category)
router.get("/active", authenticate, async (req, res) => {
  try {
    const { category } = req.query;
    
    const where: any = {
      isActive: true,
    };
    
    if (category) {
      where.category = category;
    }
    
    const tagFlows = await prisma.tagFlow.findMany({
      where,
      orderBy: {
        name: "asc",
      },
    });

    console.log(`📋 Found ${tagFlows.length} active tag flows for category: ${category || "all"}`);
    res.json({ tagFlows });
  } catch (error: any) {
    console.error("Error fetching tag flows:", error);
    res.status(500).json({ error: error.message || "Failed to fetch tag flows" });
  }
});

// Get all tag flows (authenticated users can view)
router.get("/", authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const isAdmin = user?.role === "ADMIN";
    
    // Non-admin users can only see active tags
    const where: any = isAdmin ? {} : { isActive: true };
    
    const tagFlows = await prisma.tagFlow.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      include: {
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

    res.json({ tagFlows });
  } catch (error: any) {
    console.error("Error fetching tag flows:", error);
    res.status(500).json({ error: error.message || "Failed to fetch tag flows" });
  }
});

// Helper function to coerce boolean from string or boolean
const booleanCoerce = z.union([
  z.boolean(),
  z.string().transform((val) => val === "true" || val === "1"),
  z.number().transform((val) => val === 1),
]).default(false);

// Helper function to coerce number from string or number
const numberCoerce = z.union([
  z.number().int(),
  z.string().transform((val) => {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? 0 : parsed;
  }),
]).default(0);

// Helper function to handle nullable strings (empty string -> null)
const nullableString = z.preprocess(
  (val) => {
    if (val === "" || val === undefined || val === null) return null;
    return val;
  },
  z.string().nullable().optional()
);

// Action Rule validation schema (matching ActionRulesEditor.tsx and tagActionRunner.ts)
const actionTypeSchema = z.enum([
  "createTask",
  "sendEmail",
  "sendWhatsApp",
  "updateLeadStatus",
  "assignToUser",
  "createNotification",
  "escalate",
]);

const actionSchema = z.object({
  type: actionTypeSchema,
  params: z.record(z.any()), // Record<string, any>
});

const attemptSchema = z.object({
  attemptNumber: z.number().int().positive(),
  delayMinutes: z.number().int().nonnegative(),
  actions: z.array(actionSchema).min(1, "Each attempt must have at least one action"),
});

const finalAttemptSchema = z.object({
  delayMinutes: z.number().int().nonnegative(),
  actions: z.array(actionSchema).min(1, "Final attempt must have at least one action"),
});

const actionRuleSchema = z.object({
  attempts: z.array(attemptSchema).min(1, "At least one attempt is required"),
  finalAttempt: finalAttemptSchema.optional(),
});

/**
 * Validate action rule JSON string
 * @param actionsJson - JSON string or null
 * @returns Validated and parsed action rule object, or null if input is null/empty
 * @throws ZodError if validation fails
 */
function validateActionRule(actionsJson: string | null | undefined): string | null {
  // Allow null/empty (no actions)
  if (!actionsJson || actionsJson.trim() === "") {
    return null;
  }

  try {
    // Parse JSON string
    const parsed = JSON.parse(actionsJson);
    
    // Validate against schema
    const validated = actionRuleSchema.parse(parsed);
    
    // Re-stringify to ensure valid JSON format
    return JSON.stringify(validated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      // Format Zod validation errors for better readability
      const errorMessages = error.errors.map((err) => {
        const path = err.path.join(".");
        return `${path ? `${path}: ` : ""}${err.message}`;
      });
      throw new Error(`Invalid action rule structure: ${errorMessages.join("; ")}`);
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON format: ${error.message}`);
    }
    throw error;
  }
}

// Create tag flow (admin and branch manager only)
const createTagFlowSchema = z.object({
  name: z.string().min(1),
  description: nullableString,
  tagValue: z.string().min(1),
  icon: z.string().default("Tag"),
  color: z.string().default("#3B82F6"),
  category: z.enum(["call_status", "lead_status", "priority", "custom"]).default("call_status"),
  appliesTo: z.enum(["lead", "call", "task", "all"]).default("all"),
  isActive: booleanCoerce.default(true),
  isExclusive: booleanCoerce.default(false),
  requiresNote: booleanCoerce.default(false),
  requiresCallback: booleanCoerce.default(false),
  requiresFollowUp: booleanCoerce.default(false),
  actions: nullableString,
  escalations: nullableString,
  order: numberCoerce.default(0),
  parentId: nullableString,
  nextTagIds: nullableString,
});

router.post("/", authenticate, authorize("ADMIN", "BRANCH_MANAGER"), async (req: AuthenticatedRequest, res) => {
  try {
    console.log("[TagFlow Create] Received body:", JSON.stringify(req.body, null, 2));
    console.log("[TagFlow Create] Body types:", Object.keys(req.body).reduce((acc, key) => {
      acc[key] = { value: req.body[key], type: typeof req.body[key] };
      return acc;
    }, {} as Record<string, any>));
    
    // Validate action rule JSON if provided (Phase 2.3)
    let validatedActions: string | null = null;
    if (req.body.actions !== undefined && req.body.actions !== null && req.body.actions !== "") {
      try {
        validatedActions = validateActionRule(req.body.actions);
        console.log("[TagFlow Create] Action rule validated successfully");
      } catch (actionError: any) {
        console.error("[TagFlow Create] Action rule validation failed:", actionError.message);
        return res.status(400).json({
          error: "Action rule validation failed",
          message: actionError.message,
          field: "actions",
        });
      }
    }
    
    // Replace actions with validated version
    const bodyWithValidatedActions = {
      ...req.body,
      actions: validatedActions !== undefined ? validatedActions : req.body.actions,
    };
    
    const data = createTagFlowSchema.parse(bodyWithValidatedActions);
    console.log("[TagFlow Create] Parsed data:", JSON.stringify(data, null, 2));
    const userId = req.user?.userId;

    // Validate parentId if provided: must be a root tag (parentId === null) and same category
    if (data.parentId) {
      const parentTag = await prisma.tagFlow.findUnique({
        where: { id: data.parentId },
        select: { id: true, parentId: true, category: true },
      });

      if (!parentTag) {
        return res.status(400).json({ 
          error: "Validation error",
          message: "Parent tag not found" 
        });
      }

      if (parentTag.parentId !== null) {
        return res.status(400).json({ 
          error: "Validation error",
          message: "Parent tag must be a root tag (cannot have a parent itself)" 
        });
      }

      if (parentTag.category !== data.category) {
        return res.status(400).json({ 
          error: "Validation error",
          message: "Parent tag must be in the same category" 
        });
      }
    }

    // Check if tagValue already exists for this category
    const existing = await prisma.tagFlow.findFirst({
      where: {
        tagValue: data.tagValue,
        category: data.category,
      },
    });

    if (existing) {
      return res.status(400).json({ error: "Tag value already exists for this category" });
    }

    const tagFlow = await prisma.tagFlow.create({
      data: {
        ...data,
        createdById: userId,
      },
      include: {
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

    res.status(201).json({ tagFlow });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      console.error("[TagFlow Create] Validation error:", JSON.stringify(error.errors, null, 2));
      console.error("[TagFlow Create] Received body types:", Object.keys(req.body).reduce((acc, key) => {
        acc[key] = { value: req.body[key], type: typeof req.body[key] };
        return acc;
      }, {} as Record<string, any>));
      return res.status(400).json({ 
        error: "Validation error", 
        message: "Invalid data provided. Check details for specific field errors.",
        details: error.errors 
      });
    }
    console.error("Error creating tag flow:", error);
    res.status(500).json({ error: error.message || "Failed to create tag flow" });
  }
});

// Update tag flow (admin and branch manager only)
// More lenient schema for updates - allows partial updates and type coercion
const updateTagFlowSchema = z.object({
  name: z.string().min(1).optional(),
  description: nullableString,
  tagValue: z.string().min(1).optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  category: z.enum(["call_status", "lead_status", "priority", "custom"]).optional(),
  appliesTo: z.enum(["lead", "call", "task", "all"]).optional(),
  isActive: z.union([
    z.boolean(),
    z.string().transform((val) => val === "true" || val === "1"),
    z.number().transform((val) => val === 1),
  ]).optional(),
  isExclusive: z.union([
    z.boolean(),
    z.string().transform((val) => val === "true" || val === "1"),
    z.number().transform((val) => val === 1),
  ]).optional(),
  requiresNote: z.union([
    z.boolean(),
    z.string().transform((val) => val === "true" || val === "1"),
    z.number().transform((val) => val === 1),
  ]).optional(),
  requiresCallback: z.union([
    z.boolean(),
    z.string().transform((val) => val === "true" || val === "1"),
    z.number().transform((val) => val === 1),
  ]).optional(),
  requiresFollowUp: z.union([
    z.boolean(),
    z.string().transform((val) => val === "true" || val === "1"),
    z.number().transform((val) => val === 1),
  ]).optional(),
  actions: nullableString,
  escalations: nullableString,
  order: z.union([z.number().int(), z.string().transform((val) => parseInt(val, 10))]).optional(),
  parentId: nullableString,
  nextTagIds: nullableString,
});

router.put("/:id", authenticate, authorize("ADMIN", "BRANCH_MANAGER"), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    console.log("[TagFlow Update] Received data:", JSON.stringify(req.body, null, 2));
    
    // Validate action rule JSON if provided (Phase 2.3)
    let validatedActions: string | null = null;
    if (req.body.actions !== undefined) {
      try {
        validatedActions = validateActionRule(req.body.actions);
        console.log("[TagFlow Update] Action rule validated successfully");
      } catch (actionError: any) {
        console.error("[TagFlow Update] Action rule validation failed:", actionError.message);
        return res.status(400).json({
          error: "Action rule validation failed",
          message: actionError.message,
          field: "actions",
        });
      }
    }
    
    // Clean and normalize the data before validation
    const cleanedBody: any = {};
    if (req.body.name !== undefined) cleanedBody.name = req.body.name;
    if (req.body.description !== undefined) cleanedBody.description = req.body.description || null;
    if (req.body.tagValue !== undefined) cleanedBody.tagValue = req.body.tagValue;
    if (req.body.icon !== undefined) cleanedBody.icon = req.body.icon;
    if (req.body.color !== undefined) cleanedBody.color = req.body.color;
    if (req.body.category !== undefined) cleanedBody.category = req.body.category;
    if (req.body.isActive !== undefined) cleanedBody.isActive = req.body.isActive;
    if (req.body.isExclusive !== undefined) cleanedBody.isExclusive = req.body.isExclusive;
    if (req.body.requiresNote !== undefined) cleanedBody.requiresNote = req.body.requiresNote;
    if (req.body.requiresCallback !== undefined) cleanedBody.requiresCallback = req.body.requiresCallback;
    if (req.body.requiresFollowUp !== undefined) cleanedBody.requiresFollowUp = req.body.requiresFollowUp;
    // Use validated actions JSON
    if (req.body.actions !== undefined) cleanedBody.actions = validatedActions;
    if (req.body.escalations !== undefined) cleanedBody.escalations = req.body.escalations || null;
    if (req.body.order !== undefined) {
      // Convert order to number if it's a string
      cleanedBody.order = typeof req.body.order === 'string' ? parseInt(req.body.order, 10) : req.body.order;
    }
    if (req.body.parentId !== undefined) cleanedBody.parentId = req.body.parentId || null;
    if (req.body.nextTagIds !== undefined) cleanedBody.nextTagIds = req.body.nextTagIds || null;
    
    console.log("[TagFlow Update] Cleaned data:", JSON.stringify(cleanedBody, null, 2));
    const data = updateTagFlowSchema.parse(cleanedBody);
    console.log("[TagFlow Update] Parsed data:", JSON.stringify(data, null, 2));

    // Check if tagValue already exists for this category (if updating tagValue)
    if (data.tagValue) {
      const existing = await prisma.tagFlow.findFirst({
        where: {
          tagValue: data.tagValue,
          category: data.category || undefined,
          id: { not: id },
        },
      });

      if (existing) {
        return res.status(400).json({ error: "Tag value already exists for this category" });
      }
    }

    // Validate parentId if provided: must be a root tag (parentId === null) and same category
    if (data.parentId) {
      const parentTag = await prisma.tagFlow.findUnique({
        where: { id: data.parentId },
        select: { id: true, parentId: true, category: true },
      });

      if (!parentTag) {
        return res.status(400).json({ 
          error: "Validation error",
          message: "Parent tag not found" 
        });
      }

      if (parentTag.parentId !== null) {
        return res.status(400).json({ 
          error: "Validation error",
          message: "Parent tag must be a root tag (cannot have a parent itself)" 
        });
      }

      // Get current tag's category (use existing if not updating)
      const currentTag = await prisma.tagFlow.findUnique({
        where: { id },
        select: { category: true },
      });
      const tagCategory = data.category || currentTag?.category;

      if (parentTag.category !== tagCategory) {
        return res.status(400).json({ 
          error: "Validation error",
          message: "Parent tag must be in the same category" 
        });
      }
    }

    const tagFlow = await prisma.tagFlow.update({
      where: { id },
      data,
      include: {
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

    res.json({ tagFlow });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      console.error("[TagFlow Update] Validation error:", error.errors);
      return res.status(400).json({ 
        error: "Validation error", 
        message: "Invalid data provided",
        details: error.errors 
      });
    }
    console.error("Error updating tag flow:", error);
    res.status(500).json({ error: error.message || "Failed to update tag flow" });
  }
});

// Delete tag flow (admin and branch manager only)
router.delete("/:id", authenticate, authorize("ADMIN", "BRANCH_MANAGER"), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    // First, get the tag to check its name
    const tag = await prisma.tagFlow.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!tag) {
      return res.status(404).json({ error: "Tag not found" });
    }

    // Check if tag is being used in any tag applications
    const tagApplicationsCount = await prisma.tagApplication.count({
      where: { tagFlowId: id },
    });

    // Delete all related tag applications first (cascade delete)
    if (tagApplicationsCount > 0) {
      // First, delete all action instances for these tag applications
      const tagApplications = await prisma.tagApplication.findMany({
        where: { tagFlowId: id },
        select: { id: true },
      });

      const tagApplicationIds = tagApplications.map((app) => app.id);
      
      if (tagApplicationIds.length > 0) {
        // Delete action instances
        await prisma.tagActionInstance.deleteMany({
          where: { tagApplicationId: { in: tagApplicationIds } },
        });
        console.log(`[Tag Delete] Deleted action instances for ${tagApplicationIds.length} tag application(s)`);
      }

      // Delete all tag applications that reference this tag
      await prisma.tagApplication.deleteMany({
        where: { tagFlowId: id },
      });
      console.log(`[Tag Delete] Deleted ${tagApplicationsCount} tag application(s) for tag ${id}`);
    }

    // Delete LeadCurrentTagState records that reference this tag
    const leadTagStatesCount = await prisma.leadCurrentTagState.count({
      where: {
        OR: [
          { parentTagId: id },
          { childTagId: id },
        ],
      },
    });

    if (leadTagStatesCount > 0) {
      await prisma.leadCurrentTagState.deleteMany({
        where: {
          OR: [
            { parentTagId: id },
            { childTagId: id },
          ],
        },
      });
      console.log(`[Tag Delete] Deleted ${leadTagStatesCount} lead tag state record(s) for tag ${id}`);
    }

    // Delete TagActionInstance records that directly reference this tag
    const actionInstancesCount = await prisma.tagActionInstance.count({
      where: { tagFlowId: id },
    });

    if (actionInstancesCount > 0) {
      await prisma.tagActionInstance.deleteMany({
        where: { tagFlowId: id },
      });
      console.log(`[Tag Delete] Deleted ${actionInstancesCount} action instance(s) for tag ${id}`);
    }

    // Check if tag is being used in any workflows
    // We need to check the workflowData JSON for tagId or tagName references
    const allWorkflows = await prisma.workflow.findMany({
      select: {
        id: true,
        name: true,
        workflowData: true,
      },
    });

    const workflowsUsingTag = allWorkflows.filter((workflow) => {
      if (!workflow.workflowData || typeof workflow.workflowData !== "object") {
        return false;
      }

      const workflowData = workflow.workflowData as any;
      const nodes = workflowData.nodes || [];

      // Check if any node has tagId or tagName matching this tag
      return nodes.some((node: any) => {
        const nodeData = node.data || {};
        return nodeData.tagId === id || nodeData.tagName === tag.name;
      });
    });

    if (workflowsUsingTag.length > 0) {
      return res.status(400).json({
        error: `Cannot delete tag. It is currently being used in ${workflowsUsingTag.length} workflow(s). Please remove it from workflows first or deactivate the tag instead.`,
        workflowsCount: workflowsUsingTag.length,
      });
    }

    // Safe to delete - no dependencies
    await prisma.tagFlow.delete({
      where: { id },
    });

    res.json({ message: "Tag flow deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting tag flow:", error);
    
    // Handle foreign key constraint error specifically
    if (error.code === "P2003" || error.message?.includes("Foreign key constraint")) {
      return res.status(400).json({
        error: "Cannot delete tag. It is currently being used in the system. Please remove all references first or deactivate the tag instead.",
      });
    }

    res.status(500).json({ error: error.message || "Failed to delete tag flow" });
  }
});

// Increment usage count (when tag is used)
router.post("/:id/increment-usage", authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const tagFlow = await prisma.tagFlow.update({
      where: { id },
      data: {
        usageCount: {
          increment: 1,
        },
      },
    });

    res.json({ tagFlow });
  } catch (error: any) {
    console.error("Error incrementing usage count:", error);
    res.status(500).json({ error: error.message || "Failed to increment usage count" });
  }
});

export default router;

