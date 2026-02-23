"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  Download,
  X,
  Save,
  Search,
  Filter,
  User,
  Calendar,
  Tag,
  File,
  FileCheck,
  Wand2,
  Link2,
  LogOut,
  RefreshCw,
  Eye,
  AlertCircle,
} from "lucide-react";
import JsBarcode from "jsbarcode";
import { apiClient } from "@/lib/api";
import { tabStorage } from "@/lib/storage";

// Barcode Component
const BarcodeDisplay = ({ value }: { value: string }) => {
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (barcodeRef.current && value) {
      try {
        // Clear previous barcode
        barcodeRef.current.innerHTML = '';
        
        JsBarcode(barcodeRef.current, value, {
          format: "CODE128",
          width: 2,
          height: 60,
          displayValue: true,
          fontSize: 14,
          margin: 10,
          background: "#ffffff",
          lineColor: "#000000",
        });
      } catch (error) {
        console.error("Barcode generation error:", error);
      }
    }
  }, [value]);

  if (!value) return null;

  return (
    <div className="w-full flex justify-center">
      <svg ref={barcodeRef} className="max-w-full h-auto" style={{ minHeight: '60px' }} />
    </div>
  );
};

interface Document {
  id: string;
  documentType: string;
  title: string;
  description: string | null;
  fileName: string;
  fileUrl: string;
  fileSize: number | null;
  mimeType: string | null;
  recipient: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: {
      name: string;
    };
  } | null;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  status: string;
  issuedDate: string | null;
  expiryDate: string | null;
  tags: string | null;
  createdAt: string;
}

