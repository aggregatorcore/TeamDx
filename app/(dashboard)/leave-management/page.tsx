"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Plus,
  CheckCircle2,
  X as XIcon,
  AlertCircle,
  X,
} from "lucide-react";
import { apiClient } from "@/lib/api";

interface LeaveRequest {
  id: string;
  userId: string;
  user: {
    id: string;
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

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: {
    name: string;
  };
}

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

export default function LeaveManagementPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [leaveStatusFilter, setLeaveStatusFilter] = useState<string>("all");
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showLeaveApprovalModal, setShowLeaveApprovalModal] = useState(false);
  const [selectedLeaveRequest, setSelectedLeaveRequest] = useState<LeaveRequest | null>(null);

  useEffect(() => {
    fetchStaff();
    fetchLeaveRequests();
  }, []);

  useEffect(() => {
    fetchLeaveRequests();
  }, [leaveStatusFilter]);

  const fetchStaff = async () => {
    try {
      const response = await apiClient.getStaff();
      setStaff(response.staff || []);
    } catch (err: any) {
      if (err.status === 401 || err.status === 403) {
        localStorage.removeItem("user");
        router.push("/login");
        return;
      }
      setError(err.message || "Failed to fetch staff");
    } finally {
      setLoading(false);
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
      if (err.message && !err.message.includes("not found")) {
        setError(err.message || "Failed to fetch leave requests");
      } else {
        setLeaveRequests([]);
      }
    }
  };

  const handleCreateLeave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      await apiClient.createLeaveRequest({
        userId: formData.get("userId") as string,
        leaveType: formData.get("leaveType") as any,
        startDate: formData.get("startDate") as string,
        endDate: formData.get("endDate") as string,
        reason: formData.get("reason") as string,
      });
      setShowLeaveModal(false);
      setSuccess("Leave request created successfully!");
      setTimeout(() => setSuccess(null), 3000);
      fetchLeaveRequests();
    } catch (err: any) {
      setError(err.message || "Failed to create leave request");
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

  const filteredLeaveRequests = leaveRequests.filter((leave) => {
    return (
      leaveStatusFilter === "all" ||
      leave.status === leaveStatusFilter ||
      (leaveStatusFilter === "pending" && leave.status === "pending")
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Leave Management</h1>
          <p className="text-gray-600">Manage employee leave requests and approvals</p>
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

        {/* Filters and Actions */}
        <div className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <select
              value={leaveStatusFilter}
              onChange={(e) => setLeaveStatusFilter(e.target.value)}
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

        {/* Leave Requests Table */}
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
                          <button
                            onClick={() => {
                              setSelectedLeaveRequest(leave);
                              setShowLeaveApprovalModal(true);
                            }}
                            className="text-sm text-primary-600 hover:text-primary-900 font-medium"
                          >
                            Review
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create Leave Modal */}
        {showLeaveModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Create Leave Request</h2>
              </div>
              <form onSubmit={handleCreateLeave} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Staff Member *
                  </label>
                  <select
                    name="userId"
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select Staff Member</option>
                    {staff.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.firstName} {member.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Leave Type *
                  </label>
                  <select
                    name="leaveType"
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="casual">Casual</option>
                    <option value="sick">Sick</option>
                    <option value="annual">Annual</option>
                    <option value="emergency">Emergency</option>
                    <option value="unpaid">Unpaid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date *
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Reason *</label>
                  <textarea
                    name="reason"
                    required
                    rows={3}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Create Request
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLeaveModal(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
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
                  <p className="font-medium">
                    {LEAVE_TYPE_LABELS[selectedLeaveRequest.leaveType]}
                  </p>
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


