"use client";

import { useState, useEffect } from "react";
import { X, Tag, Plus, Settings, ChevronRight, Trash2, Download, Lock, Copy, PhoneOff, PhoneMissed, Phone, PhoneCall, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import CreateTagModal from "./CreateTagModal";

interface TagDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onAddNode?: (type: "tag", data?: any) => void;
  onRemoveButton?: (buttonId: string | number, type?: "tag") => void;
  onOpenSettings?: (button: any, type?: "navigation" | "subButton" | "tag") => void;
  onUpdate?: (data: any) => void;
  workflowData?: any;
}

// Pre-built Wrong Number system tag (CLOSE + exhaust, senior bucket)
const WRONG_NUMBER_SYSTEM_TAG = {
  id: "wrong_number",
  name: "Wrong Number",
  label: "Wrong Number",
  tagValue: "wrong_number",
  color: "#dc2626",
  category: "notConnected" as const,
  isSystem: true,
  icon: "wrongnumber",
  iconColor: "#ffffff",
  badgeColor: "#ffffff",
  badgeBgColor: "rgba(255, 255, 255, 0.2)",
  badgeBorderColor: "rgba(255, 255, 255, 0.3)",
  tagConfig: {
    template: "WRONG_NUMBER",
    autoAction: "CLOSE",
    closeReason: "WRONG_NUMBER",
    requiresCallback: false,
    exhaustPolicy: {
      markExhausted: true,
      exhaustReason: "WRONG_NUMBER",
      seniorNotify: true,
    },
  },
};

