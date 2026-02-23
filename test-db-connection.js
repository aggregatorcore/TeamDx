// Quick database connection test
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('Testing database connection...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
    
    await prisma.$connect();
    console.log('✓ Database connected successfully!');
    
    // Try a simple query
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✓ Database query successful!');
    
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('✗ Database connection failed:');
    console.error('Error:', error.message);
    
    if (error.message.includes('connect ECONNREFUSED')) {
      console.error('\n→ PostgreSQL server is not running or not accessible');
      console.error('→ Check if PostgreSQL service is running');
    } else if (error.message.includes('authentication failed')) {
      console.error('\n→ Database authentication failed');
      console.error('→ Check DATABASE_URL password in .env file');
    } else if (error.message.includes('database') && error.message.includes('does not exist')) {
      console.error('\n→ Database does not exist');
      console.error('→ Run: CREATE DATABASE immigration_db;');
    }
    
    await prisma.$disconnect();
    process.exit(1);
  }
}

testConnection();

