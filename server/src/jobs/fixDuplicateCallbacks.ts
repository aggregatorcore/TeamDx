/**
 * Fix duplicate active callbacks (same appliedById + callbackAt) so the DB unique index can be applied.
 *
 * Strategy A (default): Nudge — keep earliest TagApplication per (appliedById, callbackAt) as-is;
 * for the rest, assign next free slot via allocateNextFreeSlot (+2 min stagger). Preserves all
 * callbacks; only time is shifted.
 *
 * Strategy B (optional): Deactivate — set isActive=false for duplicate rows except the earliest.
 * Use only if duplicates are truly redundant (e.g. same lead applied twice by mistake).
 *
 * Run: npx ts-node server/src/jobs/fixDuplicateCallbacks.ts
 * Or from project root: node --loader ts-node/esm server/src/jobs/fixDuplicateCallbacks.ts
 *
 * Pooja: Choose safest approach (nudge recommended); run in staging first; re-run find-duplicate
 * query after to confirm 0 duplicate groups.
 */

import { PrismaClient } from "@prisma/client";
import { allocateNextFreeSlot } from "../utils/callbackSlotScheduler";

const prisma = new PrismaClient();

const SLOT_SIZE_MINUTES = 2;

type Strategy = "nudge" | "deactivate";

async function getDuplicateGroups() {
  const rows = await prisma.tagApplication.findMany({
    where: {
      isActive: true,
      callbackAt: { not: null },
      entityType: "lead",
    },
    select: {
      id: true,
      entityId: true,
      appliedById: true,
      callbackAt: true,
      createdAt: true,
    },
    orderBy: [{ appliedById: "asc" }, { callbackAt: "asc" }, { createdAt: "asc" }],
  });

  const key = (r: { appliedById: string; callbackAt: Date | null }) =>
    `${r.appliedById}|${r.callbackAt!.getTime()}`;
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!r.callbackAt) continue;
    const k = key(r);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }

  return [...groups.entries()].filter(([, arr]) => arr.length > 1);
}

async function main() {
  const strategy: Strategy = (process.env.FIX_DUPLICATE_STRATEGY as Strategy) || "nudge";

  console.log("[fixDuplicateCallbacks] Strategy:", strategy);
  const duplicateGroups = await getDuplicateGroups();
  console.log("[fixDuplicateCallbacks] Duplicate groups found:", duplicateGroups.length);

  if (duplicateGroups.length === 0) {
    console.log("[fixDuplicateCallbacks] No duplicates. Safe to apply unique index.");
    return;
  }

  let nudged = 0;
  let deactivated = 0;

  for (const [groupKey, groupRows] of duplicateGroups) {
    const [appliedById, callbackAtMs] = groupKey.split("|");
    const baseTime = new Date(parseInt(callbackAtMs, 10));
    const sorted = [...groupRows].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const keep = sorted[0];
    const toFix = sorted.slice(1);

    if (strategy === "deactivate") {
      for (const row of toFix) {
        await prisma.tagApplication.update({
          where: { id: row.id },
          data: { isActive: false },
        });
        deactivated++;
        console.log("[fixDuplicateCallbacks] Deactivated:", row.id, "lead:", row.entityId);
      }
      continue;
    }

    // Strategy A: nudge each duplicate to next free slot
    for (const row of toFix) {
      const nextSlot = await allocateNextFreeSlot(
        prisma,
        appliedById,
        baseTime,
        SLOT_SIZE_MINUTES,
        undefined // no shift bounds in job; slot scheduler will still avoid same-minute collision
      );
      await prisma.tagApplication.update({
        where: { id: row.id },
        data: { callbackAt: nextSlot },
      });
      const mostRecent = await prisma.tagApplication.findFirst({
        where: {
          entityType: "lead",
          entityId: row.entityId,
          isActive: true,
          callbackAt: { not: null },
        },
        orderBy: { callbackAt: "asc" },
      });
      if (mostRecent?.callbackAt) {
        await prisma.lead.update({
          where: { id: row.entityId },
          data: { callbackScheduledAt: mostRecent.callbackAt },
        });
      }
      nudged++;
      baseTime.setTime(nextSlot.getTime() + SLOT_SIZE_MINUTES * 60 * 1000);
      console.log("[fixDuplicateCallbacks] Nudged:", row.id, "lead:", row.entityId, "→", nextSlot.toISOString());
    }
  }

  console.log("[fixDuplicateCallbacks] Done. Nudged:", nudged, "Deactivated:", deactivated);
  const after = await getDuplicateGroups();
  console.log("[fixDuplicateCallbacks] Duplicate groups after fix:", after.length);
  if (after.length > 0) {
    console.error("[fixDuplicateCallbacks] WARNING: Some duplicates remain. Re-run or check logic.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
