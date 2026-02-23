// Monitor heartbeat endpoint in real-time
const http = require('http');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '.cursor', 'debug.log');
const CHECK_INTERVAL = 5000; // Check every 5 seconds
let lastLineCount = 0;

function getLatestLogs() {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      return [];
    }
    const content = fs.readFileSync(LOG_FILE, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    return lines;
  } catch (error) {
    return [];
  }
}

function parseLogLine(line) {
  try {
    return JSON.parse(line);
  } catch (e) {
    return null;
  }
}

function filterHeartbeatLogs(logs) {
  return logs
    .map(parseLogLine)
    .filter(log => log && (
      log.location?.includes('mobile.ts') ||
      log.message?.includes('Heartbeat') ||
      log.message?.includes('AUTO-REG') ||
      log.message?.includes('auto-registration') ||
      log.message?.includes('Device auto-registered')
    ));
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { hour12: false });
}

function monitor() {
  console.log('\n=== Heartbeat Monitor ===');
  console.log('Monitoring debug.log for heartbeat activity...');
  console.log('Press Ctrl+C to stop\n');

  const checkLogs = () => {
    const allLogs = getLatestLogs();
    const heartbeatLogs = filterHeartbeatLogs(allLogs);
    
    if (heartbeatLogs.length > lastLineCount) {
      const newLogs = heartbeatLogs.slice(lastLineCount);
      console.log(`\n[${new Date().toLocaleTimeString()}] New heartbeat activity:`);
      newLogs.forEach(log => {
        const location = log.location || 'unknown';
        const message = log.message || 'no message';
        const data = log.data || {};
        console.log(`  ${location}: ${message}`);
        if (data.deviceFound !== undefined) {
          console.log(`    Device Found: ${data.deviceFound}`);
        }
        if (data.requestedDeviceId) {
          console.log(`    Device ID: ${data.requestedDeviceId}`);
        }
        if (log.message?.includes('auto-registered')) {
          console.log(`    ✅ AUTO-REGISTRATION SUCCESS!`);
        }
      });
      lastLineCount = heartbeatLogs.length;
    }
  };

  // Check immediately
  checkLogs();

  // Then check every interval
  const interval = setInterval(checkLogs, CHECK_INTERVAL);

  // Handle exit
  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log('\n\nMonitoring stopped.');
    process.exit(0);
  });
}

monitor();

