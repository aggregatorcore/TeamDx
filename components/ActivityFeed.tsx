"use client";

import { User, FileText, Edit, Trash2, Tag, ArrowRight, Clock } from "lucide-react";
import Link from "next/link";

interface ActivityItem {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    employeeCode: string | null;
  } | null;
  description: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
}

interface ActivityFeedProps {
  events: ActivityItem[];
  showEntityLinks?: boolean;
  onEventClick?: (event: ActivityItem) => void;
  compact?: boolean;
}

// Helper function to format time (fallback if date-fns not available)
function formatTimeAgo(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min${Math.floor(diffInSeconds / 60) > 1 ? 's' : ''} ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hour${Math.floor(diffInSeconds / 3600) > 1 ? 's' : ''} ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} day${Math.floor(diffInSeconds / 86400) > 1 ? 's' : ''} ago`;
    return `${Math.floor(diffInSeconds / 604800)} week${Math.floor(diffInSeconds / 604800) > 1 ? 's' : ''} ago`;
  } catch {
    return "Unknown time";
  }
}

function formatActivityMessage(event: ActivityItem): string {
  if (event.description) {
    return event.description;
  }
  
  const userName = event.user
    ? `${event.user.firstName} ${event.user.lastName}${event.user.employeeCode ? ` (${event.user.employeeCode})` : ''}`
    : 'Unknown User';
  
  const entityName = `#${event.entityId.slice(0, 8)}`;
  
  switch (event.action) {
    case 'CREATE':
      return `${userName} created ${event.entityType} ${entityName}`;
    case 'UPDATE':
      return `${userName} updated ${event.entityType} ${entityName}`;
    case 'DELETE':
      return `${userName} deleted ${event.entityType} ${entityName}`;
    case 'ASSIGN':
      return `${userName} assigned ${event.entityType} ${entityName}`;
    case 'STATUS_CHANGE':
      return `${userName} changed status of ${event.entityType} ${entityName}`;
    case 'TAG_APPLIED':
      return `${userName} applied tag to ${event.entityType} ${entityName}`;
    default:
      return `${userName} performed ${event.action} on ${event.entityType} ${entityName}`;
  }
}

function getEntityLink(entityType: string, entityId: string): string {
  const routes: Record<string, string> = {
    'LEAD': `/dashboard/leads/${entityId}`,
    'CLIENT': `/dashboard/clients/${entityId}`,
    'APPLICATION': `/dashboard/applications/${entityId}`,
    'TASK': `/dashboard/tasks/${entityId}`,
    'USER': `/admin/users/${entityId}`,
  };
  return routes[entityType] || '#';
}

function getActionIcon(action: string) {
  switch (action) {
    case 'CREATE':
      return <FileText className="h-4 w-4 text-green-600" />;
    case 'UPDATE':
      return <Edit className="h-4 w-4 text-blue-600" />;
    case 'DELETE':
      return <Trash2 className="h-4 w-4 text-red-600" />;
    case 'ASSIGN':
      return <ArrowRight className="h-4 w-4 text-purple-600" />;
    case 'STATUS_CHANGE':
      return <Clock className="h-4 w-4 text-orange-600" />;
    case 'TAG_APPLIED':
      return <Tag className="h-4 w-4 text-indigo-600" />;
    default:
      return <User className="h-4 w-4 text-gray-600" />;
  }
}

export default function ActivityFeed({ 
  events, 
  showEntityLinks = true,
  onEventClick,
  compact = false
}: ActivityFeedProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No activities found</p>
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      {events.map((event) => {
        const timeAgo = formatTimeAgo(event.createdAt);

        return (
          <div
            key={event.id}
            className={`flex items-start gap-3 ${compact ? 'p-2' : 'p-3'} rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors`}
          >
            <div className="mt-1 flex-shrink-0">
              {getActionIcon(event.action)}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-gray-900 ${compact ? 'text-xs' : 'text-sm'}`}>
                {formatActivityMessage(event)}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-gray-500 ${compact ? 'text-xs' : 'text-xs'}`}>
                  {timeAgo}
                </span>
                {showEntityLinks && (
                  <Link
                    href={getEntityLink(event.entityType, event.entityId)}
                    className={`text-blue-600 hover:underline ${compact ? 'text-xs' : 'text-xs'}`}
                    onClick={() => onEventClick?.(event)}
                  >
                    View {event.entityType}
                  </Link>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

