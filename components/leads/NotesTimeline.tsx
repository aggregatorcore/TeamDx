"use client";

import { useState, useEffect, useMemo } from "react";
import {
  MessageSquare, User, Clock, FileText, Loader2, UserPlus, ArrowRightLeft, ChevronDown, ChevronUp,
  Navigation, Circle, Tag, Settings, Play, Save, PhoneOff, PhoneMissed, Phone, PhoneCall, PhoneIncoming, PhoneOutgoing,
} from "lucide-react";
import { apiClient } from "@/lib/api";

type WorkflowTagStyle = { color?: string; textColor?: string; icon?: string; iconColor?: string };
const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  navigation: Navigation,
  circle: Circle,
  tag: Tag,
  settings: Settings,
  play: Play,
  save: Save,
  phoneoff: PhoneOff,
  wrongnumber: PhoneMissed,
  phone: Phone,
  phonecall: PhoneCall,
  phoneincoming: PhoneIncoming,
  phoneoutgoing: PhoneOutgoing,
};

interface TagApplication {
  id: string;
  tagFlow: {
    id: string;
    name: string;
    color: string;
  };
  note?: string | null;
  callbackAt?: string | null;
  followUpAt?: string | null;
  createdAt: string;
  appliedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode?: string | null;
  } | null;
}

interface LeadActivity {
  id: string;
  activityType: string;
  title: string;
  description?: string | null;
  createdAt: string;
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode?: string | null;
  } | null;
}

type TimelineItem =
  | { type: "lead_created"; id: string; date: string }
  | { type: "activity"; id: string; date: string; activity: LeadActivity }
  | { type: "tag"; id: string; date: string; tagApp: TagApplication }
  | { type: "old_tags_group"; id: string; date: string; tagApps: TagApplication[] };

interface NotesTimelineProps {
  leadId: string;
  refreshKey?: number;
}

