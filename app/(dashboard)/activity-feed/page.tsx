"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Filter, RefreshCw, ChevronDown } from "lucide-react";
import { apiClient } from "@/lib/api";
import { getSocketClient, AuditEvent } from "@/lib/socket";
import { tabStorage } from "@/lib/storage";
import { RoleName } from "@/lib/types/roles";
import ActivityFeed from "@/components/ActivityFeed";

interface ActivityEvent {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    employeeCode: string | null;
  } | null;
  description: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
}

export default function ActivityFeedPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [userRole, setUserRole] = useState<RoleName | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    hasMore: false,
  });

  // Filters
  const [filters, setFilters] = useState({
    entityType: "",
    userId: "",
    startDate: "",
    endDate: "",
  });

  // Mark component as mounted (client-side only)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Get user role on mount
  useEffect(() => {
    // Only access storage in browser environment after mount
    if (!mounted || typeof window === "undefined") return;
    
    try {
      const userStr = tabStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        setUserRole(user.role?.name as RoleName);
      }
    } catch (error) {
      console.error("Error parsing user data:", error);
    }
  }, [mounted]);

  const setupWebSocket = useCallback(() => {
    if (typeof window === "undefined") return;
    
    try {
      const socketClient = getSocketClient();
      
      socketClient.connect(
        () => {
          console.log("[Activity Feed] WebSocket connected");
        },
        () => {
          console.log("[Activity Feed] WebSocket disconnected");
        },
        (error) => {
          console.error("[Activity Feed] WebSocket error:", error);
        },
        () => {}, // dx:event handler (not needed here)
        (auditEvent: AuditEvent) => {
          // Handle new audit event
          console.log("[Activity Feed] New audit event received:", auditEvent.data.id);
          const newEvent: ActivityEvent = {
            id: auditEvent.data.id,
            entityType: auditEvent.data.entityType,
            entityId: auditEvent.data.entityId,
            action: auditEvent.data.action,
            userId: auditEvent.data.userId,
            user: auditEvent.data.user,
            description: auditEvent.data.description,
            metadata: auditEvent.data.metadata,
            createdAt: auditEvent.data.createdAt,
          };
          // Add to top of list
          setEvents(prev => [newEvent, ...prev]);
          // Update pagination
          setPagination(prev => ({
            ...prev,
            total: prev.total + 1,
          }));
        }
      );
    } catch (error) {
      console.error("[Activity Feed] Failed to setup WebSocket:", error);
    }
  }, []);

  const fetchActivityFeed = useCallback(async (reset = false) => {
    // Check if user has access before making the request
    const auditAuthorizedRoles: RoleName[] = ["ADMIN", "BRANCH_MANAGER", "TEAM_LEADER"];
    if (!userRole || !auditAuthorizedRoles.includes(userRole)) {
      setError("Insufficient permissions. This page is only accessible to ADMIN, BRANCH_MANAGER, and TEAM_LEADER roles.");
      setLoading(false);
      return;
    }

    try {
      if (reset) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      const params: any = {
        limit: pagination.limit,
        offset: reset ? 0 : pagination.offset,
      };

      // Add filters if set
      if (filters.entityType) params.entityType = filters.entityType;
      if (filters.userId) params.userId = filters.userId;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const response = await apiClient.getAuditEvents(params);
      
      if (reset) {
        setEvents(response.events || []);
      } else {
        setEvents(prev => [...prev, ...(response.events || [])]);
      }
      
      setPagination({
        total: response.pagination.total,
        limit: response.pagination.limit,
        offset: reset ? response.events.length : pagination.offset + response.events.length,
        hasMore: response.pagination.hasMore,
      });
    } catch (err: any) {
      console.error("Failed to fetch activity feed:", err);
      setError(err.message || "Failed to load activity feed");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [userRole, pagination.limit, pagination.offset, filters]);

  // Setup WebSocket and fetch data when user role is available
  useEffect(() => {
    // Only run after component is mounted and in browser
    if (!mounted || typeof window === "undefined") return;
    
    // Only fetch and setup WebSocket if user has access
    const auditAuthorizedRoles: RoleName[] = ["ADMIN", "BRANCH_MANAGER", "TEAM_LEADER"];
    
    if (!userRole) return; // Wait for user role to be loaded
    
    if (auditAuthorizedRoles.includes(userRole)) {
      // Wait for page to be fully loaded before connecting WebSocket
      if (document.readyState !== "complete") {
        const handleLoad = () => {
          // Small delay to ensure page is fully ready
          setTimeout(() => {
            fetchActivityFeed(true); // Reset on initial load
            setupWebSocket();
          }, 500);
        };
        window.addEventListener("load", handleLoad);
        return () => {
          window.removeEventListener("load", handleLoad);
          const socketClient = getSocketClient();
          socketClient.disconnect();
        };
      } else {
        // Page already loaded, but add small delay to ensure everything is ready
        const timeoutId = setTimeout(() => {
          fetchActivityFeed(true); // Reset on initial load
          setupWebSocket();
        }, 500);
        
        return () => {
          clearTimeout(timeoutId);
          const socketClient = getSocketClient();
          socketClient.disconnect();
        };
      }
    } else {
      // User doesn't have access - show error immediately
      setLoading(false);
      setError("Insufficient permissions. This page is only accessible to ADMIN, BRANCH_MANAGER, and TEAM_LEADER roles.");
    }
  }, [mounted, userRole, fetchActivityFeed, setupWebSocket]);

  useEffect(() => {
    // Only fetch if user has access and component is mounted
    if (!mounted) return;
    
    const auditAuthorizedRoles: RoleName[] = ["ADMIN", "BRANCH_MANAGER", "TEAM_LEADER"];
    if (userRole && auditAuthorizedRoles.includes(userRole)) {
      // Reset and fetch when filters change
      setPagination(prev => ({ ...prev, offset: 0, hasMore: false }));
      setEvents([]);
      fetchActivityFeed(true);
    }
  }, [mounted, filters, userRole, fetchActivityFeed]);

  const handleLoadMore = () => {
    if (!loadingMore && pagination.hasMore) {
      fetchActivityFeed();
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleRefresh = () => {
    setEvents([]);
    setPagination(prev => ({ ...prev, offset: 0, hasMore: false }));
    fetchActivityFeed(true);
  };

  // Don't render until mounted (prevents SSR/prefetch issues)
  if (!mounted) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
          Activity Feed
        </h1>
        <p className="text-gray-600">View all system activities and audit events</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
          <button
            onClick={handleRefresh}
            className="ml-auto flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Entity Type
            </label>
            <select
              value={filters.entityType}
              onChange={(e) => handleFilterChange("entityType", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">All Types</option>
              <option value="LEAD">Lead</option>
              <option value="CLIENT">Client</option>
              <option value="APPLICATION">Application</option>
              <option value="TASK">Task</option>
              <option value="USER">User</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange("startDate", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange("endDate", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              User ID (optional)
            </label>
            <input
              type="text"
              value={filters.userId}
              onChange={(e) => handleFilterChange("userId", e.target.value)}
              placeholder="Filter by user ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Showing {events.length} of {pagination.total} activities
              </p>
            </div>
            
            <ActivityFeed events={events} showEntityLinks={true} />
            
            {pagination.hasMore && (
              <div className="mt-6 text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loadingMore ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Loading...
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      Load More
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

