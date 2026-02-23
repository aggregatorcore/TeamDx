import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, authorize, AuthenticatedRequest } from "../middleware/roleAuth";

const router = Router();

// Schema for workflow validation
const createWorkflowSchema = z.object({
  name: z.string().min(1, "Workflow name is required"),
  description: z.string().optional(),
  isActive: z.boolean().optional().default(false),
  roleId: z.string().optional().nullable(), // Role ID (null = all roles)
  workflowData: z.string().refine(
    (val) => {
      try {
        const parsed = JSON.parse(val);
        // Accept either the new structure (navigation, subButtons, tagGroups, tags)
        // or the old structure (nodes, edges) for backward compatibility
        const hasNewStructure = (
          (parsed.navigation !== undefined || parsed.controlButtons !== undefined) &&
          (parsed.subButtons !== undefined || Array.isArray(parsed.subButtons))
        );
        const hasOldStructure = (
          parsed.nodes && Array.isArray(parsed.nodes) &&
          parsed.edges && Array.isArray(parsed.edges)
        );
        return hasNewStructure || hasOldStructure;
      } catch {
        return false;
      }
    },
    { message: "Invalid workflow data format. Must contain navigation/controlButtons and subButtons, or nodes and edges." }
  ),
  version: z.number().optional().default(1),
});

const updateWorkflowSchema = createWorkflowSchema.partial();

// Get all workflows
router.get("/", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const workflows = await prisma.workflow.findMany({
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
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json({ workflows });
  } catch (error: any) {
    console.error("Error fetching workflows:", error);
    res.status(500).json({ error: error.message || "Failed to fetch workflows" });
  }
});

// Get active workflow (role-based)
router.get("/active", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    let userRoleId: string | null = null;

    // Get user's role if user is authenticated
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { roleId: true },
      });
      userRoleId = user?.roleId || null;
    }

    // Find active workflow for user's role, or global workflow (roleId = null)
    const workflow = await prisma.workflow.findFirst({
      where: {
        isActive: true,
        OR: [
          { roleId: userRoleId }, // Workflow for user's role
          { roleId: null }, // Global workflow (for all roles)
        ],
      },
      orderBy: [
        { roleId: "asc" }, // Prefer role-specific workflow over global
        { updatedAt: "desc" },
      ],
      include: {
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!workflow) {
      return res.json({ workflow: null });
    }

    res.json({ workflow });
  } catch (error: any) {
    console.error("Error fetching active workflow:", error);
    res.status(500).json({ error: error.message || "Failed to fetch active workflow" });
  }
});

// Get workflow by ID
router.get("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const workflow = await prisma.workflow.findUnique({
      where: { id },
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

    if (!workflow) {
      return res.status(404).json({ error: "Workflow not found" });
    }

    res.json({ workflow });
  } catch (error: any) {
    console.error("Error fetching workflow:", error);
    res.status(500).json({ error: error.message || "Failed to fetch workflow" });
  }
});

