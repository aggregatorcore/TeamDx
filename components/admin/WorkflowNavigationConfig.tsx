"use client";

import { useState } from "react";
import { Navigation, Check, X, Plus, Trash2 } from "lucide-react";
import { ROLE_DISPLAY_NAMES } from "@/lib/constants/roles";
import { RoleName } from "@/lib/types/roles";

interface NavigationConfig {
  enabled: boolean;
  visibleRoles: string[];
  entryPoints: string[];
}

interface WorkflowNavigationConfigProps {
  navigation: NavigationConfig;
  onUpdate: (navigation: NavigationConfig) => void;
}

const AVAILABLE_ROLES: RoleName[] = ["TELECALLER", "COUNSELOR", "TEAM_LEADER", "BRANCH_MANAGER", "ADMIN"];
const ENTRY_POINTS = [
  { id: "leads_page", label: "Leads Page", description: "Main leads list page" },
  { id: "lead_detail", label: "Lead Detail", description: "Individual lead detail page" },
  { id: "call_detail", label: "Call Detail", description: "Call detail page" },
];

export default function WorkflowNavigationConfig({ navigation, onUpdate }: WorkflowNavigationConfigProps) {
  const toggleRole = (role: string) => {
    const newRoles = navigation.visibleRoles.includes(role)
      ? navigation.visibleRoles.filter(r => r !== role)
      : [...navigation.visibleRoles, role];
    onUpdate({ ...navigation, visibleRoles: newRoles });
  };

  const toggleEntryPoint = (pointId: string) => {
    const newPoints = navigation.entryPoints.includes(pointId)
      ? navigation.entryPoints.filter(p => p !== pointId)
      : [...navigation.entryPoints, pointId];
    onUpdate({ ...navigation, entryPoints: newPoints });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <Navigation className="h-6 w-6 text-primary-600" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Navigation Control</h2>
          <p className="text-sm text-gray-500">Configure entry points and role visibility</p>
        </div>
      </div>

      {/* Enable/Disable */}
      <div className="mb-6">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={navigation.enabled}
            onChange={(e) => onUpdate({ ...navigation, enabled: e.target.checked })}
            className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
          />
          <span className="text-sm font-medium text-gray-700">Enable Navigation Button</span>
        </label>
        <p className="text-xs text-gray-500 mt-1 ml-8">
          When enabled, workflow navigation button appears on configured pages
        </p>
      </div>

      {/* Role Visibility */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Visible Roles</h3>
        <p className="text-xs text-gray-500 mb-3">Select which roles can see the navigation button</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {AVAILABLE_ROLES.map((role) => {
            const isSelected = navigation.visibleRoles.includes(role);
            return (
              <button
                key={role}
                onClick={() => toggleRole(role)}
                className={`p-3 border-2 rounded-lg text-left transition-all ${
                  isSelected
                    ? "border-primary-500 bg-primary-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">
                    {ROLE_DISPLAY_NAMES[role]}
                  </span>
                  {isSelected ? (
                    <Check className="h-5 w-5 text-primary-600" />
                  ) : (
                    <X className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Entry Points */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Entry Points</h3>
        <p className="text-xs text-gray-500 mb-3">Select where the navigation button should appear</p>
        <div className="space-y-3">
          {ENTRY_POINTS.map((point) => {
            const isSelected = navigation.entryPoints.includes(point.id);
            return (
              <button
                key={point.id}
                onClick={() => toggleEntryPoint(point.id)}
                className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                  isSelected
                    ? "border-primary-500 bg-primary-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{point.label}</div>
                    <div className="text-xs text-gray-500 mt-1">{point.description}</div>
                  </div>
                  {isSelected ? (
                    <Check className="h-5 w-5 text-primary-600" />
                  ) : (
                    <X className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
