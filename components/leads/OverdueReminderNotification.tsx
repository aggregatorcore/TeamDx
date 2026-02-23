"use client";

import { useState, useEffect } from "react";
import { X, Clock, AlertCircle, Phone, RotateCw, UserCheck } from "lucide-react";
import { apiClient } from "@/lib/api";
import { isWithinShift } from "@/utils/shiftUtils";
import { getOverdueAge } from "@/lib/utils/countdown";

interface OverdueReminderNotificationProps {
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
  reminderMinutes: number; // e.g., 15 or 60 minutes overdue
  attemptCount?: number; // Current attempt count (1/3, 2/3, 3/3)
  onClose?: () => void;
  onRetry?: (leadId: string) => void; // Callback for Retry action
}

export default function OverdueReminderNotification({
  lead,
  reminderMinutes,
  attemptCount = 0,
  onClose,
  onRetry,
}: OverdueReminderNotificationProps) {
  const [showReminder, setShowReminder] = useState(false);
  const [overdueDuration, setOverdueDuration] = useState<string>("");
  const [overdueHours, setOverdueHours] = useState(0);
  const [shiftConfig, setShiftConfig] = useState<{ shiftStart: string; shiftEnd: string } | null>(null);
  const [isWithinShiftTime, setIsWithinShiftTime] = useState(false);

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
        setShiftConfig({ shiftStart: "09:30", shiftEnd: "17:30" });
      }
    };
    fetchShift();
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
    const interval = setInterval(checkShift, 60000);
    return () => clearInterval(interval);
  }, [shiftConfig]);

  useEffect(() => {
    if (!lead.currentTag?.callbackAt || !shiftConfig) return;

    // Only show if within shift
    if (!isWithinShiftTime) {
      setShowReminder(false);
      return;
    }

    const checkReminder = () => {
      const callbackTime = new Date(lead.currentTag!.callbackAt!);
      const now = new Date();
      const diff = callbackTime.getTime() - now.getTime();
      
      // Only show if overdue
      if (diff > 0) {
        setShowReminder(false);
        return;
      }

      // Calculate overdue duration using utility
      const overdueMinutes = Math.floor(Math.abs(diff) / (1000 * 60));
      const hours = getOverdueAge(lead.currentTag!.callbackAt!);
      setOverdueHours(hours); // Store for Escalate button visibility
      
      // Check if we're within the reminder window
      const reminderWindowStart = reminderMinutes;
      const reminderWindowEnd = reminderMinutes + 5; // 5 minute window
      
      if (overdueMinutes >= reminderWindowStart && overdueMinutes < reminderWindowEnd) {
        setShowReminder(true);
        
        // Format overdue duration
        const minutes = overdueMinutes % 60;
        if (hours > 0) {
          setOverdueDuration(`${hours}h ${minutes}m`);
        } else {
          setOverdueDuration(`${minutes}m`);
        }
      } else {
        setShowReminder(false);
      }
    };

    checkReminder();
    const interval = setInterval(checkReminder, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [lead.currentTag?.callbackAt, reminderMinutes, shiftConfig, isWithinShiftTime]);

  if (!showReminder || !lead.currentTag?.callbackAt) return null;

  const isStrongReminder = reminderMinutes >= 60;

  return (
    <div className={`fixed bottom-4 right-4 bg-white rounded-lg shadow-xl border max-w-sm w-full z-50 p-4 ${
      isStrongReminder ? "border-2 border-red-300" : "border-orange-200"
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            isStrongReminder ? "bg-red-100" : "bg-orange-100"
          }`}>
            {isStrongReminder ? (
              <AlertCircle className="h-5 w-5 text-red-600" />
            ) : (
              <Clock className="h-5 w-5 text-orange-600" />
            )}
          </div>
          <div>
            <h4 className={`text-sm font-semibold ${
              isStrongReminder ? "text-red-900" : "text-orange-900"
            }`}>
              {isStrongReminder ? "Overdue Callback" : "Callback Reminder"}
            </h4>
            <p className="text-xs text-gray-600">
              {lead.firstName} {lead.lastName}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setShowReminder(false);
            if (onClose) onClose();
          }}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <Phone className="h-4 w-4 text-gray-400" />
          <span>{lead.phone}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className={`h-4 w-4 ${
            isStrongReminder ? "text-red-600" : "text-orange-600"
          }`} />
          <span className={`font-medium ${
            isStrongReminder ? "text-red-700" : "text-orange-700"
          }`}>
            Overdue by {overdueDuration}
          </span>
        </div>
        {lead.currentTag?.tagFlow && (
          <div className="flex items-center gap-2">
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
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200">
        {/* Retry Button - Only show if attemptCount < 3 */}
        {attemptCount < 3 && onRetry && (
          <button
            onClick={() => onRetry(lead.id)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            <RotateCw className="h-4 w-4" />
            Retry (Attempt {attemptCount + 1}/3)
          </button>
        )}

        {/* Model B: Escalation is auto-only (24h alert, 48h reassign). No manual Escalate button. */}
      </div>
    </div>
  );
}
