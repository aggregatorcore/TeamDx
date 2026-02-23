/**
 * Test Script: Audit Trail Real-time WebSocket Integration
 * Tests Socket.IO connection, authentication, and audit event broadcasting
 * 
 * Usage: node test_audit_realtime.js
 * Prerequisites: 
 *   - Backend server running on port 5000
 *   - Node.js 18+ (for native fetch support)
 *   - socket.io-client package installed
 * 
 * Environment Variables:
 *   - API_URL: Backend API URL (default: http://localhost:5000)
 *   - TEST_EMAIL: Test user email (default: admin@immigration.com)
 *   - TEST_PASSWORD: Test user password (default: admin123)
 */

const { io } = require("socket.io-client");

// Check Node.js version for fetch support
if (typeof fetch === 'undefined') {
  console.error('❌ Error: fetch is not available. This script requires Node.js 18+ or install node-fetch');
  console.error('   Install: npm install node-fetch@2');
  console.error('   Or upgrade to Node.js 18+');
  process.exit(1);
}

const API_URL = process.env.API_URL || "http://localhost:5000";
const TEST_EMAIL = process.env.TEST_EMAIL || "admin@immigration.com";
const TEST_PASSWORD = process.env.TEST_PASSWORD || "admin123";

let authToken = null;
let socket = null;
let testResults = {
  connection: { passed: 0, failed: 0, tests: [] },
  authentication: { passed: 0, failed: 0, tests: [] },
  broadcasting: { passed: 0, failed: 0, tests: [] },
  recovery: { passed: 0, failed: 0, tests: [] },
};

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName, passed, details = "") {
  const status = passed ? "✅ PASS" : "❌ FAIL";
  const color = passed ? "green" : "red";
  log(`  ${status}: ${testName}`, color);
  if (details) {
    log(`    ${details}`, "cyan");
  }
  return passed;
}

