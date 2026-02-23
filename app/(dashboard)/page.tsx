"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  FileText,
  Phone,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Target,
  Mail,
  Globe,
  User,
  Hash,
  Briefcase,
  Sparkles,
  X,
  Activity,
  Building2,
  Shield,
  Calendar,
  BarChart3,
  UserCheck,
  ClipboardList
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { tabStorage } from "@/lib/storage";
import { getBucketCounts, BUCKET_CONFIG, filterLeadsByBucket, BucketType } from "@/lib/utils/buckets";
import LiveUpdatesPanel from "@/components/LiveUpdatesPanel";
import ActivityFeed from "@/components/ActivityFeed";
import { getSocketClient, AuditEvent } from "@/lib/socket";
import { RoleName } from "@/lib/types/roles";
import { ROLE_DISPLAY_NAMES } from "@/lib/constants/roles";
import Link from "next/link";

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country?: string;
  visaType?: string;
  status: string;
  assignedAt?: string;
  createdAt: string;
  currentTag?: {
    id: string;
    tagFlowId: string;
    tagFlow?: {
      id: string;
      name: string;
      color: string;
      icon?: string | null;
    };
    callbackAt?: string | null;
  } | null;
}

interface DashboardStats {
  totalLeads?: number;
  totalClients?: number;
  totalCalls?: number;
  totalApplications?: number;
  pendingLeads?: number;
  activeUsers?: number;
  totalUsers?: number;
  totalTeams?: number;
  todayCalls?: number;
  todayLeads?: number;
  todayApplications?: number;
  todayClientVisits?: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [recentlyAssignedLeads, setRecentlyAssignedLeads] = useState<Lead[]>([]);
  const [allMyLeads, setAllMyLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<RoleName | null>(null);
  const [bucketCounts, setBucketCounts] = useState<Record<BucketType, number>>({
    fresh: 0,
    green: 0,
    orange: 0,
    red: 0,
  });
  const [bucketsLoading, setBucketsLoading] = useState(true);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const refreshUserData = async () => {
      // First, try to use stored user data immediately
      const userStr = tabStorage.getItem("user");
      const token = tabStorage.getItem("token");

      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          setUserId(user.id);
          setCurrentUser(user);
          setUserRole(user.role.name as RoleName);
        } catch (error) {
          console.error("Error parsing user data:", error);
        }
      }

