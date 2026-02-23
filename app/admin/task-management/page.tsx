"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Users,
  Clock,
  Play,
  Pause,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Coffee,
  Power,
  RefreshCw,
  Filter,
  Search,
  Eye,
  AlertTriangle,
  TrendingUp,
  Activity,
  Timer,
  UserCheck,
  Ban,
  PlayCircle,
  PauseCircle,
} from "lucide-react";
import { apiClient } from "@/lib/api";

// ==================== TYPES & INTERFACES ====================

type UserStatus = "available" | "ready" | "processing" | "interval" | "break" | "offline";

interface UserTaskStatus {
  userId: string;
  userName: string;
  role: string;
  status: UserStatus;
  currentLeadId?: string;
  currentLeadName?: string;
  taskStartTime?: string;
  runningDuration?: number; // seconds
  intervalRemaining?: number; // seconds
  intervalDuration?: number; // seconds
  breakStartTime?: string;
  breakDuration?: number; // seconds
  readyTime?: string;
  lastActivity?: string;
  idleTime?: number; // seconds
  stage?: string;
  sessionId?: string;
  sessionStartTime?: string;
  totalWorkTime?: number; // seconds
  totalBreakTime?: number; // seconds
  breaks?: Array<{
    id: string;
    breakType: string;
    startTime: string;
    endTime?: string;
    duration?: number;
    reason?: string;
  }>;
}

interface ActivityEvent {
  id: string;
  userId: string;
  userName: string;
  eventType: "login" | "ready" | "task_start" | "task_end" | "interval_start" | "interval_end" | "break_start" | "break_end" | "logout";
  timestamp: string;
  details?: string;
}

interface Alert {
  id: string;
  type: "warning" | "error" | "info";
  message: string;
  userId?: string;
  timestamp: string;
}

// ==================== STATUS CONFIG ====================

const STATUS_CONFIG: Record<UserStatus, { label: string; color: string; icon: any; bgColor: string }> = {
  available: {
    label: "Available",
    color: "text-green-700",
    bgColor: "bg-green-50 border-green-200",
    icon: CheckCircle2,
  },
  ready: {
    label: "Ready",
    color: "text-blue-700",
    bgColor: "bg-blue-50 border-blue-200",
    icon: PlayCircle,
  },
  processing: {
    label: "Processing",
    color: "text-orange-700",
    bgColor: "bg-orange-50 border-orange-200",
    icon: Activity,
  },
  interval: {
    label: "Interval",
    color: "text-yellow-700",
    bgColor: "bg-yellow-50 border-yellow-200",
    icon: Timer,
  },
  break: {
    label: "On Break",
    color: "text-red-700",
    bgColor: "bg-red-50 border-red-200",
    icon: Coffee,
  },
  offline: {
    label: "Offline",
    color: "text-gray-700",
    bgColor: "bg-gray-50 border-gray-200",
    icon: XCircle,
  },
};

// ==================== MAIN COMPONENT ====================

