"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import DesktopSidebar from "@/components/layout/DesktopSidebar";
import MobileNav from "@/components/layout/MobileNav";
import RightSidebar from "@/components/layout/RightSidebar";
import { RoleName } from "@/lib/types/roles";
import { tabStorage } from "@/lib/storage";
import { apiClient } from "@/lib/api";
import CheckInRequiredNotification from "@/components/CheckInRequiredNotification";
import CallbackNotification from "@/components/CallbackNotification";
import { getSocketClient } from "@/lib/socket";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [userRole, setUserRole] = useState<RoleName>("ADMIN");
  const [userName, setUserName] = useState("User");
  const [loading, setLoading] = useState(true);
  const [requiresCheckIn, setRequiresCheckIn] = useState(false);

  useEffect(() => {
    // Check if user is logged in (using tab-specific storage)
    const token = tabStorage.getItem("token");
    const userStr = tabStorage.getItem("user");

    if (!token || !userStr) {
      router.push("/login");
      return;
    }

    // First, use stored user data immediately (don't wait for API call)
    try {
      const user = JSON.parse(userStr);
      setUserRole(user.role.name as RoleName);
      setUserName(`${user.firstName} ${user.lastName}`);
      setLoading(false);
    } catch (parseError) {
      console.error("Error parsing user data:", parseError);
      router.push("/login");
      return;
    }

    // Then refresh user data from server in the background (optional, non-blocking)
    const refreshUserData = async () => {
      try {
        const response: any = await apiClient.getCurrentUser();
        if (response?.user) {
          tabStorage.setItem("user", JSON.stringify(response.user));
          setUserRole(response.user.role.name as RoleName);
          setUserName(`${response.user.firstName} ${response.user.lastName}`);
        }
      } catch (error: any) {
        // Silently fail - we're already using stored user data
        // Only log in development
        if (process.env.NODE_ENV === "development") {
          console.warn("Failed to refresh user data (using cached data):", error.message);
        }
      }
    };

    // Refresh in background (non-blocking)
    refreshUserData();

    // Check if check-in is required from login response
    const checkRequiresCheckIn = () => {
      // This would be set from login response, but we can also check attendance
      // For now, we'll listen to WebSocket events
    };
    checkRequiresCheckIn();
  }, [router]);

  // Listen for attendance WebSocket events
  useEffect(() => {
    if (loading) return;

    const socketClient = getSocketClient();
    const socket = socketClient.getSocket();

    if (socket) {
      const handleCheckedIn = (data: any) => {
        console.log("[DASHBOARD] Check-in confirmed:", data);
        setRequiresCheckIn(false);
      };

      const handleCheckInRequired = (data: any) => {
        console.log("[DASHBOARD] Check-in required notification:", data);
        // This is for receptionist - they receive notifications when staff needs check-in
      };

      socket.on("attendance:checked-in", handleCheckedIn);
      socket.on("attendance:checkin-required", handleCheckInRequired);

      return () => {
        socket.off("attendance:checked-in", handleCheckedIn);
        socket.off("attendance:checkin-required", handleCheckInRequired);
      };
    }
  }, [loading]);

  // Auto-start session on login
  useEffect(() => {
    if (loading) return;

    const startSession = async () => {
      try {
        await apiClient.startSession();
      } catch (error: any) {
        // Ignore errors if session already exists
        if (error.status !== 400 && !error.message?.includes("already active")) {
          console.error("Failed to start session:", error);
        }
      }
    };

    startSession();
  }, [loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 min-w-0">
      <CheckInRequiredNotification
        show={requiresCheckIn}
        onDismiss={() => setRequiresCheckIn(false)}
      />
      <CallbackNotification />
      {/* Desktop Sidebar */}
      <DesktopSidebar userRole={userRole} isOpen={sidebarOpen} />

      {/* Main Content Area */}
      <div className="md:ml-20 flex flex-col min-h-screen w-full min-w-0">
        {/* Header */}
        <Header
          userRole={userRole}
          userName={userName}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          rightSidebarOpen={rightSidebarOpen}
        />

        {/* Page Content - max width so layout doesn’t feel oversized on large screens */}
        <div className="flex-1 flex min-h-0 pb-20 md:pb-0">
          <main className="flex-1 min-w-0 flex flex-col min-h-0">
            <div className={`flex-1 min-w-0 overflow-y-auto custom-scrollbar ${!rightSidebarOpen ? "md:pr-20" : ""}`}>
              <div className="w-full max-w-7xl mx-auto">
                {children}
              </div>
            </div>
          </main>
          <RightSidebar
            isOpen={rightSidebarOpen}
            onToggle={() => setRightSidebarOpen((o) => !o)}
          />
        </div>

        {/* Mobile Navigation */}
        <MobileNav userRole={userRole} />
      </div>
    </div>
  );
}

