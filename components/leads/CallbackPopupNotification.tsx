"use client";

import { useState, useEffect } from "react";
import { X, Clock, AlertCircle, Phone, RotateCw, UserCheck } from "lucide-react";
import { apiClient } from "@/lib/api";
import { isWithinShift } from "@/utils/shiftUtils";
import { tabStorage } from "@/lib/storage";

interface CallbackPopupNotificationProps {
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    currentTag?: {
      id: string;
      tagFlowId: string;
      callbackAt?: string | null;
      tagFlow?: {
        id: string;
        name: string;
        color: string;
      };
    } | null;
  };
  tagConfig?: {
    overduePolicy?: {
      popupAtSeconds?: number;
      remindAtMinutes?: number[];
      escalateAtHours?: number;
    };
    actionsShownOnLead?: {
      whenOrange?: {
        popupAtSeconds?: number;
        actions?: string[];
      };
      whenRed?: {
        actions?: string[];
        escalateCondition?: string;
      };
    };
  };
  onAction?: (action: string, leadId: string) => void;
  onClose?: () => void;
  /** No-answer attempt count (1–3). Used to hide Retry at 3/3 and gate Escalate (24h). */
  attemptCount?: number;
}

export default function CallbackPopupNotification({
  lead,
  tagConfig,
  onAction,
  onClose,
  attemptCount = 1,
}: CallbackPopupNotificationProps) {
  const [showPopup, setShowPopup] = useState(false);
  const [isOverdue, setIsOverdue] = useState(false);
  const [overdueHours, setOverdueHours] = useState(0);
  const [shiftConfig, setShiftConfig] = useState<{ shiftStart: string; shiftEnd: string } | null>(null);
  const [isWithinShiftTime, setIsWithinShiftTime] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Fetch shift configuration
  useEffect(() => {
    const fetchShift = async () => {
      try {
        const shift = await apiClient.getTelecallerShift();
        setShiftConfig({
          shiftStart: shift.shiftStart,
          shiftEnd: shift.shiftEnd,
        });
      } catch (error) {
        console.error("Error fetching shift config:", error);
        // Use default shift
        setShiftConfig({ shiftStart: "09:30", shiftEnd: "17:30" });
      }
    };
    fetchShift();
  }, []);

  // Check if user is logged in
  useEffect(() => {
    const checkLogin = () => {
      const token = tabStorage.getItem("token");
      setIsLoggedIn(!!token);
    };

    checkLogin();
    // Check periodically (every 30 seconds)
    const interval = setInterval(checkLogin, 30000);
    return () => clearInterval(interval);
  }, []);

  // Check if current time is within shift
  useEffect(() => {
    if (!shiftConfig) return;

    const checkShift = () => {
      const now = new Date();
      const withinShift = isWithinShift(now, shiftConfig.shiftStart, shiftConfig.shiftEnd);
      setIsWithinShiftTime(withinShift);
    };

    checkShift();
    const interval = setInterval(checkShift, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [shiftConfig]);

  useEffect(() => {
    if (!lead.currentTag?.callbackAt || !shiftConfig) return;

    // Rule C: Popups only when loggedIn AND withinShift
    if (!isLoggedIn || !isWithinShiftTime) {
      setShowPopup(false);
      return;
    }

    const callbackTime = new Date(lead.currentTag.callbackAt);
    const now = new Date();
    const diff = callbackTime.getTime() - now.getTime();
    const isOverdueNow = diff <= 0;
    setIsOverdue(isOverdueNow);

    if (isOverdueNow) {
      const overdueDuration = Math.abs(diff);
      const hours = Math.floor(overdueDuration / (1000 * 60 * 60));
      setOverdueHours(hours);

      // Check if popup should show based on tagConfig
      const popupAtSeconds = tagConfig?.overduePolicy?.popupAtSeconds || 30;
      const overdueSeconds = overdueDuration / 1000;

      // Show popup if overdue and within popup window (first 30 seconds or based on config)
      if (overdueSeconds <= popupAtSeconds) {
        setShowPopup(true);
      }
    } else {
      // For future callbacks, check if we're within popup window (30 seconds before)
      const popupAtSeconds = tagConfig?.overduePolicy?.popupAtSeconds || tagConfig?.actionsShownOnLead?.whenOrange?.popupAtSeconds || 30;
      const secondsUntilCallback = Math.abs(diff) / 1000;

      // Show popup if within -30s window (catch-up: also show if callbackAt passed and within shift)
      if (secondsUntilCallback <= popupAtSeconds) {
        setShowPopup(true);
      }
    }
    
    // CATCH-UP LOGIC: If callbackAt passed and within shift, show popup once per shift
    // Rule: Once per lead per shift (tracked by popupLeads Set in parent)
    if (isOverdueNow && isWithinShiftTime && isLoggedIn) {
      // Popup will show if not in popupLeads Set (handled by parent component)
      // This ensures catch-up popup appears once per shift when user logs in
    }
  }, [lead.currentTag?.callbackAt, tagConfig, shiftConfig, isWithinShiftTime]);

  const handleAction = async (action: string) => {
    if (onAction) {
      onAction(action, lead.id);
    }

    // Handle specific actions (parent may handle Open/Skip via onAction and navigate)
    if (action === "Open") {
      if (!onAction) window.location.href = `/dashboard/leads/${lead.id}`;
    } else if (action === "Skip") {
      setShowPopup(false);
      if (onClose) onClose();
    } else if (action === "Retry Callback") {
      // Open tag modal to reschedule callback
      // This will be handled by parent component
      setShowPopup(false);
    }
  // Model B: No manual escalate; escalation is auto (24h alert, 48h reassign).
  };

  if (!showPopup || !lead.currentTag?.callbackAt) return null;

  const bucket = isOverdue ? "red" : "orange";
  const maxAttemptsReached = attemptCount >= 3;
  let actions: string[] =
    bucket === "orange"
      ? tagConfig?.actionsShownOnLead?.whenOrange?.actions || ["Open", "Skip"]
      : ["Open", "Skip", ...(tagConfig?.actionsShownOnLead?.whenRed?.actions || ["Retry Callback"])];
  // Model B: No "Escalate to Manager" or "Escalate (after 24h)" — escalation is auto-only.
  if (bucket === "red" && maxAttemptsReached) {
    actions = actions.filter((a) => a !== "Retry Callback");
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              bucket === "red" ? "bg-red-100" : "bg-orange-100"
            }`}>
              {bucket === "red" ? (
                <AlertCircle className="h-6 w-6 text-red-600" />
              ) : (
                <Clock className="h-6 w-6 text-orange-600" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {bucket === "red" ? "Overdue Callback" : "Callback Reminder"}
              </h3>
              <p className="text-sm text-gray-600">
                {lead.firstName} {lead.lastName}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setShowPopup(false);
              if (onClose) onClose();
            }}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-700 mb-2">
            <Phone className="h-4 w-4 text-gray-400" />
            <span>{lead.phone}</span>
          </div>
          {lead.currentTag?.tagFlow && (
            <div className="flex items-center gap-2 text-sm">
              <span
                className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                style={{
                  backgroundColor: `${lead.currentTag.tagFlow.color}20`,
                  color: lead.currentTag.tagFlow.color,
                }}
              >
                {lead.currentTag.tagFlow.name}
              </span>
            </div>
          )}
          {isOverdue && (
            <p className="text-sm text-red-600 mt-2">
              Overdue by {overdueHours} hour{overdueHours !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
              <button
                key={action}
                onClick={() => handleAction(action)}
                className={`flex-1 min-w-[120px] px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  action === "Open" || action === "Retry Callback"
                    ? "bg-primary-600 text-white hover:bg-primary-700"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {action === "Retry Callback" && <RotateCw className="h-4 w-4 inline mr-1" />}
                {action}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
