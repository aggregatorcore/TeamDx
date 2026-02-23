"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  Search,
  X,
  AlertCircle,
  CheckCircle2,
  Clock,
  Globe,
  Briefcase,
  User,
  Filter,
  Download,
  RefreshCw,
  Calendar,
  DollarSign,
  Tag,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import LoadingButton from "@/components/LoadingButton";
import { tabStorage } from "@/lib/storage";

interface Application {
  id: string;
  applicationId: string | null;
  clientId: string;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string;
  };
  visaType: string;
  targetCountry: string;
  status: "draft" | "submitted" | "in_review" | "approved" | "rejected" | "withdrawn";
  priority: "low" | "normal" | "high" | "urgent";
  submissionDate: string | null;
  expiryDate: string | null;
  fees: number | null;
  notes: string | null;
  assignedTo: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  documents: Array<{
    id: string;
    name: string;
    type: string;
    uploadedAt: string;
  }>;
  _count: {
    documents: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
}

const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  in_review: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  withdrawn: "bg-purple-100 text-purple-700",
};

const STATUS_LABELS = {
  draft: "Draft",
  submitted: "Submitted",
  in_review: "In Review",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

const PRIORITY_COLORS = {
  low: "bg-gray-100 text-gray-700",
  normal: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

const PRIORITY_LABELS = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export default function ApplicationsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingApplication, setEditingApplication] = useState<Application | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [formData, setFormData] = useState({
    clientId: "",
    visaType: "",
    targetCountry: "",
    status: "draft" as const,
    priority: "normal" as const,
    submissionDate: "",
    expiryDate: "",
    fees: "",
    notes: "",
    assignedToId: "",
  });

  useEffect(() => {
    fetchApplications();
    fetchClients();
    fetchUsers();
  }, []);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getApplications();
      setApplications(response.applications || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch applications");
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const response = await apiClient.getClients();
      setClients(response.clients || []);
    } catch (err: any) {
      console.error("Failed to fetch clients:", err);
    }
  };

  const fetchUsers = async () => {
    try {
      // Try getStaff first (works for more roles), fallback to getUsers (for ADMIN/BRANCH_MANAGER)
      let response: any;
      try {
        response = await apiClient.getStaff();
        const counselors = (response.staff || []).filter(
          (u: any) => u.role?.name === "COUNSELOR" && u.isActive
        );
        setUsers(counselors);
      } catch (staffError: any) {
        // Fallback to getUsers if getStaff fails
        try {
          response = await apiClient.getUsers();
          const counselors = (response.users || []).filter(
            (u: any) => u.role?.name === "COUNSELOR" && u.isActive
          );
          setUsers(counselors);
        } catch (usersError: any) {
          console.error("Failed to fetch users:", usersError);
        }
      }
    } catch (err: any) {
      console.error("Failed to fetch users:", err);
    }
  };

  const handleAddApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      setCreating(true);
      const data = {
        ...formData,
        fees: formData.fees ? parseFloat(formData.fees) : undefined,
        submissionDate: formData.submissionDate || undefined,
        expiryDate: formData.expiryDate || undefined,
        assignedToId: formData.assignedToId || undefined,
      };

      await apiClient.createApplication(data);
      setSuccess("Application created successfully!");
      setTimeout(() => setSuccess(null), 3000);
      setShowAddModal(false);
      resetForm();
      fetchApplications();
    } catch (err: any) {
      setError(err.message || "Failed to create application");
    } finally {
      setCreating(false);
    }
  };

  const handleEditApplication = (application: Application) => {
    setEditingApplication(application);
    setFormData({
      clientId: application.clientId,
      visaType: application.visaType,
      targetCountry: application.targetCountry,
      status: application.status,
      priority: application.priority,
      submissionDate: application.submissionDate
        ? new Date(application.submissionDate).toISOString().split("T")[0]
        : "",
      expiryDate: application.expiryDate
        ? new Date(application.expiryDate).toISOString().split("T")[0]
        : "",
      fees: application.fees?.toString() || "",
      notes: application.notes || "",
      assignedToId: application.assignedTo?.id || "",
    });
    setShowEditModal(true);
  };

  const handleUpdateApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingApplication) return;

    setError(null);

    try {
      setUpdating(true);
      const data = {
        ...formData,
        fees: formData.fees ? parseFloat(formData.fees) : undefined,
        submissionDate: formData.submissionDate || undefined,
        expiryDate: formData.expiryDate || undefined,
        assignedToId: formData.assignedToId || undefined,
      };

      await apiClient.updateApplication(editingApplication.id, data);
      setSuccess("Application updated successfully!");
      setTimeout(() => setSuccess(null), 3000);
      setShowEditModal(false);
      setEditingApplication(null);
      resetForm();
      fetchApplications();
    } catch (err: any) {
      setError(err.message || "Failed to update application");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteApplication = async (id: string) => {
    if (!confirm("Are you sure you want to delete this application?")) {
      return;
    }

    try {
      setDeletingId(id);
      await apiClient.deleteApplication(id);
      setSuccess("Application deleted successfully!");
      setTimeout(() => setSuccess(null), 3000);
      fetchApplications();
    } catch (err: any) {
      setError(err.message || "Failed to delete application");
    } finally {
      setDeletingId(null);
    }
  };

  const resetForm = () => {
    setFormData({
      clientId: "",
      visaType: "",
      targetCountry: "",
      status: "draft",
      priority: "normal",
      submissionDate: "",
      expiryDate: "",
      fees: "",
      notes: "",
      assignedToId: "",
    });
  };

  const filteredApplications = applications.filter((app) => {
    const matchesSearch =
      app.applicationId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.client.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.client.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.client.phone.includes(searchTerm) ||
      app.visaType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.targetCountry.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || app.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || app.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading applications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              <FileText className="h-7 w-7 md:h-8 md:w-8 text-primary-600" />
              Applications
            </h1>
            <p className="text-sm md:text-base text-gray-600">
              Manage immigration applications and track their status
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 md:px-6 md:py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-md w-full md:w-auto justify-center text-sm md:text-base font-medium"
          >
            <Plus className="h-5 w-5" />
            <span>New Application</span>
          </button>
        </div>

        {/* Success Message */}
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

        {/* Error Message */}
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

        {/* Filters and Search */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by ID, client name, email, phone, visa type, country..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm md:text-base"
              />
            </div>
          </div>
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm md:text-base"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="in_review">In Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </div>
          <div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm md:text-base"
            >
              <option value="all">All Priority</option>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">Total Applications</div>
            <div className="text-2xl font-bold text-gray-900">{applications.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">In Review</div>
            <div className="text-2xl font-bold text-yellow-600">
              {applications.filter((a) => a.status === "in_review").length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">Approved</div>
            <div className="text-2xl font-bold text-green-600">
              {applications.filter((a) => a.status === "approved").length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">Pending</div>
            <div className="text-2xl font-bold text-blue-600">
              {applications.filter((a) => a.status === "draft" || a.status === "submitted").length}
            </div>
          </div>
        </div>

        {/* Applications Table */}
        {filteredApplications.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No applications found</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || statusFilter !== "all" || priorityFilter !== "all"
                ? "Try adjusting your filters"
                : "Create your first application to get started"}
            </p>
            {!searchTerm && statusFilter === "all" && priorityFilter === "all" && (
              <button
                onClick={() => {
                  resetForm();
                  setShowAddModal(true);
                }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus className="h-5 w-5" />
                <span>Create Application</span>
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Application ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Visa Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Country
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Assigned To
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Documents
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredApplications.map((app) => (
                    <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {app.applicationId || "N/A"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">
                          {app.client.firstName} {app.client.lastName}
                        </div>
                        <div className="text-xs text-gray-500">{app.client.phone}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{app.visaType}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-sm text-gray-900">
                          <Globe className="h-4 w-4" />
                          {app.targetCountry}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-md ${
                            STATUS_COLORS[app.status]
                          }`}
                        >
                          {STATUS_LABELS[app.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-md ${
                            PRIORITY_COLORS[app.priority]
                          }`}
                        >
                          {PRIORITY_LABELS[app.priority]}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {app.assignedTo
                            ? `${app.assignedTo.firstName} ${app.assignedTo.lastName}`
                            : "Unassigned"}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <FileText className="h-4 w-4" />
                          {app._count.documents}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditApplication(app)}
                            className="text-primary-600 hover:text-primary-900 p-1"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteApplication(app.id)}
                            disabled={deletingId === app.id}
                            className="text-red-600 hover:text-red-900 p-1 disabled:opacity-50 flex items-center gap-1"
                            title="Delete"
                            title="Delete"
                          >
                            {deletingId === app.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add Application Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 p-4 md:p-6 flex items-center justify-between">
                <h2 className="text-lg md:text-xl font-bold text-gray-900">
                  Create New Application
                </h2>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                    setError(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleAddApplication} className="p-4 md:p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Client *
                    </label>
                    <select
                      required
                      value={formData.clientId}
                      onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select client</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.firstName} {client.lastName} ({client.phone})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Visa Type *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.visaType}
                      onChange={(e) => setFormData({ ...formData, visaType: e.target.value })}
                      placeholder="e.g., Student, Work, PR"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Target Country *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.targetCountry}
                      onChange={(e) =>
                        setFormData({ ...formData, targetCountry: e.target.value })
                      }
                      placeholder="e.g., Canada, USA, Australia"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value as any })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="draft">Draft</option>
                      <option value="submitted">Submitted</option>
                      <option value="in_review">In Review</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="withdrawn">Withdrawn</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <select
                      value={formData.priority}
                      onChange={(e) =>
                        setFormData({ ...formData, priority: e.target.value as any })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Assigned To
                    </label>
                    <select
                      value={formData.assignedToId}
                      onChange={(e) => setFormData({ ...formData, assignedToId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Unassigned</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.firstName} {user.lastName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Submission Date
                    </label>
                    <input
                      type="date"
                      value={formData.submissionDate}
                      onChange={(e) =>
                        setFormData({ ...formData, submissionDate: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expiry Date
                    </label>
                    <input
                      type="date"
                      value={formData.expiryDate}
                      onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fees</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.fees}
                      onChange={(e) => setFormData({ ...formData, fees: e.target.value })}
                      placeholder="0.00"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                    placeholder="Additional notes or remarks..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      resetForm();
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <LoadingButton
                    type="submit"
                    loading={creating}
                    className="flex-1"
                  >
                    Create Application
                  </LoadingButton>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Application Modal */}
        {showEditModal && editingApplication && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 p-4 md:p-6 flex items-center justify-between">
                <h2 className="text-lg md:text-xl font-bold text-gray-900">
                  Edit Application
                </h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingApplication(null);
                    resetForm();
                    setError(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateApplication} className="p-4 md:p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Client *
                    </label>
                    <select
                      required
                      value={formData.clientId}
                      onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select client</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.firstName} {client.lastName} ({client.phone})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Visa Type *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.visaType}
                      onChange={(e) => setFormData({ ...formData, visaType: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Target Country *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.targetCountry}
                      onChange={(e) =>
                        setFormData({ ...formData, targetCountry: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value as any })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="draft">Draft</option>
                      <option value="submitted">Submitted</option>
                      <option value="in_review">In Review</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="withdrawn">Withdrawn</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <select
                      value={formData.priority}
                      onChange={(e) =>
                        setFormData({ ...formData, priority: e.target.value as any })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Assigned To
                    </label>
                    <select
                      value={formData.assignedToId}
                      onChange={(e) => setFormData({ ...formData, assignedToId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Unassigned</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.firstName} {user.lastName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Submission Date
                    </label>
                    <input
                      type="date"
                      value={formData.submissionDate}
                      onChange={(e) =>
                        setFormData({ ...formData, submissionDate: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expiry Date
                    </label>
                    <input
                      type="date"
                      value={formData.expiryDate}
                      onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fees</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.fees}
                      onChange={(e) => setFormData({ ...formData, fees: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingApplication(null);
                      resetForm();
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <LoadingButton
                    type="submit"
                    loading={updating}
                    className="flex-1"
                  >
                    Update Application
                  </LoadingButton>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
