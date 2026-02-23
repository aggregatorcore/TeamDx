import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, AuthenticatedRequest } from "../middleware/roleAuth";

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
 * Helper function to trigger workflow when tag is applied
 * Checks for active workflow with trigger node matching the tag
 */
async function triggerWorkflowForTag(
  tagFlowId: string,
  entityType: string,
  entityId: string,
  userId: string
): Promise<void> {
  try {
    // Get active workflow
    const activeWorkflow = await prisma.workflow.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    });

    if (!activeWorkflow) {
      return; // No active workflow, nothing to trigger
    }

    // Parse workflow data
    const workflowData: any = typeof activeWorkflow.workflowData === "string"
      ? JSON.parse(activeWorkflow.workflowData)
      : activeWorkflow.workflowData;

    if (!workflowData.nodes || !Array.isArray(workflowData.nodes)) {
      return; // Invalid workflow data
    }

    // Find trigger nodes that match this tag
    // Trigger nodes should have data.tagFlowId or data.tagValue matching the applied tag
    const tagFlow = await prisma.tagFlow.findUnique({
      where: { id: tagFlowId },
      select: { id: true, tagValue: true, name: true },
    });

    if (!tagFlow) {
      return;
    }

    // Find matching trigger nodes
    // Trigger nodes can be: "trigger", "childButton", or "tagButton"
    const matchingTriggerNodes = workflowData.nodes.filter((node: any) => {
      // Only check trigger node types
      if (node.type !== "trigger" && node.type !== "childButton" && node.type !== "tagButton") {
        return false;
      }

      const nodeData = node.data || {};
      // Match by tagFlowId, tagValue, or tagId
      return (
        nodeData.tagFlowId === tagFlowId ||
        nodeData.tagValue === tagFlow.tagValue ||
        nodeData.tagId === tagFlowId ||
        nodeData.tagName?.toLowerCase() === tagFlow.name?.toLowerCase()
      );
    });

    console.log(`[WORKFLOW TRIGGER] Looking for trigger nodes for tag ${tagFlowId} (${tagFlow.name}):`, {
      totalNodes: workflowData.nodes.length,
      triggerNodeTypes: workflowData.nodes.filter((n: any) =>
        n.type === "trigger" || n.type === "childButton" || n.type === "tagButton"
      ).map((n: any) => ({
        id: n.id,
        type: n.type,
        tagId: n.data?.tagId,
        tagName: n.data?.tagName,
        tagFlowId: n.data?.tagFlowId,
      })),
      matchingNodes: matchingTriggerNodes.length,
    });

    if (matchingTriggerNodes.length === 0) {
      return; // No matching trigger nodes
    }

    // Trigger workflow for each matching trigger node
    const { startWorkflowExecution } = require("../services/workflowRunner");

    for (const triggerNode of matchingTriggerNodes) {
      try {
        await startWorkflowExecution({
          workflowId: activeWorkflow.id,
          leadId: entityType === "lead" ? entityId : undefined,
          callId: entityType === "call" ? entityId : undefined,
          triggerNodeId: triggerNode.id,
          userId,
        });

        console.log(
          `[WORKFLOW TRIGGER] Triggered workflow ${activeWorkflow.id} for tag ${tagFlowId} on ${entityType} ${entityId}`
        );
      } catch (execError: any) {
        console.error(
          `[WORKFLOW TRIGGER] Error starting workflow execution for trigger node ${triggerNode.id}:`,
          execError
        );
        // Continue with other trigger nodes
      }
    }
  } catch (error: any) {
    console.error("[WORKFLOW TRIGGER] Error in triggerWorkflowForTag:", error);
    // Don't throw - workflow trigger failure shouldn't break tag application
  }
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

/**
 * Execute tagConfig behaviors from workflow data
 * Handles auto callback creation, bucket assignment, retry scheduling for NO ANSWER tag
 */
