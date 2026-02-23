"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Save } from "lucide-react";

interface NodeSettingsPopoverProps {
  nodeType: "navigation" | "subButton" | "tag";
  nodeData: any;
  position: { x: number; y: number };
  onSave: (data: any) => void;
  onClose: () => void;
}

export default function NodeSettingsPopover({
  nodeType,
  nodeData,
  position,
  onSave,
  onClose,
}: NodeSettingsPopoverProps) {
  const [formData, setFormData] = useState(nodeData);
  const [mounted, setMounted] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (mounted) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [onClose, mounted]);

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  const renderNavigationSettings = () => (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">Label</label>
        <input
          type="text"
          value={formData.label || ""}
          onChange={(e) => setFormData({ ...formData, label: e.target.value })}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">Entry Points</label>
        <input
          type="text"
          value={formData.entryPoints?.join(", ") || ""}
          onChange={(e) => setFormData({ ...formData, entryPoints: e.target.value.split(",").map(s => s.trim()) })}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
          placeholder="leads_page, lead_detail"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">Visible Roles</label>
        <input
          type="text"
          value={formData.visibleRoles?.join(", ") || ""}
          onChange={(e) => setFormData({ ...formData, visibleRoles: e.target.value.split(",").map(s => s.trim()) })}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
          placeholder="TELECALLER, COUNSELOR"
        />
      </div>
    </div>
  );

  const renderSubButtonSettings = () => (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">Label</label>
        <input
          type="text"
          value={formData.label || ""}
          onChange={(e) => setFormData({ ...formData, label: e.target.value })}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={formData.color || "#3b82f6"}
            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
            className="w-12 h-8 border border-gray-300 rounded cursor-pointer"
          />
          <input
            type="text"
            value={formData.color || "#3b82f6"}
            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded font-mono"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">Order</label>
        <input
          type="number"
          value={formData.order || 1}
          onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 1 })}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
        />
      </div>
    </div>
  );

  const renderTagSettings = () => (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">Tag Name</label>
        <input
          type="text"
          value={formData.name || ""}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={formData.color || "#3b82f6"}
            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
            className="w-12 h-8 border border-gray-300 rounded cursor-pointer"
          />
          <input
            type="text"
            value={formData.color || "#3b82f6"}
            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded font-mono"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">Bucket Target</label>
        <select
          value={formData.bucketTarget || "orange"}
          onChange={(e) => setFormData({ ...formData, bucketTarget: e.target.value })}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
        >
          <option value="blue">Blue (Fresh)</option>
          <option value="green">Green (Connected)</option>
          <option value="orange">Orange (Callback)</option>
          <option value="red">Red (Overdue)</option>
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">Auto Callback (minutes)</label>
        <input
          type="number"
          value={formData.callbackMinutes || 60}
          onChange={(e) => setFormData({ ...formData, callbackMinutes: parseInt(e.target.value) || 60 })}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">Max Attempts</label>
        <input
          type="number"
          value={formData.maxAttempts || 3}
          onChange={(e) => setFormData({ ...formData, maxAttempts: parseInt(e.target.value) || 3 })}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
        />
      </div>
    </div>
  );

  if (!mounted) return null;

  const popoverContent = (
    <div
      ref={popoverRef}
      className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-xl p-4 min-w-[300px] max-w-[400px]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-900">
          {nodeType === "navigation" && "Navigation Settings"}
          {nodeType === "subButton" && "Sub Button Settings"}
          {nodeType === "tag" && "Tag Settings"}
        </h4>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {nodeType === "navigation" && renderNavigationSettings()}
        {nodeType === "subButton" && renderSubButtonSettings()}
        {nodeType === "tag" && renderTagSettings()}
      </div>

      <div className="flex gap-2 mt-4 pt-3 border-t border-gray-200">
        <button
          onClick={handleSave}
          className="flex-1 px-3 py-2 bg-primary-600 text-white rounded text-sm font-medium hover:bg-primary-700 flex items-center justify-center gap-2"
        >
          <Save className="h-4 w-4" />
          Save
        </button>
        <button
          onClick={onClose}
          className="px-3 py-2 bg-gray-100 text-gray-700 rounded text-sm font-medium hover:bg-gray-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  return createPortal(popoverContent, document.body);
}
