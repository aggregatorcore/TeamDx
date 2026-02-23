/**
 * Docker and Backend Health Verification Script
 * Checks Docker containers, backend server, and database connectivity
 */

const API_BASE = process.env.API_URL || "http://localhost:5000";
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const results = {
  docker: {},
  backend: {},
  database: {},
  api: {},
  summary: {}
};

/**
 * Execute shell command
 */
async function runCommand(command, description) {
  try {
    const { stdout, stderr } = await execAsync(command, { 
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    });
    return { success: true, output: stdout.trim(), error: stderr.trim() };
  } catch (error) {
    return { 
      success: false, 
      output: error.stdout?.trim() || '', 
      error: error.stderr?.trim() || error.message 
    };
  }
}

/**
 * Check Docker installation
 */
async function checkDockerInstallation() {
  console.log("\n📦 Checking Docker Installation...");
  const result = await runCommand('docker --version', 'Docker version');
  
  if (result.success) {
    console.log(`✅ Docker installed: ${result.output}`);
    results.docker.installed = true;
    results.docker.version = result.output;
  } else {
    console.log(`❌ Docker not found: ${result.error}`);
    results.docker.installed = false;
    results.docker.error = result.error;
  }
}

/**
 * Check Docker daemon status
 */
async function checkDockerDaemon() {
  console.log("\n🔌 Checking Docker Daemon...");
  const result = await runCommand('docker info', 'Docker info');
  
  if (result.success) {
    console.log("✅ Docker daemon is running");
    results.docker.daemonRunning = true;
  } else {
    console.log(`❌ Docker daemon not running: ${result.error}`);
    results.docker.daemonRunning = false;
    results.docker.error = result.error;
  }
}

/**
 * Check Docker containers status
 */
async function checkDockerContainers() {
  console.log("\n🐳 Checking Docker Containers...");
  
  // Check if containers exist
  const psResult = await runCommand('docker ps -a --format "{{.Names}}\t{{.Status}}\t{{.Ports}}"', 'Docker containers');
  
  if (psResult.success) {
    const containers = psResult.output.split('\n').filter(line => line.trim());
    console.log(`Found ${containers.length} container(s):`);
    
    containers.forEach(container => {
      const [name, status, ports] = container.split('\t');
      console.log(`  - ${name}: ${status}`);
      if (ports) console.log(`    Ports: ${ports}`);
    });
    
    results.docker.containers = containers;
    
    // Check specific containers
    const backendRunning = containers.some(c => c.includes('tvf-backend') && c.includes('Up'));
    const postgresRunning = containers.some(c => c.includes('tvf-postgres') && c.includes('Up'));
    const frontendRunning = containers.some(c => c.includes('tvf-frontend') && c.includes('Up'));
    
    results.docker.backendContainer = backendRunning;
    results.docker.postgresContainer = postgresRunning;
    results.docker.frontendContainer = frontendRunning;
    
    console.log(`\nContainer Status:`);
    console.log(`  ✅ Backend: ${backendRunning ? 'Running' : 'Stopped'}`);
    console.log(`  ✅ PostgreSQL: ${postgresRunning ? 'Running' : 'Stopped'}`);
    console.log(`  ✅ Frontend: ${frontendRunning ? 'Running' : 'Stopped'}`);
  } else {
    console.log(`❌ Failed to check containers: ${psResult.error}`);
    results.docker.containers = [];
  }
}

/**
 * Check Docker Compose services
 */
async function checkDockerCompose() {
  console.log("\n📋 Checking Docker Compose Services...");
  
  // Check if docker-compose.yml exists
  const fs = require('fs');
  const path = require('path');
  const composeFile = path.join(process.cwd(), 'docker-compose.yml');
  
  if (fs.existsSync(composeFile)) {
    console.log("✅ docker-compose.yml found");
    results.docker.composeFileExists = true;
    
    // Check if services are running
    const composeResult = await runCommand('docker-compose ps', 'Docker Compose services');
    
    if (composeResult.success) {
      console.log("Docker Compose Services:");
      console.log(composeResult.output);
      results.docker.composeServices = composeResult.output;
    } else {
      // Try docker compose (without hyphen) for newer versions
      const composeResult2 = await runCommand('docker compose ps', 'Docker Compose services');
      if (composeResult2.success) {
        console.log("Docker Compose Services:");
        console.log(composeResult2.output);
        results.docker.composeServices = composeResult2.output;
      } else {
        console.log("⚠️  Docker Compose not running or not available");
        results.docker.composeServices = null;
      }
    }
  } else {
    console.log("⚠️  docker-compose.yml not found");
    results.docker.composeFileExists = false;
  }
}

