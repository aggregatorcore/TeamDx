// Comprehensive backend status checker
const http = require('http');
const net = require('net');

console.log('\n=== Backend Server Status Check ===\n');

// Check 1: Port 5000 availability
function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.once('close', () => resolve(true));
      server.close();
    });
    server.on('error', () => resolve(false));
  });
}

// Check 2: Backend endpoint
async function checkBackend() {
  try {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/mobile/test',
      method: 'GET',
      timeout: 3000,
    };

    return new Promise((resolve) => {
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            resolve({ success: true, response, statusCode: res.statusCode });
          } catch (e) {
            resolve({ success: false, error: 'Invalid JSON response', data });
          }
        });
      });

      req.on('error', (error) => {
        resolve({ success: false, error: error.message });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: 'Connection timeout' });
      });

      req.end();
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  // Check port
  console.log('1. Checking port 5000...');
  const portAvailable = await checkPort(5000);
  if (portAvailable) {
    console.log('   ❌ Port 5000 is FREE (backend not running)');
    console.log('   ACTION: Start backend server with: npm run server\n');
  } else {
    console.log('   ✅ Port 5000 is IN USE (backend might be running)\n');
  }

  // Check backend
  console.log('2. Checking backend endpoint...');
  const result = await checkBackend();
  
  if (result.success) {
    console.log('   ✅ Backend is responding');
    console.log(`   Status Code: ${result.statusCode}`);
    console.log('   Response:', JSON.stringify(result.response, null, 2));
    
    if (result.response.hasAutoRegistration === true) {
      console.log('\n   ✅ BACKEND IS RUNNING NEW CODE!');
      console.log(`   Code Version: ${result.response.codeVersion || 'N/A'}`);
      console.log('   Auto-registration: ENABLED\n');
    } else {
      console.log('\n   ❌ BACKEND IS RUNNING OLD CODE!');
      console.log('   Auto-registration: NOT ENABLED');
      console.log('   ACTION: Restart backend server\n');
    }
  } else {
    console.log('   ❌ Backend is NOT responding');
    console.log(`   Error: ${result.error || 'Unknown error'}`);
    console.log('\n   ACTION REQUIRED:');
    console.log('   1. Start backend server: npm run server');
    console.log('   2. Wait for "Server running on port 5000" message');
    console.log('   3. Check for any compilation errors\n');
  }

  // Summary
  console.log('=== Summary ===');
  if (result.success && result.response.hasAutoRegistration) {
    console.log('✅ Backend is running with NEW CODE');
    console.log('✅ Auto-registration is ENABLED');
    console.log('✅ Ready for testing\n');
  } else if (result.success && !result.response.hasAutoRegistration) {
    console.log('⚠️  Backend is running but with OLD CODE');
    console.log('❌ Auto-registration is NOT ENABLED');
    console.log('ACTION: Restart backend server\n');
  } else {
    console.log('❌ Backend server is NOT running');
    console.log('ACTION: Start backend server first\n');
  }
}

main().catch(console.error);

