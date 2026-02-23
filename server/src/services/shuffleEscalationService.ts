/**
 * No Answer → Shuffle Escalation (Dynamic Telecaller Pool)
 *
 * When current owner reaches 3/3 (max local attempts) and still no_answer:
 * - Try to assign lead to another telecaller from pool (team or company)
 * - Pool: active telecallers, not in triedOwnerIds, workload < dailyPendingLimit
 * - Rank: lowest pending callbacks, then least recent assignment
 * - Scheduling: shift-aware stagger + cooldown guard
 * - EXHAUSTED: when no candidate or shuffleIndex >= shuffleMaxOwnersCap → 409
 */

import type { PrismaClient } from "@prisma/client";
import { allocateAndUpdateCallbackAt } from "../utils/callbackSlotScheduler";
import { snapToShift } from "../../../utils/shiftUtils";

export type PoolScope = "team" | "company";

export interface ShuffleConfig {
  maxLocalAttempts: number;
  slotSizeMinutes: number;
  cooldownMinutes: number;
  dailyPendingLimitPerTelecaller: number;
  shuffleMaxOwnersCap: number;
  poolScope: PoolScope;
}

const DEFAULT_SHUFFLE_CONFIG: ShuffleConfig = {
  maxLocalAttempts: 3,
  slotSizeMinutes: 2,
  cooldownMinutes: 45,
  dailyPendingLimitPerTelecaller: 40,
  shuffleMaxOwnersCap: 20,
  poolScope: "company", // Pehle company-wide taaki available telecaller mile; exhaust sirf jab really koi na ho
};

export function getShuffleConfig(tagConfigShuffle?: Record<string, unknown> | null): ShuffleConfig {
  if (!tagConfigShuffle || typeof tagConfigShuffle !== "object") {
    return { ...DEFAULT_SHUFFLE_CONFIG };
  }
  return {
    maxLocalAttempts: (tagConfigShuffle.maxLocalAttempts as number) ?? DEFAULT_SHUFFLE_CONFIG.maxLocalAttempts,
    slotSizeMinutes: (tagConfigShuffle.slotSizeMinutes as number) ?? DEFAULT_SHUFFLE_CONFIG.slotSizeMinutes,
    cooldownMinutes: (tagConfigShuffle.cooldownMinutes as number) ?? DEFAULT_SHUFFLE_CONFIG.cooldownMinutes,
    dailyPendingLimitPerTelecaller:
      (tagConfigShuffle.dailyPendingLimitPerTelecaller as number) ?? DEFAULT_SHUFFLE_CONFIG.dailyPendingLimitPerTelecaller,
    shuffleMaxOwnersCap:
      (tagConfigShuffle.shuffleMaxOwnersCap as number) ?? DEFAULT_SHUFFLE_CONFIG.shuffleMaxOwnersCap,
    poolScope: (tagConfigShuffle.poolScope as PoolScope) ?? DEFAULT_SHUFFLE_CONFIG.poolScope,
  };
}

/** Get shift config for a user (user-specific or role-based). */
export async function getShiftConfigForUser(
  prisma: PrismaClient,
  userId: string
): Promise<{ shiftStart: string; shiftEnd: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, roleId: true },
  });
  if (!user) return { shiftStart: "09:30", shiftEnd: "17:30" };

  const userShift = await prisma.shiftConfig.findFirst({
    where: { userId: user.id, isActive: true },
  });
  if (userShift) return { shiftStart: userShift.shiftStart, shiftEnd: userShift.shiftEnd };

  const roleShift = await prisma.shiftConfig.findFirst({
    where: { roleId: user.roleId, userId: null, isActive: true },
  });
  if (roleShift) return { shiftStart: roleShift.shiftStart, shiftEnd: roleShift.shiftEnd };

  return { shiftStart: "09:30", shiftEnd: "17:30" };
}

