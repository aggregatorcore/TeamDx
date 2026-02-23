import "dotenv/config";
import { prisma } from "../server/src/lib/prisma";

async function main() {
  // Check users
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: "kajal" } },
        { email: { contains: "kalaj" } },
      ],
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
    },
  });
  console.log("Users found:", JSON.stringify(users, null, 2));

  // Check one lead
  const lead = await prisma.lead.findFirst({
    where: { phone: { startsWith: "9990000" } },
    include: {
      assignedTo: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
        },
      },
    },
  });

  console.log("\nSample Lead:");
  console.log("  ID:", lead?.id);
  console.log("  Phone:", lead?.phone);
  console.log("  assignedToId:", lead?.assignedToId);
  console.log("  assignedTo:", JSON.stringify(lead?.assignedTo, null, 2));

  await prisma.$disconnect();
}

main().catch(console.error);
