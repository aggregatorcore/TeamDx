/**
 * Backend authentication utilities
 * JWT token generation/verification and password hashing
 */

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { JWTPayload } from "../../types";

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT token
 * @param payload - JWT payload data
 * @param secret - JWT secret key (from environment or config)
 * @param expiresIn - Token expiration time (default: "7d")
 */
export function generateToken(
  payload: JWTPayload,
  secret: string,
  expiresIn: string = "7d"
): string {
  return jwt.sign(payload, secret, {
    expiresIn,
  });
}

/**
 * Verify JWT token
 * @param token - JWT token string
 * @param secret - JWT secret key (from environment or config)
 */
export function verifyToken(token: string, secret: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, secret) as JWTPayload;
    return decoded;
  } catch (error: any) {
    // Provide more specific error messages
    if (error.name === "TokenExpiredError") {
      throw new Error("Token expired. Please login again.");
    } else if (error.name === "JsonWebTokenError") {
      throw new Error("Invalid token. Please login again.");
    } else if (error.name === "NotBeforeError") {
      throw new Error("Token not active yet.");
    }
    throw new Error("Invalid or expired token");
  }
}

/**
 * Extract token from Authorization header
 * @param authHeader - Authorization header value (e.g., "Bearer <token>")
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }
  
  return parts[1];
}








