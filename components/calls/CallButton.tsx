"use client";

import { useState, useEffect, useRef } from "react";
import { Phone, PhoneOff, Loader2, AlertCircle } from "lucide-react";
import { apiClient } from "@/lib/api";

// Device type (without Firebase dependency)
interface Device {
  deviceId: string;
  userId: string;
  deviceName: string;
  phoneNumber: string;
  isOnline: boolean;
  lastSeen: Date;
  hasWebSocketConnection?: boolean;
}

interface CallButtonProps {
  phoneNumber: string;
  leadId?: string;
  className?: string;
  disabled?: boolean;
}

export default function CallButton({ 
  phoneNumber, 
  leadId, 
  className = "",
  disabled = false 
}: CallButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [deviceLoading, setDeviceLoading] = useState(true);
  const isCallingRef = useRef(false);

  useEffect(() => {
    // Check device status using REST API (more reliable)
    const checkDevice = async () => {
      setDeviceLoading(true);
      try {
        // Try REST API first (more reliable)
        const status = await apiClient.getMobileStatus();
        // Set device if it exists (even if offline) - we'll check isOnline when initiating call
        if (status.device) {
          setDevice({
            deviceId: status.device.deviceId,
            userId: status.device.userId || "",
            deviceName: status.device.deviceName || "Mobile Device",
            phoneNumber: status.device.phoneNumber || "",
            isOnline: status.isOnline,
            lastSeen: status.device.lastSeen ? new Date(status.device.lastSeen) : new Date(),
            hasWebSocketConnection: status.device.hasWebSocketConnection ?? false, // Include WebSocket status
          });
        } else {
          setDevice(null);
        }
      } catch (error) {
        console.error("Error checking device:", error);
        setDevice(null);
      } finally {
        setDeviceLoading(false);
      }
    };

    checkDevice();
    // Refresh device status every 5 seconds for better real-time updates
    const interval = setInterval(checkDevice, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCall = async () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b7b4817d-4cac-460e-aaaf-d3f3fe4028e9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CallButton.tsx:handleCall',message:'handleCall started',data:{phoneNumber:phoneNumber?.substring(0,10),disabled,loading,isCalling:isCallingRef.current,hasDevice:!!device,deviceIsOnline:device?.isOnline},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // Prevent duplicate calls using ref (more reliable than just state)
    if (!phoneNumber || disabled || loading || isCallingRef.current) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b7b4817d-4cac-460e-aaaf-d3f3fe4028e9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CallButton.tsx:handleCall',message:'handleCall early return',data:{phoneNumber:!!phoneNumber,disabled,loading,isCalling:isCallingRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      return;
    }

    isCallingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      // Validate phone number
      const cleanPhone = phoneNumber.replace(/[^0-9+]/g, "");
      if (!cleanPhone || cleanPhone.length < 10) {
        throw new Error("Invalid phone number");
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b7b4817d-4cac-460e-aaaf-d3f3fe4028e9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CallButton.tsx:handleCall',message:'Phone validated',data:{cleanPhone:cleanPhone.substring(0,10)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      // Check device status - refresh if needed
      let currentDevice = device;
      if (!currentDevice) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/b7b4817d-4cac-460e-aaaf-d3f3fe4028e9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CallButton.tsx:handleCall',message:'Device null, refreshing',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        // Try to refresh device status
        const status = await apiClient.getMobileStatus();
        if (status.device) {
          currentDevice = {
            deviceId: status.device.deviceId,
            userId: status.device.userId || "",
            deviceName: status.device.deviceName || "Mobile Device",
            phoneNumber: status.device.phoneNumber || "",
            isOnline: status.isOnline,
            lastSeen: status.device.lastSeen ? new Date(status.device.lastSeen) : new Date(),
            hasWebSocketConnection: status.device.hasWebSocketConnection ?? false, // Include WebSocket status
          };
          setDevice(currentDevice);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/b7b4817d-4cac-460e-aaaf-d3f3fe4028e9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CallButton.tsx:handleCall',message:'Device refreshed',data:{deviceId:currentDevice.deviceId,isOnline:currentDevice.isOnline},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
        } else {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/b7b4817d-4cac-460e-aaaf-d3f3fe4028e9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CallButton.tsx:handleCall',message:'No device found',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          throw new Error("No device bound. Please bind your Android device first.");
        }
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b7b4817d-4cac-460e-aaaf-d3f3fe4028e9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CallButton.tsx:handleCall',message:'Checking device online status',data:{deviceId:currentDevice.deviceId,isOnline:currentDevice.isOnline},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      if (!currentDevice.isOnline) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/b7b4817d-4cac-460e-aaaf-d3f3fe4028e9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CallButton.tsx:handleCall',message:'Device offline error',data:{deviceId:currentDevice.deviceId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        throw new Error("Device is offline. Please ensure your Android dialer app is running.");
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b7b4817d-4cac-460e-aaaf-d3f3fe4028e9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CallButton.tsx:handleCall',message:'Calling apiClient.initiateCall',data:{phoneNumber:cleanPhone.substring(0,10),hasLeadId:!!leadId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      // Initiate call via REST API (uses PostgreSQL database)
      await apiClient.initiateCall(cleanPhone, leadId);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b7b4817d-4cac-460e-aaaf-d3f3fe4028e9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CallButton.tsx:handleCall',message:'initiateCall completed',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      // Success - call request sent
      // The Android app will pick it up and dial automatically
    } catch (err: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b7b4817d-4cac-460e-aaaf-d3f3fe4028e9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CallButton.tsx:handleCall',message:'Call error caught',data:{error:err.message,errorType:err.constructor.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      console.error("Call error:", err);
      setError(err.message || "Failed to initiate call");
    } finally {
      setLoading(false);
      isCallingRef.current = false;
    }
  };

  // Robust enable logic: Only enable if device exists, is online, and has WebSocket connection
  const isDisabled = disabled || loading || deviceLoading || !device || !device.isOnline || !device.hasWebSocketConnection;

  // Debug: Log button state
  useEffect(() => {
    console.log('🔵 [CallButton] Button state:', {
      disabled,
      loading,
      deviceLoading,
      hasDevice: !!device,
      deviceIsOnline: device?.isOnline,
      hasWebSocketConnection: device?.hasWebSocketConnection,
      isDisabled,
      phoneNumber: phoneNumber?.substring(0, 10),
    });
  }, [disabled, loading, deviceLoading, device, isDisabled, phoneNumber]);

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          console.log('🔵 [CallButton] Button clicked!', { isDisabled, hasDevice: !!device, deviceIsOnline: device?.isOnline });
          if (!isDisabled) {
            handleCall();
          } else {
            console.log('🔵 [CallButton] Button is disabled, not calling handleCall');
          }
        }}
        disabled={isDisabled}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
          ${isDisabled
            ? "bg-gray-400 text-white cursor-not-allowed"
            : "bg-green-600 text-white hover:bg-green-700 active:bg-green-800"
          }
          ${className}
        `}
        title={
          !device
            ? "No device bound. Please bind your Android device first."
            : !device.isOnline
            ? "Device is offline. Please ensure your Android dialer app is running and connected."
            : !device.hasWebSocketConnection
            ? "WebSocket connection lost. Please restart the mobile app."
            : `Call ${phoneNumber}`
        }
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Calling...</span>
          </>
        ) : !device || !device.isOnline ? (
          <>
            <PhoneOff className="h-4 w-4" />
            <span>Call</span>
          </>
        ) : (
          <>
            <Phone className="h-4 w-4" />
            <span>Call</span>
          </>
        )}
      </button>

      {error && (
        <div className="absolute top-full left-0 mt-2 p-2 bg-red-50 border border-red-200 rounded-lg shadow-lg z-50 min-w-[200px]">
          <div className="flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {device && !device.isOnline && (
        <div className="absolute top-full left-0 mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg shadow-lg z-50 min-w-[200px]">
          <div className="flex items-center gap-2 text-yellow-700 text-sm">
            <AlertCircle className="h-4 w-4" />
            <span>Device offline</span>
          </div>
        </div>
      )}
    </div>
  );
}


