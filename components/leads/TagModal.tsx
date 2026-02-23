"use client";

import { useState, useEffect } from "react";
import { X, Tag as TagIcon, Calendar, Clock, FileText, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import LoadingButton from "@/components/LoadingButton";

interface TagFlow {
  id: string;
  name: string;
  tagValue: string;
  color: string;
  icon?: string | null;
  category?: string | null;
  requiresNote?: boolean;
  requiresCallback?: boolean;
  requiresFollowUp?: boolean;
}

interface TagModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  onTagApplied: () => void;
  currentTagId?: string; // For rescheduling callback
  userRole?: string; // Current user role for RBAC filtering
  attemptCount?: number; // Current attempt count for "No Answer" tag (for max attempts check)
  maxAttempts?: number; // Max attempts allowed (default: 3)
}

export default function TagModal({
  isOpen,
  onClose,
  leadId,
  onTagApplied,
  currentTagId,
  userRole,
  attemptCount = 0,
  maxAttempts = 3,
}: TagModalProps) {
  const [tags, setTags] = useState<TagFlow[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);
  const [selectedTag, setSelectedTag] = useState<TagFlow | null>(null);
  const [note, setNote] = useState("");
  const [callbackDate, setCallbackDate] = useState("");
  const [callbackTime, setCallbackTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shuffleSuccess, setShuffleSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchTags();
      // Reset form
      setSelectedTag(null);
      setNote("");
      setCallbackDate("");
      setCallbackTime("");
      setError(null);
      setShuffleSuccess(null);
    }
  }, [isOpen]);

  const fetchTags = async () => {
    try {
      setLoadingTags(true);
      const response = await apiClient.getTagFlowsActive();
      let allTags = response.tagFlows || [];
      
      // RBAC: No Answer & Wrong Number — TELECALLER only (same as backend)
      if (userRole && userRole !== "TELECALLER") {
        allTags = allTags.filter(
          (tag) => tag.tagValue !== "no_answer" && tag.tagValue !== "wrong_number"
        );
      }
      
      setTags(allTags);
    } catch (err: any) {
      console.error("Error fetching tags:", err);
      setError(err.message || "Failed to fetch tags");
    } finally {
      setLoadingTags(false);
    }
  };

  const handleTagSelect = (tag: TagFlow) => {
    setSelectedTag(tag);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!selectedTag) {
      setError("Please select a tag");
      return;
    }

    // Validate required fields
    if (selectedTag.requiresNote && !note.trim()) {
      setError("Note is required for this tag");
      return;
    }

    if (selectedTag.requiresCallback && (!callbackDate || !callbackTime)) {
      setError("Callback date and time are required for this tag");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const data: any = {
        tagId: selectedTag.id,
      };

      if (note.trim()) {
        data.note = note.trim();
      }

      if (callbackDate && callbackTime) {
        // Combine date and time into ISO string
        const callbackDateTime = new Date(`${callbackDate}T${callbackTime}`).toISOString();
        data.callbackDateTime = callbackDateTime;
      }

      const result = await apiClient.applyTagToLead(leadId, data);

      // 3 attempts ke baad: auto-shuffle — lead dusre telecaller ko transfer, apni list se hatao
      if (result?.shuffled) {
        setShuffleSuccess(
          result.newOwnerName
            ? `Lead transferred to ${result.newOwnerName}. It will be removed from your list.`
            : "Lead transferred to another telecaller. It will be removed from your list."
        );
        onTagApplied?.(); // Refresh list so lead disappears
        setTimeout(() => {
          onClose?.();
        }, 1800);
        return;
      }
      onTagApplied();
      onClose();
    } catch (err: any) {
      console.error("Error applying tag:", err);
      if (err?.status === 409 || err?.exhausted) {
        setError(err?.message || "Pool exhausted. TL/Manager will reassign or escalate.");
      } else if (err?.message?.includes?.("Max attempts") || err?.message?.includes?.("Pool exhausted")) {
        setError(err.message);
      } else {
        setError(err.message || "Failed to apply tag");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReschedule = () => {
    // For rescheduling, we need to apply the same tag with new callbackAt
    // This will be handled by selecting current tag and setting new callback
    if (currentTagId) {
      const currentTag = tags.find(t => t.id === currentTagId);
      if (currentTag) {
        setSelectedTag(currentTag);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TagIcon className="h-6 w-6 text-primary-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {currentTagId ? "Reschedule Callback" : "Apply Tag"}
              </h2>
              <p className="text-sm text-gray-500">
                {currentTagId 
                  ? "Update callback date and time"
                  : "Select a tag and optionally schedule a callback"
                }
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={submitting}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Shuffle success: lead transferred to another telecaller */}
          {shuffleSuccess && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm">{shuffleSuccess}</span>
            </div>
          )}

          {/* Tag Selection */}
          {!currentTagId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select Tag <span className="text-red-500">*</span>
              </label>
              {loadingTags ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  <span className="ml-2 text-sm text-gray-500">Loading tags...</span>
                </div>
              ) : tags.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <TagIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>No tags available</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                  {tags.map((tag) => {
                    // Check if "No Answer" tag has reached max attempts
                    const isNoAnswerTag = tag.tagValue === "no_answer";
                    const isMaxAttemptsReached = isNoAnswerTag && attemptCount >= maxAttempts;
                    const isDisabled = isMaxAttemptsReached;

                    return (
                      <button
                        key={tag.id}
                        onClick={() => {
                          if (!isDisabled) {
                            handleTagSelect(tag);
                          }
                        }}
                        disabled={isDisabled}
                        className={`p-3 rounded-lg border-2 transition-all text-left ${
                          isDisabled
                            ? "border-gray-200 bg-gray-100 opacity-60 cursor-not-allowed"
                            : selectedTag?.id === tag.id
                            ? "border-primary-600 bg-primary-50"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                        title={isDisabled ? `Max attempts (${maxAttempts}) reached for this tag. Please escalate instead.` : undefined}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {tag.name}
                          </span>
                        </div>
                        {tag.category && (
                          <p className="text-xs text-gray-500 truncate">{tag.category}</p>
                        )}
                        {isDisabled && (
                          <p className="text-xs text-red-600 font-medium mt-1">
                            Max attempts reached
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Selected Tag Info */}
          {selectedTag && (
            <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                  style={{ backgroundColor: selectedTag.color }}
                >
                  <span className="text-lg font-bold">{selectedTag.name.charAt(0)}</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{selectedTag.name}</p>
                  {selectedTag.requiresNote && (
                    <p className="text-xs text-gray-600">Note required</p>
                  )}
                  {selectedTag.requiresCallback && (
                    <p className="text-xs text-gray-600">Callback required</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Note Input */}
          {(selectedTag || currentTagId) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FileText className="h-4 w-4 inline mr-1" />
                Note {selectedTag?.requiresNote && <span className="text-red-500">*</span>}
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                rows={3}
                placeholder="Add a note (optional)"
                required={selectedTag?.requiresNote}
              />
            </div>
          )}

          {/* Callback Scheduling */}
          {(selectedTag?.requiresCallback || currentTagId) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="h-4 w-4 inline mr-1" />
                Callback Date & Time {selectedTag?.requiresCallback && <span className="text-red-500">*</span>}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <input
                    type="date"
                    value={callbackDate}
                    onChange={(e) => setCallbackDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required={selectedTag?.requiresCallback}
                  />
                </div>
                <div>
                  <input
                    type="time"
                    value={callbackTime}
                    onChange={(e) => setCallbackTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required={selectedTag?.requiresCallback}
                  />
                </div>
              </div>
              {callbackDate && callbackTime && (
                <p className="mt-2 text-sm text-gray-600">
                  Callback scheduled for: {new Date(`${callbackDate}T${callbackTime}`).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <LoadingButton
            onClick={handleSubmit}
            loading={submitting}
            disabled={!selectedTag && !currentTagId}
          >
            {currentTagId ? "Reschedule" : "Apply Tag"}
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}
