"use client";

import { useState } from "react";
import { X, Tag, ArrowRight, ArrowLeft, Check, Zap, Clock, Target, AlertTriangle } from "lucide-react";

interface TagConfig {
  template?: "NO_ANSWER" | "BUSY" | "SWITCH_OFF" | "INVALID" | "CONNECTED_FLOW";
  autoAction?: "CALLBACK" | "FOLLOWUP" | "CLOSE";
  retryPolicy?: {
    maxAttempts: number;
    attemptTimings: Array<{
      attempt: number;
      timing: string;
      description: string;
    }>;
    attemptCountSource: "tagHistory";
  };
  overduePolicy?: {
    popupAtSeconds: number;
    remindAtMinutes: number[];
    escalateAtHours: number;
  };
  bucketTarget?: "fresh" | "green" | "orange" | "red";
}

interface CreateTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tagData: {
    name: string;
    label: string;
    category: "connected" | "notConnected";
    color: string;
    tagConfig: TagConfig;
  }) => void;
}

const TEMPLATES = {
  NO_ANSWER: {
    name: "No Answer",
    description: "Auto callback with retries",
    autoAction: "CALLBACK" as const,
    retryPolicy: {
      maxAttempts: 3,
      attemptTimings: [
        { attempt: 1, timing: "+60m", description: "+60 Minutes" },
        { attempt: 2, timing: "next_day", description: "Next Day" },
        { attempt: 3, timing: "+48h", description: "+48 Hours" },
      ],
      attemptCountSource: "tagHistory" as const,
    },
    overduePolicy: {
      popupAtSeconds: 30,
      remindAtMinutes: [15, 60],
      escalateAtHours: 24,
    },
    bucketTarget: "orange" as const,
  },
  BUSY: {
    name: "Busy",
    description: "Short callback",
    autoAction: "CALLBACK" as const,
    overduePolicy: {
      popupAtSeconds: 30,
      remindAtMinutes: [15, 60],
      escalateAtHours: 24,
    },
    bucketTarget: "orange" as const,
  },
  SWITCH_OFF: {
    name: "Switch Off",
    description: "Long callback",
    autoAction: "CALLBACK" as const,
    overduePolicy: {
      popupAtSeconds: 30,
      remindAtMinutes: [15, 60],
      escalateAtHours: 24,
    },
    bucketTarget: "orange" as const,
  },
  INVALID: {
    name: "Invalid",
    description: "Close lead (no callback)",
    autoAction: "CLOSE" as const,
    bucketTarget: "red" as const,
  },
  CONNECTED_FLOW: {
    name: "Connected Flow",
    description: "Green / Followup rules",
    autoAction: "FOLLOWUP" as const,
    bucketTarget: "green" as const,
  },
};

