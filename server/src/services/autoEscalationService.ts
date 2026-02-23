/**
 * Auto-escalation (Model B): no_answer + RED + overdue >= 48h
 * At 24h: senior alert + "Escalation Required" flag only (lead stays with telecaller) — see seniorOverdueNotificationService.
 * At 48h: system reassigns lead to TL/BM, notifies, logs AUTO_ESCALATED_OVERDUE_48H.
 */

import { prisma } from "../lib/prisma";

const OVERDUE_HOURS_THRESHOLD = 48;

export async function runAutoEscalationOverdue48h(): Promise<{ escalated: number; errors: string[] }> {
  const errors: string[] = [];
  let escalated = 0;

  const now = new Date();
  const cutoff = new Date(now.getTime() - OVERDUE_HOURS_THRESHOLD * 60 * 60 * 1000);

  // Leads with active no_answer tag, callbackAt in the past and at least 48h ago
  const tagApps = await prisma.tagApplication.findMany({
    where: {
      entityType: "lead",
      isActive: true,
      callbackAt: {
        lt: cutoff, // callback was due more than 48h ago
      },
      tagFlow: {
        tagValue: { equals: "no_answer", mode: "insensitive" },
      },
    },
    include: { tagFlow: true },
  });

  const leadIds = [...new Set(tagApps.map((t) => t.entityId))];

  for (const leadId of leadIds) {
    try {
      // CRON GUARD: Idempotent — don't reassign again if 48h escalation already done
      const alreadyEscalated = await prisma.leadActivity.findFirst({
        where: { leadId, activityType: "AUTO_ESCALATED_48H" },
      });
      if (alreadyEscalated) continue;

      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        include: {
          assignedTo: {
            include: {
              role: true,
              teamLeader: { include: { role: true } },
            },
          },
        },
      });

      if (!lead) continue;
      if (!lead.assignedToId) continue;

      let managerId: string | null = null;
      let managerRole: string | null = null;

      if (lead.assignedTo?.teamLeader) {
        managerId = lead.assignedTo.teamLeader.id;
        managerRole = "TEAM_LEADER";
      } else {
        const branchManager = await prisma.user.findFirst({
          where: {
            role: { name: "BRANCH_MANAGER" },
            isActive: true,
          },
        });
        if (branchManager) {
          managerId = branchManager.id;
          managerRole = "BRANCH_MANAGER";
        }
      }

      if (!managerId) {
        errors.push(`Lead ${leadId}: No manager found to escalate to`);
        continue;
      }

      await prisma.lead.update({
        where: { id: leadId },
        data: {
          assignedToId: managerId,
          previousAssignedToId: lead.assignedToId,
        },
      });

      await prisma.leadActivity.create({
        data: {
          leadId,
          activityType: "AUTO_ESCALATED_48H",
          title: "Auto-escalated (48h overdue)",
          description: `No Answer overdue 48h - AUTO_ESCALATED_OVERDUE_48H to ${managerRole}`,
          createdById: lead.assignedToId, // telecaller context
        },
      });

      // 48H ACTION: Clear 24h "Escalation Required" flag — lead is now in senior queue
      await prisma.leadActivity.create({
        data: {
          leadId,
          activityType: "OVERDUE_ESCALATION_CLEARED",
          title: "Escalation required flag cleared",
          description: "Cleared by 48h auto-reassign; lead now with TL/BM.",
          createdById: lead.assignedToId,
        },
      });

      try {
        const { getIO } = await import("../lib/socket");
        const io = getIO();
        if (io) {
          io.to(`user:${managerId}`).emit("lead:escalated", {
            leadId,
            leadName: `${lead.firstName} ${lead.lastName}`,
            escalatedBy: "system",
            reason: "No Answer overdue 48h - auto-escalated",
          });
        }
      } catch (wsErr) {
        // non-fatal
      }

      escalated++;
    } catch (err: any) {
      errors.push(`Lead ${leadId}: ${err?.message || String(err)}`);
    }
  }

  return { escalated, errors };
}
