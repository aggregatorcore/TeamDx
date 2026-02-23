/**
 * Senior (TL/Manager) notification when telecaller misses a scheduled call (Model B).
 * Fires when lead is overdue >= 24h; one notification per lead per 24h (dedup).
 * Also creates "Escalation Required" flag (LeadActivity OVERDUE_ESCALATION_REQUIRED) — lead stays with telecaller.
 * At 48h overdue, autoEscalationService reassigns to TL/BM.
 */

import { prisma } from "../lib/prisma";

const DEDUP_HOURS = 24;
const OVERDUE_HOURS_FOR_ALERT = 24; // Only notify seniors when overdue >= 24h

export async function runSeniorOverdueNotifications(): Promise<{ notified: number; errors: string[] }> {
  const errors: string[] = [];
  let notified = 0;
  const now = new Date();
  const since = new Date(now.getTime() - DEDUP_HOURS * 60 * 60 * 1000);
  const cutoff24h = new Date(now.getTime() - OVERDUE_HOURS_FOR_ALERT * 60 * 60 * 1000);

  // Overdue >= 24h: callbackAt in the past and at least 24h ago (no_answer only for escalation context)
  const tagApps = await prisma.tagApplication.findMany({
    where: {
      entityType: "lead",
      isActive: true,
      callbackAt: { lt: cutoff24h },
      tagFlow: {
        tagValue: { equals: "no_answer", mode: "insensitive" },
      },
    },
    include: {
      tagFlow: true,
    },
  });

  const leadIdsByEntity = new Map<string, { callbackAt: Date; tagValue: string }>();
  for (const ta of tagApps) {
    const existing = leadIdsByEntity.get(ta.entityId);
    if (!existing || (ta.callbackAt && (!existing.callbackAt || ta.callbackAt > existing.callbackAt))) {
      leadIdsByEntity.set(ta.entityId, {
        callbackAt: ta.callbackAt!,
        tagValue: ta.tagFlow?.tagValue ?? "",
      });
    }
  }

  for (const [leadId, { callbackAt }] of leadIdsByEntity) {
    try {
      // CRON GUARD: Idempotent — don't repeat 24h alert if already done
      const alreadyEscalationRequired = await prisma.leadActivity.findFirst({
        where: {
          leadId,
          activityType: "OVERDUE_ESCALATION_REQUIRED",
          createdAt: { gte: since },
        },
      });
      if (alreadyEscalationRequired) continue;

      // CRON GUARD: Skip if lead already reassigned at 48h (no point notifying for senior's own lead)
      const alreadyReassigned48h = await prisma.leadActivity.findFirst({
        where: { leadId, activityType: "AUTO_ESCALATED_48H" },
      });
      if (alreadyReassigned48h) continue;

      const alreadyNotified = await prisma.leadActivity.findFirst({
        where: {
          leadId,
          activityType: "OVERDUE_SENIOR_NOTIFIED",
          createdAt: { gte: since },
        },
      });
      if (alreadyNotified) continue;

      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        include: {
          assignedTo: {
            include: { role: true },
          },
        },
      });
      if (!lead || !lead.assignedToId) continue;
      const telecaller = lead.assignedTo;
      const overdueMs = now.getTime() - new Date(callbackAt).getTime();
      const overdueHours = Math.floor(overdueMs / (60 * 60 * 1000));
      const overdueMins = Math.floor((overdueMs % (60 * 60 * 1000)) / (60 * 1000));

      let attemptNumber = 1;
      const noAnswerCount = await prisma.tagApplication.count({
        where: {
          entityType: "lead",
          entityId: leadId,
          appliedById: lead.assignedToId,
          tagFlow: { tagValue: { equals: "no_answer", mode: "insensitive" } },
        },
      });
      attemptNumber = Math.min(noAnswerCount, 3);

      const seniorUsers = await prisma.user.findMany({
        where: {
          isActive: true,
          role: {
            name: { in: ["TEAM_LEADER", "BRANCH_MANAGER", "ADMIN"] },
          },
        },
        select: { id: true },
      });

      const payload = {
        leadId: lead.id,
        leadName: `${lead.firstName} ${lead.lastName}`,
        phone: lead.phone,
        telecallerId: telecaller.id,
        telecallerName: `${telecaller.firstName} ${telecaller.lastName}`,
        attemptNumber,
        overdueAge: overdueHours > 0 ? `${overdueHours}h ${overdueMins}m` : `${overdueMins}m`,
        overdueAt: callbackAt,
      };

      const { getIO } = await import("../lib/socket");
      const io = getIO();
      if (io) {
        for (const u of seniorUsers) {
          io.to(`user:${u.id}`).emit("lead:overdue_telecaller_missed", payload);
        }
      }

      await prisma.leadActivity.create({
        data: {
          leadId,
          activityType: "OVERDUE_SENIOR_NOTIFIED",
          title: "Telecaller missed scheduled call",
          description: `Senior notified: ${lead.firstName} ${lead.lastName} overdue (attempt ${attemptNumber}/3, ${payload.overdueAge})`,
          createdById: lead.assignedToId,
        },
      });

      // Model B: "Escalation Required" flag (only once per 24h; guard above ensures we don't repeat)
      await prisma.leadActivity.create({
        data: {
          leadId,
          activityType: "OVERDUE_ESCALATION_REQUIRED",
          title: "Escalation Required",
          description: `No Answer overdue 24h - senior notified; lead remains with telecaller until 48h auto-reassign`,
          createdById: lead.assignedToId,
        },
      });

      notified++;
    } catch (err: any) {
      errors.push(`Lead ${leadId}: ${err?.message || String(err)}`);
    }
  }

  return { notified, errors };
}
