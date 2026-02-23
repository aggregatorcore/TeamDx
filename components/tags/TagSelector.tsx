"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, ChevronDown, ChevronRight, Tag as TagIcon } from "lucide-react";
import { apiClient } from "@/lib/api";
import TagBadge from "./TagBadge";
import TagApplicationModal from "./TagApplicationModal";
import TagHistory from "./TagHistory";

interface TagFlow {
  id: string;
  name: string;
  color: string;
  icon?: string;
  category?: string;
  isExclusive?: boolean;
  requiresNote?: boolean;
  requiresCallback?: boolean;
  requiresFollowUp?: boolean;
  parentId?: string | null;
  children?: TagFlow[];
  actions?: string | null; // JSON string of action rules
}

interface TagSelectorProps {
  entityType: "lead" | "call" | "task";
  entityId: string;
  currentTags?: Array<{
    id: string;
    tagId: string;
    tag: TagFlow;
    appliedAt: string;
  }>;
  onTagApplied?: () => void;
  onTagRemoved?: () => void;
  category?: string;
  appliesTo?: string;
}

export default function TagSelector({
  entityType,
  entityId,
  currentTags = [],
  onTagApplied,
  onTagRemoved,
  category = "call_status",
  appliesTo,
}: TagSelectorProps) {
  const [availableTags, setAvailableTags] = useState<TagFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [selectedTag, setSelectedTag] = useState<TagFlow | null>(null);

  useEffect(() => {
    fetchTags();
  }, [category, appliesTo]);

  const fetchTags = async () => {
    setLoading(true);
    try {
      const response = await apiClient.getTagFlows();
      let tags = response.tagFlows || [];

      // Filter by category
      if (category && category !== "all") {
        tags = tags.filter((t: TagFlow) => t.category === category);
      }

      // Filter by appliesTo
      if (appliesTo) {
        tags = tags.filter(
          (t: TagFlow) => t.appliesTo === appliesTo || t.appliesTo === "all"
        );
      }

      // Filter only active tags
      tags = tags.filter((t: TagFlow) => t.isActive !== false);

      // Build hierarchy
      const tagMap = new Map<string, TagFlow>();
      const rootTags: TagFlow[] = [];

      tags.forEach((tag: TagFlow) => {
        tagMap.set(tag.id, { ...tag, children: [] });
      });

      tags.forEach((tag: TagFlow) => {
        const tagWithChildren = tagMap.get(tag.id)!;
        if (!tag.parentId) {
          rootTags.push(tagWithChildren);
        } else {
          const parent = tagMap.get(tag.parentId);
          if (parent) {
            if (!parent.children) parent.children = [];
            parent.children.push(tagWithChildren);
          } else {
            rootTags.push(tagWithChildren);
          }
        }
      });

      setAvailableTags(rootTags);
    } catch (err) {
      console.error("Error fetching tags:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTagClick = (tag: TagFlow) => {
    setSelectedTag(tag);
    setShowModal(true);
  };

  const handleTagRemove = async (tagApplicationId: string) => {
    try {
      if (entityType === "lead") {
        await apiClient.removeTagFromLead(entityId, tagApplicationId);
      } else if (entityType === "call") {
        await apiClient.removeTagFromCall(entityId, tagApplicationId);
      }
      if (onTagRemoved) onTagRemoved();
    } catch (err) {
      console.error("Error removing tag:", err);
    }
  };

  const handleTagApplied = () => {
    if (onTagApplied) onTagApplied();
    fetchTags(); // Refresh to get updated tags
  };

  const toggleExpand = (tagId: string) => {
    const newExpanded = new Set(expandedTags);
    if (newExpanded.has(tagId)) {
      newExpanded.delete(tagId);
    } else {
      newExpanded.add(tagId);
    }
    setExpandedTags(newExpanded);
  };

  const renderTag = (tag: TagFlow, level: number = 0) => {
    const hasChildren = tag.children && tag.children.length > 0;
    const isExpanded = expandedTags.has(tag.id);
    const isApplied = currentTags.some((ct) => ct.tagId === tag.id);
    const isParent = level === 0;
    const indent = level * 24;

    // Check if any child is applied (for exclusive tags)
    const hasAppliedChild = tag.children?.some((child) =>
      currentTags.some((ct) => ct.tagId === child.id)
    );

    return (
      <div key={tag.id} className={isParent ? "mb-3" : "mb-1"}>
        <div
          className={`flex items-center gap-2 rounded-lg transition-all ${isParent
              ? "p-3 bg-gray-50 border border-gray-200 hover:bg-gray-100 hover:border-gray-300"
              : "p-2 hover:bg-gray-50"
            }`}
          style={{ marginLeft: `${indent}px` }}
        >
          {/* Expand/Collapse Button */}
          {hasChildren && (
            <button
              type="button"
              onClick={() => toggleExpand(tag.id)}
              className={`flex-shrink-0 ${isParent
                  ? "text-gray-600 hover:text-gray-800"
                  : "text-gray-400 hover:text-gray-600"
                }`}
              aria-label={isExpanded ? `Collapse ${tag.name}` : `Expand ${tag.name}`}
              aria-expanded={isExpanded}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          )}
          {!hasChildren && <div className="w-4 flex-shrink-0" />}


          {/* Tag Color Indicator */}
          <div
            className={`flex-shrink-0 rounded ${isParent ? "w-5 h-5 ring-2 ring-offset-1" : "w-4 h-4"
              }`}
            style={{
              backgroundColor: tag.color,
              ringColor: tag.color,
            }}
          />

          {/* Tag Name */}
          <span
            className={`flex-1 ${isParent
                ? "text-base font-semibold text-gray-900"
                : "text-sm text-gray-700"
              }`}
          >
            {tag.name}
            {isParent && hasChildren && (
              <span className="ml-2 text-xs font-normal text-gray-500">
                ({tag.children?.length} {tag.children?.length === 1 ? "option" : "options"})
              </span>
            )}
          </span>

          {/* Applied Badge or Apply Button */}
          {isApplied && (() => {
            const appliedTag = currentTags.find((ct) => ct.tagId === tag.id);
            if (!appliedTag) return null;
            return (
              <TagBadge
                tag={tag}
                size="sm"
                showRemove
                onRemove={() => handleTagRemove(appliedTag.id)}
              />
            );
          })()}

          {!isApplied && !hasAppliedChild && (
            <button
              onClick={() => handleTagClick(tag)}
              className={`flex-shrink-0 flex items-center gap-1 rounded transition-colors ${isParent
                  ? "px-3 py-1.5 text-sm bg-primary-600 text-white hover:bg-primary-700 font-medium"
                  : "px-2 py-1 text-xs bg-primary-100 text-primary-700 hover:bg-primary-200"
                }`}
            >
              <Plus className={isParent ? "h-4 w-4" : "h-3 w-3"} />
              Apply
            </button>
          )}
        </div>

        {/* Children Container */}
        {hasChildren && isExpanded && (
          <div className="mt-1 ml-6 border-l-2 border-gray-200 pl-3">
            {tag.children!.map((child) => renderTag(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-2 text-sm">Loading tags...</p>
      </div>
    );
  }

  return (
    <>
      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        <div className="flex items-center gap-2 mb-3">
          <TagIcon className="h-5 w-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Tags</h3>
          {currentTags.length > 0 && (
            <span className="text-xs text-gray-500">
              ({currentTags.length} applied)
            </span>
          )}
        </div>

        {currentTags.length > 0 && (
          <div className="mb-4 pb-4 border-b border-gray-200">
            <div className="flex flex-wrap gap-2">
              {currentTags.map((ct) => (
                <TagBadge
                  key={ct.id}
                  tag={ct.tag}
                  size="sm"
                  showRemove
                  onRemove={() => handleTagRemove(ct.id)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="max-h-96 overflow-y-auto">
          {availableTags.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              No tags available
            </p>
          ) : (
            <div className="space-y-1">
              {availableTags.map((tag) => renderTag(tag, 0))}
            </div>
          )}
        </div>
      </div>

      {selectedTag && (
        <TagApplicationModal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setSelectedTag(null);
          }}
          tag={selectedTag}
          entityType={entityType}
          entityId={entityId}
          onSuccess={handleTagApplied}
        />
      )}

      {/* Tag History */}
      <div className="mt-4">
        <TagHistory entityType={entityType} entityId={entityId} />
      </div>
    </>
  );
}
