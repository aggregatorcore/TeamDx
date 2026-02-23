"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  Calendar,
  User,
  Search,
  Download,
  Filter,
} from "lucide-react";
import { apiClient } from "@/lib/api";

interface LoginTimeRecord {
  id: string;
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    employeeCode?: string;
    role: {
      name: string;
    };
  };
  loginTime: string;
  logoutTime: string | null;
  duration: number | null;
  deviceInfo: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export default function LoginTimePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<LoginTimeRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  useEffect(() => {
    fetchLoginTimes();
  }, [dateFilter]);

  const fetchLoginTimes = async () => {
    try {
      setLoading(true);
      setError(null);
      // Note: This endpoint may need to be created in the backend
      // For now, using a placeholder that should work with existing API structure
      const response = await apiClient.getLoginTimes({ date: dateFilter || undefined });
      setRecords(response.loginTimes || response.records || []);
    } catch (err: any) {
      console.error("Failed to fetch login times:", err);
      if (err.status === 401 || err.status === 403) {
        router.push("/login");
        return;
      }
      // If endpoint doesn't exist yet, show empty state with message
      if (err.message?.includes("not found") || err.status === 404) {
        setRecords([]);
        setError("Login time tracking feature is being set up. Please check back later.");
      } else {
        setError(err.message || "Failed to fetch login times");
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = records.filter((record) => {
    const matchesSearch =
      record.user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (record.user.employeeCode && record.user.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesSearch;
  });

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return "N/A";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading login time records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <Clock className="h-7 w-7 md:h-8 md:w-8 text-primary-600" />
            Login Time Tracking
          </h1>
          <p className="text-gray-600">View employee login and logout times</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or employee code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-400" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter("")}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Statistics */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">Total Records</div>
            <div className="text-2xl font-bold text-gray-900">{filteredRecords.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">Active Sessions</div>
            <div className="text-2xl font-bold text-green-600">
              {filteredRecords.filter((r) => !r.logoutTime).length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">Completed Sessions</div>
            <div className="text-2xl font-bold text-blue-600">
              {filteredRecords.filter((r) => r.logoutTime).length}
            </div>
          </div>
        </div>

        {/* Records Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Employee
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Login Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Logout Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      {records.length === 0 ? (
                        <div>
                          <Clock className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                          <p>No login time records found</p>
                          <p className="text-sm mt-1">Login time tracking will appear here once available</p>
                        </div>
                      ) : (
                        "No records match your search"
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="h-5 w-5 text-primary-600" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {record.user.firstName} {record.user.lastName}
                            </div>
                            <div className="text-xs text-gray-500">
                              {record.user.employeeCode && `ID: ${record.user.employeeCode} • `}
                              {record.user.email}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {record.user.role.name.replace(/_/g, " ")}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(record.loginTime).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {record.logoutTime
                            ? new Date(record.logoutTime).toLocaleString()
                            : "-"}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatDuration(record.duration)}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {record.logoutTime ? (
                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-md bg-green-100 text-green-700">
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-md bg-yellow-100 text-yellow-700">
                            Active
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
