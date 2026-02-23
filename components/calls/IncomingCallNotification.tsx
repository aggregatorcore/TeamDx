"use client";

import { useState, useEffect } from "react";
import { PhoneIncoming, X, User, Phone } from "lucide-react";
import { callService, Call } from "@/lib/services/callService";
import { apiClient } from "@/lib/api";

export default function IncomingCallNotification() {
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Subscribe to incoming calls
    const unsubscribe = callService.subscribeToIncomingCalls((call) => {
      setIncomingCall(call);
      if (call) {
        // Try to find lead by phone number
        findLeadByPhone(call.phoneNumber);
      }
    });

    return () => unsubscribe();
  }, []);

  const findLeadByPhone = async (phoneNumber: string) => {
    try {
      setLoading(true);
      // Search for lead by phone number
      const response = await apiClient.getLeads();
      if (response.leads && response.leads.length > 0) {
        // Filter by phone number
        const matchingLead = response.leads.find(
          (lead: any) => lead.phone === phoneNumber || lead.phone?.replace(/[^0-9]/g, "") === phoneNumber.replace(/[^0-9]/g, "")
        );
        if (matchingLead) {
          setLead(matchingLead);
        }
      }
    } catch (error) {
      console.error("Error finding lead:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setIncomingCall(null);
    setLead(null);
  };

  if (!incomingCall) return null;

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in">
      <div className="bg-white rounded-lg shadow-xl border-2 border-green-500 p-6 min-w-[320px] max-w-md">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 rounded-full p-3">
              <PhoneIncoming className="h-6 w-6 text-green-600 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900">Incoming Call</h3>
              <p className="text-sm text-gray-600">{incomingCall.phoneNumber}</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {lead ? (
          <div className="bg-blue-50 rounded-lg p-3 mb-3">
            <div className="flex items-center gap-2 mb-1">
              <User className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-900">
                {lead.firstName} {lead.lastName}
              </span>
            </div>
            <p className="text-xs text-blue-700">Lead #{lead.leadId || lead.id}</p>
          </div>
        ) : (
          <div className="bg-yellow-50 rounded-lg p-3 mb-3">
            <p className="text-sm text-yellow-800">
              New number - Lead not found in system
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => {
              if (lead) {
                window.open(`/dashboard/leads/${lead.id}`, "_blank");
              }
              handleDismiss();
            }}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            disabled={!lead}
          >
            {lead ? "Open Lead" : "Create Lead"}
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

