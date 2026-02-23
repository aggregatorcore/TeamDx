"use client";

import { useState } from "react";
import { ChevronRight, Plus, Edit, Trash2, GripVertical } from "lucide-react";

interface SubButton {
  id: string;
  label: string;
  color: string;
  order: number;
  enabled: boolean;
}

interface WorkflowSubButtonsConfigProps {
  subButtons: SubButton[];
  onUpdate: (subButtons: SubButton[]) => void;
}

const DEFAULT_SUB_BUTTONS: SubButton[] = [
  {
    id: "connected",
    label: "Connected",
    color: "#10b981",
    order: 1,
    enabled: true,
  },
  {
    id: "not_connected",
    label: "Not Connected",
    color: "#ef4444",
    order: 2,
    enabled: true,
  },
];

export default function WorkflowSubButtonsConfig({ subButtons, onUpdate }: WorkflowSubButtonsConfigProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<SubButton | null>(null);

  const handleAdd = () => {
    const newButton: SubButton = {
      id: `sub_button_${Date.now()}`,
      label: "New Button",
      color: "#3b82f6",
      order: subButtons.length + 1,
      enabled: true,
    };
    onUpdate([...subButtons, newButton]);
    setEditingId(newButton.id);
    setEditForm(newButton);
  };

  const handleEdit = (button: SubButton) => {
    setEditingId(button.id);
    setEditForm({ ...button });
  };

  const handleSave = () => {
    if (!editForm) return;
    const updated = subButtons.map(btn => 
      btn.id === editForm.id ? editForm : btn
    );
    onUpdate(updated);
    setEditingId(null);
    setEditForm(null);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this sub button? This will remove it from the workflow.")) return;
    onUpdate(subButtons.filter(btn => btn.id !== id));
  };

  const handleToggle = (id: string) => {
    const updated = subButtons.map(btn =>
      btn.id === id ? { ...btn, enabled: !btn.enabled } : btn
    );
    onUpdate(updated);
  };

  const handleReorder = (id: string, direction: "up" | "down") => {
    const index = subButtons.findIndex(btn => btn.id === id);
    if (index === -1) return;
    
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= subButtons.length) return;

    const updated = [...subButtons];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    updated[index].order = index + 1;
    updated[newIndex].order = newIndex + 1;
    onUpdate(updated);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ChevronRight className="h-6 w-6 text-primary-600" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Sub Buttons (Flow Direction)</h2>
            <p className="text-sm text-gray-500">Configure Connected / Not Connected flow buttons</p>
          </div>
        </div>
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2 text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          Add Button
        </button>
      </div>

      <div className="space-y-4">
        {subButtons.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
            <p className="text-gray-500 mb-4">No sub buttons configured</p>
            <button
              onClick={() => onUpdate(DEFAULT_SUB_BUTTONS)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
            >
              Use Default Buttons
            </button>
          </div>
        ) : (
          subButtons
            .sort((a, b) => a.order - b.order)
            .map((button) => (
              <div
                key={button.id}
                className={`p-4 border-2 rounded-lg ${
                  editingId === button.id
                    ? "border-primary-500 bg-primary-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                {editingId === button.id ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Label
                      </label>
                      <input
                        type="text"
                        value={editForm?.label || ""}
                        onChange={(e) => setEditForm({ ...editForm!, label: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Button label"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Color
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={editForm?.color || "#3b82f6"}
                          onChange={(e) => setEditForm({ ...editForm!, color: e.target.value })}
                          className="w-16 h-10 border border-gray-300 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={editForm?.color || ""}
                          onChange={(e) => setEditForm({ ...editForm!, color: e.target.value })}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
                          placeholder="#3b82f6"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditForm(null);
                        }}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => handleReorder(button.id, "up")}
                          className="text-gray-400 hover:text-gray-600"
                          disabled={button.order === 1}
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => handleReorder(button.id, "down")}
                          className="text-gray-400 hover:text-gray-600"
                          disabled={button.order === subButtons.length}
                        >
                          ↓
                        </button>
                      </div>
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: button.color }}
                      />
                      <div>
                        <div className="font-semibold text-gray-900">{button.label}</div>
                        <div className="text-xs text-gray-500">Order: {button.order}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={button.enabled}
                          onChange={() => handleToggle(button.id)}
                          className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-700">Enabled</span>
                      </label>
                      <button
                        onClick={() => handleEdit(button)}
                        className="p-2 text-gray-400 hover:text-primary-600"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(button.id)}
                        className="p-2 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
        )}
      </div>
    </div>
  );
}
