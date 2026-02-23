"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Clock, X, Phone, SkipForward, Volume2, VolumeX, AlertTriangle, AlertCircle } from "lucide-react";
import { apiClient } from "@/lib/api";
import { calculateOverdueStatus, formatOverdueDuration, formatTimeRemaining, calculateAttemptCount, type OverdueInput } from "@/lib/utils/overdue";
import { tabStorage } from "@/lib/storage";

interface CallbackLead {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  callbackAt: string;
  tagName?: string;
  tagApplicationId?: string; // For dismissal key
  tagKey?: string; // Tag flow key (e.g., "no_answer")
  tagApplications?: Array<{
    tagFlow?: { name?: string; key?: string } | null;
    tagFlowId?: string;
    createdAt: string;
  }>; // Full tag history for attempt count
}

// Initialize dismissed state from localStorage (before component mount - prevents flash)
function initializeDismissedLeads(): Set<string> {
  if (typeof window === "undefined") {
    return new Set<string>();
  }

  try {
    const DISMISSED_LEADS_KEY = "callback_dismissed_leads";
    const stored = localStorage.getItem(DISMISSED_LEADS_KEY);
    if (stored) {
      const dismissedData = JSON.parse(stored);
      const validDismissed = new Set<string>();
      for (const [dismissalKey] of Object.entries(dismissedData)) {
        validDismissed.add(dismissalKey);
      }
      console.log(`[CallbackNotification] Initialized ${validDismissed.size} dismissed lead(s) from storage (before mount)`);
      return validDismissed;
    }
  } catch (error) {
    console.error("[CallbackNotification] Error initializing dismissed leads:", error);
  }

  return new Set<string>();
}

