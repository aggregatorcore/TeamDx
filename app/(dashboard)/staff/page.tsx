"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  UserCheck,
  Users,
  Calendar,
  Clock,
  FileText,
  TrendingUp,
  Plus,
  Edit,
  CheckCircle2,
  X as XIcon,
  AlertCircle,
  Search,
  Filter,
  Download,
  RefreshCw,
  User,
  Mail,
  Phone,
  Briefcase,
  Award,
  CalendarDays,
  Ban,
  Check,
  X,
} from "lucide-react";
import { apiClient } from "@/lib/api";

interface StaffMember {
  id: string;
  employeeCode?: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  role: {
    id: string;
    name: string;
    description: string | null;
  };
  teamLeader: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  _count: {
    attendanceRecords: number;
    leaveRequests: number;
    performanceReviews: number;
  };
  createdAt: string;
}

interface Attendance {
  id: string;
  userId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: "present" | "absent" | "late" | "half_day" | "on_leave";
  workHours: number | null;
  notes: string | null;
}

interface LeaveRequest {
  id: string;
  userId: string;
  user: {
    id: string;
    employeeCode?: string | null;
    firstName: string;
    lastName: string;
    email: string;
    role: {
      name: string;
    };
  };
  leaveType: "casual" | "sick" | "annual" | "emergency" | "unpaid";
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  approvedBy: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

interface PerformanceReview {
  id: string;
  userId: string;
  user: {
    id: string;
    employeeCode?: string | null;
    firstName: string;
    lastName: string;
    email: string;
    role: {
      name: string;
    };
  };
  reviewPeriod: string;
  reviewDate: string;
  reviewedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  rating: number;
  goals: string | null;
  achievements: string | null;
  areasForImprovement: string | null;
  comments: string | null;
  nextReviewDate: string | null;
  createdAt: string;
}

type TabType = "staff" | "attendance" | "leave" | "performance";

const LEAVE_TYPE_COLORS = {
  casual: "bg-blue-100 text-blue-700",
  sick: "bg-red-100 text-red-700",
  annual: "bg-green-100 text-green-700",
  emergency: "bg-orange-100 text-orange-700",
  unpaid: "bg-gray-100 text-gray-700",
};

const LEAVE_TYPE_LABELS = {
  casual: "Casual",
  sick: "Sick",
  annual: "Annual",
  emergency: "Emergency",
  unpaid: "Unpaid",
};

const STATUS_COLORS = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-700",
};

