import "dotenv/config";
import { prisma } from "../server/src/lib/prisma";
import { calculateShiftAwareCallback, getDefaultTelecallerShift } from "../utils/shiftUtils";

/**
 * This script automatically fixes all missing callbacks for "No Answer" tags
 * Run this periodically or whenever you see the warning message
 */
async function autoFixMissingCallbacks() {
  try {
    // Get active workflow
    const activeWorkflow = await prisma.workflow.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    });

    if (!activeWorkflow) {
      console.error("❌ No active workflow found.");
      return;
    }

    const workflowData: any = typeof activeWorkflow.workflowData === "string"
      ? JSON.parse(activeWorkflow.workflowData)
      : activeWorkflow.workflowData;

    // Find "No Answer" tag config
    let tagConfig: any = null;

    if (workflowData.tags) {
      const tag = Object.values(workflowData.tags).find((t: any) => 
        t.tagValue === "no_answer" || t.name?.toLowerCase() === "no answer"
      );
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
        t.tagValue === "no_answer" || t.name?.toLowerCase() === "no answer"
      );
      if (tag && tag.tagConfig) {
        tagConfig = tag.tagConfig;
      }
    }

    if (!tagConfig) {
      console.error("❌ 'No Answer' tag config not found in workflow.");
      return;
    }

    // Get attempt timings
    const retryPolicy = tagConfig.retryPolicy;
    let attemptTimings: any[] = [];
    
    if (retryPolicy && retryPolicy.attemptTimings) {
      if (Array.isArray(retryPolicy.attemptTimings)) {
        attemptTimings = retryPolicy.attemptTimings;
      } else if (typeof retryPolicy.attemptTimings === 'object') {
        attemptTimings = Object.keys(retryPolicy.attemptTimings)
          .filter(key => !isNaN(parseInt(key)))
          .sort((a, b) => parseInt(a) - parseInt(b))
          .map(key => retryPolicy.attemptTimings[key]);
      }
    }

    // Get all active "No Answer" tags with missing callbackAt
    const tagsWithMissingCallback = await prisma.tagApplication.findMany({
      where: {
        entityType: "lead",
        isActive: true,
        callbackAt: null,
        tagFlow: {
          tagValue: "no_answer",
        },
      },
      include: {
        tagFlow: {
          select: {
            id: true,
            name: true,
            tagValue: true,
          },
        },
        appliedBy: {
          include: {
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    if (tagsWithMissingCallback.length === 0) {
      console.log("✅ No tags with missing callbackAt found!");
      return;
    }

    console.log(`\n🔧 Fixing ${tagsWithMissingCallback.length} tag(s) with missing callbackAt...\n`);

    // Group by lead to count attempts correctly
    const leadsMap = new Map<string, any[]>();
    tagsWithMissingCallback.forEach(tag => {
      if (!leadsMap.has(tag.entityId)) {
        leadsMap.set(tag.entityId, []);
      }
      leadsMap.get(tag.entityId)!.push(tag);
    });

    let fixed = 0;

    // Process each lead
    for (const [leadId, tags] of leadsMap.entries()) {
      // Get ALL tags for this lead (to count attempts correctly)
      const allTags = await prisma.tagApplication.findMany({
        where: {
          entityType: "lead",
          entityId: leadId,
          tagFlow: {
            tagValue: "no_answer",
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      for (const tag of tags) {
        const attemptNumber = allTags.findIndex(t => t.id === tag.id) + 1;
        const attemptIndex = attemptNumber - 1;

        if (attemptNumber > 3) {
          continue; // Skip if more than max attempts
        }

        // Get user's shift configuration
        let shiftConfig = getDefaultTelecallerShift();
        const userId = tag.appliedById;

        if (userId) {
          try {
            const user = tag.appliedBy;
            if (user) {
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
              } else if (user.role) {
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
                }
              }
            }
          } catch (shiftError) {
            // Use default
          }
        }

        // Get timing for this attempt
        if (attemptTimings.length > 0) {
          const attemptTiming = attemptTimings[Math.min(attemptIndex, attemptTimings.length - 1)];
          
          if (attemptTiming && attemptTiming.timing) {
            const baseTime = tag.createdAt;
            const callbackTime = calculateShiftAwareCallback(
              baseTime,
              attemptTiming.timing,
              shiftConfig.shiftStart,
              shiftConfig.shiftEnd
            );

            // Update tag
            await prisma.tagApplication.update({
              where: { id: tag.id },
              data: { callbackAt: callbackTime },
            });

            fixed++;
          }
        }
      }

      // Update lead's callbackScheduledAt
      const activeTagsWithCallback = await prisma.tagApplication.findMany({
        where: {
          entityType: "lead",
          entityId: leadId,
          isActive: true,
          callbackAt: { not: null },
        },
        orderBy: { callbackAt: "asc" },
      });

      if (activeTagsWithCallback.length > 0) {
        const earliestCallback = activeTagsWithCallback[0].callbackAt!;
        await prisma.lead.update({
          where: { id: leadId },
          data: { callbackScheduledAt: earliestCallback },
        });
      }
    }

    console.log(`✅ Fixed ${fixed} tag(s)\n`);

  } catch (error: any) {
    console.error("\n❌ ERROR:", error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

autoFixMissingCallbacks();
