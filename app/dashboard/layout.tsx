"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/layout/Header";
import DesktopSidebar from "@/components/layout/DesktopSidebar";
import MobileNav from "@/components/layout/MobileNav";
import RightSidebar from "@/components/layout/RightSidebar";
import { RoleName } from "@/lib/types/roles";
import { tabStorage } from "@/lib/storage";
import { apiClient } from "@/lib/api";
import { initStorageCleanup } from "@/lib/storage-safe";
import CallbackNotification from "@/components/CallbackNotification";

function DashboardLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isModalView = searchParams?.get('modal') === 'true';
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [userRole, setUserRole] = useState<RoleName>("ADMIN");
  const [userName, setUserName] = useState("User");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize storage cleanup on app load
    initStorageCleanup();
    
    // Check if user is logged in (using tab-specific storage)
    const token = tabStorage.getItem("token");
    const userStr = tabStorage.getItem("user");

    if (!token || !userStr) {
      router.push("/login");
      return;
    }

    try {
      const user = JSON.parse(userStr);
      setUserRole(user.role.name as RoleName);
      setUserName(`${user.firstName} ${user.lastName}`);
    } catch (error) {
      console.error("Error parsing user data:", error);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

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

  // If modal view, render without sidebar and header
  if (isModalView) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="w-full overflow-x-hidden max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 min-w-0">
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </Suspense>
  );
}
