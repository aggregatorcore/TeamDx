"use client";

import { useEffect, useState } from "react";
import { AlertCircle, X, Clock } from "lucide-react";

interface CheckInRequiredNotificationProps {
  show: boolean;
  onDismiss?: () => void;
}

export default function CheckInRequiredNotification({
  show,
  onDismiss,
}: CheckInRequiredNotificationProps) {
  const [isVisible, setIsVisible] = useState(show);

  useEffect(() => {
    setIsVisible(show);
  }, [show]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-slide-in-down max-w-md w-full mx-4">
      <div className="bg-red-50 border-2 border-red-500 rounded-lg shadow-xl p-4">
        <div className="flex items-start gap-3">
          <div className="bg-red-100 p-2 rounded-full flex-shrink-0">
            <AlertCircle className="h-6 w-6 text-red-600 animate-pulse" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-red-900 mb-1 text-lg">
              Check-In Required
            </h3>
            <p className="text-sm text-red-800 mb-2">
              Pehle check-in karo. Receptionist se check-in karwaye bina aap system use nahi kar sakte.
            </p>
            <div className="flex items-center gap-2 text-xs text-red-700">
              <Clock className="h-4 w-4" />
              <span>Receptionist ko notification bhej diya gaya hai</span>
            </div>
          </div>
          {onDismiss && (
            <button
              onClick={() => {
                setIsVisible(false);
                onDismiss?.();
              }}
              className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