/** Count pending callbacks (active no_answer or callback tag applications) for a telecaller today/future. */
export async function getPendingCallbackCount(
  prisma: PrismaClient,
  appliedById: string,
  tagFlowId?: string
): Promise<number> {
  const now = new Date();
  const count = await prisma.tagApplication.count({
    where: {
      appliedById,
      entityType: "lead",
      isActive: true,
      callbackAt: { gte: now },
    },
  });
  return count;
}

/** Get telecaller pool: active users with TELECALLER role. team = same teamLeader as current owner (or TL's team members); company = all. */
export async function getTelecallerPool(
  prisma: PrismaClient,
  currentOwnerId: string,
  poolScope: PoolScope
): Promise<{ id: string; firstName: string; lastName: string; teamLeaderId: string | null }[]> {
  const role = await prisma.role.findUnique({ where: { name: "TELECALLER" } });
  if (!role) return [];

  const baseWhere: { roleId: string; isActive: boolean; id?: { not?: string }; teamLeaderId?: string | null } = {
    roleId: role.id,
    isActive: true,
    id: { not: currentOwnerId },
  };

  if (poolScope === "team") {
    const current = await prisma.user.findUnique({
      where: { id: currentOwnerId },
      select: { teamLeaderId: true, id: true },
    });
    if (!current) return [];
    // Same team = same team leader, or if current user is TL then their team members
    const teamLeaderId = current.teamLeaderId ?? current.id;
    const users = await prisma.user.findMany({
      where: {
        ...baseWhere,
        OR: [{ teamLeaderId }, { id: teamLeaderId }],
      },
      select: { id: true, firstName: true, lastName: true, teamLeaderId: true },
    });
    return users.filter((u) => u.id !== currentOwnerId);
  }

  const users = await prisma.user.findMany({
    where: baseWhere,
    select: { id: true, firstName: true, lastName: true, teamLeaderId: true },
  });
  return users;
}

/** Get candidates: pool minus triedOwnerIds, workload < dailyPendingLimit. */
export async function getCandidates(
  prisma: PrismaClient,
  pool: { id: string }[],
  triedOwnerIds: string[],
  dailyPendingLimit: number,
  noAnswerTagFlowId: string
): Promise<{ id: string; pendingCount: number; lastAssignmentAt: Date | null }[]> {
  const excluded = new Set(triedOwnerIds);
  const candidateIds = pool.map((p) => p.id).filter((id) => !excluded.has(id));
  if (candidateIds.length === 0) return [];

  const result: { id: string; pendingCount: number; lastAssignmentAt: Date | null }[] = [];

  for (const id of candidateIds) {
    const pendingCount = await getPendingCallbackCount(prisma, id);
    if (pendingCount >= dailyPendingLimit) continue;

    const lastAssigned = await prisma.lead.findFirst({
      where: { assignedToId: id },
      orderBy: { assignedAt: "desc" },
      select: { assignedAt: true },
    });

    result.push({
      id,
      pendingCount,
      lastAssignmentAt: lastAssigned?.assignedAt ?? null,
    });
  }

  return result;
}

/** Rank: 1) lowest pending count, 2) least recent assignment, 3) by id for tie-break. */
export function rankCandidates(
  candidates: { id: string; pendingCount: number; lastAssignmentAt: Date | null }[]
): { id: string }[] {
  return [...candidates].sort((a, b) => {
    if (a.pendingCount !== b.pendingCount) return a.pendingCount - b.pendingCount;
    const aTime = a.lastAssignmentAt?.getTime() ?? 0;
    const bTime = b.lastAssignmentAt?.getTime() ?? 0;
    return aTime - bTime;
  });
}

