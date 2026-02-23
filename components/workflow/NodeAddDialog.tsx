"use client";

import { useState } from "react";
import { X, Navigation, Layers, Tag, Zap } from "lucide-react";

interface NodeAddDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAddNode: (type: "navigation" | "parentButtons" | "subButtons" | "childButton" | "tagButton" | "action", data?: any) => void;
}

export default function NodeAddDialog({ isOpen, onClose, onAddNode }: NodeAddDialogProps) {
  const [nodeType, setNodeType] = useState<"navigation" | "parentButtons" | "subButtons" | "childButton" | "tagButton" | "action" | null>(null);
  const [nodeData, setNodeData] = useState<any>({});

  if (!isOpen) return null;

  const handleAdd = () => {
    if (!nodeType) return;
    onAddNode(nodeType, nodeData);
    setNodeType(null);
    setNodeData({});
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Add Node</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {!nodeType ? (
            // Node Type Selection
            <div className="space-y-3">
              <p className="text-sm text-gray-600 mb-4">Select a node type to add:</p>
              
              <button
                onClick={() => setNodeType("navigation")}
                className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Navigation className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Navigation</div>
                    <div className="text-sm text-gray-500">Start node for the workflow</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setNodeType("subButtons")}
                className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Layers className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Sub Buttons</div>
                    <div className="text-sm text-gray-500">Connected / Not Connected options</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setNodeType("tagButton")}
                className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-yellow-500 hover:bg-yellow-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <Tag className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Tag Button</div>
                    <div className="text-sm text-gray-500">No Answer, Busy, etc.</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setNodeType("action")}
                className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Zap className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Action</div>
                    <div className="text-sm text-gray-500">Task, WhatsApp, Escalate, etc.</div>
                  </div>
                </div>
              </button>
            </div>
          ) : (
            // Node Configuration Form
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                <button
                  onClick={() => setNodeType(null)}
                  className="text-primary-600 hover:text-primary-700"
                >
                  ← Back
                </button>
                <span>/</span>
                <span>Configure {nodeType}</span>
              </div>

              {nodeType === "navigation" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Label
                    </label>
                    <input
                      type="text"
                      value={nodeData.label || "Navigation"}
                      onChange={(e) => setNodeData({ ...nodeData, label: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Navigation Button"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={nodeData.enabled !== false}
                        onChange={(e) => setNodeData({ ...nodeData, enabled: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700">Enabled</span>
                    </label>
                  </div>
                </div>
              )}

              {(nodeType === "parentButtons" || nodeType === "subButtons") && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Button 1 Name
                    </label>
                    <input
                      type="text"
                      value={nodeData.button1Name || "Connected"}
                      onChange={(e) => setNodeData({ ...nodeData, button1Name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Button 1 Color
                    </label>
                    <input
                      type="color"
                      value={nodeData.button1Color || "#10B981"}
                      onChange={(e) => setNodeData({ ...nodeData, button1Color: e.target.value })}
                      className="w-full h-10 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Button 2 Name
                    </label>
                    <input
                      type="text"
                      value={nodeData.button2Name || "Not Connected"}
                      onChange={(e) => setNodeData({ ...nodeData, button2Name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Button 2 Color
                    </label>
                    <input
                      type="color"
                      value={nodeData.button2Color || "#EF4444"}
                      onChange={(e) => setNodeData({ ...nodeData, button2Color: e.target.value })}
                      className="w-full h-10 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              )}

              {(nodeType === "childButton" || nodeType === "tagButton") && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Label
                    </label>
                    <input
                      type="text"
                      value={nodeData.label || "Tag Button"}
                      onChange={(e) => setNodeData({ ...nodeData, label: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="No Answer, Busy, etc."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Color
                    </label>
                    <input
                      type="color"
                      value={nodeData.color || "#F59E0B"}
                      onChange={(e) => setNodeData({ ...nodeData, color: e.target.value })}
                      className="w-full h-10 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Order
                    </label>
                    <input
                      type="number"
                      value={nodeData.order || 0}
                      onChange={(e) => setNodeData({ ...nodeData, order: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      min="0"
                    />
                  </div>
                </div>
              )}

              {nodeType === "action" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Action Type
                    </label>
                    <select
                      value={nodeData.actionType || "callback"}
                      onChange={(e) => setNodeData({ ...nodeData, actionType: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="callback">Callback</option>
                      <option value="retry">Retry</option>
                      <option value="createTask">Create Task</option>
                      <option value="notify">Notify</option>
                      <option value="escalate">Escalate</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Add Node
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
