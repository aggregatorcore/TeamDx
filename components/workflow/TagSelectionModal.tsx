"use client";

import { useState, useEffect } from "react";
import { X, Plus, Tag, Search, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api";

interface Tag {
  id: string;
  name: string;
  color?: string;
  tagValue?: string;
  category?: string;
}

interface TagSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTag: (tag: Tag) => void;
  onCreateTag: (tagData: { name: string; color: string; category: string }) => Promise<Tag>;
  onDeleteTag?: (tagId: string) => Promise<void>;
}

export default function TagSelectionModal({
  isOpen,
  onClose,
  onSelectTag,
  onCreateTag,
  onDeleteTag,
}: TagSelectionModalProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#F59E0B");
  const [creating, setCreating] = useState(false);
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchTags();
    }
  }, [isOpen]);

  const fetchTags = async () => {
    setLoading(true);
    try {
      const response = await apiClient.getActiveTagFlows("call_status");
      const fetchedTags = (response.tagFlows || []).map((tag: any) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color || "#F59E0B",
        tagValue: tag.tagValue,
        category: tag.category,
      }));
      setTags(fetchedTags);
    } catch (error) {
      console.error("Error fetching tags:", error);
      setTags([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      alert("Please enter a tag name");
      return;
    }

    setCreating(true);
    try {
      const newTag = await onCreateTag({
        name: newTagName.trim(),
        color: newTagColor,
        category: "call_status",
      });
      
      // Select the newly created tag
      onSelectTag(newTag);
      setShowCreateForm(false);
      setNewTagName("");
      setNewTagColor("#F59E0B");
    } catch (error: any) {
      console.error("Error creating tag:", error);
      alert(error.message || "Failed to create tag");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTag = async (tagId: string, tagName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent tag selection when clicking delete
    
    if (!onDeleteTag) return;
    
    if (!confirm(`Are you sure you want to delete the tag "${tagName}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingTagId(tagId);
    try {
      await onDeleteTag(tagId);
      // Refresh tags list
      await fetchTags();
    } catch (error: any) {
      console.error("Error deleting tag:", error);
      // Show detailed error message from API
      const errorMessage = error.response?.data?.error || error.message || "Failed to delete tag";
      alert(errorMessage);
    } finally {
      setDeletingTagId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Select or Create Tag</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {!showCreateForm ? (
            <>
              {/* Search Bar */}
              <div className="p-4 border-b border-gray-200">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search tags..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              {/* Tags List */}
              <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="mt-2 text-sm">Loading tags...</p>
                  </div>
                ) : filteredTags.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Tag className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm">
                      {searchQuery ? "No tags found matching your search" : "No tags available"}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {filteredTags.map((tag) => (
                      <div
                        key={tag.id}
                        className="group relative p-3 border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors flex items-center gap-3"
                      >
                        <button
                          onClick={() => {
                            onSelectTag(tag);
                            onClose();
                          }}
                          className="flex-1 flex items-center gap-3 text-left"
                        >
                          <div
                            className="w-4 h-4 rounded-full flex-shrink-0"
                            style={{ backgroundColor: tag.color || "#F59E0B" }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900">{tag.name}</div>
                            {tag.tagValue && (
                              <div className="text-xs text-gray-500">{tag.tagValue}</div>
                            )}
                          </div>
                          <Tag className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        </button>
                        {onDeleteTag && (
                          <button
                            onClick={(e) => handleDeleteTag(tag.id, tag.name, e)}
                            disabled={deletingTagId === tag.id}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100 disabled:opacity-50"
                            title="Delete tag"
                          >
                            {deletingTagId === tag.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Create Tag Button */}
              <div className="p-4 border-t border-gray-200">
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <Plus className="h-5 w-5" />
                  <span>Create New Tag</span>
                </button>
              </div>
            </>
          ) : (
            /* Create Tag Form */
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tag Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="Enter tag name (e.g., No Answer)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newTagColor}
                      onChange={(e) => setNewTagColor(e.target.value)}
                      className="h-10 w-20 border border-gray-300 rounded"
                    />
                    <input
                      type="text"
                      value={newTagColor}
                      onChange={(e) => setNewTagColor(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="#F59E0B"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewTagName("");
                      setNewTagColor("#F59E0B");
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateTag}
                    disabled={creating || !newTagName.trim()}
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creating ? "Creating..." : "Create Tag"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
