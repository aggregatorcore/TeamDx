"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Target,
  Search,
  Phone,
  Mail,
  User,
  Calendar,
  Filter,
  X,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Edit,
  UserPlus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Plus,
  Tag,
  Clock,
  CheckSquare,
  Bell,
  ArrowUp,
  RotateCw,
  Zap,
  Sparkles,
  UserCheck,
  AlertTriangle,
  ArrowRightLeft,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { getSocketClient, DxEvent } from "@/lib/socket";
import { tabStorage } from "@/lib/storage";
import { getLeadBucket, getBucketCounts, BUCKET_CONFIG, BucketType } from "@/lib/utils/buckets";
import { isWithinShift } from "@/utils/shiftUtils";
import NewTaskNotification from "@/components/NewTaskNotification";
import LoadingButton from "@/components/LoadingButton";
import CallbackPopupNotification from "@/components/leads/CallbackPopupNotification";
import CallbackReminderNotification from "@/components/leads/CallbackReminderNotification";
import OverdueReminderNotification from "@/components/leads/OverdueReminderNotification";
import LeadCardTagInfo from "@/components/leads/LeadCardTagInfo";
import TagModal from "@/components/leads/TagModal";

interface Lead {
  id: string;
  leadId?: number;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone: string;
  status: "new" | "contacted" | "qualified" | "converted" | "lost";
  assignedTo?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    employeeCode?: string | null;
  } | null;
  createdAt: string;
  activities?: Array<{
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
  }>;
  // Current tag and action info
  currentTag?: {
    id: string;
    tagFlowId: string;
    tagFlow?: {
      id: string;
      name: string;
      color: string;
      icon?: string | null;
      tagKey?: string | null;
    };
    callbackAt?: string | null;
  } | null;
  activeAction?: {
    id: string;
    actionType: string;
    status: string;
    scheduledAt?: string;
    executedAt?: string | null;
  } | null;
  tagApplications?: Array<{
    id: string;
    tagFlowId: string;
    createdAt?: string;
    tagFlow?: {
      id: string;
      tagKey?: string | null;
      name?: string | null;
    } | null;
  }>;
  isExhausted?: boolean;
  exhaustedAt?: string | null;
  shuffleIndex?: number | null;
  lastHandoffAt?: string | null;
  assignedAt?: string | null;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeCode?: string | null;
}

const STATUS_OPTIONS = [
  { value: "", label: "All Status" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "converted", label: "Converted" },
  { value: "lost", label: "Lost" },
];

const STATUS_COLORS = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  contacted: "bg-yellow-50 text-yellow-700 border-yellow-200",
  qualified: "bg-purple-50 text-purple-700 border-purple-200",
  converted: "bg-green-50 text-green-700 border-green-200",
  lost: "bg-red-50 text-red-700 border-red-200",
};

// Callback Countdown Component
function CallbackCountdown({ callbackAt }: { callbackAt: string }) {
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [isOverdue, setIsOverdue] = useState(false);

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const callbackTime = new Date(callbackAt);
      const diff = callbackTime.getTime() - now.getTime();

      if (diff <= 0) {
        setIsOverdue(true);
        const overdueDiff = Math.abs(diff);
        const overdueHours = Math.floor(overdueDiff / (1000 * 60 * 60));
        const overdueMinutes = Math.floor((overdueDiff % (1000 * 60 * 60)) / (1000 * 60));
        setTimeRemaining(`${overdueHours}h ${overdueMinutes}m overdue`);
      } else {
        setIsOverdue(false);
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        if (hours > 0) {
          setTimeRemaining(`${hours}h ${minutes}m`);
        } else if (minutes > 0) {
          setTimeRemaining(`${minutes}m ${seconds}s`);
        } else {
          setTimeRemaining(`${seconds}s`);
        }
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [callbackAt]);

  return (
    <div className={`flex items-center gap-1.5 text-sm ${isOverdue ? 'text-red-600' : 'text-gray-600'}`}>
      <Clock className={`h-4 w-4 ${isOverdue ? 'text-red-500' : 'text-gray-400'}`} />
      <span className={`font-medium ${isOverdue ? 'text-red-600' : ''}`}>
        {isOverdue ? 'Overdue: ' : ''}{timeRemaining}
      </span>
    </div>
  );
}

