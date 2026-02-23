"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Save, AlertCircle, CheckCircle2, X } from "lucide-react";

interface ActionRule {
  attempts: Array<{
    attemptNumber: number;
    delayMinutes: number;
    actions: Array<{
      type: "createTask" | "sendEmail" | "sendWhatsApp" | "updateLeadStatus" | "assignToUser" | "createNotification";
      params: Record<string, any>;
    }>;
  }>;
  finalAttempt?: {
    delayMinutes: number;
    actions: Array<{
      type: "createTask" | "sendEmail" | "sendWhatsApp" | "updateLeadStatus" | "assignToUser" | "createNotification" | "escalate";
      params: Record<string, any>;
    }>;
  };
}

interface ActionRulesEditorProps {
  value: string | null; // JSON string
  onChange: (value: string | null) => void;
  onSave?: () => void;
}

const ACTION_TYPES = [
  { value: "createTask", label: "Create Task" },
  { value: "sendEmail", label: "Send Email" },
  { value: "sendWhatsApp", label: "Send WhatsApp" },
  { value: "updateLeadStatus", label: "Update Lead Status" },
  { value: "assignToUser", label: "Assign To User" },
  { value: "createNotification", label: "Create Notification" },
  { value: "escalate", label: "Escalate" },
];

export default function ActionRulesEditor({
  value,
  onChange,
  onSave,
}: ActionRulesEditorProps) {
  const [rules, setRules] = useState<ActionRule>({
    attempts: [],
    finalAttempt: undefined,
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(true);

  useEffect(() => {
    if (value) {
      try {
        const parsed = JSON.parse(value);
        setRules(parsed);
        setIsValid(true);
        setError(null);
      } catch (err) {
        setError("Invalid JSON format");
        setIsValid(false);
      }
    } else {
      setRules({
        attempts: [],
        finalAttempt: undefined,
      });
      setIsValid(true);
      setError(null);
    }
  }, [value]);

  const validateAndSave = () => {
    try {
      const jsonString = JSON.stringify(rules, null, 2);
      JSON.parse(jsonString); // Validate JSON
      onChange(jsonString);
      setIsValid(true);
      setError(null);
      setSuccess("Action rules saved successfully!");
      setTimeout(() => setSuccess(null), 3000);
      if (onSave) onSave();
    } catch (err: any) {
      setError("Invalid JSON: " + err.message);
      setIsValid(false);
    }
  };

  const addAttempt = () => {
    const attemptNumber = rules.attempts.length + 1;
    setRules({
      ...rules,
      attempts: [
        ...rules.attempts,
        {
          attemptNumber,
          delayMinutes: 60,
          actions: [],
        },
      ],
    });
  };

  const removeAttempt = (index: number) => {
    const newAttempts = rules.attempts.filter((_, i) => i !== index);
    // Renumber attempts
    const renumbered = newAttempts.map((attempt, i) => ({
      ...attempt,
      attemptNumber: i + 1,
    }));
    setRules({
      ...rules,
      attempts: renumbered,
    });
  };

  const updateAttempt = (index: number, field: string, value: any) => {
    const newAttempts = [...rules.attempts];
    newAttempts[index] = {
      ...newAttempts[index],
      [field]: value,
    };
    setRules({
      ...rules,
      attempts: newAttempts,
    });
  };

  const addActionToAttempt = (attemptIndex: number) => {
    const newAttempts = [...rules.attempts];
    newAttempts[attemptIndex].actions.push({
      type: "createTask",
      params: {},
    });
    setRules({
      ...rules,
      attempts: newAttempts,
    });
  };

  const removeActionFromAttempt = (attemptIndex: number, actionIndex: number) => {
    const newAttempts = [...rules.attempts];
    newAttempts[attemptIndex].actions = newAttempts[attemptIndex].actions.filter(
      (_, i) => i !== actionIndex
    );
    setRules({
      ...rules,
      attempts: newAttempts,
    });
  };

  const updateActionInAttempt = (
    attemptIndex: number,
    actionIndex: number,
    field: string,
    value: any
  ) => {
    const newAttempts = [...rules.attempts];
    if (field === "type") {
      newAttempts[attemptIndex].actions[actionIndex] = {
        type: value,
        params: {},
      };
    } else if (field.startsWith("params.")) {
      const paramKey = field.replace("params.", "");
      newAttempts[attemptIndex].actions[actionIndex].params[paramKey] = value;
    }
    setRules({
      ...rules,
      attempts: newAttempts,
    });
  };

  const addFinalAttempt = () => {
    setRules({
      ...rules,
      finalAttempt: {
        delayMinutes: 1440, // 24 hours
        actions: [],
      },
    });
  };

  const removeFinalAttempt = () => {
    setRules({
      ...rules,
      finalAttempt: undefined,
    });
  };

  const addActionToFinalAttempt = () => {
    if (!rules.finalAttempt) return;
    setRules({
      ...rules,
      finalAttempt: {
        ...rules.finalAttempt,
        actions: [
          ...rules.finalAttempt.actions,
          {
            type: "escalate",
            params: {},
          },
        ],
      },
    });
  };

  const removeActionFromFinalAttempt = (actionIndex: number) => {
    if (!rules.finalAttempt) return;
    setRules({
      ...rules,
      finalAttempt: {
        ...rules.finalAttempt,
        actions: rules.finalAttempt.actions.filter((_, i) => i !== actionIndex),
      },
    });
  };

  const updateActionInFinalAttempt = (
    actionIndex: number,
    field: string,
    value: any
  ) => {
    if (!rules.finalAttempt) return;
    const newFinalAttempt = { ...rules.finalAttempt };
    if (field === "type") {
      newFinalAttempt.actions[actionIndex] = {
        type: value,
        params: {},
      };
    } else if (field.startsWith("params.")) {
      const paramKey = field.replace("params.", "");
      newFinalAttempt.actions[actionIndex].params[paramKey] = value;
    }
    setRules({
      ...rules,
      finalAttempt: newFinalAttempt,
    });
  };

  const getActionParamsFields = (actionType: string) => {
    switch (actionType) {
      case "createTask":
        return [
          { key: "title", label: "Task Title", type: "text" },
          { key: "description", label: "Description", type: "textarea" },
          { key: "priority", label: "Priority", type: "select", options: ["low", "medium", "high"] },
          { key: "assignedToId", label: "Assigned To User ID", type: "text" },
        ];
      case "sendEmail":
        return [
          { key: "to", label: "To (Email)", type: "text" },
          { key: "subject", label: "Subject", type: "text" },
          { key: "body", label: "Body", type: "textarea" },
        ];
      case "sendWhatsApp":
        return [
          { key: "to", label: "To (Phone)", type: "text" },
          { key: "message", label: "Message", type: "textarea" },
        ];
      case "updateLeadStatus":
        return [
          { key: "status", label: "Status", type: "select", options: ["new", "contacted", "qualified", "converted", "lost"] },
        ];
      case "assignToUser":
        return [
          { key: "userId", label: "User ID", type: "text" },
        ];
      case "createNotification":
        return [
          { key: "title", label: "Title", type: "text" },
          { key: "message", label: "Message", type: "textarea" },
          { key: "userId", label: "User ID", type: "text" },
        ];
      case "escalate":
        return [
          { key: "escalateToRole", label: "Escalate To Role", type: "text" },
          { key: "message", label: "Message", type: "textarea" },
        ];
      default:
        return [];
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800">
          <CheckCircle2 className="h-5 w-5" />
          <span className="text-sm">{success}</span>
        </div>
      )}

      {/* Attempts Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Attempts</h3>
          <button
            onClick={addAttempt}
            className="px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2 text-sm"
          >
            <Plus className="h-4 w-4" />
            Add Attempt
          </button>
        </div>

        {rules.attempts.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
            No attempts configured. Add an attempt to get started.
          </p>
        ) : (
          <div className="space-y-4">
            {rules.attempts.map((attempt, attemptIndex) => (
              <div
                key={attemptIndex}
                className="border border-gray-200 rounded-lg p-4 bg-white"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-900">
                      Attempt #{attempt.attemptNumber}
                    </span>
                  </div>
                  <button
                    onClick={() => removeAttempt(attemptIndex)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Delay (Minutes)
                    </label>
                    <input
                      type="number"
                      value={attempt.delayMinutes}
                      onChange={(e) =>
                        updateAttempt(attemptIndex, "delayMinutes", parseInt(e.target.value) || 0)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">Actions</label>
                    <button
                      onClick={() => addActionToAttempt(attemptIndex)}
                      className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      Add Action
                    </button>
                  </div>

                  {attempt.actions.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-2 bg-gray-50 rounded">
                      No actions for this attempt
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {attempt.actions.map((action, actionIndex) => (
                        <div
                          key={actionIndex}
                          className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <select
                              value={action.type}
                              onChange={(e) =>
                                updateActionInAttempt(attemptIndex, actionIndex, "type", e.target.value)
                              }
                              className="px-2 py-1 border border-gray-300 rounded text-sm"
                            >
                              {ACTION_TYPES.map((type) => (
                                <option key={type.value} value={type.value}>
                                  {type.label}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => removeActionFromAttempt(attemptIndex, actionIndex)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="space-y-2 mt-2">
                            {getActionParamsFields(action.type).map((field) => (
                              <div key={field.key}>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  {field.label}
                                </label>
                                {field.type === "textarea" ? (
                                  <textarea
                                    value={action.params[field.key] || ""}
                                    onChange={(e) =>
                                      updateActionInAttempt(
                                        attemptIndex,
                                        actionIndex,
                                        `params.${field.key}`,
                                        e.target.value
                                      )
                                    }
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                    rows={2}
                                  />
                                ) : field.type === "select" ? (
                                  <select
                                    value={action.params[field.key] || ""}
                                    onChange={(e) =>
                                      updateActionInAttempt(
                                        attemptIndex,
                                        actionIndex,
                                        `params.${field.key}`,
                                        e.target.value
                                      )
                                    }
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                  >
                                    <option value="">Select...</option>
                                    {field.options?.map((opt) => (
                                      <option key={opt} value={opt}>
                                        {opt}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type={field.type}
                                    value={action.params[field.key] || ""}
                                    onChange={(e) =>
                                      updateActionInAttempt(
                                        attemptIndex,
                                        actionIndex,
                                        `params.${field.key}`,
                                        e.target.value
                                      )
                                    }
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Final Attempt Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Final Attempt (Escalation)</h3>
          {!rules.finalAttempt ? (
            <button
              onClick={addFinalAttempt}
              className="px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2 text-sm"
            >
              <Plus className="h-4 w-4" />
              Add Final Attempt
            </button>
          ) : (
            <button
              onClick={removeFinalAttempt}
              className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 text-sm"
            >
              <Trash2 className="h-4 w-4" />
              Remove Final Attempt
            </button>
          )}
        </div>

        {rules.finalAttempt ? (
          <div className="border border-orange-200 rounded-lg p-4 bg-orange-50">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delay (Minutes)
                </label>
                <input
                  type="number"
                  value={rules.finalAttempt.delayMinutes}
                  onChange={(e) =>
                    setRules({
                      ...rules,
                      finalAttempt: {
                        ...rules.finalAttempt!,
                        delayMinutes: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  min="0"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Actions</label>
                <button
                  onClick={addActionToFinalAttempt}
                  className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Add Action
                </button>
              </div>

              {rules.finalAttempt.actions.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-2 bg-white rounded">
                  No actions for final attempt
                </p>
              ) : (
                <div className="space-y-2">
                  {rules.finalAttempt.actions.map((action, actionIndex) => (
                    <div
                      key={actionIndex}
                      className="p-3 bg-white rounded-lg border border-orange-200"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <select
                          value={action.type}
                          onChange={(e) =>
                            updateActionInFinalAttempt(actionIndex, "type", e.target.value)
                          }
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          {ACTION_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => removeActionFromFinalAttempt(actionIndex)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="space-y-2 mt-2">
                        {getActionParamsFields(action.type).map((field) => (
                          <div key={field.key}>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              {field.label}
                            </label>
                            {field.type === "textarea" ? (
                              <textarea
                                value={action.params[field.key] || ""}
                                onChange={(e) =>
                                  updateActionInFinalAttempt(
                                    actionIndex,
                                    `params.${field.key}`,
                                    e.target.value
                                  )
                                }
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                rows={2}
                              />
                            ) : field.type === "select" ? (
                              <select
                                value={action.params[field.key] || ""}
                                onChange={(e) =>
                                  updateActionInFinalAttempt(
                                    actionIndex,
                                    `params.${field.key}`,
                                    e.target.value
                                  )
                                }
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              >
                                <option value="">Select...</option>
                                {field.options?.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type={field.type}
                                value={action.params[field.key] || ""}
                                onChange={(e) =>
                                  updateActionInFinalAttempt(
                                    actionIndex,
                                    `params.${field.key}`,
                                    e.target.value
                                  )
                                }
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
            No final attempt configured. Final attempt runs after all regular attempts fail.
          </p>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={validateAndSave}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          Save Action Rules
        </button>
      </div>
    </div>
  );
}
