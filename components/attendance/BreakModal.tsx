"use client";

import { useState } from "react";
import { X, Coffee, UtensilsCrossed, Users, Wifi, Clock } from "lucide-react";
import { apiClient } from "@/lib/api";

interface BreakModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBreakStart: () => void;
}

const breakTypes = [
  { value: "break", label: "Break", icon: Coffee, color: "bg-blue-100 text-blue-700" },
  { value: "meeting", label: "Meeting", icon: Users, color: "bg-purple-100 text-purple-700" },
  { value: "bio_break", label: "Bio Break", icon: Wifi, color: "bg-green-100 text-green-700" },
  { value: "lunch", label: "Lunch", icon: UtensilsCrossed, color: "bg-orange-100 text-orange-700" },
  { value: "tea_break", label: "Tea Break", icon: Coffee, color: "bg-yellow-100 text-yellow-700" },
];

export default function BreakModal({ isOpen, onClose, onBreakStart }: BreakModalProps) {
  const [selectedBreakType, setSelectedBreakType] = useState<string>("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartBreak = async () => {
    if (!selectedBreakType) {
      setError("Please select a break type");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await apiClient.startBreak({
        breakType: selectedBreakType as any,
        reason: reason.trim() || undefined,
      });
      // Trigger immediate update
      window.dispatchEvent(new Event("sessionUpdated"));
      onBreakStart();
      handleClose();
    } catch (err: any) {
      setError(err.message || "Failed to start break");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedBreakType("");
    setReason("");
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Start Break</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={loading}
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Break Type Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Break Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {breakTypes.map((breakType) => {
                const Icon = breakType.icon;
                const isSelected = selectedBreakType === breakType.value;
                return (
                  <button
                    key={breakType.value}
                    onClick={() => setSelectedBreakType(breakType.value)}
                    disabled={loading}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? `${breakType.color} border-current`
                        : "bg-gray-50 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <Icon className="h-6 w-6 mx-auto mb-2" />
                    <span className="text-sm font-medium">{breakType.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reason (Optional) */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason (Optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Add any additional notes..."
              rows={3}
              disabled={loading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleStartBreak}
              disabled={loading || !selectedBreakType}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Starting...</span>
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4" />
                  <span>Start Break</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

