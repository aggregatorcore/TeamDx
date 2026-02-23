"use client";

import { useState, useEffect } from "react";
import { X, AlertTriangle, UserCheck, Phone, Clock } from "lucide-react";
import { apiClient } from "@/lib/api";

interface EscalationNotificationProps {
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    assignedTo?: {
      id: string;
      firstName: string;
      lastName: string;
    } | null;
    currentTag?: {
      id: string;
      tagFlowId: string;
      callbackAt?: string | null;
      tagFlow?: {
        id: string;
        name: string;
        color: string;
      };
    } | null;
  };
  escalateAtHours: number;
  onClose?: () => void;
  onEscalate?: (leadId: string) => void;
}

export default function EscalationNotification({
  lead,
  escalateAtHours,
  onClose,
  onEscalate,
}: EscalationNotificationProps) {
  const [showEscalation, setShowEscalation] = useState(false);
  const [overdueHours, setOverdueHours] = useState(0);
  const [escalating, setEscalating] = useState(false);

  useEffect(() => {
    if (!lead.currentTag?.callbackAt) return;

    const checkEscalation = () => {
      const callbackTime = new Date(lead.currentTag!.callbackAt!);
      const now = new Date();
      const diff = callbackTime.getTime() - now.getTime();
      
      // Check if overdue and past escalation threshold
      if (diff <= 0) {
        const overdueDuration = Math.abs(diff);
        const overdueHoursValue = Math.floor(overdueDuration / (1000 * 60 * 60));
        setOverdueHours(overdueHoursValue);
        
        if (overdueHoursValue >= escalateAtHours) {
          setShowEscalation(true);
        }
      }
    };

    checkEscalation();
    const interval = setInterval(checkEscalation, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [lead.currentTag?.callbackAt, escalateAtHours]);

  const handleEscalate = async () => {
    setEscalating(true);
    try {
      // TODO: Call escalation API
      // await apiClient.escalateLead(lead.id);
      console.log("Escalating lead:", lead.id);
      
      if (onEscalate) {
        onEscalate(lead.id);
      }
      
      setShowEscalation(false);
      if (onClose) onClose();
    } catch (error) {
      console.error("Error escalating lead:", error);
    } finally {
      setEscalating(false);
    }
  };

  if (!showEscalation || !lead.currentTag?.callbackAt) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-xl border-2 border-red-300 max-w-sm w-full z-50 p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Escalation Required</h4>
            <p className="text-xs text-gray-600">
              {lead.firstName} {lead.lastName}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setShowEscalation(false);
            if (onClose) onClose();
          }}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <Phone className="h-4 w-4 text-gray-400" />
          <span>{lead.phone}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-red-600" />
          <span className="text-red-700 font-medium">
            Overdue by {overdueHours} hour{overdueHours !== 1 ? "s" : ""}
          </span>
        </div>
        {lead.assignedTo && (
          <div className="text-xs text-gray-600">
            Currently assigned to: {lead.assignedTo.firstName} {lead.assignedTo.lastName}
          </div>
        )}
      </div>

      <button
        onClick={handleEscalate}
        disabled={escalating}
        className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {escalating ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            Escalating...
          </>
        ) : (
          <>
            <UserCheck className="h-4 w-4" />
            Escalate to Manager
          </>
        )}
      </button>
    </div>
  );
}
