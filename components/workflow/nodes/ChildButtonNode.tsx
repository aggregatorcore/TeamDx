"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Tag } from "lucide-react";

interface ChildButtonNodeData {
  label?: string;
  color?: string;
  order?: number;
}

export default memo(function ChildButtonNode({ data, selected }: NodeProps<ChildButtonNodeData>) {
  // Force re-render when data changes by using data properties directly
  const label = data?.label || "Tag Button";
  const color = data?.color || "#F59E0B";
  const order = data?.order || 0;

  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg border-2 bg-white min-w-[180px] ${
        selected ? "border-yellow-500" : "border-gray-300"
      }`}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-4 h-4 rounded flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <div className="font-semibold text-gray-900 truncate">
          {label}
        </div>
      </div>
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if data actually changed
  return (
    prevProps.data?.label === nextProps.data?.label &&
    prevProps.data?.color === nextProps.data?.color &&
    prevProps.data?.order === nextProps.data?.order &&
    prevProps.selected === nextProps.selected
  );
});
