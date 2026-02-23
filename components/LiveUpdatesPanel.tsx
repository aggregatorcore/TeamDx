"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Wifi, WifiOff, Activity, Clock, X } from "lucide-react";
import { getSocketClient, DxEvent, AuditEvent, ConnectionStatus } from "@/lib/socket";

interface EventItem {
  id: string;
  receivedAt: string;
  type: string;
  timestamp?: string;
  payload?: { [key: string]: any };
  data?: AuditEvent["data"];
}

const MAX_EVENTS = 20;

export default function LiveUpdatesPanel() {
  const router = useRouter();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [lastReceived, setLastReceived] = useState<string | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const socketClientRef = useRef<ReturnType<typeof getSocketClient> | null>(null);
  const eventIdCounter = useRef(0);

  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let connectionCheckInterval: NodeJS.Timeout | null = null;

    // Wait for page to be fully loaded before connecting
    const connectSocket = () => {
      // Get socket client instance
      const socketClient = getSocketClient();
      socketClientRef.current = socketClient;

      // Connection handlers
      const handleConnect = () => {
        console.log("[LiveUpdates] Connected");
        setConnectionStatus("connected");
        // Clear any pending reconnect attempts
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
          reconnectTimeout = null;
        }
      };

      const handleDisconnect = () => {
        console.log("[LiveUpdates] Disconnected");
        setConnectionStatus("disconnected");
        
        // Try to reconnect after 3 seconds
        if (!reconnectTimeout) {
          reconnectTimeout = setTimeout(() => {
            console.log("[LiveUpdates] Attempting to reconnect...");
            setConnectionStatus("connecting");
            reconnectTimeout = null;
            // Reconnect
            if (socketClientRef.current) {
              socketClientRef.current.disconnect();
            }
            setTimeout(connectSocket, 1000);
          }, 3000);
        }
      };

      const handleError = (error: string) => {
        console.error("[LiveUpdates] Socket error:", error);
        
        // If authentication error, redirect to login
        if (error === "Authentication failed" || error.includes("No authentication token")) {
          router.push("/login");
          return;
        }
        
        setConnectionStatus("error");
        
        // Try to reconnect after 5 seconds on error
        if (!reconnectTimeout) {
          reconnectTimeout = setTimeout(() => {
            console.log("[LiveUpdates] Attempting to reconnect after error...");
            setConnectionStatus("connecting");
            reconnectTimeout = null;
            // Reconnect
            if (socketClientRef.current) {
              socketClientRef.current.disconnect();
            }
            setTimeout(connectSocket, 2000);
          }, 5000);
        }
      };

      const handleDxEvent = (event: DxEvent) => {
        const now = new Date().toISOString();
        setLastReceived(now);

        // Add event to list (max 20)
        setEvents((prev) => {
          const newEvent: EventItem = {
            type: event.type,
            timestamp: event.timestamp,
            payload: event.payload,
            id: `event-${eventIdCounter.current++}`,
            receivedAt: now,
          };
          
          // Keep only last MAX_EVENTS events
          const updated = [newEvent, ...prev].slice(0, MAX_EVENTS);
          return updated;
        });
      };

      const handleAuditEvent = (event: AuditEvent) => {
        const now = new Date().toISOString();
        setLastReceived(now);

        // Add audit event to list (max 20)
        setEvents((prev) => {
          const newEvent: EventItem = {
            type: event.type,
            timestamp: event.timestamp,
            data: event.data,
            id: `audit-${eventIdCounter.current++}`,
            receivedAt: now,
          };
          
          // Keep only last MAX_EVENTS events
          const updated = [newEvent, ...prev].slice(0, MAX_EVENTS);
          return updated;
        });
      };

      // Connect to socket
      socketClient.connect(handleConnect, handleDisconnect, handleError, handleDxEvent, handleAuditEvent);
    };

    // Monitor connection status periodically
    const checkConnection = () => {
      if (socketClientRef.current) {
        const isConnected = socketClientRef.current.isConnected();
        const status = socketClientRef.current.getStatus();
        
        // If not connected and not already connecting, try to reconnect
        if (!isConnected && status !== "connecting") {
          console.log("[LiveUpdates] Connection lost, attempting reconnect...");
          setConnectionStatus("connecting");
          // Disconnect existing socket if any
          if (socketClientRef.current) {
            socketClientRef.current.disconnect();
          }
          // Reconnect after a short delay
          setTimeout(connectSocket, 1000);
        }
      } else {
        // No socket client instance, create one and connect
        console.log("[LiveUpdates] No socket client, creating new connection...");
        setConnectionStatus("connecting");
        setTimeout(connectSocket, 500);
      }
    };

    // Check if page is already loaded
    if (typeof window !== "undefined") {
      const initConnection = () => {
        // Always try to connect on mount/refresh
        setConnectionStatus("connecting");
        connectSocket();
      };

      if (document.readyState === "complete") {
        // Page already loaded, connect immediately with small delay
        setTimeout(initConnection, 100);
      } else {
        // Wait for page to load
        const handleLoad = () => {
          setTimeout(initConnection, 500);
          window.removeEventListener("load", handleLoad);
        };
        window.addEventListener("load", handleLoad);
      }

      // Start connection monitoring immediately (check every 5 seconds)
      // First check after 2 seconds to catch any missed connections
      setTimeout(() => {
        checkConnection();
      }, 2000);
      
      connectionCheckInterval = setInterval(checkConnection, 5000);
    }

    // Cleanup on unmount
    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (connectionCheckInterval) {
        clearInterval(connectionCheckInterval);
      }
      if (socketClientRef.current) {
        socketClientRef.current.disconnect();
      }
    };
  }, [router]);

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return "Invalid time";
    }
  };

  const formatRelativeTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffInSeconds < 60) return "Just now";
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
      return `${Math.floor(diffInSeconds / 86400)}d ago`;
    } catch {
      return "Unknown";
    }
  };

  const getStatusColor = (status: ConnectionStatus) => {
    switch (status) {
      case "connected":
        return "text-green-600";
      case "connecting":
        return "text-yellow-600";
      case "error":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusIcon = (status: ConnectionStatus) => {
    switch (status) {
      case "connected":
        return <Wifi className="h-4 w-4 text-green-600" />;
      case "connecting":
        return <Activity className="h-4 w-4 text-yellow-600 animate-pulse" />;
      default:
        return <WifiOff className="h-4 w-4 text-gray-600" />;
    }
  };

  const handleManualReconnect = () => {
    if (socketClientRef.current) {
      console.log("[LiveUpdates] Manual reconnect requested");
      setConnectionStatus("connecting");
      socketClientRef.current.disconnect();
      setTimeout(() => {
        const socketClient = getSocketClient();
        socketClientRef.current = socketClient;
        
        const handleConnect = () => setConnectionStatus("connected");
        const handleDisconnect = () => setConnectionStatus("disconnected");
        const handleError = (error: string) => {
          console.error("[LiveUpdates] Reconnect error:", error);
          setConnectionStatus("error");
        };
        const handleDxEvent = (event: DxEvent) => {
          const now = new Date().toISOString();
          setLastReceived(now);
          setEvents((prev) => {
            const newEvent: EventItem = {
              type: event.type,
              timestamp: event.timestamp,
              payload: event.payload,
              id: `event-${eventIdCounter.current++}`,
              receivedAt: now,
            };
            return [newEvent, ...prev].slice(0, MAX_EVENTS);
          });
        };
        const handleAuditEvent = (event: AuditEvent) => {
          const now = new Date().toISOString();
          setLastReceived(now);
          setEvents((prev) => {
            const newEvent: EventItem = {
              type: event.type,
              timestamp: event.timestamp,
              data: event.data,
              id: `audit-${eventIdCounter.current++}`,
              receivedAt: now,
            };
            return [newEvent, ...prev].slice(0, MAX_EVENTS);
          });
        };
        
        socketClient.connect(handleConnect, handleDisconnect, handleError, handleDxEvent, handleAuditEvent);
      }, 500);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-white rounded-lg shadow-lg border border-gray-200">
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 border-b border-gray-200 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {getStatusIcon(connectionStatus)}
          <span className="text-sm font-semibold text-gray-900">Live Updates</span>
          <span className={`text-xs ${getStatusColor(connectionStatus)}`}>
            {connectionStatus === "connected" ? "Connected" : 
             connectionStatus === "connecting" ? "Connecting..." :
             connectionStatus === "error" ? "Error" : "Disconnected"}
          </span>
          {(connectionStatus === "disconnected" || connectionStatus === "error") && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleManualReconnect();
              }}
              className="ml-2 px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
              title="Reconnect"
            >
              Reconnect
            </button>
          )}
        </div>
        {isExpanded && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(false);
            }}
            className="p-1 hover:bg-gray-200 rounded"
          >
            <X className="h-4 w-4 text-gray-600" />
          </button>
        )}
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="max-h-96 overflow-y-auto">
          {/* Last received timestamp */}
          {lastReceived && (
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Clock className="h-3 w-3" />
                <span>Last received: {formatRelativeTime(lastReceived)}</span>
              </div>
            </div>
          )}

          {/* Events list */}
          <div className="p-2">
            {events.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-500">
                <Activity className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p>No events received yet</p>
                <p className="text-xs mt-1">Waiting for real-time events...</p>
              </div>
            ) : (
              <div className="space-y-2">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="p-2 rounded border border-gray-200 hover:bg-gray-50 text-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-gray-900 capitalize">
                        {event.type}
                      </span>
                      <span className="text-gray-500">{formatTime(event.receivedAt)}</span>
                    </div>
                    <div className="text-gray-600 mt-1">
                      {event.type === "heartbeat" && (
                        <span>Status: {event.payload?.status || "ok"}</span>
                      )}
                      {event.type === "system" && (
                        <span>System event</span>
                      )}
                      {event.type === "audit:event:created" && event.data && (
                        <div>
                          <span className="font-medium">{event.data.entityType}</span>{" "}
                          <span className="text-gray-500">{event.data.action}</span>
                          {event.data.user && (
                            <div className="text-gray-500 text-xs mt-1">
                              by {event.data.user.firstName} {event.data.user.lastName}
                              {event.data.user.employeeCode && ` (${event.data.user.employeeCode})`}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {event.timestamp && (
                      <div className="text-gray-400 mt-1 text-xs">
                        {formatTime(event.timestamp)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


