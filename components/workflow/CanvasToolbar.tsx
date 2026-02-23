"use client";

import { Plus, Navigation, Layers, Zap, Tag } from "lucide-react";

interface CanvasToolbarProps {
  onAddNode: (type: "navigation" | "parentButtons" | "subButtons" | "childButton" | "tagButton" | "action") => void;
}

export default function CanvasToolbar({ onAddNode }: CanvasToolbarProps) {
  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Add Workflow Steps</h3>
        <p className="text-xs text-gray-500 mt-1">Click any button below to add it to your workflow</p>
      </div>

      {/* Node Types */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {/* Navigation Node */}
        <button
          onClick={() => onAddNode("navigation")}
          className="w-full p-3 border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
              <Navigation className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">Control Button</div>
              <div className="text-xs text-gray-500 mt-0.5">Main button that appears on the page</div>
            </div>
          </div>
        </button>

        {/* Sub Buttons Node */}
        <button
          onClick={() => onAddNode("subButtons")}
          className="w-full p-3 border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
              <Layers className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">Sub Buttons</div>
              <div className="text-xs text-gray-500 mt-0.5">Sub-options under control button</div>
            </div>
          </div>
        </button>

        {/* Tag Button Node */}
        <button
          onClick={() => onAddNode("tagButton")}
          className="w-full p-3 border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg group-hover:bg-amber-200 transition-colors">
              <Tag className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">Tag Button</div>
              <div className="text-xs text-gray-500 mt-0.5">Select or create tag to apply to lead</div>
            </div>
          </div>
        </button>

        {/* Action Node */}
        <button
          onClick={() => onAddNode("action")}
          className="w-full p-3 border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
              <Zap className="h-5 w-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">Action Step</div>
              <div className="text-xs text-gray-500 mt-0.5">What to do: Create Task, Send Message, etc.</div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