export default function NotesTimeline({ leadId, refreshKey }: NotesTimelineProps) {
  const [tagApplications, setTagApplications] = useState<TagApplication[]>([]);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [leadCreatedAt, setLeadCreatedAt] = useState<string | null>(null);
  const [lastShuffleAt, setLastShuffleAt] = useState<string | null>(null);
  const [expandedOldTagsId, setExpandedOldTagsId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workflowTagStyles, setWorkflowTagStyles] = useState<Record<string, WorkflowTagStyle>>({});

  useEffect(() => {
    fetchAll();
  }, [leadId, refreshKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.getActiveWorkflow();
        const w = res?.workflow;
        if (cancelled || !w?.workflowData) {
          setWorkflowTagStyles({});
          return;
        }
        const data = typeof w.workflowData === "string" ? JSON.parse(w.workflowData) : w.workflowData;
        const nodes: Array<{ id: string; data?: { tagId?: string; tagName?: string; label?: string; color?: string; textColor?: string; icon?: string; iconColor?: string } }> = data?.nodes ?? [];
        const map: Record<string, WorkflowTagStyle> = {};
        nodes.forEach((n: any) => {
          const d = n.data || {};
          const tagId = d.tagId;
          const tagName = (d.tagName || d.label || "").toLowerCase().trim();
          const style: WorkflowTagStyle = { color: d.color, textColor: d.textColor, icon: d.icon, iconColor: d.iconColor };
          if (tagId) map[tagId] = style;
          if (tagName) map[`name:${tagName}`] = style;
        });
        if (!cancelled) setWorkflowTagStyles(map);
      } catch {
        if (!cancelled) setWorkflowTagStyles({});
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError(null);
      const [tagsRes, activitiesRes, leadRes] = await Promise.all([
        apiClient.getLeadTags(leadId, { includeInactive: true }),
        apiClient.getLeadActivities(leadId).catch(() => ({ activities: [] })),
        apiClient.getLead(leadId).catch(() => ({ createdAt: null })),
      ]);
      const sorted = (tagsRes.tagApplications || []).sort((a: TagApplication, b: TagApplication) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setTagApplications(sorted);
      setActivities(activitiesRes.activities || []);
      const lead = (leadRes as any)?.lead ?? (leadRes as any);
      setLeadCreatedAt(lead?.createdAt ?? null);
      const shuffleActivity = (activitiesRes.activities || []).find(
        (a: LeadActivity) => a.activityType === "tag_applied" && (a.title?.toLowerCase().includes("shuffle") || a.title?.toLowerCase().includes("transferred"))
      );
      setLastShuffleAt(lead?.lastHandoffAt ?? shuffleActivity?.createdAt ?? null);
    } catch (err: any) {
      console.error("Error fetching timeline:", err);
      setError(err.message || "Failed to fetch notes");
    } finally {
      setLoading(false);
    }
  };

  const timelineItems = useMemo((): TimelineItem[] => {
    const items: TimelineItem[] = [];
    if (leadCreatedAt) {
      items.push({ type: "lead_created", id: "lead-created", date: leadCreatedAt });
    }
    const isShuffleActivity = (a: LeadActivity) =>
      a.activityType === "tag_applied" && (a.title?.toLowerCase().includes("shuffle") || a.title?.toLowerCase().includes("transferred"));
    (activities || []).forEach((a) => {
      const isShuffle = isShuffleActivity(a);
      const isExhausted = a.activityType === "EXHAUSTED";
      const isEscalated = a.activityType === "ESCALATED";
      const isNote = a.activityType === "note";
      if (isShuffle || isExhausted || isEscalated || isNote) {
        items.push({ type: "activity", id: a.id, date: a.createdAt, activity: a });
      }
    });
    // Shuffle boundaries: one dropdown per owner segment (Jiya's tags → shuffle → Kajal's tags → shuffle → …)
    const shuffleActivities = (activities || [])
      .filter(isShuffleActivity)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const shuffleTimes = shuffleActivities.map((a) => new Date(a.createdAt).getTime());

    if (shuffleTimes.length === 0) {
      // No shuffles: single "old" group before lastShuffleAt (legacy), or all as current
      const cutoff = lastShuffleAt ? new Date(lastShuffleAt).getTime() : null;
      const oldTags = cutoff ? tagApplications.filter((t) => new Date(t.createdAt).getTime() < cutoff) : [];
      const currentTags = cutoff ? tagApplications.filter((t) => new Date(t.createdAt).getTime() >= cutoff) : tagApplications;
      if (oldTags.length > 0) {
        const latestOld = oldTags[0];
        items.push({ type: "old_tags_group", id: "old-owner-tags", date: latestOld.createdAt, tagApps: oldTags });
      }
      currentTags.forEach((t) => {
        items.push({ type: "tag", id: t.id, date: t.createdAt, tagApp: t });
      });
    } else {
      // Segment tags by shuffle boundaries: segment[i] = tags between shuffle[i-1] and shuffle[i]
      const segments: TagApplication[][] = [];
      for (let i = 0; i <= shuffleTimes.length; i++) {
        const low = i === 0 ? 0 : shuffleTimes[i - 1];
        const high = i === shuffleTimes.length ? Infinity : shuffleTimes[i];
        const seg = tagApplications.filter((t) => {
          const tms = new Date(t.createdAt).getTime();
          return tms >= low && tms < high;
        });
        segments.push(seg);
      }
      // Last segment = current owner (show as individual tags); earlier segments = one dropdown each
      for (let i = 0; i < segments.length; i++) {
        if (i < segments.length - 1) {
          if (segments[i].length > 0) {
            const latestInSegment = segments[i][0];
            items.push({
              type: "old_tags_group",
              id: `old-tags-segment-${i}-${latestInSegment.createdAt}`,
              date: latestInSegment.createdAt,
              tagApps: segments[i],
            });
          }
        } else {
          segments[i].forEach((t) => {
            items.push({ type: "tag", id: t.id, date: t.createdAt, tagApp: t });
          });
        }
      }
    }
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return items;
  }, [leadCreatedAt, activities, tagApplications, lastShuffleAt]);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const getTagStyle = (tagFlow: { id: string; name: string; color: string; icon?: string } | null | undefined) => {
    if (!tagFlow) return { buttonColor: "#94a3b8", textColor: "#64748b", icon: null as string | null, iconColor: "#64748b" };
    const byId = workflowTagStyles[tagFlow.id];
    const byName = workflowTagStyles[`name:${tagFlow.name?.toLowerCase().trim() || ""}`];
    const w = byId || byName;
    return {
      buttonColor: w?.color || tagFlow.color || "#94a3b8",
      textColor: w?.textColor ?? tagFlow.color ?? "#64748b",
      icon: w?.icon ?? tagFlow.icon ?? null,
      iconColor: w?.iconColor || w?.textColor || tagFlow.color || "#64748b",
    };
  };

  const TagPill = ({ tagFlow }: { tagFlow: { id: string; name: string; color: string; icon?: string } | null | undefined }) => {
    const { buttonColor, textColor, icon: styleIcon, iconColor } = getTagStyle(tagFlow);
    const iconKey = (styleIcon || (tagFlow as { icon?: string })?.icon || "").toLowerCase();
    const IconComponent = iconKey ? ICON_MAP[iconKey] : null;
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded"
        style={{
          backgroundColor: buttonColor,
          color: textColor,
          border: `1px solid ${buttonColor}`,
        }}
      >
        {IconComponent && <IconComponent className="h-3 w-3 flex-shrink-0" style={{ color: iconColor }} />}
        {tagFlow?.name ?? "Tag"}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          <span className="ml-2 text-sm text-gray-500">Loading notes...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="text-center py-8 text-red-600">
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-700">Notes & Timeline</h3>
        </div>
        <span className="text-xs text-gray-500">
          {timelineItems.length} {timelineItems.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {timelineItems.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No notes or tags yet</p>
          <p className="text-gray-400 text-xs mt-1">Notes will appear here when tags are applied</p>
        </div>
      ) : (
        <div className="space-y-0 max-h-[500px] overflow-y-auto">
          {timelineItems.map((item) => (
            <div
              key={item.id}
              className="relative pl-6 pb-5 border-l-2 border-gray-200 last:pb-0 ml-1"
            >
              {item.type === "lead_created" && (
                <>
                  <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full border-2 border-white shadow-sm -translate-x-[7px] bg-emerald-500" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-xs font-medium text-emerald-700">Lead created</span>
                    </div>
                    <div className="text-xs text-gray-400">{formatDate(item.date)}</div>
                  </div>
                </>
              )}

              {item.type === "activity" && (
                <>
                  <div
                    className={`absolute left-0 top-1.5 w-3 h-3 rounded-full border-2 border-white shadow-sm -translate-x-[7px] ${
                      item.activity.activityType === "note"
                        ? "bg-slate-500"
                        : item.activity.activityType === "EXHAUSTED"
                          ? "bg-purple-500"
                          : item.activity.activityType === "ESCALATED"
                            ? "bg-red-500"
                            : "bg-amber-500"
                    }`}
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {item.activity.activityType === "note" ? (
                        <MessageSquare className="h-3.5 w-3.5 text-slate-600" />
                      ) : (
                        <ArrowRightLeft className="h-3.5 w-3.5 text-amber-600" />
                      )}
                      <span className="text-xs font-medium text-gray-800">
                        {item.activity.activityType === "note"
                          ? "Note"
                          : item.activity.title?.includes("shuffle") || item.activity.title?.toLowerCase().includes("transferred")
                            ? "Lead transferred (shuffle)"
                            : item.activity.activityType === "EXHAUSTED"
                              ? "Pool exhausted"
                              : item.activity.activityType === "ESCALATED"
                                ? "Escalated"
                                : item.activity.title}
                      </span>
                    </div>
                    {item.activity.description && (
                      <p className={`text-xs ${item.activity.activityType === "note" ? "text-gray-700 bg-gray-50 p-2 rounded border border-gray-100 whitespace-pre-wrap" : "text-gray-500"}`}>
                        {item.activity.description}
                      </p>
                    )}
                    <div className="text-xs text-gray-400">{formatDate(item.activity.createdAt)}</div>
                    {item.activity.createdBy && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {item.activity.createdBy.firstName} {item.activity.createdBy.lastName}
                      </span>
                    )}
                  </div>
                </>
              )}

              {item.type === "old_tags_group" && (
                <>
                  <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full border-2 border-white shadow-sm -translate-x-[7px] bg-gray-400" />
                  <div className="space-y-1">
                    {(() => {
                      const firstBy = item.tagApps[0]?.appliedBy;
                      const sameOwner = firstBy && item.tagApps.every((t) => t.appliedBy?.id === firstBy.id);
                      const label = sameOwner
                        ? `${firstBy.firstName} ${firstBy.lastName}'s tags (${item.tagApps.length})`
                        : `Previous owner's tags (${item.tagApps.length})`;
                      return (
                        <button
                          type="button"
                          onClick={() => setExpandedOldTagsId(expandedOldTagsId === item.id ? null : item.id)}
                          className="flex items-center gap-2 w-full text-left text-xs font-medium text-gray-700 hover:text-gray-900"
                        >
                          {expandedOldTagsId === item.id ? (
                            <ChevronUp className="h-4 w-4 flex-shrink-0" />
                          ) : (
                            <ChevronDown className="h-4 w-4 flex-shrink-0" />
                          )}
                          <span>{label}</span>
                        </button>
                      );
                    })()}
                    {expandedOldTagsId === item.id && (
                      <div className="mt-2 pl-2 space-y-3 border-l border-gray-200">
                        {item.tagApps.map((tagApp) => (
                          <div key={tagApp.id} className="space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <TagPill tagFlow={tagApp.tagFlow} />
                              {tagApp.appliedBy && (
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                  <User className="h-3 w-3 flex-shrink-0" />
                                  {tagApp.appliedBy.firstName} {tagApp.appliedBy.lastName}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400">Applied at {formatDate(tagApp.createdAt)}</div>
                            {tagApp.callbackAt && (
                              <div className="text-xs text-orange-600 font-medium">Callback: {formatDate(tagApp.callbackAt)}</div>
                            )}
                            {tagApp.note && (
                              <div className="p-2 mt-1 bg-gray-50 rounded border border-gray-100">
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">{tagApp.note}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {item.type === "tag" && (
                <>
                  <div
                    className="absolute left-0 top-1.5 w-3 h-3 rounded-full border-2 border-white shadow-sm -translate-x-[7px]"
                    style={{ backgroundColor: getTagStyle(item.tagApp.tagFlow).buttonColor }}
                  />
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <TagPill tagFlow={item.tagApp.tagFlow} />
                      {item.tagApp.appliedBy && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <User className="h-3 w-3 flex-shrink-0" />
                          {item.tagApp.appliedBy.firstName} {item.tagApp.appliedBy.lastName}
                          {item.tagApp.appliedBy.employeeCode && (
                            <span className="text-gray-400">({item.tagApp.appliedBy.employeeCode})</span>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">Applied at {formatDate(item.tagApp.createdAt)}</div>
                    {item.tagApp.callbackAt && (
                      <div className="text-xs text-orange-600 font-medium">Callback: {formatDate(item.tagApp.callbackAt)}</div>
                    )}
                    {item.tagApp.followUpAt && !item.tagApp.callbackAt && (
                      <div className="text-xs text-blue-600">Follow-up: {formatDate(item.tagApp.followUpAt)}</div>
                    )}
                    {item.tagApp.note && (
                      <div className="p-2.5 mt-1 bg-gray-50 rounded-lg border border-gray-100">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.tagApp.note}</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
