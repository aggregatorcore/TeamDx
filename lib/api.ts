import { tabStorage } from "./storage";

// Normalize API URL - fix common issues like spaces instead of colons
function normalizeApiUrl(url: string): string {
  if (!url) return "http://localhost:5000";

  // Fix space instead of colon (e.g., "http://localhost 5000" -> "http://localhost:5000")
  url = url.replace(/\s+(\d+)/, ":$1");

  // Ensure it starts with http:// or https://
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `http://${url}`;
  }

  // Remove trailing slash
  url = url.replace(/\/+$/, "");

  return url;
}

const API_URL = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000");

export interface LoginResponse {
  message: string;
  token: string;
  user: {
    id: string;
    employeeCode?: string | null;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    role: {
      id: string;
      name: string;
      description?: string;
      level: number;
    };
    isActive: boolean;
  };
}

export interface ApiError {
  error: string;
  details?: any;
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_URL;
  }

  // Public request method for custom endpoints
  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = typeof window !== "undefined"
      ? tabStorage.getItem("token")
      : null;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    } else {
      // Log warning if no token for protected endpoints
      if (typeof window !== "undefined" && !endpoint.includes("/login") && !endpoint.includes("/register")) {
        console.warn(`[API Request] No token found for endpoint: ${endpoint}`);
      }
    }

    try {
      // Ensure endpoint starts with /
      const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
      const fullUrl = `${this.baseUrl}${normalizedEndpoint}`;

      // Validate URL format
      try {
        new URL(fullUrl);
      } catch (urlError) {
        throw new Error(`Invalid API URL: ${fullUrl}. Please check NEXT_PUBLIC_API_URL in .env file. It should be like "http://localhost:5000" (with colon, not space).`);
      }

      const response = await fetch(fullUrl, {
        ...options,
        headers,
      });

      // Check if response is empty
      const contentType = response.headers.get("content-type");
      const text = await response.text();

      // If response is empty, return empty object
      if (!text || text.trim().length === 0) {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return {} as T;
      }

      // Try to parse JSON
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        // If not JSON, check if it's HTML (error page)
        if (contentType && contentType.includes("text/html")) {
          const error = new Error(`Server returned HTML instead of JSON. Status: ${response.status}. The endpoint may not exist or the server may be down.`) as any;
          error.status = response.status;
          throw error;
        }
        // If it's plain text, use it as error message
        const error = new Error(text || `Failed to parse response. Status: ${response.status}`) as any;
        error.status = response.status;
        throw error;
      }

      if (!response.ok) {
        // Handle 401 errors specifically - token expired or invalid
        if (response.status === 401) {
          // Only clear token and redirect for non-optional endpoints
          // Optional endpoints like startSession and getCurrentUser should not cause auto-logout
          const isOptionalEndpoint = endpoint.includes("/sessions/start") ||
            endpoint.includes("/sessions/current") ||
            endpoint.includes("/auth/me");

          if (!isOptionalEndpoint && typeof window !== "undefined") {
            tabStorage.removeItem("token");
            tabStorage.removeItem("user");
            console.warn("[API] 401 Unauthorized - Token cleared. Redirecting to login...");
            // Only redirect if not already on login page
            if (!window.location.pathname.includes("/login")) {
              window.location.href = "/login";
            }
          }
          const error = new Error(data.error || data.message || "Authentication failed. Please login again.") as any;
          error.status = response.status;
          error.statusText = response.statusText;
          throw error;
        }

        // Handle 400 errors specifically - validation errors
        if (response.status === 400) {
          console.error("=".repeat(60));
          console.error("[API] ❌ 400 Bad Request - Validation Error");
          console.error("=".repeat(60));
          console.error("[API] Error message:", data.error || data.message);
          console.error("[API] Full response:", JSON.stringify(data, null, 2));
          console.error("[API] Validation details:", JSON.stringify(data.details, null, 2));
          if (Array.isArray(data.details) && data.details.length > 0) {
            console.error("[API] Validation errors breakdown:");
            data.details.forEach((err: any, idx: number) => {
              console.error(`  Error ${idx + 1}:`, {
                path: err.path,
                message: err.message,
                code: err.code,
                received: err.received,
                expected: err.expected
              });
            });
          }
          console.error("=".repeat(60));
          const error = new Error(data.error || data.message || "Validation error") as any;
          error.status = response.status;
          error.statusText = response.statusText;
          error.details = data.details;
          error.validationDetails = data.details; // Alias for compatibility
          throw error;
        }

        // Handle 403 errors specifically - insufficient permissions
        if (response.status === 403) {
          console.warn("[API] 403 Forbidden - Insufficient permissions");
          console.warn("[API] Error details:", {
            error: data.error,
            message: data.message,
            userRole: data.userRole,
            requiredRoles: data.requiredRoles,
            fullResponse: data
          });
          // Don't clear token or redirect - show Not Authorized page instead
          const error = new Error(data.error || data.message || "You don't have permission to access this resource.") as any;
          error.status = response.status;
          error.statusText = response.statusText;
          error.isForbidden = true; // Flag to identify 403 errors
          error.userRole = data.userRole;
          error.requiredRoles = data.requiredRoles;
          throw error;
        }

        // Handle 409 (e.g. pool exhausted) - attach body so UI can show message
        if (response.status === 409) {
          const error = new Error(data.message || data.error || "Request failed with status 409.") as any;
          error.status = response.status;
          error.statusText = response.statusText;
          error.exhausted = !!data.exhausted;
          error.attemptCount = data.attemptCount;
          error.maxAttempts = data.maxAttempts;
          throw error;
        }

        // 500: prefer server's message so login/API errors show real cause (e.g. DB, Socket not initialized)
        if (response.status === 500) {
          const msg = data.message || data.error || `Request failed with status ${response.status}`;
          const error = new Error(msg) as any;
          error.status = response.status;
          error.statusText = response.statusText;
          throw error;
        }

        const error = new Error(data.error || data.message || `Request failed with status ${response.status}`) as any;
        error.status = response.status;
        error.statusText = response.statusText;
        throw error;
      }

      return data;
    } catch (error: any) {
      // Check if it's an optional endpoint - don't throw errors for those
      const isOptionalEndpoint = endpoint.includes("/sessions/start") ||
        endpoint.includes("/sessions/current") ||
        endpoint.includes("/auth/me");

      // Network errors
      if (error.name === "TypeError" && error.message.includes("fetch")) {
        if (isOptionalEndpoint) {
          // For optional endpoints, return null instead of throwing
          console.warn(`[API] Network error for optional endpoint ${endpoint}:`, error.message);
          return null as T;
        }
        throw new Error("Network error: Unable to connect to the server. Please check if the backend server is running on port 5000.");
      }
      // Database connection errors
      if (error.message && (
        error.message.includes("Database connection failed") ||
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("connection refused") ||
        error.message.includes("PostgreSQL")
      )) {
        throw new Error("Database connection error: PostgreSQL server is not running. Please start PostgreSQL service and try again.");
      }
      throw error;
    }
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    return this.request<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  async logout(): Promise<void> {
    return this.request<void>("/api/auth/logout", {
      method: "POST",
    });
  }

  async getCurrentUser() {
    return this.request("/api/auth/me");
  }

  async getUsers() {
    return this.request("/api/users");
  }

  async assignEmployeeCodes() {
    return this.request("/api/users/assign-employee-codes", {
      method: "POST",
    });
  }

  async getTeams() {
    return this.request("/api/users/teams");
  }

  async getMyTeam() {
    return this.request("/api/users/my-team");
  }

  async createUser(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    roleId: string;
    teamMemberIds?: string[];
    teamName?: string;
  }) {
    return this.request("/api/users", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  async updateUser(id: string, userData: {
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    roleId?: string;
    isActive?: boolean;
    teamMemberIds?: string[];
    teamName?: string;
  }) {
    return this.request(`/api/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(id: string) {
    return this.request(`/api/users/${id}`, {
      method: "DELETE",
    });
  }

  async getRoles() {
    return this.request("/api/roles");
  }

  // Leads API
  async getLeads(params?: {
    status?: string;
    assignedToUserId?: string;
    search?: string;
  }) {
    const queryString = params
      ? `?${new URLSearchParams(
        Object.entries(params).reduce((acc, [key, value]) => {
          if (value) acc[key] = value;
          return acc;
        }, {} as Record<string, string>)
      ).toString()}`
      : "";
    return this.request(`/api/leads${queryString}`);
  }

  async getLead(id: string) {
    return this.request(`/api/leads/${id}`);
  }

  async createLead(leadData: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    country?: string;
    visaType?: string;
    source?: string;
    status?: "new" | "contacted" | "qualified" | "converted" | "lost";
    notes?: string;
    assignedToId?: string;
  }) {
    return this.request("/api/leads", {
      method: "POST",
      body: JSON.stringify(leadData),
    });
  }

  async updateLead(id: string, leadData: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    country?: string;
    visaType?: string;
    source?: string;
    status?: "new" | "contacted" | "qualified" | "converted" | "lost";
    priority?: "low" | "medium" | "high" | "urgent";
    score?: number;
    notes?: string;
    assignedToId?: string;
    callStatus?: string;
    callbackScheduledAt?: string;
    discussionType?: string;
    discussionNotes?: string;
    documentsReceived?: string[];
    lastContactedAt?: string;
    nextFollowUpAt?: string;
    budgetMin?: number;
    budgetMax?: number;
    qualification?: string;
    address?: string;
    passportNumber?: string;
    passportIssueDate?: string;
    passportExpiryDate?: string;
    passportType?: string;
    occupation?: string;
    employerName?: string;
    salary?: number;
    designation?: string;
    experience?: number;
    businessName?: string;
    businessType?: string;
    businessAddress?: string;
    travelHistory?: string;
    refusalCount?: number;
    refusalCountry?: string;
    refusalReasons?: string;
  }) {
    return this.request(`/api/leads/${id}`, {
      method: "PUT",
      body: JSON.stringify(leadData),
    });
  }

  async patchLead(id: string, leadData: {
    status?: "new" | "contacted" | "qualified" | "converted" | "lost";
    priority?: "low" | "medium" | "high" | "urgent";
    notes?: string;
    [key: string]: any;
  }) {
    return this.request(`/api/leads/${id}`, {
      method: "PATCH",
      body: JSON.stringify(leadData),
    });
  }

  async assignLead(id: string, assignedToId: string) {
    return this.request(`/api/leads/${id}/assign`, {
      method: "POST",
      body: JSON.stringify({ assignedToId }),
    });
  }

  async addLeadNote(id: string, noteData: {
    title: string;
    description?: string;
    metadata?: string;
  }) {
    return this.request(`/api/leads/${id}/notes`, {
      method: "POST",
      body: JSON.stringify(noteData),
    });
  }

  async deleteLead(id: string) {
    return this.request(`/api/leads/${id}`, {
      method: "DELETE",
    });
  }

  async getDuplicateLeads(): Promise<{
    duplicates: Array<{
      key: string;
      type: "email" | "phone";
      leads: any[];
      count: number;
    }>;
    totalGroups: number;
    totalDuplicateLeads: number;
    duplicateLeadIds: string[];
  }> {
    return this.request("/api/leads/duplicates");
  }

  async deleteDuplicateLeads(): Promise<{
    message: string;
    deletedCount: number;
    keptCount: number;
  }> {
    return this.request("/api/leads/duplicates", {
      method: "DELETE",
    });
  }

  async importLeadsFromGoogleSheets(sheetUrl: string): Promise<{ message: string; imported: number }> {
    return this.request<{ message: string; imported: number }>("/api/leads/import/google-sheets", {
      method: "POST",
      body: JSON.stringify({ sheetUrl }),
    });
  }

  // Alias for compatibility
  async importLeadsFromGoogleSheet(sheetUrl: string): Promise<{ message: string; imported: number }> {
    return this.importLeadsFromGoogleSheets(sheetUrl);
  }

  async importLeadsFromCsv(file: File): Promise<{ message: string; imported: number }> {
    const formData = new FormData();
    formData.append("file", file);
    return this.importLeadsFromFile(formData);
  }

  async importLeadsFromFile(file: FormData): Promise<{ message: string; imported: number }> {
    const token = typeof window !== "undefined" ? tabStorage.getItem("token") : null;
    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/leads/import/file`, {
        method: "POST",
        headers,
        body: file,
      });

      const contentType = response.headers.get("content-type");
      const text = await response.text();

      if (!text || text.trim().length === 0) {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return { message: "Success", imported: 0 };
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        if (contentType && contentType.includes("text/html")) {
          throw new Error(`Server returned HTML instead of JSON. Status: ${response.status}. The endpoint may not exist.`);
        }
        throw new Error(text || `Failed to parse response. Status: ${response.status}`);
      }

      if (!response.ok) {
        throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
      }
      return data;
    } catch (error: any) {
      if (error.name === "TypeError" && error.message.includes("fetch")) {
        throw new Error("Network error: Unable to connect to the server. Please check if the backend server is running on port 5000.");
      }
      // Database connection errors
      if (error.message && (
        error.message.includes("Database connection failed") ||
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("connection refused") ||
        error.message.includes("PostgreSQL")
      )) {
        throw new Error("Database connection error: PostgreSQL server is not running. Please start PostgreSQL service and try again.");
      }
      throw error;
    }
  }

  async bulkCreateLeads(csvText: string): Promise<{ message: string; imported: number }> {
    return this.request<{ message: string; imported: number }>("/api/leads/import/bulk", {
      method: "POST",
      body: JSON.stringify({ csvText }),
    });
  }

  // Google Sheets Sync API
  async getSheetSyncs(): Promise<{ syncs: any[] }> {
    return this.request<{ syncs: any[] }>("/api/sheet-sync");
  }

  async createSheetSync(data: { sheetUrl: string; name?: string; syncInterval?: number }): Promise<{ message: string; sync: any }> {
    return this.request<{ message: string; sync: any }>("/api/sheet-sync", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateSheetSync(id: string, data: { name?: string; isActive?: boolean; syncInterval?: number }): Promise<{ message: string; sync: any }> {
    return this.request<{ message: string; sync: any }>(`/api/sheet-sync/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteSheetSync(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/sheet-sync/${id}`, {
      method: "DELETE",
    });
  }

  async triggerSheetSync(id: string): Promise<{ message: string; imported: number }> {
    return this.request<{ message: string; imported: number }>(`/api/sheet-sync/${id}/sync`, {
      method: "POST",
    });
  }

  // Calls API
  async getCalls(): Promise<{ calls: any[] }> {
    return this.request("/api/calls");
  }

  async getCall(id: string): Promise<{ call: any }> {
    return this.request(`/api/calls/${id}`);
  }

  async createCall(callData: {
    leadId?: string;
    phoneNumber: string;
    callType?: "outgoing" | "incoming";
    status?: "completed" | "missed" | "no_answer" | "busy" | "callback";
    duration?: number;
    notes?: string;
    callDate?: string;
  }): Promise<{ message: string; call: any }> {
    return this.request("/api/calls", {
      method: "POST",
      body: JSON.stringify(callData),
    });
  }

  async updateCall(id: string, callData: {
    status?: "completed" | "missed" | "no_answer" | "busy" | "callback";
    duration?: number;
    notes?: string;
  }): Promise<{ message: string; call: any }> {
    return this.request(`/api/calls/${id}`, {
      method: "PUT",
      body: JSON.stringify(callData),
    });
  }

  async deleteCall(id: string): Promise<{ message: string }> {
    return this.request(`/api/calls/${id}`, {
      method: "DELETE",
    });
  }

  // Reports API
  async getTeamLeaderReports(): Promise<{
    teamStats: {
      totalTeamMembers: number;
      totalLeads: number;
      totalCalls: number;
      conversionRate: number;
      avgCallDuration: number;
      leadsByStatus: {
        new: number;
        contacted: number;
        qualified: number;
        converted: number;
        lost: number;
      };
      callsByStatus: {
        completed: number;
        missed: number;
        no_answer: number;
        busy: number;
        callback: number;
      };
    };
    memberPerformance: Array<{
      id: string;
      name: string;
      email: string;
      role: string;
      totalLeads: number;
      convertedLeads: number;
      conversionRate: string;
      totalCalls: number;
      completedCalls: number;
      totalCallDuration: number;
    }>;
    dailyStats: Array<{
      date: string;
      leads: number;
      calls: number;
    }>;
  }> {
    return this.request("/api/reports/team-leader");
  }

  async getTeamMemberDetails(memberId: string): Promise<{
    member: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      role: {
        name: string;
        description?: string;
      };
      createdAt: string;
    };
    stats: {
      totalLeads: number;
      totalCalls: number;
      conversionRate: number;
      avgCallDuration: number;
      leadsByStatus: {
        new: number;
        contacted: number;
        qualified: number;
        converted: number;
        lost: number;
      };
      callsByStatus: {
        completed: number;
        missed: number;
        no_answer: number;
        busy: number;
        callback: number;
      };
    };
    leads: Array<{
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      country?: string;
      visaType?: string;
      source?: string;
      status: string;
      notes?: string;
      createdAt: string;
      createdBy?: {
        firstName: string;
        lastName: string;
      };
    }>;
    calls: Array<{
      id: string;
      leadId?: string;
      lead?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
      };
      phoneNumber: string;
      callType: string;
      status: string;
      duration?: number;
      notes?: string;
      callDate: string;
    }>;
  }> {
    return this.request(`/api/reports/team-member/${memberId}`);
  }

  async distributeLeads(data: {
    method: "round_robin" | "direct_assignment" | "equal_distribution";
    leadIds: string[];
    telecallerIds?: string[];
  }): Promise<{
    message: string;
    method: string;
    assignments: Array<{ leadId: string; telecaller: any }>;
    leads: any[];
  }> {
    return this.request("/api/leads/distribute", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getAssignmentStats(): Promise<{
    today: string;
    stats: {
      leadsAssignedToTeamLeader: number;
      leadsDistributedToTelecallers: number;
    };
    leadsAssignedToTeamLeader: Array<{
      leadId: number | null;
      id: string;
      name: string;
      assignedAt: string | null;
      assignedBy: string | null;
    }>;
    leadsDistributedToTelecallers: Array<{
      leadId: number | null;
      id: string;
      name: string;
      assignedTo: string | null;
      assignedToId: string | null;
      assignedAt: string | null;
    }>;
  }> {
    return this.request("/api/leads/assignment-stats");
  }

  // Applications API
  async getApplications() {
    return this.request<{ applications: any[] }>("/api/applications");
  }

  async getApplication(id: string) {
    return this.request<{ application: any }>(`/api/applications/${id}`);
  }

  async createApplication(data: {
    clientId: string;
    visaType: string;
    targetCountry: string;
    status?: string;
    priority?: string;
    submissionDate?: string;
    expiryDate?: string;
    fees?: number;
    notes?: string;
    assignedToId?: string;
  }) {
    return this.request<{ message: string; application: any }>("/api/applications", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateApplication(id: string, data: {
    clientId?: string;
    visaType?: string;
    targetCountry?: string;
    status?: string;
    priority?: string;
    submissionDate?: string;
    expiryDate?: string;
    fees?: number;
    notes?: string;
    assignedToId?: string;
  }) {
    return this.request<{ message: string; application: any }>(`/api/applications/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteApplication(id: string) {
    return this.request<{ message: string }>(`/api/applications/${id}`, {
      method: "DELETE",
    });
  }

  // Clients API
  async getClients() {
    return this.request<{ clients: any[] }>("/api/clients");
  }

  async getClient(id: string) {
    return this.request<{ client: any }>(`/api/clients/${id}`);
  }

  async createClient(data: {
    firstName: string;
    lastName: string;
    email?: string;
    phone: string;
    dateOfBirth?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    notes?: string;
    status?: string;
    assignedToId?: string;
  }) {
    return this.request<{ message: string; client: any }>("/api/clients", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateClient(id: string, data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    dateOfBirth?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    notes?: string;
    status?: string;
    assignedToId?: string;
  }) {
    return this.request<{ message: string; client: any }>(`/api/clients/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteClient(id: string) {
    return this.request<{ message: string }>(`/api/clients/${id}`, {
      method: "DELETE",
    });
  }

  // Client Visits API
  async getClientVisits(params?: { date?: string; clientId?: string; assignedToId?: string }) {
    const queryString = params ? `?${new URLSearchParams(params as any).toString()}` : "";
    return this.request<{ visits: any[] }>(`/api/client-visits${queryString}`);
  }

  async getClientVisit(id: string) {
    return this.request<{ visit: any }>(`/api/client-visits/${id}`);
  }

  async createClientVisit(data: {
    clientId?: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone: string;
    visitDate?: string;
    inTime?: string;
    purpose: string;
    assignedToId?: string;
    notes?: string;
  }) {
    return this.request<{ message: string; visit: any }>("/api/client-visits", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateClientVisit(id: string, data: {
    clientId?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    visitDate?: string;
    inTime?: string;
    outTime?: string;
    purpose?: string;
    assignedToId?: string;
    notes?: string;
  }) {
    return this.request<{ message: string; visit: any }>(`/api/client-visits/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteClientVisit(id: string) {
    return this.request<{ message: string }>(`/api/client-visits/${id}`, {
      method: "DELETE",
    });
  }

  // Staff/HR API
  async getStaff(params?: { role?: string; status?: string }) {
    const queryString = params ? `?${new URLSearchParams(params as any).toString()}` : "";
    return this.request<{ staff: any[] }>(`/api/staff${queryString}`);
  }

  async getStaffMember(id: string) {
    return this.request<{ staff: any }>(`/api/staff/${id}`);
  }

  async getStaffAttendance(userId: string | "all", params?: { startDate?: string; endDate?: string }) {
    const queryParams: any = { ...params };
    if (userId && userId !== "all") {
      queryParams.userId = userId;
    }
    const queryString = `?${new URLSearchParams(queryParams as any).toString()}`;
    return this.request<{ attendance: any[] }>(`/api/staff/attendance${queryString}`);
  }

  async getLoginTimes(params?: { date?: string; userId?: string; startDate?: string; endDate?: string }) {
    const queryParams: any = { ...params };
    const queryString = Object.keys(queryParams).length > 0
      ? `?${new URLSearchParams(queryParams as any).toString()}`
      : "";
    return this.request<{ loginTimes?: any[]; records?: any[] }>(`/api/login-times${queryString}`);
  }

  async createAttendance(data: {
    userId: string;
    date?: string;
    checkIn?: string;
    checkOut?: string;
    status?: "present" | "absent" | "late" | "half_day" | "on_leave";
    workHours?: number;
    notes?: string;
  }) {
    return this.request<{ message: string; attendance: any }>("/api/staff/attendance", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateAttendance(id: string, data: {
    checkIn?: string;
    checkOut?: string;
    status?: "present" | "absent" | "late" | "half_day" | "on_leave";
    workHours?: number;
    notes?: string;
  }) {
    return this.request<{ message: string; attendance: any }>(`/api/staff/attendance/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async markAttendance(data: {
    userId: string;
    date?: string;
    checkInTime?: string;
    checkOutTime?: string;
    status?: "present" | "absent" | "late" | "half_day" | "on_leave";
    workHours?: number;
    notes?: string;
  }) {
    return this.request<{ message: string; attendance: any }>("/api/staff/attendance", {
      method: "POST",
      body: JSON.stringify({
        ...data,
        checkIn: data.checkInTime,
        checkOut: data.checkOutTime,
      }),
    });
  }

  async getLeaveRequests(params?: { status?: string; userId?: string }) {
    const queryString = params ? `?${new URLSearchParams(params as any).toString()}` : "";
    return this.request<{ leaveRequests: any[] }>(`/api/staff/leave-requests${queryString}`);
  }

  async createLeaveRequest(data: {
    userId: string;
    leaveType: "casual" | "sick" | "annual" | "emergency" | "unpaid";
    startDate: string;
    endDate: string;
    reason: string;
  }) {
    return this.request<{ message: string; leaveRequest: any }>("/api/staff/leave-requests", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateLeaveRequest(id: string, data: {
    status: "pending" | "approved" | "rejected" | "cancelled";
    rejectionReason?: string;
  }) {
    return this.request<{ message: string; leaveRequest: any }>(`/api/staff/leave-requests/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async getPerformanceReviews(params?: { userId?: string }) {
    const queryString = params ? `?${new URLSearchParams(params as any).toString()}` : "";
    return this.request<{ reviews: any[] }>(`/api/staff/performance-reviews${queryString}`);
  }

  async createPerformanceReview(data: {
    userId: string;
    reviewPeriod: string;
    reviewDate?: string;
    rating: number;
    goals?: string;
    achievements?: string;
    areasForImprovement?: string;
    comments?: string;
    nextReviewDate?: string;
  }) {
    return this.request<{ message: string; review: any }>("/api/staff/performance-reviews", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Session/Attendance API
  async startSession() {
    return this.request<{ session: any; message: string }>("/api/sessions/start", {
      method: "POST",
    });
  }

  async getCurrentSession() {
    return this.request<{ session: any }>("/api/sessions/current");
  }

  async startBreak(data: {
    breakType: "break" | "meeting" | "bio_break" | "lunch" | "tea_break";
    reason?: string;
  }) {
    return this.request<{ session: any; message: string }>("/api/sessions/start-break", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async endBreak() {
    return this.request<{ session: any; message: string }>("/api/sessions/end-break", {
      method: "POST",
    });
  }

  async setStatus(status: "available" | "unavailable") {
    return this.request<{ session: any; message: string }>("/api/sessions/set-status", {
      method: "POST",
      body: JSON.stringify({ status }),
    });
  }

  async endSession() {
    return this.request<{ message: string }>("/api/sessions/end", {
      method: "POST",
    });
  }


  // Shift Management API
  async getShifts() {
    return this.request<{ shifts: any[] }>("/api/shifts");
  }

  async getShift(id: string) {
    return this.request<{ shift: any }>(`/api/shifts/${id}`);
  }

  async createShift(data: {
    name: string;
    startTime: string;
    endTime: string;
    duration: number;
    roleIds: string[];
  }) {
    return this.request<{ shift: any; message: string }>("/api/shifts", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateShift(id: string, data: {
    name?: string;
    startTime?: string;
    endTime?: string;
    duration?: number;
    isActive?: boolean;
    roleIds?: string[];
  }) {
    return this.request<{ shift: any; message: string }>(`/api/shifts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteShift(id: string) {
    return this.request<{ message: string }>(`/api/shifts/${id}`, {
      method: "DELETE",
    });
  }

  // Document Management API
  async getDocuments(params?: {
    documentType?: string;
    recipientId?: string;
    status?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const queryString = params ? `?${new URLSearchParams(params as any).toString()}` : "";
    return this.request<{ documents: any[] }>(`/api/documents${queryString}`);
  }

  async getDocument(id: string) {
    return this.request<{ document: any }>(`/api/documents/${id}`);
  }

  async createDocument(formData: FormData) {
    return fetch(`${this.baseUrl}/api/documents`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${typeof window !== "undefined" ? tabStorage.getItem("token") : ""}`,
      },
      body: formData,
    }).then(async (res) => {
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) {
        const error = new Error(data.error || `Request failed with status ${res.status}`) as any;
        error.status = res.status;
        throw error;
      }
      return data;
    });
  }

  async updateDocument(id: string, data: {
    documentType?: string;
    title?: string;
    description?: string;
    recipientId?: string;
    status?: "draft" | "sent" | "acknowledged" | "archived";
    issuedDate?: string;
    expiryDate?: string;
    tags?: string;
  }) {
    return this.request<{ document: any; message: string }>(`/api/documents/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteDocument(id: string) {
    return this.request<{ message: string }>(`/api/documents/${id}`, {
      method: "DELETE",
    });
  }

  getDocumentDownloadUrl(id: string) {
    // Return URL - the download will use Authorization header from the request
    return `${this.baseUrl}/api/documents/${id}/download`;
  }

  async downloadDocument(id: string): Promise<Blob> {
    const token = typeof window !== "undefined" ? tabStorage.getItem("token") : null;
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}/api/documents/${id}/download`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = "Failed to download document";
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return await response.blob();
  }

  async parseTemplate(formData: FormData) {
    return fetch(`${this.baseUrl}/api/documents/parse-template`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${typeof window !== "undefined" ? tabStorage.getItem("token") : ""}`,
      },
      body: formData,
    }).then(async (res) => {
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) {
        const error = new Error(data.error || `Request failed with status ${res.status}`) as any;
        error.status = res.status;
        throw error;
      }
      return data;
    });
  }

  async generateDocument(formData: FormData) {
    return fetch(`${this.baseUrl}/api/documents/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${typeof window !== "undefined" ? tabStorage.getItem("token") : ""}`,
      },
      body: formData,
    }).then(async (res) => {
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) {
        const error = new Error(data.error || `Request failed with status ${res.status}`) as any;
        error.status = res.status;
        throw error;
      }
      return data;
    });
  }

  // Google Docs Integration Methods
  async getGoogleAuthUrl() {
    return this.request<{ authUrl: string }>("/api/google-docs/auth-url");
  }

  async getGoogleConnectionStatus() {
    return this.request<{ connected: boolean; expired?: boolean }>("/api/google-docs/status");
  }

  async disconnectGoogle() {
    return this.request<{ message: string }>("/api/google-docs/disconnect", {
      method: "POST",
    });
  }

  async getGoogleDocuments() {
    return this.request<{ documents: Array<{ id: string; name: string; modifiedTime: string; createdTime: string }> }>("/api/google-docs/documents");
  }

  async getGoogleDocument(id: string) {
    return this.request<{ documentId: string; title: string; placeholders: string[]; text: string }>(`/api/google-docs/document/${id}`);
  }

  async generateGoogleDocument(data: {
    documentId: string;
    placeholderValues: Record<string, string>;
    newDocumentName?: string;
    documentType?: string;
    description?: string;
    recipientId?: string | null;
    includeBarcode?: boolean;
  }) {
    return this.request<{ documentId: string; documentUrl: string; message: string }>("/api/google-docs/generate", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }


  // Tag Flows Methods
  async getActiveTagFlows(category?: string) {
    const query = category ? `?category=${category}` : "";
    return this.request<{ tagFlows: any[] }>(`/api/tag-flows/active${query}`);
  }

  async getTagFlows() {
    return this.request<{ tagFlows: any[] }>("/api/tag-flows");
  }

  async getTagFlowsActive() {
    return this.request<{ tagFlows: any[] }>("/api/tag-flows/active");
  }

  async createTagFlow(data: {
    name: string;
    description?: string;
    tagValue: string;
    icon?: string;
    color?: string;
    category?: "call_status" | "lead_status" | "priority" | "custom";
    appliesTo?: "lead" | "call" | "task" | "all";
    isActive?: boolean;
    isExclusive?: boolean;
    requiresNote?: boolean;
    requiresCallback?: boolean;
    requiresFollowUp?: boolean;
    actions?: string;
    escalations?: string;
    order?: number;
    parentId?: string | null;
    nextTagIds?: string | null;
  }) {
    return this.request<{ tagFlow: any }>("/api/tag-flows", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateTagFlow(id: string, data: Partial<{
    name: string;
    description: string;
    tagValue: string;
    icon: string;
    color: string;
    category: "call_status" | "lead_status" | "priority" | "custom";
    isActive: boolean;
    isExclusive: boolean;
    requiresNote: boolean;
    requiresCallback: boolean;
    requiresFollowUp: boolean;
    actions: string;
    escalations: string;
    order: number;
    parentId: string | null;
    nextTagIds: string | null;
  }>) {
    return this.request<{ tagFlow: any }>(`/api/tag-flows/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteTagFlow(id: string) {
    return this.request<{ message: string }>(`/api/tag-flows/${id}`, {
      method: "DELETE",
    });
  }

  async incrementTagFlowUsage(id: string) {
    return this.request<{ tagFlow: any }>(`/api/tag-flows/${id}/increment-usage`, {
      method: "POST",
    });
  }

  // Tag Application APIs
  async applyTagToLead(leadId: string, data: {
    tagId: string;
    note?: string;
    callbackDateTime?: string;
    followUpDateTime?: string;
  }) {
    // Map tagId to tagFlowId for backend compatibility
    const requestData: any = {
      tagFlowId: data.tagId,
      note: data.note,
    };
    
    if (data.callbackDateTime) {
      requestData.callbackAt = data.callbackDateTime;
    }
    
    if (data.followUpDateTime) {
      requestData.followUpAt = data.followUpDateTime;
    }
    
    return this.request<{
      message?: string;
      tagApplication?: any;
      shuffled?: boolean;
      newOwnerId?: string;
      newOwnerName?: string;
      callbackAt?: string;
      tagApplicationId?: string;
      shuffleIndex?: number;
    }>(`/api/leads/${leadId}/tags`, {
      method: "POST",
      body: JSON.stringify(requestData),
    });
  }

  async removeTagFromLead(leadId: string, tagId: string) {
    return this.request<{ message: string }>(`/api/leads/${leadId}/tags/${tagId}`, {
      method: "DELETE",
    });
  }

  async getLeadTags(leadId: string, options?: { includeInactive?: boolean }) {
    const q = options?.includeInactive ? "?includeInactive=true" : "";
    return this.request<{ tagApplications: any[] }>(`/api/leads/${leadId}/tags${q}`);
  }

  /** Backfill callback for a lead with "No Answer" tag but missing callbackAt (permanent fix). */
  async scheduleCallbackForLead(leadId: string) {
    return this.request<{ message: string; tagApplication: { id: string; callbackAt: string | null; tagFlow: any } }>(
      `/api/leads/${leadId}/schedule-callback`,
      { method: "POST" }
    );
  }

  async applyTagToCall(callId: string, data: {
    tagId: string;
    note?: string;
    callbackDateTime?: string;
    followUpDateTime?: string;
  }) {
    // Map tagId to tagFlowId for backend compatibility
    const requestData: any = {
      tagFlowId: data.tagId,
      note: data.note,
    };
    
    if (data.callbackDateTime) {
      requestData.callbackAt = data.callbackDateTime;
    }
    
    if (data.followUpDateTime) {
      requestData.followUpAt = data.followUpDateTime;
    }
    
    return this.request<{ message: string; tagApplication: any }>(`/api/calls/${callId}/tags`, {
      method: "POST",
      body: JSON.stringify(requestData),
    });
  }

  async removeTagFromCall(callId: string, tagId: string) {
    return this.request<{ message: string }>(`/api/calls/${callId}/tags/${tagId}`, {
      method: "DELETE",
    });
  }

  async getCallTags(callId: string) {
    return this.request<{ tagApplications: any[] }>(`/api/calls/${callId}/tags`);
  }

  // Lead Activities Methods
  async createLeadActivity(data: {
    leadId: string;
    activityType: string;
    title: string;
    description?: string;
    metadata?: string;
  }) {
    return this.request<{ message: string; activity: any }>("/api/lead-activities", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getLeadActivities(leadId: string) {
    return this.request<{ activities: any[]; count: number }>(`/api/lead-activities/${leadId}`);
  }

  // Mobile API
  async getMobileStatus() {
    return this.request<{
      isRegistered: boolean;
      isOnline: boolean;
      device?: any;
    }>("/api/mobile/status", {
      method: "GET",
    });
  }

  async getMobileDeviceStatus() {
    return this.request<{
      isRegistered: boolean;
      isOnline: boolean;
      device?: {
        id: string;
        deviceId: string;
        deviceName: string;
        isOnline: boolean;
        lastSeen: string;
        hasWebSocketConnection: boolean;
      };
    }>("/api/mobile/status");
  }

  async initiateCall(phoneNumber: string, leadId?: string) {
    return this.request<{
      message: string;
      requestId: string;
      callRequest: any;
    }>("/api/calls/initiate", {
      method: "POST",
      body: JSON.stringify({
        phoneNumber,
        leadId,
      }),
    });
  }

  async registerMobileDevice(deviceId: string, deviceName?: string, fcmToken?: string, phoneNumber?: string) {
    return this.request<{
      message: string;
      device: any;
    }>("/api/mobile/register", {
      method: "POST",
      body: JSON.stringify({ deviceId, deviceName, fcmToken, phoneNumber }),
    });
  }

  async sendMobileHeartbeat(deviceId: string) {
    return this.request<{
      message: string;
      isOnline: boolean;
    }>("/api/mobile/heartbeat", {
      method: "POST",
      body: JSON.stringify({ deviceId }),
    });
  }

  async getLeadCalls(leadId: string) {
    return this.request<{
      calls: any[];
    }>(`/api/calls/lead/${leadId}`, {
      method: "GET",
    });
  }

  // Lead Search API
  async searchLeadByPhone(phone: string) {
    return this.request<{
      lead: any | null;
    }>(`/api/leads/search-by-phone?phone=${encodeURIComponent(phone)}`, {
      method: "GET",
    });
  }

  async autoCreateLead(phone: string, source?: string) {
    return this.request<{
      message: string;
      lead: any;
      created: boolean;
    }>("/api/leads/auto-create", {
      method: "POST",
      body: JSON.stringify({ phone, source }),
    });
  }

  // Tasks API
  async getTasks(params?: {
    status?: string;
    priority?: string;
    assignedToUserId?: string;
    leadId?: string;
    dueSoon?: boolean;
    overdue?: boolean;
    tags?: string; // ✅ Phase 3: Tag filter (comma-separated)
    source?: string; // ✅ Phase 3: Source filter
  }) {
    const queryString = params
      ? `?${new URLSearchParams(
        Object.entries(params).reduce((acc, [key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            acc[key] = String(value);
          }
          return acc;
        }, {} as Record<string, string>)
      ).toString()}`
      : "";
    return this.request<{ tasks: any[] }>(`/api/tasks${queryString}`);
  }

  async getTask(id: string) {
    return this.request<{ task: any }>(`/api/tasks/${id}`);
  }

  async createTask(data: {
    title: string;
    description?: string;
    type?: "FOLLOW_UP" | "INTERNAL" | "CALL" | "MEETING";
    status?: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"; // ✅ Added IN_PROGRESS
    priority?: "LOW" | "MEDIUM" | "HIGH";
    dueAt: string;
    assignedToUserId: string;
    leadId?: string;
  }) {
    return this.request<{ message: string; task: any }>("/api/tasks", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateTask(id: string, data: {
    title?: string;
    description?: string;
    type?: "FOLLOW_UP" | "INTERNAL" | "CALL" | "MEETING";
    status?: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"; // ✅ Added IN_PROGRESS
    priority?: "LOW" | "MEDIUM" | "HIGH";
    dueAt?: string;
    assignedToUserId?: string;
    leadId?: string;
  }) {
    return this.request<{ message: string; task: any }>(`/api/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async startTask(id: string) {
    // ✅ Phase 3: Start task (move to IN_PROGRESS)
    return this.request<{ message: string; task: any }>(`/api/tasks/${id}/start`, {
      method: "POST",
    });
  }

  async completeTask(id: string) {
    return this.request<{ message: string; task: any }>(`/api/tasks/${id}/complete`, {
      method: "POST",
    });
  }

  async addTaskActivity(id: string, note: string) {
    return this.request<{ message: string; activity: any }>(`/api/tasks/${id}/activity`, {
      method: "POST",
      body: JSON.stringify({ note }),
    });
  }

  // Activity Feed / Audit API
  async getActivityFeed(params?: {
    limit?: number;
    offset?: number;
    userId?: string;
  }): Promise<{
    events: any[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  }> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.offset) queryParams.append("offset", params.offset.toString());
    if (params?.userId) queryParams.append("userId", params.userId);

    return this.request(`/api/audit/feed?${queryParams.toString()}`);
  }

  async getAuditEvents(params?: {
    entityType?: string;
    entityId?: string;
    userId?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    events: any[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  }> {
    const queryParams = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });

    return this.request(`/api/audit/events?${queryParams.toString()}`);
  }

  async getAuditEvent(id: string): Promise<any> {
    return this.request(`/api/audit/events/${id}`);
  }

  // ==================== WORKFLOW METHODS ====================
  
  async getLeadActions(leadId: string, tagId?: string) {
    const url = tagId 
      ? `/api/workflows/lead/${leadId}/actions?tagId=${tagId}`
      : `/api/workflows/lead/${leadId}/actions`;
    return this.request<{ actions: any[] }>(url);
  }
  
  async getWorkflows() {
    return this.request<{ workflows: any[] }>("/api/workflows");
  }

  async getActiveWorkflow() {
    return this.request<{ workflow: any | null }>("/api/workflows/active");
  }

  async getWorkflow(id: string) {
    return this.request<{ workflow: any }>(`/api/workflows/${id}`);
  }

  async createWorkflow(data: {
    name: string;
    description?: string;
    isActive?: boolean;
    roleId?: string | null;
    workflowData: string; // JSON string
    version?: number;
  }) {
    return this.request<{ workflow: any }>("/api/workflows", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateWorkflow(id: string, data: {
    name?: string;
    description?: string;
    isActive?: boolean;
    roleId?: string | null;
    workflowData?: string;
    version?: number;
  }) {
    return this.request<{ workflow: any }>(`/api/workflows/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async activateWorkflow(id: string) {
    return this.request<{ workflow: any }>(`/api/workflows/${id}/activate`, {
      method: "POST",
    });
  }

  async deactivateWorkflow(id: string) {
    return this.request<{ workflow: any }>(`/api/workflows/${id}/deactivate`, {
      method: "POST",
    });
  }

  async deleteWorkflow(id: string) {
    return this.request<{ message: string }>(`/api/workflows/${id}`, {
      method: "DELETE",
    });
  }

  // Escalate lead to manager
  async escalateLead(leadId: string, reason?: string) {
    return this.request<{ message: string; lead: any }>(`/api/leads/${leadId}/escalate`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  }

  // Shift Management
  async getTelecallerShift() {
    return this.request<{ shiftStart: string; shiftEnd: string; isDefault: boolean }>("/api/shifts/telecaller", {
      method: "GET",
    });
  }

  async getUserShift(userId: string) {
    return this.request<{ shiftStart: string; shiftEnd: string; source: string; isDefault: boolean }>(`/api/shifts/user/${userId}`, {
      method: "GET",
    });
  }

  async getShifts() {
    return this.request<{ shiftConfigs: any[] }>("/api/shifts", {
      method: "GET",
    });
  }

  async createShiftConfig(data: { roleId?: string; userId?: string; shiftStart: string; shiftEnd: string; isActive?: boolean }) {
    return this.request<{ shiftConfig: any; message: string }>("/api/shifts", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateShiftConfig(id: string, data: Partial<{ shiftStart: string; shiftEnd: string; isActive: boolean }>) {
    return this.request<{ shiftConfig: any; message: string }>(`/api/shifts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteShiftConfig(id: string) {
    return this.request<{ message: string }>(`/api/shifts/${id}`, {
      method: "DELETE",
    });
  }

  // Execute workflow for a lead when tag is applied
  async executeWorkflow(data: {
    workflowId: string;
    leadId: string;
    triggerNodeId?: string; // Node ID that triggered the workflow (e.g., NO_ANSWER child button)
    tagId?: string; // Tag that triggered the workflow
  }) {
    return this.request<{ 
      message: string; 
      executionId: string;
      execution: any;
    }>(`/api/workflows/${data.workflowId}/execute`, {
      method: "POST",
      body: JSON.stringify({
        leadId: data.leadId,
        triggerNodeId: data.triggerNodeId,
        tagId: data.tagId,
      }),
    });
  }
}

export const apiClient = new ApiClient();

