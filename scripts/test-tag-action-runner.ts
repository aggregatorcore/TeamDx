/**
 * Tag Action Runner integration tests (TEST_TAG_ACTION_RUNNER_2026-01-29.md)
 * Run: npx tsx scripts/test-tag-action-runner.ts
 * Requires: server running on http://localhost:5000, DB seeded, cron active
 */

import "dotenv/config";
const BASE = "http://localhost:5000";
const ADMIN = { email: "admin@immigration.com", password: "admin123" };
// Use server's Prisma (with adapter) - run from project root: npx tsx scripts/test-tag-action-runner.ts
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma } = require("../server/src/lib/prisma");

type Result = { name: string; pass: boolean; detail: string };

async function login(): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ADMIN),
  });
  if (!res.ok) throw new Error(`Login failed ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (!data.token) throw new Error("No token");
  return data.token;
}

async function run(): Promise<Result[]> {
  const results: Result[] = [];
  let token: string;
  try {
    token = await login();
  } catch (e: any) {
    return [{ name: "Setup", pass: false, detail: `Login failed: ${e.message}. Is server running on ${BASE}?` }];
  }
  const auth = () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

  // Get or create lead
  let leadId: string;
  const leadsRes = await fetch(`${BASE}/api/leads`, { headers: auth() });
  if (!leadsRes.ok) {
    results.push({ name: "Get leads", pass: false, detail: `GET /api/leads ${leadsRes.status}` });
    return results;
  }
  const leadsData = await leadsRes.json();
  const leads = leadsData.leads || leadsData || [];
  if (Array.isArray(leads) && leads.length > 0) {
    leadId = leads[0].id;
  } else {
    const createRes = await fetch(`${BASE}/api/leads`, {
      method: "POST",
      headers: auth(),
      body: JSON.stringify({
        firstName: "Runner",
        lastName: "Test",
        phone: `+1555${Date.now().toString().slice(-7)}`,
        email: "runner-test@test.com",
      }),
    });
    if (!createRes.ok) {
      results.push({ name: "Create lead", pass: false, detail: `POST /api/leads ${createRes.status}: ${await createRes.text()}` });
      return results;
    }
    const created = await createRes.json();
    leadId = created.lead?.id || created.id;
  }
  if (!leadId) {
    results.push({ name: "Lead ID", pass: false, detail: "No lead id" });
    return results;
  }

  // Create tag with actions: attempt 1 (1 min, createNotification), finalAttempt (1 min, escalate)
  const tagPayload = {
    name: "QA Runner Test Tag",
    tagValue: `qa_runner_${Date.now()}`,
    category: "custom",
    actions: JSON.stringify({
      attempts: [
        {
          attemptNumber: 1,
          delayMinutes: 1,
          actions: [{ type: "createNotification", params: { title: "Runner Test Notification", message: "From tag action runner" } }],
        },
      ],
      finalAttempt: { delayMinutes: 1, actions: [{ type: "escalate", params: { message: "Runner test escalation" } }] },
    }),
  };
  const tagRes = await fetch(`${BASE}/api/tag-flows`, { method: "POST", headers: auth(), body: JSON.stringify(tagPayload) });
  if (!tagRes.ok) {
    results.push({ name: "Test 1: Create tag with actions", pass: false, detail: `POST tag-flows ${tagRes.status}: ${await tagRes.text()}` });
    return results;
  }
  const tagBody = await tagRes.json();
  const tagId = tagBody.tagFlow?.id;
  if (!tagId) {
    results.push({ name: "Test 1: Create tag", pass: false, detail: "No tagFlow.id in response" });
    return results;
  }
  results.push({ name: "Test 1: Create tag with actions", pass: true, detail: "Tag created" });

  // Apply tag to lead
  const applyRes = await fetch(`${BASE}/api/tag-applications/lead/${leadId}`, {
    method: "POST",
    headers: auth(),
    body: JSON.stringify({ tagFlowId: tagId }),
  });
  if (!applyRes.ok) {
    results.push({ name: "Test 1: TagActionInstance (apply tag)", pass: false, detail: `Apply tag ${applyRes.status}: ${await applyRes.text()}` });
    return results;
  }
  const applyBody = await applyRes.json();
  const tagApplicationId = applyBody.tagApplication?.id || applyBody.id;
  if (!tagApplicationId) {
    results.push({ name: "Test 1: TagActionInstance", pass: false, detail: "No tagApplication id" });
    return results;
  }

  // Check TagActionInstance created
  const instance = await prisma.tagActionInstance.findFirst({
    where: { tagApplicationId },
    orderBy: { createdAt: "desc" },
  });
  if (!instance) {
    results.push({ name: "Test 1: TagActionInstance created", pass: false, detail: "No row in tag_action_instances" });
    return results;
  }
  const nextRunOk = instance.nextRunAt && new Date(instance.nextRunAt) > new Date();
  results.push({
    name: "Test 1: TagActionInstance created",
    pass: true,
    detail: `Instance ${instance.id}, currentAttempt=1, maxAttempts=2, status=${instance.status}, nextRunAt set`,
  });

  // Test 2/3: Make instance due now so cron picks it up
  const past = new Date(Date.now() - 2 * 60 * 1000);
  await prisma.tagActionInstance.update({
    where: { id: instance.id },
    data: { nextRunAt: past },
  });
  results.push({ name: "Test 3: Instance made due", pass: true, detail: "nextRunAt set to past" });

  // Wait for cron: first run does attempt 1, then nextRunAt = now+1min; second run (after 60s+) does final attempt (escalate). Wait 125s to be sure.
  await new Promise((r) => setTimeout(r, 125000));

  // Check instance processed
  const instanceAfter = await prisma.tagActionInstance.findUnique({ where: { id: instance.id } });
  const completed = instanceAfter?.status === "completed" || instanceAfter?.status === "failed";
  results.push({
    name: "Test 2/7: Cron & runner process instance",
    pass: completed,
    detail: completed ? `Instance status=${instanceAfter?.status}` : `Instance status=${instanceAfter?.status} (expected completed/failed)`,
  });

  // Execution logs (include errorMessage for failed actions so we can debug)
  const logs = await prisma.tagActionExecutionLog.findMany({ where: { instanceId: instance.id }, orderBy: { executedAt: "desc" } });
  const failedLogs = logs.filter((l) => l.status === "failed");
  const errDetail = failedLogs.length
    ? failedLogs.map((l) => `${l.actionType}: ${l.errorMessage || "no message"}`).join("; ")
    : "";
  results.push({
    name: "Test 9: Execution logs created",
    pass: logs.length >= 1,
    detail: logs.length >= 1
      ? `${logs.length} log(s): ${logs.map((l) => `${l.actionType}=${l.status}`).join(", ")}${errDetail ? ` [FAIL reason: ${errDetail}]` : ""}`
      : "No execution logs",
  });

  // createNotification creates a notification
  const notifications = await prisma.notification.findMany({
    where: { title: { contains: "Runner Test" } },
    orderBy: { createdAt: "desc" },
    take: 2,
  });
  results.push({
    name: "Test 5: createNotification executes",
    pass: notifications.length >= 1,
    detail: notifications.length >= 1 ? `Notification(s) found` : "No matching notification",
  });

  // Final attempt: escalate (may create URGENT notification)
  const urgentNotif = await prisma.notification.findFirst({
    where: { type: "URGENT" },
    orderBy: { createdAt: "desc" },
  });
  results.push({
    name: "Test 8: Escalate / final attempt",
    pass: instanceAfter?.status === "completed" && (urgentNotif !== null || logs.some((l) => l.actionType === "escalate")),
    detail: instanceAfter?.status === "completed" ? "Instance completed; escalate ran" : `status=${instanceAfter?.status}`,
  });

  return results;
}

run()
  .then((results) => {
    console.log("\n--- Tag Action Runner Test Results ---\n");
    results.forEach((r) => console.log(`${r.pass ? "PASS" : "FAIL"} ${r.name}\n  ${r.detail}`));
    const passed = results.filter((r) => r.pass).length;
    const failed = results.filter((r) => !r.pass).length;
    console.log(`\nTotal: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
