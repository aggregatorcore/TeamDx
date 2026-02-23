"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";

interface ChildButtonPropertiesProps {
  data: any;
  onUpdate: (data: any) => void;
  tagFlows?: Array<{ id: string; name: string; tagValue?: string; category?: string }>;
}

export default function ChildButtonProperties({
  data,
  onUpdate,
  tagFlows = [],
}: ChildButtonPropertiesProps) {
  // Local state for input fields to ensure proper editing
  const [label, setLabel] = useState(data?.label || "");
  const [color, setColor] = useState(data?.color || "#F59E0B");
  const [order, setOrder] = useState(data?.order || 0);
  const [tagName, setTagName] = useState(data?.tagName || "");
  const [tagId, setTagId] = useState(data?.tagId || "");
  const [availableTags, setAvailableTags] = useState<Array<{ id: string; name: string; tagValue?: string }>>([]);

  // Fetch available tags from call_status category
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await apiClient.getActiveTagFlows("call_status");
        const tags = (response.tagFlows || []).map((tag: any) => ({
          id: tag.id,
          name: tag.name,
          tagValue: tag.tagValue,
        }));
        setAvailableTags(tags);
      } catch (error) {
        console.error("Error fetching tags:", error);
        // Fallback to tagFlows prop if API fails
        if (tagFlows.length > 0) {
          setAvailableTags(tagFlows.map(tag => ({
            id: tag.id,
            name: tag.name,
            tagValue: tag.tagValue,
          })));
        }
      }
    };
    fetchTags();
  }, [tagFlows]);

  // Update local state when data prop changes
  useEffect(() => {
    setLabel(data?.label || "");
    setColor(data?.color || "#F59E0B");
    setOrder(data?.order || 0);
    setTagName(data?.tagName || "");
    setTagId(data?.tagId || "");
  }, [data]);

  // Handle label change
  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newLabel = e.target.value;
    setLabel(newLabel);
    onUpdate({ label: newLabel, color, order, tagName, tagId });
  };

  // Handle tag selection
  const handleTagChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedTagId = e.target.value;
    const selectedTag = availableTags.find(t => t.id === selectedTagId);
    if (selectedTag) {
      setTagId(selectedTag.id);
      setTagName(selectedTag.name);
      onUpdate({ label, color, order, tagId: selectedTag.id, tagName: selectedTag.name });
    }
  };

  // Handle color change
  const handleColorChange = (newColor: string) => {
    setColor(newColor);
    onUpdate({ label, color: newColor, order, tagName, tagId });
  };

  // Handle order change
  const handleOrderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newOrder = parseInt(e.target.value) || 0;
    setOrder(newOrder);
    onUpdate({ label, color, order: newOrder, tagName, tagId });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Label
        </label>
        <input
          type="text"
          value={label}
          onChange={handleLabelChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
          placeholder="Enter label"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Color
        </label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={color}
            onChange={(e) => handleColorChange(e.target.value)}
            className="h-10 w-20 border border-gray-300 rounded"
          />
          <input
            type="text"
            value={color}
            onChange={(e) => handleColorChange(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
            placeholder="#F59E0B"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Order
        </label>
        <input
          type="number"
          value={order}
          onChange={handleOrderChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
          min="0"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tag <span className="text-red-500">*</span>
        </label>
        {tagId && tagName ? (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: availableTags.find(t => t.id === tagId)?.tagValue ? "#F59E0B" : "#F59E0B" }}
              />
              <span className="text-sm font-medium text-gray-900">{tagName}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Tag is linked. To change, delete this button and add a new one from sidebar.
            </p>
          </div>
        ) : (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-700">
              ⚠️ No tag linked. Delete this button and add a new Tag Button from sidebar to select a tag.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
