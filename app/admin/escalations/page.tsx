"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpCircle,
  ArrowLeft,
  AlertCircle,
  Clock,
  User,
  Mail,
  Phone,
  Target,
  Calendar,
  TrendingUp,
  Filter,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { tabStorage } from "@/lib/storage";
import Link from "next/link";

interface EscalatedLead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country?: string;
  visaType?: string;
  status: string;
  priority?: "low" | "medium" | "high" | "urgent";
  nextFollowUpAt?: string;
  lastContactedAt?: string;
  assignedTo?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode?: string | null;
  } | null;
  createdAt: string;
  escalationReason: string[];
}

export default function EscalationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [escalatedLeads, setEscalatedLeads] = useState<EscalatedLead[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [stats, setStats] = useState({
    urgent: 0,
    overdue: 0,
    unassigned: 0,
    total: 0,
  });

  useEffect(() => {
    fetchEscalatedLeads();
  }, []);

  const fetchEscalatedLeads = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.getLeads() as any;
      const allLeads = response.leads || [];

      const now = new Date();
      const escalated: EscalatedLead[] = [];

      allLeads.forEach((lead: any) => {
        const reasons: string[] = [];

        // Check for urgent/high priority
        if (lead.priority === "urgent" || lead.priority === "high") {
          reasons.push(
            lead.priority === "urgent" ? "Urgent Priority" : "High Priority"
          );
        }

        // Check for overdue follow-ups
        if (lead.nextFollowUpAt) {
          const followUpDate = new Date(lead.nextFollowUpAt);
          if (followUpDate < now) {
            reasons.push("Overdue Follow-up");
          }
        }

        // Check for unassigned urgent leads
        if (!lead.assignedTo && (lead.priority === "urgent" || lead.priority === "high")) {
          reasons.push("Unassigned Urgent Lead");
        }

        if (reasons.length > 0) {
          escalated.push({
            ...lead,
            escalationReason: reasons,
          });
        }
      });

      // Sort by priority (urgent first) and then by overdue status
      escalated.sort((a, b) => {
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        const aPriority = priorityOrder[a.priority || "low"] || 3;
        const bPriority = priorityOrder[b.priority || "low"] || 3;

        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }

        // If same priority, sort by overdue status
        const aOverdue = a.escalationReason.includes("Overdue Follow-up") ? 0 : 1;
        const bOverdue = b.escalationReason.includes("Overdue Follow-up") ? 0 : 1;
        return aOverdue - bOverdue;
      });

      setEscalatedLeads(escalated);

      // Calculate stats
      setStats({
        urgent: escalated.filter((l) => l.priority === "urgent").length,
        overdue: escalated.filter((l) =>
          l.escalationReason.includes("Overdue Follow-up")
        ).length,
        unassigned: escalated.filter((l) =>
          l.escalationReason.includes("Unassigned Urgent Lead")
        ).length,
        total: escalated.length,
      });
    } catch (err: any) {
      console.error("Error fetching escalated leads:", err);
      if (err.status === 401 || err.status === 403) {
        tabStorage.removeItem("token");
        tabStorage.removeItem("user");
        router.push("/login");
        return;
      }
      setError(err.message || "Failed to load escalated leads");
    } finally {
      setLoading(false);
    }
  };

  const filteredLeads = escalatedLeads.filter((lead) => {
    if (filter === "all") return true;
    if (filter === "urgent") return lead.priority === "urgent";
    if (filter === "overdue") return lead.escalationReason.includes("Overdue Follow-up");
    if (filter === "unassigned") return lead.escalationReason.includes("Unassigned Urgent Lead");
    return true;
  });

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-700 border-red-200";
      case "high":
        return "bg-orange-100 text-orange-700 border-orange-200";
      case "medium":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "low":
        return "bg-blue-100 text-blue-700 border-blue-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDaysOverdue = (dateString?: string) => {
    if (!dateString) return 0;
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading escalations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-5 w-5" />
        <span>Back</span>
      </button>

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <ArrowUpCircle className="h-8 w-8 text-orange-600" />
            Escalations
          </h1>
          <p className="text-gray-600 mt-1">Leads requiring immediate attention</p>
        </div>
        <button
          onClick={fetchEscalatedLeads}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <RefreshCw className="h-5 w-5" />
          Refresh
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <p className="text-red-800">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto p-1 hover:bg-red-100 rounded"
          >
            <span className="text-red-600">×</span>
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Escalations</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
              <ArrowUpCircle className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Urgent Priority</p>
              <p className="text-2xl font-bold text-red-600">{stats.urgent}</p>
            </div>
            <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-orange-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Overdue Follow-ups</p>
              <p className="text-2xl font-bold text-orange-600">{stats.overdue}</p>
            </div>
            <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
              <Clock className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-yellow-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Unassigned Urgent</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.unassigned}</p>
            </div>
            <div className="h-12 w-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <User className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex items-center gap-4">
        <Filter className="h-5 w-5 text-gray-600" />
        <div className="flex gap-2">
          {[
            { value: "all", label: "All Escalations" },
            { value: "urgent", label: "Urgent Only" },
            { value: "overdue", label: "Overdue Follow-ups" },
            { value: "unassigned", label: "Unassigned" },
          ].map((filterOption) => (
            <button
              key={filterOption.value}
              onClick={() => setFilter(filterOption.value)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === filterOption.value
                  ? "bg-primary-600 text-white"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              }`}
            >
              {filterOption.label}
            </button>
          ))}
        </div>
      </div>

      {/* Escalated Leads List */}
      {filteredLeads.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <p className="text-gray-600 text-lg font-medium mb-2">
            No escalations found
          </p>
          <p className="text-gray-500 text-sm">
            {filter === "all"
              ? "All leads are being handled properly!"
              : "No leads match the selected filter."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Lead
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Escalation Reason
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Assigned To
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Follow-up Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {lead.firstName} {lead.lastName}
                        </div>
                        <div className="text-sm text-gray-500">{lead.email}</div>
                        <div className="text-xs text-gray-400">{lead.phone}</div>
                        {lead.country && (
                          <div className="text-xs text-gray-400 mt-1">
                            {lead.country} {lead.visaType && `• ${lead.visaType}`}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-md border ${getPriorityColor(
                          lead.priority
                        )}`}
                      >
                        {lead.priority?.toUpperCase() || "N/A"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {lead.escalationReason.map((reason, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-md"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {lead.assignedTo ? (
                        <div className="text-sm text-gray-900">
                          {lead.assignedTo.firstName} {lead.assignedTo.lastName}
                          {lead.assignedTo.employeeCode && (
                            <div className="text-xs text-gray-500">
                              {lead.assignedTo.employeeCode}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-yellow-600 font-medium">
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {lead.nextFollowUpAt ? (
                        <div>
                          <div className="text-sm text-gray-900">
                            {formatDate(lead.nextFollowUpAt)}
                          </div>
                          {lead.escalationReason.includes("Overdue Follow-up") && (
                            <div className="text-xs text-red-600 font-medium">
                              {getDaysOverdue(lead.nextFollowUpAt)} day(s) overdue
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Not set</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link
                        href={`/dashboard/leads/${lead.id}`}
                        className="text-primary-600 hover:text-primary-900 flex items-center gap-1"
                      >
                        View Lead
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