function CallbackNotification() {
  const router = useRouter();
  const pathname = usePathname();
  const [callbackLeads, setCallbackLeads] = useState<CallbackLead[]>([]);

  // Don't show popup when user is on a lead detail page (focus mode = lead open)
  const isLeadDetailPage = Boolean(
    pathname?.match(/^\/leads\/[^/]+$/) || pathname?.match(/^\/dashboard\/leads\/[^/]+$/)
  );
  // Initialize dismissed state from localStorage in state initializer (not after mount)
  const [dismissedLeads, setDismissedLeads] = useState<Set<string>>(initializeDismissedLeads);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false); // Prevent flash on refresh
  const [isReady, setIsReady] = useState(false); // Gate for initial fetch + classification complete
  // Stabilize popup: avoid blink on refresh — show only after leads stable for a moment, hide only after empty for a moment
  const [visibleLeads, setVisibleLeads] = useState<CallbackLead[]>([]);
  const showTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<(() => void) | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Storage key for dismissed leads
  const DISMISSED_LEADS_KEY = "callback_dismissed_leads";
  // No TTL - dismissed is permanent until callbackAt or tagApplicationId changes

  // Helper function to create dismissal key (leadId + callbackAt or tagApplicationId)
  const getDismissalKey = (lead: CallbackLead): string => {
    // Use tagApplicationId if available, otherwise use leadId+callbackAt
    if (lead.tagApplicationId) {
      return `${lead.id}:${lead.tagApplicationId}`;
    }
    return `${lead.id}:${lead.callbackAt}`;
  };

  // Mark as initialized (dismissed state already loaded in state initializer - prevents flash)
  useEffect(() => {
    console.log("[CallbackNotification] Component mounted");
    console.log("[CallbackNotification] NODE_ENV:", process.env.NODE_ENV);
    console.log(`[CallbackNotification] Dismissed leads initialized: ${dismissedLeads.size}`);

    // Mark as initialized (dismissed state already loaded in state initializer)
    setIsInitialized(true);
  }, []);

  // Keep a ref of latest callbackLeads so timeouts always set current data
  const callbackLeadsRef = useRef<CallbackLead[]>([]);
  callbackLeadsRef.current = callbackLeads;

  // Stabilize popup visibility (no blink on refresh): debounce show by 150ms, debounce hide by 400ms
  useEffect(() => {
    const hasLeads = callbackLeads.length > 0;
    if (hasLeads) {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      const alreadyShowing = visibleLeads.length > 0;
      const timer = setTimeout(() => {
        setVisibleLeads(callbackLeadsRef.current);
        showTimeoutRef.current = null;
      }, alreadyShowing ? 0 : 150);
      showTimeoutRef.current = timer;
      return () => {
        if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      };
    } else {
      if (showTimeoutRef.current) {
        clearTimeout(showTimeoutRef.current);
        showTimeoutRef.current = null;
      }
      const timer = setTimeout(() => {
        setVisibleLeads([]);
        hideTimeoutRef.current = null;
      }, 400);
      hideTimeoutRef.current = timer;
      return () => {
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      };
    }
  }, [callbackLeads.length]);

  // Save dismissed leads to localStorage whenever it changes (permanent - no TTL)
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        if (dismissedLeads.size > 0) {
          const dismissedData: Record<string, number> = {};
          const now = Date.now();

          // Save all dismissed leads (permanent until callback changes)
          dismissedLeads.forEach((dismissalKey) => {
            dismissedData[dismissalKey] = now;
          });

          localStorage.setItem(DISMISSED_LEADS_KEY, JSON.stringify(dismissedData));
          console.log(`[CallbackNotification] Saved ${dismissedLeads.size} dismissed lead(s) to storage (permanent until callback changes)`);
        } else {
          // Clear storage if no dismissed leads
          localStorage.removeItem(DISMISSED_LEADS_KEY);
        }
      } catch (error) {
        console.error("[CallbackNotification] Error saving dismissed leads:", error);
      }
    }
  }, [dismissedLeads]);

  // Initialize audio context and create beep sound function
  useEffect(() => {
    // Create a simple beep sound using Web Audio API
    const createBeepSound = async () => {
      try {
        let ctx = audioContextRef.current;

        // Create audio context if not exists
        if (!ctx) {
          ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          audioContextRef.current = ctx;
        }

        // Resume if suspended (required for browser autoplay policy)
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.value = 800; // 800 Hz beep
        oscillator.type = "sine";

        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.3);

        console.log("[CallbackNotification] Beep sound played");
        setSoundBlocked(false);
      } catch (error) {
        console.error("[CallbackNotification] Error playing beep:", error);
        setSoundBlocked(true);
      }
    };

    // Store the function for use
    audioRef.current = createBeepSound as any;

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => { });
      }
    };
  }, []);

  // Handle enable sound button click
  const handleEnableSound = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const ctx = audioContextRef.current;

      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      setSoundEnabled(true);
      setSoundBlocked(false);

      // Play initial beep to confirm sound is working
      if (audioRef.current && typeof audioRef.current === "function") {
        await audioRef.current();
      }

      console.log("[CallbackNotification] Sound enabled by user");
    } catch (error) {
      console.error("[CallbackNotification] Error enabling sound:", error);
      setSoundBlocked(true);
    }
  };

  // Fetch leads with callbacks and check for 30-second warning
  useEffect(() => {
    const checkCallbacks = async () => {
      try {
        console.log("[CallbackNotification] Checking for callbacks...");

        // Fetch all leads
        const response: any = await apiClient.getLeads();
        // Handle different response structures
        const leads = response?.leads || response?.data?.leads || (Array.isArray(response) ? response : []);

        if (leads.length === 0) {
          return;
        }

        // Fetch tags for all leads (but limit to first 50 to avoid too many API calls)
        // In production, you might want to add pagination or a dedicated API endpoint
        const leadsToCheck = leads.slice(0, 50);

        const leadsWithTags = await Promise.all(
          leadsToCheck.map(async (lead: any) => {
            try {
              const tagsResponse = await apiClient.getLeadTags(lead.id);
              const tags = tagsResponse?.tagApplications || (tagsResponse as any)?.tags || [];

              // Get active tag with callbackAt
              const activeTagWithCallback = tags.find((tag: any) => tag.isActive && tag.callbackAt);
              const currentTag = activeTagWithCallback || tags.find((tag: any) => tag.isActive) || (tags.length > 0 ? tags[0] : null);


              return {
                ...lead,
                currentTag: currentTag || null,
                tagApplicationId: currentTag?.id, // Store tag application ID for dismissal key
                tagKey: currentTag?.tagFlow?.key || currentTag?.tagFlow?.name?.toLowerCase().replace(/\s+/g, "_"), // Tag key for attempt count
                tagApplications: tags, // Full tag history for attempt count calculation
              };
            } catch (err) {
              console.warn(`⚠️ [CallbackNotification] Failed to fetch tags for lead ${lead.id}:`, err);
              return {
                ...lead,
                currentTag: null,
              };
            }
          })
        );

        // Filter leads with callbacks that are 30 seconds away or overdue
        const nowForCheck = new Date();
        const warningLeads: CallbackLead[] = [];

        for (const lead of leadsWithTags) {
          // Check if lead has currentTag with callbackAt
          if (lead.currentTag?.callbackAt) {
            const callbackTime = new Date(lead.currentTag.callbackAt);

            // Validate date parsing
            if (isNaN(callbackTime.getTime())) {
              console.warn(`[CallbackNotification] Invalid callback time for lead ${lead.id}: ${lead.currentTag.callbackAt}`);
              continue;
            }

            const diff = callbackTime.getTime() - nowForCheck.getTime();
            const diffSeconds = Math.floor(diff / 1000);

            // Create dismissal key (leadId + callbackAt or tagApplicationId)
            const tempLead: CallbackLead = {
              id: lead.id,
              firstName: lead.firstName || "",
              lastName: lead.lastName || "",
              phone: lead.phone,
              email: lead.email,
              callbackAt: lead.currentTag.callbackAt,
              tagName: lead.currentTag.tagFlow?.name,
              tagApplicationId: lead.currentTag.id, // Use tag application ID if available
              tagKey: lead.tagKey,
              tagApplications: lead.tagApplications,
            };
            const dismissalKey = getDismissalKey(tempLead);
            const isDismissed = dismissedLeads.has(dismissalKey);

            // Log for debugging - show all callbacks within 60 seconds
            if (diff <= 60000 && diff >= -60000) {
              const skipReason = isDismissed
                ? `dismissed (key: ${dismissalKey})`
                : diff > 30000
                  ? `not in window (${diffSeconds}s > 30s)`
                  : diff < 0
                    ? `overdue (${Math.abs(diffSeconds)}s)`
                    : "will show";
              console.log(`[CallbackNotification] Lead ${lead.id} (${lead.firstName} ${lead.lastName}): ${diffSeconds}s until callback, ${skipReason}, callbackAt: ${lead.currentTag.callbackAt}`);
            }

            // Show popup when callback is in 30-second window OR overdue (popup stays pinned)
            // Condition: diff <= 30000 OR diff < 0 (includes overdue - popup stays until action)
            if ((diff <= 30000 || diff < 0) && !isDismissed) {
              console.log(`✅ [CallbackNotification] Adding lead ${lead.id} to warning list (${diffSeconds}s ${diff < 0 ? 'overdue' : 'remaining'}, dismissalKey: ${dismissalKey})`);
              warningLeads.push(tempLead);
            } else if (diff > 30000 && diff <= 60000 && !isDismissed) {
              // Log when callback is between 30-60 seconds away (approaching)
              console.log(`⏳ [CallbackNotification] Lead ${lead.id} callback in ${diffSeconds}s (will show in ${diffSeconds - 30}s)`);
            } else if (isDismissed) {
              // Log dismissed callbacks
              console.log(`🚫 [CallbackNotification] Lead ${lead.id} skipped (dismissed with key: ${dismissalKey})`);
            }
          }
        }

        // Compute final eligible leads list (single computation, single setState - prevents flash)
        const nowForState = new Date();

        // Get current dismissed state (use latest from state)
        const currentDismissed = dismissedLeads;

        // Filter current state to remove dismissed leads
        const validCurrentLeads = callbackLeads.filter((lead) => {
          const callbackTime = new Date(lead.callbackAt);
          const diff = callbackTime.getTime() - nowForState.getTime();
          const dismissalKey = getDismissalKey(lead);
          const isDismissed = currentDismissed.has(dismissalKey);

          // Keep leads that are in 30-second window OR overdue (but not dismissed)
          const isValid = (diff <= 30000 || diff < 0) && !isDismissed;
          return isValid;
        });

        // Add new warning leads (avoid duplicates by dismissal key)
        const existingKeys = new Set(validCurrentLeads.map((l) => getDismissalKey(l)));
        const newLeads = warningLeads.filter((l) => !currentDismissed.has(getDismissalKey(l)) && !existingKeys.has(getDismissalKey(l)));

        // Compute final eligible leads list (single computation)
        const finalEligibleLeads = [...validCurrentLeads, ...newLeads];

        // Single setState (no flicker even when API returns fast/slow)
        setCallbackLeads(finalEligibleLeads);

        if (newLeads.length > 0) {
          console.log(`[CallbackNotification] Added ${newLeads.length} new callback lead(s) to state`);
        }
        if (finalEligibleLeads.length === 0 && callbackLeads.length > 0) {
          console.log("[CallbackNotification] No leads with callbacks due in next 30 seconds");
        }

        // Mark as ready after first classification is complete (render gate)
        setIsReady(true);

        // No cleanup needed - dismissed is permanent until callbackAt or tagApplicationId changes
      } catch (error) {
        console.error("[CallbackNotification] Error fetching leads:", error);
      }
    };

    // Check immediately
    checkCallbacks();

    // Check every 2 seconds for more accurate 30-second detection
    // This ensures we catch callbacks within the 30-second window more reliably
    const fetchInterval = setInterval(checkCallbacks, 2000);

    // Update countdown every second (without fetching)
    // Note: Popup stays pinned even when overdue (timer 0) - only removed on Open/Skip
    const countdownInterval = setInterval(() => {
      setCallbackLeads((prev) => {
        const nowForCountdown = new Date();
        return prev.filter((lead) => {
          const callbackTime = new Date(lead.callbackAt);
          const diff = callbackTime.getTime() - nowForCountdown.getTime();
          const dismissalKey = getDismissalKey(lead);
          const isDismissed = dismissedLeads.has(dismissalKey);
          // Keep leads in 30-second window OR overdue (popup stays pinned until action)
          return (diff <= 30000 || diff < 0) && !isDismissed;
        });
      });
    }, 1000);

    return () => {
      clearInterval(fetchInterval);
      clearInterval(countdownInterval);
    };
  }, [dismissedLeads]);

  // Play sound every 3 seconds when there are callback leads AND sound is enabled
  useEffect(() => {
    if (callbackLeads.length > 0 && soundEnabled) {
      console.log(`🔔 [CallbackNotification] ${callbackLeads.length} callback(s) active, sound enabled - starting notifications`);

      // Play sound immediately when callback is detected (only if sound enabled)
      const playSound = audioRef.current;
      if (playSound && typeof playSound === "function") {
        (async () => {
          try {
            await playSound();
            console.log("[CallbackNotification] Initial beep sound played");
          } catch (error) {
            console.error("[CallbackNotification] Error playing initial beep:", error);
            setSoundBlocked(true);
          }
        })();
      }

      // Then play every 3 seconds to keep reminding
      soundIntervalRef.current = setInterval(() => {
        const playSoundFn = audioRef.current;
        if (playSoundFn && typeof playSoundFn === "function") {
          (async () => {
            try {
              await playSoundFn();
              console.log("[CallbackNotification] Reminder beep played");
            } catch (error) {
              console.error("[CallbackNotification] Error playing reminder beep:", error);
              setSoundBlocked(true);
            }
          })();
        }
      }, 3000);
    } else {
      // Stop sound when no callback leads or sound disabled
      if (soundIntervalRef.current) {
        clearInterval(soundIntervalRef.current);
        soundIntervalRef.current = null;
      }
      if (callbackLeads.length === 0) {
        console.log("[CallbackNotification] No active callbacks, stopping sound");
      }
    }

    return () => {
      if (soundIntervalRef.current) {
        clearInterval(soundIntervalRef.current);
        soundIntervalRef.current = null;
      }
    };
  }, [callbackLeads.length, soundEnabled]);

  const handleOpen = (lead: CallbackLead) => {
    // Instant popup close + navigate to lead detail page
    const dismissalKey = getDismissalKey(lead);
    console.log(`[CallbackNotification] Opening lead ${lead.id} (dismissalKey: ${dismissalKey})`);

    // Persist dismissal key immediately to localStorage (before state update - prevents flash on refresh)
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(DISMISSED_LEADS_KEY);
        const dismissedData: Record<string, number> = stored ? JSON.parse(stored) : {};
        dismissedData[dismissalKey] = Date.now();
        localStorage.setItem(DISMISSED_LEADS_KEY, JSON.stringify(dismissedData));
        console.log(`[CallbackNotification] Persisted dismissal key to localStorage: ${dismissalKey}`);
      } catch (error) {
        console.error("[CallbackNotification] Error persisting dismissal:", error);
      }
    }

    // Instant popup close (remove from state immediately)
    setCallbackLeads((prev) => prev.filter((l) => getDismissalKey(l) !== dismissalKey));

    // Mark as dismissed (UI gate uses persisted state before rendering)
    setDismissedLeads((prev) => {
      const updated = new Set(prev);
      updated.add(dismissalKey);
      return updated;
    });

    // Navigate to lead detail
    router.push(`/leads/${lead.id}`);
  };

  const handleSkip = (lead: CallbackLead) => {
    // Skip = mark lead as OVERDUE + close popup (no 15-min snooze, permanent dismissal)
    const dismissalKey = getDismissalKey(lead);
    console.log(`[CallbackNotification] Skipping callback for lead ${lead.id} (dismissalKey: ${dismissalKey}) - marking as OVERDUE, popup dismissed permanently until callback changes`);

    // Persist dismissal key immediately to localStorage (before state update - prevents flash on refresh)
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(DISMISSED_LEADS_KEY);
        const dismissedData: Record<string, number> = stored ? JSON.parse(stored) : {};
        dismissedData[dismissalKey] = Date.now();
        localStorage.setItem(DISMISSED_LEADS_KEY, JSON.stringify(dismissedData));
        console.log(`[CallbackNotification] Persisted dismissal key to localStorage: ${dismissalKey}`);
      } catch (error) {
        console.error("[CallbackNotification] Error persisting dismissal:", error);
      }
    }

    // Instant popup close (remove from state immediately)
    setCallbackLeads((prev) => prev.filter((l) => getDismissalKey(l) !== dismissalKey));

    // Mark as dismissed (UI gate uses persisted state before rendering)
    setDismissedLeads((prev) => {
      const updated = new Set(prev);
      updated.add(dismissalKey);
      return updated;
    });

    // Note: Lead will automatically appear in Overdue bucket (handled by bucket classification based on callbackAt)
    // Popup will only re-show if callbackAt or tagApplicationId changes (new callback created)
  };

  const handleEscalate = async (lead: CallbackLead) => {
    try {
      console.log(`[CallbackNotification] Escalating lead ${lead.id} - 24h overdue`);

      // Try to call escalation API (if exists)
      try {
        await apiClient.request(`/api/leads/${lead.id}/escalate`, {
          method: "POST",
          body: JSON.stringify({ reason: "24h_overdue" }),
        });
      } catch (apiError: any) {
        // If API doesn't exist, just log and show notification
        console.warn("[CallbackNotification] Escalation API not available, showing notification only");
      }

      // Show browser notification if permission granted
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Lead Escalated", {
          body: `${lead.firstName} ${lead.lastName} - 24h overdue, requires immediate attention`,
          icon: "/favicon.ico",
          tag: `escalation-${lead.id}`,
        });
      }

      // Close popup
      const dismissalKey = getDismissalKey(lead);
      setCallbackLeads((prev) => prev.filter((l) => getDismissalKey(l) !== dismissalKey));
      
      alert(`Lead ${lead.firstName} ${lead.lastName} has been escalated. Team Leader/Manager will be notified.`);
    } catch (error: any) {
      console.error("[CallbackNotification] Error escalating lead:", error);
      alert(`Failed to escalate: ${error.message || "Unknown error"}`);
    }
  };

  // Debug: Log current state
  useEffect(() => {
    if (callbackLeads.length > 0) {
      console.log("[CallbackNotification] Current callback leads:", callbackLeads);
      console.log("[CallbackNotification] Will show popup now!");
    }
  }, [callbackLeads.length]);

  // Add a test button in development mode
  const handleTestPopup = () => {
    console.log("🧪 [CallbackNotification] Test button clicked - adding test callback");
    const testLead: CallbackLead = {
      id: "test-lead-" + Date.now(),
      firstName: "Test",
      lastName: "Lead",
      phone: "1234567890",
      callbackAt: new Date(Date.now() + 10000).toISOString(), // 10 seconds from now
      tagName: "Test Tag",
    };
    setCallbackLeads([testLead]);
  };

  // Clear dismissed callbacks (dev only - for testing)
  const handleClearDismissed = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(DISMISSED_LEADS_KEY);
      setDismissedLeads(new Set());
      console.log("🧹 [CallbackNotification] Cleared all dismissed callbacks");
    }
  };

  // Check if test button should be shown (env flag control)
  const showTestButton =
    typeof window !== "undefined" &&
    process.env.NEXT_PUBLIC_ENABLE_CALLBACK_TEST === "true";

  // Check if debug mode is enabled (for debug info display)
  const isDebugMode =
    typeof window !== "undefined" &&
    process.env.NEXT_PUBLIC_CALLBACK_DEBUG === "true";

  // Show test button and status only if test flag is enabled
  if (showTestButton) {
    return (
      <>
        {/* Test button - only visible if NEXT_PUBLIC_ENABLE_CALLBACK_TEST=true */}
        <div className="fixed bottom-4 right-4 z-[99998] flex flex-col gap-2" style={{ zIndex: 99998 }}>
          <button
            onClick={handleTestPopup}
            className="bg-blue-600 text-white px-4 py-2 rounded-md shadow-lg hover:bg-blue-700 text-sm font-bold transition-all"
            title="Test callback popup"
          >
            🧪 Test Popup
          </button>
          <button
            onClick={handleClearDismissed}
            className="bg-red-600 text-white px-4 py-2 rounded-md shadow-lg hover:bg-red-700 text-sm font-bold transition-all"
            title="Clear all dismissed callbacks (testing only)"
          >
            🧹 Clear Dismiss
          </button>
          {/* Status indicator */}
          <div className="bg-gray-800 text-white px-3 py-2 rounded-md text-xs font-mono">
            <div>Callbacks: {callbackLeads.length}</div>
            <div className="text-[10px] text-gray-400 mt-1">
              {callbackLeads.length > 0 ? "🔔 Active" : "⏸️ Idle"}
            </div>
            <div className="text-[10px] text-gray-400 mt-1">
              Dismissed: {dismissedLeads.size}
            </div>
          </div>
        </div>
        {/* Show popup if callbacks exist (not when on lead detail / focus mode) */}
        {callbackLeads.length > 0 && !isLeadDetailPage && (
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black bg-opacity-50 p-4"
            style={{ zIndex: 99999 }}
            onClick={(e) => {
              // Close on backdrop click (optional - can remove if not desired)
              if (e.target === e.currentTarget) {
                handleSkip(callbackLeads[0]);
              }
            }}
          >
            <div className="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4 p-4 md:p-6 space-y-4 animate-in fade-in zoom-in duration-200 transform transition-all max-h-[90vh] overflow-y-auto" style={{ zIndex: 100000 }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-full">
                    <Clock className="h-6 w-6 text-red-600 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Callback Reminder
                    </h3>
                    <p className="text-sm text-gray-500">
                      {callbackLeads.length} callback{callbackLeads.length > 1 ? "s" : ""} due soon
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!soundEnabled && (
                    <button
                      onClick={handleEnableSound}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors text-sm font-medium"
                      title="Enable sound notifications"
                    >
                      <Volume2 className="h-4 w-4" />
                      Enable Sound
                    </button>
                  )}
                  {soundBlocked && !soundEnabled && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <VolumeX className="h-3 w-3" />
                      Tap Enable Sound
                    </span>
                  )}
                  <button
                    onClick={() => handleSkip(callbackLeads[0])}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Show first callback lead */}
              {callbackLeads[0] && (
                <div className="border-t border-gray-200 pt-4 space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {callbackLeads[0].firstName} {callbackLeads[0].lastName}
                    </p>
                    {callbackLeads[0].phone && (
                      <p className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                        <Phone className="h-4 w-4" />
                        {callbackLeads[0].phone}
                      </p>
                    )}
                    {callbackLeads[0].tagName && (
                      <p className="text-xs text-gray-500 mt-1">Tag: {callbackLeads[0].tagName}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-sm font-medium">
                    {(() => {
                      const now = new Date();
                      const callbackTime = new Date(callbackLeads[0].callbackAt);
                      const diff = callbackTime.getTime() - now.getTime();
                      const isOverdue = diff < 0;
                      
                      // Get user info for RBAC
                      const userStr = typeof window !== "undefined" ? tabStorage.getItem("user") : null;
                      const user = userStr ? JSON.parse(userStr) : null;
                      const userRole = user?.role?.name;
                      const isAssignedToMe = callbackLeads[0].id ? true : false; // Simplified - should check actual assignment
                      
                      const overdueStatus = calculateOverdueStatus({
                        leadId: callbackLeads[0].id,
                        callbackAt: callbackLeads[0].callbackAt,
                        now,
                        userRole,
                        isAssignedToMe,
                      });
                      
                      if (isOverdue) {
                        return (
                          <div className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="h-4 w-4" />
                            <div className="flex flex-col">
                              <span>Overdue {formatOverdueDuration(Math.abs(diff))}</span>
                              {overdueStatus.reminderType && (
                                <span className="text-xs text-orange-600">
                                  {overdueStatus.reminderType === "first" && "⚠️ First Reminder (15m)"}
                                  {overdueStatus.reminderType === "second" && "⚠️⚠️ Second Reminder (60m)"}
                                  {overdueStatus.reminderType === "escalation" && "🚨 ESCALATION (24h)"}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <div className="flex items-center gap-2 text-orange-600">
                            <Clock className="h-4 w-4" />
                            <div className="flex flex-col">
                              <span>Callback in {formatTimeRemaining(diff)}</span>
                              {isDebugMode && (
                                <span className="text-xs text-gray-400 font-mono mt-0.5">
                                  diff: {Math.floor(diff / 1000)}s
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      }
                    })()}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
                    <button
                      onClick={() => handleOpen(callbackLeads[0])}
                      className="flex-1 px-4 py-2.5 rounded-md font-medium transition-colors flex items-center justify-center gap-2 text-sm md:text-base"
                      style={{
                        backgroundColor: '#2563eb',
                        color: '#ffffff',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                    >
                      <Phone className="h-4 w-4" />
                      Open
                    </button>
                    <button
                      onClick={() => handleSkip(callbackLeads[0])}
                      className="flex-1 px-4 py-2.5 rounded-md font-medium transition-colors flex items-center justify-center gap-2 text-sm md:text-base"
                      style={{
                        backgroundColor: '#e5e7eb',
                        color: '#374151',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#d1d5db'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                    >
                      <SkipForward className="h-4 w-4" />
                      Skip
                    </button>
                  </div>
                </div>
              )}

              {/* Show count if multiple callbacks */}
              {callbackLeads.length > 1 && (
                <div className="text-center text-xs text-gray-500 pt-2 border-t border-gray-200">
                  +{callbackLeads.length - 1} more callback{callbackLeads.length - 1 > 1 ? "s" : ""} waiting
                </div>
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  // Render gate: do not render popup until (a) dismissed localStorage loaded (b) first callback scan done
  // This prevents flash on refresh - popup tabhi dikhe jab actually eligible ho
  if (!isInitialized || !isReady) {
    return null;
  }

  // Production: use stabilized visibleLeads so popup doesn't blink on refresh
  if (visibleLeads.length === 0) {
    return null;
  }

  // Don't show popup when user is on lead detail page (focus mode = lead open)
  if (isLeadDetailPage) {
    return null;
  }

  const lead = visibleLeads[0];
  const now = lead ? new Date() : null;
  const callbackTime = lead ? new Date(lead.callbackAt) : null;
  const diff = now && callbackTime ? callbackTime.getTime() - now.getTime() : 0;
  const isOverdue = diff < 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="callback-notification-title"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      style={{ zIndex: 99999 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleSkip(visibleLeads[0]);
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[420px] max-h-[90vh] overflow-hidden flex flex-col border border-gray-200/80"
        style={{ zIndex: 100000 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2.5 rounded-xl flex-shrink-0 ${isOverdue ? "bg-red-100" : "bg-amber-100"}`}>
              <Clock className={`h-5 w-5 flex-shrink-0 ${isOverdue ? "text-red-600" : "text-amber-600"}`} />
            </div>
            <div className="min-w-0">
              <h2 id="callback-notification-title" className="text-lg font-semibold text-gray-900 tracking-tight">
                Callback reminder
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {visibleLeads.length === 1
                  ? "1 lead due"
                  : `${visibleLeads.length} leads in queue`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {!soundEnabled && (
              <button
                type="button"
                onClick={handleEnableSound}
                className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                title="Enable sound"
                aria-label="Enable sound"
              >
                <Volume2 className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSkip(visibleLeads[0])}
              className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {lead && (
            <>
              {/* Lead card */}
              <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 space-y-3">
                <div>
                  <p className="text-base font-semibold text-gray-900 leading-tight">
                    {lead.firstName} {lead.lastName}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
                    {lead.phone && (
                      <span className="inline-flex items-center gap-1.5 font-medium tabular-nums">
                        <Phone className="h-3.5 w-3.5 text-gray-400" />
                        {lead.phone}
                      </span>
                    )}
                    {lead.tagName && (
                      <span className="text-gray-500">
                        {lead.phone ? "·" : ""} {lead.tagName}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status badge */}
                <div className="flex items-center gap-2">
                  {(() => {
                    const userStr = typeof window !== "undefined" ? tabStorage.getItem("user") : null;
                    const user = userStr ? JSON.parse(userStr) : null;
                    const overdueStatus = calculateOverdueStatus({
                      leadId: lead.id,
                      callbackAt: lead.callbackAt,
                      now: now!,
                      userRole: user?.role?.name,
                      isAssignedToMe: true,
                    });
                    if (isOverdue) {
                      return (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-sm font-medium border border-red-100">
                          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                          Overdue {formatOverdueDuration(Math.abs(diff))}
                          {overdueStatus.reminderType === "escalation" && (
                            <span className="text-red-600 font-semibold">· Escalate</span>
                          )}
                        </span>
                      );
                    }
                    return (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 text-sm font-medium border border-amber-100">
                        <Clock className="h-4 w-4 flex-shrink-0" />
                        Due in {formatTimeRemaining(diff)}
                      </span>
                    );
                  })()}
                </div>

                {/* Primary actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleOpen(lead)}
                    className="flex-1 px-4 py-3 rounded-xl font-semibold text-sm bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition-colors flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Phone className="h-4 w-4" />
                    Open lead
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSkip(lead)}
                    className="px-4 py-3 rounded-xl font-medium text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300 transition-colors flex items-center justify-center gap-2"
                  >
                    <SkipForward className="h-4 w-4" />
                    Skip
                  </button>
                </div>

                {/* Retry / Escalate (overdue only) */}
                {(() => {
                  if (diff >= 0) return null;
                  const userStr = typeof window !== "undefined" ? tabStorage.getItem("user") : null;
                  const user = userStr ? JSON.parse(userStr) : null;
                  const attemptCount = calculateAttemptCount(
                    lead.tagApplications || [],
                    lead.tagKey
                  );
                  const overdueStatus = calculateOverdueStatus({
                    leadId: lead.id,
                    callbackAt: lead.callbackAt,
                    now: now!,
                    currentTagKey: lead.tagKey,
                    attemptCount,
                    userRole: user?.role?.name,
                    isAssignedToMe: true,
                  });
                  // Model B: Escalation is auto-only (24h alert, 48h reassign). No manual Escalate button.
                  return null;
                })()}
              </div>

              {/* Queue footer */}
              {visibleLeads.length > 1 && (
                <div className="text-center py-2 px-3 rounded-lg bg-gray-100/80">
                  <p className="text-sm font-medium text-gray-600">
                    +{visibleLeads.length - 1} more callback{visibleLeads.length - 1 > 1 ? "s" : ""} in queue
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default CallbackNotification;
