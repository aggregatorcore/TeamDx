"use client";

import { useMemo } from "react";
import { Clock, Bell, CheckSquare, Mail, MessageSquare, User, AlertTriangle, ArrowUp } from "lucide-react";

interface ActionPreviewProps {
  actionsJson: string | null | undefined;
}

interface ActionRule {
  attempts?: Array<{
    attemptNumber: number;
    delayMinutes: number;
    actions: Array<{
      type: string;
      params?: Record<string, any>;
    }>;
  }>;
  finalAttempt?: {
    delayMinutes: number;
    actions: Array<{
      type: string;
      params?: Record<string, any>;
    }>;
  };
}

export default function ActionPreview({ actionsJson }: ActionPreviewProps) {
  const previews = useMemo(() => {
    if (!actionsJson) return [];

    try {
      const actions: ActionRule = JSON.parse(actionsJson);
      const result: Array<{ time: string; action: string; icon: React.ElementType; isFinal?: boolean }> = [];

      // Process attempts
      if (actions.attempts) {
        actions.attempts.forEach((attempt) => {
          attempt.actions?.forEach((action) => {
            result.push({
              time: formatTime(attempt.delayMinutes),
              action: getActionLabel(action.type, action.params),
              icon: getActionIcon(action.type),
              isFinal: false,
            });
          });
        });
      }

      // Process final attempt
      if (actions.finalAttempt) {
        actions.finalAttempt.actions?.forEach((action) => {
          result.push({
            time: formatTime(actions.finalAttempt!.delayMinutes),
            action: getActionLabel(action.type, action.params),
            icon: getActionIcon(action.type),
            isFinal: true,
          });
        });
      }

      return result;
    } catch (error) {
      console.error("Error parsing actions JSON:", error);
      return [];
    }
  }, [actionsJson]);

  if (previews.length === 0) return null;

  return (
    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-5 w-5 text-blue-600" />
        <h4 className="text-sm font-semibold text-blue-900">System will automatically:</h4>
      </div>
      <div className="space-y-2">
        {previews.map((preview, index) => {
          const Icon = preview.icon;
          return (
            <div
              key={index}
              className={`flex items-start gap-2 text-sm ${
                preview.isFinal ? "text-orange-700" : "text-gray-700"
              }`}
            >
              <Icon className={`h-4 w-4 mt-0.5 ${preview.isFinal ? "text-orange-600" : "text-gray-600"}`} />
              <div className="flex-1">
                <span className="font-medium">{preview.action}</span>
                <span className="text-gray-600 ml-1">after {preview.time}</span>
                {preview.isFinal && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded">
                    Final
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  } else if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours} hour${hours !== 1 ? "s" : ""}`;
    }
    return `${hours}h ${remainingMinutes}m`;
  } else {
    const days = Math.floor(minutes / 1440);
    return `${days} day${days !== 1 ? "s" : ""}`;
  }
}

function getActionLabel(type: string, params?: Record<string, any>): string {
  const labels: Record<string, string> = {
    createNotification: "Create notification",
    createTask: "Create task",
    sendEmail: "Send email",
    sendWhatsApp: "Send WhatsApp message",
    updateLeadStatus: "Update lead status",
    assignToUser: "Assign to user",
    escalate: "Escalate to team leader",
  };

  const baseLabel = labels[type] || type;

  // Add context from params if available
  if (params) {
    if (params.title) {
      return `${baseLabel}: "${params.title}"`;
    }
    if (params.subject) {
      return `${baseLabel}: "${params.subject}"`;
    }
    if (params.status) {
      return `${baseLabel} to "${params.status}"`;
    }
  }

  return baseLabel;
}

function getActionIcon(type: string): React.ElementType {
  const icons: Record<string, React.ElementType> = {
    createNotification: Bell,
    createTask: CheckSquare,
    sendEmail: Mail,
    sendWhatsApp: MessageSquare,
    updateLeadStatus: User,
    assignToUser: User,
    escalate: ArrowUp,
  };

  return icons[type] || AlertTriangle;
}
