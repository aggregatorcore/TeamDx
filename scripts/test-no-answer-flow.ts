/**
 * NOT_CONNECTED → NO_ANSWER flow test (TEST_ASSIGNMENT_NOT_CONNECTED_NO_ANSWER.md)
 * Run: npx tsx scripts/test-no-answer-flow.ts
 * Requires: server running on http://localhost:5000, DB seeded
 * Note: Seed has NO_ANSWER (no_answer, busy_no_response). NOT_CONNECTED not in seed; we test NO_ANSWER flow only.
 */

import "dotenv/config";
const BASE = "http://localhost:5000";
const ADMIN = { email: "admin@immigration.com", password: "admin123" };
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

  // Get NO_ANSWER tag (seed: tagValue no_answer, category busy_no_response)
  const tagFlowsRes = await fetch(`${BASE}/api/tag-flows`, { headers: auth() });
  if (!tagFlowsRes.ok) {
    results.push({ name: "Get tag flows", pass: false, detail: `GET tag-flows ${tagFlowsRes.status}` });
    return results;
  }
  const tagFlowsData = await tagFlowsRes.json();
  const tagFlows = tagFlowsData.tagFlows || tagFlowsData || [];
  const noAnswerTag = Array.isArray(tagFlows)
    ? tagFlows.find((t: any) => t.tagValue === "no_answer" && (t.category === "busy_no_response" || !t.category))
    : null;
  if (!noAnswerTag?.id) {
    results.push({
      name: "NO_ANSWER tag",
      pass: false,
      detail: "NO_ANSWER tag (no_answer, busy_no_response) not found. Run db:seed.",
    });
    return results;
  }
  results.push({ name: "NO_ANSWER tag found", pass: true, detail: `Tag id=${noAnswerTag.id}` });

  // Ensure NO_ANSWER has new-format action rules (attempts + finalAttempt) so instance is created
  const newActions = JSON.stringify({
    attempts: [
      {
        attemptNumber: 1,
        delayMinutes: 1,
        actions: [{ type: "createNotification", params: { title: "NO_ANSWER Flow Test", message: "Attempt 1 notification" } }],
      },
    ],
    finalAttempt: { delayMinutes: 1, actions: [{ type: "escalate", params: { message: "NO_ANSWER flow escalation" } }] },
  });
  const putRes = await fetch(`${BASE}/api/tag-flows/${noAnswerTag.id}`, {
    method: "PUT",
    headers: auth(),
    body: JSON.stringify({ actions: newActions }),
  });
  if (!putRes.ok) {
    results.push({ name: "Update NO_ANSWER actions", pass: false, detail: `PUT tag-flows ${putRes.status}: ${await putRes.text()}` });
    return results;
  }
  results.push({ name: "NO_ANSWER action rules updated", pass: true, detail: "Attempt 1 + finalAttempt (escalate)" });

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
        firstName: "NoAnswer",
        lastName: "FlowTest",
        phone: `+1999${Date.now().toString().slice(-7)}`,
        email: "noanswer-flow@test.com",
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
  results.push({ name: "Lead for tag apply", pass: true, detail: `leadId=${leadId}` });

  // Apply NO_ANSWER tag to lead (NOT_CONNECTED not in seed; we apply NO_ANSWER only). Seed NO_ANSWER has requiresCallback: true.
  const callbackAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // tomorrow
  const applyRes = await fetch(`${BASE}/api/tag-applications/lead/${leadId}`, {
    method: "POST",
    headers: auth(),
    body: JSON.stringify({ tagFlowId: noAnswerTag.id, callbackAt }),
  });
  if (!applyRes.ok) {
    results.push({ name: "Apply NO_ANSWER tag", pass: false, detail: `Apply tag ${applyRes.status}: ${await applyRes.text()}` });
    return results;
  }
  const applyBody = await applyRes.json();
  const tagApplicationId = applyBody.tagApplication?.id || applyBody.id;
  if (!tagApplicationId) {
    results.push({ name: "TagApplication created", pass: false, detail: "No tagApplication id" });
    return results;
  }
  results.push({ name: "Tag application (NO_ANSWER)", pass: true, detail: "Tag applied to lead" });

  // Verify TagActionInstance created
  const instance = await prisma.tagActionInstance.findFirst({
    where: { tagApplicationId },
    orderBy: { createdAt: "desc" },
  });
  if (!instance) {
    results.push({ name: "TagActionInstance created", pass: false, detail: "No row in tag_action_instances" });
    return results;
  }
  results.push({
    name: "TagActionInstance created",
    pass: true,
    detail: `Instance ${instance.id}, currentAttempt=1, maxAttempts=2, status=${instance.status}`,
  });

  // Make instance due so cron picks it up
  const past = new Date(Date.now() - 2 * 60 * 1000);
  await prisma.tagActionInstance.update({
    where: { id: instance.id },
    data: { nextRunAt: past },
  });
  results.push({ name: "Instance made due", pass: true, detail: "nextRunAt set to past" });

  // Wait for cron: attempt 1 then final attempt (125s)
  await new Promise((r) => setTimeout(r, 125000));

  const instanceAfter = await prisma.tagActionInstance.findUnique({ where: { id: instance.id } });
  const completed = instanceAfter?.status === "completed" || instanceAfter?.status === "failed";
  results.push({
    name: "Runner processes instance",
    pass: completed,
    detail: completed ? `Instance status=${instanceAfter?.status}` : `Instance status=${instanceAfter?.status} (expected completed/failed)`,
  });

  const logs = await prisma.tagActionExecutionLog.findMany({
    where: { instanceId: instance.id },
    orderBy: { executedAt: "desc" },
  });
  results.push({
    name: "Execution logs created",
    pass: logs.length >= 1,
    detail: logs.length >= 1 ? `${logs.length} log(s): ${logs.map((l: any) => `${l.actionType}=${l.status}`).join(", ")}` : "No execution logs",
  });

  const notifications = await prisma.notification.findMany({
    where: { title: { contains: "NO_ANSWER" } },
    orderBy: { createdAt: "desc" },
    take: 2,
  });
  results.push({
    name: "createNotification executed",
    pass: notifications.length >= 1,
    detail: notifications.length >= 1 ? "Notification(s) found" : "No matching notification",
  });

  results.push({
    name: "Instance completed / escalate",
    pass: instanceAfter?.status === "completed" && logs.some((l: any) => l.actionType === "escalate"),
    detail: instanceAfter?.status === "completed" ? "Instance completed; escalate ran" : `status=${instanceAfter?.status}`,
  });

  return results;
}

run()
  .then((results) => {
    console.log("\n--- NOT_CONNECTED → NO_ANSWER Flow Test Results ---\n");
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
