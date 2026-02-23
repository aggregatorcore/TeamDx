"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { 
  ArrowLeft, Edit, Phone, Mail, User, Clock, Check,
  CheckCircle2, X, Star, Tag, MessageSquare, Calendar, Save, FileText,
  PhoneCall, Activity, Paperclip, TrendingUp, Building,
  Navigation, Circle, Settings, Play, PhoneOff, PhoneMissed, PhoneIncoming, PhoneOutgoing
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { tabStorage } from "@/lib/storage";
import ActivityFeed from "@/components/ActivityFeed";
import { getSocketClient, AuditEvent } from "@/lib/socket";
import CallButton from "@/components/CallButton";
import CallTaggingModal from "@/components/CallTaggingModal";
import LoadingButton from "@/components/LoadingButton";
import AgentTagNavigation from "@/components/AgentTagNavigation";
import TagHistory from "@/components/tags/TagHistory";
import LeadCardTagInfo from "@/components/leads/LeadCardTagInfo";
import NotesTimeline from "@/components/leads/NotesTimeline";

interface Lead {
  id: string;
  leadId?: number | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country?: string;
  visaType?: string;
  source?: string;
  status: "new" | "contacted" | "qualified" | "converted" | "lost";
  priority?: "low" | "medium" | "high" | "urgent";
  score?: number;
  notes?: string;
  assignedTo?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode?: string | null;
  };
  assignedAt?: string;
  lastHandoffAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function LeadProfilePage() {
  const router = useRouter();
  const params = useParams();
  const leadId = params.id as string;
  
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "calls" | "documents">("overview");
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activityEvents, setActivityEvents] = useState<any[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [showTaggingModal, setShowTaggingModal] = useState(false);
  const [callData, setCallData] = useState<any>(null);
  const [callStatus, setCallStatus] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [showManualTagButton, setShowManualTagButton] = useState(false);
  const [wrapupTimeStarted, setWrapupTimeStarted] = useState(false);
  const wrapupStartTimeRef = useRef<number | null>(null);
  const wrapupTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [updatingLead, setUpdatingLead] = useState(false);
  const [tagRefreshKey, setTagRefreshKey] = useState(0);
  const [notesRefreshKey, setNotesRefreshKey] = useState(0);
  const [currentTag, setCurrentTag] = useState<any>(null);
  const [tagApplications, setTagApplications] = useState<any[]>([]);
  const [workflowTagStyle, setWorkflowTagStyle] = useState<{ color?: string; textColor?: string; icon?: string; iconColor?: string } | null>(null);
  const [callbackFocusPending, setCallbackFocusPending] = useState<number>(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [leadTransferredAway, setLeadTransferredAway] = useState(false);
  const [shuffleInProgress, setShuffleInProgress] = useState(false);
  const [shuffleStep, setShuffleStep] = useState(0);
  const [shuffleNewOwnerName, setShuffleNewOwnerName] = useState<string | null>(null);
  const [headerNote, setHeaderNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [showWrongNumberAnimation, setShowWrongNumberAnimation] = useState(false);
  const [wrongNumberStep, setWrongNumberStep] = useState(0); // 0=idle, 1-6=steps, 7=final

  // Sync header notepad from lead.notes
  useEffect(() => {
    if (lead) setHeaderNote(lead.notes ?? "");
  }, [lead?.id, lead?.notes]);

  // Current user id for "lead transferred away" check
  useEffect(() => {
    try {
      const userStr = tabStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user?.id) setCurrentUserId(user.id);
      }
    } catch (_) {}
  }, []);

  // When lead or current user is known, detect if lead was transferred away from current user
  useEffect(() => {
    const uid = currentUserId || (() => {
      try {
        const u = tabStorage.getItem("user");
        return u ? JSON.parse(u).id : null;
      } catch { return null; }
    })();
    if (lead?.assignedTo?.id && uid && lead.assignedTo.id !== uid) {
      setLeadTransferredAway(true);
    } else if (lead) {
      setLeadTransferredAway(false);
    }
  }, [lead?.id, lead?.assignedTo?.id, currentUserId]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("callbackFocus");
      if (raw) {
        const data = JSON.parse(raw);
        if (data.leadId === leadId && typeof data.pendingCount === "number" && data.pendingCount > 0) {
          setCallbackFocusPending(data.pendingCount);
        }
      }
    } catch (_) {}
  }, [leadId]);

  // Wrong Number: step animation then redirect to leads
  useEffect(() => {
    if (!showWrongNumberAnimation) return;
    if (wrongNumberStep >= 7) {
      const t = setTimeout(() => {
        setShowWrongNumberAnimation(false);
        setWrongNumberStep(0);
        router.replace("/leads");
      }, 1500);
      return () => clearTimeout(t);
    }
    const isDoneStep = wrongNumberStep % 2 === 0 && wrongNumberStep >= 2;
    const delay = isDoneStep ? 500 : 700;
    const t = setTimeout(() => setWrongNumberStep((s) => s + 1), delay);
    return () => clearTimeout(t);
  }, [showWrongNumberAnimation, wrongNumberStep, router]);

  // Resolve tag color/icon from active workflow so pill matches workflow engine
  useEffect(() => {
    if (!currentTag?.tagFlowId && !currentTag?.tagFlow?.name) {
      setWorkflowTagStyle(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.getActiveWorkflow();
        const w = res?.workflow;
        if (cancelled || !w?.workflowData) {
          setWorkflowTagStyle(null);
          return;
        }
        const data = typeof w.workflowData === "string" ? JSON.parse(w.workflowData) : w.workflowData;
        const nodes: Array<{ id: string; data?: { tagId?: string; tagName?: string; label?: string; color?: string; textColor?: string; icon?: string; iconColor?: string } }> = data?.nodes ?? [];
        const tagFlowId = currentTag.tagFlowId || currentTag.tagFlow?.id;
        const tagName = (currentTag.tagFlow?.name || "").toLowerCase();
        const node = nodes.find((n: any) => {
          const d = n.data || {};
          if (tagFlowId && d.tagId === tagFlowId) return true;
          const label = (d.tagName || d.label || "").toLowerCase();
          return label === tagName || label.replace(/\s+/g, " ") === tagName.replace(/\s+/g, " ");
        });
        if (cancelled) return;
        if (node?.data) {
          setWorkflowTagStyle({
            color: node.data.color,
            textColor: node.data.textColor,
            icon: node.data.icon,
            iconColor: node.data.iconColor,
          });
        } else {
          setWorkflowTagStyle(null);
        }
      } catch {
        if (!cancelled) setWorkflowTagStyle(null);
      }
    })();
    return () => { cancelled = true; };
  }, [currentTag?.tagFlowId, currentTag?.tagFlow?.id, currentTag?.tagFlow?.name]);

  useEffect(() => {
    setupActivityWebSocket();
    Promise.all([fetchLead(), fetchLeadActivities()]);
    const fromNotification = sessionStorage.getItem(`lead_${leadId}_assigned`);
    if (fromNotification === "true") {
      startWrapupTime();
      sessionStorage.removeItem(`lead_${leadId}_assigned`);
    }
    return () => {
      if (wrapupTimerRef.current) clearInterval(wrapupTimerRef.current);
    };
  }, [leadId]);


  const startWrapupTime = () => {
    if (wrapupTimeStarted) return; // Already started
    
    // Clear any existing timer
    if (wrapupTimerRef.current) {
      clearInterval(wrapupTimerRef.current);
    }
    
    // Start wrapup time tracking
    setWrapupTimeStarted(true);
    wrapupStartTimeRef.current = Date.now();
    
    console.log("⏱️ Wrapup time started for lead:", leadId);
    
    // Optional: Send to backend to track wrapup time
    // You can add API call here if needed
  };


  // Manual fallback timeout (2 minutes)
  useEffect(() => {
    if (requestId && callStatus === "initiated") {
      const timeout = setTimeout(() => {
        if (callStatus !== "ended") {
          setShowManualTagButton(true);
          setCallData({
            requestId,
            phoneNumber: lead?.phone,
            leadId: lead?.id
          });
        }
      }, 2 * 60 * 1000); // 2 minutes

      return () => clearTimeout(timeout);
    }
  }, [requestId, callStatus, lead]);

  const setupActivityWebSocket = () => {
    const socketClient = getSocketClient();
    
    socketClient.connect(
      () => {
        console.log("[Lead Detail] WebSocket connected for activities");
      },
      () => {
        console.log("[Lead Detail] WebSocket disconnected");
      },
      (error) => {
        console.error("[Lead Detail] WebSocket error:", error);
      },
      () => {}, // dx:event handler
      (auditEvent: AuditEvent) => {
        // Only add events for this specific lead
        if (auditEvent.data.entityType === "LEAD" && auditEvent.data.entityId === leadId) {
          const newEvent = {
            id: auditEvent.data.id,
            entityType: auditEvent.data.entityType,
            entityId: auditEvent.data.entityId,
            action: auditEvent.data.action,
            userId: auditEvent.data.userId,
            user: auditEvent.data.user,
            description: auditEvent.data.description,
            metadata: auditEvent.data.metadata,
            createdAt: auditEvent.data.createdAt,
          };
          setActivityEvents(prev => [newEvent, ...prev]);
        }
      },
      // call:intentOpened handler
      (data: any) => {
        if (data.leadId === leadId || requestId === data.requestId) {
          setCallStatus("intentOpened");
          console.log("[Lead Detail] Call intent opened:", data);
        }
      },
      // call:ended handler
      (data: any) => {
        if (data.leadId === leadId || requestId === data.requestId) {
          setCallStatus("ended");
          setCallData({
            callId: data.callId,
            requestId: data.requestId,
            phoneNumber: data.phoneNumber,
            leadId: data.leadId,
            duration: data.duration,
            wasConnected: data.wasConnected
          });
          setShowTaggingModal(true); // Auto-open modal
          setShowManualTagButton(false); // Hide manual button
          console.log("[Lead Detail] Call ended:", data);
        }
      }
    );
  };

  const fetchLeadActivities = async () => {
    try {
      setActivitiesLoading(true);
      const response = await apiClient.getAuditEvents({
        entityType: "LEAD",
        entityId: leadId,
        limit: 50,
      });
      setActivityEvents(response.events || []);
    } catch (error) {
      console.error("Failed to fetch lead activities:", error);
    } finally {
      setActivitiesLoading(false);
    }
  };

  const fetchLead = async () => {
    try {
      setLoading(true);
      setError(null);
      // Sirf is lead ko fetch karo (poora list nahi) — open hote hi fast
      const [leadRes, tagsResponse] = await Promise.all([
        apiClient.getLead(leadId),
        apiClient.getLeadTags(leadId).catch(() => ({ tagApplications: [] })),
      ]);
      const foundLead = leadRes?.lead ?? leadRes;
      if (foundLead) {
        setLead(foundLead);
        const tags = tagsResponse?.tagApplications ?? [];
        setTagApplications(tags);
        // Current tag = most recent active (API returns createdAt desc, so tags[0] is latest)
        const activeTag = tags.length > 0 ? tags[0] : null;
        setCurrentTag(activeTag);
      } else {
        setError("Lead not found");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to fetch lead");
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleCallback = async (id: string) => {
    try {
      await apiClient.scheduleCallbackForLead(id);
    } catch (err: any) {
      console.error("Schedule callback failed:", err);
      alert(err?.message || "Failed to schedule callback.");
    } finally {
      // Always refetch tags: GET /api/leads/:id/tags runs auto-heal (ensureNoAnswerCallbackScheduled), so callbackAt may appear even if schedule-callback returned 400
      const tagsResponse = await apiClient.getLeadTags(id);
      const tags = tagsResponse.tagApplications || [];
      setTagApplications(tags);
      const activeTag = tags.length > 0 ? tags[0] : null;
      setCurrentTag(activeTag);
    }
  };

  const handleTagApplied = async (result?: { shuffled?: boolean; newOwnerName?: string; message?: string; appliedTagValue?: string }) => {
    if (result?.shuffled) {
      setShuffleNewOwnerName(result.newOwnerName || null);
      setShuffleInProgress(true);
      setShuffleStep(0);
      const steps = [1, 2, 3, 4];
      for (let i = 0; i < steps.length; i++) {
        setShuffleStep(steps[i]);
        await new Promise((r) => setTimeout(r, 800));
      }
      router.replace("/leads");
      return;
    }
    if (result?.appliedTagValue === "wrong_number") {
      setShowWrongNumberAnimation(true);
      setWrongNumberStep(1);
      return;
    }
    await fetchLead();
    await fetchLeadActivities();
    // Explicitly refetch tags so CURRENT TAG updates to the newly applied tag
    try {
      const tagsResponse = await apiClient.getLeadTags(leadId);
      const tags = tagsResponse?.tagApplications ?? [];
      setTagApplications(tags);
      setCurrentTag(tags.length > 0 ? tags[0] : null);
    } catch (_) {}
    setTagRefreshKey(prev => prev + 1);
    setNotesRefreshKey(prev => prev + 1);
  };


  const handleEditLead = () => {
    setEditingLead(lead);
    setShowEditModal(true);
  };

  const handleUpdateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLead) return;

    try {
      setUpdatingLead(true);
      setError(null);
      
      await apiClient.updateLead(editingLead.id, {
        firstName: editingLead.firstName,
        lastName: editingLead.lastName,
        email: editingLead.email,
        country: editingLead.country,
        visaType: editingLead.visaType,
        source: editingLead.source,
        status: editingLead.status,
        priority: editingLead.priority,
        score: editingLead.score,
        notes: editingLead.notes,
      });

      setSuccess("✅ Lead updated successfully!");
      setTimeout(() => setSuccess(null), 3000);
      setShowEditModal(false);
      setEditingLead(null);
      await fetchLead();
    } catch (err: any) {
      setError(err.message || "Failed to update lead");
    } finally {
      setUpdatingLead(false);
    }
  };

  const handleSaveHeaderNote = async () => {
    if (!lead || savingNote) return;
    setSavingNote(true);
    setError(null);
    try {
      await apiClient.updateLead(lead.id, { notes: headerNote });
      setLead((prev) => (prev ? { ...prev, notes: headerNote } : null));
      setNotesRefreshKey((k) => k + 1);
      setSuccess("Note saved");
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: any) {
      setError(err?.message || "Failed to save note");
    } finally {
      setSavingNote(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600">Lead not found</p>
        <button onClick={() => router.back()} className="mt-4 text-primary-600 hover:underline">
          Go Back
        </button>
      </div>
    );
  }

  // Full-screen: Wrong Number applied — processing steps then lead closed & moved to Exhaust, then redirect
  if (showWrongNumberAnimation) {
    const steps = [
      { label: "Validating…", done: false },
      { label: "Validating", done: true },
      { label: "Closing lead…", done: false },
      { label: "Closing lead", done: true },
      { label: "Moving to Exhaust…", done: false },
      { label: "Moving to Exhaust", done: true },
      { label: "Lead closed and moved to Exhaust", final: true },
    ];
    const idx = Math.min(Math.max(0, wrongNumberStep - 1), steps.length - 1);
    const current = steps[idx];
    return (
      <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-gray-900/95 backdrop-blur-sm text-white p-6">
        <div className="w-full max-w-md space-y-8 text-center">
          {!current.final && (
            <div className="h-16 w-16 mx-auto rounded-full border-4 border-red-400 border-t-white animate-spin" />
          )}
          {current.final && (
            <div className="h-16 w-16 mx-auto rounded-full bg-red-500/20 border-2 border-red-400 flex items-center justify-center">
              <Check className="h-8 w-8 text-red-400" />
            </div>
          )}
          <div className="space-y-2">
            <p className="text-xl font-semibold">{current.label}</p>
            {current.done && (
              <p className="text-sm text-green-400 flex items-center justify-center gap-1">
                <Check className="h-4 w-4" /> Done
              </p>
            )}
          </div>
          {current.final && (
            <p className="text-sm text-gray-400">This lead is hidden from your list. Opening leads page…</p>
          )}
        </div>
      </div>
    );
  }

  // Full-screen: Lead shuffle in progress (old cycle remove, transfer to next agent)
  if (shuffleInProgress) {
    const stepLabels = [
      "Lead shuffle in progress…",
      "Removing old cycle…",
      "Transferring to next agent…",
      "Redirecting to leads list…",
    ];
    return (
      <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-gray-900/95 backdrop-blur-sm text-white p-6">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="h-16 w-16 mx-auto rounded-full border-4 border-primary-400 border-t-white animate-spin" />
          <div className="space-y-2">
            <p className="text-xl font-semibold">{stepLabels[shuffleStep - 1] || stepLabels[0]}</p>
            {shuffleNewOwnerName && shuffleStep >= 3 && (
              <p className="text-sm text-gray-300">Lead assigned to {shuffleNewOwnerName}</p>
            )}
          </div>
          <p className="text-sm text-gray-400">This lead will appear as new for the next agent.</p>
        </div>
      </div>
    );
  }

  // Lead was transferred to another agent — don’t show lead content, show message and redirect
  if (leadTransferredAway) {
    return (
      <div className="w-full min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-200 p-8 text-center space-y-4">
          <div className="h-14 w-14 mx-auto rounded-full bg-amber-100 flex items-center justify-center">
            <User className="h-7 w-7 text-amber-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Lead transferred</h2>
          <p className="text-gray-600">
            This lead has been reassigned to another agent and is no longer in your list.
          </p>
          <button
            onClick={() => router.replace("/leads")}
            className="w-full mt-4 px-4 py-3 rounded-xl font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors"
          >
            Back to Leads
          </button>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: "bg-white/25 text-white border-white/40",
      contacted: "bg-amber-400/30 text-amber-100 border-amber-300/50",
      qualified: "bg-violet-400/30 text-violet-100 border-violet-300/50",
      converted: "bg-emerald-400/30 text-emerald-100 border-emerald-300/50",
      lost: "bg-red-400/30 text-red-100 border-red-300/50",
    };
    return colors[status?.toLowerCase()] || colors.new;
  };

  const getPriorityIcon = (priority?: string) => {
    if (priority === "urgent") return "🔴";
    if (priority === "high") return "🟠";
    if (priority === "medium") return "🟡";
    return "🟢";
  };

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="font-medium">Back to Leads</span>
          </button>
          
          <button
            onClick={handleEditLead}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 flex items-center gap-2 shadow-lg hover:shadow-xl transition-all"
          >
            <Edit className="h-5 w-5" />
            Edit Profile
          </button>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800">
            <CheckCircle2 className="h-5 w-5" />
            {success}
          </div>
        )}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
            <X className="h-5 w-5" />
            {error}
          </div>
        )}

        {/* D) Detail page: slim bar when user opened from popup and other callbacks are waiting */}
        {callbackFocusPending > 0 && (
          <div className="mb-4 flex items-center gap-2 px-4 py-2 bg-amber-100 border border-amber-300 rounded-lg text-amber-900 text-sm">
            <Clock className="h-4 w-4 flex-shrink-0" />
            <span>{callbackFocusPending} callback{callbackFocusPending !== 1 ? "s" : ""} waiting</span>
            <button
              type="button"
              onClick={() => {
                try {
                  sessionStorage.removeItem("callbackFocus");
                } catch (_) {}
                setCallbackFocusPending(0);
                router.push("/dashboard/leads");
              }}
              className="font-medium underline hover:no-underline ml-1"
            >
              View list
            </button>
          </div>
        )}

        {/* Lead Profile Header Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
          {/* Gradient hero: name + meta + status */}
          <div className="bg-gradient-to-r from-primary-600 via-primary-500 to-indigo-600 px-6 py-5 text-white">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="h-14 w-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/30 flex-shrink-0">
                  <User className="h-7 w-7 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl md:text-2xl font-bold truncate tracking-tight">
                    {lead.firstName} {lead.lastName}
                  </h1>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-sm text-white/90">
                    {lead.leadId != null && lead.leadId !== undefined && (
                      <span className="text-primary-100 font-medium">#{lead.leadId}</span>
                    )}
                    {lead.priority && (
                      <span>{getPriorityIcon(lead.priority)} {lead.priority}</span>
                    )}
                    {lead.score !== undefined && <span>{lead.score}%</span>}
                    {lead.source && <span className="text-white/80">{lead.source}</span>}
                  </div>
                </div>
              </div>
              <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold border shrink-0 ${getStatusColor(lead.status)}`}>
                {lead.status.toUpperCase()}
              </span>
            </div>
          </div>
          {/* Actions: Call, WhatsApp, Mail */}
          <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-gray-100">
            <CallButton
              phoneNumber={lead.phone}
              leadId={lead.id}
              compact
              onCallInitiated={(reqId) => {
                setRequestId(reqId);
                setCallStatus("initiated");
              }}
              onCallStatusChange={setCallStatus}
            />
            <a
              href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[40px] bg-[#25D366] text-white rounded-lg hover:bg-[#20BD5A] transition-colors"
            >
              <MessageSquare className="h-4 w-4" />
              WhatsApp
            </a>
            <a
              href={`mailto:${lead.email || ""}`}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[40px] bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 border border-gray-200 transition-colors"
            >
              <Mail className="h-4 w-4" />
              Mail
            </a>
          </div>
          {/* Note strip */}
          <div className="px-6 py-4">
            <div className="flex items-start justify-between gap-3">
              <label className="text-sm font-medium text-gray-700 shrink-0 pt-2">Note</label>
              <div className="min-w-0 flex-1">
                <textarea
                  value={headerNote}
                  onChange={(e) => setHeaderNote(e.target.value)}
                  onBlur={handleSaveHeaderNote}
                  placeholder="Add a note..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50/50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-y min-h-[56px] text-sm"
                />
                <div className="mt-1.5 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveHeaderNote}
                    disabled={savingNote}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-primary-700 bg-primary-50 border border-primary-200 hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {savingNote ? (
                      <>
                        <span className="h-3.5 w-3.5 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5" />
                        Save note
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex-1 px-6 py-4 font-medium transition-colors ${
                activeTab === "overview"
                  ? "text-primary-600 border-b-2 border-primary-600 bg-primary-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <Activity className="h-5 w-5 inline mr-2" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab("calls")}
              className={`flex-1 px-6 py-4 font-medium transition-colors ${
                activeTab === "calls"
                  ? "text-primary-600 border-b-2 border-primary-600 bg-primary-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <PhoneCall className="h-5 w-5 inline mr-2" />
              Calls
            </button>
            <button
              onClick={() => setActiveTab("documents")}
              className={`flex-1 px-6 py-4 font-medium transition-colors ${
                activeTab === "documents"
                  ? "text-primary-600 border-b-2 border-primary-600 bg-primary-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <FileText className="h-5 w-5 inline mr-2" />
              Documents
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Info - Left Side */}
            <div className="lg:col-span-2 space-y-6">
              {/* Lead & Immigration (merged) */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="h-5 w-5 text-primary-600" />
                  Lead & immigration
                </h3>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Full name</p>
                    <p className="text-base font-semibold text-gray-900">{lead.firstName} {lead.lastName}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Lead ID</p>
                    <p className="text-base font-semibold text-primary-600">#{lead.leadId || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Email</p>
                    <p className="text-base font-medium text-gray-900">{lead.email}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Phone</p>
                    <p className="text-base font-medium text-gray-900 tabular-nums">{lead.phone} <span className="text-gray-400">🔒</span></p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Country</p>
                    <p className="text-base font-semibold text-gray-900">{lead.country || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Visa type</p>
                    <p className="text-base font-semibold text-gray-900">{lead.visaType || "—"}</p>
                  </div>
                </div>
                <div className="mt-5 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={handleEditLead}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-colors"
                  >
                    <Edit className="h-4 w-4" />
                    Update profile
                  </button>
                </div>
              </div>

              {/* Notes Timeline */}
              <NotesTimeline leadId={leadId} refreshKey={notesRefreshKey} />

            </div>

            {/* Sidebar - Right Side */}
            <div className="space-y-6">
              {/* Current Tag (No Answer, callback, etc.) — top of sidebar */}
              {currentTag && !(lead?.lastHandoffAt && tagApplications[0]?.createdAt && new Date(tagApplications[0].createdAt) < new Date(lead.lastHandoffAt)) && (() => {
                const buttonColor = workflowTagStyle?.color || currentTag.tagFlow?.color || "#94a3b8";
                const textColor = workflowTagStyle?.textColor ?? (currentTag.tagFlow?.color || "#64748b");
                const iconColor = workflowTagStyle?.iconColor || workflowTagStyle?.textColor || buttonColor;
                const iconMap: Record<string, (props: { className?: string; style?: React.CSSProperties }) => JSX.Element> = {
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
                const iconKey = (workflowTagStyle?.icon || currentTag.tagFlow?.icon || "").toLowerCase();
                const WorkflowIcon = iconKey ? iconMap[iconKey] : null;
                return (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">
                      Current tag
                    </h3>
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded"
                        style={{
                          backgroundColor: buttonColor,
                          color: textColor,
                          border: `1px solid ${buttonColor}`,
                        }}
                      >
                        {WorkflowIcon && <WorkflowIcon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: iconColor }} />}
                        {currentTag.tagFlow?.name ?? "Tag"}
                      </span>
                    </div>
                    <LeadCardTagInfo
                      currentTag={currentTag}
                      tagHistory={
                        lead?.lastHandoffAt
                          ? tagApplications.filter((ta: any) => new Date(ta.createdAt) > new Date(lead.lastHandoffAt))
                          : tagApplications
                      }
                      tagKey={currentTag.tagFlow?.tagValue || "no_answer"}
                      leadId={leadId}
                      onScheduleCallback={handleScheduleCallback}
                    />
                  </div>
                );
              })()}

              {/* Assignment Info — below Current Tag */}
              {lead.assignedTo && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">
                    Assignment
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-primary-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {lead.assignedTo.firstName} {lead.assignedTo.lastName}
                        </p>
                        {lead.assignedTo.employeeCode && (
                          <p className="text-xs text-primary-600 font-medium">
                            {lead.assignedTo.employeeCode}
                          </p>
                        )}
                      </div>
                    </div>
                    {lead.assignedAt && (
                      <div className="pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500">Assigned on</p>
                        <p className="text-sm font-medium text-gray-900">
                          {new Date(lead.assignedAt).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {activeTab === "calls" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Call History</h3>
            <div className="text-center py-12">
              <PhoneCall className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No call history available</p>
              <p className="text-sm text-gray-400 mt-1">Call records will appear here</p>
            </div>
          </div>
        )}

        {activeTab === "documents" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Documents</h3>
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No documents uploaded</p>
              <p className="text-sm text-gray-400 mt-1">Documents will appear here</p>
            </div>
          </div>
        )}

        {/* Call Tagging Modal */}
        {showTaggingModal && callData && (
          <CallTaggingModal
            isOpen={showTaggingModal}
            onClose={() => {
              setShowTaggingModal(false);
              setCallData(null);
              setCallStatus(null);
              setRequestId(null);
            }}
            callData={callData}
            onTagged={() => {
              // Refresh lead data
              fetchLead();
              setShowTaggingModal(false);
              setCallData(null);
              setCallStatus(null);
              setRequestId(null);
              setShowManualTagButton(false);
            }}
          />
        )}

        {/* Agent Tag Navigation - Floating Button (Workflow Engine Managed) */}
        <AgentTagNavigation
          entityType="lead"
          entityId={leadId}
          onTagApplied={handleTagApplied}
        />

        {/* Edit Lead Modal - Same as before */}
        {showEditModal && editingLead && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Edit Lead Details
                </h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleUpdateLead} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                    <input
                      type="text"
                      value={editingLead.firstName}
                      onChange={(e) => setEditingLead({ ...editingLead, firstName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                    <input
                      type="text"
                      value={editingLead.lastName}
                      onChange={(e) => setEditingLead({ ...editingLead, lastName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input
                      type="email"
                      value={editingLead.email}
                      onChange={(e) => setEditingLead({ ...editingLead, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone * (Read-only)</label>
                    <input
                      type="tel"
                      value={editingLead.phone}
                      readOnly
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                    />
                    <p className="mt-1 text-xs text-gray-500">🔒 Phone locked (Admin only)</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country (Target)</label>
                    <input
                      type="text"
                      value={editingLead.country || ""}
                      onChange={(e) => setEditingLead({ ...editingLead, country: e.target.value })}
                      placeholder="e.g., USA, Canada, UK"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Visa Type</label>
                    <input
                      type="text"
                      value={editingLead.visaType || ""}
                      onChange={(e) => setEditingLead({ ...editingLead, visaType: e.target.value })}
                      placeholder="e.g., Student, Work, PR"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    disabled={updatingLead}
                    className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <LoadingButton
                    type="submit"
                    loading={updatingLead}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Update Lead
                  </LoadingButton>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

