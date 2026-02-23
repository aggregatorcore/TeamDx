"use client";

import { Node } from "reactflow";
import { X } from "lucide-react";
import NavigationProperties from "./properties/NavigationProperties";
import ParentButtonsProperties from "./properties/ParentButtonsProperties";
import ChildButtonProperties from "./properties/ChildButtonProperties";
import ActionProperties from "./properties/ActionProperties";

interface PropertiesPanelProps {
  selectedNode: Node | null;
  onClose: () => void;
  onUpdate: (nodeId: string, data: any) => void;
  tagFlows?: Array<{ id: string; name: string; tagValue?: string; category?: string }>;
}

export default function PropertiesPanel({
  selectedNode,
  onClose,
  onUpdate,
  tagFlows = [],
}: PropertiesPanelProps) {
  if (!selectedNode) {
    return (
      <div className="w-80 bg-white border-l border-gray-200 p-6 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p className="text-sm font-medium mb-1">No node selected</p>
          <p className="text-xs">Click any node on the canvas to edit its properties</p>
        </div>
      </div>
    );
  }

  const handleUpdate = (data: any) => {
    onUpdate(selectedNode.id, data);
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Properties</h3>
          {(selectedNode.type === "childButton" || selectedNode.type === "tagButton") && (
            <p className="text-xs text-gray-500 mt-0.5">Tag Button Configuration</p>
          )}
          {selectedNode.type === "navigation" && (
            <p className="text-xs text-gray-500 mt-0.5">Control Button Configuration</p>
          )}
          {(selectedNode.type === "parentButtons" || selectedNode.type === "subButtons") && (
            <p className="text-xs text-gray-500 mt-0.5">Sub Buttons Configuration</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-100 text-gray-500"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {selectedNode.type === "navigation" && (
          <NavigationProperties
            data={selectedNode.data}
            onUpdate={handleUpdate}
          />
        )}
        {selectedNode.type === "parentButtons" && (
          <ParentButtonsProperties
            data={selectedNode.data}
            onUpdate={handleUpdate}
          />
        )}
        {selectedNode.type === "childButton" && (
          <ChildButtonProperties
            data={selectedNode.data}
            onUpdate={handleUpdate}
            tagFlows={tagFlows}
          />
        )}
        {selectedNode.type === "action" && (
          <ActionProperties
            data={selectedNode.data}
            onUpdate={handleUpdate}
          />
        )}
        {!["navigation", "parentButtons", "childButton", "action"].includes(selectedNode.type || "") && (
          <div className="text-center text-gray-500 py-8">
            <p className="text-sm">Unknown node type: {selectedNode.type}</p>
            <p className="text-xs mt-2">Node data:</p>
            <pre className="text-xs mt-2 bg-gray-100 p-2 rounded overflow-auto">
              {JSON.stringify(selectedNode.data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
