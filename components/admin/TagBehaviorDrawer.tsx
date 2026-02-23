"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Settings, Tag, Clock, Target, AlertTriangle, CheckCircle2, Zap, PhoneOff, PhoneMissed, Phone, PhoneCall, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { apiClient } from "@/lib/api";

interface TagConfig {
  autoActions?: {
    callback?: boolean;
    followUp?: boolean;
    close?: boolean;
  };
  attemptRules?: {
    maxAttempts?: number;
    timing?: {
      attempt1?: string;
      attempt2?: string;
      attempt3?: string;
    };
  };
  bucketTarget?: "fresh" | "green" | "orange" | "red";
  overdueRules?: {
    reminders?: {
      first?: number;
      second?: number;
    };
    escalation?: number;
  };
}

interface TagBehaviorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  workflowData?: any;
  onUpdate?: (data: any) => void;
}

export default function TagBehaviorDrawer({ isOpen, onClose, workflowData, onUpdate }: TagBehaviorDrawerProps) {
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [leadsData, setLeadsData] = useState<any[]>([]); // Store leads with callStatus and callbackAt
  const [loadingLeads, setLoadingLeads] = useState(false);

  // Get tags from workflowData
  const tagGroups = workflowData?.tagGroups || {};
  const individualTags = workflowData?.tags || {};
  
  // Get all tags from tagGroups
  const allTagsFromGroups: any[] = [];
  if (tagGroups.connected) {
    allTagsFromGroups.push(...tagGroups.connected.map((tag: any) => ({ ...tag, category: "connected" })));
  }
  if (tagGroups.notConnected) {
    allTagsFromGroups.push(...tagGroups.notConnected.map((tag: any) => ({ ...tag, category: "notConnected" })));
  }
  
  // Get IDs of tags already in groups (to avoid duplicates)
  const tagsInGroupsIds = new Set(allTagsFromGroups.map(tag => tag.id));
  
  // Get individual tags (not in groups) - only include tags that are NOT already in tagGroups
  const individualTagsList = Object.keys(individualTags)
    .filter(key => !tagsInGroupsIds.has(key)) // Only include if not already in tagGroups
    .map(key => ({
      id: key,
      ...individualTags[key],
      category: "independent",
    }));

  // Combine all tags (already deduplicated)
  const allTags = [...allTagsFromGroups, ...individualTagsList];
  
  // Sort tags: system tags first, then by name
  allTags.sort((a, b) => {
    // System tags first
    if (a.isSystem && !b.isSystem) return -1;
    if (!a.isSystem && b.isSystem) return 1;
    // Then by name
    const nameA = (a.name || a.label || "").toLowerCase();
    const nameB = (b.name || b.label || "").toLowerCase();
    return nameA.localeCompare(nameB);
  });

  // Fetch leads data to get actual callStatus and callbackAt (ANKIT_API_01, ANKIT_API_02, ANKIT_API_03)
  // This ensures live reflection of backend changes
  useEffect(() => {
    if (!isOpen) return; // Only fetch when drawer is open
    
    const fetchLeadsData = async () => {
      setLoadingLeads(true);
      try {
        const response = await apiClient.request<any>("/api/leads", {
          method: "GET",
        });
        if (response?.leads) {
          setLeadsData(response.leads);
        }
      } catch (error) {
        console.error("[TagBehaviorDrawer] Error fetching leads:", error);
      } finally {
        setLoadingLeads(false);
      }
    };

    fetchLeadsData();
    
    // Refresh every 30 seconds to get live updates (ANKIT_API_02)
    const interval = setInterval(fetchLeadsData, 30000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Get tag behaviors from workflowData (stored in tags object with behavior config)
  // Use useMemo to recalculate when workflowData changes for live updates
  const tagBehaviors: Record<string, TagConfig> = useMemo(() => {
    const behaviors: Record<string, TagConfig> = {};
    allTags.forEach(tag => {
      const tagData = individualTags[tag.id];
      if (tagData?.behaviorTemplate || tagData?.retryRules || tagData?.tagConfig) {
        // Support both old format (behaviorTemplate, retryRules) and new format (tagConfig)
        if (tagData.tagConfig) {
          behaviors[tag.id] = {
            autoActions: tagData.tagConfig.autoAction === "CALLBACK" ? { callback: true } :
                         tagData.tagConfig.autoAction === "FOLLOWUP" ? { followUp: true } :
                         tagData.tagConfig.autoAction === "CLOSE" ? { close: true } : undefined,
            attemptRules: tagData.tagConfig.retryPolicy ? {
              maxAttempts: tagData.tagConfig.retryPolicy.maxAttempts,
              // Convert array format to object format for UI
              timing: Array.isArray(tagData.tagConfig.retryPolicy.attemptTimings)
                ? tagData.tagConfig.retryPolicy.attemptTimings.reduce((acc: any, item: any) => {
                    acc[`attempt${item.attempt}`] = item.timing;
                    return acc;
                  }, {})
                : tagData.tagConfig.retryPolicy.attemptTimings,
            } : undefined,
            bucketTarget: tagData.tagConfig.bucketTarget,
            overdueRules: tagData.tagConfig.overduePolicy ? {
              reminders: {
                first: tagData.tagConfig.overduePolicy.remindAtMinutes?.[0] || 15,
                second: tagData.tagConfig.overduePolicy.remindAtMinutes?.[1] || 60,
              },
              escalation: tagData.tagConfig.overduePolicy.escalateAtHours || 24,
            } : undefined,
          };
        } else {
          behaviors[tag.id] = {
            autoActions: tagData.autoActions,
            attemptRules: tagData.retryRules || tagData.attemptRules,
            bucketTarget: tagData.bucketTargets?.[0] || tagData.bucketTarget,
            overdueRules: tagData.overdueReminders || tagData.overdueRules,
          };
        }
      }
    });
    return behaviors;
  }, [allTags, individualTags]);

  const selectedTag = selectedTagId ? allTags.find(t => t.id === selectedTagId) : null;
  const selectedConfig = selectedTagId ? (tagBehaviors[selectedTagId] || {}) : null;

  // Get actual callStatus for tags from leads data (ANKIT_API_01, ANKIT_API_03)
  // This shows real-time callStatus from backend instead of just static category
  const getTagActualCallStatus = (tagId: string): { callStatus: string | null; callbackAt: string | null; count: number } => {
    // Find leads that have this tag applied
    const leadsWithTag = leadsData.filter(lead => {
      // Check if lead has this tag in currentTag or tagApplications
      return lead.currentTag?.tagFlowId === tagId || 
             lead.tagApplications?.some((ta: any) => ta.tagFlowId === tagId && ta.isActive);
    });

    if (leadsWithTag.length === 0) {
      return { callStatus: null, callbackAt: null, count: 0 };
    }

    // Get the most recent callStatus and callbackAt
    const latestLead = leadsWithTag[0]; // Already sorted by createdAt desc
    return {
      callStatus: latestLead.callStatus || null, // From backend API (ANKIT_API_01)
      callbackAt: latestLead.callbackAt || null, // From backend API in UTC ISO format (ANKIT_API_01)
      count: leadsWithTag.length,
    };
  };

  // Get color based on callStatus (ANKIT_API_01, ANKIT_API_03)
  // Maps actual callStatus from backend to appropriate colors
  const getCallStatusColor = (callStatus: string | null): string => {
    if (!callStatus) return "#f59e0b"; // Default orange for no status
    
    const statusLower = String(callStatus).toLowerCase().trim().replace(/\s+/g, "_").replace(/-/g, "_");
    
    // Green statuses (connected/processing)
    const greenStatuses = ["interested", "processing", "connected", "in_progress", "follow_up", "qualified", "discussion", "ready_to_process", "documents_ready"];
    if (greenStatuses.includes(statusLower)) {
      return "#10b981"; // Green
    }
    
    // Orange statuses (callback pending)
    const orangeStatuses = ["call_back", "busy_no_response", "switch_off_not_reachable", "documents_pending", "budget_issue", "eligibility_check_pending", "interested_but_later"];
    if (orangeStatuses.includes(statusLower)) {
      return "#f59e0b"; // Orange
    }
    
    // Red statuses (closed/not interested)
    const redStatuses = ["not_interested", "invalid_closed", "not_planning_now", "no_budget", "already_applied", "already_abroad", "family_not_agree", "not_eligible", "just_enquiry", "invalid_number", "wrong_number", "duplicate_lead", "do_not_call"];
    if (redStatuses.includes(statusLower)) {
      return "#ef4444"; // Red
    }
    
    // Default to orange if no match
    return "#f59e0b"; // Orange
  };

  const updateTagBehavior = (tagId: string, config: TagConfig) => {
    if (!onUpdate || !workflowData) return;

    const updatedData = { ...workflowData };
    
    // Ensure tags object exists
    if (!updatedData.tags) {
      updatedData.tags = {};
    }

    // Update or create tag behavior config
    if (!updatedData.tags[tagId]) {
      updatedData.tags[tagId] = {
        id: tagId,
        name: selectedTag?.name || selectedTag?.label || "Tag",
        label: selectedTag?.name || selectedTag?.label || "Tag",
      };
    }

    // Update behavior configuration - use new tagConfig format for compatibility
    const autoAction = config.autoActions?.callback ? "CALLBACK" :
                      config.autoActions?.followUp ? "FOLLOWUP" :
                      config.autoActions?.close ? "CLOSE" : undefined;

    updatedData.tags[tagId] = {
      ...updatedData.tags[tagId],
      // Keep old format for backward compatibility
      behaviorTemplate: config.autoActions ? "custom" : "default",
      autoActions: config.autoActions,
      retryRules: config.attemptRules,
      bucketTargets: config.bucketTarget ? [config.bucketTarget] : [],
      overdueReminders: config.overdueRules,
      // New format (tagConfig) - this is what ButtonSettingsDrawer uses
      tagConfig: {
        template: updatedData.tags[tagId]?.tagConfig?.template || "NO_ANSWER",
        autoAction: autoAction || updatedData.tags[tagId]?.tagConfig?.autoAction || "CALLBACK",
        retryPolicy: config.attemptRules ? {
          maxAttempts: config.attemptRules.maxAttempts || 3,
          // Convert object format to array format (matching seed file structure)
          attemptTimings: (() => {
            const timing = config.attemptRules.timing || {};
            const maxAttempts = config.attemptRules.maxAttempts || 3;
            const timingsArray = [];
            for (let i = 1; i <= maxAttempts; i++) {
              const timingKey = `attempt${i}`;
              const timingValue = timing[timingKey] || (i === 1 ? "+60m" : i === 2 ? "next_day" : "+48h");
              timingsArray.push({
                attempt: i,
                timing: timingValue,
                description: timingValue.startsWith("+") 
                  ? timingValue.replace(/\+(\d+)([mhd])/, (_, val, unit) => {
                      const unitName = unit === "m" ? "Minutes" : unit === "h" ? "Hours" : "Days";
                      return `+${val} ${unitName}`;
                    })
                  : timingValue === "next_day" ? "Next Day" : timingValue,
              });
            }
            return timingsArray;
          })(),
          attemptCountSource: "tagHistory",
        } : undefined,
        overduePolicy: config.overdueRules ? {
          popupAtSeconds: 30,
          remindAtMinutes: [
            config.overdueRules.reminders?.first || 15,
            config.overdueRules.reminders?.second || 60,
          ],
          escalateAtHours: config.overdueRules.escalation || 24,
        } : undefined,
        bucketTarget: config.bucketTarget || "green",
      },
    };

    onUpdate(updatedData);
  };

  if (!isOpen) return null;

  return (
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
      <div className="px-4 py-4 border-b border-gray-200 bg-gradient-to-r from-primary-50 to-primary-100 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-600 rounded-lg">
            <Settings className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Tag Behavior</h2>
            <p className="text-xs text-gray-600">Configure tag logic and rules</p>
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
      <div className="overflow-y-auto p-4" style={{ maxHeight: "calc(100vh - 250px)" }}>
        {allTags.length === 0 ? (
          <div className="text-center py-12">
            <Tag className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No tags available. Create tags first.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Tag List */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Select Tag</h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {allTags.map((tag) => {
                  const isSelected = selectedTagId === tag.id;
                  const hasConfig = !!tagBehaviors[tag.id];
                  return (
                    <button
                      key={`${tag.id}-${tag.category}-${!!tagBehaviors[tag.id]}`}
                      onClick={() => setSelectedTagId(tag.id)}
                      className={`w-full border-2 rounded-lg text-left transition-all shadow-md ${
                        isSelected
                          ? "ring-2 ring-primary-500"
                          : ""
                      }`}
                      style={{
                        backgroundColor: tag.color || "#3b82f6",
                        color: tag.textColor || tag.iconColor || "#ffffff",
                        borderColor: isSelected ? "#3b82f6" : (tag.borderColor || "#e5e7eb"),
                        borderWidth: "2px",
                        borderRadius: tag.borderRadius ? `${tag.borderRadius}px` : "8px",
                        padding: tag.paddingY && tag.paddingX ? `${tag.paddingY}px ${tag.paddingX}px` : "12px 16px",
                        boxShadow: tag.shadow !== false ? "rgba(0, 0, 0, 0.1) 0px 2px 4px" : "none",
                      }}
                    >
                      <div className="flex items-center gap-2 flex-1">
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
                          const iconColorValue = tag.iconColor || tag.textColor || "#ffffff";
                          return (
                            <div 
                              className="flex items-center justify-center"
                              style={{ color: iconColorValue }}
                            >
                              <IconComponent className="h-4 w-4" style={{ color: iconColorValue }} />
                            </div>
                          );
                        })() : (
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color || "#3b82f6" }} />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span 
                              className="text-sm font-medium truncate"
                              style={{
                                color: tag.textColor || tag.iconColor || "#ffffff",
                                fontFamily: tag.fontFamily || "system-ui",
                                fontSize: tag.fontSize ? `${tag.fontSize}px` : "14px",
                                fontWeight: tag.fontWeight || "600",
                              }}
                            >
                              {tag.name || tag.label || "Tag"}
                            </span>
                            {tag.isSystem && (
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
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {/* Show actual callStatus from backend (ANKIT_API_01, ANKIT_API_03) */}
                            {(() => {
                              const actualStatus = getTagActualCallStatus(tag.id);
                              // If we have actual callStatus from backend, show it; otherwise show category
                              const displayStatus = actualStatus.callStatus 
                                ? actualStatus.callStatus 
                                : (tag.category?.replace(/_/g, " ") || "Tag");
                              
                              // Priority: 1. callStatus color, 2. categoryTextColor from ButtonSettingsDrawer, 3. tag color
                              const statusColor = actualStatus.callStatus 
                                ? getCallStatusColor(actualStatus.callStatus)
                                : (tag.categoryTextColor || tag.color || undefined);
                              
                              return (
                                <span 
                                  className="text-xs capitalize"
                                  style={{
                                    color: statusColor || tag.color || "#ffffff",
                                    opacity: tag.categoryTextOpacity !== undefined ? tag.categoryTextOpacity / 100 : 1,
                                    fontWeight: tag.categoryTextFontWeight || "600",
                                    fontSize: tag.categoryTextFontSize ? `${tag.categoryTextFontSize}px` : "12px",
                                  }}
                                  title={actualStatus.callStatus 
                                    ? `Actual: ${actualStatus.callStatus}${actualStatus.callbackAt ? ` | Callback: ${new Date(actualStatus.callbackAt).toLocaleString()}` : ''} (${actualStatus.count} leads)`
                                    : `Category: ${tag.category || "Tag"}`
                                  }
                                >
                                  {displayStatus}
                                </span>
                              );
                            })()}
                            {hasConfig && (
                              <span 
                                className="text-xs font-medium"
                                style={{
                                  color: "#10b981", // Green color for configured indicator
                                }}
                              >
                                • Configured
                              </span>
                            )}
                          </div>
                        </div>
                        {hasConfig && (
                          <CheckCircle2 
                            className="h-5 w-5 flex-shrink-0" 
                            style={{ color: "#10b981" }} // Green color for configured icon
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tag Configuration Panel */}
            {selectedTag && selectedConfig !== null && (
              <div className="border-t border-gray-200 pt-4 space-y-4">
                <div 
                  className="p-4 rounded-lg border-2 shadow-md"
                  style={{
                    backgroundColor: selectedTag.color || "#3b82f6",
                    color: selectedTag.textColor || selectedTag.iconColor || "#ffffff",
                    borderColor: selectedTag.borderColor || "#e5e7eb",
                    borderWidth: "2px",
                    borderRadius: selectedTag.borderRadius ? `${selectedTag.borderRadius}px` : "8px",
                    boxShadow: selectedTag.shadow !== false ? "rgba(0, 0, 0, 0.1) 0px 2px 4px" : "none",
                  }}
                >
                  <div className="flex items-center gap-2">
                    {selectedTag.icon ? (() => {
                      const iconMap: { [key: string]: any } = {
                        tag: Tag,
                        phoneoff: PhoneOff,
                        wrongnumber: PhoneMissed,
                        phone: Phone,
                        phonecall: PhoneCall,
                        phoneincoming: PhoneIncoming,
                        phoneoutgoing: PhoneOutgoing,
                      };
                      const iconKey = selectedTag.icon.toLowerCase();
                      const IconComponent = iconMap[iconKey] || Tag;
                      const iconColorValue = selectedTag.iconColor || selectedTag.textColor || "#ffffff";
                      return (
                        <div 
                          className="flex items-center justify-center"
                          style={{ color: iconColorValue }}
                        >
                          <IconComponent className="h-4 w-4" style={{ color: iconColorValue }} />
                        </div>
                      );
                    })() : (
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedTag.color || "#3b82f6" }} />
                    )}
                    <div className="flex items-center gap-2 flex-1">
                      <h3 
                        className="text-lg font-semibold"
                        style={{
                          color: selectedTag.textColor || selectedTag.iconColor || "#ffffff",
                          fontFamily: selectedTag.fontFamily || "system-ui",
                          fontSize: selectedTag.fontSize ? `${selectedTag.fontSize}px` : "18px",
                          fontWeight: selectedTag.fontWeight || "600",
                        }}
                      >
                        {selectedTag.name || selectedTag.label || "Tag"}
                      </h3>
                      {selectedTag.isSystem && (
                        <span 
                          className="px-1.5 py-0.5 text-xs font-medium rounded border"
                          style={{
                            backgroundColor: selectedTag.badgeBgColor || "rgba(255, 255, 255, 0.2)",
                            color: selectedTag.badgeColor || "#ffffff",
                            borderColor: selectedTag.badgeBorderColor || "rgba(255, 255, 255, 0.3)",
                          }}
                        >
                          System
                        </span>
                      )}
                    </div>
                    {/* Show actual callStatus from backend (ANKIT_API_01, ANKIT_API_03) */}
                    {(() => {
                      const actualStatus = getTagActualCallStatus(selectedTag.id);
                      const displayStatus = actualStatus.callStatus 
                        ? actualStatus.callStatus 
                        : (selectedTag.category?.replace(/_/g, " ") || "Tag");
                      
                      // Priority: 1. callStatus color, 2. categoryTextColor from ButtonSettingsDrawer, 3. tag color
                      const statusColor = actualStatus.callStatus 
                        ? getCallStatusColor(actualStatus.callStatus)
                        : (selectedTag.categoryTextColor || selectedTag.color || undefined);
                      
                      return (
                        <div 
                          className="text-xs capitalize" 
                          style={{ 
                            color: statusColor || selectedTag.color || "#ffffff",
                            opacity: selectedTag.categoryTextOpacity !== undefined ? selectedTag.categoryTextOpacity / 100 : 1,
                            fontWeight: selectedTag.categoryTextFontWeight || "600",
                            fontSize: selectedTag.categoryTextFontSize ? `${selectedTag.categoryTextFontSize}px` : "12px",
                          }}
                          title={actualStatus.callStatus 
                            ? `Actual: ${actualStatus.callStatus}${actualStatus.callbackAt ? ` | Callback: ${new Date(actualStatus.callbackAt).toLocaleString()}` : ''} (${actualStatus.count} leads)`
                            : `Category: ${selectedTag.category || "Tag"}`
                          }
                        >
                          {displayStatus}
                          {actualStatus.count > 0 && (
                            <span className="ml-2 text-xs opacity-75">
                              ({actualStatus.count})
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Auto Actions */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Auto Actions
                  </h4>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedConfig.autoActions?.callback || false}
                        onChange={(e) => updateTagBehavior(selectedTag.id, {
                          ...selectedConfig,
                          autoActions: {
                            ...selectedConfig.autoActions,
                            callback: e.target.checked,
                          },
                        })}
                        className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">Auto Schedule Callback</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedConfig.autoActions?.followUp || false}
                        onChange={(e) => updateTagBehavior(selectedTag.id, {
                          ...selectedConfig,
                          autoActions: {
                            ...selectedConfig.autoActions,
                            followUp: e.target.checked,
                          },
                        })}
                        className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">Auto Schedule Follow-up</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedConfig.autoActions?.close || false}
                        onChange={(e) => updateTagBehavior(selectedTag.id, {
                          ...selectedConfig,
                          autoActions: {
                            ...selectedConfig.autoActions,
                            close: e.target.checked,
                          },
                        })}
                        className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">Auto Close Lead</span>
                    </label>
                  </div>
                </div>

                {/* Attempt Rules */}
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary-600" />
                    Retry Policy
                  </h4>
                  <div className="space-y-4">
                    {/* Max Attempts */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Maximum Attempts
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={selectedConfig.attemptRules?.maxAttempts || 3}
                          onChange={(e) => updateTagBehavior(selectedTag.id, {
                            ...selectedConfig,
                            attemptRules: {
                              ...selectedConfig.attemptRules,
                              maxAttempts: parseInt(e.target.value) || 3,
                            },
                          })}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-center font-medium"
                        />
                        <span className="text-sm text-gray-600">
                          {selectedConfig.attemptRules?.maxAttempts || 3} attempt{(selectedConfig.attemptRules?.maxAttempts || 3) !== 1 ? "s" : ""} will be made
                        </span>
                      </div>
                    </div>

                    {/* Attempt Timings */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Attempt Schedule
                      </label>
                      <div className="space-y-3">
                        {Array.from({ length: selectedConfig.attemptRules?.maxAttempts || 3 }, (_, index) => {
                          const attemptNumber = index + 1;
                          const timingKey = `attempt${attemptNumber}` as keyof typeof selectedConfig.attemptRules.timing;
                          const currentTiming = selectedConfig.attemptRules?.timing?.[timingKey] || "";
                          
                          // Parse timing to show in a better format
                          const getTimingDisplay = (timing: string) => {
                            if (!timing) return "";
                            if (timing.startsWith("+")) {
                              const match = timing.match(/\+(\d+)([mhd])/);
                              if (match) {
                                const value = match[1];
                                const unit = match[2] === "m" ? "minutes" : match[2] === "h" ? "hours" : "days";
                                return `+${value} ${unit}`;
                              }
                            }
                            return timing;
                          };

                          return (
                            <div key={attemptNumber} className="bg-white border border-gray-200 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                                    <span className="text-xs font-semibold text-primary-600">{attemptNumber}</span>
                                  </div>
                                  <span className="text-sm font-medium text-gray-900">
                                    Attempt {attemptNumber}
                                  </span>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div className="flex gap-2">
                                  <select
                                    value={currentTiming.match(/^\+(\d+)([mhd])/) ? "relative" : currentTiming === "next_day" ? "next_day" : "custom"}
                                    onChange={(e) => {
                                      let newTiming = "";
                                      if (e.target.value === "relative") {
                                        newTiming = "+60m";
                                      } else if (e.target.value === "next_day") {
                                        newTiming = "next_day";
                                      } else {
                                        newTiming = currentTiming;
                                      }
                                      updateTagBehavior(selectedTag.id, {
                                        ...selectedConfig,
                                        attemptRules: {
                                          ...selectedConfig.attemptRules,
                                          timing: {
                                            ...selectedConfig.attemptRules?.timing,
                                            [timingKey]: newTiming,
                                          },
                                        },
                                      });
                                    }}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                                  >
                                    <option value="relative">Relative Time (+X m/h/d)</option>
                                    <option value="next_day">Next Day</option>
                                    <option value="custom">Custom</option>
                                  </select>
                                </div>
                                {(() => {
                                  const timingType = currentTiming.match(/^\+(\d+)([mhd])/) ? "relative" : currentTiming === "next_day" ? "next_day" : "custom";
                                  if (timingType === "relative") {
                                    const match = currentTiming.match(/^\+(\d+)([mhd])/);
                                    const value = match ? match[1] : "60";
                                    const unit = match ? match[2] : "m";
                                    return (
                                      <div className="flex gap-2">
                                        <input
                                          type="number"
                                          min="1"
                                          value={value}
                                          onChange={(e) => {
                                            const newValue = e.target.value;
                                            const newTiming = `+${newValue}${unit}`;
                                            updateTagBehavior(selectedTag.id, {
                                              ...selectedConfig,
                                              attemptRules: {
                                                ...selectedConfig.attemptRules,
                                                timing: {
                                                  ...selectedConfig.attemptRules?.timing,
                                                  [timingKey]: newTiming,
                                                },
                                              },
                                            });
                                          }}
                                          className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                                          placeholder="60"
                                        />
                                        <select
                                          value={unit}
                                          onChange={(e) => {
                                            const newUnit = e.target.value;
                                            const newTiming = `+${value}${newUnit}`;
                                            updateTagBehavior(selectedTag.id, {
                                              ...selectedConfig,
                                              attemptRules: {
                                                ...selectedConfig.attemptRules,
                                                timing: {
                                                  ...selectedConfig.attemptRules?.timing,
                                                  [timingKey]: newTiming,
                                                },
                                              },
                                            });
                                          }}
                                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                                        >
                                          <option value="m">Minutes</option>
                                          <option value="h">Hours</option>
                                          <option value="d">Days</option>
                                        </select>
                                      </div>
                                    );
                                  } else if (timingType === "next_day") {
                                    return (
                                      <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 p-2 rounded">
                                        <Clock className="h-4 w-4 text-blue-600" />
                                        <span>Next day at 9:00 AM</span>
                                      </div>
                                    );
                                  } else {
                                    return (
                                      <input
                                        type="text"
                                        placeholder="e.g., +60m, next_day, +48h"
                                        value={currentTiming}
                                        onChange={(e) => updateTagBehavior(selectedTag.id, {
                                          ...selectedConfig,
                                          attemptRules: {
                                            ...selectedConfig.attemptRules,
                                            timing: {
                                              ...selectedConfig.attemptRules?.timing,
                                              [timingKey]: e.target.value,
                                            },
                                          },
                                        })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                                      />
                                    );
                                  }
                                })()}
                                {currentTiming && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {getTimingDisplay(currentTiming)}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bucket Target */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Bucket Target
                  </h4>
                  <select
                    value={selectedConfig.bucketTarget || "green"}
                    onChange={(e) => updateTagBehavior(selectedTag.id, {
                      ...selectedConfig,
                      bucketTarget: e.target.value as "fresh" | "green" | "orange" | "red",
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="fresh">Fresh (Blue)</option>
                    <option value="green">Green (Connected)</option>
                    <option value="orange">Orange (Callback Due)</option>
                    <option value="red">Red (Overdue/Lost)</option>
                  </select>
                </div>

                {/* Overdue Rules */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Overdue Rules
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        First Reminder (minutes)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={selectedConfig.overdueRules?.reminders?.first || 15}
                        onChange={(e) => updateTagBehavior(selectedTag.id, {
                          ...selectedConfig,
                          overdueRules: {
                            ...selectedConfig.overdueRules,
                            reminders: {
                              ...selectedConfig.overdueRules?.reminders,
                              first: parseInt(e.target.value) || 15,
                            },
                          },
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Second Reminder (minutes)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={selectedConfig.overdueRules?.reminders?.second || 60}
                        onChange={(e) => updateTagBehavior(selectedTag.id, {
                          ...selectedConfig,
                          overdueRules: {
                            ...selectedConfig.overdueRules,
                            reminders: {
                              ...selectedConfig.overdueRules?.reminders,
                              second: parseInt(e.target.value) || 60,
                            },
                          },
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Escalation (hours)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={selectedConfig.overdueRules?.escalation || 24}
                        onChange={(e) => updateTagBehavior(selectedTag.id, {
                          ...selectedConfig,
                          overdueRules: {
                            ...selectedConfig.overdueRules,
                            escalation: parseInt(e.target.value) || 24,
                          },
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedTag && selectedConfig === null && (
              <div className="border-t border-gray-200 pt-4 text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                <Settings className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Select a tag to configure behavior</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
