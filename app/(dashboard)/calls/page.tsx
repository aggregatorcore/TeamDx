"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  User,
  Mail,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Smartphone,
  Calendar,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { tabStorage } from "@/lib/storage";
import TagSelector from "@/components/tags/TagSelector";

interface Call {
  id: string;
  leadId?: string;
  lead?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  phoneNumber: string;
  callType: "outgoing" | "incoming";
  status: "completed" | "missed" | "no_answer" | "busy" | "callback" | "ringing" | "connected" | "ended";
  duration?: number;
  notes?: string;
  callDate: string;
  startTime?: string;
  endTime?: string;
  deviceId?: string;
  initiatedFrom?: "web" | "mobile";
  autoCreatedLead?: boolean;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    employeeCode?: string;
  };
  createdAt: string;
}

const STATUS_COLORS = {
  completed: "bg-green-50 text-green-700 border-green-200",
  missed: "bg-red-50 text-red-700 border-red-200",
  no_answer: "bg-yellow-50 text-yellow-700 border-yellow-200",
  busy: "bg-orange-50 text-orange-700 border-orange-200",
  callback: "bg-blue-50 text-blue-700 border-blue-200",
  ringing: "bg-purple-50 text-purple-700 border-purple-200",
  // V2: connected removed - map to completed
  ended: "bg-gray-50 text-gray-700 border-gray-200",
};

const STATUS_LABELS = {
  completed: "Completed",
  missed: "Missed",
  no_answer: "No Answer",
  busy: "Busy",
  callback: "Callback",
  ringing: "Ringing",
  // V2: connected removed - map to completed
  ended: "Ended",
};

// V2: Helper function to map connected to completed
const getDisplayStatus = (status: string): string => {
  return status === 'connected' ? 'completed' : status;
};

const CALL_TYPE_ICONS = {
  outgoing: PhoneOutgoing,
  incoming: PhoneIncoming,
};

