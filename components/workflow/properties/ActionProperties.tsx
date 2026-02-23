"use client";

import { useCallback, useMemo, useEffect, useState } from "react";
import { Phone, RotateCw, CheckSquare, Bell, ArrowUp, Info, Clock, Plus, Trash2, GripVertical } from "lucide-react";
import RetryConfigPanel from "./RetryConfigPanel";
import FinalActionPanel from "./FinalActionPanel";

interface ActionPropertiesProps {
  data: any;
  onUpdate: (data: any) => void;
}

const actionTypes = [
  { value: "callback", label: "Callback", icon: Phone, description: "Schedule a callback" },
  { value: "retry", label: "Retry", icon: RotateCw, description: "Retry with delays" },
  { value: "createTask", label: "Create Task", icon: CheckSquare, description: "Create a new task" },
  { value: "notify", label: "Notify", icon: Bell, description: "Send notification" },
  { value: "escalate", label: "Escalate", icon: ArrowUp, description: "Escalate to higher level" },
];

export default function ActionProperties({
  data,
  onUpdate,
}: ActionPropertiesProps) {
  // Support both old format (single actionType) and new format (actions array)
  // For old format, convert to new format with proper config
  const getActions = () => {
    if (data.actions && Array.isArray(data.actions)) {
      // New format: multiple actions
      return data.actions.map(action => ({
        ...action,
        config: action.config || {},
      }));
    } else if (data.actionType) {
      // Old format: single action - convert to new format
      return [{
        actionType: data.actionType,
        config: {
          ...(data.actionType === "callback" ? { dueInMinutes: data.dueInMinutes || 60 } : {}),
          ...(data.taskTitle ? { taskTitle: data.taskTitle } : {}),
          ...(data.taskDescription ? { taskDescription: data.taskDescription } : {}),
          ...(data.notificationMessage ? { notificationMessage: data.notificationMessage } : {}),
          ...(data.retry ? { retry: data.retry } : {}),
          ...(data.finalActions ? { finalActions: data.finalActions } : {}),
          ...data, // Include any other properties
        },
      }];
    } else {
      // Default: single callback action
      return [{ actionType: "callback", config: { dueInMinutes: 60 } }];
    }
  };
  
  const actions = getActions();
  
  const [localActions, setLocalActions] = useState(actions);

  // Sync local state with props
  useEffect(() => {
    const newActions = getActions();
    setLocalActions(newActions);
  }, [data]);

  const handleAddAction = useCallback(() => {
    const newAction = {
      actionType: "callback",
      config: {},
      id: `action-${Date.now()}`,
    };
    const updatedActions = [...localActions, newAction];
    setLocalActions(updatedActions);
    updateActions(updatedActions);
  }, [localActions]);

  const handleRemoveAction = useCallback((index: number) => {
    const updatedActions = localActions.filter((_, i) => i !== index);
    setLocalActions(updatedActions);
    updateActions(updatedActions);
  }, [localActions]);

  const handleUpdateAction = useCallback((index: number, updatedAction: any) => {
    const updatedActions = [...localActions];
    updatedActions[index] = { ...updatedActions[index], ...updatedAction };
    setLocalActions(updatedActions);
    updateActions(updatedActions);
  }, [localActions]);

  const handleUpdateActionConfig = useCallback((index: number, config: any) => {
    const updatedActions = [...localActions];
    updatedActions[index] = {
      ...updatedActions[index],
      config: { ...updatedActions[index].config, ...config },
    };
    setLocalActions(updatedActions);
    updateActions(updatedActions);
  }, [localActions]);

  const updateActions = useCallback((actionsToUpdate: any[]) => {
    // Convert to new format: { actions: [...] }
    // But also support old format for backward compatibility
    if (actionsToUpdate.length === 1) {
      // Single action - use old format for compatibility
      const action = actionsToUpdate[0];
      const newData: any = {
        actionType: action.actionType,
        ...action.config, // Spread config properties to root level for old format
      };
      console.log("[ActionProperties] Updating with old format:", {
        actionType: newData.actionType,
        dueInMinutes: newData.dueInMinutes,
        fullData: newData,
      });
      onUpdate(newData);
    } else {
      // Multiple actions - use new format
      const newData: any = {
        actions: actionsToUpdate.map(({ id, ...rest }) => rest), // Remove temporary id
      };
      console.log("[ActionProperties] Updating with new format:", {
        actionsCount: newData.actions.length,
        fullData: newData,
      });
      onUpdate(newData);
    }
  }, [onUpdate]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-gray-200 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Actions</h3>
          <p className="text-xs text-gray-500">Add multiple actions to execute in sequence</p>
        </div>
        <button
          type="button"
          onClick={handleAddAction}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-md transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Action
        </button>
      </div>

      <div className="space-y-4">
        {localActions.map((action, index) => (
          <ActionItem
            key={action.id || index}
            index={index}
            action={action}
            onUpdate={(updatedAction) => handleUpdateAction(index, updatedAction)}
            onUpdateConfig={(config) => handleUpdateActionConfig(index, config)}
            onRemove={() => handleRemoveAction(index)}
            canRemove={localActions.length > 1}
          />
        ))}
      </div>

      {localActions.length === 0 && (
        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
          <p className="text-sm text-gray-500 mb-3">No actions configured</p>
          <button
            type="button"
            onClick={handleAddAction}
            className="px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-md transition-colors"
          >
            Add First Action
          </button>
        </div>
      )}
    </div>
  );
}

