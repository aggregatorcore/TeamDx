"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  UserCheck,
  Users,
  Calendar,
  CalendarDays,
  Award,
  User,
  Mail,
  Phone,
  Briefcase,
  Search,
  Building2,
} from "lucide-react";
import { apiClient } from "@/lib/api";

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  role: {
    id: string;
    name: string;
    description: string | null;
  };
  teamLeader: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  _count: {
    attendanceRecords: number;
    leaveRequests: number;
    performanceReviews: number;
  };
  createdAt: string;
}

// Group roles by department
const DEPARTMENT_MAPPING: Record<string, string> = {
  ADMIN: "Management",
  BRANCH_MANAGER: "Management",
  TEAM_LEADER: "Sales & Operations",
  TELECALLER: "Sales & Operations",
  COUNSELOR: "Sales & Operations",
  RECEPTIONIST: "Administration",
  FILLING_OFFICER: "Administration",
  HR_TEAM: "Human Resources",
  IT_TEAM: "Information Technology",
};

const getDepartment = (roleName: string): string => {
  return DEPARTMENT_MAPPING[roleName] || "Other";
};

export default function HRStaffPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getStaff();
      setStaff(response.staff || []);
    } catch (err: any) {
      if (err.status === 401 || err.status === 403) {
        localStorage.removeItem("user");
        router.push("/login");
        return;
      }
      setError(err.message || "Failed to fetch staff");
    } finally {
      setLoading(false);
    }
  };

  // Group staff by department
  const staffByDepartment = staff.reduce((acc, member) => {
    const department = getDepartment(member.role.name);
    if (!acc[department]) {
      acc[department] = [];
    }
    acc[department].push(member);
    return acc;
  }, {} as Record<string, StaffMember[]>);

  // Filter staff based on search
  const filteredStaffByDepartment = Object.keys(staffByDepartment).reduce((acc, department) => {
    const filtered = staffByDepartment[department].filter((member) => {
      const matchesSearch =
        member.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.role.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
    if (filtered.length > 0) {
      acc[department] = filtered;
    }
    return acc;
  }, {} as Record<string, StaffMember[]>);

  // Calculate statistics
  const totalStaff = staff.length;
  const activeStaff = staff.filter((s) => s.isActive).length;
  const totalDepartments = Object.keys(staffByDepartment).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading staff data...</p>
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
            <UserCheck className="h-7 w-7 md:h-8 md:w-8 text-primary-600" />
            Staff Directory
          </h1>
          <p className="text-gray-600">View all staff members organized by department</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Statistics */}
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">Total Staff</div>
            <div className="text-2xl font-bold text-gray-900">{totalStaff}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">Active Staff</div>
            <div className="text-2xl font-bold text-green-600">{activeStaff}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">Departments</div>
            <div className="text-2xl font-bold text-blue-600">{totalDepartments}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">Inactive</div>
            <div className="text-2xl font-bold text-red-600">{totalStaff - activeStaff}</div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Staff by Department */}
        {Object.keys(filteredStaffByDepartment).length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No staff found</h3>
            <p className="text-gray-600">Try adjusting your search</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.keys(filteredStaffByDepartment)
              .sort()
              .map((department) => (
                <div key={department} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  {/* Department Header */}
                  <div className="bg-gradient-to-r from-primary-50 to-primary-100 px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Building2 className="h-6 w-6 text-primary-600" />
                        <h2 className="text-xl font-bold text-gray-900">{department}</h2>
                        <span className="px-3 py-1 bg-primary-600 text-white text-sm font-medium rounded-full">
                          {filteredStaffByDepartment[department].length} member
                          {filteredStaffByDepartment[department].length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Staff Grid */}
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                      {filteredStaffByDepartment[department].map((member) => (
                        <div
                          key={member.id}
                          className="bg-gray-50 rounded-lg border border-gray-200 p-4 md:p-5 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="h-12 w-12 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <User className="h-6 w-6 text-primary-600" />
                              </div>
                              <div>
                                <h3 className="text-base md:text-lg font-semibold text-gray-900">
                                  {member.firstName} {member.lastName}
                                </h3>
                                <span
                                  className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-md mt-1 ${
                                    member.isActive
                                      ? "bg-green-100 text-green-700"
                                      : "bg-gray-100 text-gray-700"
                                  }`}
                                >
                                  {member.isActive ? "Active" : "Inactive"}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2 mb-4">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Mail className="h-4 w-4 flex-shrink-0" />
                              <span className="truncate">{member.email}</span>
                            </div>
                            {member.phone && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Phone className="h-4 w-4 flex-shrink-0" />
                                <span>{member.phone}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Briefcase className="h-4 w-4 flex-shrink-0" />
                              <span>{member.role.name.replace(/_/g, " ")}</span>
                            </div>
                            {member.teamLeader && (
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <UserCheck className="h-4 w-4 flex-shrink-0" />
                                <span>
                                  Team Leader: {member.teamLeader.firstName}{" "}
                                  {member.teamLeader.lastName}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-200">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>{member._count.attendanceRecords} attendance</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              <span>{member._count.leaveRequests} leaves</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Award className="h-3 w-3" />
                              <span>{member._count.performanceReviews} reviews</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}


