"use client";

import { Tag, X } from "lucide-react";

interface TagBadgeProps {
  tag: {
    id: string;
    name: string;
    color: string;
    icon?: string;
    category?: string;
    isExclusive?: boolean;
  };
  onRemove?: (tagId: string) => void;
  showRemove?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function TagBadge({
  tag,
  onRemove,
  showRemove = false,
  size = "md",
  className = "",
}: TagBadgeProps) {
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium text-white ${sizeClasses[size]} ${className}`}
      style={{ backgroundColor: tag.color }}
    >
      <Tag className={iconSizes[size]} />
      <span>{tag.name}</span>
      {showRemove && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(tag.id);
          }}
          className="ml-0.5 hover:bg-white/20 rounded-full p-0.5 transition-colors"
          title="Remove tag"
        >
          <X className={iconSizes[size]} />
        </button>
      )}
    </span>
  );
}