      // Only try to refresh from API if we have a token
      if (token) {
        try {
          const response: any = await apiClient.getCurrentUser();
          if (response?.user) {
            tabStorage.setItem("user", JSON.stringify(response.user));
            setUserId(response.user.id);
            setCurrentUser(response.user);
            setUserRole(response.user.role.name as RoleName);
          }
        } catch (error: any) {
          // Silently handle 401 errors (token expired/invalid) - we already have stored user data
          if (error.status !== 401) {
            console.error("Error refreshing user data:", error);
          }
          // If we don't have stored user data and got 401, the layout will handle redirect
          if (!userStr && error.status === 401) {
            // Layout will redirect to login, so we don't need to do anything here
            return;
          }
        }
      } else if (!userStr) {
        // No token and no stored user - layout should redirect, but log for debugging
        console.warn("[Dashboard] No token or user found - layout should redirect to login");
      }
    };

    refreshUserData();
  }, []);

  useEffect(() => {
    if (userId && userRole) {
      fetchDashboardData();
      // Only fetch leads for roles that have access to the leads endpoint
      const leadsAuthorizedRoles: RoleName[] = ["ADMIN", "BRANCH_MANAGER", "TEAM_LEADER", "COUNSELOR", "TELECALLER"];
      
      let bucketInterval: NodeJS.Timeout | null = null;
      
      if (leadsAuthorizedRoles.includes(userRole)) {
        fetchRecentlyAssignedLeads();
        
        // Auto refresh bucket counts every 4 seconds
        bucketInterval = setInterval(() => {
          fetchRecentlyAssignedLeads();
        }, 4000);
      }
      
      fetchRecentActivities();
      setupActivityWebSocket();
      
      // Cleanup function
      return () => {
        if (bucketInterval) {
          clearInterval(bucketInterval);
        }
        const socketClient = getSocketClient();
        socketClient.disconnect();
      };
    }

    return () => {
      const socketClient = getSocketClient();
      socketClient.disconnect();
    };
  }, [userId, userRole]);

  const setupActivityWebSocket = () => {
    const socketClient = getSocketClient();
    
    // Handle real-time events for activities and lead tag updates
    const handleRealtimeEvent = (event: any) => {
      if (event.type === "audit") {
        const auditEvent = event as AuditEvent;
        const newEvent = {
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
        setRecentActivities(prev => [newEvent, ...prev].slice(0, 10));
      } else if (event.type === "system") {
        const payload = event.payload;
        if (!payload || !payload.type) return;
        
        // Listen for tag updates to instantly update buckets
        if ((payload.type === "lead:tagUpdated" || payload.type === "lead:tagApplied" || payload.type === "tag:applied" || payload.type === "tag:updated") && payload.leadId) {
          updateLeadTagInstantly(payload.leadId);
        }
      }
    };
    
    // Instant update lead tag without full refresh
    const updateLeadTagInstantly = async (leadId: string) => {
      try {
        // Fetch updated tag for this lead
        const tagsResponse = await apiClient.getLeadTags(leadId);
        const tags = tagsResponse.tagApplications || [];
        const currentTag = tags.length > 0 ? tags[0] : null;
        
        // Update lead in state with new tag
        setAllMyLeads((prevLeads) => {
          const updatedLeads = prevLeads.map((lead: Lead) => {
            if (lead.id === leadId) {
              return {
                ...lead,
                currentTag: currentTag || null,
              };
            }
            return lead;
          });
          
          // Recalculate bucket counts with updated leads (instant bucket update)
          const counts = getBucketCounts(updatedLeads, userId || undefined);
          setBucketCounts(counts);
          
          return updatedLeads;
        });
        
        console.log(`[Dashboard] ✅ Instant update: Lead ${leadId} tag updated, bucket recalculated`);
      } catch (error) {
        console.error(`[Dashboard] Error updating lead tag instantly:`, error);
        // Fallback to full refresh if instant update fails
        fetchRecentlyAssignedLeads();
      }
    };

    socketClient.connect(
      () => {
        console.log("[Dashboard] WebSocket connected for activities");
      },
      () => {
        console.log("[Dashboard] WebSocket disconnected");
      },
      (error) => {
        console.error("[Dashboard] WebSocket error:", error);
      },
      handleRealtimeEvent,
      (auditEvent: AuditEvent) => {
        const newEvent = {
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
        setRecentActivities(prev => [newEvent, ...prev].slice(0, 10));
      }
    );
  };

  const fetchRecentActivities = async () => {
    try {
      setActivitiesLoading(true);
      const response = await apiClient.getActivityFeed({ limit: 10 });
      setRecentActivities(response.events || []);
    } catch (error: any) {
      // Silently handle 404 errors - endpoint might not be available yet
      if (error.status === 404) {
        console.warn("Activity feed endpoint not available (404). This is expected if the server hasn't been restarted.");
        setRecentActivities([]);
      } else {
        console.error("Failed to fetch recent activities:", error);
      }
    } finally {
      setActivitiesLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    if (!userRole) return;

    try {
      setLoading(true);
      setError(null);

      const promises: Promise<any>[] = [];

      // Fetch data based on role
      if (userRole === "BRANCH_MANAGER") {
        promises.push(
          apiClient.getLeads().catch(() => ({ leads: [] })),
          apiClient.getClients().catch(() => ({ clients: [] })),
          apiClient.getCalls().catch(() => ({ calls: [] })),
          apiClient.getApplications().catch(() => ({ applications: [] })),
          apiClient.getStaff().catch(() => ({ staff: [] }))
        );
      } else if (userRole === "TEAM_LEADER") {
        promises.push(
          apiClient.getLeads().catch(() => ({ leads: [] })),
          apiClient.getCalls().catch(() => ({ calls: [] })),
          apiClient.getStaff().catch(() => ({ staff: [] }))
        );
      } else if (userRole === "TELECALLER") {
        promises.push(
          apiClient.getLeads().catch(() => ({ leads: [] })),
          apiClient.getCalls().catch(() => ({ calls: [] }))
        );
      } else if (userRole === "COUNSELOR") {
        promises.push(
          apiClient.getLeads().catch(() => ({ leads: [] })),
          apiClient.getClients().catch(() => ({ clients: [] })),
          apiClient.getApplications().catch(() => ({ applications: [] }))
        );
      } else if (userRole === "RECEPTIONIST") {
        promises.push(
          apiClient.getClients().catch(() => ({ clients: [] })),
          apiClient.getApplications().catch(() => ({ applications: [] }))
        );
      } else if (userRole === "FILLING_OFFICER") {
        promises.push(
          apiClient.getApplications().catch(() => ({ applications: [] }))
        );
      } else if (userRole === "IT_TEAM" || userRole === "HR_TEAM") {
        promises.push(
          apiClient.getStaff().catch(() => ({ staff: [] })),
          apiClient.getLeads().catch(() => ({ leads: [] }))
        );
      }

      const results = await Promise.allSettled(promises);

      // Process results based on role
      if (userRole === "BRANCH_MANAGER") {
        const [leadsRes, clientsRes, callsRes, appsRes, staffRes] = results;
        const leads = leadsRes.status === "fulfilled" ? (leadsRes.value.leads || []) : [];
        const clients = clientsRes.status === "fulfilled" ? (clientsRes.value.clients || []) : [];
        const calls = callsRes.status === "fulfilled" ? (callsRes.value.calls || []) : [];
        const applications = appsRes.status === "fulfilled" ? (appsRes.value.applications || []) : [];
        const staff = staffRes.status === "fulfilled" ? (staffRes.value.staff || []) : [];

        setStats({
          totalLeads: leads.length,
          totalClients: clients.length,
          totalCalls: calls.length,
          totalApplications: applications.length,
          pendingLeads: leads.filter((l: any) => l.status === "pending" || !l.status).length,
          activeUsers: staff.filter((s: any) => s.isActive).length,
          totalUsers: staff.length,
        });
      } else if (userRole === "TEAM_LEADER") {
        const [leadsRes, callsRes, staffRes] = results;
        const leads = leadsRes.status === "fulfilled" ? (leadsRes.value.leads || []) : [];
        const calls = callsRes.status === "fulfilled" ? (callsRes.value.calls || []) : [];
        const staff = staffRes.status === "fulfilled" ? (staffRes.value.staff || []) : [];

        setStats({
          totalLeads: leads.length,
          totalCalls: calls.length,
          activeUsers: staff.filter((s: any) => s.isActive).length,
          totalUsers: staff.length,
        });
      } else if (userRole === "TELECALLER") {
        const [leadsRes, callsRes] = results;
        const leads = leadsRes.status === "fulfilled" ? (leadsRes.value.leads || []) : [];
        const calls = callsRes.status === "fulfilled" ? (callsRes.value.calls || []) : [];

        setStats({
          totalLeads: leads.length,
          totalCalls: calls.length,
        });
      } else if (userRole === "COUNSELOR") {
        const [leadsRes, clientsRes, appsRes] = results;
        const leads = leadsRes.status === "fulfilled" ? (leadsRes.value.leads || []) : [];
        const clients = clientsRes.status === "fulfilled" ? (clientsRes.value.clients || []) : [];
        const applications = appsRes.status === "fulfilled" ? (appsRes.value.applications || []) : [];

        setStats({
          totalLeads: leads.length,
          totalClients: clients.length,
          totalApplications: applications.length,
        });
      } else if (userRole === "RECEPTIONIST") {
        const [clientsRes, appsRes] = results;
        const clients = clientsRes.status === "fulfilled" ? (clientsRes.value.clients || []) : [];
        const applications = appsRes.status === "fulfilled" ? (appsRes.value.applications || []) : [];

        setStats({
          totalClients: clients.length,
          totalApplications: applications.length,
        });
      } else if (userRole === "FILLING_OFFICER") {
        const [appsRes] = results;
        const applications = appsRes.status === "fulfilled" ? (appsRes.value.applications || []) : [];

        setStats({
          totalApplications: applications.length,
        });
      } else if (userRole === "IT_TEAM" || userRole === "HR_TEAM") {
        const [staffRes, leadsRes] = results;
        const staff = staffRes.status === "fulfilled" ? (staffRes.value.staff || []) : [];
        const leads = leadsRes.status === "fulfilled" ? (leadsRes.value.leads || []) : [];

        setStats({
          totalUsers: staff.length,
          activeUsers: staff.filter((s: any) => s.isActive).length,
          totalLeads: leads.length,
        });
      }
    } catch (err: any) {
      console.error("Error fetching dashboard data:", err);
      setError(err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentlyAssignedLeads = async () => {
    try {
      setBucketsLoading(true);
      
      // RBAC: Telecaller can only see their own leads (force assignedTo = me)
      // For other roles, fetch all leads (same as Leads page default behavior)
      const isTelecaller = userRole === "TELECALLER";
      const response = isTelecaller
        ? await apiClient.getLeads({ assignedToUserId: userId })
        : await apiClient.getLeads();
      const allLeads = response.leads || [];

      // For Telecaller, API already filtered by assignedToUserId,
      // so all returned leads are already assigned. No need for additional filtering.
      // For other roles, filter to show only assigned leads + collaboration leads
      const myLeads = isTelecaller
        ? allLeads // Trust API filter - all returned leads are valid
        : allLeads.filter((lead: any) =>
            lead.assignedTo?.id === userId ||
            (lead.previousAssignedTo?.id === userId && lead.collaborationActive === true)
          );
      
      console.log(`[Dashboard] Fetched ${allLeads.length} total leads, filtered to ${myLeads.length} my leads`);

      // Fetch currentTag (with callbackAt) for each lead - required for bucket classification
      const leadsWithTags = await Promise.all(
        myLeads.map(async (lead: Lead) => {
          try {
            const tagsResponse = await apiClient.getLeadTags(lead.id);
            const tags = tagsResponse.tagApplications || [];
            const currentTag = tags.length > 0 ? tags[0] : null;
            
            return {
              ...lead,
              currentTag: currentTag || null,
            };
          } catch (err) {
            console.warn(`[Dashboard] Failed to fetch tags for lead ${lead.id}:`, err);
            return {
              ...lead,
              currentTag: null,
            };
          }
        })
      );

      setAllMyLeads(leadsWithTags);

      const counts = getBucketCounts(leadsWithTags, userId);
      console.error(`[Dashboard] ✅ Bucket counts calculated:`, counts);
      console.error(`[Dashboard] 🔍 DEBUG: leadsWithTags.length=${leadsWithTags.length}, userId=${userId}, counts=`, JSON.stringify(counts));
      setBucketCounts(counts);

      const recent = leadsWithTags
        .sort((a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 5);

      setRecentlyAssignedLeads(recent);
    } catch (error) {
      console.error("Failed to fetch recently assigned leads:", error);
    } finally {
      setBucketsLoading(false);
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} mins ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  };

  const renderRoleSpecificStats = () => {
    if (!userRole) return null;

    switch (userRole) {
      case "BRANCH_MANAGER":
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
            <Link href="/dashboard/leads" className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-orange-100 p-3 rounded-lg text-orange-600">
                  <Target className="h-6 w-6" />
                </div>
                <span className="text-sm font-medium text-green-600">View All</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.totalLeads || 0}</h3>
              <p className="text-sm text-gray-600">Total Leads</p>
              {stats.pendingLeads !== undefined && (
                <p className="text-xs text-yellow-600 mt-1">{stats.pendingLeads} pending</p>
              )}
            </Link>
            <Link href="/dashboard/clients" className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-green-100 p-3 rounded-lg text-green-600">
                  <UserCheck className="h-6 w-6" />
                </div>
                <span className="text-sm font-medium text-green-600">View All</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.totalClients || 0}</h3>
              <p className="text-sm text-gray-600">Total Clients</p>
            </Link>
            <Link href="/dashboard/calls" className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-purple-100 p-3 rounded-lg text-purple-600">
                  <Phone className="h-6 w-6" />
                </div>
                <span className="text-sm font-medium text-green-600">View All</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.totalCalls || 0}</h3>
              <p className="text-sm text-gray-600">Total Calls</p>
            </Link>
            <Link href="/dashboard/staff" className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-blue-100 p-3 rounded-lg text-blue-600">
                  <Users className="h-6 w-6" />
                </div>
                <span className="text-sm font-medium text-green-600">View All</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.totalUsers || 0}</h3>
              <p className="text-sm text-gray-600">Total Staff</p>
              {stats.activeUsers !== undefined && (
                <p className="text-xs text-green-600 mt-1">{stats.activeUsers} active</p>
              )}
            </Link>
          </div>
        );

      case "TEAM_LEADER":
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-8">
            <Link href="/dashboard/leads" className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-orange-100 p-3 rounded-lg text-orange-600">
                  <Target className="h-6 w-6" />
                </div>
                <span className="text-sm font-medium text-green-600">View All</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.totalLeads || 0}</h3>
              <p className="text-sm text-gray-600">Team Leads</p>
            </Link>
            <Link href="/dashboard/calls" className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-purple-100 p-3 rounded-lg text-purple-600">
                  <Phone className="h-6 w-6" />
                </div>
                <span className="text-sm font-medium text-green-600">View All</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.totalCalls || 0}</h3>
              <p className="text-sm text-gray-600">Team Calls</p>
            </Link>
            <Link href="/dashboard/staff" className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-blue-100 p-3 rounded-lg text-blue-600">
                  <Users className="h-6 w-6" />
                </div>
                <span className="text-sm font-medium text-green-600">View All</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.totalUsers || 0}</h3>
              <p className="text-sm text-gray-600">Team Members</p>
              {stats.activeUsers !== undefined && (
                <p className="text-xs text-green-600 mt-1">{stats.activeUsers} active</p>
              )}
            </Link>
          </div>
        );

      case "TELECALLER":
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 mb-8">
            <Link href="/dashboard/leads" className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-orange-100 p-3 rounded-lg text-orange-600">
                  <Target className="h-6 w-6" />
                </div>
                <span className="text-sm font-medium text-green-600">View All</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.totalLeads || 0}</h3>
              <p className="text-sm text-gray-600">My Leads</p>
            </Link>
            <Link href="/dashboard/calls" className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-purple-100 p-3 rounded-lg text-purple-600">
                  <Phone className="h-6 w-6" />
                </div>
                <span className="text-sm font-medium text-green-600">View All</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.totalCalls || 0}</h3>
              <p className="text-sm text-gray-600">My Calls</p>
            </Link>
          </div>
        );

      case "COUNSELOR":
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-8">
            <Link href="/dashboard/leads" className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-orange-100 p-3 rounded-lg text-orange-600">
                  <Target className="h-6 w-6" />
                </div>
                <span className="text-sm font-medium text-green-600">View All</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.totalLeads || 0}</h3>
              <p className="text-sm text-gray-600">My Leads</p>
            </Link>
            <Link href="/dashboard/clients" className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-green-100 p-3 rounded-lg text-green-600">
                  <UserCheck className="h-6 w-6" />
                </div>
                <span className="text-sm font-medium text-green-600">View All</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.totalClients || 0}</h3>
              <p className="text-sm text-gray-600">My Clients</p>
            </Link>
            <Link href="/dashboard/applications" className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-indigo-100 p-3 rounded-lg text-indigo-600">
                  <FileText className="h-6 w-6" />
                </div>
                <span className="text-sm font-medium text-green-600">View All</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.totalApplications || 0}</h3>
              <p className="text-sm text-gray-600">My Applications</p>
            </Link>
          </div>
        );

      case "RECEPTIONIST":
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 mb-8">
            <Link href="/dashboard/clients" className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-green-100 p-3 rounded-lg text-green-600">
                  <UserCheck className="h-6 w-6" />
                </div>
                <span className="text-sm font-medium text-green-600">View All</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.totalClients || 0}</h3>
              <p className="text-sm text-gray-600">Total Clients</p>
            </Link>
            <Link href="/dashboard/applications" className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-indigo-100 p-3 rounded-lg text-indigo-600">
                  <FileText className="h-6 w-6" />
                </div>
                <span className="text-sm font-medium text-green-600">View All</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.totalApplications || 0}</h3>
              <p className="text-sm text-gray-600">Applications</p>
            </Link>
          </div>
        );

      case "FILLING_OFFICER":
        return (
          <div className="grid grid-cols-1 gap-4 md:gap-6 mb-8">
            <Link href="/dashboard/applications" className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-indigo-100 p-3 rounded-lg text-indigo-600">
                  <FileText className="h-6 w-6" />
                </div>
                <span className="text-sm font-medium text-green-600">View All</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.totalApplications || 0}</h3>
              <p className="text-sm text-gray-600">Total Applications</p>
            </Link>
          </div>
        );

      case "IT_TEAM":
      case "HR_TEAM":
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 mb-8">
            <Link href="/dashboard/staff" className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-blue-100 p-3 rounded-lg text-blue-600">
                  <Users className="h-6 w-6" />
                </div>
                <span className="text-sm font-medium text-green-600">View All</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.totalUsers || 0}</h3>
              <p className="text-sm text-gray-600">Total Users</p>
              {stats.activeUsers !== undefined && (
                <p className="text-xs text-green-600 mt-1">{stats.activeUsers} active</p>
              )}
            </Link>
            <Link href="/dashboard/leads" className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-orange-100 p-3 rounded-lg text-orange-600">
                  <Target className="h-6 w-6" />
                </div>
                <span className="text-sm font-medium text-green-600">View All</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.totalLeads || 0}</h3>
              <p className="text-sm text-gray-600">Total Leads</p>
            </Link>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* User Profile Card */}
        {currentUser && (
        <div className="mb-6 bg-gradient-to-r from-primary-50 to-blue-50 rounded-xl shadow-sm border border-primary-200 p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 bg-primary-500 rounded-full flex items-center justify-center text-white font-bold text-xl">
                {currentUser.firstName?.charAt(0).toUpperCase() || "U"}
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                  Welcome back, {currentUser.firstName} {currentUser.lastName}!
                </h2>
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-lg border border-primary-200">
                    <Hash className="h-4 w-4 text-primary-600" />
                    {currentUser.employeeCode ? (
                      <span className="text-sm font-mono font-semibold text-primary-700">
                        {currentUser.employeeCode}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400 italic">
                        Not assigned
                      </span>
                    )}
                  </div>
                  {currentUser.role && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-lg border border-gray-200">
                      <Briefcase className="h-4 w-4 text-gray-600" />
                      <span className="text-sm font-medium text-gray-700">
                        {ROLE_DISPLAY_NAMES[currentUser.role.name as RoleName] || currentUser.role.name?.replace("_", " ") || "N/A"}
                      </span>
                    </div>
                  )}
                  {currentUser.email && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-lg border border-gray-200">
                      <Mail className="h-4 w-4 text-gray-600" />
                      <span className="text-sm text-gray-700">
                        {currentUser.email}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
          {userRole ? `${ROLE_DISPLAY_NAMES[userRole]} Dashboard` : "Dashboard"}
        </h1>
        <p className="text-gray-600">Here's what's happening today.</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Role-Specific Stats */}
      {renderRoleSpecificStats()}

      {/* My Buckets Section - Only for roles that work with leads */}
      {(userRole === "TELECALLER" || userRole === "TEAM_LEADER" || userRole === "BRANCH_MANAGER" || userRole === "COUNSELOR") && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">My Buckets</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(["fresh", "green", "orange", "red"] as BucketType[]).map((bucketType) => {
              const config = BUCKET_CONFIG[bucketType];
              const count = bucketCounts[bucketType];
              const bucketLeads = filterLeadsByBucket(allMyLeads, bucketType);
              const IconComponent = bucketType === "fresh" ? Sparkles :
                bucketType === "green" ? CheckCircle2 :
                  bucketType === "orange" ? Clock : X;

              return (
                <div
                  key={bucketType}
                  onClick={() => router.push(`/dashboard/leads?bucket=${bucketType}`)}
                  className={`bg-white rounded-lg shadow-sm p-6 border-2 cursor-pointer hover:shadow-md transition-all ${config.borderColor}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={`${config.bgColor} p-3 rounded-lg ${config.color}`}>
                      <IconComponent className="h-6 w-6" />
                    </div>
                    <span className={`text-2xl font-bold ${config.color}`}>
                      {bucketsLoading ? "..." : count}
                    </span>
                  </div>
                  <h3 className={`text-lg font-semibold ${config.color} mb-1`}>
                    {config.label}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {bucketType === "fresh" && "New leads waiting"}
                    {bucketType === "green" && "Interested & progressing"}
                    {bucketType === "orange" && "Callback scheduled"}
                    {bucketType === "red" && "Not interested / Invalid"}
                  </p>
                  {bucketLeads.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-xs text-gray-500 mb-2">Recent:</p>
                      <div className="space-y-1">
                        {bucketLeads.slice(0, 3).map((lead) => (
                          <div key={lead.id} className="text-xs text-gray-700 truncate">
                            {lead.firstName} {lead.lastName}
                          </div>
                        ))}
                        {bucketLeads.length > 3 && (
                          <p className="text-xs text-gray-500">+{bucketLeads.length - 3} more</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activities */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Recent Activities
            </h2>
            <button
              onClick={() => router.push("/dashboard/activity-feed")}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              View All
            </button>
          </div>
          {activitiesLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : recentActivities.length > 0 ? (
            <ActivityFeed events={recentActivities} showEntityLinks={true} compact={true} />
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No recent activities</p>
            </div>
          )}
        </div>

        {/* Recently Assigned Leads - Only for roles that work with leads */}
        {(userRole === "TELECALLER" || userRole === "TEAM_LEADER" || userRole === "BRANCH_MANAGER" || userRole === "COUNSELOR") && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Target className="h-5 w-5 text-primary-600" />
                Recently Assigned
              </h2>
              <button
                onClick={() => router.push("/dashboard/leads")}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                View All
              </button>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : recentlyAssignedLeads.length > 0 ? (
              <div className="space-y-3">
                {recentlyAssignedLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="p-3 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/dashboard/leads`)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-sm">
                          {lead.firstName} {lead.lastName}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-600">
                          <Mail className="h-3 w-3" />
                          {lead.email}
                        </div>
                        {lead.country && (
                          <div className="flex items-center gap-2 mt-1 text-xs text-gray-600">
                            <Globe className="h-3 w-3" />
                            {lead.country}
                          </div>
                        )}
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${lead.status === "new" ? "bg-blue-100 text-blue-700" :
                          lead.status === "contacted" ? "bg-yellow-100 text-yellow-700" :
                            lead.status === "qualified" ? "bg-green-100 text-green-700" :
                              lead.status === "converted" ? "bg-purple-100 text-purple-700" :
                                "bg-gray-100 text-gray-700"
                        }`}>
                        {lead.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-500">
                        Assigned {getTimeAgo(lead.createdAt)}
                      </p>
                      {lead.visaType && (
                        <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                          {lead.visaType}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Target className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No leads assigned yet</p>
                <p className="text-gray-400 text-xs mt-1">Leads assigned to you will appear here</p>
              </div>
            )}
          </div>
        )}
      </div>

        {/* Live Updates Panel */}
        <LiveUpdatesPanel />
      </div>
    </div>
  );
}
