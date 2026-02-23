/**
 * Bucket Classification System
 * 
 * 4 Buckets:
 * - Fresh: New leads (status = "new" or no callStatus)
 * - Green: Interested and progressing (interested category tags)
 * - Orange: Callback parameters (call_back, busy_no_response, switch_off_not_reachable)
 * - Red: Not interested or invalid (not_interested, invalid_closed)
 */

export type BucketType = "fresh" | "green" | "orange" | "red" | "exhaust";

export interface BucketInfo {
  type: BucketType;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
}

export const BUCKET_CONFIG: Record<BucketType, BucketInfo> = {
  exhaust: {
    type: "exhaust",
    label: "Exhaust",
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    icon: "AlertTriangle",
  },
  fresh: {
    type: "fresh",
    label: "Fresh",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    icon: "Sparkles",
  },
  green: {
    type: "green",
    label: "Green",
    color: "text-green-700",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    icon: "CheckCircle2",
  },
  orange: {
    type: "orange",
    label: "Orange",
    color: "text-orange-700",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    icon: "Clock",
  },
  red: {
    type: "red",
    label: "Red",
    color: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    icon: "X",
  },
};

/**
 * Map tagValue to bucket based on category
 * 
 * BUCKET RULES:
 * - FRESH: New/untouched leads (status = "new" and no callStatus)
 * - GREEN: Positive & processing (Interested, Ready to Process, Documents Ready, Counseling)
 * - ORANGE: Follow-up/Waiting (Call Back, Busy, Switch Off, Documents Pending, Budget/Eligibility pending)
 * - RED: Dead/closed (Not Interested, Invalid, Wrong Number, Duplicate, DNC)
 */
const TAG_TO_BUCKET_MAP: Record<string, BucketType> = {
  // Category names (fallback for old data)
  interested: "green", // Category name → Green
  not_interested: "red", // Category name → Red
  call_back: "orange", // Category name → Orange
  busy_no_response: "orange", // Category name → Orange
  switch_off_not_reachable: "orange", // Category name → Orange
  discussion: "green", // Category name → Green
  invalid_closed: "red", // Category name → Red
  
  // Interested category -> Green (Positive & Processing)
  ready_to_process: "green", // Ready to Process → Green
  documents_ready: "green", // Documents Ready → Green
  need_counselor_call: "green", // Need Counselor Call → Green (after callback, moves to Counselor)
  need_senior_discussion: "green", // Need Senior Discussion → Green (moved to Senior/Branch Manager)
  discussion_with_counselor: "green", // Discussion with Counselor → Green
  discussion_with_senior: "green", // Discussion with Senior → Green
  discussion_with_branch_manager: "green", // Discussion with Branch Manager → Green
  
  // Interested but with follow-up → Orange (Follow-up/Waiting)
  documents_pending: "orange", // Documents Pending → Orange (Call Back required)
  budget_issue: "orange", // Budget Issue → Orange (Call Back required)
  eligibility_check_pending: "orange", // Eligibility Check Pending → Orange (Call Back required)
  interested_but_later: "orange", // Interested but Later → Orange (Call Back required)
  
  // Not Interested category -> Red (Dead/Closed)
  not_planning_now: "red",
  no_budget: "red",
  already_applied: "red",
  already_abroad: "red",
  family_not_agree: "red",
  not_eligible: "red",
  just_enquiry: "red",
  
  // Call Back category -> Orange (Follow-up/Waiting)
  call_back_today: "orange",
  call_back_tomorrow: "orange",
  call_back_later: "orange",
  asked_to_whatsapp: "orange", // Still needs follow-up
  asked_to_email: "orange", // Still needs follow-up
  
  // Busy/No Response category -> Orange (Follow-up/Waiting)
  busy: "orange",
  no_answer: "orange",
  call_rejected: "orange",
  call_disconnected: "orange",
  ringing_no_response: "orange",
  
  // Switch Off/Not Reachable category -> Orange (Follow-up/Waiting)
  switch_off: "orange",
  out_of_coverage: "orange",
  phone_not_reachable: "orange",
  
  // Invalid/Closed category -> Red (Dead/Closed)
  invalid_number: "red",
  wrong_number: "red",
  duplicate_lead: "red",
  do_not_call: "red",
};

