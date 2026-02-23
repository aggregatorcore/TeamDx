"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";

interface ParentButtonsNodeData {
  buttons?: Array<{ name: string; color: string; order: number }>;
  onButtonClick?: (buttonIndex: number) => void;
  onAddChild?: (buttonIndex: number) => void;
}

export default memo(function ParentButtonsNode({ data, selected, id }: NodeProps<ParentButtonsNodeData>) {
  // Support both array format and individual button properties
  const buttons = data.buttons || [
    { name: data.button1Name || "Connected", color: data.button1Color || "#10B981", order: 0 },
    { name: data.button2Name || "Not Connected", color: data.button2Color || "#EF4444", order: 1 },
  ];

  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg border-2 bg-white min-w-[240px] ${
        selected ? "border-green-500" : "border-gray-300"
      }`}
    >
      <div className="font-semibold text-gray-900 mb-3 text-sm">Sub Options</div>
      <div className="space-y-2">
        {buttons.map((btn, idx) => {
          return (
            <div
              key={idx}
              className="relative group"
            >
              {/* Button */}
              <button
                className="w-full px-3 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90 hover:shadow-md relative"
                style={{ backgroundColor: btn.color }}
                onClick={(e) => {
                  e.stopPropagation();
                  data.onButtonClick?.(idx);
                }}
              >
                {btn.name}
              </button>
              
              {/* Connection Handle for this button - Right side of button */}
              <Handle
                type="source"
                position={Position.Right}
                id={`button-${idx}`}
                className="!w-3 !h-3 !bg-green-500 !border-2 !border-white"
                style={{
                  top: '50%',
                  right: '-6px',
                  transform: 'translateY(-50%)',
                }}
              />
            </div>
          );
        })}
      </div>
      
      {/* Input handle at top */}
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
    </div>
  );
});