interface ActionItemProps {
  index: number;
  action: any;
  onUpdate: (action: any) => void;
  onUpdateConfig: (config: any) => void;
  onRemove: () => void;
  canRemove: boolean;
}

function ActionItem({ index, action, onUpdate, onUpdateConfig, onRemove, canRemove }: ActionItemProps) {
  const actionType = action.actionType || "callback";
  const selectedAction = actionTypes.find(a => a.value === actionType) || actionTypes[0];
  const config = action.config || {};

  const handleActionTypeChange = useCallback((newType: string) => {
    // Reset config when changing action type
    const newConfig: any = {};
    if (newType === "callback") {
      newConfig.dueInMinutes = 60; // Default 60 minutes
    } else if (newType === "createTask") {
      newConfig.taskTitle = "";
      newConfig.taskDescription = "";
    } else if (newType === "notify") {
      newConfig.notificationMessage = "";
    }
    
    onUpdate({
      actionType: newType,
      config: { ...config, ...newConfig }, // Merge with existing config
    });
  }, [onUpdate, config]);

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-semibold text-sm">
            {index + 1}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Action {index + 1}</h4>
            <p className="text-xs text-gray-500">{selectedAction.description}</p>
          </div>
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
            title="Remove action"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Action Type
          </label>
          <select
            value={actionType}
            onChange={(e) => handleActionTypeChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
          >
            {actionTypes.map((action) => (
              <option key={action.value} value={action.value}>
                {action.label}
              </option>
            ))}
          </select>
          <div className="mt-2 p-2 bg-gray-50 rounded-lg flex items-start gap-2">
            <selectedAction.icon className="h-4 w-4 text-primary-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-gray-700">{selectedAction.label}</p>
              <p className="text-xs text-gray-500">{selectedAction.description}</p>
            </div>
          </div>
        </div>

        {/* Action-specific configuration */}
        {actionType === "callback" && (
          <CallbackActionConfig
            config={config}
            onUpdate={onUpdateConfig}
          />
        )}

        {actionType === "createTask" && (
          <CreateTaskActionConfig
            config={config}
            onUpdate={onUpdateConfig}
          />
        )}

        {actionType === "notify" && (
          <NotifyActionConfig
            config={config}
            onUpdate={onUpdateConfig}
          />
        )}

        {actionType === "retry" && (
          <RetryConfigPanel
            data={config.retry || {}}
            onUpdate={(retryData) => onUpdateConfig({ retry: retryData })}
          />
        )}

        {actionType === "escalate" && (
          <FinalActionPanel
            data={config.finalActions || []}
            onUpdate={(finalActions) => onUpdateConfig({ finalActions })}
          />
        )}
      </div>
    </div>
  );
}

interface CallbackActionConfigProps {
  config: any;
  onUpdate: (config: any) => void;
}

function CallbackActionConfig({ config, onUpdate }: CallbackActionConfigProps) {
  return (
    <div className="space-y-3 border-t border-gray-200 pt-4">
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-blue-900 mb-1">
              Call Back Action
            </h4>
            <p className="text-xs text-blue-800 mb-3">
              Schedule a callback reminder for the lead.
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Callback Delay (minutes)
              </label>
              <input
                type="number"
                value={config.dueInMinutes || 60}
                onChange={(e) => onUpdate({ dueInMinutes: parseInt(e.target.value) || 60 })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                placeholder="60"
                min="1"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CreateTaskActionConfigProps {
  config: any;
  onUpdate: (config: any) => void;
}

function CreateTaskActionConfig({ config, onUpdate }: CreateTaskActionConfigProps) {
  return (
    <div className="space-y-3 border-t border-gray-200 pt-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Task Title
        </label>
        <input
          type="text"
          value={config.taskTitle || ""}
          onChange={(e) => onUpdate({ taskTitle: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
          placeholder="Enter task title"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Task Description
        </label>
        <textarea
          value={config.taskDescription || ""}
          onChange={(e) => onUpdate({ taskDescription: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
          placeholder="Enter task description"
          rows={3}
        />
      </div>
    </div>
  );
}

interface NotifyActionConfigProps {
  config: any;
  onUpdate: (config: any) => void;
}

function NotifyActionConfig({ config, onUpdate }: NotifyActionConfigProps) {
  return (
    <div className="space-y-3 border-t border-gray-200 pt-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Notification Message
        </label>
        <textarea
          value={config.notificationMessage || ""}
          onChange={(e) => onUpdate({ notificationMessage: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
          placeholder="Enter notification message"
          rows={3}
        />
      </div>
    </div>
  );
}
