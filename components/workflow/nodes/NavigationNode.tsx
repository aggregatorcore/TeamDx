"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Navigation } from "lucide-react";

interface NavigationNodeData {
  label?: string;
  enabled?: boolean;
  icon?: string;
}

export default memo(function NavigationNode({ data, selected }: NodeProps<NavigationNodeData>) {
  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg border-2 bg-white min-w-[200px] ${
        selected ? "border-primary-500" : "border-gray-300"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Navigation className="h-5 w-5 text-primary-600" />
        <div className="font-semibold text-gray-900">
          {data.label || "Navigation Button"}
        </div>
      </div>
      {data.enabled === false && (
        <div className="text-xs text-gray-500 italic">Disabled</div>
      )}
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
});
