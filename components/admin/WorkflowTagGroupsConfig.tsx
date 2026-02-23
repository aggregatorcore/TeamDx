"use client";

import { useState } from "react";
import { Tag, Plus, Edit, Trash2, CheckCircle2 } from "lucide-react";

interface TagGroup {
  id: string;
  name: string;
  color: string;
}

interface TagGroups {
  connected: TagGroup[];
  notConnected: TagGroup[];
}

interface WorkflowTagGroupsConfigProps {
  tagGroups: TagGroups;
  onUpdate: (tagGroups: TagGroups) => void;
}

const DEFAULT_CONNECTED_TAGS: TagGroup[] = [
  { id: "interested", name: "Interested", color: "#10b981" },
  { id: "discussion", name: "Discussion", color: "#3b82f6" },
  { id: "processing", name: "Processing", color: "#8b5cf6" },
  { id: "not_interested", name: "Not Interested", color: "#ef4444" },
];

const DEFAULT_NOT_CONNECTED_TAGS: TagGroup[] = [
  { id: "no_answer", name: "No Answer", color: "#f59e0b" },
  { id: "busy", name: "Busy", color: "#f97316" },
  { id: "switch_off", name: "Switch Off", color: "#6b7280" },
  { id: "invalid", name: "Invalid", color: "#dc2626" },
];

export default function WorkflowTagGroupsConfig({ tagGroups, onUpdate }: WorkflowTagGroupsConfigProps) {
  const [editingTag, setEditingTag] = useState<{ category: "connected" | "notConnected"; tag: TagGroup } | null>(null);
  const [editForm, setEditForm] = useState<TagGroup | null>(null);

  const handleAdd = (category: "connected" | "notConnected") => {
    const newTag: TagGroup = {
      id: `tag_${Date.now()}`,
      name: "New Tag",
      color: "#3b82f6",
    };
    const updated = {
      ...tagGroups,
      [category]: [...tagGroups[category], newTag],
    };
    onUpdate(updated);
    setEditingTag({ category, tag: newTag });
    setEditForm(newTag);
  };

  const handleEdit = (category: "connected" | "notConnected", tag: TagGroup) => {
    setEditingTag({ category, tag });
    setEditForm({ ...tag });
  };

  const handleSave = () => {
    if (!editingTag || !editForm) return;
    const updated = {
      ...tagGroups,
      [editingTag.category]: tagGroups[editingTag.category].map(t =>
        t.id === editForm.id ? editForm : t
      ),
    };
    onUpdate(updated);
    setEditingTag(null);
    setEditForm(null);
  };

  const handleDelete = (category: "connected" | "notConnected", id: string) => {
    if (!confirm("Delete this tag? This will remove it from the workflow.")) return;
    const updated = {
      ...tagGroups,
      [category]: tagGroups[category].filter(t => t.id !== id),
    };
    onUpdate(updated);
  };

  const handleUseDefaults = (category: "connected" | "notConnected") => {
    const defaults = category === "connected" ? DEFAULT_CONNECTED_TAGS : DEFAULT_NOT_CONNECTED_TAGS;
    const updated = {
      ...tagGroups,
      [category]: defaults,
    };
    onUpdate(updated);
  };

  const renderTagList = (category: "connected" | "notConnected", tags: TagGroup[]) => {
    return (
      <div className="space-y-3">
        {tags.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
            <p className="text-gray-500 mb-3">No tags configured</p>
            <button
              onClick={() => handleUseDefaults(category)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
            >
              Use Default Tags
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {tags.map((tag) => {
              const isEditing = editingTag?.category === category && editingTag?.tag.id === tag.id;
              return (
                <div
                  key={tag.id}
                  className={`p-4 border-2 rounded-lg ${
                    isEditing
                      ? "border-primary-500 bg-primary-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Name
                        </label>
                        <input
                          type="text"
                          value={editForm?.name || ""}
                          onChange={(e) => setEditForm({ ...editForm!, name: e.target.value })}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Color
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={editForm?.color || "#3b82f6"}
                            onChange={(e) => setEditForm({ ...editForm!, color: e.target.value })}
                            className="w-12 h-8 border border-gray-300 rounded cursor-pointer"
                          />
                          <input
                            type="text"
                            value={editForm?.color || ""}
                            onChange={(e) => setEditForm({ ...editForm!, color: e.target.value })}
                            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-primary-500 focus:border-primary-500 font-mono"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleSave}
                          className="flex-1 px-2 py-1 bg-primary-600 text-white rounded text-xs font-medium hover:bg-primary-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingTag(null);
                            setEditForm(null);
                          }}
                          className="flex-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div
                        className="w-8 h-8 rounded-full mx-auto mb-2"
                        style={{ backgroundColor: tag.color }}
                      />
                      <div className="text-sm font-medium text-gray-900 mb-1">{tag.name}</div>
                      <div className="flex items-center justify-center gap-2 mt-2">
                        <button
                          onClick={() => handleEdit(category, tag)}
                          className="p-1 text-gray-400 hover:text-primary-600"
                          title="Edit"
                        >
                          <Edit className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(category, tag.id)}
                          className="p-1 text-gray-400 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <button
          onClick={() => handleAdd(category)}
          className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary-500 hover:text-primary-600 flex items-center justify-center gap-2 text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          Add Tag
        </button>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <Tag className="h-6 w-6 text-primary-600" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Tag Groups (Final Decisions)</h2>
          <p className="text-sm text-gray-500">Configure tags for Connected and Not Connected flows</p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Connected Tags */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Connected Tags</h3>
            <span className="text-xs text-gray-500">
              {tagGroups.connected.length} tag{tagGroups.connected.length !== 1 ? "s" : ""}
            </span>
          </div>
          {renderTagList("connected", tagGroups.connected)}
        </div>

        {/* Not Connected Tags */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Not Connected Tags</h3>
            <span className="text-xs text-gray-500">
              {tagGroups.notConnected.length} tag{tagGroups.notConnected.length !== 1 ? "s" : ""}
            </span>
          </div>
          {renderTagList("notConnected", tagGroups.notConnected)}
        </div>
      </div>
    </div>
  );
}
