/**
 * Gate Check 3 - API tests for Action Rules
 * Test 2: Invalid Action Rule JSON -> expect 400
 * Test 3: Null/Empty Actions -> expect 201
 */

const API_URL = process.env.API_URL || "http://localhost:5000";

async function login() {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@immigration.com",
      password: "admin123",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Login failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  return data.token;
}

async function createTagFlow(token, body) {
  const res = await fetch(`${API_URL}/api/tag-flows`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function run() {
  console.log("Gate Check 3 - API tests\n");
  console.log("API_URL:", API_URL);

  let token;
  try {
    token = await login();
    console.log("Login OK, token received\n");
  } catch (e) {
    console.error("Login failed. Is backend running? npm run server");
    console.error(e.message);
    process.exit(1);
  }

  // Test 2: Invalid Action Rule JSON
  console.log("--- Test 2: Invalid Action Rule JSON ---");
  const invalidBody = {
    name: "TEST_INVALID_JSON",
    tagValue: "TEST_INVALID_" + Date.now(),
    category: "custom",
    actions: '{"attempts":[{"delayMinutes":30,"actions":[]}]}', // missing attemptNumber, empty actions
  };
  const res2 = await createTagFlow(token, invalidBody);
  const test2Pass = res2.status === 400 && (res2.data.error || res2.data.message);
  console.log("Status:", res2.status);
  console.log("Response:", JSON.stringify(res2.data, null, 2));
  console.log("Test 2 (Invalid JSON rejected):", test2Pass ? "PASSED" : "FAILED");
  if (!test2Pass) console.log("  Expected: 400 with validation error message\n");

  // Test 3: Null/Empty Actions
  console.log("--- Test 3: Null/Empty Actions ---");
  const emptyBody = {
    name: "TEST_EMPTY_ACTIONS",
    tagValue: "TEST_EMPTY_" + Date.now(),
    category: "custom",
    actions: null,
  };
  const res3 = await createTagFlow(token, emptyBody);
  const test3Pass = res3.status === 201 && res3.data.tagFlow;
  console.log("Status:", res3.status);
  console.log("Response tagFlow id:", res3.data.tagFlow?.id || "none");
  console.log("Test 3 (Empty actions allowed):", test3Pass ? "PASSED" : "FAILED");
  if (!test3Pass) console.log("  Response:", JSON.stringify(res3.data, null, 2));

  console.log("\n--- Summary ---");
  console.log("Test 2 (Invalid JSON):", test2Pass ? "PASSED" : "FAILED");
  console.log("Test 3 (Empty actions):", test3Pass ? "PASSED" : "FAILED");
  process.exit(test2Pass && test3Pass ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