export default function StaffPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("staff");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Staff data
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Attendance data
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [selectedUserForAttendance, setSelectedUserForAttendance] = useState<string>("");
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split("T")[0]);

  // Leave data
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveStatusFilter, setLeaveStatusFilter] = useState<string>("all");
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showLeaveApprovalModal, setShowLeaveApprovalModal] = useState(false);
  const [selectedLeaveRequest, setSelectedLeaveRequest] = useState<LeaveRequest | null>(null);

  // Performance data
  const [performanceReviews, setPerformanceReviews] = useState<PerformanceReview[]>([]);
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);

  useEffect(() => {
    fetchStaff();
  }, []);

  useEffect(() => {
    if (activeTab === "attendance" && selectedUserForAttendance) {
      fetchAttendance();
    } else if (activeTab === "leave") {
      fetchLeaveRequests();
    } else if (activeTab === "performance") {
      fetchPerformanceReviews();
    }
  }, [activeTab, selectedUserForAttendance]);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (statusFilter !== "all") {
        params.status = statusFilter;
      }
      if (roleFilter !== "all") {
        params.role = roleFilter;
      }
      const response = await apiClient.getStaff(params);
      setStaff(response.staff || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch staff");
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendance = async () => {
    try {
      setError(null);
      const response = await apiClient.getStaffAttendance(selectedUserForAttendance || "all", {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        endDate: new Date().toISOString().split("T")[0],
      });
      setAttendance(response.attendance || []);
    } catch (err: any) {
      console.error("Failed to fetch attendance:", err);
      // Don't show error if it's just empty data
      if (err.message && !err.message.includes("not found")) {
        setError(err.message || "Failed to fetch attendance");
      } else {
        setAttendance([]);
      }
    }
  };

  const fetchLeaveRequests = async () => {
    try {
      setError(null);
      const params: any = {};
      if (leaveStatusFilter !== "all") {
        params.status = leaveStatusFilter;
      }
      const response = await apiClient.getLeaveRequests(params);
      setLeaveRequests(response.leaveRequests || []);
    } catch (err: any) {
      console.error("Failed to fetch leave requests:", err);
      // Don't show error if it's just empty data
      if (err.message && !err.message.includes("not found")) {
        setError(err.message || "Failed to fetch leave requests");
      } else {
        setLeaveRequests([]);
      }
    }
  };

  const fetchPerformanceReviews = async () => {
    try {
      const response = await apiClient.getPerformanceReviews();
      setPerformanceReviews(response.reviews || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch performance reviews");
    }
  };

  const handleApproveLeave = async (leaveRequest: LeaveRequest) => {
    try {
      await apiClient.updateLeaveRequest(leaveRequest.id, { status: "approved" });
      setSuccess("Leave request approved successfully!");
      setTimeout(() => setSuccess(null), 3000);
      fetchLeaveRequests();
      setShowLeaveApprovalModal(false);
    } catch (err: any) {
      setError(err.message || "Failed to approve leave request");
    }
  };

  const handleRejectLeave = async (leaveRequest: LeaveRequest, reason: string) => {
    try {
      await apiClient.updateLeaveRequest(leaveRequest.id, {
        status: "rejected",
        rejectionReason: reason,
      });
      setSuccess("Leave request rejected");
      setTimeout(() => setSuccess(null), 3000);
      fetchLeaveRequests();
      setShowLeaveApprovalModal(false);
    } catch (err: any) {
      setError(err.message || "Failed to reject leave request");
    }
  };

  const filteredStaff = staff.filter((member) => {
    const matchesSearch =
      member.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.employeeCode && member.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRole = roleFilter === "all" || member.role.name === roleFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && member.isActive) ||
      (statusFilter === "inactive" && !member.isActive);

    return matchesSearch && matchesRole && matchesStatus;
  });

  const filteredLeaveRequests = leaveRequests.filter((leave) => {
    return (
      leaveStatusFilter === "all" ||
      leave.status === leaveStatusFilter ||
      (leaveStatusFilter === "pending" && leave.status === "pending")
    );
  });

  // Don't show loading screen - show tabs immediately
  // if (loading && activeTab === "staff") {
  //   return (
  //     <div className="p-4 md:p-6 lg:p-8 flex items-center justify-center h-full">
  //       <div className="text-center">
  //         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
  //         <p className="mt-4 text-gray-600">Loading staff data...</p>
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <div className="w-full">
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <UserCheck className="h-7 w-7 md:h-8 md:w-8 text-primary-600" />
            Human Resources
          </h1>
          <p className="text-sm md:text-base text-gray-600">
            Manage staff, attendance, leave requests, and performance reviews
          </p>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
            <p className="text-green-800 font-medium">{success}</p>
            <button
              onClick={() => setSuccess(null)}
              className="ml-auto p-1 hover:bg-green-100 rounded"
            >
              <X className="h-4 w-4 text-green-600" />
            </button>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <p className="text-red-800">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto p-1 hover:bg-red-100 rounded"
            >
              <X className="h-4 w-4 text-red-600" />
            </button>
          </div>
        )}

        {/* Tabs - HR Panel Navigation - VERY VISIBLE */}
        <div className="mb-8 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl shadow-lg border-4 border-primary-500 p-6">
          <div className="mb-4 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-1">HR Panel Navigation</h2>
            <p className="text-sm text-gray-600">Select a section to manage</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => {
                console.log("Staff tab clicked");
                setActiveTab("staff");
              }}
              className={`flex flex-col items-center justify-center gap-3 py-6 px-4 rounded-xl font-bold text-lg transition-all transform hover:scale-105 shadow-md ${
                activeTab === "staff"
                  ? "bg-blue-600 text-white ring-4 ring-blue-300"
                  : "bg-white text-gray-700 hover:bg-blue-50 border-2 border-gray-300"
              }`}
            >
              <Users className={`h-8 w-8 ${activeTab === "staff" ? "text-white" : "text-blue-600"}`} />
              <span>Staff</span>
            </button>
            <button
              onClick={() => {
                console.log("Attendance tab clicked");
                setActiveTab("attendance");
              }}
              className={`flex flex-col items-center justify-center gap-3 py-6 px-4 rounded-xl font-bold text-lg transition-all transform hover:scale-105 shadow-md ${
                activeTab === "attendance"
                  ? "bg-green-600 text-white ring-4 ring-green-300"
                  : "bg-white text-gray-700 hover:bg-green-50 border-2 border-gray-300"
              }`}
            >
              <Calendar className={`h-8 w-8 ${activeTab === "attendance" ? "text-white" : "text-green-600"}`} />
              <span>Attendance</span>
            </button>
            <button
              onClick={() => {
                console.log("Leave tab clicked");
                setActiveTab("leave");
              }}
              className={`flex flex-col items-center justify-center gap-3 py-6 px-4 rounded-xl font-bold text-lg transition-all transform hover:scale-105 shadow-md ${
                activeTab === "leave"
                  ? "bg-orange-600 text-white ring-4 ring-orange-300"
                  : "bg-white text-gray-700 hover:bg-orange-50 border-2 border-gray-300"
              }`}
            >
              <CalendarDays className={`h-8 w-8 ${activeTab === "leave" ? "text-white" : "text-orange-600"}`} />
              <span>Leave Management</span>
            </button>
            <button
              onClick={() => {
                console.log("Performance tab clicked");
                setActiveTab("performance");
              }}
              className={`flex flex-col items-center justify-center gap-3 py-6 px-4 rounded-xl font-bold text-lg transition-all transform hover:scale-105 shadow-md ${
                activeTab === "performance"
                  ? "bg-purple-600 text-white ring-4 ring-purple-300"
                  : "bg-white text-gray-700 hover:bg-purple-50 border-2 border-gray-300"
              }`}
            >
              <TrendingUp className={`h-8 w-8 ${activeTab === "performance" ? "text-white" : "text-purple-600"}`} />
              <span>Performance</span>
            </button>
          </div>
        </div>

        {/* Staff Tab */}
        {activeTab === "staff" && (
          <div>
            {/* Filters */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name, email, role, employee code..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div>
                <select
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value);
                    fetchStaff();
                  }}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">All Roles</option>
                  <option value="ADMIN">Admin</option>
                  <option value="BRANCH_MANAGER">Branch Manager</option>
                  <option value="TEAM_LEADER">Team Leader</option>
                  <option value="TELECALLER">Telecaller</option>
                  <option value="COUNSELOR">Counselor</option>
                  <option value="RECEPTIONIST">Receptionist</option>
                  <option value="FILLING_OFFICER">Filling Officer</option>
                  <option value="HR_TEAM">HR Team</option>
                  <option value="IT_TEAM">IT Team</option>
                </select>
              </div>
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    fetchStaff();
                  }}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            {/* Statistics */}
            <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="text-sm text-gray-600 mb-1">Total Staff</div>
                <div className="text-2xl font-bold text-gray-900">{staff.length}</div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="text-sm text-gray-600 mb-1">Active</div>
                <div className="text-2xl font-bold text-green-600">
                  {staff.filter((s) => s.isActive).length}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="text-sm text-gray-600 mb-1">On Leave</div>
                <div className="text-2xl font-bold text-yellow-600">
                  {leaveRequests.filter((l) => l.status === "approved" && new Date(l.endDate) >= new Date()).length}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="text-sm text-gray-600 mb-1">Pending Reviews</div>
                <div className="text-2xl font-bold text-blue-600">
                  {performanceReviews.filter((p) => !p.nextReviewDate || new Date(p.nextReviewDate) <= new Date()).length}
                </div>
              </div>
            </div>

            {/* Staff Grid */}
            {filteredStaff.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No staff found</h3>
                <p className="text-gray-600">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {filteredStaff.map((member) => (
                  <div
                    key={member.id}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-5 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="h-6 w-6 text-primary-600" />
                        </div>
                        <div>
                          <h3 className="text-base md:text-lg font-semibold text-gray-900">
                            {member.firstName} {member.lastName}
                          </h3>
                          <p className="text-xs mt-0.5">
                            {member.employeeCode ? (
                              <span className="font-mono font-semibold text-primary-600">
                                {member.employeeCode}
                              </span>
                            ) : (
                              <span className="text-gray-400 italic">
                                Employee code not assigned
                              </span>
                            )}
                          </p>
                          <span
                            className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-md mt-1 ${
                              member.isActive
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {member.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{member.email}</span>
                      </div>
                      {member.phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="h-4 w-4 flex-shrink-0" />
                          <span>{member.phone}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Briefcase className="h-4 w-4 flex-shrink-0" />
                        <span>{member.role.name.replace("_", " ")}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500 mb-4 pt-3 border-t border-gray-200">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{member._count.attendanceRecords} attendance</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        <span>{member._count.leaveRequests} leaves</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Award className="h-3 w-3" />
                        <span>{member._count.performanceReviews} reviews</span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedUserForAttendance(member.id);
                        setActiveTab("attendance");
                      }}
                      className="w-full px-4 py-2 text-sm bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors"
                    >
                      View Details
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Attendance Tab */}
        {activeTab === "attendance" && (
          <div>
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Attendance Records</h3>
              <div className="flex flex-col md:flex-row gap-4">
                <select
                  value={selectedUserForAttendance}
                  onChange={(e) => {
                    setSelectedUserForAttendance(e.target.value);
                    if (e.target.value) {
                      fetchAttendance();
                    } else {
                      setAttendance([]);
                    }
                  }}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select Staff Member</option>
                  {staff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.firstName} {member.lastName} ({member.role.name})
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {selectedUserForAttendance && (
                  <button
                    onClick={fetchAttendance}
                    className="px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Load Attendance
                  </button>
                )}
              </div>
              {!selectedUserForAttendance && (
                <p className="mt-2 text-sm text-gray-500">
                  Please select a staff member to view their attendance records
                </p>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Check In
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Check Out
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Hours
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {!selectedUserForAttendance ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                          Please select a staff member to view attendance records
                        </td>
                      </tr>
                    ) : attendance.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                          No attendance records found for this staff member
                        </td>
                      </tr>
                    ) : (
                      attendance.map((record) => (
                        <tr key={record.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {new Date(record.date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {record.checkIn
                              ? new Date(record.checkIn).toLocaleTimeString()
                              : "N/A"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {record.checkOut
                              ? new Date(record.checkOut).toLocaleTimeString()
                              : "N/A"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-medium rounded-md ${
                                record.status === "present"
                                  ? "bg-green-100 text-green-700"
                                  : record.status === "absent"
                                  ? "bg-red-100 text-red-700"
                                  : record.status === "late"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {record.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {record.workHours ? `${record.workHours.toFixed(1)}h` : "N/A"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Leave Management Tab */}
        {activeTab === "leave" && (
          <div>
            <div className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <select
                  value={leaveStatusFilter}
                  onChange={(e) => {
                    setLeaveStatusFilter(e.target.value);
                    fetchLeaveRequests();
                  }}
                  className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <button
                onClick={() => setShowLeaveModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus className="h-5 w-5" />
                <span>New Leave Request</span>
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Employee
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Leave Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Dates
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Days
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredLeaveRequests.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          No leave requests found
                        </td>
                      </tr>
                    ) : (
                      filteredLeaveRequests.map((leave) => (
                        <tr key={leave.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">
                              {leave.user.firstName} {leave.user.lastName}
                            </div>
                            <div className="text-xs text-gray-500">{leave.user.role.name}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-medium rounded-md ${
                                LEAVE_TYPE_COLORS[leave.leaveType]
                              }`}
                            >
                              {LEAVE_TYPE_LABELS[leave.leaveType]}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {new Date(leave.startDate).toLocaleDateString()} -{" "}
                            {new Date(leave.endDate).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {leave.days} day(s)
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-medium rounded-md ${
                                STATUS_COLORS[leave.status]
                              }`}
                            >
                              {leave.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {leave.status === "pending" && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedLeaveRequest(leave);
                                    setShowLeaveApprovalModal(true);
                                  }}
                                  className="text-sm text-primary-600 hover:text-primary-900 font-medium"
                                >
                                  Review
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Performance Reviews Tab */}
        {activeTab === "performance" && (
          <div>
            <div className="mb-6 flex justify-end">
              <button
                onClick={() => setShowPerformanceModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus className="h-5 w-5" />
                <span>New Performance Review</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {performanceReviews.length === 0 ? (
                <div className="col-span-full bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                  <Award className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No performance reviews found
                  </h3>
                  <p className="text-gray-600">Create your first performance review</p>
                </div>
              ) : (
                performanceReviews.map((review) => (
                  <div
                    key={review.id}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-5"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">
                          {review.user.firstName} {review.user.lastName}
                        </h3>
                        <p className="text-xs text-gray-500">{review.reviewPeriod}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Award
                            key={i}
                            className={`h-4 w-4 ${
                              i < review.rating ? "text-yellow-500 fill-current" : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      Reviewed by: {review.reviewedBy.firstName} {review.reviewedBy.lastName}
                    </div>
                    {review.achievements && (
                      <div className="text-sm text-gray-700 mb-2">
                        <strong>Achievements:</strong> {review.achievements.substring(0, 100)}
                        {review.achievements.length > 100 ? "..." : ""}
                      </div>
                    )}
                    <div className="text-xs text-gray-500">
                      {new Date(review.reviewDate).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Leave Approval Modal */}
        {showLeaveApprovalModal && selectedLeaveRequest && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Review Leave Request</h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Employee</p>
                  <p className="font-medium">
                    {selectedLeaveRequest.user.firstName} {selectedLeaveRequest.user.lastName}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Leave Type</p>
                  <p className="font-medium">{LEAVE_TYPE_LABELS[selectedLeaveRequest.leaveType]}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Dates</p>
                  <p className="font-medium">
                    {new Date(selectedLeaveRequest.startDate).toLocaleDateString()} -{" "}
                    {new Date(selectedLeaveRequest.endDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Reason</p>
                  <p className="font-medium">{selectedLeaveRequest.reason}</p>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => handleApproveLeave(selectedLeaveRequest)}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      const reason = prompt("Enter rejection reason:");
                      if (reason) {
                        handleRejectLeave(selectedLeaveRequest, reason);
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => {
                      setShowLeaveApprovalModal(false);
                      setSelectedLeaveRequest(null);
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
