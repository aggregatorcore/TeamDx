import "dotenv/config";
import { prisma } from "../server/src/lib/prisma";
import { calculateShiftAwareCallback, getDefaultTelecallerShift } from "../utils/shiftUtils";

async function fixMissingCallbacks() {
  try {
    console.log("\n🔧 Fixing missing callbackAt for 'No Answer' tags...\n");

    // Get active workflow
    const activeWorkflow = await prisma.workflow.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    });

    if (!activeWorkflow) {
      console.error("❌ No active workflow found. Cannot fix callbacks.");
      return;
    }

    // Parse workflow data
    const workflowData: any = typeof activeWorkflow.workflowData === "string"
      ? JSON.parse(activeWorkflow.workflowData)
      : activeWorkflow.workflowData;

    // Find "No Answer" tag config
    let tagConfig: any = null;
    let noAnswerTagFlowId: string | null = null;

    // Check in tags object
    if (workflowData.tags) {
      const tag = Object.values(workflowData.tags).find((t: any) => 
        t.tagValue === "no_answer" || t.name?.toLowerCase() === "no answer"
      );
      if (tag && tag.tagConfig) {
        tagConfig = tag.tagConfig;
        noAnswerTagFlowId = tag.id || tag.tagFlowId;
      }
    }

    // Check in tagGroups if not found
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

    console.log("✅ Found 'No Answer' tag config in workflow");

    // Get all active "No Answer" tag applications missing callbackAt
    const tagsWithoutCallback = await prisma.tagApplication.findMany({
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
            tagValue: true,
            name: true,
          },
        },
        appliedBy: {
          select: {
            id: true,
            email: true,
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (tagsWithoutCallback.length === 0) {
      console.log("✅ No tags missing callbackAt. All good!");
      return;
    }

    console.log(`\n📊 Found ${tagsWithoutCallback.length} tag(s) missing callbackAt\n`);

    let fixed = 0;
    let failed = 0;

    // Process each tag
    for (const tagApp of tagsWithoutCallback) {
      try {
        const leadId = tagApp.entityId;
        const userId = tagApp.appliedById || tagApp.appliedBy?.id;

        // Get user's shift configuration
        let shiftConfig = getDefaultTelecallerShift();
        if (userId) {
          try {
            const user = await prisma.user.findUnique({
              where: { id: userId },
              include: { role: true },
            });

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
            console.warn(`⚠️  Failed to fetch shift config for user ${userId}, using default`);
          }
        }

        // Count existing attempts for this lead
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
          console.warn(`⚠️  No attemptTimings found for tag ${tagApp.id}`);
          failed++;
          continue;
        }

        // Use the timing for this attempt (attemptIndex is 0-based)
        const attemptTiming = attemptTimings[Math.min(attemptIndex, attemptTimings.length - 1)];
        
        if (!attemptTiming || !attemptTiming.timing) {
          console.warn(`⚠️  No timing found for attempt ${attemptIndex + 1} of tag ${tagApp.id}`);
          failed++;
          continue;
        }

        // Calculate callback time based on when tag was applied (or now if too old)
        const baseTime = tagApp.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000) 
          ? tagApp.createdAt 
          : new Date();

        // Use shift-aware callback calculation
        const callbackTime = calculateShiftAwareCallback(
          baseTime,
          attemptTiming.timing,
          shiftConfig.shiftStart,
          shiftConfig.shiftEnd
        );

        // Update tag application
        await prisma.tagApplication.update({
          where: { id: tagApp.id },
          data: { callbackAt: callbackTime },
        });

        // Update lead's callbackScheduledAt (use the most recent callback)
        const mostRecentCallback = await prisma.tagApplication.findFirst({
          where: {
            entityType: "lead",
            entityId: leadId,
            isActive: true,
            callbackAt: { not: null },
          },
          orderBy: { callbackAt: "asc" }, // Get earliest (next) callback
        });

        if (mostRecentCallback && mostRecentCallback.callbackAt) {
          await prisma.lead.update({
            where: { id: leadId },
            data: { callbackScheduledAt: mostRecentCallback.callbackAt },
          });
        }

        console.log(`✅ Fixed tag ${tagApp.id} (Lead: ${leadId}, Attempt: ${attemptIndex + 1}/${attemptCount}, Callback: ${callbackTime.toLocaleString()})`);
        fixed++;

      } catch (error: any) {
        console.error(`❌ Failed to fix tag ${tagApp.id}:`, error.message);
        failed++;
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log(`\n📈 Summary:`);
    console.log(`   ✅ Fixed: ${fixed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   Total: ${tagsWithoutCallback.length}\n`);

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

fixMissingCallbacks();
