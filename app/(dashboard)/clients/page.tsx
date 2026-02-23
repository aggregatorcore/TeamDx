"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Search,
  X,
  AlertCircle,
  CheckCircle2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  User,
  Eye,
  FileText,
  RefreshCw,
} from "lucide-react";
import { apiClient } from "@/lib/api";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  dateOfBirth: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  notes: string | null;
  status: "active" | "inactive" | "archived";
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
  _count: {
    applications: number;
    visits: number;
  };
  createdAt: string;
  updatedAt: string;
}

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    address: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
    notes: "",
    status: "active" as const,
    assignedToId: "",
  });

  useEffect(() => {
    fetchClients();
    fetchUsers();
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getClients();
      setClients(response.clients || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch clients");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      // Try getStaff first (for most roles), fallback to getUsers (for ADMIN/BRANCH_MANAGER)
      let response;
      try {
        response = await apiClient.getStaff();
        const staff = response.staff || [];
        const counselors = staff.filter(
          (u: any) => u.role?.name === "COUNSELOR" && u.isActive
        );
        setUsers(counselors);
      } catch (staffError) {
        // Fallback to getUsers if getStaff fails
        try {
          response = await apiClient.getUsers();
          const counselors = (response.users || []).filter(
            (u: any) => u.role?.name === "COUNSELOR" && u.isActive
          );
          setUsers(counselors);
        } catch (usersError) {
          console.error("Failed to fetch users:", usersError);
          setUsers([]); // Set empty array on failure
        }
      }
    } catch (err: any) {
      console.error("Failed to fetch users:", err);
      setUsers([]); // Set empty array on failure
    }
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const data = {
        ...formData,
        email: formData.email || undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
        assignedToId: formData.assignedToId || undefined,
      };

      await apiClient.createClient(data);
      setSuccess("Client created successfully!");
      setTimeout(() => setSuccess(null), 3000);
      setShowAddModal(false);
      resetForm();
      fetchClients();
    } catch (err: any) {
      setError(err.message || "Failed to create client");
    }
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setFormData({
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email || "",
      phone: client.phone,
      dateOfBirth: client.dateOfBirth
        ? new Date(client.dateOfBirth).toISOString().split("T")[0]
        : "",
      address: client.address || "",
      city: client.city || "",
      state: client.state || "",
      country: client.country || "",
      postalCode: client.postalCode || "",
      notes: client.notes || "",
      status: client.status,
      assignedToId: client.assignedTo?.id || "",
    });
    setShowEditModal(true);
  };

  const handleViewClient = async (client: Client) => {
    try {
      const response = await apiClient.getClient(client.id);
      setSelectedClient(response.client);
      setShowViewModal(true);
    } catch (err: any) {
      setError(err.message || "Failed to fetch client details");
    }
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    setError(null);

    try {
      const data = {
        ...formData,
        email: formData.email || undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
        assignedToId: formData.assignedToId || undefined,
      };

      await apiClient.updateClient(editingClient.id, data);
      setSuccess("Client updated successfully!");
      setTimeout(() => setSuccess(null), 3000);
      setShowEditModal(false);
      setEditingClient(null);
      resetForm();
      fetchClients();
    } catch (err: any) {
      setError(err.message || "Failed to update client");
    }
  };

  const handleDeleteClient = async (id: string) => {
    if (!confirm("Are you sure you want to archive this client?")) {
      return;
    }

    try {
      setDeletingId(id);
      await apiClient.deleteClient(id);
      setSuccess("Client archived successfully!");
      setTimeout(() => setSuccess(null), 3000);
      fetchClients();
    } catch (err: any) {
      setError(err.message || "Failed to archive client");
    } finally {
      setDeletingId(null);
    }
  };

  const resetForm = () => {
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      dateOfBirth: "",
      address: "",
      city: "",
      state: "",
      country: "",
      postalCode: "",
      notes: "",
      status: "active",
      assignedToId: "",
    });
  };

  const filteredClients = clients.filter((client) => {
    const matchesSearch =
      client.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.phone.includes(searchTerm) ||
      client.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.country?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || client.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading clients...</p>
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
              <Users className="h-7 w-7 md:h-8 md:w-8 text-primary-600" />
              Clients
            </h1>
            <p className="text-sm md:text-base text-gray-600">
              Manage client information and profiles
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
            <span>New Client</span>
          </button>
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

        {/* Filters and Search */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email, phone, city, country..."
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
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">Total Clients</div>
            <div className="text-2xl font-bold text-gray-900">{clients.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">Active</div>
            <div className="text-2xl font-bold text-green-600">
              {clients.filter((c) => c.status === "active").length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">Total Applications</div>
            <div className="text-2xl font-bold text-blue-600">
              {clients.reduce((sum, c) => sum + c._count.applications, 0)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">Total Visits</div>
            <div className="text-2xl font-bold text-purple-600">
              {clients.reduce((sum, c) => sum + c._count.visits, 0)}
            </div>
          </div>
        </div>

        {/* Clients Grid */}
        {filteredClients.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No clients found</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || statusFilter !== "all"
                ? "Try adjusting your filters"
                : "Create your first client to get started"}
            </p>
            {!searchTerm && statusFilter === "all" && (
              <button
                onClick={() => {
                  resetForm();
                  setShowAddModal(true);
                }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus className="h-5 w-5" />
                <span>Create Client</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {filteredClients.map((client) => (
              <div
                key={client.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="h-6 w-6 text-primary-600" />
                    </div>
                    <div>
                      <h3 className="text-base md:text-lg font-semibold text-gray-900">
                        {client.firstName} {client.lastName}
                      </h3>
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-md mt-1 ${client.status === "active"
                            ? "bg-green-100 text-green-700"
                            : client.status === "inactive"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                      >
                        {client.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {client.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="h-4 w-4 flex-shrink-0" />
                    <span>{client.phone}</span>
                  </div>
                  {(client.city || client.country) && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin className="h-4 w-4 flex-shrink-0" />
                      <span>
                        {[client.city, client.country].filter(Boolean).join(", ") || "N/A"}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 mb-4 pt-3 border-t border-gray-200">
                  <div className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    <span>{client._count.applications} applications</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>{client._count.visits} visits</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleViewClient(client)}
                    className="flex-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-1"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </button>
                  <button
                    onClick={() => handleEditClient(client)}
                    className="px-3 py-2 text-sm bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors"
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteClient(client.id)}
                    disabled={deletingId === client.id}
                    className="px-3 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
                    title="Archive"
                  >
                    {deletingId === client.id ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Client Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 p-4 md:p-6 flex items-center justify-between">
                <h2 className="text-lg md:text-xl font-bold text-gray-900">Create New Client</h2>
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

              <form onSubmit={handleAddClient} className="p-4 md:p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                    <input
                      type="text"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      value={formData.postalCode}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
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
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
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
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                  >
                    Create Client
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Client Modal */}
        {showEditModal && editingClient && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 p-4 md:p-6 flex items-center justify-between">
                <h2 className="text-lg md:text-xl font-bold text-gray-900">Edit Client</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingClient(null);
                    resetForm();
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateClient} className="p-4 md:p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="archived">Archived</option>
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
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingClient(null);
                      resetForm();
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                  >
                    Update Client
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* View Client Modal */}
        {showViewModal && selectedClient && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 p-4 md:p-6 flex items-center justify-between">
                <h2 className="text-lg md:text-xl font-bold text-gray-900">
                  Client Details
                </h2>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setSelectedClient(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-4 md:p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Name</label>
                    <p className="text-base font-semibold text-gray-900">
                      {selectedClient.firstName} {selectedClient.lastName}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Status</label>
                    <p className="text-base">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-md ${selectedClient.status === "active"
                            ? "bg-green-100 text-green-700"
                            : selectedClient.status === "inactive"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                      >
                        {selectedClient.status}
                      </span>
                    </p>
                  </div>
                  {selectedClient.email && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Email</label>
                      <p className="text-base text-gray-900">{selectedClient.email}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-gray-500">Phone</label>
                    <p className="text-base text-gray-900">{selectedClient.phone}</p>
                  </div>
                  {selectedClient.assignedTo && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Assigned To</label>
                      <p className="text-base text-gray-900">
                        {selectedClient.assignedTo.firstName} {selectedClient.assignedTo.lastName}
                      </p>
                    </div>
                  )}
                </div>

                {selectedClient.notes && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Notes</label>
                    <p className="text-base text-gray-900 whitespace-pre-wrap">
                      {selectedClient.notes}
                    </p>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => {
                        setShowViewModal(false);
                        handleEditClient(selectedClient);
                      }}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      Edit Client
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
