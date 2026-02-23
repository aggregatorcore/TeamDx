"use client";

import { useState } from "react";
import { Settings, Tag, Clock, Target, AlertTriangle, CheckCircle2, Zap } from "lucide-react";

interface TagConfig {
  autoActions?: {
    callback?: boolean;
    followUp?: boolean;
    close?: boolean;
  };
  attemptRules?: {
    maxAttempts?: number;
    timing?: {
      attempt1?: string; // e.g., "+60 minutes"
      attempt2?: string; // e.g., "next day"
      attempt3?: string; // e.g., "+48 hours"
    };
  };
  bucketTarget?: "fresh" | "green" | "orange" | "red";
  overdueRules?: {
    reminders?: {
      first?: number; // minutes
      second?: number; // minutes
    };
    escalation?: number; // hours
  };
}

interface TagGroups {
  connected: Array<{ id: string; name: string; color: string }>;
  notConnected: Array<{ id: string; name: string; color: string }>;
}

interface WorkflowTagConfigProps {
  tags: Record<string, TagConfig>;
  tagGroups?: TagGroups;
  onUpdate: (tags: Record<string, TagConfig>) => void;
}

export default function WorkflowTagConfig({ tags = {}, tagGroups, onUpdate }: WorkflowTagConfigProps) {
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);

  // Safe access with defaults - handle undefined/null tagGroups
  if (!tagGroups) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center py-12">
          <Tag className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Tag groups not configured. Configure tag groups first.</p>
        </div>
      </div>
    );
  }

  const safeTagGroups = {
    connected: tagGroups.connected || [],
    notConnected: tagGroups.notConnected || [],
  };

  const allTags = [
    ...safeTagGroups.connected.map(t => ({ ...t, category: "connected" as const })),
    ...safeTagGroups.notConnected.map(t => ({ ...t, category: "notConnected" as const })),
  ];

  const selectedTag = selectedTagId ? allTags.find(t => t.id === selectedTagId) : null;
  const selectedConfig = selectedTagId ? tags[selectedTagId] || {} : null;

  const updateTagConfig = (tagId: string, config: TagConfig) => {
    onUpdate({ ...tags, [tagId]: config });
  };

  if (allTags.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center py-12">
          <Tag className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No tags configured. Configure tag groups first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="h-6 w-6 text-primary-600" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Tag Configuration</h2>
          <p className="text-sm text-gray-500">Configure logic for each tag (auto actions, attempts, bucket, overdue)</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Tag List Sidebar */}
        <div className="col-span-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Select Tag</h3>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {allTags.map((tag) => {
              const isSelected = selectedTagId === tag.id;
              const hasConfig = !!tags[tag.id];
              return (
                <button
                  key={tag.id}
                  onClick={() => setSelectedTagId(tag.id)}
                  className={`w-full p-3 border-2 rounded-lg text-left transition-all ${
                    isSelected
                      ? "border-primary-500 bg-primary-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{tag.name}</div>
                      <div className="text-xs text-gray-500">{tag.category.replace(/_/g, " ")}</div>
                    </div>
                    {hasConfig && (
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tag Configuration Panel */}
        <div className="col-span-8">
          {selectedTag && selectedConfig ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Configure: {selectedTag.name}
                </h3>
                <p className="text-sm text-gray-500">
                  Category: {selectedTag.category.replace(/_/g, " ")}
                </p>
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
                      onChange={(e) => updateTagConfig(selectedTag.id, {
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
                      onChange={(e) => updateTagConfig(selectedTag.id, {
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
                      onChange={(e) => updateTagConfig(selectedTag.id, {
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
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Attempt Rules
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Attempts
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={selectedConfig.attemptRules?.maxAttempts || 3}
                      onChange={(e) => updateTagConfig(selectedTag.id, {
                        ...selectedConfig,
                        attemptRules: {
                          ...selectedConfig.attemptRules,
                          maxAttempts: parseInt(e.target.value) || 3,
                        },
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Attempt Timings</label>
                    <input
                      type="text"
                      placeholder="Attempt 1: +60 minutes"
                      value={selectedConfig.attemptRules?.timing?.attempt1 || ""}
                      onChange={(e) => updateTagConfig(selectedTag.id, {
                        ...selectedConfig,
                        attemptRules: {
                          ...selectedConfig.attemptRules,
                          timing: {
                            ...selectedConfig.attemptRules?.timing,
                            attempt1: e.target.value,
                          },
                        },
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Attempt 2: next day"
                      value={selectedConfig.attemptRules?.timing?.attempt2 || ""}
                      onChange={(e) => updateTagConfig(selectedTag.id, {
                        ...selectedConfig,
                        attemptRules: {
                          ...selectedConfig.attemptRules,
                          timing: {
                            ...selectedConfig.attemptRules?.timing,
                            attempt2: e.target.value,
                          },
                        },
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Attempt 3: +48 hours"
                      value={selectedConfig.attemptRules?.timing?.attempt3 || ""}
                      onChange={(e) => updateTagConfig(selectedTag.id, {
                        ...selectedConfig,
                        attemptRules: {
                          ...selectedConfig.attemptRules,
                          timing: {
                            ...selectedConfig.attemptRules?.timing,
                            attempt3: e.target.value,
                          },
                        },
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 text-sm"
                    />
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
                  onChange={(e) => updateTagConfig(selectedTag.id, {
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
                      onChange={(e) => updateTagConfig(selectedTag.id, {
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
                      onChange={(e) => updateTagConfig(selectedTag.id, {
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
                      onChange={(e) => updateTagConfig(selectedTag.id, {
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
          ) : (
            <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
              <Settings className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Select a tag to configure</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
