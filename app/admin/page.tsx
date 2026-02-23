"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  FileText,
  Phone,
  Target,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  Building2,
  Calendar,
  Activity,
  BarChart3,
  Shield,
  Briefcase,
  LayoutDashboard,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { tabStorage } from "@/lib/storage";
import Link from "next/link";

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalLeads: number;
  totalClients: number;
  totalCalls: number;
  totalApplications: number;
  pendingLeads: number;
  totalTeams: number;
  recentActivities?: any[];
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeUsers: 0,
    totalLeads: 0,
    totalClients: 0,
    totalCalls: 0,
    totalApplications: 0,
    pendingLeads: 0,
    totalTeams: 0,
  });
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [recentLeads, setRecentLeads] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all data in parallel
      const [
        staffResponse,
        leadsResponse,
        clientsResponse,
        callsResponse,
        applicationsResponse,
        teamsResponse,
      ] = await Promise.allSettled([
        apiClient.getStaff(),
        apiClient.getLeads(), // Get all leads for count
        apiClient.getClients(),
        apiClient.getCalls(),
        apiClient.getApplications(),
        apiClient.getTeams(),
      ]);

      // Log all responses for debugging
      console.log("[Dashboard] API Responses:", {
        staff: { status: staffResponse.status, value: staffResponse.status === "fulfilled" ? staffResponse.value : null, reason: staffResponse.status === "rejected" ? staffResponse.reason : null },
        leads: { status: leadsResponse.status, value: leadsResponse.status === "fulfilled" ? leadsResponse.value : null, reason: leadsResponse.status === "rejected" ? leadsResponse.reason : null },
        clients: { status: clientsResponse.status, value: clientsResponse.status === "fulfilled" ? clientsResponse.value : null, reason: clientsResponse.status === "rejected" ? clientsResponse.reason : null },
        calls: { status: callsResponse.status, value: callsResponse.status === "fulfilled" ? callsResponse.value : null, reason: callsResponse.status === "rejected" ? callsResponse.reason : null },
        applications: { status: applicationsResponse.status, value: applicationsResponse.status === "fulfilled" ? applicationsResponse.value : null, reason: applicationsResponse.status === "rejected" ? applicationsResponse.reason : null },
        teams: { status: teamsResponse.status, value: teamsResponse.status === "fulfilled" ? teamsResponse.value : null, reason: teamsResponse.status === "rejected" ? teamsResponse.reason : null },
      });

      // Log any failures for debugging
      if (staffResponse.status === "rejected") {
        console.error("Failed to fetch staff:", staffResponse.reason);
      }
      if (leadsResponse.status === "rejected") {
        console.error("Failed to fetch leads:", leadsResponse.reason);
      }
      if (clientsResponse.status === "rejected") {
        console.error("Failed to fetch clients:", clientsResponse.reason);
      }
      if (callsResponse.status === "rejected") {
        console.error("Failed to fetch calls:", callsResponse.reason);
      }
      if (applicationsResponse.status === "rejected") {
        console.error("Failed to fetch applications:", applicationsResponse.reason);
      }
      if (teamsResponse.status === "rejected") {
        console.error("Failed to fetch teams:", teamsResponse.reason);
      }

      // Check if all requests failed
      const allFailed = [
        staffResponse,
        leadsResponse,
        clientsResponse,
        callsResponse,
        applicationsResponse,
        teamsResponse,
      ].every(response => response.status === "rejected");

      if (allFailed) {
        setError("Failed to load dashboard data. Please check your connection and try again.");
        setLoading(false);
        return;
      }

      // Process staff data
      if (staffResponse.status === "fulfilled") {
        const staff = staffResponse.value.staff || [];
        const totalUsers = staff.length;
        const activeUsers = staff.filter((s: any) => s.isActive).length;
        console.log("[Dashboard] Staff data:", { totalUsers, activeUsers, staffCount: staff.length });
        setStats((prev) => ({
          ...prev,
          totalUsers,
          activeUsers,
        }));

        // Get recent users (last 5)
        setRecentUsers(staff.slice(0, 5));
      }

      // Process leads data
      if (leadsResponse.status === "fulfilled") {
        const leadsData = leadsResponse.value as { leads?: any[]; total?: number };
        const leads = leadsData.leads || [];
        const totalLeads = leadsData.total || leads.length;
        const pendingLeads = leads.filter((l: any) => l.status === "pending" || !l.status).length;
        console.log("[Dashboard] Leads data:", { totalLeads, pendingLeads, leadsCount: leads.length, hasTotal: !!leadsData.total });
        setStats((prev) => ({
          ...prev,
          totalLeads,
          pendingLeads,
        }));

        // Get recent leads (last 5)
        setRecentLeads(leads.slice(0, 5));
      }

      // Process clients data
      if (clientsResponse.status === "fulfilled") {
        const clientsData = clientsResponse.value as { clients: any[] };
        const clients = clientsData.clients || [];
        const totalClients = clients.length;
        console.log("[Dashboard] Clients data:", { totalClients, clientsCount: clients.length });
        setStats((prev) => ({
          ...prev,
          totalClients,
        }));
      }

      // Process calls data
      if (callsResponse.status === "fulfilled") {
        const callsData = callsResponse.value as { calls: any[] };
        const calls = callsData.calls || [];
        const totalCalls = calls.length;
        console.log("[Dashboard] Calls data:", { totalCalls, callsCount: calls.length });
        setStats((prev) => ({
          ...prev,
          totalCalls,
        }));
      }

      // Process applications data
      if (applicationsResponse.status === "fulfilled") {
        const applicationsData = applicationsResponse.value as { applications: any[] };
        const applications = applicationsData.applications || [];
        const totalApplications = applications.length;
        console.log("[Dashboard] Applications data:", { totalApplications, applicationsCount: applications.length });
        setStats((prev) => ({
          ...prev,
          totalApplications,
        }));
      }

      // Process teams data
      if (teamsResponse.status === "fulfilled") {
        try {
          const teamsData = teamsResponse.value as { teams?: any[]; totalTeams?: number };
          const teams = teamsData.teams || [];
          const totalTeams = teamsData.totalTeams || teams.length;
          console.log("[Dashboard] Teams data:", { totalTeams, teamsCount: teams.length });
          setStats((prev) => ({
            ...prev,
            totalTeams,
          }));
        } catch (teamsError: any) {
          console.error("[Dashboard] Error processing teams data:", teamsError);
          // Set default value if processing fails
          setStats((prev) => ({
            ...prev,
            totalTeams: 0,
          }));
        }
      } else {
        // If teams request failed, set default value
        setStats((prev) => ({
          ...prev,
          totalTeams: 0,
        }));
      }

      // Log final stats for debugging
      setStats((prev) => {
        console.log("[Dashboard] Final stats:", prev);
        return prev;
      });
    } catch (err: any) {
      console.error("Error fetching dashboard data:", err);
      if (err.status === 401 || err.status === 403) {
        router.push("/login");
        return;
      }
      setError(err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <Shield className="h-7 w-7 md:h-8 md:w-8 text-primary-600" />
            Admin Dashboard
          </h1>
          <p className="text-gray-600">Overview of system statistics and recent activity</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
          {/* Total Users */}
          <Link
            href="/admin/users"
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
                <p className="text-xs text-green-600 mt-1">
                  {stats.activeUsers} active
                </p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </Link>

          {/* Total Leads */}
          <Link
            href="/dashboard/leads"
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Leads</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalLeads}</p>
                <p className="text-xs text-yellow-600 mt-1">
                  {stats.pendingLeads} pending
                </p>
              </div>
              <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                <Target className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </Link>

          {/* Total Clients */}
          <Link
            href="/dashboard/clients"
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Clients</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalClients}</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <UserCheck className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </Link>

          {/* Total Calls */}
          <Link
            href="/dashboard/calls"
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Calls</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalCalls}</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Phone className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </Link>

          {/* Total Applications */}
          <Link
            href="/dashboard/applications"
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Applications</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalApplications}</p>
              </div>
              <div className="h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center">
                <FileText className="h-6 w-6 text-indigo-600" />
              </div>
            </div>
          </Link>

          {/* Total Teams */}
          <Link
            href="/admin/teams"
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Teams</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalTeams}</p>
              </div>
              <div className="h-12 w-12 bg-teal-100 rounded-full flex items-center justify-center">
                <Building2 className="h-6 w-6 text-teal-600" />
              </div>
            </div>
          </Link>

          {/* Active Users */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Active Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeUsers}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.totalUsers > 0
                    ? `${Math.round((stats.activeUsers / stats.totalUsers) * 100)}% of total`
                    : "0%"}
                </p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          {/* Pending Leads */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Pending Leads</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pendingLeads}</p>
                <p className="text-xs text-yellow-600 mt-1">Requires attention</p>
              </div>
              <div className="h-12 w-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              href="/admin/users"
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow text-center"
            >
              <Users className="h-8 w-8 text-primary-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-900">Manage Users</p>
            </Link>
            <Link
              href="/admin/roles"
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow text-center"
            >
              <Shield className="h-8 w-8 text-primary-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-900">Roles & Permissions</p>
            </Link>
            <Link
              href="/admin/teams"
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow text-center"
            >
              <Building2 className="h-8 w-8 text-primary-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-900">Team Management</p>
            </Link>
            <Link
              href="/admin/leads"
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow text-center"
            >
              <Target className="h-8 w-8 text-primary-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-900">Leads Management</p>
            </Link>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Users */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Users className="h-5 w-5 text-primary-600" />
                Recent Users
              </h2>
              <Link
                href="/admin/users"
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                View All
              </Link>
            </div>
            {recentUsers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p>No users found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentUsers.map((user: any) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                        <UserCheck className="h-5 w-5 text-primary-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {user.employeeCode && `ID: ${user.employeeCode} • `}
                          {user.email}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {user.role?.name?.replace(/_/g, " ") || "No role"}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-md ${user.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-700"
                        }`}
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Leads */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Target className="h-5 w-5 text-primary-600" />
                Recent Leads
              </h2>
              <Link
                href="/dashboard/leads"
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                View All
              </Link>
            </div>
            {recentLeads.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Target className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p>No leads found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentLeads.map((lead: any) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-orange-100 rounded-full flex items-center justify-center">
                        <Target className="h-5 w-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {lead.firstName} {lead.lastName}
                        </p>
                        <p className="text-xs text-gray-500">{lead.email || lead.phone}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {lead.country || "No country"} • {lead.visaType || "No visa type"}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-md ${lead.status === "pending" || !lead.status
                        ? "bg-yellow-100 text-yellow-700"
                        : lead.status === "assigned"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-green-100 text-green-700"
                        }`}
                    >
                      {lead.status || "Pending"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
