"use client";

import { useState, useEffect, useRef } from "react";
import { Clock } from "lucide-react";
import { getCountdownText } from "@/lib/utils/countdown";

interface LeadCardTagInfoProps {
  currentTag?: {
    id: string;
    tagFlowId: string;
    callbackAt?: string | null;
    tagFlow?: {
      id: string;
      name: string;
      color: string;
    } | null;
  } | null;
  tagHistory?: Array<{
    tagFlow?: {
      tagKey?: string;
      tagValue?: string;
      name?: string;
    } | null;
    callbackAt?: string | null;
  }>;
  tagKey?: string; // e.g., "no_answer"
  /** Required to show "Schedule callback" button when callback is missing. */
  leadId?: string;
  /** Called after successfully scheduling callback (e.g. refetch lead). */
  onScheduleCallback?: (leadId: string) => Promise<void>;
  /** Model B: Escalation is auto-only (24h alert, 48h reassign). No manual escalate button. */
}

export default function LeadCardTagInfo({
  currentTag,
  tagHistory = [],
  tagKey = "no_answer",
  leadId,
  onScheduleCallback,
}: LeadCardTagInfoProps) {
  const [attemptCount, setAttemptCount] = useState(0);
  const [countdown, setCountdown] = useState<string>("");
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const autoScheduledRef = useRef(false);
  const MAX_ATTEMPTS = 3; // From workflow configuration

  // Auto-schedule callback once when No Answer has no callback (solves "Callback not scheduled" without user click)
  useEffect(() => {
    const activeTagApp = tagHistory?.length
      ? tagHistory.find((ta: any) =>
          ta.tagFlow?.tagValue === tagKey || ta.tagFlow?.tagValue === "no_answer" || (currentTag && ta.tagFlowId === currentTag.tagFlowId)
        ) || tagHistory[0]
      : null;
    const hasCallbackAt = !!(activeTagApp?.callbackAt || currentTag?.callbackAt);
    const isNoAnswer = currentTag?.tagFlow?.tagValue === "no_answer";
    const canAutoSchedule =
      leadId &&
      onScheduleCallback &&
      isNoAnswer &&
      !hasCallbackAt &&
      attemptCount < MAX_ATTEMPTS &&
      !autoScheduledRef.current;
    if (!canAutoSchedule) return;
    autoScheduledRef.current = true;
    setScheduleLoading(true);
    onScheduleCallback(leadId)
      .catch(() => { /* suppress alert when backend returns 400 (e.g. no unscheduled tag) */ })
      .finally(() => {
        setScheduleLoading(false);
      });
  }, [leadId, onScheduleCallback, currentTag?.tagFlowId, currentTag?.tagFlow?.tagValue, attemptCount, tagHistory]);

  // Reset auto-schedule ref when lead or tag identity changes so a different lead can auto-schedule
  useEffect(() => {
    autoScheduledRef.current = false;
  }, [leadId, currentTag?.id]);

  // Calculate attempt count from tag history
  useEffect(() => {
    if (!tagHistory || tagHistory.length === 0) {
      setAttemptCount(0);
      return;
    }

    // Normalize tagKey for comparison (handle both "no_answer" and "no answer")
    const normalizedTagKey = tagKey.toLowerCase().replace(/\s+/g, "_");
    const normalizedTagKeySpaces = tagKey.toLowerCase().replace(/_/g, " ");

    // Filter to only count tags that match the current tag's tagValue
    // This ensures we only count "no_answer" attempts, not all tags
    const matchingTags = tagHistory.filter((ta) => {
      if (!ta.tagFlow) return false;
      
      // Get tagValue from the tag flow (this is the actual tag identifier)
      const tagValue = ta.tagFlow.tagValue?.toLowerCase().replace(/\s+/g, "_");
      const tagKeyField = (ta.tagFlow as any).tagKey?.toLowerCase().replace(/\s+/g, "_");
      const tagName = ta.tagFlow.name?.toLowerCase().replace(/\s+/g, "_");
      
      // Strict matching: prefer tagValue, then tagKey, then name
      // Only count if it matches the normalized tagKey
      if (tagValue) {
        return tagValue === normalizedTagKey;
      }
      if (tagKeyField) {
        return tagKeyField === normalizedTagKey;
      }
      if (tagName) {
        return tagName === normalizedTagKey || tagName === normalizedTagKeySpaces;
      }
      
      return false;
    });
    
    setAttemptCount(matchingTags.length);
  }, [tagHistory, tagKey]);

  // Live countdown timer
  useEffect(() => {
    // FIX: Check tagApplications first (from API), then fallback to currentTag
    // Backend might not include callbackAt in currentTag, but it's in tagApplications[0]
    const activeTagApp = tagHistory && tagHistory.length > 0 
      ? tagHistory.find((ta: any) => 
          ta.tagFlow?.tagValue === tagKey || 
          ta.tagFlow?.tagValue === "no_answer" ||
          (currentTag && ta.tagFlowId === currentTag.tagFlowId)
        ) || tagHistory[0]
      : null;
    
    const callbackAt = activeTagApp?.callbackAt || currentTag?.callbackAt;
    
    if (!callbackAt) {
      setCountdown("");
      return;
    }

    const updateCountdown = () => {
      const countdownText = getCountdownText(callbackAt, { includeSeconds: true });
      setCountdown(countdownText);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000); // Update every second so overdue/due countdown ticks

    return () => clearInterval(interval);
  }, [currentTag?.callbackAt, tagHistory, tagKey]);

  if (!currentTag) return null;

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  // Max attempts reached: one line for "what happens next" (used in both due and overdue)
  const maxAttemptsNote = "Next No Answer will shuffle lead to another agent.";

  const isWrongNumber = currentTag?.tagFlow?.tagValue === "wrong_number";
  // Wrong Number: no attempts, no callback, no countdown — lead is in Exhaust
  if (isWrongNumber) {
    return (
      <div className="flex flex-col gap-2 mt-1">
        <div className="text-xs text-gray-500">Moved to Exhaust</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 mt-1">
      {attemptCount > 0 && (
        <div className={`text-xs ${
          attemptCount >= MAX_ATTEMPTS ? "text-red-600 font-semibold" : "text-gray-600"
        }`}>
          Attempt {Math.min(attemptCount, MAX_ATTEMPTS)}/{MAX_ATTEMPTS}
          {attemptCount >= MAX_ATTEMPTS && (
            <span className="ml-1">(Max reached)</span>
          )}
        </div>
      )}

      {(() => {
        const activeTagApp = tagHistory && tagHistory.length > 0 
          ? tagHistory.find((ta: any) => 
              ta.tagFlow?.tagValue === tagKey || 
              ta.tagFlow?.tagValue === "no_answer" ||
              (currentTag && ta.tagFlowId === currentTag.tagFlowId)
            ) || tagHistory[0]
          : null;
        const callbackAt = activeTagApp?.callbackAt || currentTag?.callbackAt;
        const hasCallbackAt = !!callbackAt;
        
        return (
          <>
            {hasCallbackAt && attemptCount < MAX_ATTEMPTS && !countdown && (
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <Clock className="h-3 w-3 flex-shrink-0" />
                <span>Next: {formatTime(callbackAt)}</span>
              </div>
            )}
            {countdown && attemptCount < MAX_ATTEMPTS && callbackAt && (
              <div className={`flex flex-col gap-0.5 text-xs font-medium ${
                countdown.includes("Overdue") ? "text-red-600" : "text-orange-600"
              }`}>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 flex-shrink-0" />
                  {countdown.includes("Overdue") ? countdown : `Next call in ${countdown.replace(/^Due in /, "")}`}
                </div>
                <div className="flex items-center gap-1.5 pl-4 text-gray-600 font-normal">
                  {formatDate(callbackAt)} at {formatTime(callbackAt)}
                </div>
              </div>
            )}
            {countdown && attemptCount >= MAX_ATTEMPTS && !countdown.includes("Overdue") && callbackAt && (
              <div className="flex flex-col gap-0.5 text-xs text-gray-600">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 flex-shrink-0" />
                  <span>Callback in {countdown.replace(/^Due in /, "")}</span>
                </div>
                <div className="pl-4 text-gray-500 font-normal">
                  {formatDate(callbackAt)} at {formatTime(callbackAt)}
                </div>
                <p className="pl-4 text-gray-500">{maxAttemptsNote}</p>
              </div>
            )}
            {countdown && attemptCount >= MAX_ATTEMPTS && countdown.includes("Overdue") && callbackAt && (
              <div className="flex flex-col gap-0.5 text-xs font-medium text-red-600">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 flex-shrink-0" />
                  <span>{countdown}</span>
                </div>
                <div className="pl-4 text-red-500/90 font-normal">
                  {formatDate(callbackAt)} at {formatTime(callbackAt)}
                </div>
                <p className="pl-4 text-red-500/90 font-normal">{maxAttemptsNote}</p>
              </div>
            )}

            {!hasCallbackAt && attemptCount < MAX_ATTEMPTS && currentTag.tagFlow?.tagValue === "no_answer" && (
              <div className="text-xs text-amber-600 font-medium bg-amber-50 px-2 py-1.5 rounded border border-amber-200 space-y-1">
                <span className="block">⚠️ Callback not scheduled.</span>
                {leadId && onScheduleCallback ? (
                  <button
                    type="button"
                    onClick={async () => {
                      if (scheduleLoading || !leadId) return;
                      setScheduleLoading(true);
                      try {
                        await onScheduleCallback(leadId);
                      } finally {
                        setScheduleLoading(false);
                      }
                    }}
                    disabled={scheduleLoading}
                    className="mt-1 text-amber-800 underline hover:no-underline disabled:opacity-50"
                  >
                    {scheduleLoading ? "Scheduling…" : "Schedule callback now"}
                  </button>
                ) : (
                  <span className="block">Re-apply &quot;No Answer&quot; tag to schedule callback.</span>
                )}
              </div>
            )}

          </>
        );
      })()}
    </div>
  );
}
