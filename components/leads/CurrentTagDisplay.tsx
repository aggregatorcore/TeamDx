"use client";

import { useState, useEffect } from "react";
import { Clock, Tag as TagIcon, AlertCircle, Calendar, Phone, CheckSquare, Bell, ArrowUp, RotateCw, Zap } from "lucide-react";
import { apiClient } from "@/lib/api";
import TagBadge from "@/components/tags/TagBadge";

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
  createdAt: string;
  appliedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode?: string | null;
  } | null;
  note?: string | null;
  callbackAt?: string | null;
  followUpAt?: string | null;
}

interface CurrentTagDisplayProps {
  entityType: "lead" | "call" | "task";
  entityId: string;
  refreshKey?: number; // Key to force refresh
}

interface ActiveAction {
  id: string;
  actionType: string;
  status: string;
  scheduledAt: string;
  executedAt?: string | null;
  resultData?: any;
}

export default function CurrentTagDisplay({ entityType, entityId, refreshKey }: CurrentTagDisplayProps) {
  const [currentTags, setCurrentTags] = useState<TagApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [countdownActive, setCountdownActive] = useState(false);
  const [latestCallbackTag, setLatestCallbackTag] = useState<TagApplication | null>(null);
  const [activeActions, setActiveActions] = useState<ActiveAction[]>([]);

  useEffect(() => {
    fetchCurrentTags();
  }, [entityType, entityId, refreshKey]);

  // Fetch actions when currentTags are loaded (so we have tagId)
  useEffect(() => {
    if (entityType === "lead") {
      // Wait a bit for tags to load, then fetch actions
      const timer = setTimeout(() => {
        fetchActiveActions();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [entityType, entityId, currentTags, refreshKey]);

  // Debug: Log active actions
  useEffect(() => {
    if (activeActions.length > 0) {
      console.log("[CurrentTagDisplay] Active actions state:", activeActions);
    } else {
      console.log("[CurrentTagDisplay] No active actions found");
    }
  }, [activeActions]);

  useEffect(() => {
    // Find the latest tag with callback
    const callbackTag = currentTags.find(tag => tag.callbackAt) || null;
    setLatestCallbackTag(callbackTag);
  }, [currentTags]);

  useEffect(() => {
    if (!latestCallbackTag?.callbackAt) {
      setCountdownActive(false);
      return;
    }

    const updateCountdown = () => {
      const now = new Date().getTime();
      const callbackTime = new Date(latestCallbackTag.callbackAt!).getTime();
      const difference = callbackTime - now;

      if (difference <= 0) {
        setTimeRemaining("Time's up!");
        setCountdownActive(false);
        return;
      }

      setCountdownActive(true);

      // Calculate time remaining
      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining(`${seconds}s`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [latestCallbackTag?.callbackAt]);

  const fetchCurrentTags = async () => {
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

      // Get recent tags - show only actual tags that were applied
      // Note: "Not Connected" is a Sub Button, not a tag, so it won't appear here
      const tags = response.tagApplications || [];
      
      // Debug: Log tags to see callbackAt
      console.log("[CurrentTagDisplay] Fetched tags:", tags.map(t => ({
        id: t.id,
        tagName: t.tagFlow?.name,
        callbackAt: t.callbackAt,
        followUpAt: t.followUpAt,
        hasCallbackAt: !!t.callbackAt,
      })));
      
      // Also log the full tag object for the first tag
      if (tags.length > 0) {
        console.log("[CurrentTagDisplay] First tag full data:", tags[0]);
      }
      
      // Sort by createdAt (newest first) and show the latest tag
      // Only show actual tags that were applied to the lead
      if (tags.length > 0) {
        // Show the most recent tag (first one after sorting by newest)
        setCurrentTags([tags[0]]);
      } else {
        setCurrentTags([]);
      }
    } catch (err) {
      console.error("Error fetching current tags:", err);
      setCurrentTags([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveActions = async () => {
    try {
      // Get current tag ID to filter actions
      const currentTagId = currentTags.length > 0 ? currentTags[0].tagFlowId : undefined;
      console.log("[CurrentTagDisplay] Fetching active actions for lead:", entityId, "tagId:", currentTagId);
      const response = await apiClient.getLeadActions(entityId, currentTagId);
      console.log("[CurrentTagDisplay] Received actions:", response.actions);
      setActiveActions(response.actions || []);
    } catch (err) {
      console.error("[CurrentTagDisplay] Error fetching active actions:", err);
      setActiveActions([]);
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case "callback":
        return Phone;
      case "createTask":
        return CheckSquare;
      case "notify":
        return Bell;
      case "escalate":
        return ArrowUp;
      case "retry":
        return RotateCw;
      default:
        return Zap;
    }
  };

  const getActionLabel = (actionType: string) => {
    switch (actionType) {
      case "callback":
        return "Callback";
      case "createTask":
        return "Task";
      case "notify":
        return "Notification";
      case "escalate":
        return "Escalate";
      case "retry":
        return "Retry";
      default:
        return actionType;
    }
  };

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case "callback":
        return "bg-blue-50 border-blue-200 text-blue-700";
      case "createTask":
        return "bg-green-50 border-green-200 text-green-700";
      case "notify":
        return "bg-purple-50 border-purple-200 text-purple-700";
      case "escalate":
        return "bg-red-50 border-red-200 text-red-700";
      case "retry":
        return "bg-orange-50 border-orange-200 text-orange-700";
      default:
        return "bg-gray-50 border-gray-200 text-gray-700";
    }
  };

  if (loading) {
    return null;
  }

  if (currentTags.length === 0) {
    return null;
  }

  const formatCallbackTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Current Tags */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <TagIcon className="h-5 w-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Current Tag:</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {currentTags.map((tag) => (
              <TagBadge
                key={tag.id}
                tag={{
                  id: tag.tagFlow.id,
                  name: tag.tagFlow.name,
                  color: tag.tagFlow.color,
                  icon: tag.tagFlow.icon,
                }}
              />
            ))}
          </div>
        </div>

        {/* Callback Countdown */}
        {latestCallbackTag?.callbackAt && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
              <Clock className={`h-5 w-5 ${countdownActive ? 'text-amber-600 animate-pulse' : 'text-amber-500'}`} />
              <div className="flex flex-col">
                <span className="text-xs text-amber-700 font-medium">Next Call:</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-amber-900">
                    {formatCallbackTime(latestCallbackTag.callbackAt)}
                  </span>
                  {countdownActive && (
                    <span className="text-xs font-mono font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded">
                      {timeRemaining}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Follow-up Date */}
        {latestCallbackTag?.followUpAt && !latestCallbackTag?.callbackAt && (
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
            <Calendar className="h-5 w-5 text-blue-600" />
            <div className="flex flex-col">
              <span className="text-xs text-blue-700 font-medium">Follow-up:</span>
              <span className="text-sm font-semibold text-blue-900">
                {formatCallbackTime(latestCallbackTag.followUpAt)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Active Actions */}
      {activeActions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-gray-500" />
            <span className="text-xs font-medium text-gray-700">Active Actions:</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {activeActions.map((action) => {
              const ActionIcon = getActionIcon(action.actionType);
              const actionLabel = getActionLabel(action.actionType);
              const actionColor = getActionColor(action.actionType);
              
              return (
                <div
                  key={action.id}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${actionColor}`}
                  title={`Status: ${action.status} | Type: ${action.actionType}`}
                >
                  <ActionIcon className="h-4 w-4" />
                  <span className="text-xs font-medium">{actionLabel}</span>
                  {action.status === "pending" && (
                    <span className="text-xs opacity-75">(Pending)</span>
                  )}
                  {action.status === "sent" && (
                    <span className="text-xs opacity-75">(Executed)</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
