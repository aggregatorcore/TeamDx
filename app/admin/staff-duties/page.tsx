"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Target,
  Edit,
  Search,
  Save,
  X,
  Plus,
  CheckCircle2,
  AlertCircle,
  User,
  FileText,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { tabStorage } from "@/lib/storage";

type StaffMember = {
  id: string;
  employeeCode?: string | null;
  firstName: string;
  lastName: string;
  email: string;
  role: {
    id: string;
    name: string;
  };
  staffDuties?: {
    id: string;
    updatedAt: string;
  } | null;
};

export default function StaffDutiesManagementPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [duties, setDuties] = useState({
    keyResponsibilities: [""],
    coreDuties: [""],
    additionalDuties: [""],
    notes: "",
  });

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getAllStaffForDuties();
      setStaff(response.staff || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load staff");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (staffMember: StaffMember) => {
    setSelectedStaff(staffMember);
    try {
      const response = await apiClient.getStaffDuties(staffMember.id);
      setDuties({
        keyResponsibilities: response.keyResponsibilities.length > 0
          ? response.keyResponsibilities
          : [""],
        coreDuties: response.coreDuties.length > 0 ? response.coreDuties : [""],
        additionalDuties: response.additionalDuties && response.additionalDuties.length > 0
          ? response.additionalDuties
          : [""],
        notes: response.notes || "",
      });
    } catch (error) {
      // If no duties exist, start with empty
      setDuties({
        keyResponsibilities: [""],
        coreDuties: [""],
        additionalDuties: [""],
        notes: "",
      });
    }
    setShowModal(true);
  };

  const handleAddDuty = (type: "keyResponsibilities" | "coreDuties" | "additionalDuties") => {
    setDuties({
      ...duties,
      [type]: [...duties[type], ""],
    });
  };

  const handleRemoveDuty = (
    type: "keyResponsibilities" | "coreDuties" | "additionalDuties",
    index: number
  ) => {
    if (duties[type].length > 1) {
      setDuties({
        ...duties,
        [type]: duties[type].filter((_, i) => i !== index),
      });
    }
  };

  const handleDutyChange = (
    type: "keyResponsibilities" | "coreDuties" | "additionalDuties",
    index: number,
    value: string
  ) => {
    const updated = [...duties[type]];
    updated[index] = value;
    setDuties({
      ...duties,
      [type]: updated,
    });
  };

  const handleSubmit = async () => {
    if (!selectedStaff) return;

    // Filter out empty duties
    const keyResponsibilities = duties.keyResponsibilities.filter((d) => d.trim() !== "");
    const coreDuties = duties.coreDuties.filter((d) => d.trim() !== "");
    const additionalDuties = duties.additionalDuties.filter((d) => d.trim() !== "");

    if (keyResponsibilities.length === 0) {
      setError("At least one key responsibility is required");
      return;
    }

    if (coreDuties.length === 0) {
      setError("At least one core duty is required");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await apiClient.setStaffDuties(selectedStaff.id, {
        keyResponsibilities,
        coreDuties,
        additionalDuties: additionalDuties.length > 0 ? additionalDuties : undefined,
        notes: duties.notes.trim() || undefined,
      });
      setShowModal(false);
      loadStaff(); // Reload staff list
    } catch (e: any) {
      setError(e?.message || "Failed to save duties");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredStaff = staff.filter(
    (member) =>
      member.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.employeeCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.role.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading staff...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Staff Duties & Responsibilities</h1>
          <p className="text-gray-600">Manage duties and responsibilities for each staff member</p>
        </div>

        {error && !showModal && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, employee code, or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Staff List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Duties Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Last Updated
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      No staff members found
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {member.firstName} {member.lastName}
                            </div>
                            <div className="text-sm text-gray-500">{member.email}</div>
                            {member.employeeCode && (
                              <div className="text-xs text-gray-400">ID: {member.employeeCode}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-semibold bg-indigo-100 text-indigo-800 rounded-full">
                          {member.role.name}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {member.staffDuties ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full">
                            <CheckCircle2 className="h-3 w-3" />
                            Set
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded-full">
                            <AlertCircle className="h-3 w-3" />
                            Not Set
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {member.staffDuties
                          ? new Date(member.staffDuties.updatedAt).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(member)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Edit className="h-4 w-4" />
                          {member.staffDuties ? "Edit" : "Set"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Edit Modal */}
        {showModal && selectedStaff && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Duties & Responsibilities
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedStaff.firstName} {selectedStaff.lastName} ({selectedStaff.role.name})
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                      <p className="text-sm text-red-800">{error}</p>
                    </div>
                  </div>
                )}

                {/* Key Responsibilities */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">
                    Key Responsibilities *
                  </label>
                  <div className="space-y-2">
                    {duties.keyResponsibilities.map((duty, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={duty}
                          onChange={(e) => handleDutyChange("keyResponsibilities", index, e.target.value)}
                          placeholder="Enter key responsibility..."
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {duties.keyResponsibilities.length > 1 && (
                          <button
                            onClick={() => handleRemoveDuty("keyResponsibilities", index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => handleAddDuty("keyResponsibilities")}
                      className="mt-2 inline-flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      Add Responsibility
                    </button>
                  </div>
                </div>

                {/* Core Duties */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">Core Duties *</label>
                  <div className="space-y-2">
                    {duties.coreDuties.map((duty, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={duty}
                          onChange={(e) => handleDutyChange("coreDuties", index, e.target.value)}
                          placeholder="Enter core duty..."
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {duties.coreDuties.length > 1 && (
                          <button
                            onClick={() => handleRemoveDuty("coreDuties", index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => handleAddDuty("coreDuties")}
                      className="mt-2 inline-flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      Add Duty
                    </button>
                  </div>
                </div>

                {/* Additional Duties */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">
                    Additional Duties (Optional)
                  </label>
                  <div className="space-y-2">
                    {duties.additionalDuties.map((duty, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={duty}
                          onChange={(e) => handleDutyChange("additionalDuties", index, e.target.value)}
                          placeholder="Enter additional duty..."
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {duties.additionalDuties.length > 1 && (
                          <button
                            onClick={() => handleRemoveDuty("additionalDuties", index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => handleAddDuty("additionalDuties")}
                      className="mt-2 inline-flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      Add Additional Duty
                    </button>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Notes (Optional)</label>
                  <textarea
                    value={duties.notes}
                    onChange={(e) => setDuties({ ...duties, notes: e.target.value })}
                    placeholder="Add any additional notes or instructions..."
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="h-4 w-4" />
                    {submitting ? "Saving..." : "Save Duties"}
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


