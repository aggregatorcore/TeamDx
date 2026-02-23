"use client";

import { useState, useEffect } from "react";
import { Clock, CheckCircle2, XCircle, Coffee, UtensilsCrossed, Users, Wifi } from "lucide-react";
import { apiClient } from "@/lib/api";

interface Session {
  id: string;
  loginTime: string;
  status: "available" | "unavailable" | "on_break";
  totalWorkTime: number;
  totalBreakTime: number;
  currentBreak: {
    id: string;
    breakType: string;
    startTime: string;
  } | null;
  user: {
    firstName: string;
    lastName: string;
  };
}

interface StatusIndicatorProps {
  onStatusChange?: (status: string) => void;
}

export default function StatusIndicator({ onStatusChange }: StatusIndicatorProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [workTime, setWorkTime] = useState(0);
  const [breakTime, setBreakTime] = useState(0);
  const [loginTimeRef, setLoginTimeRef] = useState<number | null>(null);
  const [baseBreakTimeRef, setBaseBreakTimeRef] = useState(0);

  useEffect(() => {
    // Fetch immediately
    fetchSession();
    // Then refresh every 10 seconds for real-time updates (reduced frequency to prevent blinking)
    const interval = setInterval(fetchSession, 10000);
    return () => clearInterval(interval);
  }, []);

  // Also fetch when component becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchSession();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Listen for custom events to update immediately
  useEffect(() => {
    const handleSessionUpdate = () => {
      fetchSession();
    };
    window.addEventListener("sessionUpdated", handleSessionUpdate);
    return () => window.removeEventListener("sessionUpdated", handleSessionUpdate);
  }, []);

  // Store login time and base values when session changes
  useEffect(() => {
    if (session) {
      const loginTime = new Date(session.loginTime).getTime();
      setLoginTimeRef(loginTime);
      setBaseBreakTimeRef(session.totalBreakTime || 0);
    } else {
      setLoginTimeRef(null);
      setBaseBreakTimeRef(0);
    }
  }, [session?.id, session?.loginTime]);

  // Smooth time counter updates - independent of session refetches
  useEffect(() => {
    if (!loginTimeRef) {
      setWorkTime(0);
      setBreakTime(0);
      return;
    }

    // Update counters every second - smooth continuous update
    const interval = setInterval(() => {
      const now = new Date().getTime();
      
      // Update work time if available and not on break
      if (session?.status === "available" && !session?.currentBreak) {
        const totalElapsed = Math.floor((now - loginTimeRef) / 1000);
        const currentWorkTime = totalElapsed - baseBreakTimeRef;
        setWorkTime(Math.max(0, currentWorkTime));
      } else if (session) {
        // Keep the stored work time if on break
        setWorkTime(session.totalWorkTime || 0);
      }
      
      // Update break time if on break
      if (session?.currentBreak) {
        const breakStart = new Date(session.currentBreak.startTime).getTime();
        const elapsed = Math.floor((now - breakStart) / 1000);
        setBreakTime(Math.max(0, elapsed));
      } else {
        setBreakTime(0);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [loginTimeRef, baseBreakTimeRef, session?.status, session?.currentBreak?.id, session?.totalWorkTime]);

  const fetchSession = async () => {
    try {
      // Don't show loading spinner on auto-refresh, only on initial load
      if (!session) {
        setLoading(true);
      }
      const response = await apiClient.getCurrentSession();
      if (response.session) {
        const newSession = response.session;
        
        // Only update session if it's actually different (to prevent unnecessary re-renders)
        const sessionChanged = 
          !session || 
          session.id !== newSession.id ||
          session.status !== newSession.status ||
          (session.currentBreak?.id !== newSession.currentBreak?.id) ||
          (session.totalWorkTime !== newSession.totalWorkTime) ||
          (session.totalBreakTime !== newSession.totalBreakTime);
        
        if (sessionChanged) {
          setSession(newSession);
          
          // Update status callback only if status actually changed
          if (!session || session.status !== newSession.status || 
              (session.currentBreak?.id !== newSession.currentBreak?.id)) {
            if (newSession.currentBreak) {
              onStatusChange?.(`${newSession.status}_break`);
            } else {
              onStatusChange?.(newSession.status);
            }
          }
        }
        
        // Don't reset time counters here - let the interval handle it smoothly
        // This prevents the blinking/reset issue
      } else {
        if (session) {
          setSession(null);
          onStatusChange?.("");
        }
      }
    } catch (error: any) {
      // If 404, try to start a new session
      if (error.status === 404) {
        try {
          await apiClient.startSession();
          // Retry fetching after starting
          setTimeout(() => fetchSession(), 500);
        } catch (startError) {
          console.error("Failed to start session:", startError);
          if (session) {
            setSession(null);
            onStatusChange?.("");
          }
        }
      } else {
        // Only log errors that aren't 404
        if (error.status !== 404) {
          console.error("Failed to fetch session:", error);
        }
        // Don't clear session on network errors, keep showing last known state
        if (error.status === 404 && session) {
          setSession(null);
          onStatusChange?.("");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const getBreakIcon = (breakType: string) => {
    switch (breakType) {
      case "lunch":
        return <UtensilsCrossed className="h-4 w-4" />;
      case "tea_break":
        return <Coffee className="h-4 w-4" />;
      case "meeting":
        return <Users className="h-4 w-4" />;
      case "bio_break":
        return <Wifi className="h-4 w-4" />;
      default:
        return <Coffee className="h-4 w-4" />;
    }
  };

  const getBreakLabel = (breakType: string) => {
    switch (breakType) {
      case "lunch":
        return "Lunch";
      case "tea_break":
        return "Tea Break";
      case "meeting":
        return "Meeting";
      case "bio_break":
        return "Bio Break";
      default:
        return "Break";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg">
        <div className="h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-sm text-gray-600">Loading...</span>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg">
        <span className="text-sm text-gray-600">No active session</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {/* Status Badge */}
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
          session.status === "available"
            ? "bg-green-100 text-green-700"
            : session.currentBreak
            ? "bg-yellow-100 text-yellow-700"
            : "bg-red-100 text-red-700"
        }`}
      >
        {session.status === "available" ? (
          <>
            <CheckCircle2 className="h-4 w-4" />
            <span>Available</span>
          </>
        ) : session.currentBreak ? (
          <>
            {getBreakIcon(session.currentBreak.breakType)}
            <span>{getBreakLabel(session.currentBreak.breakType)}</span>
          </>
        ) : (
          <>
            <XCircle className="h-4 w-4" />
            <span>Unavailable</span>
          </>
        )}
      </div>

      {/* Break Time */}
      {session.currentBreak && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 rounded-lg">
          <Clock className="h-4 w-4 text-yellow-600" />
          <span className="text-sm font-medium text-yellow-700">{formatTime(breakTime)}</span>
        </div>
      )}
    </div>
  );
}

