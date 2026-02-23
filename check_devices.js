const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDevices() {
  try {
    const devices = await prisma.mobileDevice.findMany({
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    console.log('\n=== Mobile Device Registration Check ===');
    console.log(`Total registered devices: ${devices.length}`);
    console.log('\nRegistered devices:');
    devices.forEach((device, index) => {
      const lastSeen = device.lastSeen ? new Date(device.lastSeen).toISOString() : 'Never';
      const secondsAgo = device.lastSeen ? Math.floor((Date.now() - new Date(device.lastSeen).getTime()) / 1000) : Infinity;
      const isOnline = device.isActive && device.isOnline && secondsAgo < 60;
      
      console.log(`${index + 1}. User: ${device.user?.firstName} ${device.user?.lastName}`);
      console.log(`   Device ID: ${device.deviceId.substring(0, 20)}...`);
      console.log(`   Online: ${isOnline ? 'YES' : 'NO'} (last seen: ${lastSeen}, ${secondsAgo}s ago)`);
      console.log(`   Active: ${device.isActive}`);
      console.log('');
    });

    if (devices.length === 0) {
      console.log('⚠️  NO DEVICES REGISTERED!');
      console.log('This means mobile app has never successfully connected to backend.');
      console.log('Possible issues:');
      console.log('  1. Mobile app not logged in');
      console.log('  2. Network connectivity issue');
      console.log('  3. Authentication token expired');
      console.log('  4. Mobile app initialization failed');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDevices();