/** Compute base time for new owner: now, snapped to shift; if within cooldown or near shift end, use next valid slot. */
export function getBaseTimeForNewOwner(
  now: Date,
  lastHandoffAt: Date | null,
  cooldownMinutes: number,
  shiftStart: string,
  shiftEnd: string
): Date {
  let base = new Date(now);
  if (lastHandoffAt) {
    const cooldownEnd = new Date(lastHandoffAt.getTime() + cooldownMinutes * 60 * 1000);
    if (base < cooldownEnd) base = cooldownEnd;
  }
  return snapToShift(base, shiftStart, shiftEnd, 5);
}

export interface SelectNextOwnerResult {
  newOwnerId: string;
  newOwnerName: string;
  poolSize: number;
  shuffleIndex: number;
}

/**
 * Select next owner for shuffle. Returns null if exhausted (no candidate or cap reached).
 */
export async function selectNextOwner(
  prisma: PrismaClient,
  leadId: string,
  currentOwnerId: string,
  config: ShuffleConfig,
  noAnswerTagFlowId: string
): Promise<SelectNextOwnerResult | null> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { shuffleTriedOwnerIds: true, shuffleIndex: true, lastHandoffAt: true },
  });
  if (!lead) return null;

  const triedOwnerIds = lead.shuffleTriedOwnerIds ?? [];
  const shuffleIndex = (lead.shuffleIndex ?? 0) + 1;
  const effectiveTried = [...triedOwnerIds, currentOwnerId];

  // Pehle team pool try karo; agar koi candidate na mile to company-wide pool (fallback) try karo — taaki exhaust tabhi ho jab really koi telecaller available na ho
  let pool = await getTelecallerPool(prisma, currentOwnerId, config.poolScope);
  if (pool.length === 0 && config.poolScope === "team") {
    pool = await getTelecallerPool(prisma, currentOwnerId, "company");
  }

  const poolSize = pool.length;
  const shuffleMax = Math.min(poolSize, config.shuffleMaxOwnersCap);
  if (shuffleIndex > shuffleMax) return null;

  let candidates = await getCandidates(
    prisma,
    pool,
    effectiveTried,
    config.dailyPendingLimitPerTelecaller,
    noAnswerTagFlowId
  );
  if (candidates.length === 0 && config.poolScope === "team") {
    const companyPool = await getTelecallerPool(prisma, currentOwnerId, "company");
    if (companyPool.length > 0) {
      candidates = await getCandidates(
        prisma,
        companyPool,
        effectiveTried,
        config.dailyPendingLimitPerTelecaller,
        noAnswerTagFlowId
      );
    }
  }

  const ranked = rankCandidates(candidates);
  const next = ranked[0];
  if (!next) return null;

  const newOwner = await prisma.user.findUnique({
    where: { id: next.id },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!newOwner) return null;

  return {
    newOwnerId: newOwner.id,
    newOwnerName: `${newOwner.firstName} ${newOwner.lastName}`.trim(),
    poolSize,
    shuffleIndex,
  };
}

export interface ExecuteShuffleResult {
  tagApplicationId: string | null;
  callbackAt: Date | null;
  newOwnerId: string;
  newOwnerName: string;
  shuffleIndex: number;
}

/**
 * Execute shuffle: lead naye telecaller ke paas bilkul new jaisi jayegi.
 *
 * AUTO SHUFFLE → NEW OWNER (TELECALLER) — Spec alignment:
 *
 * Bucket placement (new telecaller):
 *   - Default: FRESH (callbackScheduledAt + callStatus cleared; no active tag → no callbackAt).
 *   - Optional rule (if auto-schedule on transfer): would put in FOLLOWUP; we do NOT auto-create callbackAt here.
 *
 * Old tags / states:
 *   - Old telecaller's No Answer TagApplication: isActive = false; callbackAt ignored (deactivated); attempt cycle closed.
 *   - Lead-level tag badge: Option A — show as history/last outcome only (no active tag). UI shows no badge/countdown for new owner.
 *   - LeadCurrentTagState deleted so card shows clean (new lead).
 *
 * New telecaller cycle:
 *   - shuffleTriedOwnerIds updated (old owner + new owner added).
 *   - attemptCount for new owner = 0/3 (no new TagApplication on shuffle).
 *   - First No Answer (when new owner applies) → Attempt 1, +60m, slot-stagger (handled by tag application flow).
 */
