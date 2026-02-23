"use client";

import { useState, useEffect } from "react";
import { Clock, User, FileText, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { apiClient } from "@/lib/api";
import TagBadge from "./TagBadge";

interface TagApplication {
  id: string;
  tagFlowId: string;
  tagFlow: {
    id: string;
    name: string;
    color: string;
    icon?: string;
    category?: string;
  };
  createdAt: string; // This is when the tag was applied
  appliedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    employeeCode?: string | null;
  } | null;
  note?: string | null;
  callbackAt?: string | null;
  followUpAt?: string | null;
}

interface TagHistoryProps {
  entityType: "lead" | "call" | "task";
  entityId: string;
}

export default function TagHistory({ entityType, entityId }: TagHistoryProps) {
  const [tagHistory, setTagHistory] = useState<TagApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    fetchTagHistory();
  }, [entityType, entityId]);

  const fetchTagHistory = async () => {
    setLoading(true);
    try {
      let response;
      if (entityType === "lead") {
        response = await apiClient.getLeadTags(entityId);
      } else if (entityType === "call") {
        response = await apiClient.getCallTags(entityId);
      } else {
        setLoading(false);
        return;
      }

      // Sort by createdAt (newest first)
      const sorted = (response.tagApplications || []).sort((a: TagApplication, b: TagApplication) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      setTagHistory(sorted);
    } catch (err) {
      console.error("Error fetching tag history:", err);
      setTagHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-5 w-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Tag History</h3>
        </div>
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-500">Loading history...</p>
        </div>
      </div>
    );
  }

  if (tagHistory.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-5 w-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Tag History</h3>
        </div>
        <p className="text-sm text-gray-500 text-center py-4">
          No tag history available
        </p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Tag History</h3>
          <span className="text-xs text-gray-500">({tagHistory.length})</span>
        </div>
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-gray-400 hover:text-gray-600"
          aria-label={isCollapsed ? "Expand history" : "Collapse history"}
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </button>
      </div>

      {!isCollapsed && (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {tagHistory.map((application) => {
            const isExpanded = expandedItems.has(application.id);
            const hasDetails =
              application.note ||
              application.callbackAt ||
              application.followUpAt;

            return (
              <div
                key={application.id}
                className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <TagBadge tag={application.tagFlow} size="sm" />
                      <span className="text-xs text-gray-500">
                        {formatDateTime(application.createdAt)}
                      </span>
                    </div>

                    {application.appliedBy && (
                      <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                        <User className="h-3 w-3" />
                        <span>
                          {application.appliedBy.firstName} {application.appliedBy.lastName}
                          {application.appliedBy.employeeCode && (
                            <span className="text-gray-500 ml-1">
                              ({application.appliedBy.employeeCode})
                            </span>
                          )}
                        </span>
                      </div>
                    )}

                    {hasDetails && (
                      <button
                        type="button"
                        onClick={() => toggleExpand(application.id)}
                        className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1 mt-1"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-3 w-3" />
                            Hide Details
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3 w-3" />
                            Show Details
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && hasDetails && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                    {application.note && (
                      <div className="flex items-start gap-2">
                        <FileText className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-700 mb-1">Note:</p>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">
                            {application.note}
                          </p>
                        </div>
                      </div>
                    )}

                    {application.callbackAt && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-gray-700">Callback:</p>
                          <p className="text-sm text-gray-600">
                            {formatDateTime(application.callbackAt)}
                          </p>
                        </div>
                      </div>
                    )}

                    {application.followUpAt && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-gray-700">Follow-up:</p>
                          <p className="text-sm text-gray-600">
                            {formatDateTime(application.followUpAt)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
