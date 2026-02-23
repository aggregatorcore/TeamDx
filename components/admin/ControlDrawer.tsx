"use client";

import { useState } from "react";
import { X, Navigation, Plus, Settings, ChevronRight, Trash2 } from "lucide-react";

interface ControlDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onAddNode?: (type: "navigation", data?: any) => void;
  onRemoveButton?: (buttonId: string | number) => void;
  onOpenSettings?: (button: any, type?: "navigation" | "subButton" | "tag") => void;
  workflowData?: any;
}

export default function ControlDrawer({ isOpen, onClose, onAddNode, onRemoveButton, workflowData, onOpenSettings }: ControlDrawerProps) {
  const handleEditButton = (button: any) => {
    if (onOpenSettings) {
      onOpenSettings(button, "navigation");
    }
  };

  const existingButtons = workflowData?.controlButtons || [];
  const hasNavigation = workflowData?.navigation;

  return (
    <>
      {/* Drawer */}
      <div
        className={`fixed w-80 bg-white border border-gray-200 rounded-lg z-[60] shadow-xl transition-all duration-300 ease-in-out ${
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
              <Navigation className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Control Buttons</h2>
              <p className="text-xs text-gray-600">Manage navigation buttons</p>
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
        <div className="overflow-y-auto p-4">
          {/* Existing Buttons */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Existing Buttons</h3>
            <div className="space-y-2">
              {/* Show all control buttons */}
              {existingButtons.map((btn: any, index: number) => (
                <div
                  key={btn.id || index}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-primary-300 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Navigation className="h-4 w-4 text-primary-600" />
                      <span className="font-medium text-sm text-gray-900">
                        {btn.label || btn.name || "Control Button"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleEditButton(btn)}
                        className="p-1.5 hover:bg-white rounded"
                        title="Edit Settings"
                      >
                        <Settings className="h-4 w-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => onAddNode?.("navigation", btn)}
                        className="p-1.5 hover:bg-primary-100 rounded"
                        title="Add to Canvas"
                      >
                        <ChevronRight className="h-4 w-4 text-primary-600" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to remove "${btn.label || btn.name || "this button"}"?`)) {
                            onRemoveButton?.(btn.id || btn.label || btn.name);
                          }
                        }}
                        className="p-1.5 hover:bg-red-50 rounded"
                        title="Remove Button"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Show navigation if exists and controlButtons array doesn't exist */}
              {hasNavigation && existingButtons.length === 0 && (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-primary-300 transition-colors group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Navigation className="h-4 w-4 text-primary-600" />
                      <span className="font-medium text-sm text-gray-900">
                        {hasNavigation.label || "Navigation"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleEditButton(hasNavigation)}
                        className="p-1.5 hover:bg-white rounded"
                        title="Edit Settings"
                      >
                        <Settings className="h-4 w-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => onAddNode?.("navigation", hasNavigation)}
                        className="p-1.5 hover:bg-primary-100 rounded"
                        title="Add to Canvas"
                      >
                        <ChevronRight className="h-4 w-4 text-primary-600" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to remove "${hasNavigation.label || "Navigation"}"?`)) {
                            onRemoveButton?.(hasNavigation.id || "navigation");
                          }
                        }}
                        className="p-1.5 hover:bg-red-50 rounded"
                        title="Remove Button"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Default Navigation - Only show if no existing buttons */}
              {!hasNavigation && existingButtons.length === 0 && (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-primary-300 transition-colors group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Navigation className="h-4 w-4 text-primary-600" />
                      <span className="font-medium text-sm text-gray-900">Navigation</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onAddNode?.("navigation", {
                          label: "Navigation",
                          entryPoints: ["leads_page"],
                          visibleRoles: ["TELECALLER", "COUNSELOR"],
                        })}
                        className="p-1.5 hover:bg-primary-100 rounded"
                      >
                        <ChevronRight className="h-4 w-4 text-primary-600" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Create New Button */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Create New Button</h3>
            <button
              onClick={() => {
                if (onOpenSettings) {
                  onOpenSettings(null, "navigation"); // null means create new, "navigation" is the type
                }
              }}
              className="w-full px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center justify-center gap-2 text-sm font-medium transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Create New Button</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