export async function executeShuffle(
  prisma: PrismaClient,
  params: {
    leadId: string;
    currentOwnerId: string;
    newOwnerId: string;
    newOwnerName: string;
    noAnswerTagFlowId: string;
    config: ShuffleConfig;
    shuffleIndex: number;
  }
): Promise<ExecuteShuffleResult> {
  const { leadId, currentOwnerId, newOwnerId, newOwnerName, noAnswerTagFlowId, shuffleIndex } = params;
  const now = new Date();

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { shuffleTriedOwnerIds: true, lastHandoffAt: true, firstName: true, lastName: true },
  });
  if (!lead) throw new Error("Lead not found");

  const triedOwnerIds = lead.shuffleTriedOwnerIds ?? [];
  const newTried = [...triedOwnerIds, currentOwnerId, newOwnerId];

  await prisma.$transaction(async (tx) => {
    // Deactivate ALL active no_answer TagApplications for this lead (not just one) so shuffled lead has zero active tags
    await tx.tagApplication.updateMany({
      where: {
        entityType: "lead",
        entityId: leadId,
        tagFlowId: noAnswerTagFlowId,
        isActive: true,
      },
      data: { isActive: false },
    });

    await tx.lead.update({
      where: { id: leadId },
      data: {
        assignedToId: newOwnerId,
        assignedAt: now,
        previousAssignedToId: currentOwnerId,
        movedAt: now,
        shuffleTriedOwnerIds: newTried,
        shuffleIndex,
        lastHandoffAt: now,
        callbackScheduledAt: null,
        callStatus: null,
      },
    });

    // LeadCurrentTagState clear karo — card pe purani tag/attempt/overdue na dikhe, new lead jaisi
    await tx.leadCurrentTagState.deleteMany({ where: { leadId } });

    await tx.leadActivity.create({
      data: {
        leadId,
        activityType: "SHUFFLED",
        title: "Lead transferred to you (shuffle)",
        description: `Lead ${lead.firstName} ${lead.lastName} transferred to you. It appears as new in your list. Last outcome: No Answer (previous owner). Attempt cycle reset for you (0/3).`,
        createdById: currentOwnerId,
      },
    });
  });

  return {
    tagApplicationId: null,
    callbackAt: null,
    newOwnerId,
    newOwnerName,
    shuffleIndex,
  };
}

/**
 * Mark lead as exhausted when shuffle has no next owner (pool exhausted or cap reached).
 * Sets Lead.isExhausted = true, Lead.exhaustedAt = now (state) + LeadActivity EXHAUSTED (audit).
 */
export async function markLeadExhausted(
  prisma: PrismaClient,
  params: { leadId: string; createdById: string }
): Promise<{ lead: { id: string; firstName: string; lastName: string; phone: string }; createdById: string }> {
  const now = new Date();
  const lead = await prisma.lead.findUnique({
    where: { id: params.leadId },
    select: { id: true, firstName: true, lastName: true, phone: true },
  });
  if (!lead) throw new Error("Lead not found");

  await prisma.lead.update({
    where: { id: params.leadId },
    data: { isExhausted: true, exhaustedAt: now, exhaustReason: "POOL_EXHAUSTED" },
  });

  await prisma.leadActivity.create({
    data: {
      leadId: params.leadId,
      activityType: "EXHAUSTED",
      title: "No Answer pool exhausted",
      description: `Lead ${lead.firstName} ${lead.lastName} - no telecaller available in pool. Requires senior action (Recycle / Assign / Close).`,
      createdById: params.createdById,
    },
  });

  return {
    lead: { id: lead.id, firstName: lead.firstName, lastName: lead.lastName, phone: lead.phone },
    createdById: params.createdById,
  };
}
