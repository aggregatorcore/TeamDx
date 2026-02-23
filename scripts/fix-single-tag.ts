import "dotenv/config";
import { prisma } from "../server/src/lib/prisma";
import { calculateShiftAwareCallback, getDefaultTelecallerShift } from "../utils/shiftUtils";

async function fixSingleTag() {
  try {
    const tagApplicationId = "cmlf32b5q000lscu3ik7ya0yf";
    const leadId = "cmlevpc0n000ug0u3e8nfe20b";

    console.log(`\n🔧 Fixing tag ${tagApplicationId} for lead ${leadId}...\n`);

    // Get the tag application
    const tagApp = await prisma.tagApplication.findUnique({
      where: { id: tagApplicationId },
      include: {
        tagFlow: true,
        appliedBy: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!tagApp) {
      console.error("❌ Tag application not found");
      return;
    }

    // Get active workflow
    const activeWorkflow = await prisma.workflow.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    });

    if (!activeWorkflow) {
      console.error("❌ No active workflow found");
      return;
    }

    // Parse workflow data
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
      console.error("❌ 'No Answer' tag config not found in workflow");
      return;
    }

    // Get user's shift configuration
    let shiftConfig = getDefaultTelecallerShift();
    const userId = tagApp.appliedById;

    if (userId) {
      try {
        const user = tagApp.appliedBy;
        if (user) {
          // Try user-specific shift config
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
            }
          }
        }
      } catch (shiftError) {
        console.warn(`⚠️  Failed to fetch shift config, using default`);
      }
    }

    // Count existing attempts
    const existingApplications = await prisma.tagApplication.findMany({
      where: {
        entityType: "lead",
        entityId: leadId,
        tagFlowId: tagApp.tagFlowId,
        isActive: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const attemptCount = existingApplications.length;
    const attemptIndex = existingApplications.findIndex(ta => ta.id === tagApp.id);

    // Get attempt timing from retry policy
    const retryPolicy = tagConfig.retryPolicy;
    let attemptTimings = null;

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

    if (!attemptTimings || attemptTimings.length === 0) {
      console.error("❌ No attemptTimings found");
      return;
    }

    // Use the timing for this attempt
    const attemptTiming = attemptTimings[Math.min(attemptIndex, attemptTimings.length - 1)];

    if (!attemptTiming || !attemptTiming.timing) {
      console.error(`❌ No timing found for attempt ${attemptIndex + 1}`);
      return;
    }

    // Calculate callback time
    const baseTime = tagApp.createdAt;
    const callbackTime = calculateShiftAwareCallback(
      baseTime,
      attemptTiming.timing,
      shiftConfig.shiftStart,
      shiftConfig.shiftEnd
    );

    // Update tag application
    await prisma.tagApplication.update({
      where: { id: tagApplicationId },
      data: { callbackAt: callbackTime },
    });

    // Update lead's callbackScheduledAt
    const mostRecentCallback = await prisma.tagApplication.findFirst({
      where: {
        entityType: "lead",
        entityId: leadId,
        isActive: true,
        callbackAt: { not: null },
      },
      orderBy: { callbackAt: "asc" },
    });

    if (mostRecentCallback && mostRecentCallback.callbackAt) {
      await prisma.lead.update({
        where: { id: leadId },
        data: { callbackScheduledAt: mostRecentCallback.callbackAt },
      });
    }

    console.log(`✅ Fixed tag ${tagApplicationId}`);
    console.log(`   Attempt: ${attemptIndex + 1}/${attemptCount}`);
    console.log(`   Callback: ${callbackTime.toLocaleString()}`);

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

fixSingleTag();
