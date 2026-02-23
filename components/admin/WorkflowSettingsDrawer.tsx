"use client";

import { useState, useEffect } from "react";
import { X, Settings, Save } from "lucide-react";

interface WorkflowSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  workflowData?: any;
  onUpdate?: (data: any) => void;
}

export default function WorkflowSettingsDrawer({ isOpen, onClose, workflowData, onUpdate }: WorkflowSettingsDrawerProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"draft" | "live">("draft");
  const [version, setVersion] = useState(1);

  useEffect(() => {
    if (workflowData) {
      setName(workflowData.name || "");
      setDescription(workflowData.description || "");
      setStatus(workflowData.status || "draft");
      setVersion(workflowData.version || 1);
    }
  }, [workflowData, isOpen]);

  const handleSave = () => {
    if (onUpdate) {
      const updatedData = {
        ...workflowData,
        name,
        description,
        status,
        version,
      };
      onUpdate(updatedData);
    }
    onClose();
  };

  return (
    <>
      {/* Drawer */}
      <div
        className={`fixed w-96 bg-white border border-gray-200 rounded-lg z-[60] shadow-xl transition-all duration-300 ease-in-out ${
          isOpen ? "left-[340px] opacity-100" : "left-64 opacity-0 pointer-events-none"
        }`}
        style={{ 
          top: "150px",
          height: "auto", 
          maxHeight: "calc(100vh - 170px)" 
        }}
      >
        {/* Drawer Header */}
        <div className="px-4 py-4 border-b border-gray-200 bg-gradient-to-r from-primary-50 to-primary-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-600 rounded-lg">
              <Settings className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Workflow Settings</h2>
              <p className="text-xs text-gray-600">Configure workflow properties</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="overflow-y-auto p-4 custom-scrollbar" style={{ maxHeight: "calc(100vh - 250px)" }}>
          <div className="space-y-4">
            {/* Workflow Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Workflow Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter workflow name"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                placeholder="Enter workflow description"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "draft" | "live")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="draft">Draft</option>
                <option value="live">Live</option>
              </select>
            </div>

            {/* Version */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Version
              </label>
              <input
                type="number"
                value={version}
                onChange={(e) => setVersion(Number(e.target.value))}
                min={1}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="px-4 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            Save Settings
          </button>
        </div>
      </div>
    </>
  );
}
