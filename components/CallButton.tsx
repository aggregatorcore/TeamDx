"use client";

import { useState } from "react";
import { Phone, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { apiClient } from "@/lib/api";

interface CallButtonProps {
  phoneNumber: string;
  leadId?: string;
  onCallInitiated?: (requestId: string) => void;
  onCallStatusChange?: (status: string) => void;
  /** When true, error/status show as tooltip only so the button row stays one line */
  compact?: boolean;
}

export default function CallButton({ 
  phoneNumber, 
  leadId,
  onCallInitiated,
  onCallStatusChange,
  compact = false,
}: CallButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const handleCall = async () => {
    setLoading(true);
    setError(null);
    setCallStatus("initiating");

    try {
      // Check device status first
      const deviceStatus = await apiClient.getMobileDeviceStatus();
      
      if (!deviceStatus.isOnline) {
        setError("Device offline. Connect mobile app.");
        setLoading(false);
        setCallStatus(null);
        return;
      }

      // Initiate call
      const response = await apiClient.initiateCall(phoneNumber, leadId);
      const reqId = response.callRequest?.id || response.requestId;
      setRequestId(reqId);
      setCallStatus("initiated");
      onCallInitiated?.(reqId);
      onCallStatusChange?.("initiated");
      
      // Start timeout for manual fallback (2 minutes)
      setTimeout(() => {
        if (callStatus !== "ended") {
          setCallStatus("timeout");
          onCallStatusChange?.("timeout");
          // Manual fallback will be handled by parent component
        }
      }, 2 * 60 * 1000); // 2 minutes

    } catch (err: any) {
      const errorMessage = err.message || "Failed to initiate call";
      setError(errorMessage);
      setCallStatus(null);
      onCallStatusChange?.(null);
      
      // Handle specific error cases
      if (errorMessage.includes("not online") || errorMessage.includes("offline")) {
        setError("Device offline. Connect mobile app.");
      }
    } finally {
      setLoading(false);
    }
  };

  const buttonTitle = error ? error : (callStatus && !error ? `Status: ${callStatus}` : undefined);

  return (
    <div className={compact ? "inline-flex items-center gap-2" : "flex flex-col gap-2 self-start"}>
      <button
        onClick={handleCall}
        disabled={loading || callStatus === "initiated" || callStatus === "intentOpened"}
        title={compact ? buttonTitle : undefined}
        className={`flex items-center justify-center gap-2 min-w-[11rem] px-4 py-2 rounded-lg transition-colors outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white
          ${error && compact ? "bg-green-600/90 text-white hover:bg-green-700 ring-2 ring-red-400/80" : "bg-green-600 text-white hover:bg-green-700"}
          disabled:bg-gray-400 disabled:cursor-not-allowed
          focus:ring-green-500`}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Initiating...</span>
          </>
        ) : callStatus === "initiated" || callStatus === "intentOpened" ? (
          <>
            <CheckCircle2 className="h-4 w-4" />
            <span>Call Initiated</span>
          </>
        ) : (
          <>
            <Phone className="h-4 w-4" />
            <span>Call</span>
          </>
        )}
      </button>
      {compact && error && (
        <span title={error} className="text-red-300 hover:text-red-200 transition-colors cursor-help" aria-label={error}>
          <AlertCircle className="h-4 w-4" />
        </span>
      )}
      {!compact && error && (
        <div className="flex items-center gap-2 text-xs text-red-600 max-w-[11rem]">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="leading-tight">{error}</span>
        </div>
      )}
      {!compact && callStatus && !error && (
        <div className="text-sm text-gray-600">
          Status: {callStatus === "initiated" ? "Call initiated" : 
                   callStatus === "intentOpened" ? "Call in progress" :
                   callStatus === "ended" ? "Call ended" :
                   callStatus === "timeout" ? "Waiting for call end..." :
                   callStatus}
        </div>
      )}
    </div>
  );
}




