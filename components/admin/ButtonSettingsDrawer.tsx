"use client";

import { useState, useEffect } from "react";
import { X, Palette, Type, Image, Circle, Check, Navigation, Tag, Settings, Play, Save, Bold, Italic, AlignLeft, AlignCenter, AlignRight, Minus, Plus, Zap, Clock, Target, AlertTriangle, PhoneOff, PhoneMissed, Phone, PhoneCall, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { apiClient } from "@/lib/api";

interface ButtonSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    label: string;
    color: string;
    icon?: string;
    iconColor?: string;
    borderColor?: string;
    borderWidth?: number;
    borderRadius?: number;
    // Typography
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: string;
  }) => void;
  onLiveUpdate?: (data: {
    label: string;
    color: string;
    icon?: string;
    iconColor?: string;
    borderColor?: string;
    borderWidth?: number;
    borderRadius?: number;
    // Typography
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: string;
    textColor?: string;
    textAlign?: "left" | "center" | "right";
    // Button styling
    paddingX?: number;
    paddingY?: number;
    shadow?: boolean;
    shadowColor?: string;
    hoverColor?: string;
    // Advanced
    opacity?: number;
    transform?: string;
    // Tag behavior (only for tag nodes)
    tagConfig?: any;
  }) => void;
  onLiveUpdate?: (data: {
    label: string;
    color: string;
    icon?: string;
    iconColor?: string;
    borderColor?: string;
    borderWidth?: number;
    borderRadius?: number;
    // Typography
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: string;
    textColor?: string;
    textAlign?: "left" | "center" | "right";
    // Button styling
    paddingX?: number;
    paddingY?: number;
    shadow?: boolean;
    shadowColor?: string;
    hoverColor?: string;
    // Advanced
    opacity?: number;
    transform?: string;
    // Tag behavior (only for tag nodes)
    tagConfig?: any;
    // Badge colors
    badgeColor?: string;
    badgeBgColor?: string;
    badgeBorderColor?: string;
    isSystem?: boolean;
  }) => void;
  initialData?: any;
  nodeType?: "navigation" | "subButton" | "tag";
}

const colorOptions = [
  { name: "Primary", value: "#3b82f6" },
  { name: "Green", value: "#10b981" },
  { name: "Red", value: "#ef4444" },
  { name: "Yellow", value: "#f59e0b" },
  { name: "Purple", value: "#8b5cf6" },
  { name: "Pink", value: "#ec4899" },
  { name: "Orange", value: "#f97316" },
  { name: "Gray", value: "#6b7280" },
];

const iconOptions = [
  { name: "Navigation", value: "navigation" },
  { name: "Circle", value: "circle" },
  { name: "Tag", value: "tag" },
  { name: "Settings", value: "settings" },
  { name: "Play", value: "play" },
  { name: "Save", value: "save" },
  { name: "Phone Off", value: "phoneoff" },
  { name: "Wrong Number", value: "wrongnumber" },
  { name: "Phone", value: "phone" },
  { name: "Phone Call", value: "phonecall" },
  { name: "Phone Incoming", value: "phoneincoming" },
  { name: "Phone Outgoing", value: "phoneoutgoing" },
];

const fontFamilyOptions = [
  { name: "System Default", value: "system-ui" },
  { name: "Inter", value: "Inter, sans-serif" },
  { name: "Roboto", value: "Roboto, sans-serif" },
  { name: "Open Sans", value: "'Open Sans', sans-serif" },
  { name: "Poppins", value: "Poppins, sans-serif" },
  { name: "Montserrat", value: "Montserrat, sans-serif" },
  { name: "Lato", value: "Lato, sans-serif" },
  { name: "Arial", value: "Arial, sans-serif" },
  { name: "Helvetica", value: "Helvetica, sans-serif" },
];

const fontWeightOptions = [
  { name: "Thin", value: "100" },
  { name: "Light", value: "300" },
  { name: "Normal", value: "400" },
  { name: "Medium", value: "500" },
  { name: "Semibold", value: "600" },
  { name: "Bold", value: "700" },
  { name: "Extra Bold", value: "800" },
];