export default function CallsPage() {
  const router = useRouter();
  const [calls, setCalls] = useState<Call[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"all" | "incoming" | "outgoing">("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<"all" | "mobile" | "web">("all");
  const [sortBy, setSortBy] = useState<"date" | "duration">("date");
  const [showFilters, setShowFilters] = useState(false);
  const [deletingCallId, setDeletingCallId] = useState<string | null>(null);
  
  // Tags state for each call
  const [callTags, setCallTags] = useState<Record<string, Array<{
    id: string;
    tagId: string;
    tag: any;
    appliedAt: string;
  }>>>({});
  const [stats, setStats] = useState({
    total: 0,
    incoming: 0,
    outgoing: 0,
    mobile: 0,
    web: 0,
    avgDuration: 0,
  });

  useEffect(() => {
    fetchCalls();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchCalls, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    calculateStats();
  }, [calls]);

  const fetchCalls = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("[Calls Page] Fetching calls...");
      const response = await apiClient.getCalls();
      console.log("[Calls Page] Received response:", {
        callsCount: response.calls?.length || 0,
        hasCalls: !!response.calls,
      });
      setCalls(response.calls || []);
      if (!response.calls || response.calls.length === 0) {
        console.log("[Calls Page] No calls found in response");
      }
    } catch (err: any) {
      console.error("[Calls Page] Error fetching calls:", err);
      setError(err.message || "Failed to fetch calls. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const total = calls.length;
    const incoming = calls.filter((c) => c.callType === "incoming").length;
    const outgoing = calls.filter((c) => c.callType === "outgoing").length;
    const mobile = calls.filter((c) => c.initiatedFrom === "mobile").length;
    const web = calls.filter((c) => c.initiatedFrom === "web" || !c.initiatedFrom).length;
    
    const callsWithDuration = calls.filter((c) => c.duration && c.duration > 0);
    const avgDuration = callsWithDuration.length > 0
      ? Math.round(callsWithDuration.reduce((sum, c) => sum + (c.duration || 0), 0) / callsWithDuration.length)
      : 0;

    setStats({ total, incoming, outgoing, mobile, web, avgDuration });
  };

  const handleDeleteCall = async (id: string) => {
    if (!confirm("Are you sure you want to delete this call?")) {
      return;
    }
    setDeletingCallId(id);
    try {
      await apiClient.deleteCall(id);
      await fetchCalls();
    } catch (err: any) {
      setError(err.message || "Failed to delete call");
    } finally {
      setDeletingCallId(null);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // FIX 2: UTC to Local Time Conversion
  const formatDateTime = (dateString: string) => {
    // FIX: Parse UTC timestamp and convert to local time
    // Backend sends UTC timestamps (ISO 8601 format)
    const date = new Date(dateString); // Automatically parses UTC if ISO 8601 format
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return `Today ${date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday ${date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
    } else {
      return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  };

  const filteredAndSortedCalls = calls
    .filter((call) => {
      const matchesSearch =
        call.phoneNumber.includes(searchTerm) ||
        (call.lead && `${call.lead.firstName} ${call.lead.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())) ||
        call.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        call.createdBy.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        call.createdBy.lastName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType = filterType === "all" || call.callType === filterType;
      // V2: Map connected to completed for filtering
      const displayStatus = getDisplayStatus(call.status);
      const matchesStatus = filterStatus === "all" || displayStatus === filterStatus;
      const matchesSource = filterSource === "all" || call.initiatedFrom === filterSource || (filterSource === "web" && !call.initiatedFrom);

      return matchesSearch && matchesType && matchesStatus && matchesSource;
    })
    .sort((a, b) => {
      if (sortBy === "duration") {
        return (b.duration || 0) - (a.duration || 0);
      }
      return new Date(b.callDate).getTime() - new Date(a.callDate).getTime();
    });

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 flex items-center justify-center h-full min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading calls...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                <Phone className="h-7 w-7 md:h-8 md:w-8 text-primary-600" />
                Calls Management
              </h1>
              <p className="text-sm md:text-base text-gray-600">Track and manage all call activities</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchCalls}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                <Filter className="h-4 w-4" />
                Filters
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Total Calls</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <Phone className="h-8 w-8 text-primary-600 opacity-20" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Incoming</p>
                  <p className="text-2xl font-bold text-green-600">{stats.incoming}</p>
                </div>
                <PhoneIncoming className="h-8 w-8 text-green-600 opacity-20" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Outgoing</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.outgoing}</p>
                </div>
                <PhoneOutgoing className="h-8 w-8 text-blue-600 opacity-20" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Mobile</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.mobile}</p>
                </div>
                <Smartphone className="h-8 w-8 text-purple-600 opacity-20" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Web</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.web}</p>
                </div>
                <PhoneCall className="h-8 w-8 text-orange-600 opacity-20" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Avg Duration</p>
                  <p className="text-2xl font-bold text-gray-900">{formatDuration(stats.avgDuration)}</p>
                </div>
                <Clock className="h-8 w-8 text-gray-600 opacity-20" />
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-800 font-medium mb-1">Error loading calls</p>
                <p className="text-red-700 text-sm">{error}</p>
                <button
                  onClick={fetchCalls}
                  className="mt-3 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        {showFilters && (
          <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Call Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                >
                  <option value="all">All Types</option>
                  <option value="incoming">Incoming</option>
                  <option value="outgoing">Outgoing</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="completed">Completed</option>
                  <option value="missed">Missed</option>
                  <option value="no_answer">No Answer</option>
                  <option value="busy">Busy</option>
                  <option value="callback">Callback</option>
                  <option value="ringing">Ringing</option>
                  {/* V2: connected removed - map to completed */}
                  <option value="ended">Ended</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                <select
                  value={filterSource}
                  onChange={(e) => setFilterSource(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                >
                  <option value="all">All Sources</option>
                  <option value="mobile">Mobile App</option>
                  <option value="web">Web App</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                >
                  <option value="date">Date (Newest)</option>
                  <option value="duration">Duration (Longest)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-md md:max-w-lg lg:max-w-xl">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by phone, lead name, user, or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm md:text-base"
            />
          </div>
        </div>

        {/* Calls Count */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Showing <span className="font-semibold text-gray-900">{filteredAndSortedCalls.length}</span> of{" "}
            <span className="font-semibold text-gray-900">{calls.length}</span> calls
          </p>
        </div>

        {/* Calls List */}
        {filteredAndSortedCalls.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Phone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg font-medium mb-2">No calls found</p>
            <p className="text-gray-500 text-sm mb-4">
              {searchTerm || filterType !== "all" || filterStatus !== "all" || filterSource !== "all"
                ? "Try adjusting your filters or search term"
                : calls.length === 0
                ? "No calls have been logged yet. Calls will appear here when logged from mobile or web app."
                : "No calls match your current filters. Try adjusting your search criteria."}
            </p>
            {calls.length === 0 && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-left max-w-md mx-auto">
                <p className="text-sm text-blue-800 font-medium mb-2">💡 Tips:</p>
                <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                  <li>Make sure mobile app is connected and making calls</li>
                  <li>Calls are automatically logged when made from mobile app</li>
                  <li>Check if calls are being created in the database</li>
                  <li>Verify your user role has permission to view calls</li>
                </ul>
              </div>
            )}
            <button
              onClick={fetchCalls}
              className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
            >
              <RefreshCw className="h-4 w-4 inline mr-2" />
              Refresh Calls
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAndSortedCalls.map((call) => {
              const CallTypeIcon = CALL_TYPE_ICONS[call.callType];
              return (
                <div
                  key={call.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-5 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div
                        className={`h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                          call.callType === "incoming" ? "bg-green-100" : "bg-blue-100"
                        }`}
                      >
                        <CallTypeIcon
                          className={`h-6 w-6 ${call.callType === "incoming" ? "text-green-600" : "text-blue-600"}`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="text-base md:text-lg font-semibold text-gray-900 truncate">
                            {call.lead ? `${call.lead.firstName} ${call.lead.lastName}` : call.phoneNumber}
                          </h3>
                          <span
                            className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-md border ${STATUS_COLORS[getDisplayStatus(call.status)] || STATUS_COLORS.completed}`}
                          >
                            {STATUS_LABELS[getDisplayStatus(call.status)] || getDisplayStatus(call.status)}
                          </span>
                          {call.initiatedFrom === "mobile" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                              <Smartphone className="h-3 w-3" />
                              Mobile
                            </span>
                          )}
                          {call.autoCreatedLead && (
                            <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-md bg-yellow-50 text-yellow-700 border border-yellow-200">
                              Auto Lead
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          {call.callType === "outgoing" ? "Outgoing" : "Incoming"} call
                          {call.deviceId && ` • Device: ${call.deviceId.substring(0, 8)}...`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteCall(call.id)}
                      disabled={deletingCallId === call.id}
                      className="text-red-600 hover:text-red-900 p-1 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                      title="Delete call"
                    >
                      {deletingCallId === call.id ? (
                        <RefreshCw className="h-5 w-5 animate-spin" />
                      ) : (
                        <Trash2 className="h-5 w-5" />
                      )}
                    </button>
                  </div>

                  <div className="space-y-2 mb-4 pl-15">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="h-4 w-4 flex-shrink-0 text-gray-400" />
                      <span className="font-mono">{call.phoneNumber}</span>
                    </div>
                    {call.lead && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="h-4 w-4 flex-shrink-0 text-gray-400" />
                        <span>{call.lead.email || "No email"}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 flex-shrink-0 text-gray-400" />
                        <span>{formatDateTime(call.callDate)}</span>
                      </div>
                      {call.startTime && (
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 flex-shrink-0 text-gray-400" />
                          <span>Start: {formatDateTime(call.startTime)}</span>
                        </div>
                      )}
                      {call.endTime && (
                        <div className="flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 flex-shrink-0 text-gray-400" />
                          <span>End: {formatDateTime(call.endTime)}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 flex-shrink-0 text-gray-400" />
                        <span className="font-semibold">Duration: {formatDuration(call.duration)}</span>
                      </div>
                    </div>
                    {call.notes && (
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm text-gray-700 border border-gray-200">
                        <p className="font-medium mb-1">Notes:</p>
                        <p>{call.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Tags Section */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <TagSelector
                      entityType="call"
                      entityId={call.id}
                      currentTags={callTags[call.id] || []}
                      onTagApplied={async () => {
                        try {
                          const tagsResponse = await apiClient.getCallTags(call.id);
                          setCallTags(prev => ({
                            ...prev,
                            [call.id]: tagsResponse.tagApplications || []
                          }));
                        } catch (err) {
                          console.error("Error fetching call tags:", err);
                        }
                      }}
                      onTagRemoved={async () => {
                        try {
                          const tagsResponse = await apiClient.getCallTags(call.id);
                          setCallTags(prev => ({
                            ...prev,
                            [call.id]: tagsResponse.tagApplications || []
                          }));
                        } catch (err) {
                          console.error("Error fetching call tags:", err);
                        }
                      }}
                      category="call_status"
                      appliesTo="call"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <User className="h-3 w-3" />
                      <span>
                        {call.createdBy.firstName} {call.createdBy.lastName}
                        {call.createdBy.employeeCode && ` (${call.createdBy.employeeCode})`}
                      </span>
                    </div>
                    {call.lead && (
                      <button
                        onClick={() => router.push(`/dashboard/leads/${call.leadId}`)}
                        className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                      >
                        View Lead →
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
