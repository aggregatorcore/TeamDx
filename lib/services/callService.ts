// Call Service for Firebase Integration
// NOTE: Firebase is currently NOT USED in the project
// This service is kept for future reference but Firebase imports are disabled

// Firebase imports commented out - not in use
/*
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  query, 
  where, 
  onSnapshot, 
  getDocs,
  Timestamp,
  serverTimestamp,
  orderBy,
  limit
} from "firebase/firestore";
*/
import { db } from "@/lib/firebase/config";
import { tabStorage } from "@/lib/storage";

// Helper to check if Firebase is available (client-side only)
const getDb = () => {
  if (typeof window === "undefined" || !db) {
    throw new Error("Firebase is not initialized. This function can only be called on the client side.");
  }
  return db;
};

// Stub implementations for Firebase functions (Firebase not in use)
// These prevent runtime errors when Firebase functions are called
const collection = () => {
  throw new Error("Firebase is not available. This feature requires Firebase to be configured.");
};

const query = () => {
  throw new Error("Firebase is not available. This feature requires Firebase to be configured.");
};

const where = () => {
  throw new Error("Firebase is not available. This feature requires Firebase to be configured.");
};

const orderBy = () => {
  throw new Error("Firebase is not available. This feature requires Firebase to be configured.");
};

const limit = () => {
  throw new Error("Firebase is not available. This feature requires Firebase to be configured.");
};

const addDoc = async () => {
  throw new Error("Firebase is not available. This feature requires Firebase to be configured.");
};

const getDocs = async () => {
  return { empty: true, docs: [] };
};

const onSnapshot = () => {
  // Return a no-op unsubscribe function
  return () => {};
};

const serverTimestamp = () => {
  return new Date();
};

// Types
export interface CallSignal {
  signalId: string;
  userId: string;
  deviceId: string;
  phoneNumber: string;
  leadId?: string;
  status: "pending" | "initiated" | "completed" | "failed";
  createdAt: Date;
  initiatedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface Call {
  callId: string;
  userId: string;
  deviceId: string;
  phoneNumber: string;
  leadId?: string;
  type: "incoming" | "outgoing";
  status: "ringing" | "connected" | "ended" | "missed";
  startTime: Date;
  endTime?: Date;
  durationSeconds?: number;
}

export interface Device {
  deviceId: string;
  userId: string;
  deviceName: string;
  phoneNumber: string;
  isOnline: boolean;
  lastSeen: Date;
}

class CallService {
  /**
   * Get current user ID from storage
   */
  private getUserId(): string | null {
    if (typeof window === "undefined") return null;
    const userStr = tabStorage.getItem("user");
    if (!userStr) return null;
    try {
      const user = JSON.parse(userStr);
      return user.id || null;
    } catch {
      return null;
    }
  }

  /**
   * Get user's bound device
   */
  async getUserDevice(): Promise<Device | null> {
    const userId = this.getUserId();
    if (!userId) return null;

    // Firebase is not available - return null
    if (!db) {
      console.warn("Firebase is not configured. getUserDevice() requires Firebase.");
      return null;
    }

    try {
      const devicesRef = collection(getDb(), "devices");
      const q = query(devicesRef, where("userId", "==", userId), limit(1));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return null;

      const deviceDoc = snapshot.docs[0];
      const data = deviceDoc.data();
      
      return {
        deviceId: deviceDoc.id,
        userId: data.userId,
        deviceName: data.deviceName || "Unknown Device",
        phoneNumber: data.phoneNumber || "",
        isOnline: data.isOnline || false,
        lastSeen: data.lastSeen?.toDate() || new Date(),
      };
    } catch (error) {
      console.error("Error fetching user device:", error);
      return null;
    }
  }

