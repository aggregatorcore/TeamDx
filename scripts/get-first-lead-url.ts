import "dotenv/config";
import { prisma } from "../server/src/lib/prisma";

async function getFirstLeadUrl() {
  try {
    const lead = await prisma.lead.findFirst({
      where: {
        assignedToId: "cml2dyf8l0001i8u31y664nsu", // Kajal's user ID
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (lead) {
      console.log(`http://localhost:3000/leads/${lead.id}`);
    } else {
      console.log("No lead found for Kajal");
    }
  } catch (error: any) {
    console.error("Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

getFirstLeadUrl();
