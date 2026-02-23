import "dotenv/config";
import { prisma } from "../server/src/lib/prisma";
import { calculateShiftAwareCallback, getDefaultTelecallerShift } from "../utils/shiftUtils";

async function fixAllMissingCallbacks() {
  console.log("\n" + "=".repeat(100));
  console.log("🔧 FIXING ALL MISSING CALLBACKS FOR NO ANSWER TAGS");
  console.log("=".repeat(100) + "\n");

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
    let noAnswerTagFlowId: string | null = null;

    if (workflowData.tags) {
      const tag = Object.values(workflowData.tags).find((t: any) => 
        t.tagValue === "no_answer" || t.name?.toLowerCase() === "no answer"
      );
      if (tag && tag.tagConfig) {
        tagConfig = tag.tagConfig;
        noAnswerTagFlowId = tag.id || tag.tagFlowId;
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
        noAnswerTagFlowId = tag.id || tag.tagFlowId;
      }
    }

    if (!tagConfig || !noAnswerTagFlowId) {
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

    const maxAttempts = retryPolicy?.maxAttempts || 3;
    console.log(`📋 Max Attempts: ${maxAttempts}`);
    console.log(`   Attempt Timings: ${attemptTimings.length}\n`);

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

    console.log(`📊 Found ${tagsWithMissingCallback.length} active tags with missing callbackAt\n`);

    if (tagsWithMissingCallback.length === 0) {
      console.log("✅ No tags need fixing!\n");
      return;
    }

    let fixed = 0;
    let errors = 0;

    // Group by lead to count attempts
    const leadsMap = new Map<string, any[]>();
    tagsWithMissingCallback.forEach(tag => {
      if (!leadsMap.has(tag.entityId)) {
        leadsMap.set(tag.entityId, []);
      }
      leadsMap.get(tag.entityId)!.push(tag);
    });

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

        if (attemptNumber > maxAttempts) {
          console.log(`⚠️  Skipping tag ${tag.id} - attempt ${attemptNumber} exceeds max ${maxAttempts}`);
          continue;
        }

        console.log(`\n📋 Fixing tag ${tag.id}`);
        console.log(`   Lead: ${leadId}`);
        console.log(`   Attempt: ${attemptNumber}/${allTags.length}`);

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
            console.warn(`   ⚠️  Failed to fetch shift config, using default`);
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

            console.log(`   ✅ Fixed: Set callbackAt to ${callbackTime.toLocaleString()}`);
            fixed++;
          } else {
            console.error(`   ❌ No timing config found for attempt ${attemptNumber}`);
            errors++;
          }
        } else {
          console.error(`   ❌ No attemptTimings in workflow`);
          errors++;
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
        console.log(`   ✅ Updated Lead.callbackScheduledAt: ${new Date(earliestCallback).toLocaleString()}`);
      }
    }

    console.log("\n" + "=".repeat(100));
    console.log("📊 SUMMARY");
    console.log("=".repeat(100));
    console.log(`\n✅ Fixed: ${fixed}`);
    console.log(`❌ Errors: ${errors}`);
    console.log("\n✅ FIX COMPLETE\n");

  } catch (error: any) {
    console.error("\n❌ CRITICAL ERROR:", error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

fixAllMissingCallbacks();