export default function TagDrawer({ isOpen, onClose, onAddNode, onRemoveButton, workflowData, onOpenSettings, onUpdate }: TagDrawerProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  // Get action button colors from workflowData (stored in tag data or workflowData settings)
  const getActionButtonColors = (tag: any) => {
    return {
      settingsHover: tag?.settingsButtonHoverColor || workflowData?.settingsButtonHoverColor || "#ffffff",
      addToCanvasHover: tag?.addToCanvasButtonHoverColor || workflowData?.addToCanvasButtonHoverColor || "#dbeafe",
      addToCanvasIcon: tag?.addToCanvasButtonIconColor || workflowData?.addToCanvasButtonIconColor || "#2563eb",
      duplicateHover: tag?.duplicateButtonHoverColor || workflowData?.duplicateButtonHoverColor || "#dcfce7",
      duplicateIcon: tag?.duplicateButtonIconColor || workflowData?.duplicateButtonIconColor || "#16a34a",
    };
  };


  const handleEditButton = (tag: any) => {
    if (onOpenSettings) {
      onOpenSettings(tag, "tag");
    }
  };


  const handleColorSave = (tagId: string) => {
    if (!workflowData || !onUpdate) return;

    const updatedData = { ...workflowData };
    
    // Update tag in tagGroups
    if (updatedData.tagGroups?.connected) {
      const tagIndex = updatedData.tagGroups.connected.findIndex((t: any) => t.id === tagId);
      if (tagIndex !== -1) {
        updatedData.tagGroups.connected[tagIndex] = {
          ...updatedData.tagGroups.connected[tagIndex],
          color: tempColor,
        };
      }
    }
    
    if (updatedData.tagGroups?.notConnected) {
      const tagIndex = updatedData.tagGroups.notConnected.findIndex((t: any) => t.id === tagId);
      if (tagIndex !== -1) {
        updatedData.tagGroups.notConnected[tagIndex] = {
          ...updatedData.tagGroups.notConnected[tagIndex],
          color: tempColor,
        };
      }
    }

    // Update tag in individual tags
    if (updatedData.tags && updatedData.tags[tagId]) {
      updatedData.tags[tagId] = {
        ...updatedData.tags[tagId],
        color: tempColor,
      };
    }

    onUpdate(updatedData);
    setEditingColorTagId(null);
  };

  const handleColorCancel = () => {
    setEditingColorTagId(null);
    setTempColor("#3b82f6");
  };

  const handleCreateTag = (tagData: {
    name: string;
    label: string;
    category: "connected" | "notConnected";
    color: string;
    tagConfig: any;
  }) => {
    // Add tag to workflowData
    if (workflowData) {
      const updatedData = { ...workflowData };
      
      // Check if tag with same name already exists
      const existingTags = [
        ...(updatedData.tagGroups?.connected || []),
        ...(updatedData.tagGroups?.notConnected || []),
        ...Object.values(updatedData.tags || {}),
      ];
      
      const tagExists = existingTags.some(
        (tag: any) => 
          tag.name?.toLowerCase() === tagData.name.toLowerCase() ||
          tag.label?.toLowerCase() === tagData.name.toLowerCase()
      );

      if (tagExists) {
        alert(`Tag "${tagData.name}" already exists. Please use a different name.`);
        return;
      }
      
      // Ensure tagGroups structure exists
      if (!updatedData.tagGroups) {
        updatedData.tagGroups = {
          connected: [],
          notConnected: [],
        };
      }

      // Add tag to appropriate category
      const tagToAdd = {
        id: `tag-${Date.now()}`,
        name: tagData.name,
        label: tagData.label,
        color: tagData.color,
        category: tagData.category,
        tagConfig: tagData.tagConfig,
      };

      if (tagData.category === "connected") {
        if (!updatedData.tagGroups.connected) {
          updatedData.tagGroups.connected = [];
        }
        // Check if already exists in this category
        const existsInCategory = updatedData.tagGroups.connected.some(
          (tag: any) => tag.id === tagToAdd.id || tag.name === tagToAdd.name
        );
        if (!existsInCategory) {
          updatedData.tagGroups.connected.push(tagToAdd);
        }
      } else {
        if (!updatedData.tagGroups.notConnected) {
          updatedData.tagGroups.notConnected = [];
        }
        // Check if already exists in this category
        const existsInCategory = updatedData.tagGroups.notConnected.some(
          (tag: any) => tag.id === tagToAdd.id || tag.name === tagToAdd.name
        );
        if (!existsInCategory) {
          updatedData.tagGroups.notConnected.push(tagToAdd);
        }
      }

      // Also add to individual tags for easy access (only if not already there)
      if (!updatedData.tags) {
        updatedData.tags = {};
      }
      if (!updatedData.tags[tagToAdd.id]) {
        updatedData.tags[tagToAdd.id] = tagToAdd;
      }

      // Trigger update
      if (onUpdate) {
        onUpdate(updatedData);
      }

      // Don't call onAddNode here - it will create duplicate in canvas
      // Canvas nodes should be added separately by user clicking "Add to Canvas"
    }
    setIsCreateModalOpen(false);
  };

  // Get tags from workflowData
  const tagGroups = workflowData?.tagGroups || {};
  const individualTags = workflowData?.tags || {};
  
  // Debug logging
  useEffect(() => {
    console.log("[TagDrawer] Workflow data:", {
      hasWorkflowData: !!workflowData,
      tagGroups: tagGroups,
      notConnectedCount: tagGroups.notConnected?.length || 0,
      connectedCount: tagGroups.connected?.length || 0,
      individualTagsCount: Object.keys(individualTags).length,
      notConnectedTags: tagGroups.notConnected,
    });
  }, [workflowData, tagGroups, individualTags]);
  
  // Get all tags from tagGroups
  const allTagsFromGroups: any[] = [];
  if (tagGroups.connected) {
    allTagsFromGroups.push(...tagGroups.connected.map((tag: any) => ({ ...tag, group: "connected" })));
  }
  if (tagGroups.notConnected) {
    allTagsFromGroups.push(...tagGroups.notConnected.map((tag: any) => ({ ...tag, group: "notConnected" })));
  }
  
  // Get IDs of tags already in groups (to avoid duplicates)
  const tagsInGroupsIds = new Set(allTagsFromGroups.map(tag => tag.id));
  
  // Get individual tags (not in groups) - only include tags that are NOT already in tagGroups
  const individualTagsList = Object.keys(individualTags)
    .filter(key => !tagsInGroupsIds.has(key)) // Only include if not already in tagGroups
    .map(key => ({
      id: key,
      ...individualTags[key],
      group: null, // Explicitly mark as independent
    }));

  // Combine all tags (already deduplicated)
  const allTags = [...allTagsFromGroups, ...individualTagsList];

  // Separate system tags and custom tags
  const systemTagsFromWorkflow = allTags.filter((tag: any) => tag.isSystem === true);
  const hasWrongNumberInWorkflow = allTags.some(
    (t: any) => t.id === "wrong_number" || t.tagValue === "wrong_number" || (t.name?.toLowerCase() === "wrong number")
  );
  // Pre-built System Tags: workflow system tags + Wrong Number (always show in list)
  const systemTags = hasWrongNumberInWorkflow
    ? systemTagsFromWorkflow
    : [...systemTagsFromWorkflow, { ...WRONG_NUMBER_SYSTEM_TAG }];
  const customTags = allTags.filter((tag: any) => !tag.isSystem || tag.isSystem === false);
  
  // Debug logging for tags
  useEffect(() => {
    console.log("[TagDrawer] Tags summary:", {
      allTagsCount: allTags.length,
      systemTagsCount: systemTags.length,
      customTagsCount: customTags.length,
      systemTags: systemTags.map((t: any) => ({ id: t.id, name: t.name, isSystem: t.isSystem })),
    });
  }, [allTags.length, systemTags.length, customTags.length]);

  const ensureWrongNumberInWorkflow = () => {
    if (!workflowData || !onUpdate) return;
    const existing = [
      ...(workflowData.tagGroups?.notConnected || []),
      ...Object.values(workflowData.tags || {}),
    ].some((t: any) => t.id === "wrong_number" || t.tagValue === "wrong_number" || t.name?.toLowerCase() === "wrong number");
    if (existing) return;
    const updatedData = { ...workflowData };
    if (!updatedData.tagGroups) updatedData.tagGroups = { connected: [], notConnected: [] };
    if (!updatedData.tagGroups.notConnected) updatedData.tagGroups.notConnected = [];
    updatedData.tagGroups.notConnected.push({ ...WRONG_NUMBER_SYSTEM_TAG });
    if (!updatedData.tags) updatedData.tags = {};
    updatedData.tags["wrong_number"] = { ...WRONG_NUMBER_SYSTEM_TAG };
    onUpdate(updatedData);
  };

  const handleDuplicateSystemTag = (systemTag: any) => {
    // Create a custom copy of the system tag
    const customCopy = {
      ...systemTag,
      id: `tag-${Date.now()}`,
      isSystem: false,
      deletable: true,
      name: `${systemTag.name} (Copy)`,
      label: `${systemTag.label} (Copy)`,
      tagKey: undefined, // Remove tagKey for custom tags
    };

    if (workflowData && onUpdate) {
      const updatedData = { ...workflowData };
      
      // Ensure tagGroups structure exists
      if (!updatedData.tagGroups) {
        updatedData.tagGroups = {
          connected: [],
          notConnected: [],
        };
      }

      // Add to appropriate category
      if (customCopy.category === "connected") {
        if (!updatedData.tagGroups.connected) {
          updatedData.tagGroups.connected = [];
        }
        updatedData.tagGroups.connected.push(customCopy);
      } else {
        if (!updatedData.tagGroups.notConnected) {
          updatedData.tagGroups.notConnected = [];
        }
        updatedData.tagGroups.notConnected.push(customCopy);
      }

      // Also add to individual tags
      if (!updatedData.tags) {
        updatedData.tags = {};
      }
      updatedData.tags[customCopy.id] = customCopy;

      onUpdate(updatedData);
      alert(`Created custom copy of "${systemTag.name}"`);
    }
  };

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
              <Tag className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Tags</h2>
              <p className="text-xs text-gray-600">Manage decision tags</p>
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
          {allTags.length > 0 || systemTags.length > 0 ? (
            <>
              {/* System Tags Section */}
              {systemTags.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Lock className="h-4 w-4 text-gray-500" />
                    <h3 className="text-sm font-semibold text-gray-900">Pre-built System Tags</h3>
                  </div>
                  <div className="space-y-2">
                    {systemTags.map((tag: any, index: number) => {
                      const tagColor = tag.color || "#3b82f6";
                      // Match canvas node styling exactly
                      // Canvas uses: backgroundColor: rgb(245, 158, 11), color: rgb(255, 255, 255), border: gray
                      
                      return (
                      <div
                        key={`${tag.id || index}-${tag.icon}-${tag.color}-${tag.badgeColor}-${tag.badgeBgColor}-${tag.badgeBorderColor}`}
                        className="rounded-lg border-2 transition-colors group shadow-md"
                        style={{
                          backgroundColor: tagColor, // Full opacity like canvas
                          color: "#ffffff", // White text like canvas
                          borderColor: "#e5e7eb", // Gray border like canvas (when not selected)
                          borderWidth: "2px",
                          borderRadius: "8px",
                          padding: "12px 16px", // Same padding as canvas
                          boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)", // Same shadow as canvas
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "#3b82f6"; // Primary blue on hover
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "#e5e7eb"; // Back to gray
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {(() => {
                              // Icon mapping - same as CustomNode
                              const iconMap: { [key: string]: any } = {
                                tag: Tag,
                                phoneoff: PhoneOff,
                                wrongnumber: PhoneMissed,
                                phone: Phone,
                                phonecall: PhoneCall,
                                phoneincoming: PhoneIncoming,
                                phoneoutgoing: PhoneOutgoing,
                              };
                              
                              if (tag.icon) {
                                const iconKey = tag.icon.toLowerCase();
                                const IconComponent = iconMap[iconKey] || Tag; // Default to Tag if not found
                                const iconColorValue = tag.iconColor || tag.textColor || "#ffffff";
                                return (
                                  <div className="flex items-center justify-center" style={{ color: iconColorValue }}>
                                    <IconComponent className="h-4 w-4" style={{ color: iconColorValue }} />
                                  </div>
                                );
                              }
                              // Default dot if no icon
                              return (
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#ffffff" }} />
                              );
                            })()}
                            <div className="flex items-center gap-2">
                              <span 
                                className="font-semibold text-sm"
                                style={{ 
                                  color: "#ffffff", // White text like canvas
                                  fontFamily: "system-ui",
                                  fontWeight: "600",
                                }}
                              >
                                {tag.name || tag.label || "Tag"}
                              </span>
                              <span 
                                className="px-1.5 py-0.5 text-xs font-medium rounded border"
                                style={{
                                  backgroundColor: tag.badgeBgColor || "rgba(255, 255, 255, 0.2)",
                                  color: tag.badgeColor || "#ffffff",
                                  borderColor: tag.badgeBorderColor || "rgba(255, 255, 255, 0.3)",
                                }}
                              >
                                System
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {(() => {
                              const buttonColors = getActionButtonColors(tag);
                              return (
                                <>
                                  <button 
                                    onClick={() => {
                                      if (tag.id === "wrong_number" && !hasWrongNumberInWorkflow) ensureWrongNumberInWorkflow();
                                      handleEditButton(tag);
                                    }}
                                    className="p-1.5 rounded transition-colors"
                                    style={{ 
                                      backgroundColor: "transparent",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = buttonColors.settingsHover;
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = "transparent";
                                    }}
                                    title="Edit Settings"
                                  >
                                    <Settings className="h-4 w-4 text-gray-600" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (tag.id === "wrong_number" && !hasWrongNumberInWorkflow) ensureWrongNumberInWorkflow();
                                      onAddNode?.("tag", {
                                        ...tag,
                                        label: tag.name || tag.label,
                                      });
                                    }}
                                    className="p-1.5 rounded transition-colors"
                                    style={{ 
                                      backgroundColor: "transparent",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = buttonColors.addToCanvasHover;
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = "transparent";
                                    }}
                                    title="Add to Canvas"
                                  >
                                    <ChevronRight className="h-4 w-4" style={{ color: buttonColors.addToCanvasIcon }} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (tag.id === "wrong_number" && !hasWrongNumberInWorkflow) ensureWrongNumberInWorkflow();
                                      handleDuplicateSystemTag(tag);
                                    }}
                                    className="p-1.5 rounded transition-colors"
                                    style={{ 
                                      backgroundColor: "transparent",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = buttonColors.duplicateHover;
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = "transparent";
                                    }}
                                    title="Duplicate (Create Custom Copy)"
                                  >
                                    <Copy className="h-4 w-4" style={{ color: buttonColors.duplicateIcon }} />
                                  </button>
                                </>
                              );
                            })()}
                            {/* Delete button hidden for system tags */}
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Custom Tags Section */}
              {customTags.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Custom Tags</h3>
                  <div className="space-y-2">
                    {customTags.map((tag: any, index: number) => (
                      <div
                        key={`${tag.id || index}-${tag.icon}-${tag.color}`}
                        className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-primary-300 transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {tag.icon ? (() => {
                              const iconMap: { [key: string]: any } = {
                                tag: Tag,
                                phoneoff: PhoneOff,
                                wrongnumber: PhoneMissed,
                                phone: Phone,
                                phonecall: PhoneCall,
                                phoneincoming: PhoneIncoming,
                                phoneoutgoing: PhoneOutgoing,
                              };
                              const iconKey = tag.icon.toLowerCase();
                              const IconComponent = iconMap[iconKey] || Tag;
                              const iconColorValue = tag.iconColor || tag.textColor || tag.color || "#3b82f6";
                              return (
                                <div className="flex items-center">
                                  <IconComponent 
                                    className="h-4 w-4" 
                                    style={{ 
                                      color: iconColorValue,
                                      fill: "none",
                                      stroke: "currentColor"
                                    }} 
                                  />
                                </div>
                              );
                            })() : (
                              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color || "#3b82f6" }} />
                            )}
                            <span className="font-medium text-sm text-gray-900">
                              {tag.name || tag.label || "Tag"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {(() => {
                              const buttonColors = getActionButtonColors(tag);
                              return (
                                <>
                                  <button 
                                    onClick={() => handleEditButton(tag)}
                                    className="p-1.5 rounded transition-colors"
                                    style={{ 
                                      backgroundColor: "transparent",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = buttonColors.settingsHover;
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = "transparent";
                                    }}
                                    title="Edit Settings"
                                  >
                                    <Settings className="h-4 w-4 text-gray-600" />
                                  </button>
                                  <button
                                    onClick={() => onAddNode?.("tag", {
                                      ...tag,
                                      label: tag.name || tag.label,
                                    })}
                                    className="p-1.5 rounded transition-colors"
                                    style={{ 
                                      backgroundColor: "transparent",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = buttonColors.addToCanvasHover;
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = "transparent";
                                    }}
                                    title="Add to Canvas"
                                  >
                                    <ChevronRight className="h-4 w-4" style={{ color: buttonColors.addToCanvasIcon }} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm(`Are you sure you want to remove "${tag.name || tag.label || "this tag"}"?`)) {
                                        onRemoveButton?.(tag.id || tag.name || tag.label, "tag");
                                      }
                                    }}
                                    className="p-1.5 hover:bg-red-50 rounded"
                                    title="Remove Tag"
                                  >
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                  </button>
                                </>
                              );
                            })()}
                          </div>
                          {/* Color Control Panel */}
                          {editingColorTagId === tag.id && (
                            <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200 shadow-lg">
                              <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-semibold text-gray-700">Color Control</label>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleColorSave(tag.id)}
                                    className="p-1 hover:bg-green-50 rounded"
                                    title="Save Color"
                                  >
                                    <Check className="h-3 w-3 text-green-600" />
                                  </button>
                                  <button
                                    onClick={handleColorCancel}
                                    className="p-1 hover:bg-red-50 rounded"
                                    title="Cancel"
                                  >
                                    <X className="h-3 w-3 text-red-600" />
                                  </button>
                                </div>
                              </div>
                              {/* Preset Colors */}
                              <div className="grid grid-cols-4 gap-2 mb-2">
                                {colorOptions.map((color) => (
                                  <button
                                    key={color.value}
                                    onClick={() => setTempColor(color.value)}
                                    className={`h-8 rounded border-2 transition-all ${
                                      tempColor === color.value
                                        ? "border-primary-600 ring-2 ring-primary-200"
                                        : "border-gray-200 hover:border-gray-300"
                                    }`}
                                    style={{ backgroundColor: color.value }}
                                    title={color.name}
                                  >
                                    {tempColor === color.value && (
                                      <Check className="h-4 w-4 text-white mx-auto" />
                                    )}
                                  </button>
                                ))}
                              </div>
                              {/* Custom Color */}
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={tempColor}
                                  onChange={(e) => setTempColor(e.target.value)}
                                  className="w-10 h-8 border border-gray-300 rounded cursor-pointer"
                                />
                                <input
                                  type="text"
                                  value={tempColor}
                                  onChange={(e) => setTempColor(e.target.value)}
                                  placeholder="#3b82f6"
                                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Create New Tag */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Create New Tag</h3>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="w-full px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center justify-center gap-2 text-sm font-medium transition-colors shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create New Tag</span>
                </button>
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 bg-gray-100 rounded-full mb-4">
                <Tag className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No tags yet</h3>
              <p className="text-sm text-gray-600 mb-6 max-w-xs">
                Create your first tag to start building your workflow
              </p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center justify-center gap-2 text-sm font-medium transition-colors shadow-sm mb-3"
              >
                <Plus className="h-4 w-4" />
                <span>Create Tag</span>
              </button>
              <button
                onClick={() => {
                  // TODO: Implement import default tag pack
                  alert("Import default tag pack feature coming soon!");
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Import Default Tag Pack</span>
              </button>
            </div>
          )}
        </div>

        {/* Create Tag Modal */}
        <CreateTagModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSave={handleCreateTag}
        />
      </div>
    </>
  );
}
