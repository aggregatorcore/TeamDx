"use client";

import { Plus } from "lucide-react";
import { Edge } from "reactflow";

interface EdgePlusMenuProps {
  edge: Edge;
  position: { x: number; y: number };
  onAddTagButton: (edgeId: string) => void;
  onAddActionNode: (edgeId: string) => void;
  onClose: () => void;
}

export default function EdgePlusMenu({
  edge,
  position,
  onAddTagButton,
  onAddActionNode,
  onClose,
}: EdgePlusMenuProps) {
  return (
    <div
      className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px]"
      style={{ left: position.x, top: position.y }}
    >
      <div className="p-2">
        <div className="text-xs font-medium text-gray-500 px-2 py-1 mb-1">
          Add to Edge
        </div>
        <button
          onClick={() => {
            onAddTagButton(edge.id);
            onClose();
          }}
          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded flex items-center gap-2"
        >
          <Plus className="h-4 w-4 text-primary-600" />
          <span>Add Tag Button</span>
        </button>
        <button
          onClick={() => {
            onAddActionNode(edge.id);
            onClose();
          }}
          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded flex items-center gap-2"
        >
          <Plus className="h-4 w-4 text-purple-600" />
          <span>Add Action Node</span>
        </button>
      </div>
    </div>
  );
}
