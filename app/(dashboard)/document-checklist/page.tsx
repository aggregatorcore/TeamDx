"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CheckSquare,
  Plus,
  Edit,
  Trash2,
  Search,
  Globe,
  Briefcase,
  ArrowLeft,
  Save,
  X,
  FileText,
  List,
  Filter,
  CheckCircle2,
  AlertCircle,
  Upload,
  Download,
  FileCheck,
  FileX,
  FolderOpen,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { tabStorage } from "@/lib/storage";

interface MasterDocument {
  id: string;
  name: string;
  category?: string;
  createdAt?: string;
}

interface ChecklistDocument {
  documentName: string;
  uploadedFile?: {
    name: string;
    url: string;
    uploadedAt: string;
    uploadedBy?: string;
  } | null;
}

interface ChecklistTemplate {
  id: string;
  country: string;
  visaType: string;
  documents: ChecklistDocument[];
  createdBy?: string;
  updatedAt?: string;
}

const COUNTRIES = [
  { code: "USA", name: "🇺🇸 United States", flag: "🇺🇸" },
  { code: "Canada", name: "🇨🇦 Canada", flag: "🇨🇦" },
  { code: "UK", name: "🇬🇧 United Kingdom", flag: "🇬🇧" },
  { code: "Australia", name: "🇦🇺 Australia", flag: "🇦🇺" },
  { code: "New Zealand", name: "🇳🇿 New Zealand", flag: "🇳🇿" },
  { code: "Germany", name: "🇩🇪 Germany", flag: "🇩🇪" },
  { code: "Ireland", name: "🇮🇪 Ireland", flag: "🇮🇪" },
  { code: "Singapore", name: "🇸🇬 Singapore", flag: "🇸🇬" },
];

const VISA_TYPES = [
  { value: "Student Visa", label: "🎓 Student Visa", icon: "🎓" },
  { value: "Work Visa", label: "💼 Work Visa", icon: "💼" },
  { value: "Tourist Visa", label: "✈️ Tourist Visa", icon: "✈️" },
  { value: "PR", label: "🏠 Permanent Residence", icon: "🏠" },
  { value: "Business Visa", label: "📊 Business Visa", icon: "📊" },
  { value: "Dependent Visa", label: "👨‍👩‍👧 Dependent Visa", icon: "👨‍👩‍👧" },
  { value: "Spouse Visa", label: "💑 Spouse Visa", icon: "💑" },
];

// Default master documents
const DEFAULT_MASTER_DOCUMENTS: MasterDocument[] = [
  { id: "1", name: "Passport" },
  { id: "2", name: "I-20 Form" },
  { id: "3", name: "SEVIS Fee Receipt" },
  { id: "4", name: "Financial Documents" },
  { id: "5", name: "Academic Transcripts" },
  { id: "6", name: "English Test Scores (TOEFL/IELTS)" },
  { id: "7", name: "Passport Photos" },
  { id: "8", name: "DS-160 Confirmation" },
  { id: "9", name: "I-797 Approval Notice" },
  { id: "10", name: "Labor Condition Application" },
  { id: "11", name: "Educational Certificates" },
  { id: "12", name: "Employment Letter" },
  { id: "13", name: "Resume/CV" },
  { id: "14", name: "Travel Itinerary" },
  { id: "15", name: "Bank Statements" },
  { id: "16", name: "Hotel Bookings" },
  { id: "17", name: "Letter of Acceptance" },
  { id: "18", name: "GIC Certificate" },
  { id: "19", name: "Medical Exam" },
  { id: "20", name: "Study Plan" },
  { id: "21", name: "Job Offer Letter" },
  { id: "22", name: "LMIA (Labour Market Impact Assessment)" },
  { id: "23", name: "Work Experience Letters" },
  { id: "24", name: "Police Clearance" },
  { id: "25", name: "Educational Credential Assessment" },
  { id: "26", name: "Police Clearance Certificate" },
  { id: "27", name: "Proof of Funds" },
  { id: "28", name: "Birth Certificate" },
  { id: "29", name: "CAS Letter" },
  { id: "30", name: "IELTS UKVI" },
  { id: "31", name: "TB Test Certificate" },
  { id: "32", name: "Academic Documents" },
  { id: "33", name: "Certificate of Sponsorship" },
  { id: "34", name: "Qualification Certificates" },
  { id: "35", name: "English Language Test" },
  { id: "36", name: "Maintenance Funds Proof" },
  { id: "37", name: "CoE (Confirmation of Enrolment)" },
  { id: "38", name: "GTE Statement" },
  { id: "39", name: "IELTS/PTE Scores" },
  { id: "40", name: "Health Insurance (OSHC)" },
  { id: "41", name: "Medical Certificate" },
  { id: "42", name: "Nomination Letter" },
  { id: "43", name: "Skills Assessment" },
  { id: "44", name: "Health Assessment" },
];

