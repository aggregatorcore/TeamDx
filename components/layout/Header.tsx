"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, Search, Menu, User, LogOut, Clock, ChevronDown, Coffee } from "lucide-react";
import { apiClient } from "@/lib/api";
import { tabStorage } from "@/lib/storage";
import LogoutBlockedNotification from "@/components/LogoutBlockedNotification";
import MobileDialerStatus from "@/components/calls/MobileDialerStatus";

interface HeaderProps {
  userRole?: string;
  userName?: string;
  onMenuClick?: () => void;
  /** When true, render only inner content for use inside merged top bar (logo + header) */
  mergeWithLogo?: boolean;
  /** When false/undefined, add right padding to align with main content (gap before right sidebar toggle) */
  rightSidebarOpen?: boolean;
}

export default function Header({ userRole, userName, onMenuClick, mergeWithLogo, rightSidebarOpen }: HeaderProps) {
  const router = useRouter();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [logoutBlocked, setLogoutBlocked] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<{
    loginTime: string;
    breakCount: number;
    totalWorkTimeSeconds: number;
    onBreak: boolean;
  } | null>(null);
  const [showBreakDropdown, setShowBreakDropdown] = useState(false);
  const [breakActionLoading, setBreakActionLoading] = useState(false);

  const fetchSession = async () => {
    try {
      const response = await apiClient.getCurrentSession();
      if (response === null) {
        setSessionInfo(null);
        return;
      }
      const session = response?.session;
      if (!session) {
        setSessionInfo(null);
        return;
      }
      const loginTime = session.sessionStartTime || session.loginTime;
      const loginTimeStr =
        typeof loginTime === "string" ? loginTime : (loginTime as Date)?.toISOString?.() ?? "";
      const breakCount = session.breaks?.length ?? 0;
      const totalWorkTimeSeconds = session.totalWorkTime ?? 0;
      const onBreak = !!(session.currentBreak != null);
      setSessionInfo({
        loginTime: loginTimeStr,
        breakCount,
        totalWorkTimeSeconds,
        onBreak,
      });
    } catch {
      setSessionInfo(null);
    }
  };

  useEffect(() => {
    fetchSession();
    const interval = setInterval(fetchSession, 60000);
    return () => clearInterval(interval);
  }, []);

  const breakTypes: { value: "lunch" | "tea_break" | "bio_break" | "meeting" | "break"; label: string }[] = [
    { value: "lunch", label: "Lunch" },
    { value: "tea_break", label: "Tea break" },
    { value: "bio_break", label: "Bio break" },
    { value: "meeting", label: "Meeting" },
    { value: "break", label: "Break" },
  ];

  const handleStartBreak = async (breakType: "break" | "meeting" | "bio_break" | "lunch" | "tea_break") => {
    setBreakActionLoading(true);
    setShowBreakDropdown(false);
    try {
      await apiClient.startBreak({ breakType });
      await fetchSession();
    } catch (err: any) {
      if (err?.message?.toLowerCase().includes("session") || err?.status === 400) {
        try {
          await apiClient.startSession();
          await apiClient.startBreak({ breakType });
          await fetchSession();
        } catch (e) {
          console.error("Start break failed:", e);
        }
      } else {
        console.error("Start break failed:", err);
      }
    } finally {
      setBreakActionLoading(false);
    }
  };

  const handleEndBreak = async () => {
    setBreakActionLoading(true);
    setShowBreakDropdown(false);
    try {
      await apiClient.endBreak();
      await fetchSession();
    } catch (err) {
      console.error("End break failed:", err);
    } finally {
      setBreakActionLoading(false);
    }
  };

  const formatWorkTime = (seconds: number) => {
    if (seconds < 0) return "0m";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const handleLogout = async () => {
    try {
      // End task session (if active) - this will check attendance
      try {
        await apiClient.endSession();
      } catch (error: any) {
        // If logout is blocked due to check-out requirement
        if (error.requiresCheckOut || error.message?.includes("check-out") || error.message?.includes("checkout") || error.message?.includes("Pehle logout")) {
          setLogoutBlocked(true);
          setShowProfileMenu(false);
          return;
        }
        console.error("End session error:", error);
      }
      // Call logout API (optional, but good practice)
      await apiClient.logout();
    } catch (error: any) {
      // Check if it's a check-out requirement error
      if (error.requiresCheckOut || error.message?.includes("check-out") || error.message?.includes("checkout") || error.message?.includes("Pehle logout")) {
        setLogoutBlocked(true);
        setShowProfileMenu(false);
        return;
      }
      console.error("Logout API error:", error);
      // Continue with logout even if API call fails
    } finally {
      // Only clear storage if logout was successful
      if (!logoutBlocked) {
        // Clear tab-specific storage
        tabStorage.removeItem("token");
        tabStorage.removeItem("user");
        tabStorage.removeItem("sessionId");
        
        // Close profile menu
        setShowProfileMenu(false);
        
        // Redirect to login page
        router.push("/login");
      }
    }
  };


  const content = (
    <div className={`flex h-full w-full items-center justify-between gap-3 md:gap-4 px-4 sm:px-5 md:px-4 md:pl-6 min-w-0 ${mergeWithLogo ? "flex-1 min-w-0 h-full" : ""} ${rightSidebarOpen !== true ? "md:pr-20" : ""}`}>
        {/* Left - Menu (mobile), Search (desktop) - never shrink into logo space */}
        <div className="flex items-center gap-3 shrink-0 min-w-0 flex-1 md:flex-initial md:min-w-0">
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 -ml-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden md:flex items-center w-44 lg:w-56 xl:w-64">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="search"
                placeholder="Search..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50/90 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/25 focus:border-primary-400 focus:bg-white transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Center - Session - can shrink so logo stays visible */}
        <div className="hidden sm:flex items-center flex-1 min-w-0 justify-center gap-1.5 md:gap-2 overflow-hidden">
          {sessionInfo ? (
            <div className="flex items-center gap-1.5 md:gap-2 flex-wrap justify-center min-w-0">
              <div className="inline-flex items-center gap-1 h-8 md:h-9 px-2.5 md:px-3 rounded-xl bg-gray-100 text-gray-700 border border-transparent shrink-0">
                <Clock className="h-3.5 w-3.5 text-primary-600 shrink-0" />
                <span className="text-xs text-gray-500 hidden lg:inline">Login</span>
                <span className="text-xs md:text-sm font-semibold tabular-nums">
                  {sessionInfo.loginTime
                    ? new Date(sessionInfo.loginTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                    : "—"}
                </span>
              </div>
              <div className="inline-flex items-center gap-1 h-8 md:h-9 px-2.5 md:px-3 rounded-xl bg-gray-100 text-gray-700 border border-transparent shrink-0">
                <span className="text-xs text-gray-500 hidden lg:inline">Breaks</span>
                <span className="text-xs md:text-sm font-semibold tabular-nums">{sessionInfo.breakCount}</span>
              </div>
              <div className="relative">
                {sessionInfo.onBreak ? (
                  <button
                    type="button"
                    onClick={handleEndBreak}
                    disabled={breakActionLoading}
                    className="inline-flex items-center gap-1 h-8 md:h-9 px-2.5 md:px-3 rounded-xl bg-amber-100 text-amber-800 border border-amber-200/80 text-xs md:text-sm font-medium hover:bg-amber-200 disabled:opacity-50 transition-colors shrink-0"
                  >
                    <Coffee className="h-3.5 w-3.5" />
                    End break
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowBreakDropdown((v) => !v)}
                      disabled={breakActionLoading}
                      className="inline-flex items-center gap-1 h-8 md:h-9 px-2.5 md:px-3 rounded-xl bg-gray-100 text-gray-700 border border-transparent hover:bg-gray-200 text-xs md:text-sm font-medium disabled:opacity-50 transition-colors shrink-0"
                    >
                      <Coffee className="h-3.5 w-3.5" />
                      Break
                      <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                    </button>
                    {showBreakDropdown && (
                      <>
                        <div className="fixed inset-0 z-10" aria-hidden onClick={() => setShowBreakDropdown(false)} />
                        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-20 w-40 rounded-xl border border-gray-200 bg-white py-1 shadow-lg ring-1 ring-black/5">
                          {breakTypes.map((b) => (
                            <button
                              key={b.value}
                              type="button"
                              onClick={() => handleStartBreak(b.value)}
                              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                            >
                              {b.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
              <div className="inline-flex items-center gap-1 h-8 md:h-9 px-2.5 md:px-3 rounded-xl bg-primary-50 text-primary-800 border border-primary-100 shrink-0">
                <span className="text-xs text-primary-600 hidden lg:inline">Work</span>
                <span className="text-xs md:text-sm font-semibold tabular-nums">
                  {formatWorkTime(sessionInfo.totalWorkTimeSeconds)}
                </span>
              </div>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 h-8 md:h-9 px-2.5 md:px-3 rounded-xl bg-gray-50 border border-dashed border-gray-200 text-gray-500 text-xs md:text-sm shrink-0">
              <Clock className="h-4 w-4 shrink-0" />
              <span>No active session</span>
            </div>
          )}
        </div>

        {/* Right - Dialer status, Notifications, Profile - fixed width so logo never gets pushed */}
        <div className="flex items-center gap-1 md:gap-2 min-w-0 shrink-0 flex-shrink-0">
          {userRole && ["BRANCH_MANAGER", "TEAM_LEADER", "COUNSELOR", "TELECALLER"].includes(userRole) && (
            <MobileDialerStatus compact />
          )}
          <button
            type="button"
            className="relative p-2 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full ring-2 ring-white" />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 p-1.5 pr-2 rounded-xl hover:bg-gray-100 transition-colors min-w-0"
              aria-expanded={showProfileMenu}
              aria-haspopup="true"
            >
              <div className="h-8 w-8 shrink-0 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                {userName?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="hidden md:block text-left min-w-0 max-w-[140px]">
                <p className="text-sm font-medium text-gray-900 truncate">{userName || "User"}</p>
                <p className="text-xs text-gray-500 truncate">{userRole || "Role"}</p>
                {(() => {
                  const userStr = tabStorage.getItem("user");
                  if (userStr) {
                    try {
                      const user = JSON.parse(userStr);
                      if (user.employeeCode) {
                        return (
                          <p className="text-xs text-primary-600 font-mono font-medium truncate">
                            {user.employeeCode}
                          </p>
                        );
                      }
                    } catch {
                      // ignore
                    }
                  }
                  return null;
                })()}
              </div>
              <ChevronDown className={`hidden md:block h-4 w-4 text-gray-400 shrink-0 transition-transform ${showProfileMenu ? "rotate-180" : ""}`} />
            </button>
            {showProfileMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-50 ring-1 ring-black/5">
                <button
                  type="button"
                  onClick={() => { setShowProfileMenu(false); }}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 rounded-lg mx-1"
                >
                  <User className="h-4 w-4 text-gray-500" />
                  Profile
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 rounded-lg mx-1"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
  );

  return (
    <>
      <LogoutBlockedNotification
        show={logoutBlocked}
        onDismiss={() => setLogoutBlocked(false)}
      />
      {mergeWithLogo ? (
        content
      ) : (
        <header
          role="banner"
          className="sticky top-0 z-40 h-14 md:h-16 w-full min-w-0 border-b border-gray-200 bg-white shadow-sm flex items-center shrink-0 box-border overflow-visible"
        >
          {content}
        </header>
      )}
    </>
  );
}

