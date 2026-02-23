import "dotenv/config";

/**
 * Quick script to check if backend server is running and accessible
 */
async function checkBackendStatus() {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  
  try {
    const response = await fetch(`${backendUrl}/api/health`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    
    if (response.ok) {
      console.log("✅ Backend server is running and accessible");
      return true;
    } else {
      console.log("⚠️ Backend server responded but with error:", response.status);
      return false;
    }
  } catch (error: any) {
    console.error("❌ Backend server is NOT running or not accessible");
    console.error("Error:", error.message);
    console.log("\n💡 Please start the backend server:");
    console.log("   cd server && npm run dev");
    return false;
  }
}

checkBackendStatus();
