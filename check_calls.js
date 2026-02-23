const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCalls() {
  try {
    const calls = await prisma.call.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    console.log('\n=== Database Calls Check ===');
    console.log(`Total calls in database: ${calls.length}`);
    console.log('\nRecent calls:');
    calls.forEach((call, index) => {
      console.log(`${index + 1}. Phone: ${call.phoneNumber}`);
      console.log(`   User: ${call.createdBy?.firstName} ${call.createdBy?.lastName}`);
      console.log(`   Type: ${call.callType}, Status: ${call.status}`);
      console.log(`   Source: ${call.initiatedFrom || 'web'}`);
      console.log(`   Date: ${call.createdAt}`);
      console.log('');
    });

    // Check by user
    const userCalls = await prisma.call.groupBy({
      by: ['createdById'],
      _count: true
    });

    console.log('\n=== Calls by User ===');
    for (const uc of userCalls) {
      const user = await prisma.user.findUnique({
        where: { id: uc.createdById },
        select: { firstName: true, lastName: true, email: true }
      });
      console.log(`${user?.firstName} ${user?.lastName}: ${uc._count} calls`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCalls();