// Create workflow
router.post("/", authenticate, authorize("ADMIN", "BRANCH_MANAGER"), async (req: AuthenticatedRequest, res) => {
  try {
    const validated = createWorkflowSchema.parse(req.body);
    const userId = req.user?.id;

    const workflow = await prisma.workflow.create({
      data: {
        name: validated.name,
        description: validated.description,
        isActive: validated.isActive || false,
        roleId: validated.roleId || null,
        workflowData: validated.workflowData,
        version: validated.version || 1,
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
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.status(201).json({ workflow });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Error creating workflow:", error);
    res.status(500).json({ error: error.message || "Failed to create workflow" });
  }
});

// Update workflow
router.put("/:id", authenticate, authorize("ADMIN", "BRANCH_MANAGER"), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const validated = updateWorkflowSchema.parse(req.body);

    // Get current workflow to check version
    const currentWorkflow = await prisma.workflow.findUnique({
      where: { id },
      select: { version: true },
    });

    if (!currentWorkflow) {
      return res.status(404).json({ error: "Workflow not found" });
    }

    // Increment version if workflowData is being updated
    const updateData: any = {
      ...validated,
      updatedAt: new Date(),
    };

    // Increment version if workflowData is provided in update
    if (validated.workflowData !== undefined) {
      updateData.version = (currentWorkflow.version || 1) + 1;
    }

    const workflow = await prisma.workflow.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json({ workflow });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Error updating workflow:", error);
    res.status(500).json({ error: error.message || "Failed to update workflow" });
  }
});

// Activate workflow (deactivates all others)
router.post("/:id/activate", authenticate, authorize("ADMIN", "BRANCH_MANAGER"), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    // Deactivate all workflows
    await prisma.workflow.updateMany({
      where: {
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // Activate this workflow
    const workflow = await prisma.workflow.update({
      where: { id },
      data: {
        isActive: true,
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

    res.json({ workflow });
  } catch (error: any) {
    console.error("Error activating workflow:", error);
    res.status(500).json({ error: error.message || "Failed to activate workflow" });
  }
});

// Deactivate workflow (pause)
router.post("/:id/deactivate", authenticate, authorize("ADMIN", "BRANCH_MANAGER"), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    // Check if workflow exists
    const workflow = await prisma.workflow.findUnique({
      where: { id },
    });

    if (!workflow) {
      return res.status(404).json({ error: "Workflow not found" });
    }

    // Deactivate this workflow
    const updatedWorkflow = await prisma.workflow.update({
      where: { id },
      data: {
        isActive: false,
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

    res.json({ workflow: updatedWorkflow });
  } catch (error: any) {
    console.error("Error deactivating workflow:", error);
    res.status(500).json({ error: error.message || "Failed to deactivate workflow" });
  }
});

// Trigger workflow execution
router.post("/:id/execute", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { leadId, callId, triggerNodeId, tagId } = req.body;

    if (!triggerNodeId) {
      return res.status(400).json({ error: "triggerNodeId is required" });
    }

    const { startWorkflowExecution } = require("../services/workflowRunner");
    const execution = await startWorkflowExecution({
      workflowId: id,
      leadId,
      callId,
      triggerNodeId,
      tagId, // Pass tagId to workflow execution
      userId: req.user?.id,
    });

    res.status(201).json({ execution, executionId: execution.id });
  } catch (error: any) {
    console.error("Error triggering workflow execution:", error);
    res.status(500).json({ error: error.message || "Failed to trigger workflow execution" });
  }
});

// Delete workflow
router.delete("/:id", authenticate, authorize("ADMIN", "BRANCH_MANAGER"), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    // Check if workflow exists and is active
    const workflow = await prisma.workflow.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });

    if (!workflow) {
      return res.status(404).json({ error: "Workflow not found" });
    }

    if (workflow.isActive) {
      return res.status(400).json({ 
        error: "Cannot delete active workflow", 
        message: "Please deactivate the workflow before deleting it" 
      });
    }

    await prisma.workflow.delete({
      where: { id },
    });

    res.json({ message: "Workflow deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting workflow:", error);
    res.status(500).json({ error: error.message || "Failed to delete workflow" });
  }
});

// Debug: Get workflow data for a workflow
router.get("/:id/data", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const workflow = await prisma.workflow.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        isActive: true,
        workflowData: true,
      },
    });

    if (!workflow) {
      return res.status(404).json({ error: "Workflow not found" });
    }

    const workflowData = typeof workflow.workflowData === 'string'
      ? JSON.parse(workflow.workflowData)
      : workflow.workflowData;

    // Find action nodes
    const actionNodes = workflowData.nodes?.filter((node: any) => node.type === 'action') || [];
    
    res.json({
      workflow: {
        id: workflow.id,
        name: workflow.name,
        isActive: workflow.isActive,
      },
      actionNodes: actionNodes.map((node: any) => ({
        id: node.id,
        type: node.type,
        data: node.data,
        hasActionType: !!node.data?.actionType,
        hasActions: !!node.data?.actions,
        actionType: node.data?.actionType,
        dueInMinutes: node.data?.dueInMinutes,
        actions: node.data?.actions,
      })),
    });
  } catch (error: any) {
    console.error("Error fetching workflow data:", error);
    res.status(500).json({ error: error.message || "Failed to fetch workflow data" });
  }
});

