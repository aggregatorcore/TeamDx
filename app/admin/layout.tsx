"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import DesktopSidebar from "@/components/layout/DesktopSidebar";
import MobileNav from "@/components/layout/MobileNav";
import { RoleName } from "@/lib/types/roles";
import { tabStorage } from "@/lib/storage";
import { apiClient } from "@/lib/api";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userRole, setUserRole] = useState<RoleName>("ADMIN");
  const [userName, setUserName] = useState("User");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in (using tab-specific storage)
    const token = tabStorage.getItem("token");
    const userStr = tabStorage.getItem("user");

    if (!token || !userStr) {
      router.push("/login");
      return;
    }

    // Refresh user data from server to verify permissions
    const refreshUserData = async () => {
      try {
        const response: any = await apiClient.getCurrentUser();
        if (response?.user) {
          tabStorage.setItem("user", JSON.stringify(response.user));
          setUserRole(response.user.role.name as RoleName);
          setUserName(`${response.user.firstName} ${response.user.lastName}`);
        } else {
          // Fallback to stored user data
          const user = JSON.parse(userStr);
          setUserRole(user.role.name as RoleName);
          setUserName(`${user.firstName} ${user.lastName}`);
        }
      } catch (error: any) {
        console.error("Error refreshing user data:", error);

        // Handle 403 Forbidden - redirect to Not Authorized page
        if (error.status === 403 || error.isForbidden) {
          router.push("/not-authorized");
          return;
        }

        // Handle 401 Unauthorized - redirect to login
        if (error.status === 401) {
          router.push("/login");
          return;
        }

        // Fallback to stored user data for other errors
        try {
          const user = JSON.parse(userStr);
          setUserRole(user.role.name as RoleName);
          setUserName(`${user.firstName} ${user.lastName}`);
        } catch (parseError) {
          console.error("Error parsing user data:", parseError);
          router.push("/login");
        }
      } finally {
        setLoading(false);
      }
    };

    refreshUserData();
  }, [router]);

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
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <DesktopSidebar userRole={userRole} isOpen={sidebarOpen} />

      {/* Main Content Area */}
      <div className="md:ml-20 flex flex-col min-h-screen w-full min-w-0">
        {/* Header */}
        <Header
          userRole={userRole}
          userName={userName}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />

        {/* Page Content - max width so layout doesn’t feel oversized on large screens */}
        <main className="flex-1 pb-20 md:pb-0 overflow-x-hidden w-full">
          <div className="w-full max-w-7xl mx-auto">
            {children}
          </div>
        </main>

        {/* Mobile Navigation */}
        <MobileNav userRole={userRole} />
      </div>
    </div>
  );
}