export default function TaskManagementPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserTaskStatus[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000); // 5 seconds
  const [filterStatus, setFilterStatus] = useState<UserStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  // Fetch user statuses
  const fetchUserStatuses = async () => {
    try {
      // TODO: Replace with actual API call
      // const response = await apiClient.getUserTaskStatuses();
      // setUsers(response.users);
      
      // Mock data for now
      const mockUsers: UserTaskStatus[] = [
        {
          userId: "1",
          userName: "John Doe",
          role: "TELECALLER",
          status: "processing",
          currentLeadId: "123",
          currentLeadName: "Lead #123",
          taskStartTime: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
          runningDuration: 120,
          stage: "Calling",
        },
        {
          userId: "2",
          userName: "Jane Smith",
          role: "TELECALLER",
          status: "interval",
          intervalRemaining: 240,
          intervalDuration: 300,
        },
        {
          userId: "3",
          userName: "Bob Wilson",
          role: "COUNSELOR",
          status: "available",
        },
        {
          userId: "4",
          userName: "Alice Brown",
          role: "TELECALLER",
          status: "break",
          breakStartTime: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          breakDuration: 300,
        },
      ];
      setUsers(mockUsers);
    } catch (error) {
      console.error("Error fetching user statuses:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch activities
  const fetchActivities = async () => {
    try {
      // TODO: Replace with actual API call
      // const response = await apiClient.getUserActivities();
      // setActivities(response.activities);
    } catch (error) {
      console.error("Error fetching activities:", error);
    }
  };

  // Check for alerts
  const checkAlerts = () => {
    const newAlerts: Alert[] = [];
    
    users.forEach((user) => {
      // Stuck in Processing
      if (user.status === "processing" && user.runningDuration && user.runningDuration > 30 * 60) {
        newAlerts.push({
          id: `stuck-${user.userId}`,
          type: "warning",
          message: `${user.userName} stuck in Processing for ${Math.floor(user.runningDuration / 60)} minutes`,
          userId: user.userId,
          timestamp: new Date().toISOString(),
        });
      }
      
      // Long Break
      if (user.status === "break" && user.breakDuration && user.breakDuration > 15 * 60) {
        newAlerts.push({
          id: `long-break-${user.userId}`,
          type: "warning",
          message: `${user.userName} on break for ${Math.floor(user.breakDuration / 60)} minutes`,
          userId: user.userId,
          timestamp: new Date().toISOString(),
        });
      }
    });
    
    // Too many Available
    const availableCount = users.filter(u => u.status === "available").length;
    if (availableCount > 5) {
      newAlerts.push({
        id: "many-available",
        type: "info",
        message: `${availableCount} users are Available - no tasks assigned`,
        timestamp: new Date().toISOString(),
      });
    }
    
    setAlerts(newAlerts);
  };

  // Initial load
  useEffect(() => {
    fetchUserStatuses();
    fetchActivities();
  }, []);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      fetchUserStatuses();
      fetchActivities();
      checkAlerts();
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  // Update running durations in real-time
  useEffect(() => {
    const interval = setInterval(() => {
      setUsers((prevUsers) =>
        prevUsers.map((user) => {
          const updated = { ...user };
          
          if (user.status === "processing" && user.taskStartTime) {
            const start = new Date(user.taskStartTime).getTime();
            updated.runningDuration = Math.floor((Date.now() - start) / 1000);
          }
          
          if (user.status === "interval" && user.intervalRemaining) {
            updated.intervalRemaining = Math.max(0, user.intervalRemaining - 1);
          }
          
          if (user.status === "break" && user.breakStartTime) {
            const start = new Date(user.breakStartTime).getTime();
            updated.breakDuration = Math.floor((Date.now() - start) / 1000);
          }
          
          if (user.status === "available" && user.lastActivity) {
            const last = new Date(user.lastActivity).getTime();
            updated.idleTime = Math.floor((Date.now() - last) / 1000);
          }
          
          return updated;
        })
      );
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Format time
  const formatTime = (seconds?: number): string => {
    if (!seconds) return "--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Filter users
  const filteredUsers = users.filter((user) => {
    if (filterStatus !== "all" && user.status !== filterStatus) return false;
    if (searchQuery && !user.userName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Force control actions
  const handleForceAction = async (userId: string, action: string) => {
    if (!confirm(`Are you sure you want to ${action} for this user?`)) return;
    
    try {
      // TODO: Replace with actual API call
      // await apiClient.forceUserAction(userId, action);
      alert(`Action ${action} executed for user`);
      fetchUserStatuses();
    } catch (error) {
      console.error("Error executing force action:", error);
      alert("Failed to execute action");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back</span>
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="h-8 w-8 text-primary-600" />
              Task Management
            </h1>
            <p className="text-gray-600 mt-1">Real-time monitoring of user tasks and activities</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                autoRefresh
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {autoRefresh ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {autoRefresh ? "Auto Refresh ON" : "Auto Refresh OFF"}
            </button>
            <button
              onClick={() => {
                fetchUserStatuses();
                fetchActivities();
                checkAlerts();
              }}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 rounded-lg border flex items-center gap-3 ${
                alert.type === "error"
                  ? "bg-red-50 border-red-200 text-red-800"
                  : alert.type === "warning"
                  ? "bg-yellow-50 border-yellow-200 text-yellow-800"
                  : "bg-blue-50 border-blue-200 text-blue-800"
              }`}
            >
              {alert.type === "error" ? (
                <AlertCircle className="h-5 w-5" />
              ) : alert.type === "warning" ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
              <span className="flex-1">{alert.message}</span>
              <button
                onClick={() => setAlerts(alerts.filter((a) => a.id !== alert.id))}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-gray-500" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as UserStatus | "all")}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="all">All Status</option>
            <option value="available">Available</option>
            <option value="ready">Ready</option>
            <option value="processing">Processing</option>
            <option value="interval">Interval</option>
            <option value="break">On Break</option>
            <option value="offline">Offline</option>
          </select>
        </div>

        <div className="flex items-center gap-2 flex-1 max-w-md">
          <Search className="h-5 w-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <div className="text-sm text-gray-600">
          Total: {filteredUsers.length} user(s)
        </div>
      </div>

      {/* Live Board Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Lead
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Stage
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const statusConfig = STATUS_CONFIG[user.status];
                  const StatusIcon = statusConfig.icon;

                  return (
                    <tr
                      key={user.userId}
                      className={`hover:bg-gray-50 ${
                        selectedUser === user.userId ? "bg-blue-50" : ""
                      }`}
                      onClick={() => setSelectedUser(selectedUser === user.userId ? null : user.userId)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                            <span className="text-primary-700 font-semibold">
                              {user.userName
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{user.userName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${statusConfig.bgColor} ${statusConfig.color}`}
                        >
                          <StatusIcon className="h-4 w-4" />
                          <span className="text-sm font-medium">{statusConfig.label}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.currentLeadName ? (
                          <div>
                            <div className="text-sm font-medium text-gray-900">{user.currentLeadName}</div>
                            {user.currentLeadId && (
                              <div className="text-xs text-gray-500">ID: {user.currentLeadId}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.stage ? (
                          <span className="text-sm text-gray-700">{user.stage}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 space-y-1">
                          {user.totalWorkTime !== undefined && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4 text-green-600" />
                              <span className="font-mono text-green-700">Work: {formatTime(user.totalWorkTime)}</span>
                            </div>
                          )}
                          {user.totalBreakTime !== undefined && user.totalBreakTime > 0 && (
                            <div className="flex items-center gap-1">
                              <Coffee className="h-4 w-4 text-yellow-600" />
                              <span className="font-mono text-yellow-700">Break: {formatTime(user.totalBreakTime)}</span>
                            </div>
                          )}
                          {user.status === "processing" && user.runningDuration && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4 text-orange-600" />
                              <span className="font-mono text-xs">Task: {formatTime(user.runningDuration)}</span>
                            </div>
                          )}
                          {user.status === "interval" && user.intervalRemaining && (
                            <div className="flex items-center gap-1">
                              <Timer className="h-4 w-4 text-yellow-600" />
                              <span className="font-mono text-xs">Interval: {formatTime(user.intervalRemaining)}</span>
                            </div>
                          )}
                          {user.status === "break" && user.breakDuration && (
                            <div className="flex items-center gap-1">
                              <Coffee className="h-4 w-4 text-red-600" />
                              <span className="font-mono text-xs text-red-700">Current: {formatTime(user.breakDuration)}</span>
                            </div>
                          )}
                          {!user.totalWorkTime && !["processing", "interval", "break"].includes(user.status) && (
                            <span className="text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedUser(user.userId);
                            }}
                            className="p-1.5 text-primary-600 hover:bg-primary-50 rounded"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {user.status !== "offline" && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleForceAction(user.userId, "force_available");
                                }}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                                title="Force Available"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </button>
                              {user.status === "processing" && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleForceAction(user.userId, "force_close_task");
                                  }}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                  title="Force Close Task"
                                >
                                  <XCircle className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleForceAction(user.userId, user.status === "break" ? "force_break_off" : "force_break_on");
                                }}
                                className="p-1.5 text-orange-600 hover:bg-orange-50 rounded"
                                title={user.status === "break" ? "Force Break OFF" : "Force Break ON"}
                              >
                                <Coffee className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Details Panel (when selected) */}
      {selectedUser && (
        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Login Records & Break Details</h3>
            <button
              onClick={() => setSelectedUser(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>
          
          {(() => {
            const user = users.find((u) => u.userId === selectedUser);
            if (!user) return null;

            return (
              <div className="space-y-6">
                {/* Session Summary */}
                {user.sessionId && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Session Summary</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-xs text-gray-600 mb-1">Session Start</div>
                        <div className="text-sm font-medium text-gray-900">
                          {user.sessionStartTime ? new Date(user.sessionStartTime).toLocaleString() : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-600 mb-1">Total Work Time</div>
                        <div className="text-sm font-medium text-green-700">
                          {user.totalWorkTime ? formatTime(user.totalWorkTime) : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-600 mb-1">Total Break Time</div>
                        <div className="text-sm font-medium text-yellow-700">
                          {user.totalBreakTime ? formatTime(user.totalBreakTime) : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-600 mb-1">Total Breaks</div>
                        <div className="text-sm font-medium text-gray-900">
                          {user.breaks ? user.breaks.length : 0}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Break Records */}
                {user.breaks && user.breaks.length > 0 ? (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Break Records</h4>
                    <div className="space-y-2">
                      {user.breaks.map((breakRecord) => (
                        <div
                          key={breakRecord.id}
                          className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Coffee className="h-4 w-4 text-yellow-600" />
                              <span className="font-medium text-gray-900 capitalize">
                                {breakRecord.breakType.replace(/_/g, " ")}
                              </span>
                            </div>
                            {breakRecord.duration && (
                              <span className="text-sm font-mono text-gray-700">
                                {formatTime(breakRecord.duration)}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-600 space-y-1">
                            <div>
                              <strong>Start:</strong> {new Date(breakRecord.startTime).toLocaleString()}
                            </div>
                            {breakRecord.endTime && (
                              <div>
                                <strong>End:</strong> {new Date(breakRecord.endTime).toLocaleString()}
                              </div>
                            )}
                            {!breakRecord.endTime && (
                              <div className="text-yellow-600 font-medium">Ongoing</div>
                            )}
                            {breakRecord.reason && (
                              <div>
                                <strong>Reason:</strong> {breakRecord.reason}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8 bg-gray-50 rounded-lg">
                    No breaks recorded
                  </div>
                )}

                {/* Activity Timeline */}
                {activities.filter((a) => a.userId === selectedUser).length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Activity Timeline</h4>
                    <div className="space-y-2">
                      {activities
                        .filter((a) => a.userId === selectedUser)
                        .map((activity) => (
                          <div
                            key={activity.id}
                            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                          >
                            <div className="flex-shrink-0">
                              <Clock className="h-4 w-4 text-gray-500" />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">
                                {activity.eventType.replace(/_/g, " ").toUpperCase()}
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(activity.timestamp).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

