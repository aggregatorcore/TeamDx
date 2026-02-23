"use client";

import { useState, useEffect } from "react";
import { X, Clock, Bell, Phone } from "lucide-react";

interface CallbackReminderNotificationProps {
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
  reminderMinutes: number;
  onClose?: () => void;
  onOpen?: () => void;
}

export default function CallbackReminderNotification({
  lead,
  reminderMinutes,
  onClose,
  onOpen,
}: CallbackReminderNotificationProps) {
  const [showReminder, setShowReminder] = useState(false);
  const [timeUntilCallback, setTimeUntilCallback] = useState<string>("");

  useEffect(() => {
    if (!lead.currentTag?.callbackAt) return;

    const checkReminder = () => {
      const callbackTime = new Date(lead.currentTag!.callbackAt!);
      const now = new Date();
      const diff = callbackTime.getTime() - now.getTime();
      
      // Check if we're within the reminder window (reminderMinutes before callback)
      // Show reminder when: callbackTime - now <= reminderMinutes
      // Example: If callback is in 60 minutes, show reminder when diff <= 60*60*1000
      const reminderWindowMs = reminderMinutes * 60 * 1000;
      const isWithinReminderWindow = diff > 0 && diff <= reminderWindowMs;
      
      // Also check if we're within a 5-minute window (to avoid showing multiple times)
      const windowEnd = reminderWindowMs;
      const windowStart = reminderWindowMs - (5 * 60 * 1000); // 5 minute window
      const isInWindow = diff > windowStart && diff <= windowEnd;
      
      if (isInWindow) {
        setShowReminder(true);
        if (onOpen) onOpen();
        
        // Calculate time until callback
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(minutes / 60);
        if (hours > 0) {
          setTimeUntilCallback(`${hours}h ${minutes % 60}m`);
        } else {
          setTimeUntilCallback(`${minutes}m`);
        }
      } else {
        setShowReminder(false);
      }
    };

    checkReminder();
    const interval = setInterval(checkReminder, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [lead.currentTag?.callbackAt, reminderMinutes, onOpen]);

  if (!showReminder || !lead.currentTag?.callbackAt) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-xl border border-orange-200 max-w-sm w-full z-50 p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Bell className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Callback Reminder</h4>
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
          <Clock className="h-4 w-4 text-orange-600" />
          <span className="text-orange-700 font-medium">
            Callback in {timeUntilCallback}
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
    </div>
  );
}
