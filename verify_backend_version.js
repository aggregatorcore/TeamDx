// Quick script to verify backend code version
const http = require('http');

async function verifyBackend() {
  console.log('\n=== Backend Code Version Verification ===\n');
  
  try {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/mobile/test',
      method: 'GET',
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('✅ Test endpoint response:');
          console.log(JSON.stringify(response, null, 2));
          console.log('\n');
          
          if (response.hasAutoRegistration === true) {
            console.log('✅ BACKEND IS RUNNING NEW CODE!');
            console.log(`   Code Version: ${response.codeVersion || 'N/A'}`);
            console.log('   Auto-registration: ENABLED');
          } else {
            console.log('❌ BACKEND IS RUNNING OLD CODE!');
            console.log('   Auto-registration: NOT ENABLED');
            console.log('   ACTION REQUIRED: Restart backend server');
          }
        } catch (e) {
          console.log('❌ Failed to parse response:', data);
          console.log('   This might mean backend is not running or endpoint is missing');
        }
      });
    });

    req.on('error', (error) => {
      console.log('❌ Cannot connect to backend server');
      console.log('   Error:', error.message);
      console.log('   Make sure backend is running on port 5000');
    });

    req.setTimeout(5000, () => {
      req.destroy();
      console.log('❌ Request timeout - backend might not be responding');
    });

    req.end();
  } catch (error) {
    console.error('Error:', error);
  }
}

verifyBackend();