  /**
   * Create a call signal to trigger Android dialer
   */
  async initiateCall(phoneNumber: string, leadId?: string): Promise<string | null> {
    const userId = this.getUserId();
    if (!userId) {
      throw new Error("User not authenticated");
    }

    // Firebase is not available
    if (!db) {
      throw new Error("Firebase is not configured. Call initiation requires Firebase.");
    }

    // Get user's device
    const device = await this.getUserDevice();
    if (!device) {
      throw new Error("No device bound. Please bind your Android device first.");
    }

    if (!device.isOnline) {
      throw new Error("Device is offline. Please ensure your Android dialer app is running.");
    }

    try {
      // Create call signal in Firestore
      const signalsRef = collection(getDb(), "callSignals");
      const signalDoc = await addDoc(signalsRef, {
        userId,
        deviceId: device.deviceId,
        phoneNumber,
        leadId: leadId || null,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      return signalDoc.id;
    } catch (error) {
      console.error("Error creating call signal:", error);
      throw new Error("Failed to initiate call");
    }
  }

  /**
   * Listen to call signals for this user
   */
  subscribeToCallSignals(
    callback: (signals: CallSignal[]) => void
  ): () => void {
    const userId = this.getUserId();
    if (!userId) {
      callback([]);
      return () => {};
    }

    // Firebase is not available - return empty and no-op unsubscribe
    if (!db) {
      console.warn("Firebase is not configured. subscribeToCallSignals() requires Firebase.");
      callback([]);
      return () => {};
    }

    const signalsRef = collection(getDb(), "callSignals");
    const q = query(
      signalsRef,
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const signals: CallSignal[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          signalId: doc.id,
          userId: data.userId,
          deviceId: data.deviceId,
          phoneNumber: data.phoneNumber,
          leadId: data.leadId,
          status: data.status || "pending",
          createdAt: data.createdAt?.toDate() || new Date(),
          initiatedAt: data.initiatedAt?.toDate(),
          completedAt: data.completedAt?.toDate(),
          error: data.error,
        };
      });
      callback(signals);
    }, (error) => {
      console.error("Error listening to call signals:", error);
      callback([]);
    });

    return unsubscribe;
  }

  /**
   * Listen to active calls for this user
   */
  subscribeToActiveCalls(
    callback: (calls: Call[]) => void
  ): () => void {
    const userId = this.getUserId();
    if (!userId) {
      callback([]);
      return () => {};
    }

    // Firebase is not available - return empty and no-op unsubscribe
    if (!db) {
      console.warn("Firebase is not configured. subscribeToActiveCalls() requires Firebase.");
      callback([]);
      return () => {};
    }

    const callsRef = collection(getDb(), "calls");
    const q = query(
      callsRef,
      where("userId", "==", userId),
      where("status", "in", ["ringing", "connected"]),
      orderBy("startTime", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const calls: Call[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          callId: doc.id,
          userId: data.userId,
          deviceId: data.deviceId,
          phoneNumber: data.phoneNumber,
          leadId: data.leadId,
          type: data.type || "outgoing",
          status: data.status || "ringing",
          startTime: data.startTime?.toDate() || new Date(),
          endTime: data.endTime?.toDate(),
          durationSeconds: data.durationSeconds,
        };
      });
      callback(calls);
    }, (error) => {
      console.error("Error listening to active calls:", error);
      callback([]);
    });

    return unsubscribe;
  }

  /**
   * Listen to incoming calls for this user
   */
  subscribeToIncomingCalls(
    callback: (call: Call | null) => void
  ): () => void {
    const userId = this.getUserId();
    if (!userId) {
      callback(null);
      return () => {};
    }

    // Firebase is not available - return null and no-op unsubscribe
    if (!db) {
      console.warn("Firebase is not configured. subscribeToIncomingCalls() requires Firebase.");
      callback(null);
      return () => {};
    }

    const callsRef = collection(getDb(), "calls");
    const q = query(
      callsRef,
      where("userId", "==", userId),
      where("type", "==", "incoming"),
      where("status", "==", "ringing"),
      orderBy("startTime", "desc"),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        callback(null);
        return;
      }

      const callDoc = snapshot.docs[0];
      const data = callDoc.data();
      const call: Call = {
        callId: callDoc.id,
        userId: data.userId,
        deviceId: data.deviceId,
        phoneNumber: data.phoneNumber,
        leadId: data.leadId,
        type: "incoming",
        status: "ringing",
        startTime: data.startTime?.toDate() || new Date(),
      };
      callback(call);
    }, (error) => {
      console.error("Error listening to incoming calls:", error);
      callback(null);
    });

    return unsubscribe;
  }

  /**
   * Get call history for a lead
   */
  async getCallHistory(leadId: string): Promise<Call[]> {
    const userId = this.getUserId();
    if (!userId) return [];

    // Firebase is not available - return empty array
    if (!db) {
      console.warn("Firebase is not configured. getCallHistory() requires Firebase.");
      return [];
    }

    try {
      const callsRef = collection(getDb(), "calls");
      const q = query(
        callsRef,
        where("userId", "==", userId),
        where("leadId", "==", leadId),
        orderBy("startTime", "desc"),
        limit(50)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          callId: doc.id,
          userId: data.userId,
          deviceId: data.deviceId,
          phoneNumber: data.phoneNumber,
          leadId: data.leadId,
          type: data.type || "outgoing",
          status: data.status || "ended",
          startTime: data.startTime?.toDate() || new Date(),
          endTime: data.endTime?.toDate(),
          durationSeconds: data.durationSeconds,
        };
      });
    } catch (error) {
      console.error("Error fetching call history:", error);
      return [];
    }
  }
}

export const callService = new CallService();