const DOCUMENT_TYPES = [
  { value: "offer_letter", label: "Offer Letter" },
  { value: "joining_letter", label: "Joining Letter" },
  { value: "noc", label: "NOC (No Objection Certificate)" },
  { value: "warning_letter", label: "Warning Letter" },
  { value: "experience_letter", label: "Experience Letter" },
  { value: "appointment_letter", label: "Appointment Letter" },
  { value: "relieving_letter", label: "Relieving Letter" },
  { value: "salary_certificate", label: "Salary Certificate" },
  { value: "bonus_letter", label: "Bonus Letter" },
  { value: "increment_letter", label: "Increment Letter" },
  { value: "other", label: "Other" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft", color: "gray" },
  { value: "sent", label: "Sent", color: "blue" },
  { value: "acknowledged", label: "Acknowledged", color: "green" },
  { value: "archived", label: "Archived", color: "gray" },
];

export default function DocumentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [staff, setStaff] = useState<Array<{ id: string; firstName: string; lastName: string; email: string }>>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [userRole, setUserRole] = useState<string>("");
  const isTelecaller = userRole === "TELECALLER";
  const [formData, setFormData] = useState({
    documentType: "offer_letter",
    title: "",
    description: "",
    recipientId: "",
    status: "draft",
    issuedDate: "",
    expiryDate: "",
    tags: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [checkingGoogle, setCheckingGoogle] = useState(false); // Start as false to show button immediately
  const [viewingDocument, setViewingDocument] = useState<Document | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [includeBarcode, setIncludeBarcode] = useState(true); // Default to true
  const [showBarcodeWarning, setShowBarcodeWarning] = useState(false);

  useEffect(() => {
    // Get user role from storage
    const userStr = tabStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        const role = user.role?.name || "";
        setUserRole(role);
        
        // Only fetch staff and check Google if not telecaller
        if (role !== "TELECALLER") {
          fetchStaff();
          checkGoogleConnection();
        }
      } catch (e) {
        console.error("Error parsing user data:", e);
      }
    }
    
    fetchDocuments();

    // Check for OAuth callback
    const params = new URLSearchParams(window.location.search);
    const googleAuth = params.get("google_auth");
    if (googleAuth === "success") {
      setSuccess("Successfully connected to Google Docs!");
      setTimeout(() => setSuccess(null), 5000);
      checkGoogleConnection();
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    } else if (googleAuth === "error") {
      const message = params.get("message");
      setError(message || "Failed to connect to Google Docs");
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const checkGoogleConnection = async (retryCount = 0) => {
    try {
      setCheckingGoogle(true);
      // Add timeout to prevent stuck state
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Timeout")), 5000)
      );
      
      const statusPromise = apiClient.getGoogleConnectionStatus();
      const status = await Promise.race([statusPromise, timeoutPromise]) as any;
      setGoogleConnected(status?.connected || false);
    } catch (err: any) {
      // Retry once if it's a network error and we haven't retried yet
      if (retryCount === 0 && (err.message?.includes("Network error") || err.message?.includes("Timeout"))) {
        console.log("Retrying Google connection check...");
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        return checkGoogleConnection(1);
      }
      // Only log non-network errors
      if (!err.message?.includes("Network error") && !err.message?.includes("Timeout")) {
        console.error("Failed to check Google connection:", err);
      }
      setGoogleConnected(false);
      // Don't show error to user, just assume not connected
    } finally {
      setCheckingGoogle(false);
    }
  };

  const handleGoogleConnect = async () => {
    try {
      setError(null);
      const response = await apiClient.getGoogleAuthUrl();
      if (response.authUrl) {
        window.location.href = response.authUrl;
      } else {
        setError("Failed to get Google authorization URL. Please check backend configuration.");
      }
    } catch (err: any) {
      console.error("Google connect error:", err);
      setError(err.message || "Failed to connect to Google. Please ensure Google OAuth credentials are configured in backend.");
    }
  };

  const handleGoogleDisconnect = async () => {
    try {
      await apiClient.disconnectGoogle();
      setGoogleConnected(false);
      setSuccess("Disconnected from Google successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to disconnect from Google");
    }
  };

  useEffect(() => {
    filterDocuments();
  }, [documents, searchTerm, filterType, filterStatus]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getDocuments();
      setDocuments(response.documents || []);
    } catch (err: any) {
      if (err.status === 401) {
        tabStorage.removeItem("token");
        tabStorage.removeItem("user");
        router.push("/login");
        return;
      }
      if (err.status === 403) {
        setError("You don't have permission to access this page");
        return;
      }
      setError(err.message || "Failed to fetch documents");
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const response = await apiClient.getStaff();
      setStaff(response.staff?.map((s: any) => ({ id: s.id, firstName: s.firstName, lastName: s.lastName, email: s.email })) || []);
    } catch (err) {
      console.error("Failed to fetch staff:", err);
    }
  };

  const filterDocuments = () => {
    // Filtering is handled by backend, but we can add client-side filtering if needed
  };

  const handleOpenModal = (doc?: Document) => {
    if (doc) {
      setEditingDocument(doc);
      setFormData({
        documentType: doc.documentType,
        title: doc.title,
        description: doc.description || "",
        recipientId: doc.recipient?.id || "",
        status: doc.status,
        issuedDate: doc.issuedDate ? doc.issuedDate.split("T")[0] : "",
        expiryDate: doc.expiryDate ? doc.expiryDate.split("T")[0] : "",
        tags: doc.tags || "",
      });
      setSelectedFile(null);
    } else {
      setEditingDocument(null);
      setFormData({
        documentType: "offer_letter",
        title: "",
        description: "",
        recipientId: "",
        status: "draft",
        issuedDate: "",
        expiryDate: "",
        tags: "",
      });
      setSelectedFile(null);
    }
    setShowModal(true);
    setError(null);
    setSuccess(null);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingDocument(null);
    setFormData({
      documentType: "offer_letter",
      title: "",
      description: "",
      recipientId: "",
      status: "draft",
      issuedDate: "",
      expiryDate: "",
      tags: "",
    });
    setSelectedFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (editingDocument) {
        // Update existing document
        await apiClient.updateDocument(editingDocument.id, formData);
        setSuccess("Document updated successfully");
      } else {
        // Create new document
        if (!selectedFile) {
          setError("Please select a file");
          return;
        }

        setUploading(true);
        const formDataToSend = new FormData();
        formDataToSend.append("file", selectedFile);
        formDataToSend.append("data", JSON.stringify(formData));

        await apiClient.createDocument(formDataToSend);
        setSuccess("Document created successfully");
      }
      handleCloseModal();
      fetchDocuments();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to save document");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      await apiClient.deleteDocument(id);
      setSuccess("Document deleted successfully");
      fetchDocuments();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to delete document");
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "Unknown";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getDocumentTypeLabel = (type: string) => {
    return DOCUMENT_TYPES.find((dt) => dt.value === type)?.label || type;
  };

  const getStatusColor = (status: string) => {
    const statusOption = STATUS_OPTIONS.find((s) => s.value === status);
    const color = statusOption?.color || "gray";
    return {
      bg: `bg-${color}-100`,
      text: `text-${color}-700`,
    };
  };

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      searchTerm === "" ||
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || doc.documentType === filterType;
    const matchesStatus = filterStatus === "all" || doc.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              <FileText className="h-7 w-7 md:h-8 md:w-8 text-primary-600" />
              Document Management
            </h1>
            <p className="text-gray-600">
              {isTelecaller 
                ? "View documents for clients whose leads are assigned to you (View Only)" 
                : "Manage HR documents like offer letters, NOC, experience letters, etc."}
            </p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center gap-3 flex-wrap">
            {/* Google Docs Connection - Show status or connect button (hidden for telecallers) */}
            {!isTelecaller && (
              <>
                {googleConnected ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg">
                      <Link2 className="h-4 w-4" />
                      <span className="text-sm font-medium">Google Connected</span>
                    </div>
                    <button
                      onClick={handleGoogleDisconnect}
                      type="button"
                      className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Disconnect</span>
                    </button>
                  </div>
                ) : (
                  <>
                    {checkingGoogle && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Checking...</span>
                      </div>
                    )}
                    {/* Always show Connect button when not connected */}
                    <button
                      onClick={handleGoogleConnect}
                      type="button"
                      disabled={checkingGoogle}
                      className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-all shadow-md hover:shadow-lg font-medium text-sm min-w-[160px] disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Connect to Google Docs to import templates"
                    >
                      <Link2 className="h-4 w-4 flex-shrink-0" />
                      <span className="whitespace-nowrap">Connect Google Docs</span>
                    </button>
                  </>
                )}
              </>
            )}
            {!isTelecaller && (
              <>
                <button
                  onClick={() => setShowGenerateModal(true)}
                  type="button"
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Wand2 className="h-5 w-5" />
                  <span>Generate Document</span>
                </button>
                <button
                  onClick={() => handleOpenModal()}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <Plus className="h-5 w-5" />
                  <span>Upload Document</span>
                </button>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {success}
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by title, filename, description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Types</option>
              {DOCUMENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Status</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Documents Grid */}
        {filteredDocuments.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No documents found</h3>
            <p className="text-gray-600 mb-4">
              {isTelecaller 
                ? "No documents available for your assigned leads" 
                : "Upload your first document to get started"}
            </p>
            {!isTelecaller && (
              <button
                onClick={() => handleOpenModal()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus className="h-5 w-5" />
                <span>Upload Document</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDocuments.map((doc) => {
              const statusColors = getStatusColor(doc.status);
              const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
              const previewUrl = `${API_URL}${doc.fileUrl}`;
              
              return (
                <div
                  key={doc.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* PDF Preview Section */}
                  <div className="relative bg-gray-50 border-b border-gray-200" style={{ height: '200px', overflow: 'hidden' }}>
                    {doc.mimeType === 'application/pdf' ? (
                      <iframe
                        src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                        className="w-full h-full"
                        style={{ border: 'none' }}
                        title={`Preview of ${doc.title}`}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400">
                        <FileText className="h-12 w-12" />
                      </div>
                    )}
                  </div>

                  {/* Document Details Section */}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-gray-900 mb-1 truncate" title={doc.title}>
                          {doc.title}
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-md">
                            {getDocumentTypeLabel(doc.documentType)}
                          </span>
                          <span className={`px-2 py-0.5 ${statusColors.bg} ${statusColors.text} text-xs font-medium rounded-md`}>
                            {STATUS_OPTIONS.find((s) => s.value === doc.status)?.label || doc.status}
                          </span>
                        </div>
                      </div>
                      {!isTelecaller && (
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={() => handleOpenModal(doc)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4 text-gray-600" />
                          </button>
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Document Info */}
                    <div className="space-y-1.5 text-sm mb-3">
                      {doc.recipient && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <User className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate">
                            {doc.recipient.firstName} {doc.recipient.lastName}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-gray-600">
                        <File className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate text-xs">{doc.fileName}</span>
                      </div>
                      {doc.fileSize && (
                        <div className="text-gray-600 text-xs">
                          Size: {formatFileSize(doc.fileSize)}
                        </div>
                      )}
                      {doc.issuedDate && (
                        <div className="flex items-center gap-2 text-gray-600 text-xs">
                          <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                          <span>Issued: {formatDate(doc.issuedDate)}</span>
                        </div>
                      )}
                    </div>

                    {doc.description && (
                      <p className="text-xs text-gray-600 mb-3 line-clamp-2">{doc.description}</p>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
                      <button
                        onClick={async () => {
                          try {
                            const blob = await apiClient.downloadDocument(doc.id);
                            const url = window.URL.createObjectURL(blob);
                            setPdfUrl(url);
                            setViewingDocument(doc);
                          } catch (error: any) {
                            setError(error.message || "Failed to load document");
                          }
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
                      >
                        <Eye className="h-4 w-4" />
                        <span>View</span>
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const blob = await apiClient.downloadDocument(doc.id);
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = doc.fileName;
                            document.body.appendChild(a);
                            a.click();
                            window.URL.revokeObjectURL(url);
                            document.body.removeChild(a);
                          } catch (error: any) {
                            setError(error.message || "Failed to download document");
                          }
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                      >
                        <Download className="h-4 w-4" />
                        <span>Download</span>
                      </button>
                    </div>

                    <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
                      Created: {formatDate(doc.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingDocument ? "Edit Document" : "Upload New Document"}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                {!editingDocument && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      File *
                    </label>
                    <input
                      type="file"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
                      required={!editingDocument}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Accepted formats: PDF, DOC, DOCX, Images, TXT (Max 10MB)
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Document Type *
                  </label>
                  <select
                    value={formData.documentType}
                    onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {DOCUMENT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="e.g., Offer Letter for John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                    placeholder="Optional description..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assign to Staff
                  </label>
                  <select
                    value={formData.recipientId}
                    onChange={(e) => setFormData({ ...formData, recipientId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select staff member (optional)</option>
                    {staff.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.firstName} {member.lastName} ({member.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Issued Date
                    </label>
                    <input
                      type="date"
                      value={formData.issuedDate}
                      onChange={(e) => setFormData({ ...formData, issuedDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Expiry Date (if applicable)
                    </label>
                    <input
                      type="date"
                      value={formData.expiryDate}
                      onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={formData.tags}
                      onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="e.g., urgent, confidential"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {uploading ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>{editingDocument ? "Update" : "Upload"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document View Modal */}
      {viewingDocument && pdfUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{viewingDocument.title}</h2>
              <button
                onClick={() => {
                  setViewingDocument(null);
                  if (pdfUrl) {
                    window.URL.revokeObjectURL(pdfUrl);
                    setPdfUrl(null);
                  }
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe
                src={pdfUrl}
                className="w-full h-full"
                style={{ border: 'none' }}
                title={`Viewing ${viewingDocument.title}`}
              />
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={async () => {
                  try {
                    const blob = await apiClient.downloadDocument(viewingDocument.id);
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = viewingDocument.fileName;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                  } catch (error: any) {
                    setError(error.message || "Failed to download document");
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Download</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Document Modal */}
      {showGenerateModal && (
        <GenerateDocumentModal
          onClose={() => {
            setShowGenerateModal(false);
          }}
          onSuccess={async () => {
            setShowGenerateModal(false);
            setSuccess("Document generated successfully! Refreshing list...");
            // Wait a bit for backend to save, then refresh
            await new Promise(resolve => setTimeout(resolve, 500));
            await fetchDocuments();
            setTimeout(() => setSuccess(null), 3000);
          }}
          staff={staff}
          documentTypes={DOCUMENT_TYPES}
        />
      )}

      {/* Document View Modal */}
      {viewingDocument && pdfUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{viewingDocument.title}</h2>
              <button
                onClick={() => {
                  setViewingDocument(null);
                  if (pdfUrl) {
                    window.URL.revokeObjectURL(pdfUrl);
                    setPdfUrl(null);
                  }
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe
                src={pdfUrl}
                className="w-full h-full"
                style={{ border: 'none' }}
                title={`Viewing ${viewingDocument.title}`}
              />
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={async () => {
                  try {
                    const blob = await apiClient.downloadDocument(viewingDocument.id);
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = viewingDocument.fileName;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                  } catch (error: any) {
                    setError(error.message || "Failed to download document");
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Download</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Generate Document Modal Component
function GenerateDocumentModal({
  onClose,
  onSuccess,
  staff,
  documentTypes,
}: {
  onClose: () => void;
  onSuccess: () => void;
  staff: Array<{ id: string; firstName: string; lastName: string; email: string }>;
  documentTypes: Array<{ value: string; label: string }>;
}) {
  const [step, setStep] = useState<"upload" | "fill">("upload");
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [placeholders, setPlaceholders] = useState<string[]>([]);
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({});
  const [parsingTemplate, setParsingTemplate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templatePath, setTemplatePath] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    documentType: "offer_letter",
    description: "",
    recipientId: "",
  });

  useEffect(() => {
    if (templateSource === "google") {
      fetchGoogleDocuments();
    }
  }, [templateSource]);

  const fetchGoogleDocuments = async () => {
    try {
      console.log("🔄 fetchGoogleDocuments called");
      setLoadingGoogleDocs(true);
      setError(null);
      
      console.log("📡 Calling API: getGoogleDocuments()");
      const response = await apiClient.getGoogleDocuments();
      console.log("✅ Google Docs API response:", response);
      console.log("📄 Documents count:", response.documents?.length || 0);
      
      setGoogleDocuments(response.documents || []);
      
      if (!response.documents || response.documents.length === 0) {
        console.log("⚠️ No documents in response");
        setError("No Google Docs found. Please ensure:\n1. You have Google Docs in your Drive\n2. Documents are not in Trash\n3. You have proper permissions");
      } else {
        console.log("✅ Documents set successfully:", response.documents.length);
      }
    } catch (err: any) {
      console.error("❌ Fetch Google Docs error:", err);
      console.error("Error details:", {
        message: err.message,
        status: err.status,
        stack: err.stack
      });
      
      if (err.status === 401) {
        setError("Not connected to Google. Please connect first.");
      } else if (err.status === 403) {
        setError("Permission denied. Please reconnect to Google and grant Drive access.");
      } else {
        setError(err.message || "Failed to fetch Google Docs. Please check backend console for details.");
      }
    } finally {
      setLoadingGoogleDocs(false);
      console.log("🏁 fetchGoogleDocuments completed");
    }
  };

  const handleSelectGoogleDoc = async (docId: string) => {
    try {
      setSelectedGoogleDocId(docId);
      setParsingTemplate(true);
      setError(null);

      const response = await apiClient.getGoogleDocument(docId);
      setGoogleDocId(docId);
      setPlaceholders(response.placeholders || []);

      // Initialize placeholder values
      const initialValues: Record<string, string> = {};
      response.placeholders?.forEach((placeholder: string) => {
        // Auto-fill Ref.Code placeholder (case-insensitive, handles dots, underscores, hyphens)
        const normalizedPlaceholder = placeholder.toLowerCase().replace(/[._\s-]/g, '');
        if (normalizedPlaceholder === 'refcode') {
          // Generate unique reference code: DOC-YYYYMMDD-HHMMSS-XXXX
          const now = new Date();
          const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
          const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
          const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
          initialValues[placeholder] = `DOC-${dateStr}-${timeStr}-${randomStr}`;
        } else {
          initialValues[placeholder] = "";
        }
      });
      setPlaceholderValues(initialValues);

      setStep("fill");
    } catch (err: any) {
      setError(err.message || "Failed to parse Google Doc");
      setSelectedGoogleDocId(null);
    } finally {
      setParsingTemplate(false);
    }
  };

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".docx") && !file.name.endsWith(".doc")) {
      setError("Please upload a DOCX or DOC file");
      return;
    }

    setTemplateFile(file);
    setError(null);
    setParsingTemplate(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("template", file);

      const response = await apiClient.parseTemplate(formDataToSend);
      
      if (!response.placeholders || response.placeholders.length === 0) {
        setError("No placeholders found in template. Please add placeholders like {{name}}, {{date}} in your DOCX file.");
        setTemplateFile(null);
        return;
      }
      
      setPlaceholders(response.placeholders || []);
      setTemplatePath(response.templatePath);
      
      // Initialize placeholder values
      const initialValues: Record<string, string> = {};
      response.placeholders?.forEach((placeholder: string) => {
        // Auto-fill Ref.Code placeholder (case-insensitive, handles dots, underscores, hyphens)
        const normalizedPlaceholder = placeholder.toLowerCase().replace(/[._\s-]/g, '');
        if (normalizedPlaceholder === 'refcode') {
          // Generate unique reference code: DOC-YYYYMMDD-HHMMSS-XXXX
          const now = new Date();
          const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
          const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
          const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
          initialValues[placeholder] = `DOC-${dateStr}-${timeStr}-${randomStr}`;
        } else {
          initialValues[placeholder] = "";
        }
      });
      setPlaceholderValues(initialValues);

      setStep("fill");
      setError(null);
    } catch (err: any) {
      console.error("Parse template error:", err);
      const errorMessage = err.details || err.message || "Failed to parse template";
      setError(errorMessage + ". Please ensure the file is a valid DOCX format with placeholders like {{name}}.");
      setTemplateFile(null);
    } finally {
      setParsingTemplate(false);
    }
  };

  const handleGenerate = async () => {
    console.log("=== handleGenerate CALLED ===");
    console.log("templateSource:", templateSource);
    console.log("googleDocId:", googleDocId);
    console.log("templateFile:", templateFile);
    console.log("templatePath:", templatePath);
    console.log("placeholders:", placeholders);
    console.log("placeholderValues:", placeholderValues);
    console.log("formData:", formData);
    console.log("includeBarcode:", includeBarcode);
    
    if (templateSource === "google") {
      if (!googleDocId) {
        console.log("❌ ERROR: No Google Doc selected");
        setError("Please select a Google Doc template");
        return;
      }
    } else {
      if (!templateFile || !templatePath) {
        console.log("❌ ERROR: No template file uploaded");
        setError("Template file is required");
        return;
      }
    }

    // Validate all placeholders are filled
    const emptyPlaceholders = placeholders.filter((p) => !placeholderValues[p]?.trim());
    if (emptyPlaceholders.length > 0) {
      console.log("❌ ERROR: Empty placeholders:", emptyPlaceholders);
      setError(`Please fill all fields: ${emptyPlaceholders.join(", ")}`);
      return;
    }

    // Check if barcode is not included - show warning
    if (!includeBarcode) {
      setShowBarcodeWarning(true);
      return;
    }

    // Proceed with generation
    await proceedWithGeneration();
  };

  const proceedWithGeneration = async () => {
    console.log("✅ All validations passed, starting generation...");
    setGenerating(true);
    setError(null);
    setShowBarcodeWarning(false);

    try {
      if (templateSource === "google") {
        // Generate from Google Docs (and save in local Document Management)
        console.log("=== FRONTEND: Generating Google Doc ===");
        console.log("Full formData:", formData);
        console.log("formData.documentType:", formData.documentType);
        console.log("formData.documentType type:", typeof formData.documentType);
        console.log("formData.documentType value:", JSON.stringify(formData.documentType));
        console.log("Using documentType:", formData.documentType || "offer_letter");
        
        // Ensure documentType is always set - never send empty/undefined
        const documentTypeToSend = formData.documentType && formData.documentType.trim() !== "" 
          ? formData.documentType 
          : "offer_letter";
        
        console.log("Document type being sent:", documentTypeToSend);
        
        const requestPayload = {
          documentId: googleDocId!,
          placeholderValues,
          newDocumentName: formData.title || "Generated Document",
          documentType: documentTypeToSend,
          description: formData.description,
          recipientId: formData.recipientId || null,
          includeBarcode: includeBarcode, // Send barcode flag
        };
        console.log("Request payload being sent:", JSON.stringify(requestPayload, null, 2));
        
        const response = await apiClient.generateGoogleDocument(requestPayload);
        console.log("Generate response:", response);

        // Open the generated document in a new tab
        window.open(response.documentUrl, "_blank");
        // Small delay to ensure backend has saved
        await new Promise(resolve => setTimeout(resolve, 300));
        onSuccess();
      } else {
        // Generate from local file
        const formDataToSend = new FormData();
        formDataToSend.append("template", templateFile!);
        formDataToSend.append(
          "data",
          JSON.stringify({
            placeholders: placeholderValues,
            templatePath,
            title: formData.title || "Generated Document",
            documentType: formData.documentType,
            description: formData.description,
            recipientId: formData.recipientId || null,
          })
        );

        const response = await apiClient.generateDocument(formDataToSend);
        console.log("Document generated:", response);
        // Small delay to ensure backend has saved
        await new Promise(resolve => setTimeout(resolve, 300));
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate document");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Generate Document from Template</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={generating || parsingTemplate}
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {step === "upload" ? (
            <div className="space-y-4">
              {/* Template Source Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Template Source *
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setTemplateSource("local");
                      setTemplateFile(null);
                      setSelectedGoogleDocId(null);
                      setError(null);
                    }}
                    className={`p-4 border-2 rounded-lg transition-colors ${
                      templateSource === "local"
                        ? "border-primary-600 bg-primary-50"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    <FileText className="h-6 w-6 mx-auto mb-2 text-gray-600" />
                    <p className="font-medium text-sm">Upload File</p>
                    <p className="text-xs text-gray-500 mt-1">DOCX/DOC format</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTemplateSource("google");
                      setTemplateFile(null);
                      setSelectedGoogleDocId(null);
                      setError(null);
                    }}
                    className={`p-4 border-2 rounded-lg transition-colors ${
                      templateSource === "google"
                        ? "border-primary-600 bg-primary-50"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    <Link2 className="h-6 w-6 mx-auto mb-2 text-gray-600" />
                    <p className="font-medium text-sm">Google Docs</p>
                    <p className="text-xs text-gray-500 mt-1">Import from Google</p>
                  </button>
                </div>
              </div>

              {/* Local File Upload */}
              {templateSource === "local" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Template File (DOCX/DOC) *
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <FileCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <input
                      type="file"
                      accept=".docx,.doc"
                      onChange={handleTemplateUpload}
                      disabled={parsingTemplate}
                      className="hidden"
                      id="template-upload"
                    />
                    <label
                      htmlFor="template-upload"
                      className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      <FileText className="h-5 w-5" />
                      <span>Choose Template File</span>
                    </label>
                    <p className="mt-2 text-sm text-gray-500">
                      Use placeholders like {"{{name}}"}, {"{{date}}"}, {"{{position}}"} in your template
                    </p>
                  </div>
                  {templateFile && (
                    <div className="mt-2 text-sm text-gray-600">
                      Selected: {templateFile.name}
                    </div>
                  )}
                  {parsingTemplate && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-gray-600">
                      <div className="h-4 w-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>Parsing template...</span>
                    </div>
                  )}
                </div>
              )}

              {/* Google Docs Selection */}
              {templateSource === "google" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Google Doc Template *
                  </label>
                  {loadingGoogleDocs ? (
                    <div className="flex items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
                      <div className="flex items-center gap-2 text-gray-600">
                        <div className="h-4 w-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                        <span>Loading Google Docs...</span>
                      </div>
                    </div>
                  ) : googleDocuments.length === 0 ? (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                      <Link2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 mb-2">No Google Docs found</p>
                      <p className="text-sm text-gray-500">Make sure you have Google Docs with placeholders like {"{{name}}"}</p>
                    </div>
                  ) : (
                    <div className="border border-gray-300 rounded-lg max-h-64 overflow-y-auto">
                      {googleDocuments.map((doc) => (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => handleSelectGoogleDoc(doc.id)}
                          disabled={parsingTemplate}
                          className={`w-full p-4 text-left border-b border-gray-200 last:border-b-0 hover:bg-gray-50 transition-colors ${
                            selectedGoogleDocId === doc.id ? "bg-primary-50 border-primary-200" : ""
                          } ${parsingTemplate ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <FileText className="h-5 w-5 text-gray-400" />
                              <div>
                                <p className="font-medium text-sm text-gray-900">{doc.name}</p>
                                <p className="text-xs text-gray-500">
                                  Modified: {new Date(doc.modifiedTime).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            {selectedGoogleDocId === doc.id && (
                              <div className="h-2 w-2 bg-primary-600 rounded-full"></div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {parsingTemplate && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-gray-600">
                      <div className="h-4 w-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>Parsing template...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Document Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Document Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="e.g., Offer Letter for John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Document Type *
                  </label>
                  <select
                    value={formData.documentType}
                    onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {documentTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  placeholder="Optional description..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assign to Staff
                </label>
                <select
                  value={formData.recipientId}
                  onChange={(e) => setFormData({ ...formData, recipientId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select staff member (optional)</option>
                  {staff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.firstName} {member.lastName} ({member.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Include Barcode Checkbox - Always visible, placed BEFORE placeholders */}
              <div className="mb-6 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-400 rounded-lg shadow-md" style={{ display: 'block' }}>
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    id="includeBarcode"
                    name="includeBarcode"
                    checked={includeBarcode}
                    onChange={(e) => {
                      console.log("✅ Checkbox changed:", e.target.checked);
                      setIncludeBarcode(e.target.checked);
                    }}
                    className="mt-0.5 h-6 w-6 text-blue-600 focus:ring-2 focus:ring-blue-500 border-2 border-gray-400 rounded cursor-pointer"
                    style={{ minWidth: '24px', minHeight: '24px', flexShrink: 0, display: 'block' }}
                  />
                  <label htmlFor="includeBarcode" className="flex-1 cursor-pointer" style={{ display: 'block' }}>
                    <span className="block text-base font-bold text-gray-900 mb-2">
                      📊 Include Barcode on Document
                    </span>
                    <span className="block text-sm text-gray-700 leading-relaxed">
                      A unique barcode will be generated and added to every page of the document for tracking and verification purposes. This helps with document authenticity and quick identification.
                    </span>
                  </label>
                </div>
              </div>

              {/* Placeholder Fields */}
              {placeholders.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Fill Template Fields *
                  </label>
                  <div className="space-y-3">
                    {placeholders.map((placeholder) => {
                      // Normalize placeholder name (remove dots, spaces, underscores, case-insensitive)
                      const normalizedPlaceholder = placeholder.toLowerCase().replace(/[._\s-]/g, '');
                      const isRefCode = normalizedPlaceholder === 'refcode';
                      
                      return (
                        <div key={placeholder}>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {placeholder.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())} *
                            {isRefCode && (
                              <span className="ml-2 text-xs text-green-600 font-normal">(Auto-generated)</span>
                            )}
                          </label>
                          <input
                            type="text"
                            value={placeholderValues[placeholder] || ""}
                            onChange={(e) => {
                              // Prevent manual editing of Ref.Code
                              if (!isRefCode) {
                                setPlaceholderValues({
                                  ...placeholderValues,
                                  [placeholder]: e.target.value,
                                });
                              }
                            }}
                            required
                            readOnly={isRefCode}
                            disabled={isRefCode}
                            tabIndex={isRefCode ? -1 : 0}
                            className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                              isRefCode ? 'bg-green-50 text-green-700 font-mono cursor-not-allowed opacity-75' : ''
                            }`}
                            placeholder={isRefCode ? "Auto-generated reference code" : `Enter ${placeholder}`}
                            style={isRefCode ? { pointerEvents: 'none' } : {}}
                          />
                          {isRefCode && (
                            <>
                              <p className="mt-1 text-xs text-gray-500 mb-2">
                                This field is automatically generated and cannot be edited
                              </p>
                              {placeholderValues[placeholder] && (
                                <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                  <p className="text-xs text-gray-600 mb-2">Barcode:</p>
                                  <div className="flex items-center justify-center bg-white p-3 rounded border">
                                    <BarcodeDisplay value={placeholderValues[placeholder]} />
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setStep("upload")}
                  disabled={generating}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating || placeholders.length === 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {generating ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4" />
                      <span>Generate Document</span>
                    </>
                  )}
                </button>
              </div>

              {/* Barcode Warning Dialog */}
              {showBarcodeWarning && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 p-4">
                  <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                    <div className="p-6">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="flex-shrink-0">
                          <div className="h-12 w-12 bg-yellow-100 rounded-full flex items-center justify-center">
                            <AlertCircle className="h-6 w-6 text-yellow-600" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Barcode Not Included
                          </h3>
                          <p className="text-sm text-gray-600 mb-4">
                            You have chosen not to include a barcode on this document. Barcodes are important for:
                          </p>
                          <ul className="text-sm text-gray-600 space-y-2 mb-4 list-disc list-inside">
                            <li>Document tracking and verification</li>
                            <li>Preventing document tampering</li>
                            <li>Quick identification and retrieval</li>
                            <li>Maintaining document authenticity</li>
                          </ul>
                          <p className="text-sm font-medium text-gray-900 mb-4">
                            Are you sure you want to proceed without a barcode?
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setShowBarcodeWarning(false);
                            setIncludeBarcode(false);
                            proceedWithGeneration();
                          }}
                          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          Skip (No Barcode)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIncludeBarcode(true);
                            setShowBarcodeWarning(false);
                            proceedWithGeneration();
                          }}
                          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                        >
                          OK (Include Barcode)
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

