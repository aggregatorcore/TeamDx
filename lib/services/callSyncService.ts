import { io, Socket } from "socket.io-client";
import { tabStorage } from "@/lib/storage";

class CallSyncService {
  private socket: Socket | null = null;
  private userId: string | null = null;

  connect(userId: string, token: string) {
    this.userId = userId;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    
    this.socket = io(wsUrl, {
      auth: { token },
      transports: ["websocket"],
    });

    this.socket.on("connect", () => {});

    this.socket.on("call:status", (data: any) => {
      window.dispatchEvent(new CustomEvent("call:status", { detail: data }));
    });

    this.socket.on("call:initiate", (data: any) => {
      window.dispatchEvent(new CustomEvent("call:initiate", { detail: data }));
    });

    this.socket.on("mobile:online", (data: { userId: string; isOnline: boolean }) => {
      window.dispatchEvent(new CustomEvent("mobile:status", { detail: data }));
    });

    this.socket.on("disconnect", () => {});

    this.socket.on("connect_error", (error) => {
      console.error("WebSocket connection error:", error);
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    this.userId = null;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  emit(event: string, data: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }
}

export const callSyncService = new CallSyncService();

