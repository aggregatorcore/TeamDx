/**
 * Stagger/slot scheduler for No Answer callbacks.
 * Prevents "morning blast" when many leads get same callbackAt (e.g. 09:30).
 * Rule: same telecaller (appliedById) ke liye same 2-min slot me 2 callbacks NEVER.
 * Slot scope: Per Telecaller (current). Optional future: per telecaller+lead or per tag.
 *
 * Design note (E): Multi-shift / day-offs — future: find next valid shift day if telecaller has weekly off.
 */

import type { PrismaClient } from "@prisma/client";

const DEFAULT_SLOT_SIZE_MINUTES = 2;

function startOfMinute(d: Date): Date {
  const out = new Date(d);
  out.setSeconds(0, 0);
  return out;
}

/**
 * Parse "HH:mm" to hours and minutes.
 */
function parseShiftTime(s: string): { hours: number; minutes: number } {
  const [h, m] = s.split(":").map(Number);
  return { hours: h ?? 0, minutes: m ?? 0 };
}

/**
 * Get shift end as Date on the same calendar day as d.
 */
function getShiftEndOnDate(d: Date, shiftEnd: string): Date {
  const { hours, minutes } = parseShiftTime(shiftEnd);
  const out = new Date(d);
  out.setHours(hours, minutes, 0, 0);
  return out;
}

/**
 * Get next day shift start.
 */
function getNextDayShiftStart(d: Date, shiftStart: string): Date {
  const { hours, minutes } = parseShiftTime(shiftStart);
  const out = new Date(d);
  out.setDate(out.getDate() + 1);
  out.setHours(hours, minutes, 0, 0);
  return out;
}

/**
 * Get the next free slot for this telecaller.
 * Slot scope: Per Telecaller (appliedById). Same lead can have only one active callback per tag (handled by business logic).
 *
 * D) Shift end protection: if candidate would go beyond shiftEnd, push to next day shiftStart and continue staggering.
 */
export async function allocateNextFreeSlot(
  prisma: PrismaClient,
  appliedById: string,
  baseTime: Date,
  slotSizeMinutes: number = DEFAULT_SLOT_SIZE_MINUTES,
  shiftBounds?: { shiftStart: string; shiftEnd: string }
): Promise<Date> {
  let candidate = startOfMinute(baseTime);
  const baseMinutes = candidate.getMinutes();
  const alignedMinutes = Math.floor(baseMinutes / slotSizeMinutes) * slotSizeMinutes;
  candidate.setMinutes(alignedMinutes);

  const maxIterations = 120;
  for (let i = 0; i < maxIterations; i++) {
    if (shiftBounds) {
      const endToday = getShiftEndOnDate(candidate, shiftBounds.shiftEnd);
      if (candidate >= endToday) {
        candidate = getNextDayShiftStart(candidate, shiftBounds.shiftStart);
        const align = Math.floor(candidate.getMinutes() / slotSizeMinutes) * slotSizeMinutes;
        candidate.setMinutes(align);
      }
    }

    const slotStart = new Date(candidate);
    const slotEnd = new Date(candidate);
    slotEnd.setMinutes(slotEnd.getMinutes() + slotSizeMinutes);

    const existing = await prisma.tagApplication.findFirst({
      where: {
        appliedById,
        isActive: true,
        entityType: "lead",
        callbackAt: {
          gte: slotStart,
          lt: slotEnd,
        },
      },
    });

    if (!existing) return candidate;

    candidate = new Date(candidate);
    candidate.setMinutes(candidate.getMinutes() + slotSizeMinutes);
  }

  return candidate;
}

const MAX_SLOT_RETRIES = 10;

/**
 * B) Allocate slot and update in a retry loop. If DB unique constraint fails (P2002), try next slot.
 * Call this instead of allocate + update separately to avoid race conditions.
 */
export async function allocateAndUpdateCallbackAt(
  prisma: PrismaClient,
  params: {
    tagApplicationId: string;
    leadId: string;
    appliedById: string;
    baseTime: Date;
    slotSizeMinutes?: number;
    shiftStart?: string;
    shiftEnd?: string;
  }
): Promise<Date> {
  const { tagApplicationId, leadId, appliedById, baseTime, slotSizeMinutes = 2, shiftStart, shiftEnd } = params;
  const shiftBounds = shiftStart && shiftEnd ? { shiftStart, shiftEnd } : undefined;
  let base = new Date(baseTime);

  for (let tryCount = 0; tryCount < MAX_SLOT_RETRIES; tryCount++) {
    const slotTime = await allocateNextFreeSlot(prisma, appliedById, base, slotSizeMinutes, shiftBounds);

    try {
      await prisma.tagApplication.update({
        where: { id: tagApplicationId },
        data: { callbackAt: slotTime },
      });

      const mostRecentCallback = await prisma.tagApplication.findFirst({
        where: {
          entityType: "lead",
          entityId: leadId,
          isActive: true,
          callbackAt: { not: null },
        },
        orderBy: { callbackAt: "asc" },
      });
      if (mostRecentCallback?.callbackAt) {
        await prisma.lead.update({
          where: { id: leadId },
          data: { callbackScheduledAt: mostRecentCallback.callbackAt },
        });
      }
      return slotTime;
    } catch (err: any) {
      if (err?.code === "P2002" && tryCount < MAX_SLOT_RETRIES - 1) {
        base = new Date(slotTime.getTime() + slotSizeMinutes * 60 * 1000);
        continue;
      }
      throw err;
    }
  }

  throw new Error("allocateAndUpdateCallbackAt: max retries exceeded");
}
