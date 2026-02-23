import "dotenv/config";
import fetch from "node-fetch";

async function testTagApplyViaAPI() {
  try {
    // First, login to get token
    console.log("\n🔐 Logging in as Telecaller...\n");
    
    const loginResponse = await fetch("http://localhost:5000/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "kajal@tvf.com",
        password: "Kajal@123",
      }),
    });

    if (!loginResponse.ok) {
      const error = await loginResponse.text();
      console.error("❌ Login failed:", error);
      return;
    }

    const loginData: any = await loginResponse.json();
    const token = loginData.token;

    if (!token) {
      console.error("❌ No token received");
      return;
    }

    console.log("✅ Login successful\n");

    // Find a lead without "No Answer" tag
    const leadsResponse = await fetch("http://localhost:5000/api/leads", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!leadsResponse.ok) {
      console.error("❌ Failed to fetch leads");
      return;
    }

    const leadsData: any = await leadsResponse.json();
    const leads = leadsData.leads || [];

    // Find a lead without "No Answer" tag
    let testLead = null;
    for (const lead of leads) {
      const hasNoAnswer = lead.currentTag?.tagFlow?.tagValue === "no_answer" ||
                         lead.tagApplications?.some((ta: any) => ta.tagFlow?.tagValue === "no_answer");
      
      if (!hasNoAnswer && lead.status === "new") {
        testLead = lead;
        break;
      }
    }

    if (!testLead) {
      console.log("⚠️ No suitable lead found. Creating a new one...");
      // Create a new lead
      const createResponse = await fetch("http://localhost:5000/api/leads", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: "APITest",
          lastName: "Lead",
          email: `apitest.${Date.now()}@example.com`,
          phone: `999${Date.now().toString().slice(-7)}`,
          status: "new",
        }),
      });

      if (!createResponse.ok) {
        const error = await createResponse.text();
        console.error("❌ Failed to create lead:", error);
        return;
      }

      const createData: any = await createResponse.json();
      testLead = createData.lead;
    }

    console.log(`📋 Using lead: ${testLead.firstName} ${testLead.lastName} (${testLead.id})\n`);

    // Get "No Answer" tagFlow
    const tagsResponse = await fetch("http://localhost:5000/api/tag-flows", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!tagsResponse.ok) {
      console.error("❌ Failed to fetch tag flows");
      return;
    }

    const tagsData: any = await tagsResponse.json();
    const noAnswerTag = tagsData.tagFlows?.find((t: any) => t.tagValue === "no_answer");

    if (!noAnswerTag) {
      console.error("❌ 'No Answer' tagFlow not found");
      return;
    }

    console.log(`✅ Found 'No Answer' tag: ${noAnswerTag.name} (${noAnswerTag.id})\n`);

    // Apply "No Answer" tag via API
    console.log("📤 Applying 'No Answer' tag via API...\n");
    
    const applyResponse = await fetch(
      `http://localhost:5000/api/tag-applications/lead/${testLead.id}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tagFlowId: noAnswerTag.id,
        }),
      }
    );

    if (!applyResponse.ok) {
      const error = await applyResponse.text();
      console.error("❌ Failed to apply tag:", error);
      return;
    }

    const applyData: any = await applyResponse.json();
    const tagApplication = applyData.tagApplication;

    console.log("✅ Tag applied successfully!\n");
    console.log("📊 Tag Application Details:");
    console.log(`   ID: ${tagApplication.id}`);
    console.log(`   CallbackAt: ${tagApplication.callbackAt ? tagApplication.callbackAt : "❌ NULL"}`);
    
    if (tagApplication.callbackAt) {
      console.log(`   ✅ CallbackAt was automatically set: ${tagApplication.callbackAt}`);
      console.log(`   ✅ System is working correctly!`);
    } else {
      console.log(`   ⚠️ CallbackAt is NULL - this means executeTagConfigBehaviors() did NOT run`);
      console.log(`   ⚠️ Check backend logs for LOG-1, LOG-2, LOG-3, LOG-4`);
    }

    // Wait a moment and check again (in case fallback runs)
    await new Promise(resolve => setTimeout(resolve, 3000));

    const tagsCheckResponse = await fetch(
      `http://localhost:5000/api/leads/${testLead.id}/tags`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (tagsCheckResponse.ok) {
      const tagsCheckData: any = await tagsCheckResponse.json();
      const activeTag = tagsCheckData.tagApplications?.find((ta: any) => ta.isActive);
      
      if (activeTag) {
        console.log(`\n📊 After 3 seconds:`);
        console.log(`   CallbackAt: ${activeTag.callbackAt ? activeTag.callbackAt : "❌ NULL"}`);
        
        if (activeTag.callbackAt) {
          console.log(`   ✅ CallbackAt was set (either immediately or by fallback)`);
        }
      }
    }

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
  }
}

testTagApplyViaAPI();
