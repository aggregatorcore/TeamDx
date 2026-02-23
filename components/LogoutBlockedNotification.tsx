"use client";

import { AlertCircle, X, LogOut } from "lucide-react";

interface LogoutBlockedNotificationProps {
  show: boolean;
  onDismiss?: () => void;
}

export default function LogoutBlockedNotification({
  show,
  onDismiss,
}: LogoutBlockedNotificationProps) {
  if (!show) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-slide-in-down max-w-md w-full mx-4">
      <div className="bg-orange-50 border-2 border-orange-500 rounded-lg shadow-xl p-4">
        <div className="flex items-start gap-3">
          <div className="bg-orange-100 p-2 rounded-full flex-shrink-0">
            <AlertCircle className="h-6 w-6 text-orange-600 animate-pulse" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-orange-900 mb-1 text-lg">
              Logout Blocked
            </h3>
            <p className="text-sm text-orange-800 mb-2">
              Pehle logout karna hoga fir checkout hoga. Receptionist se check-out karwaye bina aap logout nahi kar sakte.
            </p>
            <div className="flex items-center gap-2 text-xs text-orange-700">
              <LogOut className="h-4 w-4" />
              <span>Please get checked out by receptionist first</span>
            </div>
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-orange-400 hover:text-orange-600 transition-colors flex-shrink-0"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