export default function LeadsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const initialLoadDoneRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [assignedToFilter, setAssignedToFilter] = useState("");
  
  // Initialize bucket filter from URL parameter (for header bucket card clicks)
  const urlBucket = searchParams.get("bucket");
  const [bucketFilter, setBucketFilter] = useState<"all" | BucketType>(
    urlBucket && ["fresh", "green", "orange", "red", "exhaust"].includes(urlBucket)
      ? (urlBucket as BucketType)
      : "all"
  );

  // Update bucket filter when URL changes (header bucket card click)
  useEffect(() => {
    const urlBucket = searchParams.get("bucket");
    if (urlBucket && ["fresh", "green", "orange", "red", "exhaust"].includes(urlBucket)) {
      setBucketFilter(urlBucket as BucketType);
    } else if (!urlBucket) {
      setBucketFilter("all");
    }
  }, [searchParams]);

  // Bucket counts (exhaust only visible for Senior roles)
  const [bucketCounts, setBucketCounts] = useState<Record<BucketType, number>>({
    exhaust: 0,
    fresh: 0,
    green: 0,
    orange: 0,
    red: 0,
  });
  
  // Assignment
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  
  // New task notification
  const [showNotification, setShowNotification] = useState(false);
  const [notificationLead, setNotificationLead] = useState<{ id: string; name: string } | null>(null);
  const [wrapupTimeStarted, setWrapupTimeStarted] = useState(false);
  const wrapupTimerRef = useRef<NodeJS.Timeout | null>(null);
  const wrapupStartTimeRef = useRef<number | null>(null);
  
  // Create Lead modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    country: "",
    visaType: "",
    source: "",
    status: "new" as const,
    notes: "",
    assignedToId: "",
  });
  
  const socketClientRef = useRef<any>(null);
  const [workflowData, setWorkflowData] = useState<any>(null);
  const [selectedLeadForTag, setSelectedLeadForTag] = useState<string | null>(null);
  const [showTagModal, setShowTagModal] = useState(false);
  const [popupLeads, setPopupLeads] = useState<Set<string>>(new Set());
  const [focusLeadId, setFocusLeadId] = useState<string | null>(null);
  const [delayingNextPopup, setDelayingNextPopup] = useState(false);
  const [popupTick, setPopupTick] = useState(0);
  // For TELECALLER: show callback popups only when within shift
  const [telecallerWithinShift, setTelecallerWithinShift] = useState<boolean | null>(null);

  // Re-check popup window every second
  useEffect(() => {
    const id = setInterval(() => setPopupTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // TELECALLER shift gate: update within-shift status every 60s so popups only show in shift
  useEffect(() => {
    if (userRole !== "TELECALLER") {
      setTelecallerWithinShift(null);
      return;
    }
    const check = async () => {
      try {
        const shift = await apiClient.getTelecallerShift();
        const now = new Date();
        setTelecallerWithinShift(isWithinShift(now, shift.shiftStart, shift.shiftEnd));
      } catch {
        setTelecallerWithinShift(false);
      }
    };
    check();
    const id = setInterval(check, 60 * 1000);
    return () => clearInterval(id);
  }, [userRole]);

  // When user returns to leads list, exit focus mode so popups can show again
  useEffect(() => {
    setFocusLeadId(null);
  }, []);

  // A) popupLeads reset: clear at calendar date change so next day/shift popups can show again (avoid memory leak)
  const lastPopupResetDateRef = useRef<string>("");
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (lastPopupResetDateRef.current && lastPopupResetDateRef.current !== today) {
      setPopupLeads(new Set());
    }
    lastPopupResetDateRef.current = today;
  }, [popupTick]);

  // B) Dedupe key: leadId:callbackAt so same lead can re-enter queue on Attempt2/3 (new callbackAt)
  const getPopupDismissKey = (lead: Lead) =>
    `${lead.id}:${lead.currentTag?.callbackAt ?? ""}`;

  // Helper: get tagConfig for a lead's current tag
  const getTagConfigForLead = (lead: Lead) => {
    const tagId = lead.currentTag?.tagFlow?.id;
    if (!workflowData || !tagId) return null;
    if (workflowData.tags) {
      const tag = Object.values(workflowData.tags).find((t: any) =>
        t.id === tagId || t.tagKey === tagId || t.name?.toLowerCase() === lead.currentTag?.tagFlow?.name?.toLowerCase()
      );
      if (tag && tag.tagConfig) return tag.tagConfig;
    }
    if (workflowData.tagGroups) {
      const allTags = [
        ...(workflowData.tagGroups.connected || []),
        ...(workflowData.tagGroups.notConnected || []),
      ];
      const tag = allTags.find((t: any) =>
        t.id === tagId || t.tagKey === tagId || t.name?.toLowerCase() === lead.currentTag?.tagFlow?.name?.toLowerCase()
      );
      if (tag && tag.tagConfig) return tag.tagConfig;
    }
    return null;
  };

  // Popup queue: leads in 30s window. C) Priority: overdue first, then soonest upcoming. Dedupe by leadId:callbackAt.
  // For TELECALLER: only show when within shift (telecallerWithinShift === true).
  const popupDueLeads = useMemo(() => {
    if (userRole === "TELECALLER" && telecallerWithinShift !== true) return [];
    const POPUP_WINDOW_MS = 30 * 1000;
    const now = Date.now();
    return leads
      .filter((l) => {
        if (!l.currentTag?.callbackAt || popupLeads.has(getPopupDismissKey(l))) return false;
        const cb = new Date(l.currentTag.callbackAt).getTime();
        return Math.abs(cb - now) <= POPUP_WINDOW_MS;
      })
      .sort((a, b) => {
        const ca = new Date(a.currentTag!.callbackAt!).getTime();
        const cb = new Date(b.currentTag!.callbackAt!).getTime();
        const aOverdue = ca < now;
        const bOverdue = cb < now;
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;
        return ca - cb;
      });
  }, [leads, popupLeads, popupTick, userRole, telecallerWithinShift]);

  const activePopupLead = !focusLeadId && !delayingNextPopup ? popupDueLeads[0] ?? null : null;

  // Fetch workflow data to get tagConfig
  useEffect(() => {
    const fetchWorkflow = async () => {
      try {
        const response = await apiClient.getActiveWorkflow();
        if (response.workflow) {
          const workflowData = typeof response.workflow.workflowData === "string"
            ? JSON.parse(response.workflow.workflowData)
            : response.workflow.workflowData;
          setWorkflowData(workflowData);
        }
      } catch (err) {
        console.error("Error fetching workflow:", err);
      }
    };
    fetchWorkflow();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const userRes = await fetchCurrentUser();
      if (cancelled) return;
      fetchLeads(userRes?.user);
      fetchUsers();
    })();
    setupRealtimeUpdates();
    checkMissedCallbacks();
    return () => {
      cancelled = true;
      if (socketClientRef.current) socketClientRef.current.disconnect();
      if (wrapupTimerRef.current) clearInterval(wrapupTimerRef.current);
    };
  }, []);

  // Check for missed callbacks on login (catch-up popup)
  const checkMissedCallbacks = async () => {
    try {
      // Get shift config
      const shift = await apiClient.getTelecallerShift();
      const { isWithinShift } = require("@/utils/shiftUtils");
      
      const now = new Date();
      if (!isWithinShift(now, shift.shiftStart, shift.shiftEnd)) {
        return; // Not within shift, don't show catch-up
      }

      // Check leads for overdue callbacks that were missed
      // This will be handled by the existing popup logic
      // The popup will show if callbackAt is in the past and within popup window
      // The CallbackPopupNotification component already handles this
    } catch (error) {
      console.error("Error checking missed callbacks:", error);
    }
  };
  
  // Smart auto refresh polling for bucket updates (separate effect)
  // Refresh every 15-30 seconds OR at nearest callbackAt time
  useEffect(() => {
    if (leads.length === 0) return;
    
    let refreshTimeout: NodeJS.Timeout;
    
    const scheduleRefresh = () => {
      // Find nearest callbackAt time
      const now = Date.now();
      let nearestCallbackTime: number | null = null;
      
      leads.forEach((lead) => {
        const callbackAt = lead.currentTag?.callbackAt;
        if (callbackAt) {
          const callbackTime = new Date(callbackAt).getTime();
          if (callbackTime > now && (nearestCallbackTime === null || callbackTime < nearestCallbackTime)) {
            nearestCallbackTime = callbackTime;
          }
        }
      });
      
      const refreshDelay = nearestCallbackTime 
        ? Math.min(nearestCallbackTime - now, 60000) // Max 60 seconds
        : 45000; // Default 45 seconds
      
      refreshTimeout = setTimeout(() => {
        fetchLeads();
        scheduleRefresh();
      }, Math.max(refreshDelay, 30000)); // Min 30 seconds
    };
    
    // Initial schedule
    scheduleRefresh();
    
    return () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
    };
  }, [leads]);


  const fetchLeads = async (userOverride?: { id: string; role?: { name: string } } | null) => {
    try {
      if (!initialLoadDoneRef.current) setLoading(true);
      else setRefreshing(true);
      setError(null);
      const role = userOverride?.role?.name ?? userRole;
      const userId = userOverride?.id ?? currentUser?.id;
      const isTelecaller = role === "TELECALLER";
      const assignedToUserId = isTelecaller ? userId : (assignedToFilter || undefined);
      
      const response: any = await apiClient.getLeads({
        status: statusFilter || undefined,
        assignedToUserId: assignedToUserId,
        search: searchTerm || undefined,
      });
      const leadsData = response.leads || [];
      
      // Fetch current tag and active action for each lead
      const leadsWithTagsAndActions = await Promise.all(
        leadsData.map(async (lead: Lead) => {
          try {
            // FIX: Use tagApplications from GET /api/leads response FIRST
            // Backend already includes tagApplications[0] with callbackAt
            let tags = (lead as any).tagApplications || [];
            let currentTag = tags.length > 0 ? tags[0] : null;
            
            // Only fetch separately if not present in response (fallback)
            if (!tags || tags.length === 0) {
              const tagsResponse = await apiClient.getLeadTags(lead.id);
              tags = tagsResponse.tagApplications || [];
              currentTag = tags.length > 0 ? tags[0] : null;
            }
            
            // Fetch active action (only if tag exists)
            let activeAction = null;
            if (currentTag?.tagFlowId) {
              try {
                const actionsResponse = await apiClient.getLeadActions(lead.id, currentTag.tagFlowId);
                const actions = actionsResponse.actions || [];
                activeAction = actions.length > 0 ? actions[0] : null;
              } catch (actionErr) {
                // Silently fail if actions can't be fetched
                console.warn(`[Leads] Failed to fetch actions for lead ${lead.id}:`, actionErr);
              }
            }
            
            return {
              ...lead,
              currentTag: currentTag || null,
              activeAction: activeAction || null,
              tagApplications: tags, // Store tag history for attempt counting
            };
          } catch (tagErr) {
            // If tag fetch fails, just return lead without tag/action
            console.warn(`[Leads] Failed to fetch tag for lead ${lead.id}:`, tagErr);
            return {
              ...lead,
              currentTag: null,
              activeAction: null,
              tagApplications: [],
            };
          }
        })
      );
      
      // Sort by newest first (default)
      leadsWithTagsAndActions.sort((a: Lead, b: Lead) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      setLeads(leadsWithTagsAndActions);
      initialLoadDoneRef.current = true;
      const counts = getBucketCounts(leadsWithTagsAndActions, userId ?? currentUser?.id);
      setBucketCounts(counts);
    } catch (err: any) {
      if (err.status === 401 || err.status === 403) {
        return;
      }
      setError(err.message || "Failed to fetch leads");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchUsers = async () => {
    try {
      // Try getStaff first (works for more roles), fallback to getUsers (for ADMIN/BRANCH_MANAGER)
      let response: any;
      try {
        response = await apiClient.getStaff();
        setUsers(response.staff || []);
      } catch (staffError: any) {
        // Fallback to getUsers if getStaff fails
        try {
          response = await apiClient.getUsers();
          setUsers(response.users || []);
        } catch (usersError: any) {
          console.error("Failed to fetch users:", usersError);
        }
      }
    } catch (err: any) {
      console.error("Failed to fetch users:", err);
    }
  };

  const fetchCurrentUser = async (): Promise<any> => {
    try {
      const response: any = await apiClient.getCurrentUser();
      setCurrentUser(response.user);
      setUserRole(response.user?.role?.name || null);
      return response;
    } catch (err: any) {
      console.error("Failed to fetch current user:", err);
      return null;
    }
  };


  const setupRealtimeUpdates = () => {
    const socketClient = getSocketClient();
    socketClientRef.current = socketClient;
    
    socketClient.connect(
      () => {
        console.log("[Leads] Socket connected");
      },
      () => {
        console.log("[Leads] Socket disconnected");
      },
      (error: string) => {
        console.error("[Leads] Socket error:", error);
        if (error.includes("Authentication")) {
          router.push("/login");
        }
      },
      (event: DxEvent) => {
        handleRealtimeEvent(event);
      }
    );
  };

  const handleRealtimeEvent = (event: DxEvent) => {
    if (event.type !== "system") return;
    
    const payload = event.payload;
    if (!payload || !payload.type) return;
    
    switch (payload.type) {
      case "lead:created":
        // Refresh list or prepend new lead
        fetchLeads();
        break;
        
      case "lead:assigned":
        // Update affected row
        if (payload.leadId) {
          // Check if this lead is assigned to current user
          if (payload.toUserId === currentUser?.id) {
            // Fetch the lead details to check if it's fresh
            handleNewLeadAssignment(payload.leadId);
          }
          fetchLeads();
        }
        break;
        
      case "lead:statusChanged":
        // Update status in list
        if (payload.leadId) {
          fetchLeads();
        }
        break;
        
      case "lead:tagUpdated":
      case "lead:tagApplied":
      case "tag:applied":
        // Instant update: When callback is set, update lead's currentTag and recalculate buckets
        if (payload.leadId) {
          updateLeadTagInstantly(payload.leadId);
        }
        break;
    }
  };
  
  // Schedule callback for lead with "No Answer" but missing callbackAt (one-click permanent fix)
  const handleScheduleCallback = async (leadId: string) => {
    try {
      await apiClient.scheduleCallbackForLead(leadId);
    } catch (err: any) {
      console.error("[Leads] Schedule callback failed:", err);
      alert(err?.message || "Failed to schedule callback. Please try re-applying the No Answer tag.");
    } finally {
      // Always refetch tags: GET /api/leads/:id/tags runs auto-heal (ensureNoAnswerCallbackScheduled), so UI can update even if schedule-callback returned 400
      await updateLeadTagInstantly(leadId);
    }
  };

  // Instant update lead tag without full refresh
  const updateLeadTagInstantly = async (leadId: string) => {
    try {
      // Fetch updated tag for this lead
      const tagsResponse = await apiClient.getLeadTags(leadId);
      const tags = tagsResponse.tagApplications || [];
      const currentTag = tags.length > 0 ? tags[0] : null;
      
      // Update lead in state with new tag
      setLeads((prevLeads) => {
        const updatedLeads = prevLeads.map((lead) => {
          if (lead.id === leadId) {
            return {
              ...lead,
              currentTag: currentTag || null,
              tagApplications: tags, // Store tag history for attempt counting
            };
          }
          return lead;
        });
        
        // Recalculate bucket counts with updated leads
        const counts = getBucketCounts(updatedLeads, currentUser?.id);
        setBucketCounts(counts);
        
        return updatedLeads;
      });
    } catch (error) {
      console.error(`[Leads] Error updating lead tag instantly:`, error);
      // Fallback to full refresh if instant update fails
      fetchLeads();
    }
  };

  const handleNewLeadAssignment = async (leadId: string) => {
    try {
      // Fetch lead details to check if it's fresh
      const leadDetail = await apiClient.getLead(leadId);
      
      if (leadDetail) {
        // Check if lead is fresh (no callStatus)
        const isFresh = getLeadBucket(leadDetail) === "fresh";
        
        if (isFresh) {
          // Show notification
          setNotificationLead({
            id: leadId,
            name: `${leadDetail.firstName} ${leadDetail.lastName}`,
          });
          setShowNotification(true);
          
          // Check if system is available (user is on leads page and not in a call)
          // System is available if:
          // 1. User is on the leads page (we're here, so yes)
          // 2. No active call in progress (can be enhanced later)
          const isSystemAvailable = true;
          
          if (isSystemAvailable) {
            // Start wrapup time immediately
            startWrapupTime();
            
            // Auto-open task after short delay (1 second)
            setTimeout(() => {
              handleOpenTask(leadId);
            }, 1000);
          }
        }
      }
    } catch (error) {
      console.error("Error handling new lead assignment:", error);
    }
  };

  const startWrapupTime = () => {
    // Clear any existing timer
    if (wrapupTimerRef.current) {
      clearInterval(wrapupTimerRef.current);
    }
    
    // Start wrapup time tracking
    setWrapupTimeStarted(true);
    wrapupStartTimeRef.current = Date.now();
    
    console.log("⏱️ Wrapup time started");
    
    // You can add logic here to track wrapup time duration
    // For example, update UI or send to backend
  };

  const handleOpenTask = (leadId: string) => {
    // Mark that this lead was opened from notification
    sessionStorage.setItem(`lead_${leadId}_assigned`, "true");
    
    // Navigate to lead detail page
    router.push(`/dashboard/leads/${leadId}`);
  };

  const handleLeadClick = (lead: Lead) => {
    // Navigate to lead detail page (same as My Tasks)
    router.push(`/dashboard/leads/${lead.id}`);
  };

  const handleCreateLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!createForm.firstName.trim() || !createForm.lastName.trim() || !createForm.email.trim() || !createForm.phone.trim()) {
      setCreateError("First name, last name, email and phone are required.");
      return;
    }
    setCreateSubmitting(true);
    try {
      await apiClient.createLead({
        firstName: createForm.firstName.trim(),
        lastName: createForm.lastName.trim(),
        email: createForm.email.trim(),
        phone: createForm.phone.trim(),
        country: createForm.country.trim() || undefined,
        visaType: createForm.visaType.trim() || undefined,
        source: createForm.source.trim() || undefined,
        status: createForm.status,
        notes: createForm.notes.trim() || undefined,
        assignedToId: createForm.assignedToId || undefined,
      });
      setSuccess("Lead created successfully.");
      setShowCreateModal(false);
      setCreateForm({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        country: "",
        visaType: "",
        source: "",
        status: "new",
        notes: "",
        assignedToId: "",
      });
      fetchLeads();
    } catch (err: any) {
      setCreateError(err.message || err.error || "Failed to create lead.");
    } finally {
      setCreateSubmitting(false);
    }
  };


  // Refetch when filters or user (for RBAC) change; skip first run to avoid double fetch on mount
  const filterEffectRanRef = useRef(false);
  useEffect(() => {
    if (!filterEffectRanRef.current) {
      filterEffectRanRef.current = true;
      return;
    }
    const timeoutId = setTimeout(() => fetchLeads(), 500);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, statusFilter, assignedToFilter, userRole, currentUser?.id]);

  const filteredLeads = leads.filter((lead) => {
    // Filter by bucket (Fresh, Orange/Callback, Red/Overdue)
    if (bucketFilter !== "all") {
      const bucket = getLeadBucket(lead);
      
      // Debug log for red bucket filter (always log in dev to see what's happening)
      if (bucketFilter === "red") {
        const callbackAt = lead.currentTag?.callbackAt || lead.callbackAt || lead.callbackScheduledAt;
        const now = new Date();
        const callbackTime = callbackAt ? new Date(callbackAt) : null;
        const diff = callbackTime && !isNaN(callbackTime.getTime()) ? callbackTime.getTime() - now.getTime() : null;
        const isOverdue = diff !== null && diff <= 0;
        
        console.log(`[Leads Filter] Lead ${lead.id} (${lead.firstName} ${lead.lastName}): bucket=${bucket}, callbackAt=${callbackAt}, diff=${diff ? Math.floor(diff / 1000) + 's' : 'N/A'}, isOverdue=${isOverdue}, matches=${bucket === bucketFilter}`, {
          currentTag: lead.currentTag,
          callStatus: lead.callStatus,
        });
        
        // If lead is overdue but not classified as red, log warning
        if (isOverdue && bucket !== "red") {
          console.warn(`[Leads Filter] ⚠️ Overdue lead ${lead.id} classified as ${bucket} instead of red!`, {
            callbackAt,
            currentTag: lead.currentTag,
            callStatus: lead.callStatus,
            status: lead.status,
          });
        }
      }
      
      if (bucket !== bucketFilter) return false;
    }
    
    // Filter by search term
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const fullName = `${lead.firstName} ${lead.lastName}`.toLowerCase();
      const email = lead.email?.toLowerCase() || "";
      const phone = lead.phone || "";
      
      const matchesSearch = (
        fullName.includes(search) ||
        email.includes(search) ||
        phone.includes(search)
      );
      
      if (!matchesSearch) {
        return false;
      }
    }
    
    // Note: Removed callbackScheduledAt filter - bucket classification already handles this correctly
    // Overdue leads (callbackAt in past) are classified as RED bucket
    // Future callbacks (callbackAt in future) are classified as ORANGE bucket
    // No need to filter here - let bucket classification handle it
    
    return true;
  });

  // Sort leads by bucket-specific rules
  const sortedFilteredLeads = [...filteredLeads].sort((a, b) => {
    if (bucketFilter === "red") {
      const aCallback = a.currentTag?.callbackAt ? new Date(a.currentTag.callbackAt).getTime() : 0;
      const bCallback = b.currentTag?.callbackAt ? new Date(b.currentTag.callbackAt).getTime() : 0;
      const now = Date.now();
      const aOverdue = aCallback > 0 ? now - aCallback : 0;
      const bOverdue = bCallback > 0 ? now - bCallback : 0;
      return bOverdue - aOverdue;
    }
    if (bucketFilter === "exhaust") {
      const aExhausted = (a as any).exhaustedAt ? new Date((a as any).exhaustedAt).getTime() : 0;
      const bExhausted = (b as any).exhaustedAt ? new Date((b as any).exhaustedAt).getTime() : 0;
      return bExhausted - aExhausted;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="pt-2 px-4 pb-4 md:pt-4 md:px-6 md:pb-6 lg:pt-5 lg:px-8 lg:pb-8">
      {/* New Task Notification */}
      {notificationLead && (
        <NewTaskNotification
          show={showNotification}
          leadName={notificationLead.name}
          leadId={notificationLead.id}
          onClose={() => {
            setShowNotification(false);
            setNotificationLead(null);
          }}
          onOpenTask={handleOpenTask}
        />
      )}
      
      {/* Page header + Filters in one card */}
      <div className="mb-8 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header row: title + search + status + Create Lead */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 sm:p-5 border-b border-gray-100">
          <div className="min-w-0 shrink-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                <Target className="h-5 w-5 sm:h-6 sm:w-6" />
              </span>
              Leads
            </h1>
            <p className="mt-1.5 text-sm sm:text-base text-gray-500">Manage and track your leads</p>
          </div>
          {/* Search, Status, Create Lead — separate controls, right-aligned */}
          <div className="flex flex-1 min-w-0 items-center justify-end gap-2 flex-wrap sm:flex-nowrap">
            <div className="relative w-full sm:w-auto sm:min-w-[180px] sm:max-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by name, phone, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-auto sm:min-w-[140px] sm:max-w-[200px] px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400 cursor-pointer text-gray-700"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              aria-label="Create new lead"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-primary-700 hover:shadow focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 shrink-0 transition-all duration-200 active:scale-[0.98]"
            >
              <Plus className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
              Create Lead
            </button>
          </div>
        </div>

        {/* Filters - bucket cards + tabs + Assigned To */}
        <div className="p-4 sm:p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Bucket Cards + Filter Tabs — one centered block */}
          <div className="col-span-full flex flex-col items-center">
            {(() => {
              const showExhaustBucket = userRole === "TEAM_LEADER" || userRole === "BRANCH_MANAGER" || userRole === "ADMIN";
              const bucketTypes: BucketType[] = ["fresh", "green", "orange", "red"].concat(showExhaustBucket ? ["exhaust"] : []);
              return (
            <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 w-fit max-w-full">
              {bucketTypes.map((bucketType) => {
                const config = BUCKET_CONFIG[bucketType];
                const count = bucketCounts[bucketType] ?? 0;
                const IconComponent = bucketType === "fresh" ? Sparkles :
                  bucketType === "green" ? CheckCircle2 :
                    bucketType === "orange" ? Clock :
                      bucketType === "exhaust" ? AlertTriangle : X;
                const isSelected = bucketFilter === bucketType;

                return (
                  <button
                    key={bucketType}
                    type="button"
                    onClick={() => {
                      setBucketFilter(bucketType);
                      router.push(`/dashboard/leads?bucket=${bucketType}`);
                    }}
                    className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 min-w-[100px] sm:min-w-[108px] text-left transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary-400 ${
                      isSelected
                        ? `${config.borderColor} shadow-md bg-white`
                        : "border-gray-200 bg-gray-50/70 hover:border-gray-300 hover:bg-white hover:shadow-sm active:scale-[0.99]"
                    }`}
                  >
                    <div className={`shrink-0 flex h-9 w-9 items-center justify-center rounded-lg ${config.bgColor} ${config.color}`}>
                      <IconComponent className="h-4 w-4" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className={`block text-lg font-bold tabular-nums leading-tight ${config.color}`}>
                        {count}
                      </span>
                      <span className="block text-xs font-medium text-gray-600 truncate leading-tight" title={
                        bucketType === "fresh" ? "New leads waiting" :
                        bucketType === "green" ? "Interested & progressing" :
                        bucketType === "orange" ? "Callback scheduled" :
                        bucketType === "red" ? "Overdue or not interested / Invalid" :
                        "Pool exhausted, senior action needed"
                      }>
                        {config.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Filter Tabs - pill style, centered below cards */}
            <div className="flex flex-wrap justify-center gap-2 mt-4 pt-4 border-t border-gray-100 w-full max-w-[560px]">
              <button
                type="button"
                onClick={() => {
                  setBucketFilter("all");
                  router.push("/dashboard/leads");
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary-400 ${
                  bucketFilter === "all"
                    ? "bg-primary-100 text-primary-800 ring-1 ring-primary-200 shadow-sm"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                }`}
              >
                All ({(bucketCounts.fresh + bucketCounts.green + bucketCounts.orange + bucketCounts.red + (bucketCounts.exhaust ?? 0))})
              </button>
              <button
                type="button"
                onClick={() => {
                  setBucketFilter("fresh");
                  router.push("/dashboard/leads?bucket=fresh");
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400 ${
                  bucketFilter === "fresh"
                    ? "bg-blue-100 text-blue-800 ring-1 ring-blue-200 shadow-sm"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" aria-hidden />
                Fresh ({bucketCounts.fresh})
              </button>
              <button
                type="button"
                onClick={() => {
                  setBucketFilter("green");
                  router.push("/dashboard/leads?bucket=green");
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-green-400 ${
                  bucketFilter === "green"
                    ? "bg-green-100 text-green-800 ring-1 ring-green-200 shadow-sm"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" aria-hidden />
                Green ({bucketCounts.green})
              </button>
              <button
                type="button"
                onClick={() => {
                  setBucketFilter("orange");
                  router.push("/dashboard/leads?bucket=orange");
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-orange-400 ${
                  bucketFilter === "orange"
                    ? "bg-orange-100 text-orange-800 ring-1 ring-orange-200 shadow-sm"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" aria-hidden />
                Callback ({bucketCounts.orange})
              </button>
              <button
                type="button"
                onClick={() => {
                  setBucketFilter("red");
                  router.push("/dashboard/leads?bucket=red");
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-400 ${
                  bucketFilter === "red"
                    ? "bg-red-100 text-red-800 ring-1 ring-red-200 shadow-sm"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" aria-hidden />
                Overdue ({bucketCounts.red})
              </button>
              {(userRole === "TEAM_LEADER" || userRole === "BRANCH_MANAGER" || userRole === "ADMIN") && (
                <button
                  type="button"
                  onClick={() => {
                    setBucketFilter("exhaust");
                    router.push("/dashboard/leads?bucket=exhaust");
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-purple-400 ${
                    bucketFilter === "exhaust"
                      ? "bg-purple-100 text-purple-800 ring-1 ring-purple-200 shadow-sm"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" aria-hidden />
                  Exhaust ({bucketCounts.exhaust ?? 0})
                </button>
              )}
            </div>
            </>
              );
            })()}
          </div>

          {/* Assigned To Filter - Hidden for Telecaller (RBAC) */}
          {userRole !== "TELECALLER" && (
            <div className="lg:col-start-4">
              {users.length > 0 ? (
                <select
                  value={assignedToFilter}
                  onChange={(e) => setAssignedToFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400 transition-colors"
                >
                  <option value="">All Users</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName}
                      {user.employeeCode && ` (${user.employeeCode})`}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Assigned To (user ID or name)..."
                  value={assignedToFilter}
                  onChange={(e) => setAssignedToFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400"
                />
              )}
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Create Lead Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Create Lead</h2>
              <button
                type="button"
                onClick={() => !createSubmitting && setShowCreateModal(false)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateLeadSubmit} className="p-4 space-y-4">
              {createError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {createError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    value={createForm.firstName}
                    onChange={(e) => setCreateForm((f) => ({ ...f, firstName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="First name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={createForm.lastName}
                    onChange={(e) => setCreateForm((f) => ({ ...f, lastName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Last name"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="email@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                <input
                  type="text"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Phone number"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  <input
                    type="text"
                    value={createForm.country}
                    onChange={(e) => setCreateForm((f) => ({ ...f, country: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Country"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Visa Type</label>
                  <input
                    type="text"
                    value={createForm.visaType}
                    onChange={(e) => setCreateForm((f) => ({ ...f, visaType: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="e.g. Student, Work"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                  <input
                    type="text"
                    value={createForm.source}
                    onChange={(e) => setCreateForm((f) => ({ ...f, source: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="e.g. Website, Referral"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={createForm.status}
                    onChange={(e) => setCreateForm((f) => ({ ...f, status: e.target.value as typeof createForm.status }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {STATUS_OPTIONS.filter((o) => o.value).map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
                <select
                  value={createForm.assignedToId}
                  onChange={(e) => setCreateForm((f) => ({ ...f, assignedToId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName}{u.employeeCode ? ` (${u.employeeCode})` : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={createForm.notes}
                  onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Optional notes"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                  {createSubmitting ? "Creating..." : "Create Lead"}
                </button>
                <button
                  type="button"
                  disabled={createSubmitting}
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800">
          <CheckCircle2 className="h-5 w-5" />
          {success}
        </div>
      )}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Refreshing: thin bar, list stays — no blink, scroll stable */}
      {refreshing && (
        <div className="sticky top-0 z-10 h-1 bg-primary-500 animate-pulse rounded-full mb-2" aria-hidden />
      )}

      {/* Leads Table — min-height to avoid layout jump */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center min-h-[280px] flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading leads...</p>
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg font-medium mb-2">No leads found</p>
          <p className="text-gray-500 text-sm">
            {searchTerm || statusFilter || assignedToFilter || bucketFilter !== "all"
              ? "Try adjusting your filters"
              : "No leads available"}
          </p>
          {bucketFilter === "red" && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md text-left text-xs max-w-2xl mx-auto">
              <p className="font-semibold mb-2">Debug Info (Red Bucket):</p>
              <p>Total leads in state: {leads.length}</p>
              <p>Filtered leads: {filteredLeads.length}</p>
              <p>Bucket filter: {bucketFilter}</p>
              <p>Bucket counts: Red={bucketCounts.red}</p>
              <p className="mt-2 font-semibold">All leads bucket classification:</p>
              <ul className="list-disc list-inside space-y-1">
                {leads.map(l => {
                  const bucket = getLeadBucket(l);
                  const callbackAt = l.currentTag?.callbackAt || l.callbackAt;
                  return (
                    <li key={l.id} className={bucket === "red" ? "text-red-600 font-semibold" : ""}>
                      {l.firstName} {l.lastName}: bucket={bucket}, callbackAt={callbackAt || "N/A"}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 min-h-[200px]" key="leads-grid">
          {sortedFilteredLeads.map((lead) => (
            <div
              key={lead.id}
              onClick={() => handleLeadClick(lead)}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md hover:border-primary-200 cursor-pointer transition-all duration-200 relative"
            >
              {/* Shuffle badge — top-right, fixed once lead has been shuffled */}
              {(lead.shuffleIndex != null && lead.shuffleIndex > 0) || lead.lastHandoffAt ? (
                <div
                  className="absolute top-3 right-3 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200"
                  title={`Shuffled ${lead.shuffleIndex ?? 0} time(s)`}
                >
                  <ArrowRightLeft className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                  <span className="text-xs font-semibold text-amber-700">{lead.shuffleIndex ?? 0}</span>
                </div>
              ) : null}

              {/* Header: name + phone (main lead identity) */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                    <User className="h-6 w-6 text-primary-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-gray-900 truncate">
                      {lead.firstName} {lead.lastName}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {lead.leadId != null && (
                        <span className="text-xs text-gray-500 font-medium">#{lead.leadId}</span>
                      )}
                      {lead.phone && (
                        <span className="text-sm text-gray-600 truncate">{lead.phone}</span>
                      )}
                    </div>
                  </div>
                </div>
                {/* Hide status pill when lead is in No Answer flow — tag/callback are primary */}
                {lead.currentTag?.tagFlow?.tagValue !== "no_answer" && (
                  <span
                    className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded-full capitalize flex-shrink-0 ${STATUS_COLORS[lead.status]}`}
                    title={`Status: ${lead.status}`}
                  >
                    {lead.status}
                  </span>
                )}
              </div>

              {/* Assigned + date (who & when — main detail) */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-gray-600 mb-3">
                {lead.email && (
                  <span className="flex items-center gap-1.5 truncate max-w-[200px]">
                    <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{lead.email}</span>
                  </span>
                )}
                {lead.assignedTo ? (
                  <span className="flex items-center gap-1.5 truncate font-medium text-gray-700">
                    <User className="h-4 w-4 text-gray-500 flex-shrink-0" />
                    <span className="truncate">{lead.assignedTo.firstName} {lead.assignedTo.lastName}</span>
                  </span>
                ) : lead.assignedToId ? (() => {
                  const u = users.find(x => x.id === lead.assignedToId);
                  return u ? (
                    <span className="flex items-center gap-1.5 truncate font-medium text-gray-700">
                      <User className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      <span className="truncate">{u.firstName} {u.lastName}</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-gray-400">
                      <User className="h-4 w-4" />
                      Unassigned
                    </span>
                  );
                })() : (
                  <span className="flex items-center gap-1.5 text-gray-400">
                    <User className="h-4 w-4" />
                    Unassigned
                  </span>
                )}
                <span className="text-gray-500 font-medium">{formatDate(lead.createdAt)}</span>
              </div>

              {/* Bucket pill — use same getLeadBucket as filter/counts so tab and card always match (e.g. Overdue tab shows Overdue pill) */}
              {(() => {
                const bucket = getLeadBucket(lead);
                if (bucket === "fresh") {
                  return (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-50 border border-blue-100 w-fit">
                      <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                      <span className="text-xs font-medium text-blue-700">Fresh</span>
                    </div>
                  );
                }
                if (bucket === "green") {
                  return (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-50 border border-green-100 w-fit">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      <span className="text-xs font-medium text-green-700">Connected</span>
                    </div>
                  );
                }
                if (bucket === "orange") {
                  const diff = lead.currentTag?.callbackAt
                    ? new Date(lead.currentTag.callbackAt).getTime() - Date.now()
                    : 0;
                  const diffMinutes = Math.floor(Math.abs(diff) / (1000 * 60));
                  const diffHours = Math.floor(diffMinutes / 60);
                  return (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-orange-50 border border-orange-100 w-fit">
                      <Clock className="h-3.5 w-3.5 text-orange-600" />
                      <span className="text-xs font-medium text-orange-700">
                        {diff > 0 ? `Next call in ${diffHours > 0 ? `${diffHours}h` : `${diffMinutes}m`}` : "Callback"}
                      </span>
                    </div>
                  );
                }
                if (bucket === "red") {
                  if (lead.status === "lost") {
                    return (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-50 border border-red-100 w-fit">
                        <X className="h-3.5 w-3.5 text-red-600" />
                        <span className="text-xs font-medium text-red-700">Lost</span>
                      </div>
                    );
                  }
                  const callStatusStr = (lead.callStatus || "").toLowerCase();
                  const isInvalid = /not interested|invalid|wrong number|duplicate/.test(callStatusStr);
                  if (isInvalid && !lead.currentTag?.callbackAt) {
                    return (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-50 border border-red-100 w-fit">
                        <X className="h-3.5 w-3.5 text-red-600" />
                        <span className="text-xs font-medium text-red-700">Invalid</span>
                      </div>
                    );
                  }
                  const overdueDuration = lead.currentTag?.callbackAt
                    ? Math.abs(Date.now() - new Date(lead.currentTag.callbackAt).getTime())
                    : 0;
                  const days = Math.floor(overdueDuration / (1000 * 60 * 60 * 24));
                  const hours = Math.floor((overdueDuration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                  const overdueText = days > 0 ? `${days}d` : hours > 0 ? `${hours}h` : "Overdue";
                  return (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-50 border border-red-100 w-fit">
                      <Clock className="h-3.5 w-3.5 text-red-600" />
                      <span className="text-xs font-medium text-red-700">Overdue {overdueText}</span>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Tag + callback info — hide when Fresh; if lead was shuffled, only show tag when applied after shuffle (current cycle) */}
              {(() => {
                if (!lead.currentTag?.tagFlow || (lead.tagApplications?.length ?? 0) === 0) return false;
                if (getLeadBucket(lead) === "fresh") return false;
                const tagCreatedAt = lead.tagApplications?.[0]?.createdAt;
                if (tagCreatedAt) {
                  const tagTime = new Date(tagCreatedAt).getTime();
                  if (lead.lastHandoffAt && tagTime < new Date(lead.lastHandoffAt).getTime()) return false;
                  if ((lead.shuffleIndex ?? 0) > 0 && lead.assignedAt && tagTime < new Date(lead.assignedAt).getTime()) return false;
                }
                return true;
              })() && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                      style={{
                        backgroundColor: `${lead.currentTag.tagFlow.color}18`,
                        color: lead.currentTag.tagFlow.color,
                        border: `1px solid ${lead.currentTag.tagFlow.color}40`,
                      }}
                    >
                      {lead.currentTag.tagFlow.name}
                    </span>
                  </div>
                  <LeadCardTagInfo
                    currentTag={lead.currentTag}
                    tagHistory={
                      lead.lastHandoffAt
                        ? (lead.tagApplications || []).filter((ta: any) => new Date(ta.createdAt) > new Date(lead.lastHandoffAt!))
                        : (lead.shuffleIndex ?? 0) > 0 && lead.assignedAt
                          ? (lead.tagApplications || []).filter((ta: any) => new Date(ta.createdAt) >= new Date(lead.assignedAt!))
                          : (lead.tagApplications || [])
                    }
                    tagKey={lead.currentTag.tagFlow?.tagValue || "no_answer"}
                    leadId={lead.id}
                    onScheduleCallback={handleScheduleCallback}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Focus mode: slim bar when user opened a lead and other callbacks are waiting */}
      {focusLeadId && popupDueLeads.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2 bg-amber-100 border border-amber-300 rounded-lg shadow-lg text-amber-900 text-sm">
          <Clock className="h-4 w-4" />
          <span>{popupDueLeads.length} callback{popupDueLeads.length !== 1 ? "s" : ""} waiting</span>
          <button
            type="button"
            onClick={() => setFocusLeadId(null)}
            className="font-medium underline hover:no-underline"
          >
            View
          </button>
        </div>
      )}

      {/* Single popup at a time (queue: only first due lead; Skip shows next after 800ms) */}
      {activePopupLead && (
        <CallbackPopupNotification
          key={activePopupLead.id}
          lead={activePopupLead}
          tagConfig={getTagConfigForLead(activePopupLead)}
          attemptCount={(activePopupLead.tagApplications || []).filter((ta: any) => ta.tagFlow?.tagValue === "no_answer").length}
          onAction={async (action, leadId) => {
            if (action === "Skip") {
              setPopupLeads((prev) => {
                const newSet = new Set(prev);
                newSet.add(getPopupDismissKey(activePopupLead));
                return newSet;
              });
              setDelayingNextPopup(true);
              setTimeout(() => setDelayingNextPopup(false), 800);
            } else if (action === "Open") {
              setFocusLeadId(leadId);
              setPopupLeads((prev) => {
                const newSet = new Set(prev);
                newSet.add(getPopupDismissKey(activePopupLead));
                return newSet;
              });
              const pendingCount = Math.max(0, popupDueLeads.length - 1);
              try {
                sessionStorage.setItem("callbackFocus", JSON.stringify({ leadId, pendingCount }));
              } catch (_) {}
              window.location.href = `/dashboard/leads/${leadId}`;
            } else if (action === "Retry Callback") {
                // Automatically re-apply "no_answer" tag according to retry policy
                try {
                  // Find "No Answer" tagFlowId from workflow
                  let noAnswerTagFlowId: string | null = null;
                  
                  if (workflowData) {
                    // Check in tags object
                    if (workflowData.tags) {
                      const noAnswerTag = Object.values(workflowData.tags).find((t: any) => 
                        t.tagValue === "no_answer" || t.name?.toLowerCase() === "no answer"
                      );
                      if (noAnswerTag) {
                        noAnswerTagFlowId = noAnswerTag.id || noAnswerTag.tagFlowId;
                      }
                    }
                    
                    // Check in tagGroups if not found
                    if (!noAnswerTagFlowId && workflowData.tagGroups) {
                      const allTags = [
                        ...(workflowData.tagGroups.connected || []),
                        ...(workflowData.tagGroups.notConnected || []),
                      ];
                      const noAnswerTag = allTags.find((t: any) => 
                        t.tagValue === "no_answer" || t.name?.toLowerCase() === "no answer"
                      );
                      if (noAnswerTag) {
                        noAnswerTagFlowId = noAnswerTag.id || noAnswerTag.tagFlowId;
                      }
                    }
                  }
                  
                  if (!noAnswerTagFlowId) {
                    // Fallback: fetch tag flows to find "No Answer"
                    const tagFlowsResponse = await apiClient.getTagFlowsActive();
                    const noAnswerTag = tagFlowsResponse.tagFlows.find((t: any) => 
                      t.tagValue === "no_answer" || t.name?.toLowerCase() === "no answer"
                    );
                    if (noAnswerTag) {
                      noAnswerTagFlowId = noAnswerTag.id;
                    }
                  }
                  
                  if (!noAnswerTagFlowId) {
                    alert("No Answer tag not found. Please apply tag manually.");
                    return;
                  }
                  
                  // Automatically apply "No Answer" tag (backend will handle attempt increment and next callback)
                  await apiClient.applyTagToLead(leadId, {
                    tagId: noAnswerTagFlowId,
                    note: `Retry attempt - automatically scheduled`,
                  });
                  
                  // Close popup and refresh leads
                  setPopupLeads(prev => {
                    const newSet = new Set(prev);
                    newSet.add(leadId);
                    return newSet;
                  });
                  
                  // Refresh leads to show updated attempt count and callbackAt
                  await fetchLeads();
                } catch (error: any) {
                  console.error("Error retrying callback:", error);
                  alert(error.message || "Failed to retry callback. Please try again.");
                }
              }
              // Model B: No manual escalate; escalation is auto (24h alert, 48h reassign).
            }}
            onClose={() => {
              setPopupLeads((prev) => {
                const newSet = new Set(prev);
                newSet.add(getPopupDismissKey(activePopupLead));
                return newSet;
              });
            }}
          />
      )}

      {/* Reminder Notifications */}
      {leads.map((lead) => {
        if (!lead.currentTag?.callbackAt || popupLeads.has(lead.id)) return null;
        
        // Find tagConfig for this tag
        const tagId = lead.currentTag.tagFlow?.id;
        let tagConfig: any = null;
        
        if (workflowData) {
          if (workflowData.tags) {
            const tag = Object.values(workflowData.tags).find((t: any) => 
              t.id === tagId || t.tagKey === tagId || t.name?.toLowerCase() === lead.currentTag?.tagFlow?.name?.toLowerCase()
            );
            if (tag && tag.tagConfig) {
              tagConfig = tag.tagConfig;
            }
          }
          
          if (!tagConfig && workflowData.tagGroups) {
            const allTags = [
              ...(workflowData.tagGroups.connected || []),
              ...(workflowData.tagGroups.notConnected || []),
            ];
            const tag = allTags.find((t: any) => 
              t.id === tagId || t.tagKey === tagId || t.name?.toLowerCase() === lead.currentTag?.tagFlow?.name?.toLowerCase()
            );
            if (tag && tag.tagConfig) {
              tagConfig = tag.tagConfig;
            }
          }
        }

        // Use new split reminder arrays (AMIT AUDIT FIX)
        const preCallRemindBeforeMinutes = tagConfig?.overduePolicy?.preCallRemindBeforeMinutes || [];
        const overdueRemindAfterMinutes = tagConfig?.overduePolicy?.overdueRemindAfterMinutes || [];
        
        // Fallback to old format for backward compatibility
        const oldRemindAtMinutes = tagConfig?.overduePolicy?.remindAtMinutes || [];
        const finalPreCall = preCallRemindBeforeMinutes.length > 0 
          ? preCallRemindBeforeMinutes 
          : oldRemindAtMinutes.filter((m: number) => m < 0).map((m: number) => Math.abs(m));
        const finalOverdue = overdueRemindAfterMinutes.length > 0 
          ? overdueRemindAfterMinutes 
          : oldRemindAtMinutes.filter((m: number) => m > 0);
        
        // Calculate attempt count for this lead
        const noAnswerTagApplications = (lead.tagApplications || []).filter(ta => 
          ta.tagFlow?.tagValue === "no_answer"
        );
        const attemptCount = noAnswerTagApplications.length;
        
        // Calculate overdue age in hours
        const callbackTime = lead.currentTag?.callbackAt ? new Date(lead.currentTag.callbackAt) : null;
        const now = new Date();
        const overdueAgeHours = callbackTime && callbackTime < now 
          ? Math.floor((now.getTime() - callbackTime.getTime()) / (1000 * 60 * 60))
          : 0;
        
        return (
          <div key={`reminder-${lead.id}`}>
            {/* Pre-call reminders (BEFORE callbackAt) */}
            {finalPreCall.map((minutes: number) => {
              const callbackTime = lead.currentTag?.callbackAt ? new Date(lead.currentTag.callbackAt) : null;
              const now = new Date();
              if (!callbackTime || callbackTime <= now) return null; // Only show for future callbacks
              
              return (
                <CallbackReminderNotification
                  key={`pre-call-${lead.id}-${minutes}`}
                  lead={lead}
                  reminderMinutes={minutes}
                  onClose={() => {
                    setPopupLeads(prev => {
                      const newSet = new Set(prev);
                      newSet.add(getPopupDismissKey(lead));
                      return newSet;
                    });
                  }}
                />
              );
            })}
            
            {/* Overdue reminders (AFTER callbackAt) */}
            {finalOverdue.map((minutes: number) => (
              <OverdueReminderNotification
                key={`overdue-${lead.id}-${minutes}`}
                lead={lead}
                reminderMinutes={minutes}
                attemptCount={attemptCount}
                onClose={() => {
                  setPopupLeads(prev => {
                    const newSet = new Set(prev);
                    newSet.add(getPopupDismissKey(lead));
                    return newSet;
                  });
                }}
                onRetry={async (leadId) => {
                  // Automatically re-apply "no_answer" tag according to retry policy
                  try {
                    // Find "No Answer" tagFlowId from workflow
                    let noAnswerTagFlowId: string | null = null;
                    
                    if (workflowData) {
                      // Check in tags object
                      if (workflowData.tags) {
                        const noAnswerTag = Object.values(workflowData.tags).find((t: any) => 
                          t.tagValue === "no_answer" || t.name?.toLowerCase() === "no answer"
                        );
                        if (noAnswerTag) {
                          noAnswerTagFlowId = noAnswerTag.id || noAnswerTag.tagFlowId;
                        }
                      }
                      
                      // Check in tagGroups if not found
                      if (!noAnswerTagFlowId && workflowData.tagGroups) {
                        const allTags = [
                          ...(workflowData.tagGroups.connected || []),
                          ...(workflowData.tagGroups.notConnected || []),
                        ];
                        const noAnswerTag = allTags.find((t: any) => 
                          t.tagValue === "no_answer" || t.name?.toLowerCase() === "no answer"
                        );
                        if (noAnswerTag) {
                          noAnswerTagFlowId = noAnswerTag.id || noAnswerTag.tagFlowId;
                        }
                      }
                    }
                    
                    if (!noAnswerTagFlowId) {
                      // Fallback: fetch tag flows to find "No Answer"
                      const tagFlowsResponse = await apiClient.getTagFlowsActive();
                      const noAnswerTag = tagFlowsResponse.tagFlows.find((t: any) => 
                        t.tagValue === "no_answer" || t.name?.toLowerCase() === "no answer"
                      );
                      if (noAnswerTag) {
                        noAnswerTagFlowId = noAnswerTag.id;
                      }
                    }
                    
                    if (!noAnswerTagFlowId) {
                      alert("No Answer tag not found. Please apply tag manually.");
                      return;
                    }
                    
                    // Automatically apply "No Answer" tag (backend will handle attempt increment and next callback)
                    await apiClient.applyTagToLead(leadId, {
                      tagId: noAnswerTagFlowId,
                      note: `Retry attempt - automatically scheduled`,
                    });
                    
                    // Refresh leads to show updated attempt count and callbackAt
                    await fetchLeads();
                  } catch (error: any) {
                    console.error("Error retrying callback:", error);
                    alert(error.message || "Failed to retry callback. Please try again.");
                  }
                }}
              />
            ))}
          </div>
        );
      })}

      {/* Model B: Escalation is auto-only (24h senior alert + flag, 48h reassign). No manual Escalate UI. */}

      {/* Tag Modal for Retry Callback */}
      {showTagModal && selectedLeadForTag && (() => {
        const selectedLead = leads.find(l => l.id === selectedLeadForTag);
        if (!selectedLead) return null;

        // Calculate attempt count for "No Answer" tag
        let attemptCount = 0;
        const MAX_ATTEMPTS = 3;
        if (selectedLead.tagApplications && selectedLead.tagApplications.length > 0) {
          const noAnswerTags = selectedLead.tagApplications.filter((ta) => {
            if (!ta.tagFlow) return false;
            const tagValue = ta.tagFlow.tagValue?.toLowerCase().replace(/\s+/g, "_");
            const tagKeyField = (ta.tagFlow as any).tagKey?.toLowerCase().replace(/\s+/g, "_");
            const tagName = ta.tagFlow.name?.toLowerCase().replace(/\s+/g, "_");
            return tagValue === "no_answer" || tagKeyField === "no_answer" || tagName === "no_answer" || tagName === "no answer";
          });
          attemptCount = noAnswerTags.length;
        }

        return (
          <TagModal
            isOpen={showTagModal}
            onClose={() => {
              setShowTagModal(false);
              setSelectedLeadForTag(null);
            }}
            leadId={selectedLeadForTag}
            onTagApplied={() => {
              fetchLeads();
              setShowTagModal(false);
              setSelectedLeadForTag(null);
            }}
            currentTagId={selectedLead.currentTag?.tagFlowId}
            userRole={userRole || undefined}
            attemptCount={attemptCount}
            maxAttempts={MAX_ATTEMPTS}
          />
        );
      })()}

    </div>
  );
}