// Step 1: Get authentication token
async function getAuthToken() {
  log("\n=== Step 1: Authentication Token ===", "blue");
  
  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Login failed: ${response.status} - ${error}`);
    }

    const data = await response.json();
    authToken = data.token;
    
    logTest("Login successful", true, `Token received: ${authToken.substring(0, 20)}...`);
    return true;
  } catch (error) {
    logTest("Login successful", false, error.message);
    return false;
  }
}

// Step 2: Test Socket.IO connection
function testConnection() {
  return new Promise((resolve) => {
    log("\n=== Step 2: Socket.IO Connection Test ===", "blue");
    
    let connectionTimeout;
    let connected = false;

    socket = io(API_URL, {
      auth: { token: authToken },
      transports: ["websocket", "polling"],
      reconnection: false, // Disable auto-reconnect for testing
    });

    // Test 2.1: Connection established
    socket.on("connect", () => {
      connected = true;
      clearTimeout(connectionTimeout);
      const passed = logTest("Connection established", true, `Socket ID: ${socket.id}`);
      testResults.connection.tests.push({ name: "Connection established", passed });
      if (passed) testResults.connection.passed++;
      else testResults.connection.failed++;
    });

    // Test 2.2: Connection error (should not happen with valid token)
    socket.on("connect_error", (error) => {
      clearTimeout(connectionTimeout);
      const passed = logTest("Connection error", false, error.message);
      testResults.connection.tests.push({ name: "Connection error", passed, error: error.message });
      testResults.connection.failed++;
      resolve(false);
    });

    // Test 2.3: Disconnect event
    socket.on("disconnect", (reason) => {
      if (connected) {
        const passed = logTest("Disconnect event received", true, `Reason: ${reason}`);
        testResults.connection.tests.push({ name: "Disconnect event", passed, reason });
        if (passed) testResults.connection.passed++;
      }
    });

    // Timeout for connection
    connectionTimeout = setTimeout(() => {
      if (!connected) {
        const passed = logTest("Connection timeout", false, "Connection not established within 5 seconds");
        testResults.connection.tests.push({ name: "Connection timeout", passed });
        testResults.connection.failed++;
        resolve(false);
      }
    }, 5000);

    // Wait for connection
    setTimeout(() => {
      if (connected) {
        resolve(true);
      }
    }, 2000);
  });
}

// Step 3: Test authentication
function testAuthentication() {
  return new Promise((resolve) => {
    log("\n=== Step 3: Authentication Test ===", "blue");

    // Test 3.1: Valid token authentication
    if (socket && socket.connected) {
      const passed = logTest("Valid token authentication", true, "Socket connected with valid token");
      testResults.authentication.tests.push({ name: "Valid token", passed });
      testResults.authentication.passed++;
    } else {
      const passed = logTest("Valid token authentication", false, "Socket not connected");
      testResults.authentication.tests.push({ name: "Valid token", passed });
      testResults.authentication.failed++;
    }

    // Test 3.2: Invalid token authentication
    const invalidSocket = io(API_URL, {
      auth: { token: "invalid-token-12345" },
      transports: ["websocket", "polling"],
      reconnection: false,
    });

    invalidSocket.on("connect_error", (error) => {
      const passed = logTest("Invalid token rejected", true, `Error: ${error.message}`);
      testResults.authentication.tests.push({ name: "Invalid token", passed });
      if (passed) testResults.authentication.passed++;
      else testResults.authentication.failed++;
      invalidSocket.disconnect();
      resolve(true);
    });

    invalidSocket.on("connect", () => {
      const passed = logTest("Invalid token rejected", false, "Connection should have been rejected");
      testResults.authentication.tests.push({ name: "Invalid token", passed });
      testResults.authentication.failed++;
      invalidSocket.disconnect();
      resolve(false);
    });

    setTimeout(() => {
      invalidSocket.disconnect();
      resolve(true);
    }, 3000);
  });
}

// Step 4: Test audit event broadcasting
function testAuditEventBroadcasting() {
  return new Promise((resolve) => {
    log("\n=== Step 4: Audit Event Broadcasting Test ===", "blue");

    let eventReceived = false;
    let eventData = null;

    // Listen for audit:event:created events
    socket.on("audit:event:created", (event) => {
      eventReceived = true;
      eventData = event;
      
      // Test 4.1: Event structure
      const hasType = event.type === "audit:event:created";
      const hasData = event.data && typeof event.data === "object";
      const hasTimestamp = event.timestamp && typeof event.timestamp === "string";
      
      const structureValid = hasType && hasData && hasTimestamp;
      const passed = logTest("Event structure valid", structureValid, 
        `Type: ${event.type}, Has data: ${hasData}, Has timestamp: ${hasTimestamp}`);
      testResults.broadcasting.tests.push({ name: "Event structure", passed });
      if (passed) testResults.broadcasting.passed++;
      else testResults.broadcasting.failed++;

      // Test 4.2: Event data fields
      if (event.data) {
        const requiredFields = ["id", "entityType", "entityId", "action", "userId", "createdAt"];
        const missingFields = requiredFields.filter(field => !(field in event.data));
        const passed = missingFields.length === 0;
        logTest("Required fields present", passed, 
          missingFields.length > 0 ? `Missing: ${missingFields.join(", ")}` : "All required fields present");
        testResults.broadcasting.tests.push({ name: "Required fields", passed });
        if (passed) testResults.broadcasting.passed++;
        else testResults.broadcasting.failed++;

        // Test 4.3: User information
        if (event.data.user) {
          const userFields = ["id", "firstName", "lastName", "employeeCode"];
          const missingUserFields = userFields.filter(field => !(field in event.data.user));
          const passed = missingUserFields.length === 0;
          logTest("User information present", passed,
            missingUserFields.length > 0 ? `Missing: ${missingUserFields.join(", ")}` : "All user fields present");
          testResults.broadcasting.tests.push({ name: "User information", passed });
          if (passed) testResults.broadcasting.passed++;
          else testResults.broadcasting.failed++;
        }
      }

      log("\n  📦 Event Data:", "cyan");
      log(`    ID: ${event.data?.id}`, "cyan");
      log(`    Entity: ${event.data?.entityType} (${event.data?.entityId})`, "cyan");
      log(`    Action: ${event.data?.action}`, "cyan");
      log(`    User: ${event.data?.user?.firstName} ${event.data?.user?.lastName} (${event.data?.user?.employeeCode || "N/A"})`, "cyan");
      log(`    Timestamp: ${event.timestamp}`, "cyan");
    });

    // Trigger an audit event by creating a test lead (if leads API exists)
    log("\n  ⏳ Waiting for audit event...", "yellow");
    log("  💡 Tip: Create/update a lead in the UI to trigger an audit event", "yellow");
    
    // Wait up to 30 seconds for an event
    const waitTimeout = setTimeout(() => {
      if (!eventReceived) {
        const passed = logTest("Event received within timeout", false, "No audit event received in 30 seconds");
        testResults.broadcasting.tests.push({ name: "Event received", passed });
        testResults.broadcasting.failed++;
        log("  ⚠️  No event received. Make sure to trigger an audit event (create/update lead)", "yellow");
        resolve(false);
      } else {
        resolve(true);
      }
    }, 30000);

    // If event received, resolve early
    if (eventReceived) {
      clearTimeout(waitTimeout);
      resolve(true);
    }
  });
}

// Step 5: Test connection recovery
function testConnectionRecovery() {
  return new Promise((resolve) => {
    log("\n=== Step 5: Connection Recovery Test ===", "blue");

    let reconnected = false;

    // Enable reconnection for this test
    socket.io.opts.reconnection = true;
    socket.io.opts.reconnectionAttempts = 5;
    socket.io.opts.reconnectionDelay = 1000;

    socket.on("reconnect", (attemptNumber) => {
      reconnected = true;
      const passed = logTest("Reconnection successful", true, `Reconnected after ${attemptNumber} attempts`);
      testResults.recovery.tests.push({ name: "Reconnection", passed, attempts: attemptNumber });
      if (passed) testResults.recovery.passed++;
      else testResults.recovery.failed++;
    });

    socket.on("reconnect_attempt", (attemptNumber) => {
      log(`  🔄 Reconnection attempt ${attemptNumber}...`, "yellow");
    });

    socket.on("reconnect_error", (error) => {
      log(`  ❌ Reconnection error: ${error.message}`, "red");
    });

    socket.on("reconnect_failed", () => {
      const passed = logTest("Reconnection failed", false, "All reconnection attempts exhausted");
      testResults.recovery.tests.push({ name: "Reconnection failed", passed });
      testResults.recovery.failed++;
      resolve(false);
    });

    // Disconnect and wait for reconnection
    log("  🔌 Disconnecting socket...", "yellow");
    socket.disconnect();

    setTimeout(() => {
      if (reconnected) {
        resolve(true);
      } else {
        log("  ⏳ Waiting for reconnection...", "yellow");
        setTimeout(() => {
          if (reconnected) {
            resolve(true);
          } else {
            const passed = logTest("Reconnection within timeout", false, "Reconnection not completed within 10 seconds");
            testResults.recovery.tests.push({ name: "Reconnection timeout", passed });
            testResults.recovery.failed++;
            resolve(false);
          }
        }, 10000);
      }
    }, 2000);
  });
}

// Print test summary
function printSummary() {
  log("\n" + "=".repeat(60), "blue");
  log("TEST SUMMARY", "blue");
  log("=".repeat(60), "blue");

  const categories = [
    { name: "Connection", data: testResults.connection },
    { name: "Authentication", data: testResults.authentication },
    { name: "Broadcasting", data: testResults.broadcasting },
    { name: "Recovery", data: testResults.recovery },
  ];

  let totalPassed = 0;
  let totalFailed = 0;

  categories.forEach(({ name, data }) => {
    const total = data.passed + data.failed;
    const percentage = total > 0 ? ((data.passed / total) * 100).toFixed(1) : 0;
    const color = data.failed === 0 ? "green" : data.passed === 0 ? "red" : "yellow";
    
    log(`\n${name}:`, "blue");
    log(`  Passed: ${data.passed}`, "green");
    log(`  Failed: ${data.failed}`, "red");
    log(`  Total: ${total}`, "cyan");
    log(`  Success Rate: ${percentage}%`, color);
    
    totalPassed += data.passed;
    totalFailed += data.failed;
  });

  log("\n" + "=".repeat(60), "blue");
  const overallTotal = totalPassed + totalFailed;
  const overallPercentage = overallTotal > 0 ? ((totalPassed / overallTotal) * 100).toFixed(1) : 0;
  const overallColor = totalFailed === 0 ? "green" : totalPassed === 0 ? "red" : "yellow";
  
  log(`Overall: ${totalPassed}/${overallTotal} passed (${overallPercentage}%)`, overallColor);
  log("=".repeat(60), "blue");

  return totalFailed === 0;
}

// Main test execution
async function runTests() {
  log("\n" + "=".repeat(60), "cyan");
  log("AUDIT TRAIL REAL-TIME WEBSOCKET TESTING", "cyan");
  log("=".repeat(60), "cyan");
  log(`API URL: ${API_URL}`, "cyan");
  log(`Test User: ${TEST_EMAIL}`, "cyan");

  try {
    // Step 1: Get auth token
    const tokenObtained = await getAuthToken();
    if (!tokenObtained) {
      log("\n❌ Cannot proceed without authentication token", "red");
      process.exit(1);
    }

    // Step 2: Test connection
    const connected = await testConnection();
    if (!connected) {
      log("\n❌ Cannot proceed without WebSocket connection", "red");
      if (socket) socket.disconnect();
      process.exit(1);
    }

    // Step 3: Test authentication
    await testAuthentication();

    // Step 4: Test audit event broadcasting
    await testAuditEventBroadcasting();

    // Step 5: Test connection recovery
    await testConnectionRecovery();

    // Print summary
    const allPassed = printSummary();

    // Cleanup
    if (socket) {
      socket.disconnect();
    }

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    log(`\n❌ Test execution error: ${error.message}`, "red");
    console.error(error);
    if (socket) socket.disconnect();
    process.exit(1);
  }
}

// Run tests
runTests();