export default function DocumentChecklistPage() {
  const router = useRouter();
  const [masterDocuments, setMasterDocuments] = useState<MasterDocument[]>(DEFAULT_MASTER_DOCUMENTS);
  const [checklists, setChecklists] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [filterVisaType, setFilterVisaType] = useState("");

  // Modal states
  const [showMasterDocModal, setShowMasterDocModal] = useState(false);
  const [showMakeChecklistModal, setShowMakeChecklistModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedChecklist, setSelectedChecklist] = useState<ChecklistTemplate | null>(null);

  // Master document form
  const [newDocumentName, setNewDocumentName] = useState("");
  const [masterDocSearch, setMasterDocSearch] = useState("");

  // Make checklist form
  const [formCountry, setFormCountry] = useState("");
  const [formVisaType, setFormVisaType] = useState("");
  const [formDocuments, setFormDocuments] = useState<ChecklistDocument[]>([]);
  const [documentSearch, setDocumentSearch] = useState("");
  const [showDocumentSelector, setShowDocumentSelector] = useState(false);

  useEffect(() => {
    loadUserRole();
    loadMasterDocuments();
    loadChecklists();
    setLoading(false);
  }, []);

  const loadUserRole = () => {
    const userStr = tabStorage.getItem("user");
    if (userStr) {
      const user = JSON.parse(userStr);
      setCurrentUser(user);
      setIsAdmin(user.role.name === "ADMIN");
    }
  };

  const loadMasterDocuments = () => {
    // Load from localStorage or use defaults
    const saved = localStorage.getItem("master_documents");
    if (saved) {
      setMasterDocuments(JSON.parse(saved));
    } else {
      // Save defaults to localStorage
      localStorage.setItem("master_documents", JSON.stringify(DEFAULT_MASTER_DOCUMENTS));
    }
  };

  const loadChecklists = () => {
    // Load from localStorage or initialize empty
    const saved = localStorage.getItem("document_checklists");
    if (saved) {
      setChecklists(JSON.parse(saved));
    }
  };

  const saveChecklists = (updatedChecklists: ChecklistTemplate[]) => {
    localStorage.setItem("document_checklists", JSON.stringify(updatedChecklists));
    setChecklists(updatedChecklists);
  };

  // Master Documents Management
  const handleAddMasterDocument = () => {
    if (!newDocumentName.trim()) {
      setError("Please enter a document name");
      return;
    }

    const exists = masterDocuments.some(
      (doc) => doc.name.toLowerCase() === newDocumentName.trim().toLowerCase()
    );

    if (exists) {
      setError("This document already exists in the master list");
      return;
    }

    const newDoc: MasterDocument = {
      id: Date.now().toString(),
      name: newDocumentName.trim(),
      createdAt: new Date().toISOString(),
    };

    setMasterDocuments([...masterDocuments, newDoc]);
    localStorage.setItem("master_documents", JSON.stringify([...masterDocuments, newDoc]));
    setNewDocumentName("");
    setSuccess("✓ Document added to master list!");
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleDeleteMasterDocument = (id: string) => {
    if (!confirm("Are you sure you want to delete this document from master list?")) return;

    const updated = masterDocuments.filter((doc) => doc.id !== id);
    setMasterDocuments(updated);
    localStorage.setItem("master_documents", JSON.stringify(updated));
    setSuccess("✓ Document removed from master list!");
    setTimeout(() => setSuccess(null), 3000);
  };

  // Make Checklist
  const handleAddDocumentToChecklist = (docName: string) => {
    const alreadyAdded = formDocuments.some((d) => d.documentName === docName);
    if (alreadyAdded) {
      setError("This document is already added to the checklist");
      setTimeout(() => setError(null), 3000);
      return;
    }

    setFormDocuments([
      ...formDocuments,
      {
        documentName: docName,
        uploadedFile: null,
      },
    ]);
    setDocumentSearch("");
    setSuccess(`✓ ${docName} added to checklist!`);
    setTimeout(() => setSuccess(null), 2000);
  };

  const handleRemoveDocumentFromChecklist = (index: number) => {
    setFormDocuments(formDocuments.filter((_, i) => i !== index));
  };

  const handleSaveChecklist = () => {
    if (!formCountry || !formVisaType || formDocuments.length === 0) {
      setError("Please select country, visa type, and add at least one document");
      return;
    }

    const newChecklist: ChecklistTemplate = {
      id: `${formCountry}-${formVisaType}-${Date.now()}`.replace(/\s+/g, "-"),
      country: formCountry,
      visaType: formVisaType,
      documents: formDocuments,
      createdBy: currentUser?.email,
      updatedAt: new Date().toISOString(),
    };

    const updated = [...checklists, newChecklist];
    saveChecklists(updated);
    setSuccess("✓ Checklist created successfully!");
    setTimeout(() => setSuccess(null), 3000);

    // Reset form
    setFormCountry("");
    setFormVisaType("");
    setFormDocuments([]);
    setShowMakeChecklistModal(false);
  };

  const handleDeleteChecklist = (id: string) => {
    if (!confirm("Are you sure you want to delete this checklist?")) return;

    const updated = checklists.filter((c) => c.id !== id);
    saveChecklists(updated);
    setSuccess("✓ Checklist deleted successfully!");
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleFileUpload = (
    checklistId: string,
    documentIndex: number,
    file: File
  ) => {
    // Simulate file upload (in real app, upload to server)
    const fileUrl = URL.createObjectURL(file);
    const uploadedFile = {
      name: file.name,
      url: fileUrl,
      uploadedAt: new Date().toISOString(),
      uploadedBy: currentUser?.email || "Unknown",
    };

    const updated = checklists.map((checklist) => {
      if (checklist.id === checklistId) {
        const updatedDocs = [...checklist.documents];
        updatedDocs[documentIndex] = {
          ...updatedDocs[documentIndex],
          uploadedFile,
        };
        return { ...checklist, documents: updatedDocs };
      }
      return checklist;
    });

    saveChecklists(updated);
    setSuccess(`✓ ${file.name} uploaded successfully!`);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleDeleteUploadedFile = (checklistId: string, documentIndex: number) => {
    const updated = checklists.map((checklist) => {
      if (checklist.id === checklistId) {
        const updatedDocs = [...checklist.documents];
        updatedDocs[documentIndex] = {
          ...updatedDocs[documentIndex],
          uploadedFile: null,
        };
        return { ...checklist, documents: updatedDocs };
      }
      return checklist;
    });

    saveChecklists(updated);
    setSuccess("✓ Document removed successfully!");
    setTimeout(() => setSuccess(null), 3000);
  };

  // Filtered master documents
  const filteredMasterDocuments = masterDocuments.filter((doc) =>
    doc.name.toLowerCase().includes(masterDocSearch.toLowerCase())
  );

  // Filtered documents for selection
  const filteredDocumentsForSelection = masterDocuments.filter((doc) =>
    doc.name.toLowerCase().includes(documentSearch.toLowerCase())
  );

  // Filtered checklists
  const filteredChecklists = checklists.filter((checklist) => {
    const matchesSearch =
      checklist.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
      checklist.visaType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      checklist.documents.some((d) =>
        d.documentName.toLowerCase().includes(searchTerm.toLowerCase())
      );

    const matchesCountry = !filterCountry || checklist.country === filterCountry;
    const matchesVisaType = !filterVisaType || checklist.visaType === filterVisaType;

    return matchesSearch && matchesCountry && matchesVisaType;
  });

  // Group by country
  const groupedByCountry = filteredChecklists.reduce(
    (acc, checklist) => {
      if (!acc[checklist.country]) {
        acc[checklist.country] = [];
      }
      acc[checklist.country].push(checklist);
      return acc;
    },
    {} as Record<string, ChecklistTemplate[]>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading checklists...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back</span>
        </button>

        {/* Header */}
        <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <CheckSquare className="h-8 w-8 text-primary-600" />
              Document Checklist Management
            </h1>
            <p className="text-gray-600 mt-1">
              Country and visa-wise document requirements with upload functionality
            </p>
          </div>
          <div className="flex gap-3">
            {isAdmin && (
              <>
                <button
                  onClick={() => setShowMasterDocModal(true)}
                  className="px-5 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2 font-medium shadow-lg"
                >
                  <List className="h-5 w-5" />
                  Master Documents
                </button>
                <button
                  onClick={() => setShowMakeChecklistModal(true)}
                  className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2 font-medium shadow-lg"
                >
                  <Plus className="h-5 w-5" />
                  Make Checklist
                </button>
              </>
            )}
          </div>
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
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search country, visa type, or document..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <select
                value={filterCountry}
                onChange={(e) => setFilterCountry(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                <option value="">🌍 All Countries</option>
                {COUNTRIES.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <select
                value={filterVisaType}
                onChange={(e) => setFilterVisaType(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                <option value="">📋 All Visa Types</option>
                {VISA_TYPES.map((visa) => (
                  <option key={visa.value} value={visa.value}>
                    {visa.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(filterCountry || filterVisaType || searchTerm) && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => {
                  setSearchTerm("");
                  setFilterCountry("");
                  setFilterVisaType("");
                }}
                className="px-4 py-1.5 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>

        {/* Statistics */}
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-lg">
            <p className="text-blue-100 text-xs font-medium">Total Checklists</p>
            <p className="text-2xl font-bold mt-1">{checklists.length}</p>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white shadow-lg">
            <p className="text-green-100 text-xs font-medium">Countries</p>
            <p className="text-2xl font-bold mt-1">{Object.keys(groupedByCountry).length}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white shadow-lg">
            <p className="text-purple-100 text-xs font-medium">Visa Types</p>
            <p className="text-2xl font-bold mt-1">
              {new Set(checklists.map((c) => c.visaType)).size}
            </p>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white shadow-lg">
            <p className="text-orange-100 text-xs font-medium">Master Documents</p>
            <p className="text-2xl font-bold mt-1">{masterDocuments.length}</p>
          </div>
        </div>

        {/* Checklists by Country */}
        <div className="space-y-6">
          {Object.keys(groupedByCountry).length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <CheckSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg font-medium mb-2">No checklists found</p>
              <p className="text-gray-500 text-sm">
                {searchTerm || filterCountry || filterVisaType
                  ? "Try adjusting your filters"
                  : isAdmin
                  ? "Create your first checklist to get started"
                  : "No checklists available yet"}
              </p>
            </div>
          ) : (
            Object.keys(groupedByCountry).map((country) => {
              const countryData = COUNTRIES.find((c) => c.code === country);
              return (
                <div
                  key={country}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
                >
                  <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Globe className="h-6 w-6" />
                      {countryData?.flag} {country}
                      <span className="ml-auto text-sm font-normal text-primary-100">
                        {groupedByCountry[country].length} checklist
                        {groupedByCountry[country].length > 1 ? "s" : ""}
                      </span>
                    </h2>
                  </div>

                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupedByCountry[country].map((checklist) => {
                      const visaTypeData = VISA_TYPES.find(
                        (v) => v.value === checklist.visaType
                      );
                      const uploadedCount = checklist.documents.filter(
                        (d) => d.uploadedFile
                      ).length;
                      return (
                        <div
                          key={checklist.id}
                          className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-lg border-2 border-gray-200 p-5 hover:border-primary-300 hover:shadow-md transition-all cursor-pointer"
                          onClick={() => {
                            setSelectedChecklist(checklist);
                            setShowViewModal(true);
                          }}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                                <Briefcase className="h-5 w-5 text-primary-600" />
                              </div>
                              <div>
                                <h3 className="font-bold text-gray-900">
                                  {visaTypeData?.icon} {checklist.visaType}
                                </h3>
                                <p className="text-xs text-gray-600">
                                  {checklist.documents.length} documents
                                  {uploadedCount > 0 && (
                                    <span className="text-green-600 ml-1">
                                      • {uploadedCount} uploaded
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                            {isAdmin && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteChecklist(checklist.id);
                                }}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>

                          <div className="space-y-1.5">
                            {checklist.documents.slice(0, 4).map((doc, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2 text-sm text-gray-700"
                              >
                                {doc.uploadedFile ? (
                                  <FileCheck className="h-4 w-4 text-green-600 flex-shrink-0" />
                                ) : (
                                  <FileX className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                )}
                                <span className="truncate">{doc.documentName}</span>
                              </div>
                            ))}
                            {checklist.documents.length > 4 && (
                              <p className="text-xs text-gray-500 ml-6">
                                +{checklist.documents.length - 4} more documents...
                              </p>
                            )}
                          </div>

                          <div className="mt-4 pt-3 border-t border-gray-200 text-center">
                            <span className="text-xs text-primary-600 font-medium hover:text-primary-700">
                              Click to view & upload →
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Master Documents Modal (Admin Only) */}
        {showMasterDocModal && isAdmin && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Master Documents List</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Manage all available documents ({masterDocuments.length} documents)
                  </p>
                </div>
                <button
                  onClick={() => setShowMasterDocModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {/* Add New Document */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Add New Document
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter document name..."
                      value={newDocumentName}
                      onChange={(e) => setNewDocumentName(e.target.value)}
                      onKeyPress={(e) =>
                        e.key === "Enter" && (e.preventDefault(), handleAddMasterDocument())
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <button
                      onClick={handleAddMasterDocument}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                    >
                      <Plus className="h-5 w-5" />
                      Add
                    </button>
                  </div>
                </div>

                {/* Search */}
                <div className="mb-4 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search documents..."
                    value={masterDocSearch}
                    onChange={(e) => setMasterDocSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Documents List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredMasterDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary-600" />
                        <span className="text-sm font-medium text-gray-900">{doc.name}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteMasterDocument(doc.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={() => setShowMasterDocModal(false)}
                  className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Make Checklist Modal (Admin Only) */}
        {showMakeChecklistModal && isAdmin && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Make New Checklist</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Select country, visa type, and add documents from master list
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowMakeChecklistModal(false);
                    setFormCountry("");
                    setFormVisaType("");
                    setFormDocuments([]);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Country & Visa Type Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Country
                    </label>
                    <select
                      value={formCountry}
                      onChange={(e) => setFormCountry(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    >
                      <option value="">Select Country</option>
                      {COUNTRIES.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Visa Type
                    </label>
                    <select
                      value={formVisaType}
                      onChange={(e) => setFormVisaType(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    >
                      <option value="">Select Visa Type</option>
                      {VISA_TYPES.map((visa) => (
                        <option key={visa.value} value={visa.value}>
                          {visa.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Add Documents Section */}
                <div className="border-t border-gray-200 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Add Documents ({formDocuments.length} added)
                    </label>
                    <button
                      onClick={() => setShowDocumentSelector(!showDocumentSelector)}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2 text-sm"
                    >
                      <Plus className="h-4 w-4" />
                      Add Documents
                    </button>
                  </div>

                  {/* Document Selector */}
                  {showDocumentSelector && (
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search documents..."
                          value={documentSearch}
                          onChange={(e) => setDocumentSearch(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {filteredDocumentsForSelection.map((doc) => {
                          const isAdded = formDocuments.some(
                            (d) => d.documentName === doc.name
                          );
                          return (
                            <div
                              key={doc.id}
                              className={`flex items-center justify-between p-2 rounded-lg border ${
                                isAdded
                                  ? "bg-green-50 border-green-200"
                                  : "bg-white border-gray-200 hover:bg-gray-50 cursor-pointer"
                              }`}
                              onClick={() => !isAdded && handleAddDocumentToChecklist(doc.name)}
                            >
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-primary-600" />
                                <span className="text-sm font-medium text-gray-900">
                                  {doc.name}
                                </span>
                              </div>
                              {isAdded ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              ) : (
                                <Plus className="h-4 w-4 text-gray-400" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Selected Documents List */}
                  {formDocuments.length > 0 && (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {formDocuments.map((doc, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                              {index + 1}
                            </span>
                            <span className="text-sm font-medium text-gray-900">
                              {doc.documentName}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveDocumentFromChecklist(index)}
                            className="flex-shrink-0 p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
                <button
                  type="button"
                  onClick={() => {
                    setShowMakeChecklistModal(false);
                    setFormCountry("");
                    setFormVisaType("");
                    setFormDocuments([]);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveChecklist}
                  disabled={!formCountry || !formVisaType || formDocuments.length === 0}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Save Checklist
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View Checklist Modal with Upload */}
        {showViewModal && selectedChecklist && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {COUNTRIES.find((c) => c.code === selectedChecklist.country)?.flag}{" "}
                    {selectedChecklist.country} - {selectedChecklist.visaType}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Complete document checklist ({selectedChecklist.documents.length} items)
                  </p>
                </div>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-3">
                  {selectedChecklist.documents.map((doc, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex-shrink-0 w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-primary-700">{index + 1}</span>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{doc.documentName}</p>
                          {doc.uploadedFile && (
                            <div className="mt-1 flex items-center gap-2 text-sm text-green-600">
                              <FileCheck className="h-4 w-4" />
                              <span>{doc.uploadedFile.name}</span>
                              <span className="text-gray-500">
                                • {new Date(doc.uploadedFile.uploadedAt).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.uploadedFile ? (
                          <>
                            <a
                              href={doc.uploadedFile.url}
                              download={doc.uploadedFile.name}
                              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"
                            >
                              <Download className="h-4 w-4" />
                              Download
                            </a>
                            <button
                              onClick={() =>
                                handleDeleteUploadedFile(selectedChecklist.id, index)
                              }
                              className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 text-sm"
                            >
                              <Trash2 className="h-4 w-4" />
                              Remove
                            </button>
                          </>
                        ) : (
                          <label className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 cursor-pointer flex items-center gap-2 text-sm">
                            <Upload className="h-4 w-4" />
                            Upload Document
                            <input
                              type="file"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleFileUpload(selectedChecklist.id, index, file);
                                }
                              }}
                              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={() => {
                    const content =
                      `${selectedChecklist.country} - ${selectedChecklist.visaType}\n\n` +
                      selectedChecklist.documents
                        .map((doc, i) => `${i + 1}. ${doc.documentName}`)
                        .join("\n");
                    navigator.clipboard.writeText(content);
                    setSuccess("✓ Copied to clipboard!");
                    setTimeout(() => setSuccess(null), 2000);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Copy List
                </button>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
