"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { BUCKET_CONFIG, BucketType } from "@/lib/utils/buckets";
import { ROLE_DISPLAY_NAMES, ROLE_HIERARCHY } from "@/lib/constants/roles";
import { RoleName } from "@/lib/types/roles";
import { Settings, Save, Loader2, AlertCircle, CheckCircle2, Lock } from "lucide-react";
import LoadingButton from "@/components/LoadingButton";

interface BucketSettings {
  id: string;
  bucketType: BucketType;
  enabled: boolean;
  roleVisibility: Record<RoleName, boolean>;
}

const BUCKET_TYPES: BucketType[] = ["fresh", "green", "orange", "red"];

// Special buckets that need special handling
const CALLBACK_DUE_BUCKET: BucketType = "orange"; // Callback Due
const OVERDUE_BUCKET: BucketType = "red"; // Overdue (mandatory for all roles)

export default function BucketsControlPage() {
  const [buckets, setBuckets] = useState<BucketSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Get all roles
  const allRoles = Object.keys(ROLE_HIERARCHY) as RoleName[];

  useEffect(() => {
    loadBuckets();
  }, []);

  const loadBuckets = async () => {
    try {
      setLoading(true);
      setError(null);

      // For now, initialize with default settings
      // TODO: Replace with actual API call when backend is ready
      const defaultBuckets: BucketSettings[] = BUCKET_TYPES.map((bucketType) => ({
        id: bucketType,
        bucketType,
        enabled: true,
        roleVisibility: allRoles.reduce((acc, role) => {
          acc[role] = true; // Default: visible to all roles
          return acc;
        }, {} as Record<RoleName, boolean>),
      }));

      setBuckets(defaultBuckets);
    } catch (err: any) {
      console.error("Error loading buckets:", err);
      setError(err.message || "Failed to load buckets");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEnabled = (bucketId: string) => {
    setBuckets((prev) =>
      prev.map((bucket) =>
        bucket.id === bucketId
          ? { ...bucket, enabled: !bucket.enabled }
          : bucket
      )
    );
  };

  const handleToggleRoleVisibility = (bucketId: string, role: RoleName) => {
    // Overdue bucket is mandatory - cannot disable for any role
    const bucket = buckets.find((b) => b.id === bucketId);
    if (bucket?.bucketType === OVERDUE_BUCKET) {
      setError("Overdue bucket cannot be disabled for any role");
      setTimeout(() => setError(null), 3000);
      return;
    }

    setBuckets((prev) =>
      prev.map((bucket) =>
        bucket.id === bucketId
          ? {
              ...bucket,
              roleVisibility: {
                ...bucket.roleVisibility,
                [role]: !bucket.roleVisibility[role],
              },
            }
          : bucket
      )
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      // TODO: Replace with actual API call when backend is ready
      // await apiClient.updateBucketSettings(buckets);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setSuccess("Bucket settings saved successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Error saving buckets:", err);
      setError(err.message || "Failed to save bucket settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Buckets Control
        </h1>
        <p className="text-gray-600 mt-1">
          Manage bucket visibility and enable/disable buckets for different roles
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <span className="text-red-800">{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <span className="text-green-800">{success}</span>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6">
          <div className="space-y-6">
            {buckets.map((bucket) => {
              const bucketInfo = BUCKET_CONFIG[bucket.bucketType];
              const isOverdue = bucket.bucketType === OVERDUE_BUCKET;
              const isCallbackDue = bucket.bucketType === CALLBACK_DUE_BUCKET;

              return (
                <div
                  key={bucket.id}
                  className="border border-gray-200 rounded-lg p-5 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${bucketInfo.bgColor} ${bucketInfo.borderColor} border`}
                      >
                        <span className={`text-lg font-semibold ${bucketInfo.color}`}>
                          {bucketInfo.label}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {bucketInfo.label === "Orange"
                            ? "Callback Due"
                            : bucketInfo.label === "Red"
                            ? "Overdue"
                            : bucketInfo.label}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {isCallbackDue
                            ? "Leads with scheduled callbacks"
                            : isOverdue
                            ? "Leads that are overdue (mandatory for all roles)"
                            : `${bucketInfo.label} bucket leads`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {isOverdue && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Lock className="h-4 w-4" />
                          <span>Mandatory</span>
                        </div>
                      )}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={bucket.enabled}
                          onChange={() => handleToggleEnabled(bucket.id)}
                          disabled={isOverdue} // Overdue cannot be disabled
                          className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          Enabled
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">
                      Role Visibility
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {allRoles.map((role) => {
                        const isVisible = bucket.roleVisibility[role];
                        const isMandatory = isOverdue; // Overdue is mandatory for all roles

                        return (
                          <label
                            key={role}
                            className={`flex items-center gap-2 p-2 rounded-md border ${
                              isVisible
                                ? "bg-blue-50 border-blue-200"
                                : "bg-gray-50 border-gray-200"
                            } ${isMandatory ? "opacity-75" : "cursor-pointer"}`}
                          >
                            <input
                              type="checkbox"
                              checked={isVisible}
                              onChange={() =>
                                handleToggleRoleVisibility(bucket.id, role)
                              }
                              disabled={isMandatory} // Overdue cannot be disabled
                              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                            />
                            <span className="text-sm text-gray-700">
                              {ROLE_DISPLAY_NAMES[role]}
                            </span>
                            {isMandatory && (
                              <Lock className="h-3 w-3 text-gray-400" />
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex justify-end">
            <LoadingButton
              onClick={handleSave}
              loading={saving}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Save Settings
            </LoadingButton>
          </div>
        </div>
      </div>
    </div>
  );
}
