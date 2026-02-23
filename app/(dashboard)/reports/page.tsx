"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { tabStorage } from "@/lib/storage";
import {
  Users,
  Target,
  Phone,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  BarChart3,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import Link from "next/link";

interface TeamStats {
  totalTeamMembers: number;
  totalLeads: number;
  totalCalls: number;
  conversionRate: number;
  avgCallDuration: number;
  leadsByStatus: {
    new: number;
    contacted: number;
    qualified: number;
    converted: number;
    lost: number;
  };
  callsByStatus: {
    completed: number;
    missed: number;
    no_answer: number;
    busy: number;
    callback: number;
  };
}

interface MemberPerformance {
  id: string;
  name: string;
  email: string;
  role: string;
  totalLeads: number;
  convertedLeads: number;
  conversionRate: string;
  totalCalls: number;
  completedCalls: number;
  totalCallDuration: number;
}

interface DailyStat {
  date: string;
  leads: number;
  calls: number;
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [memberPerformance, setMemberPerformance] = useState<MemberPerformance[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.getTeamLeaderReports();
      setTeamStats(data.teamStats);
      setMemberPerformance(data.memberPerformance);
      setDailyStats(data.dailyStats);
    } catch (err: any) {
      console.error("Error fetching reports:", err);
      setError(err.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading reports...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <button
            onClick={fetchReports}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!teamStats) {
    return null;
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/dashboard"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            Team Reports
          </h1>
          <p className="text-gray-600">View your team's performance and statistics</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-2xl font-bold text-gray-900">
              {teamStats.totalTeamMembers}
            </span>
          </div>
          <p className="text-sm text-gray-600">Team Members</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <Target className="h-6 w-6 text-green-600" />
            </div>
            <span className="text-2xl font-bold text-gray-900">
              {teamStats.totalLeads}
            </span>
          </div>
          <p className="text-sm text-gray-600">Total Leads</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Phone className="h-6 w-6 text-purple-600" />
            </div>
            <span className="text-2xl font-bold text-gray-900">
              {teamStats.totalCalls}
            </span>
          </div>
          <p className="text-sm text-gray-600">Total Calls</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-orange-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-orange-600" />
            </div>
            <span className="text-2xl font-bold text-gray-900">
              {teamStats.conversionRate}%
            </span>
          </div>
          <p className="text-sm text-gray-600">Conversion Rate</p>
        </div>
      </div>

      {/* Leads Status Breakdown */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Leads by Status
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 mb-1">
              {teamStats.leadsByStatus.new}
            </div>
            <div className="text-sm text-gray-600">New</div>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600 mb-1">
              {teamStats.leadsByStatus.contacted}
            </div>
            <div className="text-sm text-gray-600">Contacted</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600 mb-1">
              {teamStats.leadsByStatus.qualified}
            </div>
            <div className="text-sm text-gray-600">Qualified</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600 mb-1">
              {teamStats.leadsByStatus.converted}
            </div>
            <div className="text-sm text-gray-600">Converted</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600 mb-1">
              {teamStats.leadsByStatus.lost}
            </div>
            <div className="text-sm text-gray-600">Lost</div>
          </div>
        </div>
      </div>

      {/* Calls Status Breakdown */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Calls by Status
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-green-600 mb-1">
              {teamStats.callsByStatus.completed}
            </div>
            <div className="text-sm text-gray-600">Completed</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <XCircle className="h-6 w-6 text-red-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-red-600 mb-1">
              {teamStats.callsByStatus.missed}
            </div>
            <div className="text-sm text-gray-600">Missed</div>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <AlertCircle className="h-6 w-6 text-yellow-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-yellow-600 mb-1">
              {teamStats.callsByStatus.no_answer}
            </div>
            <div className="text-sm text-gray-600">No Answer</div>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <Phone className="h-6 w-6 text-orange-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-orange-600 mb-1">
              {teamStats.callsByStatus.busy}
            </div>
            <div className="text-sm text-gray-600">Busy</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <Clock className="h-6 w-6 text-blue-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-blue-600 mb-1">
              {teamStats.callsByStatus.callback}
            </div>
            <div className="text-sm text-gray-600">Callback</div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Average Call Duration</span>
            <span className="text-lg font-semibold text-gray-900">
              {formatDuration(teamStats.avgCallDuration)}
            </span>
          </div>
        </div>
      </div>

      {/* Team Member Performance */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Users className="h-5 w-5" />
          Team Member Performance
        </h2>
        {memberPerformance.length === 0 ? (
          <p className="text-gray-600 text-center py-8">No team members assigned yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Member</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Leads</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Converted</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Conversion</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Calls</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Completed</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Call Time</th>
                </tr>
              </thead>
              <tbody>
                {memberPerformance.map((member) => (
                  <tr key={member.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div>
                        <div className="font-medium text-gray-900">{member.name}</div>
                        <div className="text-sm text-gray-500">{member.email}</div>
                        <div className="text-xs text-gray-400 mt-1">{member.role}</div>
                      </div>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className="font-semibold text-gray-900">{member.totalLeads}</span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className="font-semibold text-green-600">
                        {member.convertedLeads}
                      </span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className="font-semibold text-blue-600">
                        {member.conversionRate}%
                      </span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className="font-semibold text-gray-900">{member.totalCalls}</span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className="font-semibold text-green-600">
                        {member.completedCalls}
                      </span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className="text-gray-600">
                        {formatDuration(member.totalCallDuration)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Daily Statistics */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Last 7 Days Activity
        </h2>
        {dailyStats.length === 0 ? (
          <p className="text-gray-600 text-center py-8">No activity data available</p>
        ) : (
          <div className="space-y-4">
            {dailyStats.map((stat, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="w-24 text-sm text-gray-600 font-medium">
                  {formatDate(stat.date)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
                      <div
                        className="bg-blue-500 h-6 rounded-full flex items-center justify-end pr-2"
                        style={{
                          width: `${Math.min((stat.leads / Math.max(...dailyStats.map((s) => s.leads))) * 100, 100)}%`,
                        }}
                      >
                        {stat.leads > 0 && (
                          <span className="text-xs text-white font-medium">{stat.leads}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-sm text-gray-600 w-12 text-right">Leads</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
                      <div
                        className="bg-purple-500 h-6 rounded-full flex items-center justify-end pr-2"
                        style={{
                          width: `${Math.min((stat.calls / Math.max(...dailyStats.map((s) => s.calls || 1)) || 1) * 100, 100)}%`,
                        }}
                      >
                        {stat.calls > 0 && (
                          <span className="text-xs text-white font-medium">{stat.calls}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-sm text-gray-600 w-12 text-right">Calls</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
