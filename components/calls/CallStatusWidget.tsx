"use client";

import { useState, useEffect } from "react";
import { Phone, PhoneCall, PhoneIncoming, PhoneOutgoing, Clock, X } from "lucide-react";
import { callService, Call } from "@/lib/services/callService";

export default function CallStatusWidget() {
  const [activeCalls, setActiveCalls] = useState<Call[]>([]);

  useEffect(() => {
    // Subscribe to active calls
    const unsubscribe = callService.subscribeToActiveCalls((calls) => {
      setActiveCalls(calls);
    });

    return () => unsubscribe();
  }, []);

  if (activeCalls.length === 0) return null;

  const formatDuration = (startTime: Date): string => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - startTime.getTime()) / 1000);
    const minutes = Math.floor(diff / 60);
    const seconds = diff % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {activeCalls.map((call) => (
        <div
          key={call.callId}
          className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 min-w-[280px]"
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              {call.type === "incoming" ? (
                <PhoneIncoming className="h-5 w-5 text-green-600" />
              ) : (
                <PhoneOutgoing className="h-5 w-5 text-blue-600" />
              )}
              <div>
                <p className="font-semibold text-gray-900">
                  {call.type === "incoming" ? "Incoming Call" : "Outgoing Call"}
                </p>
                <p className="text-sm text-gray-600">{call.phoneNumber}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="h-4 w-4" />
              <span className="font-mono">{formatDuration(call.startTime)}</span>
            </div>
            <div className="flex items-center gap-1">
              {call.status === "ringing" && (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                  Ringing
                </span>
              )}
              {call.status === "connected" && (
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                  Connected
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}


