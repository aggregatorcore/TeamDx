// Force IPv4 for DB host (Render has no IPv6; Supabase can resolve to IPv6 → ENETUNREACH)
require("dns").setDefaultResultOrder("ipv4first");

import { Pool } from "pg";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const isSupabase = connectionString.includes("supabase");
if (isSupabase) {
  const sep = connectionString.includes("?") ? "&" : "?";
  if (!connectionString.includes("connect_timeout=")) {
    connectionString = `${connectionString}${sep}connect_timeout=60`;
  }
}

// Explicit Pool: full control over timeouts; small max to avoid Supabase connection limit
const pool = new Pool({
  connectionString,
  max: 3,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 60_000,
  ...(isSupabase && { ssl: { rejectUnauthorized: false } }),
});

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

