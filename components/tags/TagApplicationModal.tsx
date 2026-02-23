"use client";

import { useState, useEffect } from "react";
import { X, Calendar, Clock, FileText, AlertCircle } from "lucide-react";
import { apiClient } from "@/lib/api";
import ActionPreview from "./ActionPreview";
import { triggerWorkflowOnTagApplication } from "@/lib/utils/workflowTrigger";

interface TagApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  tag: {
    id: string;
    name: string;
    color: string;
    requiresNote?: boolean;
    requiresCallback?: boolean;
    requiresFollowUp?: boolean;
    actions?: string | null; // JSON string of action rules
  };
  entityType: "lead" | "call" | "task";
  entityId: string;
  onSuccess: () => void;
}

export default function TagApplicationModal({
  isOpen,
  onClose,
  tag,
  entityType,
  entityId,
  onSuccess,
}: TagApplicationModalProps) {
  const [note, setNote] = useState("");
  const [callbackDate, setCallbackDate] = useState("");
  const [callbackTime, setCallbackTime] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpTime, setFollowUpTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showSuccessToast = (message: string) => {
    const toast = document.createElement("div");
    toast.className = "fixed top-4 right-4 z-[60] bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-top";
    toast.innerHTML = `
      <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
      </svg>
      <span>${message}</span>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add("animate-out", "slide-out-to-top");
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  };

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setNote("");
      setCallbackDate("");
      setCallbackTime("");
      setFollowUpDate("");
      setFollowUpTime("");
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    setError(null);

    // Validate required fields
    if (tag.requiresNote && !note.trim()) {
      setError("Note is required for this tag");
      return;
    }

    if (tag.requiresCallback && (!callbackDate || !callbackTime)) {
      setError("Callback date and time are required for this tag");
      return;
    }

    if (tag.requiresFollowUp && (!followUpDate || !followUpTime)) {
      setError("Follow-up date and time are required for this tag");
      return;
    }

    setLoading(true);
    try {
      const data: any = {
        tagId: tag.id,
      };

      if (note.trim()) {
        data.note = note.trim();
      }

      if (callbackDate && callbackTime) {
        data.callbackDateTime = new Date(`${callbackDate}T${callbackTime}`).toISOString();
      }

      if (followUpDate && followUpTime) {
        data.followUpDateTime = new Date(`${followUpDate}T${followUpTime}`).toISOString();
      }

      if (entityType === "lead") {
        await apiClient.applyTagToLead(entityId, data);
        
        // Trigger workflow execution if active workflow exists
        try {
          const workflowResult = await triggerWorkflowOnTagApplication(
            entityId,
            tag.id,
            tag.name
          );
          
          if (workflowResult.success) {
            console.log("[AgentTagNavigation] Workflow triggered:", workflowResult.message);
          } else {
            console.log("[AgentTagNavigation] Workflow not triggered:", workflowResult.message || workflowResult.error);
          }
        } catch (workflowError) {
          // Don't fail tag application if workflow trigger fails
          console.error("[AgentTagNavigation] Workflow trigger error:", workflowError);
        }
      } else if (entityType === "call") {
        await apiClient.applyTagToCall(entityId, data);
      }

      // Show success message (AG_UI_07)
      showSuccessToast("Tag applied successfully");
      
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Error applying tag:", err);
      setError(err.message || "Failed to apply tag");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
              style={{ backgroundColor: tag.color }}
            >
              <span className="text-lg font-bold">{tag.name.charAt(0)}</span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Apply Tag</h2>
              <p className="text-sm text-gray-600">{tag.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div className="space-y-4">
          {tag.requiresNote && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Note <span className="text-red-500">*</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={3}
                placeholder="Enter note..."
                required
              />
            </div>
          )}

          {tag.requiresCallback && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Callback Date & Time <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={callbackDate}
                  onChange={(e) => setCallbackDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
                <input
                  type="time"
                  value={callbackTime}
                  onChange={(e) => setCallbackTime(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
            </div>
          )}

          {tag.requiresFollowUp && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Follow-up Date & Time <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
                <input
                  type="time"
                  value={followUpTime}
                  onChange={(e) => setFollowUpTime(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
            </div>
          )}

          {!tag.requiresNote && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Note (Optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={3}
                placeholder="Enter note (optional)..."
              />
            </div>
          )}

          {/* Action Preview */}
          <ActionPreview actionsJson={tag.actions} />
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Applying..." : "Apply Tag"}
          </button>
        </div>
      </div>
    </div>
  );
}
