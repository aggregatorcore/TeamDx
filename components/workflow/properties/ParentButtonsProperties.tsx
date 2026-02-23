"use client";

import { Plus, Trash2 } from "lucide-react";

interface ParentButtonsPropertiesProps {
  data: any;
  onUpdate: (data: any) => void;
}

export default function ParentButtonsProperties({
  data,
  onUpdate,
}: ParentButtonsPropertiesProps) {
  const buttons = data.buttons || [
    { name: "Connected", color: "#10B981", order: 0 },
    { name: "Not Connected", color: "#EF4444", order: 1 },
  ];

  const handleAddButton = () => {
    const newButton = {
      name: `Button ${buttons.length + 1}`,
      color: "#3B82F6",
      order: buttons.length,
    };
    onUpdate({ ...data, buttons: [...buttons, newButton] });
  };

  const handleUpdateButton = (index: number, updates: any) => {
    const updated = [...buttons];
    updated[index] = { ...updated[index], ...updates };
    onUpdate({ ...data, buttons: updated });
  };

  const handleRemoveButton = (index: number) => {
    const updated = buttons.filter((_: any, i: number) => i !== index);
    onUpdate({ ...data, buttons: updated });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-900">Sub Buttons</h4>
        <button
          onClick={handleAddButton}
          className="p-1 text-primary-600 hover:bg-primary-50 rounded"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3">
        {buttons.map((btn: any, index: number) => (
          <div key={index} className="p-3 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Button {index + 1}
              </span>
              {buttons.length > 1 && (
                <button
                  onClick={() => handleRemoveButton(index)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
            <div className="space-y-2">
              <input
                type="text"
                value={btn.name}
                onChange={(e) =>
                  handleUpdateButton(index, { name: e.target.value })
                }
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                placeholder="Button name"
              />
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={btn.color}
                  onChange={(e) =>
                    handleUpdateButton(index, { color: e.target.value })
                  }
                  className="h-8 w-16 border border-gray-300 rounded"
                />
                <span className="text-xs text-gray-500">Color</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
