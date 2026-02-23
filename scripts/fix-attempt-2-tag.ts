import "dotenv/config";
import { prisma } from "../server/src/lib/prisma";
import { calculateShiftAwareCallback, getDefaultTelecallerShift } from "../utils/shiftUtils";

async function fixAttempt2Tag() {
  try {
    // Find the lead with attempt 2/3
    const leadId = "cmlevpc0n000ug0u3e8nfe20b"; // From the user's message
    
    console.log(`\n🔧 Fixing attempt 2 tag for lead ${leadId}...\n`);

    // Get all active "No Answer" tag applications for this lead
    const tagApplications = await prisma.tagApplication.findMany({
      where: {
        entityType: "lead",
        entityId: leadId,
        isActive: true,
        tagFlow: {
          tagValue: "no_answer",
        },
      },
      include: {
        tagFlow: true,
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

    if (tagApplications.length < 2) {
      console.log(`⚠️  Only ${tagApplications.length} tag(s) found. Need at least 2 for attempt 2.`);
      return;
    }

    // Get the second tag (attempt 2)
    const attempt2Tag = tagApplications[1]; // Index 1 = second attempt

    if (attempt2Tag.callbackAt) {
      console.log(`✅ Attempt 2 tag already has callbackAt: ${new Date(attempt2Tag.callbackAt).toLocaleString()}`);
      return;
    }

    console.log(`📋 Found attempt 2 tag: ${attempt2Tag.id}`);
    console.log(`   Created: ${new Date(attempt2Tag.createdAt).toLocaleString()}`);
    console.log(`   CallbackAt: ${attempt2Tag.callbackAt ? new Date(attempt2Tag.callbackAt).toLocaleString() : "❌ NULL"}`);

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
    const userId = attempt2Tag.appliedById;

    if (userId) {
      try {
        const user = attempt2Tag.appliedBy;
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
        console.warn(`⚠️  Failed to fetch shift config, using default`);
      }
    }

    // Get attempt timing from retry policy (attempt 2 = index 1)
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

    if (!attemptTimings || attemptTimings.length < 2) {
      console.error("❌ No attemptTimings found or less than 2 attempts configured");
      return;
    }

    // Use timing for attempt 2 (index 1)
    const attempt2Timing = attemptTimings[1]; // Index 1 = second attempt

    if (!attempt2Timing || !attempt2Timing.timing) {
      console.error(`❌ No timing found for attempt 2`);
      return;
    }

    // Calculate callback time
    const baseTime = attempt2Tag.createdAt;
    const callbackTime = calculateShiftAwareCallback(
      baseTime,
      attempt2Timing.timing,
      shiftConfig.shiftStart,
      shiftConfig.shiftEnd
    );

    // Update tag application
    await prisma.tagApplication.update({
      where: { id: attempt2Tag.id },
      data: { callbackAt: callbackTime },
    });

    // Update lead's callbackScheduledAt (use earliest upcoming callback)
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

    console.log(`✅ Fixed attempt 2 tag ${attempt2Tag.id}`);
    console.log(`   Callback: ${callbackTime.toLocaleString()}`);

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

fixAttempt2Tag();
