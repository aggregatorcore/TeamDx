/**
 * Ensures callbackAt is set for a lead that has active "No Answer" tag but callback was not scheduled.
 * Used by: GET /api/leads (auto-fix on read), POST /api/leads/:id/schedule-callback.
 * Returns the new callbackAt ISO string if fixed, null otherwise.
 */
import { prisma } from "../lib/prisma";

export async function ensureNoAnswerCallbackScheduled(leadId: string): Promise<string | null> {
  const { calculateShiftAwareCallback, getDefaultTelecallerShift } = require("../../../utils/shiftUtils");

  // Step 0: Clear wrong 1/3 callback (e.g. 58h instead of next day) so we can recalc with +60m
  const wf0 = await prisma.workflow.findFirst({ where: { isActive: true }, orderBy: { updatedAt: "desc" } });
  let nodeIds0: string[] = [];
  if (wf0) {
    const data0: any = typeof wf0.workflowData === "string" ? JSON.parse(wf0.workflowData) : wf0.workflowData;
    nodeIds0 = (data0?.nodes || [])
      .filter(
        (n: any) =>
          (n.data?.tagValue || "").toLowerCase() === "no_answer" ||
          (n.label || n.data?.label || "").toLowerCase() === "no answer"
      )
      .map((n: any) => n.id || n.data?.id)
      .filter(Boolean);
  }
  const noAnswerWhere0 =
    nodeIds0.length > 0
      ? { entityType: "lead" as const, entityId: leadId, isActive: true, OR: [{ tagFlow: { tagValue: "no_answer" } }, { tagFlow: { name: { equals: "No Answer", mode: "insensitive" as const } } }, { tagFlowId: { in: nodeIds0 } }] }
      : { entityType: "lead" as const, entityId: leadId, isActive: true, OR: [{ tagFlow: { tagValue: "no_answer" } }, { tagFlow: { name: { equals: "No Answer", mode: "insensitive" as const } } }] };
  const activeNoAnswers = await prisma.tagApplication.findMany({
    where: noAnswerWhere0,
    orderBy: { createdAt: "asc" },
    select: { id: true, createdAt: true, callbackAt: true },
  });
  if (activeNoAnswers.length === 1 && activeNoAnswers[0].callbackAt) {
    const created = new Date(activeNoAnswers[0].createdAt).getTime();
    const cb = new Date(activeNoAnswers[0].callbackAt).getTime();
    if (cb - created > 2 * 60 * 60 * 1000) {
      await prisma.tagApplication.update({
        where: { id: activeNoAnswers[0].id },
        data: { callbackAt: null },
      });
    }
  }

  // Find unscheduled No Answer tag: by tagValue, name, or by workflow node id (UI often uses node id as tagFlowId)
  let tagWithMissingCallback = await prisma.tagApplication.findFirst({
    where: {
      entityType: "lead",
      entityId: leadId,
      isActive: true,
      callbackAt: null,
      OR: [
        { tagFlow: { tagValue: "no_answer" } },
        { tagFlow: { name: { equals: "No Answer", mode: "insensitive" } } },
      ],
    },
    include: {
      tagFlow: { select: { id: true, name: true, tagValue: true } },
      appliedBy: { include: { role: true } },
    },
  });
  if (!tagWithMissingCallback) {
    const activeWorkflow = await prisma.workflow.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    });
    if (activeWorkflow) {
      const workflowData: any =
        typeof activeWorkflow.workflowData === "string"
          ? JSON.parse(activeWorkflow.workflowData)
          : activeWorkflow.workflowData;
      const nodes = workflowData?.nodes || [];
      const noAnswerNodeIds = nodes
        .filter(
          (n: any) =>
            (n.data?.tagValue || "").toLowerCase() === "no_answer" ||
            (n.label || n.data?.label || "").toLowerCase() === "no answer"
        )
        .map((n: any) => n.id || n.data?.id)
        .filter(Boolean);
      if (noAnswerNodeIds.length > 0) {
        tagWithMissingCallback = await prisma.tagApplication.findFirst({
          where: {
            entityType: "lead",
            entityId: leadId,
            isActive: true,
            callbackAt: null,
            tagFlowId: { in: noAnswerNodeIds },
          },
          include: {
            tagFlow: { select: { id: true, name: true, tagValue: true } },
            appliedBy: { include: { role: true } },
          },
        });
      }
    }
  }
  if (!tagWithMissingCallback) {
    // Auto-fix 1/3 with wrong callback (e.g. 58h instead of next day): find active no_answer with callbackAt set, if 1/3 and >25h from createdAt, clear and recalc with +60m
    const noAnswerOr = [
      { tagFlow: { tagValue: "no_answer" } },
      { tagFlow: { name: { equals: "No Answer", mode: "insensitive" as const } } },
    ];
    let nodeIdsForCount: string[] = [];
    let withCallback = await prisma.tagApplication.findFirst({
      where: {
        entityType: "lead",
        entityId: leadId,
        isActive: true,
        callbackAt: { not: null },
        OR: noAnswerOr,
      },
      include: {
        tagFlow: { select: { id: true, name: true, tagValue: true } },
        appliedBy: { include: { role: true } },
      },
    });
    if (!withCallback) {
      const wf = await prisma.workflow.findFirst({ where: { isActive: true }, orderBy: { updatedAt: "desc" } });
      if (wf) {
        const wfData: any = typeof wf.workflowData === "string" ? JSON.parse(wf.workflowData) : wf.workflowData;
        const nodes = wfData?.nodes || [];
        nodeIdsForCount = nodes
          .filter(
            (n: any) =>
              (n.data?.tagValue || "").toLowerCase() === "no_answer" ||
              (n.label || n.data?.label || "").toLowerCase() === "no answer"
          )
          .map((n: any) => n.id || n.data?.id)
          .filter(Boolean);
        if (nodeIdsForCount.length > 0) {
          withCallback = await prisma.tagApplication.findFirst({
            where: {
              entityType: "lead",
              entityId: leadId,
              isActive: true,
              callbackAt: { not: null },
              tagFlowId: { in: nodeIdsForCount },
            },
            include: {
              tagFlow: { select: { id: true, name: true, tagValue: true } },
              appliedBy: { include: { role: true } },
            },
          });
        }
      }
    }
    if (withCallback) {
      const created = new Date(withCallback.createdAt).getTime();
      const callback = new Date(withCallback.callbackAt!).getTime();
      const countWhere =
        nodeIdsForCount.length > 0
          ? { entityType: "lead" as const, entityId: leadId, isActive: true, OR: [...noAnswerOr, { tagFlowId: { in: nodeIdsForCount } }] }
          : { entityType: "lead" as const, entityId: leadId, isActive: true, OR: noAnswerOr };
      const count = await prisma.tagApplication.count({ where: countWhere });
      // 1/3 should be ~1h from createdAt; if callback is >2h from created, treat as wrong (e.g. 48h used by mistake)
      if (count === 1 && callback - created > 2 * 60 * 60 * 1000) {
        await prisma.tagApplication.update({
          where: { id: withCallback.id },
          data: { callbackAt: null },
        });
        tagWithMissingCallback = { ...withCallback, callbackAt: null } as any;
      }
    }
  }
  if (!tagWithMissingCallback) return null;

  // Attempt count: use only ACTIVE no_answer applications; include matches by workflow node id
  let noAnswerNodeIds: string[] = [];
  const wf = await prisma.workflow.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });
  if (wf) {
    const wfData: any = typeof wf.workflowData === "string" ? JSON.parse(wf.workflowData) : wf.workflowData;
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
  const activeNoAnswerWhere =
    noAnswerNodeIds.length > 0
      ? {
          entityType: "lead" as const,
          entityId: leadId,
          isActive: true,
          OR: [
            { tagFlow: { tagValue: "no_answer" } },
            { tagFlow: { name: { equals: "No Answer", mode: "insensitive" as const } } },
            { tagFlowId: { in: noAnswerNodeIds } },
          ],
        }
      : {
          entityType: "lead" as const,
          entityId: leadId,
          isActive: true,
          OR: [
            { tagFlow: { tagValue: "no_answer" } },
            { tagFlow: { name: { equals: "No Answer", mode: "insensitive" as const } } },
          ],
        };
  const activeNoAnswerTags = await prisma.tagApplication.findMany({
    where: activeNoAnswerWhere,
    orderBy: { createdAt: "asc" },
  });
  const attemptNumber = activeNoAnswerTags.findIndex((t) => t.id === tagWithMissingCallback!.id) + 1;
  const attemptIndex = Math.max(0, attemptNumber - 1); // 0-based for timings array; allow any attempt

  // Resolve attempt timings from workflow (or use default 60m so "Schedule callback now" always works)
  let attemptTimings: any[] = [];
  const activeWorkflow = await prisma.workflow.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });
  if (activeWorkflow) {
    const workflowData: any =
      typeof activeWorkflow.workflowData === "string"
        ? JSON.parse(activeWorkflow.workflowData)
        : activeWorkflow.workflowData;
    let tagConfig: any = null;
    if (workflowData.tags) {
      const tag = Object.values(workflowData.tags).find(
        (t: any) => t.tagValue === "no_answer" || t.name?.toLowerCase() === "no answer"
      );
      if (tag && tag.tagConfig) tagConfig = tag.tagConfig;
    }
    if (!tagConfig && workflowData.tagGroups) {
      const allTags = [
        ...(workflowData.tagGroups.connected || []),
        ...(workflowData.tagGroups.notConnected || []),
      ];
      const tag = allTags.find(
        (t: any) => t.tagValue === "no_answer" || t.name?.toLowerCase() === "no answer"
      );
      if (tag && tag.tagConfig) tagConfig = tag.tagConfig;
    }
    if (!tagConfig && workflowData.nodes && Array.isArray(workflowData.nodes)) {
      const tagNode = workflowData.nodes.find(
        (n: any) =>
          n.data?.tagValue === "no_answer" ||
          (n.label || n.data?.label || "").toLowerCase() === "no answer"
      );
      if (tagNode?.data?.tagConfig) tagConfig = tagNode.data.tagConfig;
    }
    const retryPolicy = tagConfig?.retryPolicy;
    if (retryPolicy?.attemptTimings) {
      if (Array.isArray(retryPolicy.attemptTimings)) {
        attemptTimings = retryPolicy.attemptTimings;
      } else if (typeof retryPolicy.attemptTimings === "object") {
        attemptTimings = Object.keys(retryPolicy.attemptTimings)
          .filter((k) => !isNaN(parseInt(k)))
          .sort((a, b) => parseInt(a) - parseInt(b))
          .map((k) => retryPolicy.attemptTimings[k]);
      }
    }
  }
  // Default: 1/3 = 60m, 2/3 = next day available slot in shift, 3/3 = 48h (same after shuffle for new owner)
  if (attemptTimings.length === 0) {
    attemptTimings = [
      { timing: "+60m" },
      { timing: "next_day" },
      { timing: "+48h" },
    ];
  }

  let shiftConfig = getDefaultTelecallerShift();
  const userId = tagWithMissingCallback.appliedById;
  if (userId && tagWithMissingCallback.appliedBy) {
    const user = tagWithMissingCallback.appliedBy as any;
    const userShiftConfig = await prisma.shiftConfig.findFirst({
      where: { userId: user.id, isActive: true },
    });
    if (userShiftConfig) {
      shiftConfig = { shiftStart: userShiftConfig.shiftStart, shiftEnd: userShiftConfig.shiftEnd };
    } else if (user.role) {
      const roleShiftConfig = await prisma.shiftConfig.findFirst({
        where: { roleId: user.role.id, userId: null, isActive: true },
      });
      if (roleShiftConfig) {
        shiftConfig = { shiftStart: roleShiftConfig.shiftStart, shiftEnd: roleShiftConfig.shiftEnd };
      }
    }
  }

  let attemptTiming = attemptTimings[Math.min(attemptIndex, attemptTimings.length - 1)];
  // 1/3 must always be 60m (then snap to shift if outside); fix when workflow has wrong/incomplete config
  if (attemptIndex === 0 && attemptTiming?.timing !== "+60m" && attemptTiming?.timing !== "60m") {
    attemptTiming = { timing: "+60m" };
  }
  // 2/3 must always be next day (shift start)
  if (attemptIndex === 1 && attemptTiming?.timing !== "next_day" && attemptTiming?.timing !== "next_day_shift_start") {
    attemptTiming = { timing: "next_day" };
  }
  if (!attemptTiming?.timing) return null;

  const baseTime = tagWithMissingCallback.createdAt;
  let callbackTime = calculateShiftAwareCallback(
    baseTime,
    attemptTiming.timing,
    shiftConfig.shiftStart,
    shiftConfig.shiftEnd
  );
  if (!callbackTime) return null;

  const appliedById = tagWithMissingCallback.appliedById;
  if (appliedById) {
    const { allocateNextFreeSlot } = require("../utils/callbackSlotScheduler");
    callbackTime = await allocateNextFreeSlot(prisma, appliedById, callbackTime, 2, {
      shiftStart: shiftConfig.shiftStart,
      shiftEnd: shiftConfig.shiftEnd,
    });
  }

  await prisma.tagApplication.update({
    where: { id: tagWithMissingCallback.id },
    data: { callbackAt: callbackTime },
  });

  const activeWithCallback = await prisma.tagApplication.findMany({
    where: {
      entityType: "lead",
      entityId: leadId,
      isActive: true,
      callbackAt: { not: null },
    },
    orderBy: { callbackAt: "asc" },
  });
  if (activeWithCallback.length > 0) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { callbackScheduledAt: activeWithCallback[0].callbackAt! },
    });
  }

  return callbackTime instanceof Date ? callbackTime.toISOString() : new Date(callbackTime).toISOString();
}