async function executeTagConfigBehaviors(
  tagFlowId: string,
  leadId: string,
  tagApplicationId: string,
  callbackAt: Date | null,
  userId: string
): Promise<void> {
  // Import shift utilities
  const { calculateShiftAwareCallback, getDefaultTelecallerShift } = require("../../../utils/shiftUtils");
  try {
    // Get active workflow
    const activeWorkflow = await prisma.workflow.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    });

    if (!activeWorkflow) {
      console.warn(`[TagConfig] ⚠️ No active workflow found. Cannot set callbackAt automatically.`);
      // FIX-2: No Answer must still get callbackAt (default 60m) when no workflow
      const tagFlowForNoAnswer = await prisma.tagFlow.findUnique({
        where: { id: tagFlowId },
        select: { tagValue: true, name: true },
      });
      const isNoAnswerTag =
        tagFlowForNoAnswer?.tagValue === "no_answer" ||
        tagFlowForNoAnswer?.name?.toLowerCase() === "no answer";
      if (isNoAnswerTag) {
        const { ensureNoAnswerCallbackScheduled } = require("../services/noAnswerCallbackService");
        await ensureNoAnswerCallbackScheduled(leadId);
      }
      return;
    }

    console.log(`[TagConfig] ✅ Active workflow found: ${activeWorkflow.id} (${activeWorkflow.name})`);

    // Parse workflow data
    const workflowData: any = typeof activeWorkflow.workflowData === "string"
      ? JSON.parse(activeWorkflow.workflowData)
      : activeWorkflow.workflowData;

    // Get tagFlow to find by tagValue
    const tagFlow = await prisma.tagFlow.findUnique({
      where: { id: tagFlowId },
      select: { id: true, tagValue: true, name: true },
    });

    // DEBUG LOG-1: TagFlow resolved
    console.log(`[TagConfig] 🔍 LOG-1: TAGFLOW`, {
      tagFlowId: tagFlowId,
      tagValue: tagFlow?.tagValue || "NOT FOUND",
      name: tagFlow?.name || "NOT FOUND",
      found: !!tagFlow,
    });

    // Find tag in workflow data (check tags object and tagGroups)
    let tagConfig: any = null;

    // Check in tags object
    if (workflowData.tags) {
      const tag = Object.values(workflowData.tags).find((t: any) =>
        t.id === tagFlowId ||
        t.tagKey === tagFlowId ||
        t.tagValue === tagFlow?.tagValue ||
        t.name?.toLowerCase() === tagFlow?.name?.toLowerCase() ||
        t.name?.toLowerCase() === "no answer" ||
        t.name?.toLowerCase() === "wrong number"
      ) as any;
      if (tag && tag.tagConfig) {
        tagConfig = tag.tagConfig;
        console.log(`[TagConfig] Found tagConfig in workflowData.tags for tag ${tagFlowId}`);
      }
    }

    // Check in tagGroups if not found
    if (!tagConfig && workflowData.tagGroups) {
      const allTags = [
        ...(workflowData.tagGroups.connected || []),
        ...(workflowData.tagGroups.notConnected || []),
      ];
      const tag = allTags.find((t: any) =>
        t.id === tagFlowId ||
        t.tagKey === tagFlowId ||
        t.tagValue === tagFlow?.tagValue ||
        t.name?.toLowerCase() === tagFlow?.name?.toLowerCase() ||
        t.name?.toLowerCase() === "no answer" ||
        t.name?.toLowerCase() === "wrong number"
      ) as any;
      if (tag && tag.tagConfig) {
        tagConfig = tag.tagConfig;
        console.log(`[TagConfig] Found tagConfig in workflowData.tagGroups for tag ${tagFlowId}`);
      }
    }

    // Check in workflow nodes (React Flow format)
    if (!tagConfig && workflowData.nodes && Array.isArray(workflowData.nodes)) {
      const tagNode = workflowData.nodes.find(
        (n: any) =>
          n.data?.tagValue === tagFlow?.tagValue ||
          n.data?.id === tagFlowId ||
          (n.label || n.data?.label || "").toLowerCase() === "no answer" ||
          (n.label || n.data?.label || "").toLowerCase() === "wrong number" ||
          (tagFlow?.name && (n.label || n.data?.label || "").toLowerCase() === tagFlow.name.toLowerCase())
      );
      if (tagNode?.data?.tagConfig) {
        tagConfig = tagNode.data.tagConfig;
        console.log(`[TagConfig] Found tagConfig in workflowData.nodes for tag ${tagFlowId}`);
      }
    }

    const isNoAnswer = tagFlow?.tagValue === "no_answer" || (tagFlow?.name?.toLowerCase() === "no answer");
    const isWrongNumber = tagFlow?.tagValue === "wrong_number" || (tagFlow?.name?.toLowerCase() === "wrong number");
    if (!tagConfig) {
      console.warn(`[TagConfig] No tagConfig found for tag ${tagFlowId} (${tagFlow?.name || "unknown"}) in workflow ${activeWorkflow?.id}`);
      console.log(`[TagConfig] Workflow data structure:`, {
        hasTags: !!workflowData.tags,
        hasTagGroups: !!workflowData.tagGroups,
        hasNodes: !!(workflowData.nodes && workflowData.nodes.length),
        tagsKeys: workflowData.tags ? Object.keys(workflowData.tags) : [],
        tagGroupsConnected: workflowData.tagGroups?.connected?.length || 0,
        tagGroupsNotConnected: workflowData.tagGroups?.notConnected?.length || 0,
      });

      // FIX-2: No Answer scheduling MUST NOT depend on TagConfig presence — use default timings
      if (isNoAnswer && activeWorkflow) {
        tagConfig = {
          autoAction: "CALLBACK",
          retryPolicy: {
            attemptTimings: [
              { timing: "60m" },
              { timing: "next_day" },
              { timing: "48h" },
            ],
          },
        };
        console.log(`[TagConfig] ✅ Using default no_answer timings (60m, next_day, 48h) — workflow config missing`);
      } else if (isWrongNumber && activeWorkflow) {
        tagConfig = {
          autoAction: "CLOSE",
          closeReason: "WRONG_NUMBER",
          exhaustPolicy: {
            markExhausted: true,
            exhaustReason: "WRONG_NUMBER",
            seniorNotify: true,
          },
        };
        console.log(`[TagConfig] ✅ Using default wrong_number CLOSE + exhaust — workflow config missing`);
      } else {
        // DEBUG LOG-2: TagConfig NOT found (non–no_answer / non–wrong_number tag)
        console.log(`[TagConfig] 🔍 LOG-2: TAGCONFIG`, {
          found: false,
          tagFlowId: tagFlowId,
          tagValue: tagFlow?.tagValue,
          workflowId: activeWorkflow?.id,
        });
        return; // No tagConfig found for this tag (and not no_answer / wrong_number)
      }
    }

    // DEBUG LOG-2: TagConfig resolved
    console.log(`[TagConfig] 🔍 LOG-2: TAGCONFIG`, {
      found: true,
      autoAction: tagConfig.autoAction,
      hasRetryPolicy: !!tagConfig.retryPolicy,
      retryPolicyMaxAttempts: tagConfig.retryPolicy?.maxAttempts,
      hasAttemptTimings: !!tagConfig.retryPolicy?.attemptTimings,
      attemptTimingsType: typeof tagConfig.retryPolicy?.attemptTimings,
      attemptTimingsKeys: tagConfig.retryPolicy?.attemptTimings ? Object.keys(tagConfig.retryPolicy.attemptTimings) : [],
    });

    console.log(`[TagConfig] ✅ Found tagConfig for tag ${tagFlowId} on lead ${leadId}:`, {
      autoAction: tagConfig.autoAction,
      bucketBehavior: tagConfig.bucketBehavior,
      retryPolicy: tagConfig.retryPolicy,
      hasRetryPolicy: !!tagConfig.retryPolicy,
      hasAttemptTimings: !!tagConfig.retryPolicy?.attemptTimings,
    });

    // 1. Auto Action: Create callback if autoAction is "CALLBACK"
    // IMPORTANT: This should work for ALL attempts (1, 2, 3), not just first attempt
    console.log(`[TagConfig] Checking autoAction:`, {
      autoAction: tagConfig.autoAction,
      callbackAtProvided: !!callbackAt,
      willCreateCallback: tagConfig.autoAction === "CALLBACK" && !callbackAt,
    });

    if (tagConfig.autoAction === "CALLBACK" && !callbackAt) {
      // Get existing tag applications to determine which attempt this is
      // NOTE: The current tagApplication should already be in the database at this point
      const existingApplications = await prisma.tagApplication.findMany({
        where: {
          entityType: "lead",
          entityId: leadId,
          tagFlowId: tagFlowId,
          isActive: true,
        },
        orderBy: { createdAt: "asc" },
      });

      // Verify the current tagApplication is included in the query
      const currentTagIncluded = existingApplications.some(ta => ta.id === tagApplicationId);
      if (!currentTagIncluded) {
        console.warn(`[TagConfig] ⚠️ Current tagApplication ${tagApplicationId} not found in query results. Adding it manually.`);
        // This shouldn't happen, but if it does, we'll use the count + 1
      }

      // Count attempts (including the current one being created)
      const attemptCount = existingApplications.length;
      const attemptIndex = attemptCount - 1; // 0-based index (0 = first attempt, 1 = second, etc.)

      console.log(`[TagConfig] 📊 Attempt calculation:`, {
        existingApplicationsCount: existingApplications.length,
        attemptCount: attemptCount,
        attemptIndex: attemptIndex,
        currentTagIncluded: currentTagIncluded,
        currentTagApplicationId: tagApplicationId,
        existingTagIds: existingApplications.map(ta => ta.id),
      });

      // Get user's shift configuration
      let shiftConfig = getDefaultTelecallerShift();
      let shiftSource = "default";
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: { role: true },
        });

        if (user) {
          // Try to get user-specific shift config
          const userShiftConfig = await prisma.shiftConfig.findFirst({
            where: {
              userId: user.id,
              isActive: true,
            },
          });

          if (userShiftConfig) {
            shiftConfig = {
              shiftStart: userShiftConfig.shiftStart,
              shiftEnd: userShiftConfig.shiftEnd,
            };
            shiftSource = "user";
          } else if (user.role) {
            // Fall back to role-based shift config
            const roleShiftConfig = await prisma.shiftConfig.findFirst({
              where: {
                roleId: user.role.id,
                userId: null,
                isActive: true,
              },
            });

            if (roleShiftConfig) {
              shiftConfig = {
                shiftStart: roleShiftConfig.shiftStart,
                shiftEnd: roleShiftConfig.shiftEnd,
              };
              shiftSource = "role";
            }
          }
        }
      } catch (shiftError) {
        console.warn(`[TagConfig] Failed to fetch shift config for user ${userId}, using default:`, shiftError);
      }

      // DEBUG LOG-3: Shift resolved
      console.log(`[TagConfig] 🔍 LOG-3: SHIFT`, {
        shiftStart: shiftConfig.shiftStart,
        shiftEnd: shiftConfig.shiftEnd,
        source: shiftSource,
        userId: userId,
      });

      // Calculate callback time based on retry policy (for current attempt)
      const retryPolicy = tagConfig.retryPolicy;

      // Handle both array and object formats for attemptTimings
      let attemptTimings = null;
      if (retryPolicy && retryPolicy.attemptTimings) {
        if (Array.isArray(retryPolicy.attemptTimings)) {
          attemptTimings = retryPolicy.attemptTimings;
        } else if (typeof retryPolicy.attemptTimings === 'object') {
          // Convert object format to array (e.g., {"0": {...}, "1": {...}, "attempt1": "+60m"})
          // Priority: numeric keys first, then string keys like "attempt1", "attempt2", "attempt3"
          const numericKeys = Object.keys(retryPolicy.attemptTimings)
            .filter(key => !isNaN(parseInt(key)))
            .sort((a, b) => parseInt(a) - parseInt(b));

          const stringKeys = Object.keys(retryPolicy.attemptTimings)
            .filter(key => key.startsWith("attempt") && !isNaN(parseInt(key.replace("attempt", ""))))
            .sort((a, b) => parseInt(a.replace("attempt", "")) - parseInt(b.replace("attempt", "")));

          if (numericKeys.length > 0) {
            // Use numeric keys (preferred format: {"0": {...}, "1": {...}})
            attemptTimings = numericKeys.map(key => {
              const value = retryPolicy.attemptTimings[key];
              // If value is an object with timing, use it; if it's a string, wrap it
              if (typeof value === 'object' && value.timing) {
                return value;
              } else if (typeof value === 'string') {
                return { timing: value };
              }
              return value;
            });
          } else if (stringKeys.length > 0) {
            // Fallback to string keys ({"attempt1": "+60m", "attempt2": "next_day"})
            attemptTimings = stringKeys.map(key => {
              const value = retryPolicy.attemptTimings[key];
              return typeof value === 'string' ? { timing: value } : value;
            });
          } else {
            // Last resort: use all keys (might have mixed format)
            attemptTimings = Object.keys(retryPolicy.attemptTimings)
              .filter(key => !key.startsWith("attempt") || !isNaN(parseInt(key.replace("attempt", ""))))
              .sort((a, b) => {
                const aNum = parseInt(a) || parseInt(a.replace("attempt", "")) || 999;
                const bNum = parseInt(b) || parseInt(b.replace("attempt", "")) || 999;
                return aNum - bNum;
              })
              .map(key => {
                const value = retryPolicy.attemptTimings[key];
                return typeof value === 'string' ? { timing: value } : value;
              });
          }

          console.log(`[TagConfig] 🔧 Parsed attemptTimings from object:`, {
            numericKeys: numericKeys.length,
            stringKeys: stringKeys.length,
            totalAttempts: attemptTimings.length,
            attemptTimings: attemptTimings,
          });
        }
      }

      if (attemptTimings && attemptTimings.length > 0) {
        // Use the timing for the current attempt (attemptIndex)
        let attemptTiming = attemptTimings[Math.min(attemptIndex, attemptTimings.length - 1)];
        // 1/3 must always be 60m (then snap to shift if outside shift)
        if (attemptIndex === 0 && attemptTiming?.timing !== "+60m" && attemptTiming?.timing !== "60m") {
          attemptTiming = { timing: "+60m" };
        }
        // 2/3 must always be next day (shift start)
        if (attemptIndex === 1 && attemptTiming?.timing !== "next_day" && attemptTiming?.timing !== "next_day_shift_start") {
          attemptTiming = { timing: "next_day" };
        }

        console.log(`[TagConfig] 📋 Attempt ${attemptCount} config:`, {
          attemptIndex: attemptIndex,
          attemptTiming: attemptTiming,
          timing: attemptTiming.timing,
          shiftConfig: shiftConfig,
          totalAttemptTimings: attemptTimings.length,
        });

        if (!attemptTiming || !attemptTiming.timing) {
          console.error(`[TagConfig] ❌ CRITICAL: attemptTiming is invalid:`, attemptTiming);
          return;
        }

        const baseTime = new Date();

        // Use shift-aware callback calculation
        const callbackTime = calculateShiftAwareCallback(
          baseTime,
          attemptTiming.timing,
          shiftConfig.shiftStart,
          shiftConfig.shiftEnd
        );

        // DEBUG LOG-4: CallbackAt computed
        console.log(`[TagConfig] 🔍 LOG-4: CALLBACK_CALC`, {
          attemptCount: attemptCount,
          attemptIndex: attemptIndex,
          attemptTiming: attemptTiming.timing,
          baseTime: baseTime.toISOString(),
          callbackAt: callbackTime ? callbackTime.toISOString() : "NULL",
          callbackAtIsNull: !callbackTime,
          tagApplicationId: tagApplicationId,
        });

        if (!callbackTime) {
          console.error(`[TagConfig] ❌ CRITICAL: calculateShiftAwareCallback returned NULL!`, {
            baseTime: baseTime.toISOString(),
            timing: attemptTiming.timing,
            shiftStart: shiftConfig.shiftStart,
            shiftEnd: shiftConfig.shiftEnd,
          });
          return; // Cannot proceed without callbackTime
        }

        console.log(`[TagConfig] ⏰ Calculated callback time for attempt ${attemptCount}:`, {
          baseTime: baseTime.toISOString(),
          callbackTime: callbackTime.toISOString(),
          tagApplicationId: tagApplicationId,
        });

        // B) Stagger + retry on unique constraint; D) Shift end protection
        const { allocateAndUpdateCallbackAt } = require("../utils/callbackSlotScheduler");
        const slotTime = await allocateAndUpdateCallbackAt(prisma, {
          tagApplicationId,
          leadId,
          appliedById: userId,
          baseTime: callbackTime,
          slotSizeMinutes: 2,
          shiftStart: shiftConfig.shiftStart,
          shiftEnd: shiftConfig.shiftEnd,
        });
        if (slotTime.getTime() !== callbackTime.getTime()) {
          console.log(`[TagConfig] 📅 Staggered slot: ${callbackTime.toISOString()} → ${slotTime.toISOString()}`);
        }
        console.log(`[TagConfig] ✅✅✅ SUCCESS: Auto-created shift-aware callback for attempt ${attemptCount} on lead ${leadId} at ${slotTime.toISOString()} (shift: ${shiftConfig.shiftStart}-${shiftConfig.shiftEnd})`);
      } else {
        console.error(`[TagConfig] ❌ CRITICAL: No attemptTimings found or empty array!`, {
          hasRetryPolicy: !!retryPolicy,
          hasAttemptTimings: !!retryPolicy?.attemptTimings,
          attemptTimingsType: typeof retryPolicy?.attemptTimings,
          attemptTimingsLength: attemptTimings?.length,
          retryPolicy: JSON.stringify(retryPolicy, null, 2),
        });
      }
    }

    // 1b. Auto Action: CLOSE + exhaust (e.g. Wrong Number) — stop callbacks, mark exhausted, senior bucket
    const exhaustPolicy = tagConfig.exhaustPolicy;
    if (tagConfig.autoAction === "CLOSE" && (exhaustPolicy?.markExhausted !== false)) {
      const now = new Date();
      const exhaustReason = exhaustPolicy?.exhaustReason || tagConfig.closeReason || "WRONG_NUMBER";

      // Idempotent notify: do not spam seniors if lead already exhausted with this reason
      const existingLead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { isExhausted: true, exhaustReason: true },
      });
      const alreadyExhaustedWrongNumber =
        existingLead?.isExhausted === true && existingLead?.exhaustReason === "WRONG_NUMBER";

      // Resolve no_answer tagFlowIds from workflow to deactivate
      let noAnswerTagFlowIds: string[] = [];
      if (workflowData.nodes && Array.isArray(workflowData.nodes)) {
        noAnswerTagFlowIds = (workflowData.nodes as any[])
          .filter(
            (n: any) =>
              (n.data?.tagValue || "").toLowerCase() === "no_answer" ||
              (n.label || n.data?.label || "").toLowerCase() === "no answer"
          )
          .map((n: any) => n.id || n.data?.id)
          .filter(Boolean);
      }
      const noAnswerFlowRecords = await prisma.tagFlow.findMany({
        where: {
          OR: [
            { tagValue: { equals: "no_answer", mode: "insensitive" } },
            { name: { equals: "No Answer", mode: "insensitive" } },
          ],
        },
        select: { id: true },
      });
      const allNoAnswerIds = [...new Set([...noAnswerTagFlowIds, ...noAnswerFlowRecords.map((f) => f.id)])];

      if (allNoAnswerIds.length > 0) {
        await prisma.tagApplication.updateMany({
          where: {
            entityType: "lead",
            entityId: leadId,
            tagFlowId: { in: allNoAnswerIds },
            isActive: true,
          },
          data: { isActive: false },
        });
      }

      await prisma.lead.update({
        where: { id: leadId },
        data: {
          callbackScheduledAt: null,
          callStatus: exhaustReason === "WRONG_NUMBER" ? "WRONG_NUMBER" : (tagFlow?.tagValue || "wrong_number"),
          status: tagConfig.closeLeadStatus === "lost" ? "lost" : undefined,
          isExhausted: true,
          exhaustedAt: now,
          exhaustReason,
        },
      });

      await prisma.leadActivity.create({
        data: {
          leadId,
          activityType: "WRONG_NUMBER_MARKED",
          title: "Wrong Number",
          description: `Lead marked as wrong number. Reason: ${exhaustReason}. Moved to Exhaust bucket for senior review.`,
          createdById: userId,
        },
      });
      await prisma.leadActivity.create({
        data: {
          leadId,
          activityType: "EXHAUSTED",
          title: "Exhausted (Wrong Number)",
          description: `Exhaust reason: ${exhaustReason}. Requires senior action (Verify & Close / Edit number & Reopen / Reassign).`,
          createdById: userId,
        },
      });

      if (exhaustPolicy?.seniorNotify !== false && !alreadyExhaustedWrongNumber) {
        try {
          const seniorUsers = await prisma.user.findMany({
            where: {
              isActive: true,
              role: { name: { in: ["TEAM_LEADER", "BRANCH_MANAGER", "ADMIN"] } },
            },
            select: { id: true },
          });
          const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            select: { firstName: true, lastName: true, phone: true },
          });
          const { getIO } = await import("../lib/socket");
          const io = getIO();
          if (io && lead) {
            const payload = {
              leadId,
              leadName: `${lead.firstName} ${lead.lastName}`,
              phone: lead.phone,
              exhaustedBy: userId,
              reason: exhaustReason,
            };
            for (const u of seniorUsers) {
              io.to(`user:${u.id}`).emit("lead:exhausted", payload);
            }
          }
        } catch (notifyErr) {
          // non-fatal
        }
      }
      console.log(`[TagConfig] ✅ CLOSE + exhaust applied for lead ${leadId}, reason=${exhaustReason}`);
    }

    // 2. Bucket Behavior: Note that bucket assignment is handled client-side based on callbackAt
    // The bucket system already calculates buckets based on callbackAt, so no backend action needed here
    // But we can log it for debugging
    if (tagConfig.bucketBehavior) {
      console.log(`[TagConfig] Bucket behavior configured:`, tagConfig.bucketBehavior);
    }

    // 3. Retry Policy: Track retry attempts and schedule next retry
    if (tagConfig.retryPolicy) {
      // Get existing tag applications for this lead to count attempts
      const existingApplications = await prisma.tagApplication.findMany({
        where: {
          entityType: "lead",
          entityId: leadId,
          tagFlowId: tagFlowId,
          isActive: true,
        },
        orderBy: { createdAt: "desc" },
      });

      // Count attempts from tag history (attemptCountSource: "tagHistory")
      const attemptCount = existingApplications.length;
      const maxAttempts = tagConfig.retryPolicy.maxAttempts || 3;

      // Handle both array and object formats for attemptTimings
      let attemptTimings = null;
      if (tagConfig.retryPolicy.attemptTimings) {
        if (Array.isArray(tagConfig.retryPolicy.attemptTimings)) {
          attemptTimings = tagConfig.retryPolicy.attemptTimings;
        } else if (typeof tagConfig.retryPolicy.attemptTimings === 'object') {
          // Convert object format to array (e.g., {"0": {...}, "1": {...}, "attempt1": "+60m"})
          // Priority: numeric keys first, then string keys like "attempt1", "attempt2", "attempt3"
          const numericKeys = Object.keys(tagConfig.retryPolicy.attemptTimings)
            .filter(key => !isNaN(parseInt(key)))
            .sort((a, b) => parseInt(a) - parseInt(b));

          const stringKeys = Object.keys(tagConfig.retryPolicy.attemptTimings)
            .filter(key => key.startsWith("attempt") && !isNaN(parseInt(key.replace("attempt", ""))))
            .sort((a, b) => parseInt(a.replace("attempt", "")) - parseInt(b.replace("attempt", "")));

          if (numericKeys.length > 0) {
            // Use numeric keys (preferred format: {"0": {...}, "1": {...}})
            attemptTimings = numericKeys.map(key => {
              const value = tagConfig.retryPolicy.attemptTimings[key];
              // If value is an object with timing, use it; if it's a string, wrap it
              if (typeof value === 'object' && value.timing) {
                return value;
              } else if (typeof value === 'string') {
                return { timing: value };
              }
              return value;
            });
          } else if (stringKeys.length > 0) {
            // Fallback to string keys ({"attempt1": "+60m", "attempt2": "next_day"})
            attemptTimings = stringKeys.map(key => {
              const value = tagConfig.retryPolicy.attemptTimings[key];
              return typeof value === 'string' ? { timing: value } : value;
            });
          } else {
            // Last resort: use all keys (might have mixed format)
            attemptTimings = Object.keys(tagConfig.retryPolicy.attemptTimings)
              .filter(key => !key.startsWith("attempt") || !isNaN(parseInt(key.replace("attempt", ""))))
              .sort((a, b) => {
                const aNum = parseInt(a) || parseInt(a.replace("attempt", "")) || 999;
                const bNum = parseInt(b) || parseInt(b.replace("attempt", "")) || 999;
                return aNum - bNum;
              })
              .map(key => {
                const value = tagConfig.retryPolicy.attemptTimings[key];
                return typeof value === 'string' ? { timing: value } : value;
              });
          }

          console.log(`[TagConfig] 🔧 Parsed attemptTimings from object:`, {
            numericKeys: numericKeys.length,
            stringKeys: stringKeys.length,
            totalAttempts: attemptTimings.length,
            attemptTimings: attemptTimings,
          });
        }
      }

      // If we haven't reached max attempts, schedule next retry
      if (attemptCount < maxAttempts && attemptTimings && attemptTimings.length > 0) {
        const nextAttemptIndex = attemptCount; // 0-indexed (first attempt is index 0)
        if (nextAttemptIndex < attemptTimings.length) {
          const nextAttempt = attemptTimings[nextAttemptIndex];
          let nextCallbackTime = new Date();

          // Parse timing string
          if (nextAttempt.timing.startsWith("+")) {
            const match = nextAttempt.timing.match(/\+(\d+)([mhd])/);
            if (match) {
              const value = parseInt(match[1]);
              const unit = match[2];
              if (unit === "m") {
                nextCallbackTime = new Date(nextCallbackTime.getTime() + value * 60 * 1000);
              } else if (unit === "h") {
                nextCallbackTime = new Date(nextCallbackTime.getTime() + value * 60 * 60 * 1000);
              } else if (unit === "d") {
                nextCallbackTime = new Date(nextCallbackTime.getTime() + value * 24 * 60 * 60 * 1000);
              }
            }
          } else if (nextAttempt.timing === "next_day") {
            nextCallbackTime = new Date(nextCallbackTime);
            nextCallbackTime.setDate(nextCallbackTime.getDate() + 1);
            nextCallbackTime.setHours(9, 0, 0, 0);
          }

          console.log(`[TagConfig] Scheduled retry attempt ${attemptCount + 1}/${maxAttempts} for lead ${leadId} at ${nextCallbackTime.toISOString()}`);

          // Note: The next retry will be created when this callback is executed
          // For now, we just log it. In a production system, you'd create a scheduled job
        }
      }

      console.log(`[TagConfig] Retry policy configured:`, {
        attemptCount,
        maxAttempts,
        retryPolicy: tagConfig.retryPolicy,
      });
    }

  } catch (error: any) {
    console.error(`[TagConfig] ❌ CRITICAL ERROR executing behaviors for tag ${tagFlowId}:`, error);
    console.error(`[TagConfig] Error stack:`, error?.stack);
    console.error(`[TagConfig] This error prevented callbackAt from being set!`);
    // Don't fail tag application if behavior execution fails, but log it clearly
  }
}