/**
 * Check backend server health endpoint
 */
async function checkBackendHealth() {
  console.log("\n🏥 Checking Backend Server Health...");
  
  try {
    const response = await fetch(`${API_BASE}/health`);
    const data = await response.json();
    
    if (response.status === 200) {
      console.log(`✅ Backend server is running (Status: ${data.status})`);
      console.log(`   Message: ${data.message}`);
      console.log(`   Database: ${data.database}`);
      
      results.backend.running = true;
      results.backend.status = data.status;
      results.backend.message = data.message;
      results.backend.database = data.database;
      results.backend.httpStatus = response.status;
      
      if (data.status === 'ok' && data.database === 'ready') {
        results.backend.healthy = true;
      } else {
        results.backend.healthy = false;
        console.log("⚠️  Backend is running but database is not ready");
      }
    } else {
      console.log(`❌ Backend health check failed (Status: ${response.status})`);
      results.backend.running = false;
      results.backend.httpStatus = response.status;
    }
  } catch (error) {
    console.log(`❌ Backend server not accessible: ${error.message}`);
    results.backend.running = false;
    results.backend.error = error.message;
    
    // Check if port is in use
    if (error.message.includes('ECONNREFUSED')) {
      console.log("   → Server is not running on port 5000");
    } else if (error.message.includes('ENOTFOUND')) {
      console.log("   → Cannot resolve hostname");
    }
  }
}

/**
 * Check database connectivity
 */
