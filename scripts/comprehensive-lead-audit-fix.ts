import "dotenv/config";
import { prisma } from "../server/src/lib/prisma";
import { calculateShiftAwareCallback, getDefaultTelecallerShift } from "../utils/shiftUtils";
import { getLeadBucket } from "../lib/utils/buckets";
import { getCountdownText } from "../lib/utils/countdown";

interface LeadAuditResult {
  leadId: string;
  leadName: string;
  phone: string;
  issues: string[];
  fixes: string[];
  status: "perfect" | "fixed" | "needs_attention";
}

async function comprehensiveAuditAndFix() {
  console.log("\n" + "=".repeat(100));
  console.log("🔍 COMPREHENSIVE LEAD AUDIT & FIX - NO ANSWER TAGS");
  console.log("=".repeat(100) + "\n");

  try {
    // Get active workflow
    const activeWorkflow = await prisma.workflow.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    });

    if (!activeWorkflow) {
      console.error("❌ No active workflow found. Cannot proceed.");
      return;
    }

    // Parse workflow data
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

    console.log("✅ Found 'No Answer' tag config in workflow\n");

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
    console.log(`📋 Configuration:`);
    console.log(`   Max Attempts: ${maxAttempts}`);
    console.log(`   Attempt Timings: ${attemptTimings.length}`);
    attemptTimings.forEach((timing, idx) => {
      console.log(`     Attempt ${idx + 1}: ${timing.timing}`);
    });
    console.log("");

    // Get all leads that have "No Answer" tags (active or inactive)
    const allNoAnswerTags = await prisma.tagApplication.findMany({
      where: {
        entityType: "lead",
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

    // Group by lead
    const leadsMap = new Map<string, any[]>();
    allNoAnswerTags.forEach(tag => {
      if (!leadsMap.has(tag.entityId)) {
        leadsMap.set(tag.entityId, []);
      }
      leadsMap.get(tag.entityId)!.push(tag);
    });

    console.log(`📊 Found ${leadsMap.size} leads with "No Answer" tags\n`);

    const results: LeadAuditResult[] = [];
    let totalFixed = 0;
    let totalPerfect = 0;
    let totalNeedsAttention = 0;

    // Process each lead
    for (const [leadId, tags] of leadsMap.entries()) {
      const issues: string[] = [];
      const fixes: string[] = [];

      // Get lead details
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          status: true,
          callStatus: true,
          callbackScheduledAt: true,
        },
      });

      if (!lead) {
        console.log(`⚠️  Lead ${leadId} not found, skipping...`);
        continue;
      }

      const leadName = `${lead.firstName} ${lead.lastName}`;
      console.log(`\n${"=".repeat(100)}`);
      console.log(`📋 Lead: ${leadName} (${lead.phone})`);
      console.log(`   Lead ID: ${leadId}`);

      // Separate active and inactive tags
      const activeTags = tags.filter(t => t.isActive);
      const inactiveTags = tags.filter(t => !t.isActive);
      const allTagsCount = tags.length;
      const activeTagsCount = activeTags.length;
      const inactiveTagsCount = inactiveTags.length;

      console.log(`   Total Tags: ${allTagsCount} (Active: ${activeTagsCount}, Inactive: ${inactiveTagsCount})`);

      // ISSUE 1: Check attempt count logic
      // Attempt count should be based on ALL tags (active + inactive) for history
      // But only ACTIVE tags should have callbackAt set
      // Only warn if ACTIVE tags exceed maxAttempts (inactive tags are just history)
      if (activeTagsCount > maxAttempts) {
        issues.push(`⚠️  More than ${maxAttempts} ACTIVE tags found (${activeTagsCount}). Some may need to be deactivated.`);
      }

      // ISSUE 2: Check each tag's callbackAt
      let tagsFixed = 0;
      for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];
        const attemptNumber = i + 1; // 1-based
        const attemptIndex = i; // 0-based

        console.log(`\n   📌 Attempt ${attemptNumber}/${allTagsCount}:`);
        console.log(`      Tag ID: ${tag.id}`);
        console.log(`      Created: ${new Date(tag.createdAt).toLocaleString()}`);
        console.log(`      IsActive: ${tag.isActive ? "✅" : "❌"}`);
        console.log(`      CallbackAt: ${tag.callbackAt ? new Date(tag.callbackAt).toLocaleString() : "❌ NULL"}`);

        // Only fix ACTIVE tags that are missing callbackAt
        if (tag.isActive && !tag.callbackAt && attemptNumber <= maxAttempts) {
          issues.push(`❌ Attempt ${attemptNumber}: Missing callbackAt`);

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
              console.warn(`      ⚠️  Failed to fetch shift config, using default`);
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

              fixes.push(`✅ Fixed Attempt ${attemptNumber}: Set callbackAt to ${callbackTime.toLocaleString()}`);
              tagsFixed++;
              console.log(`      ✅ FIXED: Set callbackAt to ${callbackTime.toLocaleString()}`);
            } else {
              issues.push(`❌ Attempt ${attemptNumber}: No timing config found`);
            }
          } else {
            issues.push(`❌ Attempt ${attemptNumber}: No attemptTimings in workflow`);
          }
        } else if (tag.isActive && tag.callbackAt) {
          // Verify callbackAt is correct
          const now = new Date();
          const callbackTime = new Date(tag.callbackAt);
          const countdown = getCountdownText(tag.callbackAt);
          
          console.log(`      ✅ Has callbackAt`);
          console.log(`      Countdown: ${countdown}`);
        } else if (!tag.isActive) {
          console.log(`      ℹ️  Inactive tag (not fixing)`);
        }
      }

      // ISSUE 3: Check lead's callbackScheduledAt
      // Should be the earliest upcoming callback from active tags
      const activeTagsWithCallback = activeTags.filter(t => t.callbackAt !== null);
      if (activeTagsWithCallback.length > 0) {
        const earliestCallback = activeTagsWithCallback
          .map(t => new Date(t.callbackAt!))
          .sort((a, b) => a.getTime() - b.getTime())[0];

        const currentCallbackScheduled = lead.callbackScheduledAt 
          ? new Date(lead.callbackScheduledAt)
          : null;

        if (!currentCallbackScheduled || 
            Math.abs(currentCallbackScheduled.getTime() - earliestCallback.getTime()) > 60000) { // 1 minute tolerance
          
          await prisma.lead.update({
            where: { id: leadId },
            data: { callbackScheduledAt: earliestCallback },
          });

          fixes.push(`✅ Fixed Lead.callbackScheduledAt: ${earliestCallback.toLocaleString()}`);
          console.log(`   ✅ Fixed Lead.callbackScheduledAt: ${earliestCallback.toLocaleString()}`);
        }
      }

      // ISSUE 4: Check bucket assignment
      const activeTagWithCallback = activeTags.find(t => t.callbackAt !== null);
      const leadForBucket = {
        status: lead.status,
        callStatus: lead.callStatus,
        currentTag: activeTagWithCallback ? {
          callbackAt: activeTagWithCallback.callbackAt,
        } : null,
        callbackAt: lead.callbackScheduledAt,
        callbackScheduledAt: lead.callbackScheduledAt,
      };

      const expectedBucket = getLeadBucket(leadForBucket);
      console.log(`   📦 Expected Bucket: ${expectedBucket.toUpperCase()}`);

      // ISSUE 5: Verify attempt count display logic
      // Frontend should count ALL tags (active + inactive) for attempt history
      // But only ACTIVE tags should be displayed
      if (allTagsCount !== activeTagsCount && activeTagsCount > 0) {
        console.log(`   ⚠️  Note: ${inactiveTags.length} inactive tag(s) exist. Frontend should count ALL for attempt history.`);
      }

      // Determine status
      let status: "perfect" | "fixed" | "needs_attention";
      if (issues.length === 0 && fixes.length === 0) {
        status = "perfect";
        totalPerfect++;
      } else if (fixes.length > 0 && issues.length === 0) {
        status = "fixed";
        totalFixed++;
      } else {
        status = "needs_attention";
        totalNeedsAttention++;
      }

      results.push({
        leadId,
        leadName,
        phone: lead.phone,
        issues,
        fixes,
        status,
      });

      console.log(`\n   📊 Status: ${status.toUpperCase()}`);
      if (fixes.length > 0) {
        console.log(`   ✅ Fixes Applied: ${fixes.length}`);
      }
      if (issues.length > 0) {
        console.log(`   ⚠️  Issues: ${issues.length}`);
      }
    }

    // Final Summary
    console.log("\n" + "=".repeat(100));
    console.log("📊 FINAL SUMMARY");
    console.log("=".repeat(100));
    console.log(`\n✅ Perfect: ${totalPerfect}`);
    console.log(`🔧 Fixed: ${totalFixed}`);
    console.log(`⚠️  Needs Attention: ${totalNeedsAttention}`);
    console.log(`📋 Total Leads Processed: ${results.length}`);

    // Show leads that need attention
    const needsAttention = results.filter(r => r.status === "needs_attention");
    if (needsAttention.length > 0) {
      console.log(`\n⚠️  LEADS NEEDING ATTENTION (${needsAttention.length}):`);
      needsAttention.forEach(lead => {
        console.log(`\n   ${lead.leadName} (${lead.phone})`);
        lead.issues.forEach(issue => console.log(`      ${issue}`));
      });
    }

    // Show all fixes applied
    const allFixes = results.filter(r => r.fixes.length > 0);
    if (allFixes.length > 0) {
      console.log(`\n✅ FIXES APPLIED (${allFixes.length} leads):`);
      allFixes.forEach(lead => {
        console.log(`\n   ${lead.leadName} (${lead.phone})`);
        lead.fixes.forEach(fix => console.log(`      ${fix}`));
      });
    }

    console.log("\n" + "=".repeat(100));
    console.log("✅ AUDIT & FIX COMPLETE");
    console.log("=".repeat(100) + "\n");

  } catch (error: any) {
    console.error("\n❌ CRITICAL ERROR:", error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

comprehensiveAuditAndFix();
