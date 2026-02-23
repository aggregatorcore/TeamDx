/**
 * API tests for Tag Action Rules (TEST_TAG_ACTION_RULES_2026-01-29.md)
 * Run: npx tsx scripts/test-tag-action-rules-api.ts
 * Requires: server running on http://localhost:5000, DB seeded with admin user
 */

const BASE = "http://localhost:5000";
const ADMIN = { email: "admin@immigration.com", password: "admin123" };

type Result = { name: string; pass: boolean; detail: string };

async function login(): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ADMIN),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Login failed ${res.status}: ${t}`);
  }
  const data = await res.json();
  if (!data.token) throw new Error("No token in login response");
  return data.token;
}

async function run(): Promise<Result[]> {
  const results: Result[] = [];
  let token: string;

  try {
    token = await login();
  } catch (e: any) {
    return [
      { name: "Setup", pass: false, detail: `Login failed: ${e.message}. Is server running on ${BASE}?` },
    ];
  }

  const auth = () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });
  let tagIdForUpdate: string | undefined;

  // Test 3: Null/Empty Actions allowed
  try {
    const res = await fetch(`${BASE}/api/tag-flows`, {
      method: "POST",
      headers: auth(),
      body: JSON.stringify({
        name: "QA Test Null Actions",
        tagValue: `qa_null_actions_${Date.now()}`,
        category: "custom",
        actions: null,
      }),
    });
    const ok = res.status === 201;
    const body = await res.json().catch(() => ({}));
    results.push({
      name: "Test 3: Null/Empty Actions allowed",
      pass: ok,
      detail: ok ? "Tag created with actions=null" : `Status ${res.status}: ${body.message || body.error || JSON.stringify(body)}`,
    });
  } catch (e: any) {
    results.push({ name: "Test 3: Null/Empty Actions allowed", pass: false, detail: e.message });
  }

  // Test 1: Valid Action Rule JSON saves
  const validActions = JSON.stringify({
    attempts: [
      { attemptNumber: 1, delayMinutes: 30, actions: [{ type: "createTask", params: { title: "Follow up call", description: "Call back customer" } }] },
    ],
    finalAttempt: { delayMinutes: 60, actions: [{ type: "escalate", params: {} }] },
  });
  try {
    const res = await fetch(`${BASE}/api/tag-flows`, {
      method: "POST",
      headers: auth(),
      body: JSON.stringify({
        name: "QA Test Valid Actions",
        tagValue: `qa_valid_actions_${Date.now()}`,
        category: "custom",
        actions: validActions,
      }),
    });
    const body = await res.json().catch(() => ({}));
    const ok = res.status === 201;
    results.push({
      name: "Test 1: Valid Action Rule JSON saves",
      pass: ok,
      detail: ok ? "Tag created with valid actions" : `Status ${res.status}: ${body.message || body.error || JSON.stringify(body)}`,
    });
    tagIdForUpdate = body.tagFlow?.id;
  } catch (e: any) {
    results.push({ name: "Test 1: Valid Action Rule JSON saves", pass: false, detail: e.message });
  }

  // Test 2: Invalid Action Rule JSON rejected (missing attemptNumber)
  if (tagIdForUpdate) {
    try {
      const invalidActions = JSON.stringify({
        attempts: [{ delayMinutes: 30, actions: [{ type: "createTask", params: { title: "x" } }] }],
      });
      const res = await fetch(`${BASE}/api/tag-flows/${tagIdForUpdate}`, {
        method: "PUT",
        headers: auth(),
        body: JSON.stringify({ actions: invalidActions }),
      });
      const body = await res.json().catch(() => ({}));
      const ok = res.status === 400 && (body.message?.includes("attemptNumber") || body.message?.includes("Invalid action rule"));
      results.push({
        name: "Test 2: Invalid Action Rule JSON rejected",
        pass: ok,
        detail: ok ? "400 with validation error" : `Status ${res.status}: ${body.message || body.error || JSON.stringify(body)}`,
      });
    } catch (e: any) {
      results.push({ name: "Test 2: Invalid Action Rule JSON rejected", pass: false, detail: e.message });
    }
  } else {
    results.push({ name: "Test 2: Invalid Action Rule JSON rejected", pass: false, detail: "Skipped: no tag id (Test 1 failed)" });
  }

  // Test 5: Invalid Action Type rejected
  if (tagIdForUpdate) {
    try {
      const invalidTypeActions = JSON.stringify({
        attempts: [{ attemptNumber: 1, delayMinutes: 30, actions: [{ type: "invalidAction", params: {} }] }],
      });
      const res = await fetch(`${BASE}/api/tag-flows/${tagIdForUpdate}`, {
        method: "PUT",
        headers: auth(),
        body: JSON.stringify({ actions: invalidTypeActions }),
      });
      const body = await res.json().catch(() => ({}));
      const ok = res.status === 400 && (body.message?.toLowerCase().includes("invalid") || body.message?.toLowerCase().includes("action"));
      results.push({
        name: "Test 5: Invalid Action Type rejected",
        pass: ok,
        detail: ok ? "400 with error" : `Status ${res.status}: ${body.message || body.error || JSON.stringify(body)}`,
      });
    } catch (e: any) {
      results.push({ name: "Test 5: Invalid Action Type rejected", pass: false, detail: e.message });
    }
  } else {
    results.push({ name: "Test 5: Invalid Action Type rejected", pass: false, detail: "Skipped: no tag id" });
  }

  // Test 6: Missing Required Params rejected (createTask without title)
  try {
    const tagIdNew = `qa_missing_params_${Date.now()}`;
    const createRes = await fetch(`${BASE}/api/tag-flows`, {
      method: "POST",
      headers: auth(),
      body: JSON.stringify({
        name: "QA Missing Params",
        tagValue: tagIdNew,
        category: "custom",
      }),
    });
    const createBody = await createRes.json().catch(() => ({}));
    const createdId = createBody.tagFlow?.id;
    if (!createdId) {
      results.push({ name: "Test 6: Missing Required Params rejected", pass: false, detail: "Could not create tag for update" });
    } else {
      const badActions = JSON.stringify({
        attempts: [{ attemptNumber: 1, delayMinutes: 30, actions: [{ type: "createTask", params: { description: "only desc, no title" } }] }],
      });
      const res = await fetch(`${BASE}/api/tag-flows/${createdId}`, {
        method: "PUT",
        headers: auth(),
        body: JSON.stringify({ actions: badActions }),
      });
      const body = await res.json().catch(() => ({}));
      // Backend may or may not validate createTask params - schema uses z.record(z.any()) for params. Check code.
      const rejected = res.status === 400;
      results.push({
        name: "Test 6: Missing Required Params rejected",
        pass: rejected,
        detail: rejected ? "400 with validation error" : `Status ${res.status}. Note: params are z.record(z.any()) - may not validate title. ${body.message || ""}`,
      });
    }
  } catch (e: any) {
    results.push({ name: "Test 6: Missing Required Params rejected", pass: false, detail: e.message });
  }

  // Test 4: Multiple Attempts with different actions
  try {
    const multiActions = JSON.stringify({
      attempts: [
        { attemptNumber: 1, delayMinutes: 30, actions: [{ type: "createTask", params: { title: "T1", description: "D1" } }] },
        { attemptNumber: 2, delayMinutes: 60, actions: [{ type: "sendEmail", params: { to: "a@b.com", subject: "S" } }] },
        { attemptNumber: 3, delayMinutes: 120, actions: [{ type: "sendWhatsApp", params: { phone: "+1", message: "M" } }] },
      ],
      finalAttempt: { delayMinutes: 180, actions: [{ type: "escalate", params: {} }] },
    });
    const res = await fetch(`${BASE}/api/tag-flows`, {
      method: "POST",
      headers: auth(),
      body: JSON.stringify({
        name: "QA Test Multiple Attempts",
        tagValue: `qa_multi_attempts_${Date.now()}`,
        category: "custom",
        actions: multiActions,
      }),
    });
    const ok = res.status === 201;
    const body = await res.json().catch(() => ({}));
    results.push({
      name: "Test 4: Multiple Attempts with different actions",
      pass: ok,
      detail: ok ? "Tag created with multiple attempts" : `Status ${res.status}: ${body.message || body.error || JSON.stringify(body)}`,
    });
  } catch (e: any) {
    results.push({ name: "Test 4: Multiple Attempts with different actions", pass: false, detail: e.message });
  }

  return results;
}

run()
  .then((results) => {
    console.log("\n--- Tag Action Rules API Test Results ---\n");
    results.forEach((r) => console.log(`${r.pass ? "PASS" : "FAIL"} ${r.name}\n  ${r.detail}`));
    const passed = results.filter((r) => r.pass).length;
    const failed = results.filter((r) => !r.pass).length;
    console.log(`\nTotal: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
