"use client";

import { useState } from "react";
import { Shield, Plus, Edit, Trash2, Check, X } from "lucide-react";
import { RoleName } from "@/lib/types/roles";
import { ROLE_DISPLAY_NAMES, ROLE_DESCRIPTIONS } from "@/lib/constants/roles";

interface Permission {
  id: string;
  name: string;
  module: string;
  action: string;
  description?: string;
}

interface RoleWithPermissions {
  id: string;
  name: RoleName;
  description: string;
  level: number;
  permissions: Permission[];
}

// Mock data - will be replaced with actual API data
const mockRoles: RoleWithPermissions[] = [
  {
    id: "1",
    name: "ADMIN",
    description: ROLE_DESCRIPTIONS.ADMIN,
    level: 1,
    permissions: [
      { id: "1", name: "users.create", module: "users", action: "create", description: "Create users" },
      { id: "2", name: "users.read", module: "users", action: "read", description: "View users" },
      { id: "3", name: "roles.manage", module: "roles", action: "manage", description: "Manage roles" },
    ],
  },
  {
    id: "2",
    name: "BRANCH_MANAGER",
    description: ROLE_DESCRIPTIONS.BRANCH_MANAGER,
    level: 2,
    permissions: [
      { id: "2", name: "users.read", module: "users", action: "read", description: "View users" },
      { id: "4", name: "applications.manage", module: "applications", action: "manage", description: "Manage applications" },
    ],
  },
];

const availablePermissions: Permission[] = [
  { id: "1", name: "users.create", module: "users", action: "create", description: "Create users" },
  { id: "2", name: "users.read", module: "users", action: "read", description: "View users" },
  { id: "3", name: "users.update", module: "users", action: "update", description: "Update users" },
  { id: "4", name: "users.delete", module: "users", action: "delete", description: "Delete users" },
  { id: "5", name: "applications.create", module: "applications", action: "create", description: "Create applications" },
  { id: "6", name: "applications.read", module: "applications", action: "read", description: "View applications" },
  { id: "7", name: "applications.update", module: "applications", action: "update", description: "Update applications" },
  { id: "8", name: "applications.delete", module: "applications", action: "delete", description: "Delete applications" },
  { id: "9", name: "roles.manage", module: "roles", action: "manage", description: "Manage roles and permissions" },
  { id: "10", name: "reports.view", module: "reports", action: "view", description: "View reports" },
  { id: "11", name: "reports.generate", module: "reports", action: "generate", description: "Generate reports" },
];

export default function RolesManagementPage() {
  const [roles, setRoles] = useState<RoleWithPermissions[]>(mockRoles);
  const [selectedRole, setSelectedRole] = useState<RoleWithPermissions | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  const handleEditRole = (role: RoleWithPermissions) => {
    setSelectedRole(role);
    setIsEditing(true);
    setShowPermissionModal(true);
  };

  const handleSavePermissions = (permissions: Permission[]) => {
    if (selectedRole) {
      setRoles(
        roles.map((r) =>
          r.id === selectedRole.id ? { ...r, permissions } : r
        )
      );
    }
    setShowPermissionModal(false);
    setSelectedRole(null);
    setIsEditing(false);
  };

  const togglePermission = (permission: Permission) => {
    if (!selectedRole) return;

    const hasPermission = selectedRole.permissions.some(
      (p) => p.id === permission.id
    );

    let updatedPermissions: Permission[];
    if (hasPermission) {
      updatedPermissions = selectedRole.permissions.filter(
        (p) => p.id !== permission.id
      );
    } else {
      updatedPermissions = [...selectedRole.permissions, permission];
    }

    setSelectedRole({ ...selectedRole, permissions: updatedPermissions });
  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary-600" />
            Roles & Permissions
          </h1>
          <p className="text-gray-600">
            Manage roles and customize permissions for each role
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
          <Plus className="h-5 w-5" />
          <span className="hidden md:inline">Add Role</span>
        </button>
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {roles.map((role) => (
          <div
            key={role.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {ROLE_DISPLAY_NAMES[role.name]}
                </h3>
                <p className="text-sm text-gray-500 mt-1">{role.description}</p>
                <span className="inline-block mt-2 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                  Level {role.level}
                </span>
              </div>
              <button
                onClick={() => handleEditRole(role)}
                className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              >
                <Edit className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Permissions ({role.permissions.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {role.permissions.slice(0, 3).map((perm) => (
                  <span
                    key={perm.id}
                    className="px-2 py-1 text-xs bg-primary-50 text-primary-700 rounded"
                  >
                    {perm.module}.{perm.action}
                  </span>
                ))}
                {role.permissions.length > 3 && (
                  <span className="px-2 py-1 text-xs text-gray-500">
                    +{role.permissions.length - 3} more
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Permission Management Modal */}
      {showPermissionModal && selectedRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Edit Permissions - {ROLE_DISPLAY_NAMES[selectedRole.name]}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Select permissions for this role
                </p>
              </div>
              <button
                onClick={() => {
                  setShowPermissionModal(false);
                  setSelectedRole(null);
                  setIsEditing(false);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                {availablePermissions.map((permission) => {
                  const hasPermission = selectedRole.permissions.some(
                    (p) => p.id === permission.id
                  );
                  return (
                    <label
                      key={permission.id}
                      className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={hasPermission}
                        onChange={() => togglePermission(permission)}
                        className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {permission.name}
                          </span>
                          {hasPermission && (
                            <Check className="h-4 w-4 text-green-500" />
                          )}
                        </div>
                        {permission.description && (
                          <p className="text-sm text-gray-600 mt-1">
                            {permission.description}
                          </p>
                        )}
                        <span className="inline-block mt-2 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                          {permission.module} / {permission.action}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowPermissionModal(false);
                  setSelectedRole(null);
                  setIsEditing(false);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSavePermissions(selectedRole.permissions)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Save Permissions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

