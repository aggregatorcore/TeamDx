import "dotenv/config";
import { prisma } from "../server/src/lib/prisma";

async function getLeadsList() {
  try {
    const leads = await prisma.lead.findMany({
      where: {
        assignedToId: "cml2dyf8l0001i8u31y664nsu", // Kajal's user ID
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
      },
      take: 5,
      orderBy: {
        createdAt: "desc",
      },
    });

    console.log(JSON.stringify(leads, null, 2));
  } catch (error: any) {
    console.error("Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

getLeadsList();
