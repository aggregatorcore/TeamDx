"use client";

import { useState, useEffect } from "react";
import { X, Phone, Tag, Loader2, AlertCircle, Calendar, Clock } from "lucide-react";
import { apiClient } from "@/lib/api";

interface CallTaggingModalProps {
  isOpen: boolean;
  onClose: () => void;
  callData: {
    callId?: string;
    requestId: string;
    phoneNumber: string;
    leadId?: string;
    duration?: number;
    wasConnected?: boolean;
  };
  onTagged?: () => void;
}

export default function CallTaggingModal({
  isOpen,
  onClose,
  callData,
  onTagged
}: CallTaggingModalProps) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagOptions, setTagOptions] = useState<any[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);
  const [callbackDate, setCallbackDate] = useState("");
  const [callbackTime, setCallbackTime] = useState("");

  // Fetch tag options on mount
  useEffect(() => {
    console.log("[CallTaggingModal] useEffect - isOpen:", isOpen);
    const fetchTags = async () => {
      try {
        console.log("[CallTaggingModal] Fetching tags...");
        setLoadingTags(true);
        const response = await apiClient.getActiveTagFlows("call_status");
        console.log("[CallTaggingModal] Tags fetched:", response.tagFlows);
        setTagOptions(response.tagFlows || []);
      } catch (error) {
        console.error("[CallTaggingModal] Failed to fetch tag flows:", error);
        setTagOptions([]);
      } finally {
        setLoadingTags(false);
        console.log("[CallTaggingModal] Tags loading complete");
      }
    };

    if (isOpen) {
      console.log("[CallTaggingModal] Modal opened, fetching tags and resetting form");
      fetchTags();
      // Reset form when modal opens
      setSelectedTag(null);
      setNotes("");
      setError(null);
      setCallbackDate("");
      setCallbackTime("");
    } else {
      console.log("[CallTaggingModal] Modal closed");
    }
  }, [isOpen]);

  // Auto-fill callback date/time when "call back today" is selected
  useEffect(() => {
    console.log("[CallTaggingModal] Auto-fill effect:", { selectedTag, isCallbackTag, callbackDate, callbackTime });
    if (selectedTag && selectedTag.toLowerCase().includes("call back today")) {
      console.log("[CallTaggingModal] 'Call back today' detected, auto-filling date/time");
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
      setCallbackDate(today);
      setCallbackTime(currentTime);
      console.log("[CallTaggingModal] Auto-filled:", { today, currentTime });
    } else if (selectedTag && isCallbackTag && !callbackDate) {
      console.log("[CallTaggingModal] Callback tag selected, setting default date to today");
      // For other callback tags, set default to today if not set
      const today = new Date().toISOString().split('T')[0];
      setCallbackDate(today);
    }
  }, [selectedTag, isCallbackTag, callbackDate]);

  if (!isOpen) return null;

  // Check if callback tag is selected (more flexible matching)
  // Handles: "call back", "call back today", "callback", etc.
  // Check both tagValue and name from tagOptions
  const isCallbackTag = selectedTag ? (() => {
    const tagLower = selectedTag.toLowerCase();
    const tagOption = tagOptions.find(t => t.tagValue === selectedTag || t.name === selectedTag);
    const tagName = tagOption?.name?.toLowerCase() || '';
    const tagValue = tagOption?.tagValue?.toLowerCase() || tagLower;
    
    console.log("[CallTaggingModal] Checking tag:", {
      selectedTag,
      tagLower,
      tagOption: tagOption ? { id: tagOption.id, name: tagOption.name, tagValue: tagOption.tagValue } : null,
      tagName,
      tagValue,
      allTagOptions: tagOptions.map(t => ({ name: t.name, tagValue: t.tagValue }))
    });
    
    const matches = 
      tagLower.includes("callback") || 
      tagLower.includes("call back") ||
      tagLower.includes("call-back") ||
      tagLower.includes("call_back") ||
      tagName.includes("callback") ||
      tagName.includes("call back") ||
      tagValue.includes("callback") ||
      tagValue.includes("call back");
    
    console.log("[CallTaggingModal] Tag match result:", {
      selectedTag,
      tagName,
      tagValue,
      matches,
      isCallbackTag: matches,
      checks: {
        tagLowerIncludesCallback: tagLower.includes("callback"),
        tagLowerIncludesCallBack: tagLower.includes("call back"),
        tagNameIncludesCallback: tagName.includes("callback"),
        tagNameIncludesCallBack: tagName.includes("call back"),
        tagValueIncludesCallback: tagValue.includes("callback"),
        tagValueIncludesCallBack: tagValue.includes("call back"),
      }
    });
    
    return matches;
  })() : false;
  
  console.log("[CallTaggingModal] Render state:", {
    isOpen,
    selectedTag,
    isCallbackTag,
    callbackDate,
    callbackTime,
    tagOptionsCount: tagOptions.length,
    loadingTags
  });

  const handleTagCall = async () => {
    if (!selectedTag) {
      setError("Please select a tag");
      return;
    }
    
    if (isCallbackTag && (!callbackDate || !callbackTime)) {
      setError("Callback date and time are required");
      return;
    }

    // Check if selected tag requires note
    const selectedTagFlow = tagOptions.find(t => t.tagValue === selectedTag);
    if (selectedTagFlow?.requiresNote && !notes.trim()) {
      setError("Note is required for this tag");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Update lead with tag and status
      if (callData.leadId) {
        // Determine lead status based on tag
        let leadStatus = "contacted"; // default
        if (selectedTag === "interested" || selectedTag?.toLowerCase().includes("interested")) {
          leadStatus = "qualified";
        } else if (selectedTag === "not_interested" || selectedTag?.toLowerCase().includes("not interested")) {
          leadStatus = "lost";
        }

        // Prepare update data
        const updateData: any = {
          callStatus: selectedTag,
          status: leadStatus,
        };

        // Add notes if provided
        if (notes) {
          updateData.notes = `[Call Tag: ${selectedTag}] ${notes}`.trim();
        }

        // Add callback time if callback tag is selected and date/time are provided
        if (isCallbackTag && callbackDate && callbackTime) {
          // Combine date and time into ISO string
          const callbackDateTime = new Date(`${callbackDate}T${callbackTime}`).toISOString();
          updateData.callbackScheduledAt = callbackDateTime;
        } else if (isCallbackTag && callbackDate) {
          // If only date is provided, set time to 9:00 AM
          const callbackDateTime = new Date(`${callbackDate}T09:00`).toISOString();
          updateData.callbackScheduledAt = callbackDateTime;
        }

        await apiClient.updateLead(callData.leadId, updateData);
      }

      // Update call notes if callId is available
      if (callData.callId && notes) {
        try {
          await apiClient.updateCall(callData.callId, {
            notes: notes
          });
        } catch (err) {
          console.error("Failed to update call notes:", err);
          // Don't fail the whole operation if call update fails
        }
      }

      // Increment tag usage count
      if (selectedTagFlow) {
        try {
          await apiClient.incrementTagFlowUsage(selectedTagFlow.id);
        } catch (err) {
          console.error("Failed to increment tag usage:", err);
          // Don't fail the whole operation if increment fails
        }
      }

      onTagged?.();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to tag call");
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  console.log("[CallTaggingModal] ========== RENDER ==========");
  console.log("[CallTaggingModal] State:", {
    isOpen,
    selectedTag,
    isCallbackTag,
    callbackDate,
    callbackTime,
    tagOptionsCount: tagOptions.length,
    loadingTags
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Debug Panel */}
        <div className="mb-4 p-3 bg-yellow-100 border-2 border-yellow-400 rounded-lg text-xs font-mono max-h-40 overflow-y-auto">
          <div className="font-bold mb-2 text-yellow-800">🔍 DEBUG INFO:</div>
          <div>isOpen: <span className="font-bold">{String(isOpen)}</span></div>
          <div>selectedTag: <span className="font-bold">"{selectedTag || 'null'}"</span></div>
          <div>isCallbackTag: <span className="font-bold">{String(isCallbackTag)}</span></div>
          <div>callbackDate: <span className="font-bold">"{callbackDate || 'empty'}"</span></div>
          <div>callbackTime: <span className="font-bold">"{callbackTime || 'empty'}"</span></div>
          <div>tagOptions: <span className="font-bold">{tagOptions.length}</span> tags loaded</div>
          <div>loadingTags: <span className="font-bold">{String(loadingTags)}</span></div>
          {tagOptions.length > 0 && (
            <div className="mt-2 pt-2 border-t border-yellow-300">
              <div className="font-bold text-yellow-800">Available Tags:</div>
              {tagOptions.map(t => (
                <div key={t.id} className="text-yellow-700">
                  - {t.name} (value: "{t.tagValue}")
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Phone className="h-5 w-5 text-green-600" />
            Tag Call
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={loading}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600 mb-1">
            <span className="font-medium">Phone:</span> {callData.phoneNumber}
          </p>
          {callData.duration !== undefined && (
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-medium">Duration:</span> {formatDuration(callData.duration)}
            </p>
          )}
          {callData.wasConnected !== undefined && (
            <p className="text-sm text-gray-600">
              <span className="font-medium">Status:</span>{" "}
              <span className={callData.wasConnected ? "text-green-600" : "text-red-600"}>
                {callData.wasConnected ? "Connected" : "Not Connected"}
              </span>
            </p>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Tag <span className="text-red-500">*</span>
          </label>
          {loadingTags ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">Loading tags...</span>
            </div>
          ) : tagOptions.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">
              No tags available. Please configure tag flows in the system.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {tagOptions.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => {
                    console.log("[CallTaggingModal] ========== TAG CLICKED ==========");
                    console.log("[CallTaggingModal] Tag clicked:", {
                      tagId: tag.id,
                      tagName: tag.name,
                      tagValue: tag.tagValue,
                      fullTag: tag
                    });
                    console.log("[CallTaggingModal] Setting selectedTag to:", tag.tagValue);
                    setSelectedTag(tag.tagValue);
                    console.log("[CallTaggingModal] selectedTag state will update on next render");
                  }}
                  disabled={loading}
                  className={`p-3 border-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedTag === tag.tagValue
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  style={{
                    borderColor: selectedTag === tag.tagValue ? tag.color || "#2563eb" : undefined,
                    backgroundColor: selectedTag === tag.tagValue ? `${tag.color || "#2563eb"}20` : undefined,
                  }}
                >
                  <div className="flex items-center gap-2">
                    {tag.icon && (
                      <Tag className="h-4 w-4" style={{ color: tag.color || "#2563eb" }} />
                    )}
                    <span>{tag.name}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Callback Time - ALWAYS SHOW FOR TESTING */}
        {(() => {
          console.log("[CallTaggingModal] Rendering Callback Time section - ALWAYS VISIBLE");
          console.log("[CallTaggingModal] Callback state:", { callbackDate, callbackTime, selectedTag, isCallbackTag });
          return null;
        })()}
        <div className="mb-4 p-3 bg-blue-50 border-2 border-blue-300 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Callback Time <span className="text-red-500">*</span>
            <span className="ml-2 text-xs text-blue-600">(Always visible for testing)</span>
          </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="date"
                    value={callbackDate}
                    onChange={(e) => {
                      console.log("[CallTaggingModal] Callback date changed:", e.target.value);
                      setCallbackDate(e.target.value);
                    }}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Time</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10 pointer-events-none" />
                  <select
                    value={callbackTime}
                    onChange={(e) => {
                      console.log("[CallTaggingModal] Callback time changed:", e.target.value);
                      setCallbackTime(e.target.value);
                    }}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm appearance-none bg-white cursor-pointer"
                    required
                  >
                    <option value="">Select Time</option>
                    {Array.from({ length: 48 }, (_, i) => {
                      const hour = Math.floor(i / 2);
                      const minute = (i % 2) * 30;
                      const hourStr = hour.toString().padStart(2, '0');
                      const minuteStr = minute.toString().padStart(2, '0');
                      const timeValue = `${hourStr}:${minuteStr}`;
                      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                      const ampm = hour >= 12 ? 'PM' : 'AM';
                      const displayTime = `${displayHour}:${minuteStr} ${ampm}`;
                      return (
                        <option key={timeValue} value={timeValue}>
                          {displayTime}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>
          </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes {tagOptions.find(t => t.tagValue === selectedTag)?.requiresNote && (
              <span className="text-red-500">*</span>
            )}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows={3}
            placeholder="Add call notes..."
            disabled={loading}
          />
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleTagCall}
            disabled={!selectedTag || loading || loadingTags || (isCallbackTag && (!callbackDate || !callbackTime))}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Tagging...</span>
              </>
            ) : (
              <>
                <Tag className="h-4 w-4" />
                <span>Tag Call</span>
              </>
            )}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}




