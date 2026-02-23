"use client";

import { useState } from "react";
import { X, Circle, Plus, Settings, ChevronRight, Trash2, Navigation, Tag, Play, Save } from "lucide-react";

interface SubDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onAddNode?: (type: "subButton", data?: any) => void;
  onRemoveButton?: (buttonId: string | number) => void;
  onOpenSettings?: (button: any, type?: "navigation" | "subButton" | "tag") => void;
  workflowData?: any;
}

export default function SubDrawer({ isOpen, onClose, onAddNode, onRemoveButton, workflowData, onOpenSettings }: SubDrawerProps) {
  const handleEditButton = (button: any) => {
    if (onOpenSettings) {
      // Create a deep copy to avoid reference issues
      // CRITICAL: Ensure ID is always set and preserved
      const buttonCopy = {
        ...button,
        id: button.id || button.label?.toLowerCase().replace(/\s+/g, "_"), // Ensure ID is always set
        label: button.label,
        color: button.color,
        icon: button.icon,
        iconColor: button.iconColor,
        textColor: button.textColor,
        borderColor: button.borderColor,
        isSystem: button.isSystem,
        deletable: button.deletable,
      };
      console.log("[SubDrawer] Opening settings for button:", { 
        original: button, 
        copy: buttonCopy,
        id: buttonCopy.id 
      });
      onOpenSettings(buttonCopy, "subButton");
    }
  };

  const existingSubButtons = workflowData?.subButtons || [];
  
  // System/root sub buttons (cannot be deleted, always present)
  const systemSubButtons = [
    {
      id: "connected",
      label: "Connected",
      color: "#10b981",
      order: 1,
      enabled: true,
      isSystem: true,
      deletable: false,
    },
    {
      id: "not_connected",
      label: "Not Connected",
      color: "#ef4444",
      order: 2,
      enabled: true,
      isSystem: true,
      deletable: false,
    },
  ];

  // Helper function to normalize strings for comparison
  const normalizeString = (str: string) => str?.toLowerCase().trim().replace(/\s+/g, "_").replace(/-/g, "_") || "";

  // Separate system buttons and custom buttons from existing
  const systemButtonsInWorkflow = existingSubButtons.filter((btn: any) => {
    // Check if button matches system buttons
    const btnIdNormalized = normalizeString(btn.id);
    const btnLabelNormalized = normalizeString(btn.label);
    return systemSubButtons.some((sysBtn) => {
      const sysIdNormalized = normalizeString(sysBtn.id);
      const sysLabelNormalized = normalizeString(sysBtn.label);
      return (
        btnIdNormalized === sysIdNormalized ||
        btnLabelNormalized === sysLabelNormalized ||
        btn.isSystem === true
      );
    });
  });
  
  const customButtons = existingSubButtons.filter((btn: any) => {
    // Exclude system buttons
    const btnIdNormalized = normalizeString(btn.id);
    const btnLabelNormalized = normalizeString(btn.label);
    return !systemSubButtons.some((sysBtn) => {
      const sysIdNormalized = normalizeString(sysBtn.id);
      const sysLabelNormalized = normalizeString(sysBtn.label);
      return (
        btnIdNormalized === sysIdNormalized ||
        btnLabelNormalized === sysLabelNormalized ||
        btn.isSystem === true
      );
    });
  });

  // Get system buttons to display (merge workflow system buttons with defaults)
  const allSystemButtons = systemSubButtons.map((sysBtn) => {
    // Check if this system button exists in workflow
    const existingSystemBtn = systemButtonsInWorkflow.find((btn: any) => {
      const btnIdNormalized = normalizeString(btn.id);
      const btnLabelNormalized = normalizeString(btn.label);
      const sysIdNormalized = normalizeString(sysBtn.id);
      const sysLabelNormalized = normalizeString(sysBtn.label);
      return (
        btnIdNormalized === sysIdNormalized ||
        btnLabelNormalized === sysLabelNormalized
      );
    });
    // Use workflow version if exists (with all its properties), otherwise use default
    // CRITICAL: Always preserve the system button ID
    const mergedBtn = existingSystemBtn || sysBtn;
    return {
      ...mergedBtn,
      id: mergedBtn.id || sysBtn.id, // Always ensure ID is set from system button
      isSystem: true,
      deletable: false,
    };
  });

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
              <Circle className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Sub Buttons</h2>
              <p className="text-xs text-gray-600">Manage flow direction buttons</p>
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
          {/* System/Root Sub Buttons - Always present, cannot be deleted */}
          {allSystemButtons.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Pre-built System Sub Buttons</h3>
              <div className="space-y-2">
                {allSystemButtons.map((btn: any) => (
                  <div
                    key={btn.id}
                    className="p-3 rounded-lg border-2 transition-colors group shadow-md"
                    style={{
                      backgroundColor: btn.color || "#3b82f6",
                      borderColor: btn.borderColor || btn.color || "#3b82f6",
                      color: btn.textColor || "#ffffff",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {btn.icon ? (() => {
                          const iconMap: { [key: string]: any } = {
                            circle: Circle,
                            navigation: Navigation,
                            tag: Tag,
                            settings: Settings,
                            play: Play,
                            save: Save,
                          };
                          const IconComponent = iconMap[btn.icon.toLowerCase()] || Circle;
                          const iconColor = btn.iconColor || btn.textColor || "#ffffff";
                          return (
                            <div className="flex items-center" style={{ color: iconColor }}>
                              <IconComponent className="h-4 w-4" style={{ color: iconColor }} />
                            </div>
                          );
                        })() : (
                          <Circle className="h-4 w-4" style={{ color: btn.textColor || "#ffffff" }} />
                        )}
                        <span className="font-medium text-sm" style={{ color: btn.textColor || "#ffffff" }}>
                          {btn.label || "Sub Button"}
                        </span>
                        <span 
                          className="px-1.5 py-0.5 text-xs font-medium rounded border"
                          style={{
                            backgroundColor: btn.badgeBgColor || "rgba(255, 255, 255, 0.2)",
                            color: btn.badgeColor || "#ffffff",
                            borderColor: btn.badgeBorderColor || "rgba(255, 255, 255, 0.3)",
                          }}
                        >
                          System
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => handleEditButton(btn)}
                          className="p-1.5 rounded transition-colors"
                          style={{ backgroundColor: "transparent" }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "transparent";
                          }}
                          title="Edit Settings"
                        >
                          <Settings className="h-4 w-4" style={{ color: btn.textColor || "#ffffff" }} />
                        </button>
                        <button
                          onClick={() => onAddNode?.("subButton", btn)}
                          className="p-1.5 rounded transition-colors"
                          style={{ backgroundColor: "transparent" }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "transparent";
                          }}
                          title="Add to Canvas"
                        >
                          <ChevronRight className="h-4 w-4" style={{ color: btn.textColor || "#ffffff" }} />
                        </button>
                        {/* Delete button hidden for system buttons */}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom Sub Buttons */}
          {customButtons.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Custom Sub Buttons</h3>
              <div className="space-y-2">
                {customButtons.map((btn: any, index: number) => (
                  <div
                    key={btn.id || `custom-${index}`}
                    className="p-3 rounded-lg border-2 transition-colors group shadow-md"
                    style={{
                      backgroundColor: btn.color || "#3b82f6",
                      borderColor: btn.borderColor || btn.color || "#3b82f6",
                      color: btn.textColor || "#ffffff",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {btn.icon ? (() => {
                          const iconMap: { [key: string]: any } = {
                            circle: Circle,
                            navigation: Navigation,
                            tag: Tag,
                            settings: Settings,
                            play: Play,
                            save: Save,
                          };
                          const IconComponent = iconMap[btn.icon.toLowerCase()] || Circle;
                          const iconColor = btn.iconColor || btn.textColor || "#ffffff";
                          return (
                            <div className="flex items-center" style={{ color: iconColor }}>
                              <IconComponent className="h-4 w-4" style={{ color: iconColor }} />
                            </div>
                          );
                        })() : (
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: btn.textColor || "#ffffff" }} />
                        )}
                        <span className="font-medium text-sm" style={{ color: btn.textColor || "#ffffff" }}>
                          {btn.label || "Sub Button"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => handleEditButton(btn)}
                          className="p-1.5 rounded transition-colors"
                          style={{ backgroundColor: "transparent" }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "transparent";
                          }}
                          title="Edit Settings"
                        >
                          <Settings className="h-4 w-4" style={{ color: btn.textColor || "#ffffff" }} />
                        </button>
                        <button
                          onClick={() => onAddNode?.("subButton", btn)}
                          className="p-1.5 rounded transition-colors"
                          style={{ backgroundColor: "transparent" }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "transparent";
                          }}
                          title="Add to Canvas"
                        >
                          <ChevronRight className="h-4 w-4" style={{ color: btn.textColor || "#ffffff" }} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to remove "${btn.label || "this button"}"?`)) {
                              onRemoveButton?.(btn.id || btn.label, "sub");
                            }
                          }}
                          className="p-1.5 rounded transition-colors"
                          style={{ backgroundColor: "transparent" }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.2)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "transparent";
                          }}
                          title="Remove Button"
                        >
                          <Trash2 className="h-4 w-4" style={{ color: btn.textColor || "#ffffff" }} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Create New Button - Only show once */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Create New Sub Button</h3>
            <button
              onClick={() => {
                if (onOpenSettings) {
                  onOpenSettings(null, "subButton");
                }
              }}
              className="w-full px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center justify-center gap-2 text-sm font-medium transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Create New Sub Button</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