/**
 * Determine bucket for a lead based on callbackAt, status and callStatus
 * 
 * FINAL BUCKET RULES (LOCKED - No future ambiguity):
 * 
 * PRIORITY ORDER:
 * 1. callbackAt-based classification (highest priority):
 *    - Orange (Callback): Has callbackAt AND now < callbackAt (future callback)
 *    - Red (Overdue): Has callbackAt AND now >= callbackAt (past/overdue)
 * 
 * 2. Status-based classification:
 *    - Red: status = "lost" (closed)
 * 
 * 3. Fresh classification:
 *    - Fresh (Blue): No callbackAt AND no callStatus (untouched/new)
 * 
 * 4. Connected/Processing classification:
 *    - Green: Has callStatus (connected/in progress) AND no callbackAt
 *    - Green: callStatus in interested/processing categories
 * 
 * IMPORTANT RULES:
 * - Skip/Open actions DO NOT affect bucket (only tag change or new callbackAt can move lead)
 * - Bucket purely depends on status + callbackAt vs now
 * - Time cross without tag change must go Red automatically
 * 
 * @param lead - Lead object with status, callStatus, and currentTag.callbackAt
 * @returns BucketType - One of: "fresh" | "green" | "orange" | "red"
 */
export function getLeadBucket(lead: {
  status?: string;
  callStatus?: string | null;
  currentTag?: {
    callbackAt?: string | null;
  } | null;
  callbackAt?: string | null;
  callbackScheduledAt?: string | null;
  isExhausted?: boolean;
  lastHandoffAt?: string | null;
  assignedAt?: string | null;
  shuffleIndex?: number | null;
  tagApplications?: Array<{ createdAt?: string }>;
}): BucketType {
  const now = new Date();
  const callbackAt = lead.currentTag?.callbackAt || lead.callbackAt || lead.callbackScheduledAt;

  // PRIORITY 1: If status is "lost", it's always RED (closed)
  if (lead.status === "lost") {
    return "red";
  }

  // PRIORITY 2: Exhaust overrides everything (single source). Senior-only bucket.
  // If isExhausted === true → EXHAUST always, even if old callbackAt exists.
  if (lead.isExhausted === true) {
    return "exhaust";
  }

  // PRIORITY 3: Shuffled lead with old tag (from previous owner) → Fresh for new owner
  // No tag applied after shuffle/assignment = new owner hasn't acted yet, so show in Fresh
  const tagCreatedAt = (lead as any).tagApplications?.[0]?.createdAt;
  if (tagCreatedAt) {
    const tagTime = new Date(tagCreatedAt).getTime();
    if (lead.lastHandoffAt && tagTime < new Date(lead.lastHandoffAt).getTime()) return "fresh";
    if ((lead.shuffleIndex ?? 0) > 0 && lead.assignedAt && tagTime < new Date(lead.assignedAt).getTime()) return "fresh";
  }

  // PRIORITY 4: callbackAt — if lead has active callback/tag (and not shuffled-with-old-tag above), show Overdue (red) or Callback (orange)
  if (callbackAt) {
    const callbackTime = new Date(callbackAt);
    if (!isNaN(callbackTime.getTime())) {
      const diff = callbackTime.getTime() - now.getTime();
      if (diff > 0) return "orange";
      if (diff <= 0) return "red";
    }
  }
  
  // PRIORITY 5: FRESH (Blue): New/untouched leads (NO callbackAt AND NO callStatus)
  // Rule: Fresh = no callbackAt AND no callStatus
  // IMPORTANT: If callbackAt exists (even if overdue), don't classify as Fresh
  // Only classify as Fresh if there's NO callbackAt
  if (!callbackAt) {
    const hasNoCallStatus = 
      lead.callStatus === null || 
      lead.callStatus === undefined || 
      lead.callStatus === "" ||
      String(lead.callStatus).trim() === "";
    
    if (hasNoCallStatus) {
      return "fresh";
    }
  }
  
  // If callStatus exists, map it to bucket (lead is no longer Fresh)
  // Handle case where callStatus might be an object or "[object object]" string
  let callStatusStr: string;
  
  if (typeof lead.callStatus === "object" && lead.callStatus !== null) {
    // If it's an object, try to extract the value
    console.warn(`⚠️ callStatus is an object:`, lead.callStatus);
    // Try to get tagValue or value from object
    callStatusStr = (lead.callStatus as any).tagValue || (lead.callStatus as any).value || JSON.stringify(lead.callStatus);
  } else if (lead.callStatus === null || lead.callStatus === undefined) {
    // Should have been caught earlier, but just in case
    return "fresh";
  } else {
    callStatusStr = String(lead.callStatus).trim();
  }
  
  // Handle "[object object]" string case (object was stringified incorrectly)
  if (callStatusStr.toLowerCase() === "[object object]" || callStatusStr.toLowerCase() === "[object object]") {
    console.warn(`⚠️ callStatus is "[object object]" string - treating as invalid, defaulting to green`);
    return "green";
  }
  
  // Remove any whitespace and convert to lowercase for matching
  callStatusStr = callStatusStr.toLowerCase().trim();
  
  // Normalize common variations (spaces to underscores, etc.)
  const normalizedStatus = callStatusStr
    .replace(/\s+/g, "_")  // Replace spaces with underscores
    .replace(/-/g, "_")     // Replace hyphens with underscores
    .toLowerCase();
  
  // Try to find bucket mapping (try both original and normalized)
  let bucket = TAG_TO_BUCKET_MAP[callStatusStr] || TAG_TO_BUCKET_MAP[normalizedStatus];
  if (bucket) {
    return bucket;
  }
  
  // Handle common variations manually
  if (callStatusStr === "call back" || normalizedStatus === "call_back") {
    return "orange";
  }
  if (callStatusStr === "call back today" || normalizedStatus === "call_back_today") {
    return "orange";
  }
  if (callStatusStr === "not interested" || normalizedStatus === "not_interested") {
    return "red";
  }
  if (callStatusStr === "not intrusted" || normalizedStatus === "not_intrusted") {
    return "red";
  }
  if (callStatusStr === "intrusted" || normalizedStatus === "intrusted") {
    return "green";
  }
  
  // Fallback: If callStatus exists but not in map, log warning and default to green
  // Only log warning in development to avoid console spam
  if (process.env.NODE_ENV === "development") {
    console.warn(`⚠️ Unknown callStatus "${callStatusStr}" (type: ${typeof lead.callStatus}) - defaulting to green bucket`);
  }
  return "green";
}

