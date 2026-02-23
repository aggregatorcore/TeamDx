import "dotenv/config";
import { prisma } from "../server/src/lib/prisma";
import { calculateShiftAwareCallback, getDefaultTelecallerShift } from "../utils/shiftUtils";

async function fixTest14Callback() {
  try {
    // Find Test14 lead
    const test14 = await prisma.lead.findFirst({
      where: {
        OR: [
          { firstName: { contains: "Test14", mode: "insensitive" } },
          { email: { contains: "test14", mode: "insensitive" } },
        ],
      },
    });

    if (!test14) {
      console.log("❌ Test14 lead not found");
      return;
    }

    console.log(`\n📋 Test14 Lead: ${test14.firstName} ${test14.lastName} (${test14.id})\n`);

    // Get active "No Answer" tag
    const tagApp = await prisma.tagApplication.findFirst({
      where: {
        entityType: "lead",
        entityId: test14.id,
        isActive: true,
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
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!tagApp) {
      console.log("❌ No active 'No Answer' tag found for Test14");
      return;
    }

    console.log(`📊 Current Tag Application:`);
    console.log(`   ID: ${tagApp.id}`);
    console.log(`   CreatedAt: ${tagApp.createdAt.toISOString()}`);
    console.log(`   CallbackAt: ${tagApp.callbackAt ? tagApp.callbackAt.toISOString() : "❌ NULL"}`);

    if (tagApp.callbackAt) {
      console.log("\n✅ CallbackAt already set! No fix needed.");
      return;
    }

    // Get workflow config
    const activeWorkflow = await prisma.workflow.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    });

    if (!activeWorkflow) {
      console.log("❌ No active workflow found");
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
      ) as any;
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
      ) as any;
      if (tag && tag.tagConfig) {
        tagConfig = tag.tagConfig;
      }
    }

    if (!tagConfig) {
      console.log("❌ 'No Answer' tag config not found in workflow");
      return;
    }

    console.log(`\n✅ Found tagConfig: autoAction=${tagConfig.autoAction}`);

    if (tagConfig.autoAction !== "CALLBACK") {
      console.log("❌ autoAction is not 'CALLBACK'");
      return;
    }

    // Get retry policy
    const retryPolicy = tagConfig.retryPolicy;
    if (!retryPolicy || !retryPolicy.attemptTimings) {
      console.log("❌ retryPolicy or attemptTimings not found");
      return;
    }

    // Parse attemptTimings
    let attemptTimings = null;
    if (Array.isArray(retryPolicy.attemptTimings)) {
      attemptTimings = retryPolicy.attemptTimings;
    } else if (typeof retryPolicy.attemptTimings === 'object') {
      const numericKeys = Object.keys(retryPolicy.attemptTimings)
        .filter(key => !isNaN(parseInt(key)))
        .sort((a, b) => parseInt(a) - parseInt(b));
      
      if (numericKeys.length > 0) {
        attemptTimings = numericKeys.map(key => {
          const value = retryPolicy.attemptTimings[key];
          if (typeof value === 'object' && value.timing) {
            return value;
          } else if (typeof value === 'string') {
            return { timing: value };
          }
          return value;
        });
      }
    }

    if (!attemptTimings || attemptTimings.length === 0) {
      console.log("❌ No attemptTimings found");
      return;
    }

    // Count attempts
    const allTags = await prisma.tagApplication.findMany({
      where: {
        entityType: "lead",
        entityId: test14.id,
        tagFlow: {
          tagValue: "no_answer",
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const attemptCount = allTags.length;
    const attemptIndex = attemptCount - 1;

    console.log(`\n📊 Attempt Info:`);
    console.log(`   Attempt Count: ${attemptCount}`);
    console.log(`   Attempt Index: ${attemptIndex}`);
    console.log(`   Max Attempts: ${retryPolicy.maxAttempts || 3}`);

    if (attemptCount > (retryPolicy.maxAttempts || 3)) {
      console.log("❌ Exceeds max attempts");
      return;
    }

    // Get timing for this attempt
    const attemptTiming = attemptTimings[Math.min(attemptIndex, attemptTimings.length - 1)];
    if (!attemptTiming || !attemptTiming.timing) {
      console.log("❌ Invalid attemptTiming");
      return;
    }

    console.log(`   Attempt Timing: ${attemptTiming.timing}`);

    // Get shift config
    let shiftConfig = getDefaultTelecallerShift();
    const user = await prisma.user.findUnique({
      where: { id: tagApp.appliedById },
      include: { role: true },
    });

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

    console.log(`   Shift: ${shiftConfig.shiftStart} - ${shiftConfig.shiftEnd}`);

    // Calculate callbackAt
    const baseTime = tagApp.createdAt;
    const callbackTime = calculateShiftAwareCallback(
      baseTime,
      attemptTiming.timing,
      shiftConfig.shiftStart,
      shiftConfig.shiftEnd
    );

    if (!callbackTime) {
      console.log("❌ calculateShiftAwareCallback returned NULL");
      return;
    }

    console.log(`\n⏰ Calculated Callback Time: ${callbackTime.toISOString()}`);

    // Update tag application
    await prisma.tagApplication.update({
      where: { id: tagApp.id },
      data: { callbackAt: callbackTime },
    });

    // Update lead's callbackScheduledAt
    const mostRecentCallback = await prisma.tagApplication.findFirst({
      where: {
        entityType: "lead",
        entityId: test14.id,
        isActive: true,
        callbackAt: { not: null },
      },
      orderBy: { callbackAt: "asc" },
    });

    if (mostRecentCallback && mostRecentCallback.callbackAt) {
      await prisma.lead.update({
        where: { id: test14.id },
        data: { callbackScheduledAt: mostRecentCallback.callbackAt },
      });
    }

    console.log(`\n✅ Fixed! CallbackAt set to: ${callbackTime.toISOString()}`);

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

fixTest14Callback();