export default function CreateTagModal({ isOpen, onClose, onSave }: CreateTagModalProps) {
  const [step, setStep] = useState(1);
  const [tagName, setTagName] = useState("");
  const [category, setCategory] = useState<"connected" | "notConnected">("notConnected");
  const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof TEMPLATES | null>(null);
  const [tagConfig, setTagConfig] = useState<TagConfig>({});
  const [color, setColor] = useState("#3b82f6");

  // Auto-fill behavior when template is selected
  const handleTemplateSelect = (templateKey: keyof typeof TEMPLATES) => {
    setSelectedTemplate(templateKey);
    const template = TEMPLATES[templateKey];
    setTagConfig({
      template: templateKey,
      autoAction: template.autoAction,
      retryPolicy: template.retryPolicy,
      overduePolicy: template.overduePolicy,
      bucketTarget: template.bucketTarget,
    });
  };

  const handleNext = () => {
    if (step === 1 && tagName.trim()) {
      setStep(2);
    } else if (step === 2 && category) {
      setStep(3);
    } else if (step === 3 && selectedTemplate) {
      setStep(4);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSave = () => {
    if (tagName.trim() && category && selectedTemplate) {
      onSave({
        name: tagName.trim(),
        label: tagName.trim(),
        category,
        color,
        tagConfig,
      });
      // Reset form
      setStep(1);
      setTagName("");
      setCategory("notConnected");
      setSelectedTemplate(null);
      setTagConfig({});
      setColor("#3b82f6");
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-primary-50 to-primary-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-600 rounded-lg">
              <Tag className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Create New Tag</h2>
              <p className="text-xs text-gray-600">Step {step} of 4</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Tag Name */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Tag Name</h3>
                <p className="text-sm text-gray-600 mb-4">Enter a name for this tag</p>
                <input
                  type="text"
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  placeholder="e.g., No Answer, Busy, Interested"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-lg"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Step 2: Category */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Category</h3>
                <p className="text-sm text-gray-600 mb-4">Select the category for this tag</p>
                <div className="space-y-3">
                  <button
                    onClick={() => setCategory("connected")}
                    className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                      category === "connected"
                        ? "border-primary-500 bg-primary-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full bg-green-500" />
                      <div>
                        <div className="font-semibold text-gray-900">Connected</div>
                        <div className="text-sm text-gray-600">For leads that answered the call</div>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => setCategory("notConnected")}
                    className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                      category === "notConnected"
                        ? "border-primary-500 bg-primary-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full bg-red-500" />
                      <div>
                        <div className="font-semibold text-gray-900">Not Connected</div>
                        <div className="text-sm text-gray-600">For leads that didn't answer</div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Template Select */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Template</h3>
                <p className="text-sm text-gray-600 mb-4">Select a template to auto-fill behavior settings</p>
                <div className="grid grid-cols-1 gap-3">
                  {Object.entries(TEMPLATES).map(([key, template]) => (
                    <button
                      key={key}
                      onClick={() => handleTemplateSelect(key as keyof typeof TEMPLATES)}
                      className={`p-4 border-2 rounded-lg text-left transition-all ${
                        selectedTemplate === key
                          ? "border-primary-500 bg-primary-50 ring-2 ring-primary-200"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="font-semibold text-gray-900">{template.name}</div>
                            {selectedTemplate === key && (
                              <Check className="h-4 w-4 text-primary-600" />
                            )}
                          </div>
                          <div className="text-sm text-gray-600 mb-2">{template.description}</div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="px-2 py-1 bg-gray-100 rounded">
                              {template.autoAction}
                            </span>
                            {template.retryPolicy && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                                {template.retryPolicy.maxAttempts} Retries
                              </span>
                            )}
                            {template.overduePolicy && (
                              <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded">
                                Overdue Policy
                              </span>
                            )}
                            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">
                              {template.bucketTarget?.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Advanced (Optional Override) */}
          {step === 4 && selectedTemplate && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Advanced Settings</h3>
                <p className="text-sm text-gray-600 mb-4">Optional: Override template defaults</p>
              </div>

              {/* Retry Policy (if applicable) */}
              {tagConfig.retryPolicy && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Retry Policy
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
                        value={tagConfig.retryPolicy.maxAttempts || 3}
                        onChange={(e) => setTagConfig({
                          ...tagConfig,
                          retryPolicy: {
                            ...tagConfig.retryPolicy!,
                            maxAttempts: parseInt(e.target.value) || 3,
                          },
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Attempt Timings</label>
                      {tagConfig.retryPolicy.attemptTimings?.map((timing, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            placeholder={`Attempt ${timing.attempt}: ${timing.timing}`}
                            value={timing.timing}
                            onChange={(e) => {
                              const newTimings = [...(tagConfig.retryPolicy?.attemptTimings || [])];
                              newTimings[index] = { ...timing, timing: e.target.value };
                              setTagConfig({
                                ...tagConfig,
                                retryPolicy: {
                                  ...tagConfig.retryPolicy!,
                                  attemptTimings: newTimings,
                                },
                              });
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 text-sm"
                          />
                          <input
                            type="text"
                            placeholder="Description"
                            value={timing.description}
                            onChange={(e) => {
                              const newTimings = [...(tagConfig.retryPolicy?.attemptTimings || [])];
                              newTimings[index] = { ...timing, description: e.target.value };
                              setTagConfig({
                                ...tagConfig,
                                retryPolicy: {
                                  ...tagConfig.retryPolicy!,
                                  attemptTimings: newTimings,
                                },
                              });
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Overdue Policy (if applicable) */}
              {tagConfig.overduePolicy && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Overdue Policy
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Popup At (seconds)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={tagConfig.overduePolicy.popupAtSeconds || 30}
                        onChange={(e) => setTagConfig({
                          ...tagConfig,
                          overduePolicy: {
                            ...tagConfig.overduePolicy!,
                            popupAtSeconds: parseInt(e.target.value) || 30,
                          },
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Remind At (minutes, comma-separated)
                      </label>
                      <input
                        type="text"
                        placeholder="15, 60"
                        value={tagConfig.overduePolicy.remindAtMinutes?.join(", ") || ""}
                        onChange={(e) => {
                          const minutes = e.target.value.split(",").map(m => parseInt(m.trim())).filter(m => !isNaN(m));
                          setTagConfig({
                            ...tagConfig,
                            overduePolicy: {
                              ...tagConfig.overduePolicy!,
                              remindAtMinutes: minutes,
                            },
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Escalate At (hours)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={tagConfig.overduePolicy.escalateAtHours || 24}
                        onChange={(e) => setTagConfig({
                          ...tagConfig,
                          overduePolicy: {
                            ...tagConfig.overduePolicy!,
                            escalateAtHours: parseInt(e.target.value) || 24,
                          },
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Bucket Target */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Bucket Target
                </h4>
                <select
                  value={tagConfig.bucketTarget || "green"}
                  onChange={(e) => setTagConfig({
                    ...tagConfig,
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
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between flex-shrink-0">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`w-2 h-2 rounded-full ${
                  s === step ? "bg-primary-600" : s < step ? "bg-green-500" : "bg-gray-300"
                }`}
              />
            ))}
          </div>
          {step < 4 ? (
            <button
              onClick={handleNext}
              disabled={
                (step === 1 && !tagName.trim()) ||
                (step === 2 && !category) ||
                (step === 3 && !selectedTemplate)
              }
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <Check className="h-4 w-4" />
              Create Tag
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
