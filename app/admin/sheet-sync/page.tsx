"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Trash2,
  Power,
  PowerOff,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowLeft,
  Link2,
  Settings,
} from "lucide-react";
import { apiClient } from "@/lib/api";

interface SheetSync {
  id: string;
  sheetUrl: string;
  sheetId: string;
  name: string;
  isActive: boolean;
  lastSyncedAt: string | null;
  lastRowCount: number;
  syncInterval: number;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  _count?: {
    leads: number;
  };
}

export default function SheetSyncPage() {
  const router = useRouter();
  const [syncs, setSyncs] = useState<SheetSync[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    sheetUrl: "",
    name: "",
    syncInterval: 5,
  });

  useEffect(() => {
    fetchSyncs();
    // Auto-refresh every 30 seconds to show latest sync status
    const interval = setInterval(() => {
      fetchSyncs();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchSyncs = async () => {
    try {
      const response = await apiClient.getSheetSyncs();
      setSyncs(response.syncs || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch connected sheets");
    } finally {
      setLoading(false);
    }
  };

  const handleConnectSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiClient.createSheetSync(formData);
      setSuccess("Google Sheet connected successfully!");
      setTimeout(() => setSuccess(null), 3000);
      setFormData({ sheetUrl: "", name: "", syncInterval: 5 });
      setShowAddModal(false);
      fetchSyncs();
    } catch (err: any) {
      setError(err.message || "Failed to connect Google Sheet");
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await apiClient.updateSheetSync(id, { isActive: !isActive });
      fetchSyncs();
    } catch (err: any) {
      setError(err.message || "Failed to update sync status");
    }
  };

  const handleManualSync = async (id: string) => {
    setSyncing(id);
    try {
      const response = await apiClient.triggerSheetSync(id);
      setSuccess(`Sync completed! ${response.imported} new lead(s) imported.`);
      setTimeout(() => setSuccess(null), 5000);
      fetchSyncs();
    } catch (err: any) {
      setError(err.message || "Failed to sync");
    } finally {
      setSyncing(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to disconnect this Google Sheet?")) {
      return;
    }
    try {
      await apiClient.deleteSheetSync(id);
      setSuccess("Google Sheet disconnected successfully");
      setTimeout(() => setSuccess(null), 3000);
      fetchSyncs();
    } catch (err: any) {
      setError(err.message || "Failed to disconnect");
    }
  };

  const formatTimeAgo = (date: string | null) => {
    if (!date) return "Never";
    const now = new Date();
    const syncTime = new Date(date);
    const diffMs = now.getTime() - syncTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute(s) ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour(s) ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day(s) ago`;
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading connected sheets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm md:text-base"
        >
          <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
          <span>Back</span>
        </button>

        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              <FileSpreadsheet className="h-7 w-7 md:h-8 md:w-8 text-primary-600" />
              Google Sheets Live Sync
            </h1>
            <p className="text-sm md:text-base text-gray-600">
              Connect Google Sheets for automatic lead import
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 md:px-6 md:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-md w-full md:w-auto justify-center text-sm md:text-base font-medium"
          >
            <Plus className="h-5 w-5" />
            <span>Connect Google Sheet</span>
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

        {/* Connected Sheets List */}
        {syncs.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <FileSpreadsheet className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Google Sheets Connected</h3>
            <p className="text-gray-600 mb-6">
              Connect a Google Sheet to automatically import new leads
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="h-5 w-5" />
              <span>Connect Your First Sheet</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {syncs.map((sync) => (
              <div
                key={sync.id}
                className={`bg-white rounded-lg shadow-sm border-2 p-5 ${
                  sync.isActive ? "border-green-200" : "border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5 text-green-600" />
                      {sync.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-2">
                      {sync.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-md text-xs font-medium">
                          <Power className="h-3 w-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 text-gray-700 rounded-md text-xs font-medium">
                          <PowerOff className="h-3 w-3" />
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    <span className="truncate text-xs">{sync.sheetUrl}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>Syncs every {sync.syncInterval} minute(s)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Last sync: {formatTimeAgo(sync.lastSyncedAt)}</span>
                  </div>
                  {sync._count && (
                    <div className="text-xs text-gray-500">
                      {sync._count.leads} lead(s) imported
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => handleToggleActive(sync.id, sync.isActive)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      sync.isActive
                        ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        : "bg-green-100 text-green-700 hover:bg-green-200"
                    }`}
                  >
                    {sync.isActive ? (
                      <>
                        <PowerOff className="h-4 w-4 inline mr-1" />
                        Disable
                      </>
                    ) : (
                      <>
                        <Power className="h-4 w-4 inline mr-1" />
                        Enable
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleManualSync(sync.id)}
                    disabled={syncing === sync.id}
                    className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                  >
                    {syncing === sync.id ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700"></div>
                        <span>Syncing...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        <span>Sync Now</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(sync.id)}
                    className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Sheet Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="sticky top-0 bg-white border-b border-gray-200 p-4 md:p-6 flex items-center justify-between">
                <h2 className="text-lg md:text-xl font-bold text-gray-900">
                  Connect Google Sheet
                </h2>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setError(null);
                    setFormData({ sheetUrl: "", name: "", syncInterval: 5 });
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleConnectSheet} className="p-4 md:p-6 space-y-4">
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                    <span className="text-sm">{error}</span>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-2 text-sm">Important:</h3>
                  <ul className="list-disc list-inside space-y-1 text-xs text-blue-800">
                    <li>Make sure the Google Sheet is publicly accessible</li>
                    <li>Share > Change to 'Anyone with the link' > Viewer</li>
                    <li>Sheet must have headers: First Name, Last Name, Email, Phone</li>
                  </ul>
                </div>

                <div>
                  <label htmlFor="sheetUrl" className="block text-sm font-medium text-gray-700 mb-1">
                    Google Sheet URL *
                  </label>
                  <input
                    type="url"
                    id="sheetUrl"
                    required
                    value={formData.sheetUrl}
                    onChange={(e) => setFormData({ ...formData, sheetUrl: e.target.value })}
                    placeholder="https://docs.google.com/spreadsheets/d/SHEET_ID/edit"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Custom Name (Optional)
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Main Leads Sheet"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label htmlFor="syncInterval" className="block text-sm font-medium text-gray-700 mb-1">
                    Sync Interval (minutes) *
                  </label>
                  <input
                    type="number"
                    id="syncInterval"
                    required
                    min={1}
                    max={60}
                    value={formData.syncInterval}
                    onChange={(e) =>
                      setFormData({ ...formData, syncInterval: parseInt(e.target.value) || 5 })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    How often to check for new rows (1-60 minutes)
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setFormData({ sheetUrl: "", name: "", syncInterval: 5 });
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    Connect Sheet
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

