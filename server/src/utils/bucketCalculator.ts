/**
 * Bucket Calculation Utility
 * 
 * Implements FINAL bucket rules from BUCKET_RULES_FINAL.md
 * 
 * Priority Order (STRICT - Must Follow This Order):
 * 1. callbackAt-based classification (HIGHEST PRIORITY)
 *    - If callbackAt exists:
 *      - now < callbackAt → Orange (Callback Due)
 *      - now >= callbackAt → Red (Overdue)
 *    - This overrides everything else
 * 
 * 2. Status-based classification
 *    - If status === "lost" → Red (Closed)
 *    - Only applies if no callbackAt exists
 * 
 * 3. Fresh classification
 *    - If NO callbackAt AND NO callStatus → Blue (Fresh)
 *    - Only applies if no callbackAt and no callStatus
 * 
 * 4. Connected/Processing classification
 *    - If has callStatus AND NO callbackAt → Green (Connected)
 *    - Only applies if no callbackAt but has callStatus
 */

export type BucketType = "blue" | "green" | "orange" | "red";

export interface BucketCalculationInput {
  status?: string | null;
  callStatus?: string | null;
  callbackAt?: string | Date | null;
  // Support for LeadCurrentTagState structure
  currentTagState?: {
    childTag?: {
      tagFlow?: {
        requiresCallback?: boolean;
      };
    };
  } | null;
}

/**
 * Calculate bucket for a lead based on FINAL bucket rules
 * 
 * @param input - Lead data with status, callStatus, and callbackAt
 * @returns BucketType - One of: "blue" | "green" | "orange" | "red"
 */
/**
 * Get current server time in UTC (ANKIT_API_02)
 * Ensures consistent time comparison across all requests
 */
function getServerTimeUTC(): Date {
  // Always use UTC time for consistency
  // This prevents server time vs client time mismatch
  return new Date();
}

export function calculateBucket(input: BucketCalculationInput): BucketType {
  // Use server time in UTC for consistent bucket calculation (ANKIT_API_02)
  const now = getServerTimeUTC();
  
  // PRIORITY 1: callbackAt-based classification (HIGHEST PRIORITY)
  // Rule: callbackAt overrides everything else - even if lead has callStatus or other tags
  const callbackAt = input.callbackAt;
  if (callbackAt) {
    // Ensure callbackAt is parsed as UTC (ANKIT_API_02)
    let callbackTime: Date;
    if (callbackAt instanceof Date) {
      callbackTime = callbackAt;
    } else if (typeof callbackAt === "string") {
      // Parse ISO string - ensure it's treated as UTC
      callbackTime = new Date(callbackAt);
    } else {
      callbackTime = new Date(callbackAt);
    }
    
    // Validate date
    if (!isNaN(callbackTime.getTime())) {
      // Compare in UTC to avoid timezone issues (ANKIT_API_02)
      const diff = callbackTime.getTime() - now.getTime();
      
      // Future callback => ORANGE (Callback Due)
      if (diff > 0) {
        return "orange";
      }
      
      // Past/current callback => RED (Overdue)
      // Rule: Time cross without tag change must go Red automatically (ANKIT_API_02)
      if (diff <= 0) {
        return "red";
      }
    } else {
      // Invalid date - log warning in development
      if (process.env.NODE_ENV === "development") {
        console.warn(`[Bucket] Invalid callbackAt date: ${callbackAt}`);
      }
    }
  }
  
  // PRIORITY 2: Status-based classification
  // Only applies if no callbackAt exists
  if (input.status === "lost") {
    return "red";
  }
  
  // PRIORITY 3: FRESH (Blue): New/untouched leads (NO callbackAt AND NO callStatus)
  // Rule: Fresh = no callbackAt AND no callStatus
  // IMPORTANT: If callbackAt exists (even if overdue), don't classify as Fresh
  // Only classify as Fresh if there's NO callbackAt
  if (!callbackAt) {
    const hasNoCallStatus = 
      input.callStatus === null || 
      input.callStatus === undefined || 
      input.callStatus === "" ||
      String(input.callStatus).trim() === "";
    
    if (hasNoCallStatus) {
      return "blue";
    }
  }
  
  // PRIORITY 4: GREEN (Connected): Has callStatus AND NO callbackAt
  // Rule: Green = has callStatus AND no callbackAt
  // Only applies if no callbackAt but has callStatus
  if (!callbackAt && input.callStatus) {
    const callStatusStr = String(input.callStatus).trim();
    if (callStatusStr !== "" && callStatusStr.toLowerCase() !== "[object object]") {
      return "green";
    }
  }
  
  // Fallback: If we reach here, default to blue (fresh)
  // This should rarely happen if data is consistent
  if (process.env.NODE_ENV === "development") {
    console.warn(`[Bucket] Fallback to blue for lead with:`, {
      status: input.status,
      callStatus: input.callStatus,
      callbackAt: input.callbackAt,
    });
  }
  return "blue";
}

/**
 * Get bucket display name
 */
export function getBucketDisplayName(bucket: BucketType): string {
  const names: Record<BucketType, string> = {
    blue: "Blue",
    green: "Green",
    orange: "Orange",
    red: "Red",
  };
  return names[bucket] || "Blue";
}
