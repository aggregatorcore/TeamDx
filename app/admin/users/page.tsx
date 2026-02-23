"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Plus, Edit, Trash2, ArrowLeft, AlertCircle } from "lucide-react";
import { apiClient } from "@/lib/api";

type Role = {
  id: string;
  name: string;
  description?: string;
  level?: number;
};

type User = {
  id: string;
  employeeCode?: string | null;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  isActive: boolean;
  role: Role;
  teamLeaderId?: string | null;
  teamName?: string | null;
};

type FormState = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  roleId: string;
};

export default function UsersManagementPage() {
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Team creation modal
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamLeaderId, setTeamLeaderId] = useState("");
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([]);

  const [formData, setFormData] = useState<FormState>({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
    roleId: "",
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [usersRes, rolesRes]: any = await Promise.all([
          apiClient.getUsers(),
          apiClient.getRoles(),
        ]);
        setUsers(usersRes.users ?? []);
        setRoles(rolesRes.roles ?? []);
      } catch (e: any) {
        setError(e?.message || "Failed to load users");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const resetForm = () => {
    setFormData({
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      phone: "",
      roleId: "",
    });
  };

  const handleOpenAdd = () => {
    setEditingUser(null);
    resetForm();
    setShowAddModal(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: "",
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone || "",
      roleId: user.role.id,
    });
    setShowEditModal(true);
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.createUser({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone || undefined,
        roleId: formData.roleId,
      });
      const res: any = await apiClient.getUsers();
      setUsers(res.users ?? []);
      resetForm();
      setShowAddModal(false);
    } catch (e: any) {
      setError(e?.message || "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.updateUser(editingUser.id, {
        email: formData.email,
        password: formData.password || undefined,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone || undefined,
        roleId: formData.roleId,
      } as any);
      const res: any = await apiClient.getUsers();
      setUsers(res.users ?? []);
      resetForm();
      setEditingUser(null);
      setShowEditModal(false);
    } catch (e: any) {
      setError(e?.message || "Failed to update user");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    setError(null);
    try {
      await apiClient.deleteUser(id);
      const res: any = await apiClient.getUsers();
      setUsers(res.users ?? []);
    } catch (e: any) {
      setError(e?.message || "Failed to delete user");
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamLeaderId) {
      setError("Please select a Team Leader");
      return;
    }
    if (!teamName.trim()) {
      setError("Please enter a team name");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await apiClient.updateUser(teamLeaderId, {
        teamMemberIds,
        teamName: teamName.trim(),
      } as any);
      const res: any = await apiClient.getUsers();
      setUsers(res.users ?? []);
      setTeamName("");
      setTeamLeaderId("");
      setTeamMemberIds([]);
      setShowTeamModal(false);
    } catch (e: any) {
      setError(e?.message || "Failed to create/update team");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignEmployeeCodes = async () => {
    if (!confirm("Are you sure you want to assign employee codes to all users who don't have one?")) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response: any = await apiClient.assignEmployeeCodes();
      alert(response.message || "Employee codes assigned successfully!");
      // Refresh users list
      const res: any = await apiClient.getUsers();
      setUsers(res.users ?? []);
    } catch (e: any) {
      setError(e?.message || "Failed to assign employee codes");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <button
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm md:text-base"
      >
        <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
        <span>Back</span>
      </button>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="h-6 w-6 text-primary-600" />
          User Management
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleAssignEmployeeCodes}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm md:text-base hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Users className="h-4 w-4" />
            <span>{submitting ? "Assigning..." : "Assign Employee Codes"}</span>
          </button>
          <button
            onClick={() => setShowTeamModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm md:text-base hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Create Team</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm md:text-base hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {loading && <p className="text-gray-600">Loading users...</p>}

      {error && (
        <div className="flex items-center gap-2 text-red-600 mb-4 text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Employee Code
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Name
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Email
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Role
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const teamMembers =
                    user.role?.name === "TEAM_LEADER"
                      ? users.filter((u) => u.teamLeaderId === user.id)
                      : [];
                  const leader =
                    user.teamLeaderId &&
                    users.find((u) => u.id === user.teamLeaderId);

                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <div className="font-mono text-sm font-semibold text-primary-600">
                          {user.employeeCode || (
                            <span className="text-gray-400 italic">Not assigned</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="font-medium text-gray-900">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {user.phone || "No phone"}
                        </div>

                        {/* Team info for Team Leader */}
                        {user.role?.name === "TEAM_LEADER" && (
                          <div className="mt-1 text-xs text-indigo-700">
                            <span className="font-semibold">
                              Team:{" "}
                              {user.teamName
                                ? user.teamName
                                : "No team name set"}
                            </span>
                            {teamMembers.length > 0 ? (
                              <span className="ml-1 text-indigo-600">
                                • {teamMembers.length} member
                                {teamMembers.length !== 1 ? "s" : ""}
                              </span>
                            ) : (
                              <span className="ml-1 text-gray-400">
                                • No members
                              </span>
                            )}
                          </div>
                        )}

                        {/* Team info for Telecaller / Counselor etc. */}
                        {leader && user.role?.name !== "TEAM_LEADER" && (
                          <div className="mt-1 text-xs text-gray-600">
                            Team Leader:{" "}
                            <span className="font-medium">
                              {leader.firstName} {leader.lastName}
                            </span>
                            {leader.teamName && (
                              <span className="ml-1 text-gray-500">
                                ({leader.teamName})
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    <td className="px-4 py-2 text-gray-700">{user.email}</td>
                    <td className="px-4 py-2 text-gray-700">
                      {user.role?.name || "N/A"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => handleOpenEdit(user)}
                          className="p-1.5 text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded"
                          title="Edit user"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                          title="Delete user"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Add User</h2>
              <button
                onClick={() => {
                  resetForm();
                  setShowAddModal(false);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitAdd} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required
                  minLength={6}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone (optional)
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={formData.roleId}
                  onChange={(e) =>
                    setFormData({ ...formData, roleId: e.target.value })
                  }
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                >
                  <option value="">Select role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowAddModal(false);
                  }}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Edit User</h2>
              <button
                onClick={() => {
                  resetForm();
                  setEditingUser(null);
                  setShowEditModal(false);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password (optional)
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  minLength={0}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone (optional)
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={formData.roleId}
                  onChange={(e) =>
                    setFormData({ ...formData, roleId: e.target.value })
                  }
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                >
                  <option value="">Select role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setEditingUser(null);
                    setShowEditModal(false);
                  }}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Team Creation Modal */}
      {showTeamModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Create Team</h2>
              <button
                onClick={() => {
                  setShowTeamModal(false);
                  setTeamName("");
                  setTeamLeaderId("");
                  setTeamMemberIds([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Team Name
                </label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="e.g., Team 1, Telecaller Team A"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Team Leader
                </label>
                <select
                  value={teamLeaderId}
                  onChange={(e) => setTeamLeaderId(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                >
                  <option value="">Select Team Leader</option>
                  {users
                    .filter((u) => u.role?.name === "TEAM_LEADER")
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} ({u.email})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Team Members (Telecaller / Counselor)
                </label>
                <div className="border border-gray-300 rounded-md max-h-52 overflow-y-auto px-2 py-1 bg-gray-50">
                  {users
                    .filter((u) =>
                      ["TELECALLER", "COUNSELOR"].includes(u.role?.name)
                    )
                    .map((u) => {
                      const checked = teamMemberIds.includes(u.id);
                      return (
                        <label
                          key={u.id}
                          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setTeamMemberIds((prev) => [...prev, u.id]);
                              } else {
                                setTeamMemberIds((prev) =>
                                  prev.filter((id) => id !== u.id)
                                );
                              }
                            }}
                            className="h-4 w-4 text-primary-600 border-gray-300 rounded"
                          />
                          <span>
                            {u.firstName} {u.lastName} –{" "}
                            <span className="text-gray-500">{u.role?.name}</span>
                          </span>
                        </label>
                      );
                    })}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Team members ko assign karne se unka <code>teamLeaderId</code> is Team Leader par set ho jayega.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowTeamModal(false);
                    setTeamName("");
                    setTeamLeaderId("");
                    setTeamMemberIds([]);
                  }}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Team"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