/**
 * Get bucket info for a bucket type
 */
export function getBucketInfo(bucketType: BucketType): BucketInfo {
  return BUCKET_CONFIG[bucketType];
}

/**
 * Filter leads by bucket
 * Rule: Overdue → Red bucket, Callback (future) → Orange bucket
 */
export function filterLeadsByBucket(leads: any[], bucketType: BucketType): any[] {
  return leads.filter(lead => {
    const bucket = getLeadBucket(lead);
    
    // Return leads that match the requested bucket
    // getLeadBucket already handles:
    // - Orange: Future callbackAt (now < callbackAt)
    // - Red: Past/overdue callbackAt (now >= callbackAt)
    return bucket === bucketType;
  });
}

/**
 * Count leads in each bucket (including collaboration leads)
 * For Telecaller: Shows assigned leads + collaboration leads (moved but still tracking)
 * For Counselor: Shows assigned leads (including newly moved from Telecaller)
 */
export function getBucketCounts(leads: any[], currentUserId?: string): Record<BucketType, number> {
  const counts: Record<BucketType, number> = {
    exhaust: 0,
    fresh: 0,
    green: 0,
    orange: 0,
    red: 0,
  };
  
  const bucketBreakdown: Record<BucketType, any[]> = {
    exhaust: [],
    fresh: [],
    green: [],
    orange: [],
    red: [],
  };
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Start of today
  
  leads.forEach((lead, index) => {
    // Check if this is a collaboration lead (moved but previous owner tracking)
    const isCollaborationLead = currentUserId && 
                                 lead.previousAssignedTo?.id === currentUserId && 
                                 lead.collaborationActive === true &&
                                 lead.assignedTo?.id !== currentUserId;
    
    // For collaboration leads, always show in Green bucket (view-only tracking)
    if (isCollaborationLead) {
      counts.green++;
      bucketBreakdown.green.push({
        id: lead.id,
        name: `${lead.firstName} ${lead.lastName}`,
        status: lead.status,
        callStatus: lead.callStatus,
        isCollaboration: true,
        currentOwner: lead.assignedTo ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}` : "Unknown",
      });
      return;
    }
    
    const bucket = getLeadBucket(lead);

    // Count all leads in their respective buckets (exhaust takes precedence in getLeadBucket):
    // - Orange: Future callbackAt (now < callbackAt)
    // - Red: Past/overdue callbackAt (now >= callbackAt)
    // No need to skip future callbacks - they should be in Orange bucket
    counts[bucket]++;
    bucketBreakdown[bucket].push({
      id: lead.id,
      name: `${lead.firstName} ${lead.lastName}`,
      status: lead.status,
      callStatus: lead.callStatus,
      isCollaboration: false,
    });
  });
  
  return counts;
}

