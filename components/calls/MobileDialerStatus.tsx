"use client";

import { useState, useEffect } from "react";
import { Smartphone, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";

interface MobileDialerStatusProps {
  compact?: boolean;
}

export default function MobileDialerStatus({ compact = false }: MobileDialerStatusProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deviceName, setDeviceName] = useState<string | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        setIsLoading(true);
        const status = await apiClient.getMobileStatus();
        setIsConnected(status.isOnline || false);
        setDeviceName(status.device?.deviceName || null);
      } catch (error: any) {
        setIsConnected(false);
        setDeviceName(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div
        className={
          compact
            ? "flex items-center gap-1.5 h-9 px-2.5 rounded-md border border-gray-200 bg-gray-50"
            : "flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200"
        }
      >
        <Loader2 className={compact ? "h-3.5 w-3.5 text-gray-400 animate-spin" : "h-4 w-4 text-gray-400 animate-spin"} />
        <span className={compact ? "text-xs text-gray-600" : "text-sm text-gray-600"}>
          {compact ? "…" : "Checking dialer status..."}
        </span>
      </div>
    );
  }

  if (compact) {
    return (
      <div
        className={`flex items-center gap-1.5 h-9 px-2.5 rounded-md border transition-colors ${
          isConnected ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"
        }`}
        title={deviceName && isConnected ? `Mobile Dialer (${deviceName})` : "Mobile Dialer"}
      >
        <Smartphone className="h-3.5 w-3.5 shrink-0" />
        {isConnected ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
        <span className="text-xs font-medium whitespace-nowrap">
          {isConnected ? "Connected" : "Disconnected"}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
        isConnected ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"
      }`}
    >
      <Smartphone className="h-4 w-4" />
      {isConnected ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
      <span className="text-sm font-medium">
        Mobile Dialer {isConnected ? "Connected" : "Disconnected"}
      </span>
      {deviceName && isConnected && <span className="text-xs opacity-75">({deviceName})</span>}
    </div>
  );
}

