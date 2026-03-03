// Load environment variables first
import "dotenv/config";

// Fail fast with clear message if required env are missing (e.g. on Render)
const requiredEnv = ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "JWT_SECRET"];
const missing = requiredEnv.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error("[STARTUP] Missing required env:", missing.join(", "));
  process.exit(1);
}
console.log("[STARTUP] Env OK, loading app...");

/**
 * Resolve DATABASE_URL host to IPv4 before loading Prisma.
 * Render has no IPv6; Supabase host can resolve to IPv6 → ENETUNREACH.
 */
async function resolveDatabaseUrlToIPv4(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url || !url.includes("supabase")) return;

  const dns = require("dns").promises;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }
  try {
    const { address } = await dns.lookup(parsed.hostname, { family: 4 });
    parsed.hostname = address;
    process.env.DATABASE_URL = parsed.toString();
    console.log("[STARTUP] Resolved DB host to IPv4:", address);
  } catch (err: any) {
    console.warn("[STARTUP] Could not resolve DB host to IPv4:", err?.message ?? err);
  }
}

async function main(): Promise<void> {
  await resolveDatabaseUrlToIPv4();
  require("./serverApp");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