async function checkDatabaseConnection() {
  console.log("\n🗄️  Checking Database Connection...");
  
  try {
    // Try to connect using Prisma
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    await prisma.$connect();
    console.log("✅ Database connection successful");
    
    // Try a simple query
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log("✅ Database query successful");
    
    // Check if tables exist
    try {
      const tableCount = await prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `;
      console.log(`✅ Database tables accessible`);
      
      results.database.connected = true;
      results.database.querySuccess = true;
      results.database.tablesAccessible = true;
    } catch (tableError) {
      console.log("⚠️  Could not check tables (might be SQLite)");
      results.database.connected = true;
      results.database.querySuccess = true;
      results.database.tablesAccessible = false;
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.log(`❌ Database connection failed: ${error.message}`);
    results.database.connected = false;
    results.database.error = error.message;
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log("   → PostgreSQL server is not running");
    } else if (error.message.includes('authentication failed')) {
      console.log("   → Database authentication failed (check password)");
    } else if (error.message.includes('does not exist')) {
      console.log("   → Database does not exist");
    }
  }
}

/**
 * Check API endpoints
 */
async function checkAPIEndpoints() {
  console.log("\n🌐 Checking API Endpoints...");
  
  const endpoints = [
    { path: '/health', method: 'GET', auth: false },
    { path: '/api/auth/login', method: 'POST', auth: false },
  ];
  
  results.api.endpoints = [];
  
  for (const endpoint of endpoints) {
    try {
      const options = {
        method: endpoint.method,
        headers: { 'Content-Type': 'application/json' }
      };
      
      if (endpoint.method === 'POST' && endpoint.path === '/api/auth/login') {
        options.body = JSON.stringify({
          email: 'test@example.com',
          password: 'test123'
        });
      }
      
      const response = await fetch(`${API_BASE}${endpoint.path}`, options);
      
      const endpointResult = {
        path: endpoint.path,
        method: endpoint.method,
        status: response.status,
        accessible: response.status < 500
      };
      
      if (response.status < 500) {
        console.log(`✅ ${endpoint.method} ${endpoint.path}: ${response.status}`);
      } else {
        console.log(`❌ ${endpoint.method} ${endpoint.path}: ${response.status}`);
      }
      
      results.api.endpoints.push(endpointResult);
    } catch (error) {
      console.log(`❌ ${endpoint.method} ${endpoint.path}: ${error.message}`);
      results.api.endpoints.push({
        path: endpoint.path,
        method: endpoint.method,
        accessible: false,
        error: error.message
      });
    }
  }
}

/**
 * Generate summary
 */
function generateSummary() {
  console.log("\n" + "=".repeat(60));
  console.log("📊 Health Verification Summary");
  console.log("=".repeat(60));
  
  const summary = {
    docker: {
      installed: results.docker.installed || false,
      daemonRunning: results.docker.daemonRunning || false,
      containersRunning: {
        backend: results.docker.backendContainer || false,
        postgres: results.docker.postgresContainer || false,
        frontend: results.docker.frontendContainer || false
      }
    },
    backend: {
      running: results.backend.running || false,
      healthy: results.backend.healthy || false,
      databaseReady: results.backend.database === 'ready'
    },
    database: {
      connected: results.database.connected || false,
      querySuccess: results.database.querySuccess || false
    },
    overall: {
      status: 'unknown'
    }
  };
  
  // Determine overall status
  if (summary.docker.installed && 
      summary.docker.daemonRunning && 
      summary.backend.running && 
      summary.backend.healthy && 
      summary.database.connected) {
    summary.overall.status = 'healthy';
    console.log("\n✅ Overall Status: HEALTHY");
  } else if (summary.backend.running && summary.database.connected) {
    summary.overall.status = 'degraded';
    console.log("\n⚠️  Overall Status: DEGRADED (Some issues detected)");
  } else {
    summary.overall.status = 'unhealthy';
    console.log("\n❌ Overall Status: UNHEALTHY (Critical issues detected)");
  }
  
  console.log("\nComponent Status:");
  console.log(`  Docker: ${summary.docker.installed ? '✅' : '❌'} Installed, ${summary.docker.daemonRunning ? '✅' : '❌'} Running`);
  console.log(`  Backend: ${summary.backend.running ? '✅' : '❌'} Running, ${summary.backend.healthy ? '✅' : '❌'} Healthy`);
  console.log(`  Database: ${summary.database.connected ? '✅' : '❌'} Connected`);
  
  if (summary.docker.containersRunning) {
    console.log(`\nContainers:`);
    console.log(`  Backend: ${summary.docker.containersRunning.backend ? '✅' : '❌'}`);
    console.log(`  PostgreSQL: ${summary.docker.containersRunning.postgres ? '✅' : '❌'}`);
    console.log(`  Frontend: ${summary.docker.containersRunning.frontend ? '✅' : '❌'}`);
  }
  
  results.summary = summary;
  return summary;
}

/**
 * Main execution
 */
async function main() {
  console.log("🔍 Docker and Backend Health Verification");
  console.log("=".repeat(60));
  
  try {
    // Docker checks
    await checkDockerInstallation();
    if (results.docker.installed) {
      await checkDockerDaemon();
      if (results.docker.daemonRunning) {
        await checkDockerContainers();
        await checkDockerCompose();
      }
    }
    
    // Backend checks
    await checkBackendHealth();
    
    // Database checks
    await checkDatabaseConnection();
    
    // API checks
    if (results.backend.running) {
      await checkAPIEndpoints();
    }
    
    // Generate summary
    const summary = generateSummary();
    
    // Save results to file
    const fs = require('fs');
    const reportPath = 'DOCKER_BACKEND_HEALTH_REPORT.json';
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    
    return summary;
  } catch (error) {
    console.error("\n❌ Verification failed:", error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  main()
    .then((summary) => {
      process.exit(summary.overall.status === 'healthy' ? 0 : 1);
    })
    .catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}

module.exports = { main, checkDockerInstallation, checkBackendHealth, checkDatabaseConnection };