// All routes require authentication
router.use(authenticate);

// Schema for applying a tag
const applyTagSchema = z.object({
  tagFlowId: z.string().min(1, "Tag flow ID is required"),
  parentId: z.string().optional().nullable(), // Optional parent tag application ID
  note: z.string().optional().nullable(), // Required if tag.requiresNote = true
  callbackAt: z.string().optional().nullable(), // Required if tag.requiresCallback = true (ISO date string)
  followUpAt: z.string().optional().nullable(), // Required if tag.requiresFollowUp = true (ISO date string)
});

/**
 * Apply tag to an entity (lead, call, or task)
 * This is a generic endpoint that can be used for any entity type
 */
router.post("/:entityType/:entityId", async (req: AuthenticatedRequest, res) => {
  try {
    const { entityType, entityId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Validate entity type
    if (!["lead", "call", "task"].includes(entityType)) {
      return res.status(400).json({ error: "Invalid entity type. Must be 'lead', 'call', or 'task'" });
    }

    // Validate request body
    const data = applyTagSchema.parse(req.body);
    const { tagFlowId, parentId, note, callbackAt, followUpAt } = data;

    // 1. Get tag flow
    const tagFlow = await prisma.tagFlow.findUnique({
      where: { id: tagFlowId },
    });

    if (!tagFlow) {
      return res.status(404).json({ error: "Tag not found" });
    }

    if (!tagFlow.isActive) {
      return res.status(400).json({ error: "Tag is not active" });
    }

    // 2. RBAC: No Answer and Wrong Number — TELECALLER only (same model)
    if (
      (tagFlow.tagValue === "no_answer" || tagFlow.tagValue === "wrong_number") &&
      req.user?.role !== "TELECALLER"
    ) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Only TELECALLER role can apply 'No Answer' or 'Wrong Number' tag",
      });
    }

    // 2.5. Max Attempts Check: For "no_answer" tag, check if max attempts reached
    if (tagFlow.tagValue === "no_answer" && entityType === "lead") {
      // Get active workflow to check maxAttempts
      const activeWorkflow = await prisma.workflow.findFirst({
        where: { isActive: true },
        orderBy: { updatedAt: "desc" },
      });

      if (activeWorkflow) {
        const workflowData: any = typeof activeWorkflow.workflowData === "string"
          ? JSON.parse(activeWorkflow.workflowData)
          : activeWorkflow.workflowData;

        // Find tagConfig for no_answer
        let tagConfig: any = null;
        if (workflowData.tags) {
          const tag = Object.values(workflowData.tags).find((t: any) =>
            t.tagValue === "no_answer" || t.id === tagFlowId
          ) as any;
          if (tag && tag.tagConfig) {
            tagConfig = tag.tagConfig;
          }
        }

        if (!tagConfig && workflowData.tagGroups) {
          const allTags = [
            ...(workflowData.tagGroups.connected || []),
            ...(workflowData.tagGroups.notConnected || []),
          ];
          const tag = allTags.find((t: any) =>
            t.tagValue === "no_answer" || t.id === tagFlowId
          ) as any;
          if (tag && tag.tagConfig) {
            tagConfig = tag.tagConfig;
          }
        }

        if (tagConfig && tagConfig.retryPolicy) {
          const maxAttempts = tagConfig.retryPolicy.maxAttempts || 3;

          // Per-owner attempts: 3 ke baad dubara apply = auto-shuffle (lead transfer to another telecaller, remove from current list)
          const existingApplications = await prisma.tagApplication.findMany({
            where: {
              entityType: "lead",
              entityId: entityId,
              tagFlowId: tagFlowId,
              appliedById: userId,
            },
          });

          const attemptCount = existingApplications.length;

          if (attemptCount >= maxAttempts) {
            // Trigger shuffle: try to assign lead to another telecaller in pool
            const {
              getShuffleConfig,
              selectNextOwner,
              executeShuffle,
              markLeadExhausted,
            } = require("../services/shuffleEscalationService");
            const shuffleConfig = getShuffleConfig(tagConfig.shuffleEscalation);
            const nextOwner = await selectNextOwner(
              prisma,
              entityId,
              userId,
              shuffleConfig,
              tagFlowId
            );

            if (nextOwner) {
              const shuffleResult = await executeShuffle(prisma, {
                leadId: entityId,
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

            const exhaustResult = await markLeadExhausted(prisma, { leadId: entityId, createdById: userId });
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
              attemptCount,
              maxAttempts,
              exhausted: true,
            });
          }

          console.log(`[TAG APPLICATION] Attempt check: ${attemptCount + 1}/${maxAttempts} for lead ${entityId}`);
        }
      }
    }

    // 3. Check appliesTo scope
    if (tagFlow.appliesTo !== "all" && tagFlow.appliesTo !== entityType) {
      return res.status(400).json({
        error: `Tag does not apply to ${entityType}. This tag applies to: ${tagFlow.appliesTo}`,
      });
    }

    // 3. Verify entity exists
    let entityExists = false;
    if (entityType === "lead") {
      const lead = await prisma.lead.findUnique({ where: { id: entityId } });
      entityExists = !!lead;
    } else if (entityType === "call") {
      const call = await prisma.call.findUnique({ where: { id: entityId } });
      entityExists = !!call;
    } else if (entityType === "task") {
      const task = await prisma.task.findUnique({ where: { id: entityId } });
      entityExists = !!task;
    }

    if (!entityExists) {
      return res.status(404).json({ error: `${entityType} not found` });
    }

    // 4. Validate required fields
    if (tagFlow.requiresNote && (!note || note.trim() === "")) {
      return res.status(400).json({ error: "Note is required for this tag" });
    }

    // No Answer: backend sets callbackAt via executeTagConfigBehaviors; do not require from client
    if (tagFlow.requiresCallback && !callbackAt && tagFlow.tagValue !== "no_answer") {
      return res.status(400).json({ error: "Callback date/time is required for this tag" });
    }

    if (tagFlow.requiresFollowUp && !followUpAt) {
      return res.status(400).json({ error: "Follow-up date/time is required for this tag" });
    }

    // 5. Check exclusive (remove other tags if exclusive)
    if (tagFlow.isExclusive) {
      await prisma.tagApplication.updateMany({
        where: {
          entityType,
          entityId,
          isActive: true,
        },
        data: { isActive: false },
      });
    }

    // 6. Create TagApplication (ANKIT_API_03: Tag → Callback Sync)
    // Ensure callbackAt is stored in UTC
    const callbackAtDate = callbackAt ? new Date(callbackAt) : null;
    const followUpAtDate = followUpAt ? new Date(followUpAt) : null;

    // ANKIT_API_03: If this is a lead and tag has callbackAt, update Lead model's callbackScheduledAt
    // This ensures consistency between TagApplication and Lead model
    if (entityType === "lead" && callbackAtDate) {
      // Update lead's callbackScheduledAt to match tag's callbackAt (ANKIT_API_03)
      // Old callback is automatically overwritten (ANKIT_API_03)
      await prisma.lead.update({
        where: { id: entityId },
        data: {
          callbackScheduledAt: callbackAtDate, // Sync callbackAt to Lead model
        },
      });
    }

    let tagApplication = await prisma.tagApplication.create({
      data: {
        entityType,
        entityId,
        tagFlowId,
        parentId: parentId || null,
        appliedById: userId,
        note: note || null,
        callbackAt: callbackAtDate, // Stored in UTC by Prisma
        followUpAt: followUpAtDate, // Stored in UTC by Prisma
        isActive: true,
      },
      select: {
        id: true,
        entityType: true,
        entityId: true,
        tagFlowId: true,
        parentId: true,
        appliedById: true,
        note: true,
        callbackAt: true, // EXPLICITLY select callbackAt
        followUpAt: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
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

    console.log(`[TAG APPLICATION] 📝 Created TagApplication:`, {
      id: tagApplication.id,
      callbackAt: tagApplication.callbackAt ? tagApplication.callbackAt.toISOString() : "NULL",
      tagValue: tagApplication.tagFlow.tagValue,
    });

    // 7. Increment usage count
    await prisma.tagFlow.update({
      where: { id: tagFlowId },
      data: { usageCount: { increment: 1 } },
    });

    // 7.5. Create TagActionInstance if tag has actions (Phase 3.3)
    if (tagFlow.actions) {
      await createTagActionInstance(
        tagApplication.id,
        tagFlowId,
        entityType,
        entityId,
        tagFlow.actions
      );
    }

    // 7.6. Execute tagConfig behaviors from workflow (NO ANSWER tag behaviors)
    if (entityType === "lead") {
      console.log(`[TAG APPLICATION] 🔵 START: Executing tagConfig behaviors for tag ${tagFlowId} (${tagFlow.tagValue || tagFlow.name}) on lead ${entityId}`);
      console.log(`[TAG APPLICATION] TagApplication ID: ${tagApplication.id}, callbackAt provided: ${!!callbackAtDate}`);

      try {
        await executeTagConfigBehaviors(
          tagFlowId,
          entityId,
          tagApplication.id,
          callbackAtDate,
          userId
        );

        // Re-fetch tagApplication to get updated callbackAt from executeTagConfigBehaviors
        // Use select (not include) to explicitly control fields and avoid Prisma select bugs
        const updatedTagApplication = await prisma.tagApplication.findUnique({
          where: { id: tagApplication.id },
          select: {
            id: true,
            entityType: true,
            entityId: true,
            tagFlowId: true,
            parentId: true,
            appliedById: true,
            note: true,
            callbackAt: true, // EXPLICITLY select callbackAt
            followUpAt: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
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

        if (updatedTagApplication) {
          console.log(`[TAG APPLICATION] ✅ Re-fetched tagApplication:`, {
            id: updatedTagApplication.id,
            callbackAt: updatedTagApplication.callbackAt,
            hasCallbackAt: !!updatedTagApplication.callbackAt,
            callbackAtISO: updatedTagApplication.callbackAt?.toISOString(),
          });

          // FINAL VERIFICATION: Check if callbackAt is actually in the response
          if (!updatedTagApplication.callbackAt && tagFlow.tagValue === "no_answer") {
            console.error(`[TAG APPLICATION] ❌❌❌ CRITICAL: Re-fetched tagApplication has NULL callbackAt for "no_answer" tag!`);
            console.error(`[TAG APPLICATION] This means executeTagConfigBehaviors() did NOT set callbackAt successfully.`);
            console.error(`[TAG APPLICATION] Check logs above for: LOG-1, LOG-2, LOG-3, LOG-4 to find where it failed.`);
          }

          // FALLBACK: If callbackAt is still null for no_answer, auto-schedule callback immediately (so user never sees "Schedule callback now")
          if (!updatedTagApplication.callbackAt && tagFlow.tagValue === "no_answer") {
            console.warn(`[TAG APPLICATION] ⚠️ callbackAt is still NULL after executeTagConfigBehaviors. Auto-scheduling...`);
            try {
              const { ensureNoAnswerCallbackScheduled } = require("../services/noAnswerCallbackService");
              const fixedISO = await ensureNoAnswerCallbackScheduled(entityId);
              if (fixedISO) {
                console.log(`[TAG APPLICATION] ✅ ensureNoAnswerCallbackScheduled set callbackAt for lead ${entityId}`);
              }
              if (!fixedISO) {
                const { fixMissingCallbacks } = require("../jobs/fixMissingCallbacks");
                await fixMissingCallbacks();
              }

              // Re-fetch again after fix
              const fixedTagApplication = await prisma.tagApplication.findUnique({
                where: { id: tagApplication.id },
                select: {
                  id: true,
                  entityType: true,
                  entityId: true,
                  tagFlowId: true,
                  parentId: true,
                  appliedById: true,
                  note: true,
                  callbackAt: true, // EXPLICITLY select callbackAt
                  followUpAt: true,
                  isActive: true,
                  createdAt: true,
                  updatedAt: true,
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

              if (fixedTagApplication && fixedTagApplication.callbackAt) {
                console.log(`[TAG APPLICATION] ✅ Fallback fix successful: callbackAt set to ${fixedTagApplication.callbackAt.toISOString()}`);
                tagApplication = fixedTagApplication;
              } else {
                // Last resort: set default +60m so user never sees "Callback not scheduled"
                const defaultCallbackAt = new Date(Date.now() + 60 * 60 * 1000);
                await prisma.tagApplication.update({
                  where: { id: tagApplication.id },
                  data: { callbackAt: defaultCallbackAt },
                });
                tagApplication = { ...tagApplication, callbackAt: defaultCallbackAt } as any;
                console.log(`[TAG APPLICATION] ✅ Default callback set +60m for tag ${tagApplication.id}`);
              }
            } catch (fallbackError: any) {
              console.error(`[TAG APPLICATION] ❌ Fallback fix error:`, fallbackError.message);
            }
          } else {
            tagApplication = updatedTagApplication;
          }
        } else {
          console.error(`[TAG APPLICATION] ❌ CRITICAL: Failed to re-fetch updated tagApplication ${tagApplication.id}`);
        }
      } catch (behaviorError: any) {
        console.error(`[TAG APPLICATION] ❌ CRITICAL ERROR in executeTagConfigBehaviors:`, behaviorError);
        console.error(`[TAG APPLICATION] Error stack:`, behaviorError?.stack);
        // Don't fail the tag application, but log the error clearly
      }

      console.log(`[TAG APPLICATION] 🔵 END: TagConfig behaviors completed for tag ${tagFlowId}`);
    }

    // 8. Update LeadCurrentTagState (if entity is lead) (ANKIT_API_03)
    if (entityType === "lead") {
      // Determine parent and child tag IDs
      // If tag has parentId, it's a child tag (Tag Button)
      // If tag has no parentId, it might be a parent tag (Sub Button)
      const isChildTag = !!tagFlow.parentId;
      const parentTagId = isChildTag ? tagFlow.parentId : (tagFlow.parentId ? null : tagFlow.id);
      const childTagId = isChildTag ? tagFlow.id : null;

      // ANKIT_API_03: Update LeadCurrentTagState to sync tag state
      // This ensures no stale data (ANKIT_API_03)
      await prisma.leadCurrentTagState.upsert({
        where: { leadId: entityId },
        update: {
          parentTagId: parentTagId || null,
          childTagId: childTagId || null,
          updatedAt: new Date(), // Ensure updatedAt is refreshed
        },
        create: {
          leadId: entityId,
          parentTagId: parentTagId || null,
          childTagId: childTagId || null,
        },
      });

      // ANKIT_API_03: If tag requires callback, ensure callStatus is updated
      // This helps with bucket calculation consistency
      if (tagFlow.requiresCallback && callbackAtDate) {
        // Update callStatus to indicate callback is scheduled
        // This is optional - bucket calculation uses callbackAt primarily
        // But keeping callStatus in sync helps with consistency
        await prisma.lead.update({
          where: { id: entityId },
          data: {
            callStatus: tagFlow.tagValue || tagFlow.name, // Use tagValue or name as callStatus
          },
        });
      }
    }

    // 9. Create LeadActivity (if entity is lead) — audit: NO_ANSWER_APPLIED, CALLBACK_SCHEDULED
    if (entityType === "lead") {
      const activityType = tagFlow.tagValue === "no_answer" ? "NO_ANSWER_APPLIED" : "tag_applied";
      await prisma.leadActivity.create({
        data: {
          leadId: entityId,
          activityType,
          title: activityType === "NO_ANSWER_APPLIED" ? "No Answer applied" : `Tagged as ${tagFlow.name}`,
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
      if (tagFlow.tagValue === "no_answer" && tagApplication.callbackAt) {
        await prisma.leadActivity.create({
          data: {
            leadId: entityId,
            activityType: "CALLBACK_SCHEDULED",
            title: "Callback scheduled",
            description: `Next call at ${(tagApplication.callbackAt as Date).toISOString()}`,
            createdById: userId,
          },
        });
      }
    }

    // 10. Trigger workflow if active workflow exists and has matching trigger node
    try {
      await triggerWorkflowForTag(tagFlowId, entityType, entityId, userId);
    } catch (workflowError: any) {
      // Log error but don't fail tag application
      console.error("[TAG APPLICATION] Error triggering workflow:", workflowError);
    }

    // FINAL VERIFICATION: Ensure callbackAt is in response
    console.log(`[TAG APPLICATION] 📤 FINAL RESPONSE:`, {
      tagApplicationId: tagApplication.id,
      tagValue: tagApplication.tagFlow.tagValue,
      callbackAt: tagApplication.callbackAt ? tagApplication.callbackAt.toISOString() : "NULL",
      callbackAtIsNull: !tagApplication.callbackAt,
      willShowWarning: tagApplication.tagFlow.tagValue === "no_answer" && !tagApplication.callbackAt,
    });

    if (tagApplication.tagFlow.tagValue === "no_answer" && !tagApplication.callbackAt) {
      console.error(`[TAG APPLICATION] ❌❌❌ CRITICAL: Sending response with NULL callbackAt for "no_answer" tag!`);
      console.error(`[TAG APPLICATION] This will cause UI warning message to appear!`);
      console.error(`[TAG APPLICATION] Check all LOG-1, LOG-2, LOG-3, LOG-4 above to find root cause.`);
    }

    res.status(201).json({ tagApplication });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Error applying tag:", error);
    res.status(500).json({ error: error.message || "Failed to apply tag" });
  }
});

/**
 * Remove tag from an entity
 */
router.delete("/:entityType/:entityId/:tagApplicationId", async (req: AuthenticatedRequest, res) => {
  try {
    const { entityType, entityId, tagApplicationId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Validate entity type
    if (!["lead", "call", "task"].includes(entityType)) {
      return res.status(400).json({ error: "Invalid entity type. Must be 'lead', 'call', or 'task'" });
    }

    // Find the tag application
    const tagApplication = await prisma.tagApplication.findFirst({
      where: {
        id: tagApplicationId,
        entityType,
        entityId,
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

    // Create LeadActivity (if entity is lead)
    if (entityType === "lead") {
      await prisma.leadActivity.create({
        data: {
          leadId: entityId,
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
    }

    res.json({ message: "Tag removed successfully" });
  } catch (error: any) {
    console.error("Error removing tag:", error);
    res.status(500).json({ error: error.message || "Failed to remove tag" });
  }
});

/**
 * Get all tags for an entity
 */
router.get("/:entityType/:entityId", async (req: AuthenticatedRequest, res) => {
  try {
    const { entityType, entityId } = req.params;

    // Validate entity type
    if (!["lead", "call", "task"].includes(entityType)) {
      return res.status(400).json({ error: "Invalid entity type. Must be 'lead', 'call', or 'task'" });
    }

    // Get all active tag applications for this entity
    const tagApplications = await prisma.tagApplication.findMany({
      where: {
        entityType,
        entityId,
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
    console.error("Error fetching tags:", error);
    res.status(500).json({ error: error.message || "Failed to fetch tags" });
  }
});

export default router;
