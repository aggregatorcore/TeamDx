/**
 * Authentication utilities - re-exported from shared package with environment config
 * This file maintains backward compatibility by wrapping shared utilities with env vars
 */

import {
  hashPassword as hashPasswordUtil,
  verifyPassword as verifyPasswordUtil,
  generateToken as generateTokenUtil,
  verifyToken as verifyTokenUtil,
  extractTokenFromHeader as extractTokenFromHeaderUtil,
  JWTPayload,
} from "@tvf/shared-auth";

// Re-export types for backward compatibility
export type { JWTPayload } from "@tvf/shared-auth";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// Security: Validate JWT_SECRET in production
if (process.env.NODE_ENV === "production") {
  if (!process.env.JWT_SECRET || JWT_SECRET === "your-secret-key-change-in-production") {
    throw new Error(
      "CRITICAL: JWT_SECRET must be set to a strong random value in production. " +
      "Do not use the default secret. Generate a secure secret and set it in environment variables."
    );
  }
  if (JWT_SECRET.length < 32) {
    throw new Error(
      "CRITICAL: JWT_SECRET must be at least 32 characters long in production for security."
    );
  }
}

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return hashPasswordUtil(password);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return verifyPasswordUtil(password, hash);
}

/**
 * Generate JWT token (wraps shared utility with env config)
 */
export function generateToken(payload: JWTPayload): string {
  return generateTokenUtil(payload, JWT_SECRET, JWT_EXPIRES_IN);
}

/**
 * Verify JWT token (wraps shared utility with env config)
 */
export function verifyToken(token: string): JWTPayload {
  return verifyTokenUtil(token, JWT_SECRET);
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  return extractTokenFromHeaderUtil(authHeader);
}

