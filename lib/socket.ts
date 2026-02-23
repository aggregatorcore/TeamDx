import { io, Socket } from "socket.io-client";
import { tabStorage } from "./storage";

// Normalize API URL - same pattern as lib/api.ts
function normalizeApiUrl(url: string): string {
    if (!url) return "http://localhost:5000";

    // Fix space instead of colon (e.g., "http://localhost 5000" -> "http://localhost:5000")
    url = url.replace(/\s+(\d+)/, ":$1");

    // Ensure it starts with http:// or https://
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = `http://${url}`;
    }

    // Remove trailing slash
    url = url.replace(/\/+$/, "");

    return url;
}

const API_URL = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000");

export interface DxEvent {
    type: "heartbeat" | "system" | "task:dueSoon" | "task:overdue";
    timestamp: string;
    payload: {
        [key: string]: any;
    };
}

export interface AuditEvent {
    type: "audit:event:created";
    timestamp: string;
    data: {
        id: string;
        entityType: string;
        entityId: string;
        action: string;
        userId: string;
        oldValue: any;
        newValue: any;
        changes: Record<string, { old: any; new: any }> | null;
        description: string | null;
        metadata: Record<string, any> | null;
        createdAt: string;
        user: {
            id: string;
            firstName: string;
            lastName: string;
            employeeCode: string | null;
        } | null;
    };
}

export type ConnectionStatus = "connected" | "disconnected" | "connecting" | "error";

class SocketClient {
    private socket: Socket | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private isConnecting = false;

    /**
     * Connect to Socket.IO server with JWT token authentication
     * Token is passed via socket.auth.token (handshake.auth.token on backend)
     */
    connect(
        onConnect: () => void,
        onDisconnect: () => void,
        onError: (error: string) => void,
        onDxEvent: (event: DxEvent) => void,
        onAuditEvent?: (event: AuditEvent) => void,
        onCallIntentOpened?: (data: any) => void,
        onCallEnded?: (data: any) => void
    ): void {
        // Don't create multiple connections if already connected
        if (this.socket?.connected) {
            onConnect();
            return;
        }
        if (this.isConnecting) return;

        if (typeof window !== "undefined" && document.readyState !== "complete") {
            window.addEventListener("load", () => {
                // Small delay to ensure page is fully ready
                setTimeout(() => this.connect(onConnect, onDisconnect, onError, onDxEvent, onAuditEvent, onCallIntentOpened, onCallEnded), 500);
            });
            return;
        }

        // Get token from tabStorage
        const token = tabStorage.getItem("token");

        if (!token) {
            console.warn("[socket] No token found, cannot connect");
            onError("No authentication token found");
            return;
        }

        // Disconnect existing socket if any
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }

        this.isConnecting = true;

        // Create new socket connection with better error handling
        // Try polling first as it's more reliable, then upgrade to websocket
        try {
            this.socket = io(API_URL, {
                auth: {
                    token: token, // Pass token via handshake.auth.token
                },
                transports: ["polling", "websocket"], // Try polling first, then upgrade to websocket
                reconnection: true,
                reconnectionAttempts: this.maxReconnectAttempts,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                timeout: 20000, // 20 seconds timeout
                forceNew: false, // Reuse existing connection if available
                upgrade: true, // Allow upgrade from polling to websocket
            });
        } catch (error: any) {
            console.error("[socket] Failed to create socket connection:", error);
            this.isConnecting = false;
            onError(`Failed to create connection: ${error.message}`);
            return;
        }

        // Connection event handlers
        this.socket.on("connect", () => {
            this.reconnectAttempts = 0;
            this.isConnecting = false;
            onConnect();
        });
        
        this.socket.on("disconnect", () => {
            this.isConnecting = false;
            onDisconnect();
        });

        this.socket.on("connect_error", (error: any) => {
            console.error("[socket] Connection error:", error.message, error);
            this.isConnecting = false;

            // Check if it's an authentication error
            if (
                error.message?.includes("Authentication") ||
                error.message?.includes("Unauthorized") ||
                error.message?.includes("Invalid token") ||
                error.type === "UnauthorizedError"
            ) {
                console.warn("[socket] Authentication error, clearing token");
                // Clear token and notify caller to redirect
                tabStorage.removeItem("token");
                tabStorage.removeItem("user");
                onError("Authentication failed");
            } else {
                // Network or other error - log more details
                const errorDetails = {
                    message: error.message,
                    type: error.type,
                    description: error.description,
                    context: error.context,
                    transport: this.socket?.io?.engine?.transport?.name || "unknown"
                };
                console.warn("[socket] Connection error details:", errorDetails);
                
                // Network errors are common - don't treat as fatal
                // Socket.IO will automatically retry
                this.reconnectAttempts++;
                if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    console.error(`[socket] Connection failed after ${this.maxReconnectAttempts} attempts`);
                    onError(`Connection failed after ${this.maxReconnectAttempts} attempts. Please check if the server is running.`);
                }
            }
        });

        // Listen for dx:event
        this.socket.on("dx:event", (event: DxEvent) => onDxEvent(event));

        if (onAuditEvent) {
            this.socket.on("audit:event:created", (event: AuditEvent) => onAuditEvent(event));
        }
        if (onCallIntentOpened) {
            this.socket.on("call:intentOpened", (data: any) => onCallIntentOpened(data));
        }
        if (onCallEnded) {
            this.socket.on("call:ended", (data: any) => onCallEnded(data));
        }
    }

    /**
     * Get socket instance (for direct event listening if needed)
     */
    getSocket(): Socket | null {
        return this.socket;
    }

    /**
     * Disconnect from Socket.IO server
     */
    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnecting = false;
        }
    }

    /**
     * Get current connection status
     */
    getStatus(): ConnectionStatus {
        if (!this.socket) return "disconnected";
        if (this.socket.connected) return "connected";
        if (this.isConnecting) return "connecting";
        return "disconnected";
    }

    /**
     * Check if socket is connected
     */
    isConnected(): boolean {
        return this.socket?.connected || false;
    }
}

// Singleton instance
let socketClientInstance: SocketClient | null = null;

export function getSocketClient(): SocketClient {
    if (!socketClientInstance) {
        socketClientInstance = new SocketClient();
    }
    return socketClientInstance;
}