// Get active actions for a lead
router.get("/lead/:leadId/actions", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { leadId } = req.params;
    const { tagId } = req.query; // Optional: filter by tagId

    console.log(`[WORKFLOW API] 🔍 Fetching actions for lead: ${leadId}${tagId ? `, tagId: ${tagId}` : ''}`);

    // First, check if there are ANY workflow executions for this lead
    const allExecutions = await prisma.workflowExecution.findMany({
      where: {
        leadId: leadId,
      },
      select: {
        id: true,
        status: true,
        startedAt: true,
        _count: {
          select: {
            actionExecutions: true,
          },
        },
      },
      orderBy: {
        startedAt: 'desc',
      },
      take: 10,
    });

    console.log(`[WORKFLOW API] 📊 Total executions found: ${allExecutions.length}`);
    allExecutions.forEach((exec, idx) => {
      console.log(`[WORKFLOW API]   Execution ${idx + 1}: ${exec.id}, status: ${exec.status}, actions: ${exec._count.actionExecutions}`);
    });

    // Get workflow executions for this lead (both active and recently completed)
    // If tagId is provided, filter to show only executions triggered by that tag
    const executions = await prisma.workflowExecution.findMany({
      where: {
        leadId: leadId,
        status: {
          in: ['in_progress', 'pending', 'completed'], // Include completed to show recent actions
        },
      },
      include: {
        actionExecutions: {
          // Show all actions (pending, sent, failed) from recent executions
          orderBy: {
            scheduledAt: 'desc',
          },
        },
      },
      orderBy: {
        startedAt: 'desc',
      },
      take: 10, // Get more executions to filter by tagId
    });

    // Filter executions by tagId if provided
    // Check executionData.context.tagId to match the tag that triggered the workflow
    let filteredExecutions = executions;
    if (tagId) {
      filteredExecutions = executions.filter(execution => {
        try {
          const executionData = execution.executionData ? JSON.parse(execution.executionData) : {};
          const executionTagId = executionData.context?.tagId;
          const matches = executionTagId === tagId;
          if (!matches) {
            console.log(`[WORKFLOW API] ⏭️  Skipping execution ${execution.id} (tagId: ${executionTagId}, expected: ${tagId})`);
          }
          return matches;
        } catch (e) {
          console.warn(`[WORKFLOW API] ⚠️  Error parsing executionData for ${execution.id}:`, e);
          return false;
        }
      });
      console.log(`[WORKFLOW API] 🔍 Filtered ${executions.length} executions to ${filteredExecutions.length} matching tagId ${tagId}`);
    }

    console.log(`[WORKFLOW API] ✅ Found ${filteredExecutions.length} executions with status in_progress/pending/completed${tagId ? ` for tagId ${tagId}` : ''}`);
    
    filteredExecutions.forEach((exec, idx) => {
      console.log(`[WORKFLOW API]   Execution ${idx + 1}: ${exec.id}, status: ${exec.status}, actionCount: ${exec.actionExecutions.length}`);
      exec.actionExecutions.forEach((action, aidx) => {
        console.log(`[WORKFLOW API]     Action ${aidx + 1}: ${action.id}, type: ${action.actionType}, status: ${action.status}`);
      });
    });

    // Format actions - show recent actions (within last 24 hours or pending/sent)
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const activeActions = filteredExecutions.flatMap(execution => 
      execution.actionExecutions
        .filter(action => {
          // Show if pending/sent, or if executed within last 24 hours
          const actionTime = action.executedAt || action.scheduledAt;
          const isRecent = actionTime && new Date(actionTime) > oneDayAgo;
          const shouldShow = action.status === 'pending' || action.status === 'sent' || isRecent;
          
          if (!shouldShow) {
            console.log(`[WORKFLOW API] ⏭️  Skipping action ${action.id} (status: ${action.status}, time: ${actionTime})`);
          }
          
          return shouldShow;
        })
        .map(action => ({
          id: action.id,
          actionType: action.actionType,
          status: action.status,
          scheduledAt: action.scheduledAt,
          executedAt: action.executedAt,
          resultData: action.resultData ? JSON.parse(action.resultData) : null,
          executionId: execution.id,
        }))
    );

    // Deduplicate: Group by actionType only (not executionId)
    // This prevents showing duplicate actions when tag is applied multiple times
    // For callback actions, show only the latest one
    const actionMap = new Map<string, any>();
    activeActions.forEach(action => {
      // Use only actionType as key to deduplicate same action types
      const key = action.actionType || 'unknown';
      const existing = actionMap.get(key);
      
      // Keep the latest action (by executedAt or scheduledAt)
      if (!existing) {
        actionMap.set(key, action);
      } else {
        const existingTime = existing.executedAt || existing.scheduledAt;
        const currentTime = action.executedAt || action.scheduledAt;
        if (currentTime && (!existingTime || new Date(currentTime) > new Date(existingTime))) {
          actionMap.set(key, action);
        } else if (!currentTime && existingTime) {
          // Keep existing if current has no time
          // Do nothing, keep existing
        } else {
          // Both have no time or same time, keep existing
          // Do nothing
        }
      }
    });

    // Convert map to array and sort by scheduledAt (most recent first)
    const deduplicatedActions = Array.from(actionMap.values());
    deduplicatedActions.sort((a, b) => {
      const timeA = new Date(a.executedAt || a.scheduledAt).getTime();
      const timeB = new Date(b.executedAt || b.scheduledAt).getTime();
      return timeB - timeA;
    });

    console.log(`[WORKFLOW API] 🔄 Deduplicated ${activeActions.length} actions to ${deduplicatedActions.length} unique actions`);

    // Limit to 5 most recent actions
    const recentActions = deduplicatedActions.slice(0, 5);

    console.log(`[WORKFLOW API] 📤 Returning ${recentActions.length} actions for lead ${leadId}`);
    if (recentActions.length > 0) {
      recentActions.forEach((action, idx) => {
        console.log(`[WORKFLOW API]   Action ${idx + 1}: ${action.actionType} (${action.status})`);
      });
    } else {
      console.log(`[WORKFLOW API] ⚠️  No actions to return - check if workflow is executing actions`);
    }

    res.json({ actions: recentActions });
  } catch (error: any) {
    console.error("[WORKFLOW API] ❌ Error fetching lead actions:", error);
    res.status(500).json({ error: error.message || "Failed to fetch lead actions" });
  }
});

export default router;
