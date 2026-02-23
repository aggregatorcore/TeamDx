"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Zap, Phone, Bell, ArrowUp, CheckCircle, Clock } from "lucide-react";

interface ActionNodeData {
  actionType?: "callback" | "retry" | "createTask" | "notify" | "escalate";
  enableRetry?: boolean;
  retry?: {
    maxAttempts?: number;
    attempts?: any[];
  };
}

const actionIcons = {
  callback: Clock,
  retry: CheckCircle,
  createTask: CheckCircle,
  notify: Bell,
  escalate: ArrowUp,
};

const actionLabels = {
  callback: "Callback",
  retry: "Retry",
  createTask: "Create Task",
  notify: "Notify",
  escalate: "Escalate",
};

export default memo(function ActionNode({ data, selected }: NodeProps<ActionNodeData>) {
  const actionType = data.actionType || "callback";
  const Icon = actionIcons[actionType] || Zap;
  const label = actionLabels[actionType] || "Action";
  
  // Show retry info if enabled
  const showRetryInfo = actionType === "callback" && data.enableRetry === true;
  const maxAttempts = data.retry?.maxAttempts || data.retry?.attempts?.length || 0;
  const attemptsText = maxAttempts > 0 ? `${maxAttempts} Attempt${maxAttempts !== 1 ? 's' : ''}` : '';

  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg border-2 bg-white min-w-[180px] ${
        selected ? "border-purple-500" : "border-gray-300"
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-purple-600" />
        <div className="flex-1">
          <div className="font-semibold text-gray-900">{label}</div>
          {showRetryInfo && attemptsText && (
            <div className="text-xs text-gray-600 mt-0.5">
              {attemptsText}
            </div>
          )}
        </div>
      </div>
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
});
