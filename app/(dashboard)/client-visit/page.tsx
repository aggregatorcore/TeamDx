"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  UserPlus, 
  ArrowLeft, 
  Calendar, 
  Clock, 
  User, 
  Mail, 
  Phone, 
  FileText, 
  CheckCircle2,
  AlertCircle,
  X,
  LogOut,
  Loader2,
  Edit,
  Trash2
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { tabStorage } from "@/lib/storage";

interface ClientVisitFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  visitDate: string;
  visitTime: string;
  purpose: string;
  assignedTo: string;
  notes: string;
}

interface ClientVisitEntry {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  visitDate: string;
  visitTime: string;
  inTime: string;
  outTime?: string | null;
  purpose: string;
  assignedTo?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  notes: string | null;
  createdAt: string;
}

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export default function ClientVisitPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [entries, setEntries] = useState<ClientVisitEntry[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [updatingOutTime, setUpdatingOutTime] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<ClientVisitEntry | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  // Initialize with current time and date
  const getCurrentTime = () => new Date().toTimeString().slice(0, 5);
  const getCurrentDate = () => new Date().toISOString().split("T")[0];
  
  // Get user role from storage
  useEffect(() => {
    const userStr = tabStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setUserRole(user.role?.name || null);
      } catch (e) {
        console.error("Error parsing user data:", e);
      }
    }
  }, []);
  
  // Load entries from API on mount
  useEffect(() => {
    fetchVisits();
    // Only fetch staff if user is RECEPTIONIST (for form assignment)
    if (userRole === "RECEPTIONIST") {
      fetchStaff();
    }
  }, [userRole]);

  const fetchVisits = async () => {
    try {
      setInitialLoading(true);
      const today = getCurrentDate();
      const response = await apiClient.getClientVisits({ date: today });
      const visits = response.visits || [];
      
      // Transform API response to match our interface
      const transformedVisits: ClientVisitEntry[] = visits.map((visit: any) => ({
        id: visit.id,
        firstName: visit.firstName,
        lastName: visit.lastName,
        email: visit.email,
        phone: visit.phone,
        visitDate: visit.visitDate ? new Date(visit.visitDate).toISOString().split("T")[0] : getCurrentDate(),
        visitTime: visit.inTime ? new Date(visit.inTime).toTimeString().slice(0, 5) : "",
        inTime: visit.inTime ? new Date(visit.inTime).toTimeString().slice(0, 5) : "",
        outTime: visit.outTime ? new Date(visit.outTime).toTimeString().slice(0, 5) : null,
        purpose: visit.purpose,
        assignedTo: visit.assignedTo,
        notes: visit.notes,
        createdAt: visit.createdAt,
      }));
      
      setEntries(transformedVisits);
    } catch (err: any) {
      console.error("Error loading visits:", err);
      if (err.status === 401 || err.status === 403) {
        tabStorage.removeItem("token");
        tabStorage.removeItem("user");
        router.push("/login");
        return;
      }
      setError(err.message || "Failed to load visits");
    } finally {
      setInitialLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const response = await apiClient.getStaff({ role: "COUNSELOR" });
      setStaff(response.staff || []);
    } catch (err) {
      console.error("Error loading staff:", err);
    }
  };

  const [formData, setFormData] = useState<ClientVisitFormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    visitDate: getCurrentDate(),
    visitTime: getCurrentTime(),
    purpose: "",
    assignedTo: "",
    notes: "",
  });

  // Update visit time and date every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setFormData(prev => ({ 
        ...prev, 
        visitTime: getCurrentTime(),
        visitDate: getCurrentDate()
      }));
    }, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Prepare API payload
      const visitDate = formData.visitDate || getCurrentDate();
      const inTime = formData.visitTime || getCurrentTime();
      
      // Combine date and time for inTime
      const inTimeDateTime = new Date(`${visitDate}T${inTime}`).toISOString();
      
      if (editingEntry) {
        // Update existing entry
        await apiClient.updateClientVisit(editingEntry.id, {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email || undefined,
          phone: formData.phone,
          visitDate: visitDate,
          inTime: inTimeDateTime,
          purpose: formData.purpose,
          assignedToId: formData.assignedTo || undefined,
          notes: formData.notes || undefined,
        });
        setSuccess(true);
        setEditingEntry(null);
      } else {
        // Create new entry
        await apiClient.createClientVisit({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email || undefined,
          phone: formData.phone,
          visitDate: visitDate,
          inTime: inTime,
          purpose: formData.purpose,
          assignedToId: formData.assignedTo || undefined,
          notes: formData.notes || undefined,
        });
        setSuccess(true);
      }
      
      // Refresh visits list
      await fetchVisits();
      
      // Reset form with current time and date
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        visitDate: getCurrentDate(),
        visitTime: getCurrentTime(),
        purpose: "",
        assignedTo: "",
        notes: "",
      });
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err: any) {
      if (err.status === 401 || err.status === 403) {
        tabStorage.removeItem("token");
        tabStorage.removeItem("user");
        router.push("/login");
        return;
      }
      setError(err.message || "Failed to save visit. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOutTime = async (entryId: string) => {
    try {
      setUpdatingOutTime(entryId);
      setError(null);
      const now = new Date();
      // Send full ISO date-time string, not just time
      const outTimeISO = now.toISOString();
      
      await apiClient.updateClientVisit(entryId, {
        outTime: outTimeISO,
      });
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      
      // Refresh visits list
      await fetchVisits();
    } catch (err: any) {
      console.error("Failed to update out time:", err);
      setError(err.message || "Failed to update out time");
      if (err.status === 401 || err.status === 403) {
        tabStorage.removeItem("token");
        tabStorage.removeItem("user");
        router.push("/login");
      }
    } finally {
      setUpdatingOutTime(null);
    }
  };

  const handleEdit = (entry: ClientVisitEntry) => {
    setEditingEntry(entry);
    setFormData({
      firstName: entry.firstName,
      lastName: entry.lastName,
      email: entry.email || "",
      phone: entry.phone,
      visitDate: entry.visitDate ? new Date(entry.visitDate).toISOString().split("T")[0] : getCurrentDate(),
      visitTime: entry.inTime ? new Date(entry.inTime).toTimeString().slice(0, 5) : "",
      purpose: entry.purpose,
      assignedTo: entry.assignedTo?.id || "",
      notes: entry.notes || "",
    });
    // Scroll to form
    setTimeout(() => {
      const formElement = document.querySelector('form');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleDelete = async (entryId: string) => {
    if (!confirm("Are you sure you want to delete this visit entry?")) {
      return;
    }

    try {
      setDeletingEntryId(entryId);
      await apiClient.deleteClientVisit(entryId);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await fetchVisits();
    } catch (err: any) {
      setError(err.message || "Failed to delete visit entry");
    } finally {
      setDeletingEntryId(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingEntry(null);
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      visitDate: getCurrentDate(),
      visitTime: getCurrentTime(),
      purpose: "",
      assignedTo: "",
      notes: "",
    });
  };

  return (
    <div className="w-full">
      <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm md:text-base"
        >
          <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
          <span>Back</span>
        </button>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <UserPlus className="h-7 w-7 md:h-8 md:w-8 text-primary-600" />
            Visit Entry
          </h1>
          <p className="text-sm md:text-base text-gray-600">
            {userRole === "RECEPTIONIST" 
              ? "Record all types of visits: job interviews, delivery, counseling, consultations, etc."
              : "View and manage all visit entries recorded by reception"}
          </p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 animate-pulse">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-green-600 border-t-transparent flex-shrink-0"></div>
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
            <p className="text-green-800 font-medium">Visit recorded successfully! Scrolling to entry...</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <p className="text-red-800">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto p-1 hover:bg-red-100 rounded"
            >
              <X className="h-4 w-4 text-red-600" />
            </button>
          </div>
        )}

        {/* Entry Cards */}
        {initialLoading ? (
          <div className="mb-6 flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading visits...</p>
            </div>
          </div>
        ) : entries.length > 0 ? (
          <div className="mb-6">
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4">
              Today's Visit Entries ({entries.length})
            </h2>
            <div className="space-y-3">
              {entries.map((entry) => (
                <div
                  id={`entry-${entry.id}`}
                  key={entry.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-5 transition-all duration-300"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="h-5 w-5 text-primary-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-base md:text-lg font-semibold text-gray-900">
                            {entry.firstName} {entry.lastName}
                          </h3>
                          <div className="flex flex-wrap gap-2 mt-1 text-sm text-gray-600">
                            {entry.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-4 w-4" />
                                {entry.email}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Phone className="h-4 w-4" />
                              {entry.phone}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-gray-500">Purpose</p>
                          <p className="font-medium text-gray-900 capitalize">{entry.purpose.replace("-", " ")}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">In Time</p>
                          <p className="font-medium text-gray-900">{entry.inTime || entry.visitTime}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Entry Time</p>
                          <p className="font-medium text-gray-900">
                            {entry.createdAt ? new Date(entry.createdAt).toLocaleTimeString() : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Out Time</p>
                          {entry.outTime ? (
                            <p className="font-medium text-green-600">{entry.outTime}</p>
                          ) : (
                            <button
                              onClick={() => handleOutTime(entry.id)}
                              disabled={updatingOutTime === entry.id}
                              className="text-xs text-primary-600 hover:text-primary-700 font-medium underline disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              {updatingOutTime === entry.id ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Setting...
                                </>
                              ) : (
                                "Set now"
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                      {entry.assignedTo && (
                        <div className="mt-2 text-sm">
                          <span className="text-gray-500">Assigned to: </span>
                          <span className="font-medium text-gray-900">
                            {entry.assignedTo.firstName} {entry.assignedTo.lastName}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Admin controls - Edit and Delete buttons */}
                      {userRole === "ADMIN" && (
                        <>
                          <button
                            onClick={() => handleEdit(entry)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Entry"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            disabled={deletingEntryId === entry.id}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete Entry"
                          >
                            {deletingEntryId === entry.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </>
                      )}
                      {/* Set Out Time button - visible to all */}
                      {!entry.outTime ? (
                        <button
                          onClick={() => handleOutTime(entry.id)}
                          disabled={updatingOutTime === entry.id}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm md:text-base font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {updatingOutTime === entry.id ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Setting...
                            </>
                          ) : (
                            <>
                              <Clock className="h-4 w-4" />
                              Set Out Time
                            </>
                          )}
                        </button>
                      ) : (
                        <div className="px-4 py-2 bg-green-50 text-green-700 rounded-lg text-sm md:text-base font-medium flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" />
                          Completed
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-6 p-8 bg-gray-50 rounded-lg text-center">
            <UserPlus className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No visits recorded for today</p>
          </div>
        )}

        {/* Form - Only visible to RECEPTIONIST */}
        {userRole === "RECEPTIONIST" && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6 lg:p-8">
            {editingEntry && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                <p className="text-blue-800 text-sm font-medium">Editing: {editingEntry.firstName} {editingEntry.lastName}</p>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Cancel Edit
                </button>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6">
            {/* Client Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
              <div>
                <label className="block text-sm md:text-base font-medium text-gray-700 mb-2">
                  First Name *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    className="w-full pl-10 pr-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm md:text-base"
                    placeholder="Enter first name"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm md:text-base font-medium text-gray-700 mb-2">
                  Last Name *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    className="w-full pl-10 pr-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm md:text-base"
                    placeholder="Enter last name"
                  />
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
              <div>
                <label className="block text-sm md:text-base font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full pl-10 pr-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm md:text-base"
                    placeholder="client@example.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm md:text-base font-medium text-gray-700 mb-2">
                  Phone Number *
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="w-full pl-10 pr-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm md:text-base"
                    placeholder="+1 234 567 8900"
                  />
                </div>
              </div>
            </div>

            {/* Visit Date & Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
              <div>
                <label className="block text-sm md:text-base font-medium text-gray-700 mb-2">
                  Visit Date *
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="date"
                    required
                    value={formData.visitDate}
                    onChange={(e) =>
                      setFormData({ ...formData, visitDate: e.target.value })
                    }
                    className="w-full pl-10 pr-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm md:text-base bg-gray-50"
                    readOnly
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Auto-filled with current date</p>
              </div>
              <div>
                <label className="block text-sm md:text-base font-medium text-gray-700 mb-2">
                  Visit Time *
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="time"
                    required
                    value={formData.visitTime}
                    onChange={(e) =>
                      setFormData({ ...formData, visitTime: e.target.value })
                    }
                    className="w-full pl-10 pr-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm md:text-base bg-gray-50"
                    readOnly
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Auto-filled with current time</p>
              </div>
            </div>

            {/* Purpose of Visit */}
            <div>
              <label className="block text-sm md:text-base font-medium text-gray-700 mb-2">
                Purpose of Visit *
              </label>
              <select
                required
                value={formData.purpose}
                onChange={(e) =>
                  setFormData({ ...formData, purpose: e.target.value })
                }
                className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm md:text-base"
              >
                <option value="">Select purpose</option>
                <option value="counseling">Counseling</option>
                <option value="consultation">Consultation</option>
                <option value="job-interview">Job Interview</option>
                <option value="delivery-boy">Delivery Boy</option>
                <option value="follow-up">Follow-up Visit</option>
                <option value="document-submission">Document Submission</option>
                <option value="application-status">Application Status Check</option>
                <option value="payment">Payment</option>
                <option value="meeting">Meeting</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Assigned To */}
            <div>
              <label className="block text-sm md:text-base font-medium text-gray-700 mb-2">
                Assign To Counselor (Optional)
              </label>
              <select
                value={formData.assignedTo}
                onChange={(e) =>
                  setFormData({ ...formData, assignedTo: e.target.value })
                }
                className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm md:text-base"
              >
                <option value="">Select counselor</option>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.firstName} {member.lastName}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm md:text-base font-medium text-gray-700 mb-2">
                Additional Notes (Optional)
              </label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  rows={4}
                  className="w-full pl-10 pr-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm md:text-base resize-none"
                  placeholder="Enter any additional notes or remarks..."
                />
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-4 py-2.5 md:px-6 md:py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm md:text-base font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2.5 md:px-6 md:py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm md:text-base font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{editingEntry ? "Update Visit Entry" : "Save Visit Entry"}</span>
                  </>
                )}
              </button>
            </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