export default function ButtonSettingsDrawer({ isOpen, onClose, onSave, initialData, nodeType, onLiveUpdate }: ButtonSettingsDrawerProps) {
  const [label, setLabel] = useState(initialData?.label || "");
  const [selectedColor, setSelectedColor] = useState(initialData?.color || "#3b82f6");
  const [customColor, setCustomColor] = useState(initialData?.color || "#3b82f6");
  const [iconColor, setIconColor] = useState(initialData?.iconColor || "#ffffff");
  const [selectedIcon, setSelectedIcon] = useState<string | undefined>(initialData?.icon);
  const [borderColor, setBorderColor] = useState(initialData?.borderColor || "#e5e7eb");
  const [borderWidth, setBorderWidth] = useState(initialData?.borderWidth || 2);
  const [borderRadius, setBorderRadius] = useState(initialData?.borderRadius || 8);
  
  // Typography
  const [fontFamily, setFontFamily] = useState(initialData?.fontFamily || "system-ui");
  const [fontSize, setFontSize] = useState(initialData?.fontSize || 14);
  const [fontWeight, setFontWeight] = useState(initialData?.fontWeight || "400");
  const [textColor, setTextColor] = useState(initialData?.textColor || "#ffffff");
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right">(initialData?.textAlign || "center");
  
  // Button styling
  const [paddingX, setPaddingX] = useState(initialData?.paddingX || 16);
  const [paddingY, setPaddingY] = useState(initialData?.paddingY || 12);
  const [shadow, setShadow] = useState(initialData?.shadow !== undefined ? initialData.shadow : true);
  const [shadowColor, setShadowColor] = useState(initialData?.shadowColor || "rgba(0, 0, 0, 0.1)");
  const [hoverColor, setHoverColor] = useState(initialData?.hoverColor || "");
  
  // Advanced
  const [opacity, setOpacity] = useState(initialData?.opacity !== undefined ? initialData.opacity : 100);
  
  // Badge color (for System badge)
  const [badgeColor, setBadgeColor] = useState(initialData?.badgeColor || "#ffffff");
  const [badgeBgColor, setBadgeBgColor] = useState(initialData?.badgeBgColor || "rgba(255, 255, 255, 0.2)");
  const [badgeBgOpacity, setBadgeBgOpacity] = useState(() => {
    const match = (initialData?.badgeBgColor || "rgba(255, 255, 255, 0.2)").match(/rgba?\([^)]+,\s*([\d.]+)\)/);
    return match ? parseFloat(match[1]) * 100 : 20;
  });
  const [badgeBorderColor, setBadgeBorderColor] = useState(initialData?.badgeBorderColor || "rgba(255, 255, 255, 0.3)");
  const [badgeBorderOpacity, setBadgeBorderOpacity] = useState(() => {
    const match = (initialData?.badgeBorderColor || "rgba(255, 255, 255, 0.3)").match(/rgba?\([^)]+,\s*([\d.]+)\)/);
    return match ? parseFloat(match[1]) * 100 : 30;
  });

  // Tag Behavior (only for tag nodes)
  const [tagTemplate, setTagTemplate] = useState<"NO_ANSWER" | "BUSY" | "SWITCH_OFF" | "INVALID" | "CONNECTED_FLOW" | "">(
    initialData?.tagConfig?.template || ""
  );
  const [autoAction, setAutoAction] = useState<"CALLBACK" | "FOLLOWUP" | "CLOSE" | "">(
    initialData?.tagConfig?.autoAction || ""
  );
  const [maxAttempts, setMaxAttempts] = useState(initialData?.tagConfig?.retryPolicy?.maxAttempts || 3);
  const [attempt1, setAttempt1] = useState(initialData?.tagConfig?.retryPolicy?.attemptTimings?.attempt1 || "+60m");
  const [attempt2, setAttempt2] = useState(initialData?.tagConfig?.retryPolicy?.attemptTimings?.attempt2 || "Next Day");
  const [attempt3, setAttempt3] = useState(initialData?.tagConfig?.retryPolicy?.attemptTimings?.attempt3 || "+48h");
  const [popupAtSeconds, setPopupAtSeconds] = useState(initialData?.tagConfig?.overduePolicy?.popupAtSeconds || 30);
  const [remindAtMinutes, setRemindAtMinutes] = useState(
    initialData?.tagConfig?.overduePolicy?.remindAtMinutes?.join(", ") || "15, 60"
  );
  const [escalateAtHours, setEscalateAtHours] = useState(initialData?.tagConfig?.overduePolicy?.escalateAtHours || 24);
  const [bucketTarget, setBucketTarget] = useState<"fresh" | "green" | "orange" | "red">(
    initialData?.tagConfig?.bucketTarget || "green"
  );

  // Category Text Settings (only for tag nodes when connected)
  const [categoryTextColor, setCategoryTextColor] = useState(initialData?.categoryTextColor || initialData?.color || "#ffffff");
  const [categoryTextOpacity, setCategoryTextOpacity] = useState(initialData?.categoryTextOpacity !== undefined ? initialData.categoryTextOpacity : 100);
  const [categoryTextFontWeight, setCategoryTextFontWeight] = useState(initialData?.categoryTextFontWeight || "600");
  const [categoryTextFontSize, setCategoryTextFontSize] = useState(initialData?.categoryTextFontSize || 12);
  const [showConnectedLabel, setShowConnectedLabel] = useState(initialData?.showConnectedLabel !== undefined ? initialData.showConnectedLabel : true);
  
  // Action Button Colors (for TagDrawer buttons: Settings, Add to Canvas, Duplicate)
  const [settingsButtonHoverColor, setSettingsButtonHoverColor] = useState(initialData?.settingsButtonHoverColor || "#ffffff");
  const [addToCanvasButtonHoverColor, setAddToCanvasButtonHoverColor] = useState(initialData?.addToCanvasButtonHoverColor || "#dbeafe");
  const [addToCanvasButtonIconColor, setAddToCanvasButtonIconColor] = useState(initialData?.addToCanvasButtonIconColor || "#2563eb");
  const [duplicateButtonHoverColor, setDuplicateButtonHoverColor] = useState(initialData?.duplicateButtonHoverColor || "#dcfce7");
  const [duplicateButtonIconColor, setDuplicateButtonIconColor] = useState(initialData?.duplicateButtonIconColor || "#16a34a");
  
  // Fetch leads data for live callStatus updates (ANKIT_API_01, ANKIT_API_02, ANKIT_API_03)
  const [leadsData, setLeadsData] = useState<any[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);

  // Fetch leads data to get actual callStatus (ANKIT_API_01, ANKIT_API_02, ANKIT_API_03)
  useEffect(() => {
    if (!isOpen || nodeType !== "tag") return;
    
    const fetchLeadsData = async () => {
      setLoadingLeads(true);
      try {
        const response = await apiClient.request<any>("/api/leads", {
          method: "GET",
        });
        if (response?.leads) {
          setLeadsData(response.leads);
        }
      } catch (error) {
        console.error("[ButtonSettingsDrawer] Error fetching leads:", error);
      } finally {
        setLoadingLeads(false);
      }
    };

    fetchLeadsData();
    
    // Refresh every 30 seconds to get live updates (ANKIT_API_02)
    const interval = setInterval(fetchLeadsData, 30000);
    return () => clearInterval(interval);
  }, [isOpen, nodeType]);

  // Get color based on callStatus (ANKIT_API_01, ANKIT_API_03)
  const getCallStatusColor = (callStatus: string | null): string => {
    if (!callStatus) return "#f59e0b"; // Default orange for no status
    
    const statusLower = String(callStatus).toLowerCase().trim().replace(/\s+/g, "_").replace(/-/g, "_");
    
    // Green statuses (connected/processing)
    const greenStatuses = ["interested", "processing", "connected", "in_progress", "follow_up", "qualified", "discussion", "ready_to_process", "documents_ready"];
    if (greenStatuses.includes(statusLower)) {
      return "#10b981"; // Green
    }
    
    // Orange statuses (callback pending)
    const orangeStatuses = ["call_back", "busy_no_response", "switch_off_not_reachable", "documents_pending", "budget_issue", "eligibility_check_pending", "interested_but_later"];
    if (orangeStatuses.includes(statusLower)) {
      return "#f59e0b"; // Orange
    }
    
    // Red statuses (closed/not interested)
    const redStatuses = ["not_interested", "invalid_closed", "not_planning_now", "no_budget", "already_applied", "already_abroad", "family_not_agree", "not_eligible", "just_enquiry", "invalid_number", "wrong_number", "duplicate_lead", "do_not_call"];
    if (redStatuses.includes(statusLower)) {
      return "#ef4444"; // Red
    }
    
    // Default to orange if no match
    return "#f59e0b"; // Orange
  };

  // Get actual callStatus for this tag from leads data (ANKIT_API_01, ANKIT_API_03)
  const getTagActualCallStatus = (): { callStatus: string | null; callbackAt: string | null } => {
    if (!initialData?.id) return { callStatus: null, callbackAt: null };
    
    // Find leads that have this tag applied
    const leadsWithTag = leadsData.filter(lead => {
      return lead.currentTag?.tagFlowId === initialData.id || 
             lead.tagApplications?.some((ta: any) => ta.tagFlowId === initialData.id && ta.isActive);
    });

    if (leadsWithTag.length === 0) {
      return { callStatus: null, callbackAt: null };
    }

    // Get the most recent callStatus and callbackAt
    const latestLead = leadsWithTag[0]; // Already sorted by createdAt desc
    return {
      callStatus: latestLead.callStatus || null, // From backend API (ANKIT_API_01)
      callbackAt: latestLead.callbackAt || null, // From backend API in UTC ISO format (ANKIT_API_01)
    };
  };

  // Auto-update categoryTextColor based on actual callStatus (ANKIT_API_01, ANKIT_API_03)
  useEffect(() => {
    if (!isOpen || nodeType !== "tag" || !initialData?.id) return;
    
    const actualStatus = getTagActualCallStatus();
    if (actualStatus.callStatus) {
      const statusColor = getCallStatusColor(actualStatus.callStatus);
      // Only update if color is different (to avoid infinite loops)
      if (categoryTextColor !== statusColor) {
        setCategoryTextColor(statusColor);
      }
    }
  }, [leadsData, isOpen, nodeType, initialData?.id]);

  // Update state when drawer opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setLabel(initialData.label || initialData.name || "");
        setSelectedColor(initialData.color || "#3b82f6");
        setCustomColor(initialData.color || "#3b82f6");
        setIconColor(initialData.iconColor || "#ffffff");
        setSelectedIcon(initialData.icon);
        setBorderColor(initialData.borderColor || "#e5e7eb");
        setBorderWidth(initialData.borderWidth || 2);
        setBorderRadius(initialData.borderRadius || 8);
        // Typography
        setFontFamily(initialData.fontFamily || "system-ui");
        setFontSize(initialData.fontSize || 14);
        setFontWeight(initialData.fontWeight || "400");
        setTextColor(initialData.textColor || "#ffffff");
        setTextAlign(initialData.textAlign || "center");
        // Button styling
        setPaddingX(initialData.paddingX || 16);
        setPaddingY(initialData.paddingY || 12);
        setShadow(initialData.shadow !== undefined ? initialData.shadow : true);
        setShadowColor(initialData.shadowColor || "rgba(0, 0, 0, 0.1)");
        setHoverColor(initialData.hoverColor || "");
        // Advanced
        setOpacity(initialData.opacity !== undefined ? initialData.opacity : 100);
        // Badge colors
        setBadgeColor(initialData.badgeColor || "#ffffff");
        const bgColor = initialData.badgeBgColor || "rgba(255, 255, 255, 0.2)";
        setBadgeBgColor(bgColor);
        const bgMatch = bgColor.match(/rgba?\([^)]+,\s*([\d.]+)\)/);
        setBadgeBgOpacity(bgMatch ? parseFloat(bgMatch[1]) * 100 : 20);
        const borderColor = initialData.badgeBorderColor || "rgba(255, 255, 255, 0.3)";
        setBadgeBorderColor(borderColor);
        const borderMatch = borderColor.match(/rgba?\([^)]+,\s*([\d.]+)\)/);
        setBadgeBorderOpacity(borderMatch ? parseFloat(borderMatch[1]) * 100 : 30);
        // Action button colors
        setSettingsButtonHoverColor(initialData.settingsButtonHoverColor || "#ffffff");
        setAddToCanvasButtonHoverColor(initialData.addToCanvasButtonHoverColor || "#dbeafe");
        setAddToCanvasButtonIconColor(initialData.addToCanvasButtonIconColor || "#2563eb");
        setDuplicateButtonHoverColor(initialData.duplicateButtonHoverColor || "#dcfce7");
        setDuplicateButtonIconColor(initialData.duplicateButtonIconColor || "#16a34a");
      } else {
        // Reset to defaults for new button
        setLabel("");
        setSelectedColor("#3b82f6");
        setCustomColor("#3b82f6");
        setIconColor("#ffffff");
        setSelectedIcon(undefined);
        setBorderColor("#e5e7eb");
        setBorderWidth(2);
        setBorderRadius(8);
        // Typography defaults
        setFontFamily("system-ui");
        setFontSize(14);
        setFontWeight("400");
        setTextColor("#ffffff");
        setTextAlign("center");
        // Button styling defaults
        setPaddingX(16);
        setPaddingY(12);
        setShadow(true);
        setShadowColor("rgba(0, 0, 0, 0.1)");
        setHoverColor("");
        // Advanced defaults
        setOpacity(100);
        // Badge defaults
        setBadgeColor("#ffffff");
        setBadgeBgColor("rgba(255, 255, 255, 0.2)");
        setBadgeBgOpacity(20);
        setBadgeBorderColor("rgba(255, 255, 255, 0.3)");
        setBadgeBorderOpacity(30);
        // Action button colors defaults
        setSettingsButtonHoverColor("#ffffff");
        setAddToCanvasButtonHoverColor("#dbeafe");
        setAddToCanvasButtonIconColor("#2563eb");
        setDuplicateButtonHoverColor("#dcfce7");
        setDuplicateButtonIconColor("#16a34a");
      }
    }
  }, [initialData, isOpen]);

  // Live update effect - debounced updates to parent for real-time preview
  useEffect(() => {
    if (!onLiveUpdate || !isOpen) return;
    
    const timeoutId = setTimeout(() => {
      const liveData: any = {
        label: label.trim() || initialData.label || "",
        color: selectedColor,
        icon: selectedIcon,
        iconColor: selectedIcon ? iconColor : undefined,
        borderColor,
        borderWidth,
        borderRadius,
        // Typography
        fontFamily,
        fontSize,
        fontWeight,
        textColor,
        textAlign,
        // Button styling
        paddingX,
        paddingY,
        shadow,
        shadowColor,
        hoverColor: hoverColor || undefined,
        // Advanced
        opacity,
        // Preserve isSystem flag
        isSystem: initialData?.isSystem || false,
        // Badge colors (for System badge)
        badgeColor: initialData?.isSystem ? badgeColor : undefined,
        badgeBgColor: initialData?.isSystem ? badgeBgColor : undefined,
        badgeBorderColor: initialData?.isSystem ? badgeBorderColor : undefined,
        // Action button colors (for TagDrawer buttons)
        settingsButtonHoverColor: nodeType === "tag" ? settingsButtonHoverColor : undefined,
        addToCanvasButtonHoverColor: nodeType === "tag" ? addToCanvasButtonHoverColor : undefined,
        addToCanvasButtonIconColor: nodeType === "tag" ? addToCanvasButtonIconColor : undefined,
        duplicateButtonHoverColor: nodeType === "tag" ? duplicateButtonHoverColor : undefined,
        duplicateButtonIconColor: nodeType === "tag" ? duplicateButtonIconColor : undefined,
      };

      // Add tag behavior config if it's a tag node
      if (nodeType === "tag" && tagTemplate) {
        liveData.tagConfig = {
          template: tagTemplate,
          autoAction: autoAction || (tagTemplate === "INVALID" || tagTemplate === "WRONG_NUMBER" ? "CLOSE" : tagTemplate === "CONNECTED_FLOW" ? "FOLLOWUP" : "CALLBACK"),
          closeReason: tagTemplate === "WRONG_NUMBER" ? "WRONG_NUMBER" : undefined,
          requiresCallback: tagTemplate === "WRONG_NUMBER" ? false : undefined,
          exhaustPolicy: tagTemplate === "WRONG_NUMBER" ? { markExhausted: true, exhaustReason: "WRONG_NUMBER", seniorNotify: true } : undefined,
          retryPolicy: tagTemplate === "NO_ANSWER" ? {
            maxAttempts,
            attemptTimings: {
              attempt1,
              attempt2,
              attempt3,
            },
            attemptCountSource: "tagHistory",
          } : undefined,
          overduePolicy: (tagTemplate === "NO_ANSWER" || tagTemplate === "BUSY" || tagTemplate === "SWITCH_OFF") ? {
            popupAtSeconds,
            remindAtMinutes: remindAtMinutes.split(",").map(m => parseInt(m.trim())).filter(m => !isNaN(m)),
            escalateAtHours,
          } : undefined,
          bucketTarget,
        };
      }

      onLiveUpdate(liveData);
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [
    label, selectedColor, selectedIcon, iconColor, borderColor, borderWidth, borderRadius,
    fontFamily, fontSize, fontWeight, textColor, textAlign,
    paddingX, paddingY, shadow, shadowColor, hoverColor, opacity,
    badgeColor, badgeBgColor, badgeBorderColor,
    nodeType, tagTemplate, autoAction, maxAttempts, attempt1, attempt2, attempt3,
    popupAtSeconds, remindAtMinutes, escalateAtHours, bucketTarget,
    categoryTextColor, categoryTextOpacity, categoryTextFontWeight, categoryTextFontSize, showConnectedLabel,
    settingsButtonHoverColor, addToCanvasButtonHoverColor, addToCanvasButtonIconColor,
    duplicateButtonHoverColor, duplicateButtonIconColor,
    isOpen, initialData, onLiveUpdate
  ]);

  const handleSave = () => {
    if (label.trim()) {
      const saveData: any = {
        label: label.trim(),
        color: selectedColor,
        icon: selectedIcon,
        iconColor: selectedIcon ? iconColor : undefined,
        borderColor,
        borderWidth,
        borderRadius,
        // Typography
        fontFamily,
        fontSize,
        fontWeight,
        textColor,
        textAlign,
        // Button styling
        paddingX,
        paddingY,
        shadow,
        shadowColor,
        hoverColor: hoverColor || undefined,
        // Advanced
        opacity,
        // Preserve isSystem flag - don't allow manual tags to become system tags
        isSystem: initialData?.isSystem || false,
        // Badge colors (for System badge)
        badgeColor: initialData?.isSystem ? badgeColor : undefined,
        badgeBgColor: initialData?.isSystem ? badgeBgColor : undefined,
        badgeBorderColor: initialData?.isSystem ? badgeBorderColor : undefined,
        // Category text settings (for tag nodes)
        categoryTextColor: nodeType === "tag" ? categoryTextColor : undefined,
        categoryTextOpacity: nodeType === "tag" ? categoryTextOpacity : undefined,
        categoryTextFontWeight: nodeType === "tag" ? categoryTextFontWeight : undefined,
        categoryTextFontSize: nodeType === "tag" ? categoryTextFontSize : undefined,
        showConnectedLabel: nodeType === "tag" ? showConnectedLabel : undefined,
        // Action button colors (for TagDrawer buttons)
        settingsButtonHoverColor: nodeType === "tag" ? settingsButtonHoverColor : undefined,
        addToCanvasButtonHoverColor: nodeType === "tag" ? addToCanvasButtonHoverColor : undefined,
        addToCanvasButtonIconColor: nodeType === "tag" ? addToCanvasButtonIconColor : undefined,
        duplicateButtonHoverColor: nodeType === "tag" ? duplicateButtonHoverColor : undefined,
        duplicateButtonIconColor: nodeType === "tag" ? duplicateButtonIconColor : undefined,
      };

      // Add tag behavior config if it's a tag node
      if (nodeType === "tag" && tagTemplate) {
        saveData.tagConfig = {
          template: tagTemplate,
          autoAction: autoAction || (tagTemplate === "INVALID" || tagTemplate === "WRONG_NUMBER" ? "CLOSE" : tagTemplate === "CONNECTED_FLOW" ? "FOLLOWUP" : "CALLBACK"),
          closeReason: tagTemplate === "WRONG_NUMBER" ? "WRONG_NUMBER" : undefined,
          requiresCallback: tagTemplate === "WRONG_NUMBER" ? false : undefined,
          exhaustPolicy: tagTemplate === "WRONG_NUMBER" ? { markExhausted: true, exhaustReason: "WRONG_NUMBER", seniorNotify: true } : undefined,
          retryPolicy: tagTemplate === "NO_ANSWER" ? {
            maxAttempts,
            attemptTimings: {
              attempt1,
              attempt2,
              attempt3,
            },
            attemptCountSource: "tagHistory",
          } : undefined,
          overduePolicy: (tagTemplate === "NO_ANSWER" || tagTemplate === "BUSY" || tagTemplate === "SWITCH_OFF") ? {
            popupAtSeconds,
            remindAtMinutes: remindAtMinutes.split(",").map(m => parseInt(m.trim())).filter(m => !isNaN(m)),
            escalateAtHours,
          } : undefined,
          bucketTarget,
        };
      }

      onSave(saveData);
      // Don't reset if editing, only reset on close
      onClose();
    }
  };

  return (
    <>
      {/* Main Drawer */}
      <div
        className={`w-96 bg-white border border-gray-200 rounded-lg shadow-2xl transition-all duration-300 ease-in-out flex flex-col ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{ 
          maxHeight: "calc(100vh - 170px)",
          height: "auto"
        }}
      >
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-200 bg-gradient-to-r from-primary-50 to-primary-100 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-600 rounded-lg">
            <div className="w-3 h-3 rounded-full bg-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {initialData ? "Edit Button" : "Create Button"}
            </h2>
            <p className="text-xs text-gray-600">
              {initialData ? "Update your button configuration" : "Configure your new button"}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/50 rounded-lg transition-colors"
        >
          <X className="h-5 w-5 text-gray-600" />
        </button>
      </div>

      {/* Content - Scrollable */}
      <div 
        className="overflow-y-auto overflow-x-hidden p-4 space-y-6 flex-1 custom-scrollbar"
        style={{
          maxHeight: "calc(100vh - 350px)",
        }}
      >
        {/* Label */}
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
            <Type className="h-4 w-4" />
            Label
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Enter button label"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        {/* Button Background Color */}
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
            <Palette className="h-4 w-4" />
            Button Background Color
          </label>
          <div className="space-y-3">
            {/* Preset Colors */}
            <div className="grid grid-cols-4 gap-2">
              {colorOptions.map((color) => (
                <button
                  key={color.value}
                  onClick={() => {
                    setSelectedColor(color.value);
                    setCustomColor(color.value);
                  }}
                  className={`h-10 rounded-lg border-2 transition-all ${
                    selectedColor === color.value
                      ? "border-primary-600 ring-2 ring-primary-200"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                >
                  {selectedColor === color.value && (
                    <Check className="h-5 w-5 text-white mx-auto" />
                  )}
                </button>
              ))}
            </div>
            {/* Custom Color */}
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={customColor}
                onChange={(e) => {
                  setCustomColor(e.target.value);
                  setSelectedColor(e.target.value);
                }}
                className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={customColor}
                onChange={(e) => {
                  setCustomColor(e.target.value);
                  setSelectedColor(e.target.value);
                }}
                placeholder="#3b82f6"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Icon Color - Only show if icon is selected */}
        {selectedIcon && (
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
              <Image className="h-4 w-4" />
              Icon Color
            </label>
            <div className="space-y-3">
              {/* Preset Colors for Icon */}
              <div className="grid grid-cols-4 gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={`icon-${color.value}`}
                    onClick={() => setIconColor(color.value)}
                    className={`h-10 rounded-lg border-2 transition-all ${
                      iconColor === color.value
                        ? "border-primary-600 ring-2 ring-primary-200"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  >
                    {iconColor === color.value && (
                      <Check className="h-5 w-5 text-white mx-auto" />
                    )}
                  </button>
                ))}
              </div>
              {/* Custom Icon Color */}
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={iconColor}
                  onChange={(e) => setIconColor(e.target.value)}
                  className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={iconColor}
                  onChange={(e) => setIconColor(e.target.value)}
                  placeholder="#ffffff"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Badge Color (only for System tags) */}
        {initialData?.isSystem === true && (
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
              <Palette className="h-4 w-4" />
              System Badge Color
            </label>
            <div className="space-y-3">
              {/* Badge Text Color */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Badge Text Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={badgeColor}
                    onChange={(e) => setBadgeColor(e.target.value)}
                    className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={badgeColor}
                    onChange={(e) => setBadgeColor(e.target.value)}
                    placeholder="#ffffff"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
              {/* Badge Background Color */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Badge Background (with opacity)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={(() => {
                      const match = badgeBgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                      if (match) {
                        const r = parseInt(match[1]);
                        const g = parseInt(match[2]);
                        const b = parseInt(match[3]);
                        return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
                      }
                      return "#ffffff";
                    })()}
                    onChange={(e) => {
                      const hex = e.target.value;
                      const r = parseInt(hex.slice(1, 3), 16);
                      const g = parseInt(hex.slice(3, 5), 16);
                      const b = parseInt(hex.slice(5, 7), 16);
                      const opacity = badgeBgOpacity / 100;
                      setBadgeBgColor(`rgba(${r}, ${g}, ${b}, ${opacity})`);
                    }}
                    className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={badgeBgColor}
                    onChange={(e) => {
                      setBadgeBgColor(e.target.value);
                      const match = e.target.value.match(/rgba?\([^)]+,\s*([\d.]+)\)/);
                      if (match) {
                        setBadgeBgOpacity(parseFloat(match[1]) * 100);
                      }
                    }}
                    placeholder="rgba(255, 255, 255, 0.2)"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                {/* Opacity Slider */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Opacity: {badgeBgOpacity}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={badgeBgOpacity}
                    onChange={(e) => {
                      const opacity = parseFloat(e.target.value);
                      setBadgeBgOpacity(opacity);
                      const match = badgeBgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                      if (match) {
                        const r = parseInt(match[1]);
                        const g = parseInt(match[2]);
                        const b = parseInt(match[3]);
                        setBadgeBgColor(`rgba(${r}, ${g}, ${b}, ${opacity / 100})`);
                      }
                    }}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
              {/* Badge Border Color */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Badge Border (with opacity)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={(() => {
                      const match = badgeBorderColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                      if (match) {
                        const r = parseInt(match[1]);
                        const g = parseInt(match[2]);
                        const b = parseInt(match[3]);
                        return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
                      }
                      return "#ffffff";
                    })()}
                    onChange={(e) => {
                      const hex = e.target.value;
                      const r = parseInt(hex.slice(1, 3), 16);
                      const g = parseInt(hex.slice(3, 5), 16);
                      const b = parseInt(hex.slice(5, 7), 16);
                      const opacity = badgeBorderOpacity / 100;
                      setBadgeBorderColor(`rgba(${r}, ${g}, ${b}, ${opacity})`);
                    }}
                    className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={badgeBorderColor}
                    onChange={(e) => {
                      setBadgeBorderColor(e.target.value);
                      const match = e.target.value.match(/rgba?\([^)]+,\s*([\d.]+)\)/);
                      if (match) {
                        setBadgeBorderOpacity(parseFloat(match[1]) * 100);
                      }
                    }}
                    placeholder="rgba(255, 255, 255, 0.3)"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                {/* Opacity Slider */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Opacity: {badgeBorderOpacity}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={badgeBorderOpacity}
                    onChange={(e) => {
                      const opacity = parseFloat(e.target.value);
                      setBadgeBorderOpacity(opacity);
                      const match = badgeBorderColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                      if (match) {
                        const r = parseInt(match[1]);
                        const g = parseInt(match[2]);
                        const b = parseInt(match[3]);
                        setBadgeBorderColor(`rgba(${r}, ${g}, ${b}, ${opacity / 100})`);
                      }
                    }}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Button Colors (for TagDrawer buttons) - Only for tag nodes */}
        {nodeType === "tag" && (
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
              <Settings className="h-4 w-4" />
              Action Button Colors
            </label>
            <div className="space-y-3">
              {/* Settings Button Hover Color */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Settings Button Hover Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settingsButtonHoverColor}
                    onChange={(e) => setSettingsButtonHoverColor(e.target.value)}
                    className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settingsButtonHoverColor}
                    onChange={(e) => setSettingsButtonHoverColor(e.target.value)}
                    placeholder="#ffffff"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
              {/* Add to Canvas Button Colors */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Add to Canvas Button Hover Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={addToCanvasButtonHoverColor}
                    onChange={(e) => setAddToCanvasButtonHoverColor(e.target.value)}
                    className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={addToCanvasButtonHoverColor}
                    onChange={(e) => setAddToCanvasButtonHoverColor(e.target.value)}
                    placeholder="#dbeafe"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Add to Canvas Button Icon Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={addToCanvasButtonIconColor}
                    onChange={(e) => setAddToCanvasButtonIconColor(e.target.value)}
                    className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={addToCanvasButtonIconColor}
                    onChange={(e) => setAddToCanvasButtonIconColor(e.target.value)}
                    placeholder="#2563eb"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
              {/* Duplicate Button Colors */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Duplicate Button Hover Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={duplicateButtonHoverColor}
                    onChange={(e) => setDuplicateButtonHoverColor(e.target.value)}
                    className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={duplicateButtonHoverColor}
                    onChange={(e) => setDuplicateButtonHoverColor(e.target.value)}
                    placeholder="#dcfce7"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Duplicate Button Icon Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={duplicateButtonIconColor}
                    onChange={(e) => setDuplicateButtonIconColor(e.target.value)}
                    className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={duplicateButtonIconColor}
                    onChange={(e) => setDuplicateButtonIconColor(e.target.value)}
                    placeholder="#16a34a"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Icon Selection */}
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
            <Image className="h-4 w-4" />
            Icon (Optional)
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setSelectedIcon(undefined)}
              className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center justify-center gap-1 ${
                selectedIcon === undefined
                  ? "border-primary-600 bg-primary-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="w-6 h-6 rounded border-2 border-dashed border-gray-400" />
              <span className="text-xs text-gray-600">None</span>
            </button>
            {iconOptions.map((icon) => {
              const getIconComponent = () => {
                switch (icon.value) {
                  case "navigation":
                    return <Navigation className="h-6 w-6" />;
                  case "circle":
                    return <Circle className="h-6 w-6" />;
                  case "tag":
                    return <Tag className="h-6 w-6" />;
                  case "settings":
                    return <Settings className="h-6 w-6" />;
                  case "play":
                    return <Play className="h-6 w-6" />;
                  case "save":
                    return <Save className="h-6 w-6" />;
                  case "phoneoff":
                    return <PhoneOff className="h-6 w-6" />;
                  case "wrongnumber":
                    return <PhoneMissed className="h-6 w-6" />;
                  case "phone":
                    return <Phone className="h-6 w-6" />;
                  case "phonecall":
                    return <PhoneCall className="h-6 w-6" />;
                  case "phoneincoming":
                    return <PhoneIncoming className="h-6 w-6" />;
                  case "phoneoutgoing":
                    return <PhoneOutgoing className="h-6 w-6" />;
                  default:
                    return null;
                }
              };

              return (
                <button
                  key={icon.value}
                  onClick={() => setSelectedIcon(icon.value)}
                  className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center justify-center gap-1 ${
                    selectedIcon === icon.value
                      ? "border-primary-600 bg-primary-50 text-primary-600"
                      : "border-gray-200 hover:border-gray-300 text-gray-600"
                  }`}
                >
                  {getIconComponent()}
                  <span className="text-xs">{icon.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Typography Settings */}
        <div className="space-y-4 border-t border-gray-200 pt-4">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Type className="h-4 w-4" />
            Typography
          </h3>
          
          {/* Font Family */}
          <div>
            <label className="text-sm font-semibold text-gray-900 mb-2 block">Font Family</label>
            <select
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              {fontFamilyOptions.map((font) => (
                <option key={font.value} value={font.value}>
                  {font.name}
                </option>
              ))}
            </select>
          </div>

          {/* Font Size */}
          <div>
            <label className="text-sm font-semibold text-gray-900 mb-2 block">
              Font Size: {fontSize}px
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFontSize(Math.max(8, fontSize - 1))}
                className="p-1.5 border border-gray-300 rounded hover:bg-gray-50"
              >
                <Minus className="h-4 w-4" />
              </button>
              <input
                type="range"
                min="8"
                max="32"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="flex-1"
              />
              <button
                onClick={() => setFontSize(Math.min(32, fontSize + 1))}
                className="p-1.5 border border-gray-300 rounded hover:bg-gray-50"
              >
                <Plus className="h-4 w-4" />
              </button>
              <input
                type="number"
                min="8"
                max="32"
                value={fontSize}
                onChange={(e) => setFontSize(Math.max(8, Math.min(32, Number(e.target.value))))}
                className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
              />
            </div>
          </div>

          {/* Font Weight */}
          <div>
            <label className="text-sm font-semibold text-gray-900 mb-2 block">Font Weight</label>
            <div className="grid grid-cols-4 gap-2">
              {fontWeightOptions.map((weight) => (
                <button
                  key={weight.value}
                  onClick={() => setFontWeight(weight.value)}
                  className={`px-3 py-2 rounded-lg border-2 text-sm transition-all ${
                    fontWeight === weight.value
                      ? "border-primary-600 bg-primary-50 text-primary-700"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  style={{ fontWeight: weight.value }}
                >
                  {weight.name}
                </button>
              ))}
            </div>
          </div>

          {/* Text Color */}
          <div>
            <label className="text-sm font-semibold text-gray-900 mb-2 block">Text Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                placeholder="#ffffff"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Text Align */}
          <div>
            <label className="text-sm font-semibold text-gray-900 mb-2 block">Text Alignment</label>
            <div className="flex gap-2">
              <button
                onClick={() => setTextAlign("left")}
                className={`flex-1 px-3 py-2 rounded-lg border-2 transition-all ${
                  textAlign === "left"
                    ? "border-primary-600 bg-primary-50 text-primary-700"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <AlignLeft className="h-4 w-4 mx-auto" />
              </button>
              <button
                onClick={() => setTextAlign("center")}
                className={`flex-1 px-3 py-2 rounded-lg border-2 transition-all ${
                  textAlign === "center"
                    ? "border-primary-600 bg-primary-50 text-primary-700"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <AlignCenter className="h-4 w-4 mx-auto" />
              </button>
              <button
                onClick={() => setTextAlign("right")}
                className={`flex-1 px-3 py-2 rounded-lg border-2 transition-all ${
                  textAlign === "right"
                    ? "border-primary-600 bg-primary-50 text-primary-700"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <AlignRight className="h-4 w-4 mx-auto" />
              </button>
            </div>
          </div>
        </div>

        {/* Button Styling */}
        <div className="space-y-4 border-t border-gray-200 pt-4">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-600" />
            Button Styling
          </h3>

          {/* Padding */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold text-gray-900 mb-2 block">
                Padding X: {paddingX}px
              </label>
              <input
                type="range"
                min="4"
                max="48"
                value={paddingX}
                onChange={(e) => setPaddingX(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-900 mb-2 block">
                Padding Y: {paddingY}px
              </label>
              <input
                type="range"
                min="4"
                max="48"
                value={paddingY}
                onChange={(e) => setPaddingY(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          {/* Hover Color */}
          <div>
            <label className="text-sm font-semibold text-gray-900 mb-2 block">Hover Color (Optional)</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={hoverColor || selectedColor}
                onChange={(e) => setHoverColor(e.target.value)}
                className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={hoverColor}
                onChange={(e) => setHoverColor(e.target.value)}
                placeholder="Auto (darker shade)"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Shadow */}
          <div>
            <label className="flex items-center justify-between text-sm font-semibold text-gray-900 mb-2">
              <span>Shadow</span>
              <input
                type="checkbox"
                checked={shadow}
                onChange={(e) => setShadow(e.target.checked)}
                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
            </label>
            {shadow && (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="color"
                  value={shadowColor}
                  onChange={(e) => setShadowColor(e.target.value)}
                  className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={shadowColor}
                  onChange={(e) => setShadowColor(e.target.value)}
                  placeholder="rgba(0, 0, 0, 0.1)"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* Border Settings */}
        <div className="space-y-4 border-t border-gray-200 pt-4">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-600" />
            Border
          </h3>
          <div>
            <label className="text-sm font-semibold text-gray-900 mb-2 block">
              Border Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={borderColor}
                onChange={(e) => setBorderColor(e.target.value)}
                className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={borderColor}
                onChange={(e) => setBorderColor(e.target.value)}
                placeholder="#e5e7eb"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-900 mb-2 block">
              Border Width: {borderWidth}px
            </label>
            <input
              type="range"
              min="0"
              max="8"
              value={borderWidth}
              onChange={(e) => setBorderWidth(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-900 mb-2 block">
              Border Radius: {borderRadius}px
            </label>
            <input
              type="range"
              min="0"
              max="20"
              value={borderRadius}
              onChange={(e) => setBorderRadius(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        {/* Tag Behavior (only for tag nodes) */}
        {nodeType === "tag" && (
          <div className="space-y-4 border-t border-gray-200 pt-4">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary-600" />
              Tag Behavior
            </h3>

            {/* Template Selector */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
                <Zap className="h-4 w-4" />
                Template (Mandatory)
              </label>
              <select
                value={tagTemplate}
                onChange={(e) => {
                  const template = e.target.value as keyof typeof TEMPLATES;
                  setTagTemplate(template);
                  if (template && TEMPLATES[template]) {
                    const t = TEMPLATES[template];
                    setAutoAction(t.autoAction);
                    if (t.retryPolicy) {
                      setMaxAttempts(t.retryPolicy.maxAttempts);
                      setAttempt1(t.retryPolicy.attemptTimings.attempt1);
                      setAttempt2(t.retryPolicy.attemptTimings.attempt2);
                      setAttempt3(t.retryPolicy.attemptTimings.attempt3);
                    }
                    if (t.overduePolicy) {
                      setPopupAtSeconds(t.overduePolicy.popupAtSeconds);
                      setRemindAtMinutes(t.overduePolicy.remindAtMinutes.join(", "));
                      setEscalateAtHours(t.overduePolicy.escalateAtHours);
                    }
                    setBucketTarget(t.bucketTarget);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              >
                <option value="">Select Template</option>
                <option value="NO_ANSWER">No Answer (auto callback + retries)</option>
                <option value="WRONG_NUMBER">Wrong Number (close + exhaust)</option>
                <option value="BUSY">Busy (short callback)</option>
                <option value="SWITCH_OFF">Switch Off (long callback)</option>
                <option value="INVALID">Invalid (close)</option>
                <option value="CONNECTED_FLOW">Connected Flow (green/followup)</option>
              </select>
            </div>

            {/* Auto Action */}
            {tagTemplate && (
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
                  <div className="w-2 h-2 rounded-full bg-primary-600" />
                  Auto Action (Mandatory)
                </label>
                <select
                  value={autoAction}
                  onChange={(e) => setAutoAction(e.target.value as "CALLBACK" | "FOLLOWUP" | "CLOSE")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                >
                  <option value="CALLBACK">Callback</option>
                  <option value="FOLLOWUP">Followup</option>
                  <option value="CLOSE">Close</option>
                </select>
              </div>
            )}

            {/* Retry Policy (only for NO_ANSWER) */}
            {tagTemplate === "NO_ANSWER" && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Retry Policy
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Attempts
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={maxAttempts}
                      onChange={(e) => setMaxAttempts(parseInt(e.target.value) || 3)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Attempt Timings</label>
                    <input
                      type="text"
                      placeholder="Attempt 1: +60m"
                      value={attempt1}
                      onChange={(e) => setAttempt1(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Attempt 2: Next Day"
                      value={attempt2}
                      onChange={(e) => setAttempt2(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Attempt 3: +48h"
                      value={attempt3}
                      onChange={(e) => setAttempt3(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Overdue Policy (for callback tags) */}
            {(tagTemplate === "NO_ANSWER" || tagTemplate === "BUSY" || tagTemplate === "SWITCH_OFF") && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Overdue Policy (Mandatory for Callback Tags)
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Popup At (seconds)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={popupAtSeconds}
                      onChange={(e) => setPopupAtSeconds(parseInt(e.target.value) || 30)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Remind At (minutes, comma-separated)
                    </label>
                    <input
                      type="text"
                      placeholder="15, 60"
                      value={remindAtMinutes}
                      onChange={(e) => setRemindAtMinutes(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Escalate At (hours)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={escalateAtHours}
                      onChange={(e) => setEscalateAtHours(parseInt(e.target.value) || 24)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Bucket Target */}
            {tagTemplate && (
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
                  <Target className="h-4 w-4" />
                  Bucket Target (Derived)
                </label>
                <select
                  value={bucketTarget}
                  onChange={(e) => setBucketTarget(e.target.value as "fresh" | "green" | "orange" | "red")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                >
                  <option value="fresh">Fresh (Blue)</option>
                  <option value="green">Green (Connected)</option>
                  <option value="orange">Orange (Callback Due)</option>
                  <option value="red">Red (Overdue/Lost)</option>
                </select>
              </div>
            )}
          </div>
        )}

        {/* Category Text Settings (only for tag nodes when connected) */}
        {nodeType === "tag" && (
          <div className="space-y-4 border-t border-gray-200 pt-4">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary-600" />
              Category Text Settings
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              These settings control the text that appears below the tag label when connected to a sub button.
            </p>

            {/* Show Connected Label Toggle */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <input
                  type="checkbox"
                  checked={showConnectedLabel}
                  onChange={(e) => setShowConnectedLabel(e.target.checked)}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                Show Connected Sub Button Label
              </label>
              <p className="text-xs text-gray-500">
                When enabled, shows the connected sub button's label. When disabled, shows the category name.
              </p>
            </div>

            {/* Category Text Color - Live Update from Backend (ANKIT_API_01, ANKIT_API_03) */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Text Color
                {(() => {
                  const actualStatus = getTagActualCallStatus();
                  if (actualStatus.callStatus) {
                    return (
                      <span className="ml-2 text-xs text-gray-500">
                        (Live: {actualStatus.callStatus})
                      </span>
                    );
                  }
                  return null;
                })()}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={categoryTextColor}
                  onChange={(e) => setCategoryTextColor(e.target.value)}
                  className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={categoryTextColor}
                  onChange={(e) => setCategoryTextColor(e.target.value)}
                  placeholder="#ffffff"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                {/* Live Status Indicator */}
                {(() => {
                  const actualStatus = getTagActualCallStatus();
                  if (actualStatus.callStatus) {
                    const statusColor = getCallStatusColor(actualStatus.callStatus);
                    return (
                      <button
                        type="button"
                        onClick={() => setCategoryTextColor(statusColor)}
                        className="px-2 py-1 text-xs bg-primary-50 text-primary-700 border border-primary-200 rounded hover:bg-primary-100 transition-colors"
                        title={`Use live color from callStatus: ${actualStatus.callStatus}`}
                      >
                        Use Live
                      </button>
                    );
                  }
                  return null;
                })()}
              </div>
              {/* Show actual callStatus info */}
              {(() => {
                const actualStatus = getTagActualCallStatus();
                if (actualStatus.callStatus) {
                  const statusColor = getCallStatusColor(actualStatus.callStatus);
                  return (
                    <p className="text-xs text-gray-500 mt-1">
                      Current callStatus: <span style={{ color: statusColor, fontWeight: "600" }}>{actualStatus.callStatus}</span>
                      {actualStatus.callbackAt && (
                        <span className="ml-2">
                          | Callback: {new Date(actualStatus.callbackAt).toLocaleString()}
                        </span>
                      )}
                    </p>
                  );
                }
                return (
                  <p className="text-xs text-gray-500 mt-1">
                    No active leads with this tag. Color will use default.
                  </p>
                );
              })()}
            </div>

            {/* Category Text Font Size */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Font Size: {categoryTextFontSize}px
              </label>
              <input
                type="range"
                min="8"
                max="20"
                value={categoryTextFontSize}
                onChange={(e) => setCategoryTextFontSize(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Category Text Font Weight */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Font Weight</label>
              <select
                value={categoryTextFontWeight}
                onChange={(e) => setCategoryTextFontWeight(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              >
                <option value="400">Normal</option>
                <option value="500">Medium</option>
                <option value="600">Semi Bold</option>
                <option value="700">Bold</option>
              </select>
            </div>

            {/* Category Text Opacity */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Opacity: {categoryTextOpacity}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={categoryTextOpacity}
                onChange={(e) => setCategoryTextOpacity(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* Advanced Settings */}
        <div className="space-y-4 border-t border-gray-200 pt-4">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Advanced</h3>
          
          <div>
            <label className="text-sm font-semibold text-gray-900 mb-2 block">
              Opacity: {opacity}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

      </div>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-2 flex-shrink-0">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!label.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {initialData ? "Update Button" : "Create Button"}
        </button>
      </div>
    </div>

    {/* Preview Panel - Separate on the side */}
    {isOpen && (
      <div
        className="fixed w-80 bg-white border border-gray-200 rounded-lg shadow-2xl z-[71]"
        style={{
          left: "1060px", // 660px (drawer) + 384px (drawer width) + 16px (gap)
          top: "150px",
          maxHeight: "calc(100vh - 170px)",
        }}
      >
        {/* Preview Header */}
        <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-green-50 to-green-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-green-600 rounded">
              <div className="w-2 h-2 rounded-full bg-white" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">Live Preview</h3>
          </div>
        </div>

        {/* Preview Content */}
        <div className="p-6 bg-gray-50 min-h-[200px] flex items-center justify-center">
          <div className="w-full">
            <p className="text-xs text-gray-500 mb-3 text-center">Button Preview</p>
            <div className="flex justify-center">
              <button
                className="transition-all flex items-center gap-2"
                style={{
                  backgroundColor: selectedColor,
                  color: textColor,
                  fontFamily: fontFamily,
                  fontSize: `${fontSize}px`,
                  fontWeight: fontWeight,
                  textAlign: textAlign,
                  padding: `${paddingY}px ${paddingX}px`,
                  borderColor: borderColor,
                  borderWidth: `${borderWidth}px`,
                  borderRadius: `${borderRadius}px`,
                  borderStyle: "solid",
                  boxShadow: shadow ? `0 2px 4px ${shadowColor}` : "none",
                  opacity: opacity / 100,
                  cursor: "default",
                  minWidth: "120px",
                  justifyContent: textAlign === "center" ? "center" : textAlign === "right" ? "flex-end" : "flex-start",
                }}
              >
                {selectedIcon && (() => {
                  switch (selectedIcon) {
                    case "navigation":
                      return <Navigation className="h-4 w-4" style={{ color: iconColor }} />;
                    case "circle":
                      return <Circle className="h-4 w-4" style={{ color: iconColor }} />;
                    case "tag":
                      return <Tag className="h-4 w-4" style={{ color: iconColor }} />;
                    case "settings":
                      return <Settings className="h-4 w-4" style={{ color: iconColor }} />;
                    case "play":
                      return <Play className="h-4 w-4" style={{ color: iconColor }} />;
                    case "save":
                      return <Save className="h-4 w-4" style={{ color: iconColor }} />;
                    case "phoneoff":
                      return <PhoneOff className="h-4 w-4" style={{ color: iconColor }} />;
                    case "wrongnumber":
                      return <PhoneMissed className="h-4 w-4" style={{ color: iconColor }} />;
                    case "phone":
                      return <Phone className="h-4 w-4" style={{ color: iconColor }} />;
                    case "phonecall":
                      return <PhoneCall className="h-4 w-4" style={{ color: iconColor }} />;
                    case "phoneincoming":
                      return <PhoneIncoming className="h-4 w-4" style={{ color: iconColor }} />;
                    case "phoneoutgoing":
                      return <PhoneOutgoing className="h-4 w-4" style={{ color: iconColor }} />;
                    default:
                      return null;
                  }
                })()}
                <span>{label || "Button Preview"}</span>
                {initialData?.isSystem === true && (
                  <span 
                    className="px-1.5 py-0.5 text-xs font-medium rounded border"
                    style={{
                      backgroundColor: badgeBgColor,
                      color: badgeColor,
                      borderColor: badgeBorderColor,
                    }}
                  >
                    System
                  </span>
                )}
              </button>
            </div>
            
            {/* Preview Info */}
            <div className="mt-4 p-3 bg-white rounded border border-gray-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">Label:</span>
                <span className="font-medium">{label || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Icon:</span>
                <span className="font-medium">{selectedIcon ? iconOptions.find(i => i.value === selectedIcon)?.name || selectedIcon : "None"}</span>
              </div>
              {selectedIcon && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Icon Color:</span>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded border border-gray-300" style={{ backgroundColor: iconColor }}></div>
                    <span className="font-medium text-[10px]">{iconColor}</span>
                  </div>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Background:</span>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded border border-gray-300" style={{ backgroundColor: selectedColor }}></div>
                  <span className="font-medium text-[10px]">{selectedColor}</span>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Text Color:</span>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded border border-gray-300" style={{ backgroundColor: textColor }}></div>
                  <span className="font-medium text-[10px]">{textColor}</span>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Font:</span>
                <span className="font-medium">{fontFamily.split(',')[0]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Size:</span>
                <span className="font-medium">{fontSize}px</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Weight:</span>
                <span className="font-medium">{fontWeightOptions.find(w => w.value === fontWeight)?.name || fontWeight}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Align:</span>
                <span className="font-medium capitalize">{textAlign}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Padding:</span>
                <span className="font-medium">{paddingX}px × {paddingY}px</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Border:</span>
                <span className="font-medium">{borderWidth}px / {borderRadius}px</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Shadow:</span>
                <span className="font-medium">{shadow ? "Yes" : "No"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Opacity:</span>
                <span className="font-medium">{opacity}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
