"use client";

import { Plus, Trash2, Users, Shield, User, CheckSquare, Bell, ArrowUp } from "lucide-react";

interface FinalActionPanelProps {
  data: any[];
  onUpdate: (data: any[]) => void;
}

const finalActionTypes = [
  { value: "escalate", label: "Escalate", icon: ArrowUp },
  { value: "task", label: "Create Task", icon: CheckSquare },
  { value: "notification", label: "Notification", icon: Bell },
];

export default function FinalActionPanel({
  data,
  onUpdate,
}: FinalActionPanelProps) {
  const actions = data || [];

  const handleAddAction = () => {
    const newAction = {
      type: "escalate",
      target: "teamLeader",
      message: "",
      userId: null,
    };
    onUpdate([...actions, newAction]);
  };

  const handleUpdateAction = (index: number, updates: any) => {
    const updated = [...actions];
    updated[index] = { ...updated[index], ...updates };
    onUpdate(updated);
  };

  const handleRemoveAction = (index: number) => {
    const updated = actions.filter((_: any, i: number) => i !== index);
    onUpdate(updated);
  };

  const getTargetIcon = (target: string) => {
    switch (target) {
      case "teamLeader":
        return <Users className="h-4 w-4" />;
      case "admin":
        return <Shield className="h-4 w-4" />;
      case "specificUser":
        return <User className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4 border-t border-gray-200 pt-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium text-gray-900">Final Actions</h4>
          <p className="text-xs text-gray-500 mt-0.5">
            Actions to take when all retry attempts are exhausted
          </p>
        </div>
        <button
          onClick={handleAddAction}
          className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-1"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>

      {actions.length === 0 ? (
        <div className="p-4 border border-dashed border-gray-300 rounded-lg text-center">
          <p className="text-sm text-gray-500">No final actions configured</p>
          <p className="text-xs text-gray-400 mt-1">
            Click "Add" to configure final actions (Escalation, Task, Notification)
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map((action: any, index: number) => {
            const actionType = finalActionTypes.find(t => t.value === action.type) || finalActionTypes[0];
            const ActionIcon = actionType.icon;
            
            return (
              <div key={index} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ActionIcon className="h-4 w-4 text-primary-600" />
                    <span className="text-sm font-medium text-gray-700">
                      {actionType.label} {index + 1}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveAction(index)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Remove action"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-3">
                  {/* Action Type Selector */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Action Type
                    </label>
                    <select
                      value={action.type || "escalate"}
                      onChange={(e) => {
                        const newType = e.target.value;
                        const baseUpdate: any = { type: newType };
                        // Reset fields when changing type
                        if (newType === "escalate") {
                          baseUpdate.target = action.target || "teamLeader";
                          baseUpdate.userId = action.userId || null;
                        } else if (newType === "task") {
                          baseUpdate.taskTitle = action.taskTitle || "";
                          baseUpdate.taskDescription = action.taskDescription || "";
                          baseUpdate.assignToAgent = action.assignToAgent || false;
                          baseUpdate.assignToSupervisor = action.assignToSupervisor || false;
                          baseUpdate.priority = action.priority || "high";
                        } else if (newType === "notification") {
                          baseUpdate.message = action.message || "";
                        }
                        handleUpdateAction(index, baseUpdate);
                      }}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                    >
                      {finalActionTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Escalate Fields */}
                  {action.type === "escalate" && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Escalate To
                        </label>
                        <select
                          value={action.target || "teamLeader"}
                          onChange={(e) =>
                            handleUpdateAction(index, { target: e.target.value, userId: e.target.value === "specificUser" ? action.userId : null })
                          }
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="teamLeader">Team Leader</option>
                          <option value="admin">Admin</option>
                          <option value="specificUser">Specific User</option>
                        </select>
                      </div>
                      {action.target === "specificUser" && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            User ID
                          </label>
                          <input
                            type="text"
                            value={action.userId || ""}
                            onChange={(e) =>
                              handleUpdateAction(index, { userId: e.target.value })
                            }
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                            placeholder="Enter user ID"
                          />
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Message Template
                        </label>
                        <textarea
                          value={action.message || ""}
                          onChange={(e) =>
                            handleUpdateAction(index, { message: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                          placeholder="Enter escalation message template..."
                          rows={3}
                        />
                      </div>
                    </>
                  )}

                  {/* Task Fields */}
                  {action.type === "task" && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Task Title
                        </label>
                        <input
                          type="text"
                          value={action.taskTitle || ""}
                          onChange={(e) =>
                            handleUpdateAction(index, { taskTitle: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                          placeholder="Enter task title..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Task Description
                        </label>
                        <textarea
                          value={action.taskDescription || ""}
                          onChange={(e) =>
                            handleUpdateAction(index, { taskDescription: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                          placeholder="Enter task description..."
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1 text-xs text-gray-700">
                            <input
                              type="checkbox"
                              checked={action.assignToAgent === true}
                              onChange={(e) =>
                                handleUpdateAction(index, { assignToAgent: e.target.checked })
                              }
                              className="rounded"
                            />
                            Assign to Agent
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1 text-xs text-gray-700">
                            <input
                              type="checkbox"
                              checked={action.assignToSupervisor === true}
                              onChange={(e) =>
                                handleUpdateAction(index, { assignToSupervisor: e.target.checked })
                              }
                              className="rounded"
                            />
                            Assign to Supervisor
                          </label>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Priority
                          </label>
                          <select
                            value={action.priority || "high"}
                            onChange={(e) =>
                              handleUpdateAction(index, { priority: e.target.value })
                            }
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="normal">Normal Priority</option>
                            <option value="high">High Priority</option>
                            <option value="urgent">Urgent</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Notification Fields */}
                  {action.type === "notification" && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Notification Message
                      </label>
                      <textarea
                        value={action.message || ""}
                        onChange={(e) =>
                          handleUpdateAction(index, { message: e.target.value })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                        placeholder="Enter notification message..."
                        rows={3}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
