"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Plus,
  Edit,
  Trash2,
  X,
  Save,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { tabStorage } from "@/lib/storage";

interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  duration: number;
  isActive: boolean;
  roleShifts: Array<{
    id: string;
    role: {
      id: string;
      name: string;
    };
  }>;
  _count?: {
    sessions: number;
  };
}

export default function ShiftManagementPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    startTime: "09:00",
    endTime: "17:00",
    duration: 8,
    roleIds: [] as string[],
    isActive: true,
  });

  useEffect(() => {
    fetchShifts();
    fetchRoles();
  }, []);

  const fetchShifts = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getShifts();
      setShifts(response.shifts || []);
    } catch (err: any) {
      if (err.status === 401) {
        // Unauthorized - token expired or invalid
        tabStorage.removeItem("token");
        tabStorage.removeItem("user");
        router.push("/login");
        return;
      }
      if (err.status === 403) {
        // Forbidden - user doesn't have permission, show error but don't logout
        setError("You don't have permission to access this page");
        return;
      }
      setError(err.message || "Failed to fetch shifts");
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await apiClient.getRoles();
      setRoles(response.roles || []);
    } catch (err: any) {
      if (err.status === 401) {
        tabStorage.removeItem("token");
        tabStorage.removeItem("user");
        router.push("/login");
        return;
      }
      if (err.status === 403) {
        // Forbidden - show error but don't block the page
        console.warn("No permission to fetch roles:", err);
        setError("Unable to load roles. Please contact administrator.");
        return;
      }
      console.error("Failed to fetch roles:", err);
      // Don't show error for other failures, just log
    }
  };

  const handleOpenModal = (shift?: Shift) => {
    if (shift) {
      setEditingShift(shift);
      setFormData({
        name: shift.name,
        startTime: shift.startTime,
        endTime: shift.endTime,
        duration: shift.duration,
        roleIds: shift.roleShifts.map((rs) => rs.role.id),
        isActive: shift.isActive,
      });
    } else {
      setEditingShift(null);
      setFormData({
        name: "",
        startTime: "09:00",
        endTime: "17:00",
        duration: 8,
        roleIds: [],
        isActive: true,
      });
    }
    setShowModal(true);
    setError(null);
    setSuccess(null);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingShift(null);
    setFormData({
      name: "",
      startTime: "09:00",
      endTime: "17:00",
      duration: 8,
      roleIds: [],
      isActive: true,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (editingShift) {
        await apiClient.updateShift(editingShift.id, formData);
        setSuccess("Shift updated successfully");
      } else {
        await apiClient.createShift(formData);
        setSuccess("Shift created successfully");
      }
      handleCloseModal();
      fetchShifts();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      if (err.status === 401) {
        tabStorage.removeItem("token");
        tabStorage.removeItem("user");
        router.push("/login");
        return;
      }
      setError(err.message || "Failed to save shift");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this shift?")) return;

    try {
      await apiClient.deleteShift(id);
      setSuccess("Shift deleted successfully");
      fetchShifts();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      if (err.status === 401) {
        tabStorage.removeItem("token");
        tabStorage.removeItem("user");
        router.push("/login");
        return;
      }
      setError(err.message || "Failed to delete shift");
    }
  };

  const calculateDuration = () => {
    if (formData.startTime && formData.endTime) {
      const [startH, startM] = formData.startTime.split(":").map(Number);
      const [endH, endM] = formData.endTime.split(":").map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      let diffMinutes = endMinutes - startMinutes;
      if (diffMinutes < 0) diffMinutes += 24 * 60; // Handle overnight shifts
      const hours = diffMinutes / 60;
      setFormData({ ...formData, duration: Math.round(hours * 10) / 10 });
    }
  };

  useEffect(() => {
    calculateDuration();
  }, [formData.startTime, formData.endTime]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading shifts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              <CalendarClock className="h-7 w-7 md:h-8 md:w-8 text-primary-600" />
              Shift Management
            </h1>
            <p className="text-gray-600">Create and manage shifts for different roles</p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="mt-4 md:mt-0 flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>Create Shift</span>
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {success}
          </div>
        )}

        {/* Shifts Grid */}
        {shifts.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <CalendarClock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No shifts found</h3>
            <p className="text-gray-600 mb-4">Create your first shift to get started</p>
            <button
              onClick={() => handleOpenModal()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="h-5 w-5" />
              <span>Create Shift</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shifts.map((shift) => (
              <div
                key={shift.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{shift.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {shift.isActive ? (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-md">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-md">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenModal(shift)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Edit className="h-4 w-4 text-gray-600" />
                    </button>
                    <button
                      onClick={() => handleDelete(shift.id)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>
                      {shift.startTime} - {shift.endTime}
                    </span>
                    <span className="ml-auto font-medium text-gray-900">{shift.duration} hours</span>
                  </div>

                  <div>
                    <div className="text-sm text-gray-600 mb-2">Assigned Roles:</div>
                    {shift.roleShifts.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {shift.roleShifts.map((rs) => (
                          <span
                            key={rs.id}
                            className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-md"
                          >
                            {rs.role.name.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">No roles assigned</span>
                    )}
                  </div>

                  {shift._count && (
                    <div className="text-sm text-gray-600">
                      <Users className="h-4 w-4 inline mr-1" />
                      {shift._count.sessions} session{shift._count.sessions !== 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingShift ? "Edit Shift" : "Create New Shift"}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Shift Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="e.g., Morning Shift, Day Shift"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Time *
                    </label>
                    <input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Time *</label>
                    <input
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration (hours) *
                  </label>
                  <input
                    type="number"
                    value={formData.duration}
                    onChange={(e) =>
                      setFormData({ ...formData, duration: parseFloat(e.target.value) })
                    }
                    min="0.5"
                    max="24"
                    step="0.5"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Automatically calculated from start/end time
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assign to Roles *
                  </label>
                  <div className="border border-gray-300 rounded-lg p-4 max-h-48 overflow-y-auto">
                    {roles.length === 0 ? (
                      <p className="text-sm text-gray-500">No roles available</p>
                    ) : (
                      <div className="space-y-2">
                        {roles.map((role) => (
                          <label key={role.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.roleIds.includes(role.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({
                                    ...formData,
                                    roleIds: [...formData.roleIds, role.id],
                                  });
                                } else {
                                  setFormData({
                                    ...formData,
                                    roleIds: formData.roleIds.filter((id) => id !== role.id),
                                  });
                                }
                              }}
                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-sm text-gray-700">{role.name.replace(/_/g, " ")}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">Active</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  <span>{editingShift ? "Update" : "Create"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

