/**
 * Test 5 Backend Verification Script
 * 
 * Purpose: Verify backend call logs after Pooja's test execution
 * Usage: node ANKIT_TEST5_VERIFICATION_SCRIPT.js
 * 
 * Prerequisites:
 * - Backend running
 * - Database accessible
 * - Prisma client generated
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyTest5Calls() {
  try {
    console.log('='.repeat(80));
    console.log('TEST 5 BACKEND VERIFICATION');
    console.log('='.repeat(80));
    console.log('');

    // Get the last 10 calls (most recent)
    const calls = await prisma.call.findMany({
      take: 10,
      orderBy: {
        callDate: 'desc',
      },
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeCode: true,
          },
        },
      },
    });

    console.log(`📊 TOTAL CALLS FOUND: ${calls.length}`);
    console.log('');

    // Verification 1: Count = 10
    const countCheck = calls.length === 10;
    console.log(`✅ Count Check: ${countCheck ? 'PASS' : 'FAIL'} (Expected: 10, Found: ${calls.length})`);
    console.log('');

    // Verification 2: Status counts
    const statusCounts = {
      completed: calls.filter(c => c.status === 'completed').length,
      missed: calls.filter(c => c.status === 'missed').length,
      busy: calls.filter(c => c.status === 'busy').length,
      no_answer: calls.filter(c => c.status === 'no_answer').length,
    };

    console.log('📈 STATUS COUNTS:');
    console.log(`   - Completed: ${statusCounts.completed}`);
    console.log(`   - Missed: ${statusCounts.missed}`);
    console.log(`   - Busy: ${statusCounts.busy}`);
    console.log(`   - No Answer: ${statusCounts.no_answer}`);
    console.log('');

    // Verification 3: Durations (only answered calls should have duration > 0)
    const answeredCalls = calls.filter(c => c.status === 'completed');
    const unansweredCalls = calls.filter(c => c.status !== 'completed');
    
    const durationCheck = {
      answered: answeredCalls.every(c => c.duration && c.duration > 0),
      unanswered: unansweredCalls.every(c => !c.duration || c.duration === 0),
    };

    console.log('⏱️  DURATION CHECK:');
    console.log(`   - Answered calls (completed): ${answeredCalls.length} calls`);
    answeredCalls.forEach(c => {
      console.log(`     • Call ${c.id.substring(0, 8)}... - Duration: ${c.duration}s ${c.duration && c.duration > 0 ? '✅' : '❌'}`);
    });
    console.log(`   - Unanswered calls: ${unansweredCalls.length} calls`);
    unansweredCalls.forEach(c => {
      console.log(`     • Call ${c.id.substring(0, 8)}... - Duration: ${c.duration || 0}s ${(!c.duration || c.duration === 0) ? '✅' : '❌'}`);
    });
    console.log(`   - Duration Check: ${durationCheck.answered && durationCheck.unanswered ? 'PASS' : 'FAIL'}`);
    console.log('');

    // Verification 4: Duplicates (callId uniqueness)
    const callIds = calls.map(c => c.id);
    const uniqueCallIds = new Set(callIds);
    const duplicateCheck = callIds.length === uniqueCallIds.size;

    console.log('🔄 DUPLICATE CHECK:');
    console.log(`   - Total callIds: ${callIds.length}`);
    console.log(`   - Unique callIds: ${uniqueCallIds.size}`);
    console.log(`   - Duplicate Check: ${duplicateCheck ? 'PASS' : 'FAIL'}`);
    
    if (!duplicateCheck) {
      const duplicates = callIds.filter((id, index) => callIds.indexOf(id) !== index);
      console.log(`   - Duplicate callIds found: ${duplicates.join(', ')}`);
    }
    console.log('');

    // Verification 5: Timestamps (startTime and endTime)
    console.log('📅 TIMESTAMP CHECK:');
    calls.forEach((c, index) => {
      console.log(`   Call ${index + 1}:`);
      console.log(`     - ID: ${c.id.substring(0, 8)}...`);
      console.log(`     - Status: ${c.status}`);
      console.log(`     - StartTime: ${c.startTime ? c.startTime.toISOString() : 'null'}`);
      console.log(`     - EndTime: ${c.endTime ? c.endTime.toISOString() : 'null'}`);
      console.log(`     - CallDate: ${c.callDate.toISOString()}`);
    });
    console.log('');

    // Note about connectTime and wasConnected
    console.log('ℹ️  NOTE:');
    console.log('   - connectTime: Not stored in database schema (tracked but not persisted)');
    console.log('   - wasConnected: Not stored in database schema (used for status determination only)');
    console.log('   - These fields are used during call processing but not persisted to DB');
    console.log('');

    // Detailed call list
    console.log('📋 DETAILED CALL LIST:');
    console.log('='.repeat(80));
    calls.forEach((c, index) => {
      console.log(`\nCall ${index + 1}:`);
      console.log(`  ID: ${c.id}`);
      console.log(`  Phone: ${c.phoneNumber}`);
      console.log(`  Type: ${c.callType}`);
      console.log(`  Status: ${c.status}`);
      console.log(`  Duration: ${c.duration || 0}s`);
      console.log(`  StartTime: ${c.startTime ? c.startTime.toISOString() : 'null'}`);
      console.log(`  EndTime: ${c.endTime ? c.endTime.toISOString() : 'null'}`);
      console.log(`  CreatedBy: ${c.createdBy?.firstName} ${c.createdBy?.lastName} (${c.createdBy?.employeeCode || 'N/A'})`);
      console.log(`  Lead: ${c.lead ? `${c.lead.firstName} ${c.lead.lastName}` : 'No lead'}`);
      console.log(`  DeviceId: ${c.deviceId || 'N/A'}`);
      console.log(`  InitiatedFrom: ${c.initiatedFrom || 'N/A'}`);
    });
    console.log('='.repeat(80));
    console.log('');

    // Summary
    console.log('📊 VERIFICATION SUMMARY:');
    console.log('='.repeat(80));
    console.log(`✅ Count = 10: ${countCheck ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Durations: ${durationCheck.answered && durationCheck.unanswered ? 'PASS' : 'FAIL'}`);
    console.log(`✅ No duplicates: ${duplicateCheck ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Statuses: ${statusCounts.completed > 0 || statusCounts.missed > 0 || statusCounts.busy > 0 ? 'PASS (check counts above)' : 'FAIL'}`);
    console.log('');

    const allPassed = countCheck && durationCheck.answered && durationCheck.unanswered && duplicateCheck;
    console.log(`🎯 OVERALL: ${allPassed ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'}`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error during verification:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run verification
verifyTest5Calls()
  .then(() => {
    console.log('\n✅ Verification complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });
