"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, Clock, LogIn, LogOut, Search, CheckCircle2, X, ArrowLeft, User, FileText, Calendar, RefreshCw, Download } from "lucide-react";
import { apiClient } from "@/lib/api";
import { tabStorage } from "@/lib/storage";

interface StaffMember {
  id: string;
  employeeCode?: string | null;
  firstName: string;
  lastName: string;
  email: string;
  role: { name: string; id: string };
}

interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  duration: number;
  isActive: boolean;
  roleShifts?: Array<{
    role: {
      id: string;
      name: string;
    };
  }>;
}

interface AttendanceEntry {
  id: string;
  userId: string;
  user: StaffMember;
  checkIn: string;
  checkOut?: string | null;
  date: string;
  shift?: Shift;
}

export default function StaffAttendancePage() {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [todayEntries, setTodayEntries] = useState<AttendanceEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [showFullReportModal, setShowFullReportModal] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  
  // Date filter states
  const [filterStartDate, setFilterStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterEndDate, setFilterEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [allAttendance, setAllAttendance] = useState<AttendanceEntry[]>([]);
  const [staffNameFilter, setStaffNameFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [shiftFilter, setShiftFilter] = useState("");

  useEffect(() => {
    // Get user role from storage
    const userStr = tabStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setUserRole(user.role?.name || null);
      } catch (e) {
        console.error("Error parsing user data:", e);
      }
    }
    
    fetchStaff();
    fetchShifts();
    fetchTodayAttendance();
    
    // Set initial loading to false after attempts
    setTimeout(() => setInitialLoading(false), 2000);
  }, []);

  const fetchShifts = async () => {
    try {
      const response = await apiClient.getShifts() as any;
      console.log("✅ Shifts API response:", response);
      console.log("✅ Shifts array:", response.shifts);
      console.log("✅ Shifts count:", response.shifts?.length || 0);
      
      if (response.shifts && response.shifts.length > 0) {
        console.log("✅ First shift:", response.shifts[0]);
        setShifts(response.shifts);
      } else {
        console.warn("⚠️ No shifts found in database");
        setShifts([]);
      }
    } catch (err) {
      console.error("❌ Failed to fetch shifts:", err);
      setShifts([]);
    }
  };

  // Get shift for a specific user based on their role
  const getUserShift = (user: StaffMember) => {
    console.log(`🔍 Finding shift for ${user.firstName} (${user.role?.name}), Total shifts: ${shifts.length}`);
    
    // Default fallback shift if no shifts in database
    const defaultShift: Shift = {
      id: 'default',
      name: 'Day Shift',
      startTime: '09:00',
      endTime: '17:00',
      duration: 8,
      isActive: true,
    };
    
    if (shifts.length === 0) {
      console.warn("⚠️ No shifts in database, using default shift");
      return defaultShift;
    }
    
    // Find shift that has this user's role assigned
    const userRoleId = user.role?.id;
    const userRoleName = user.role?.name;
    
    console.log(`  👤 User role: ${userRoleName} (ID: ${userRoleId})`);
    
    // Try to find shift with matching role
    let userShift = null;
    
    for (const shift of shifts) {
      console.log(`  🔍 Checking shift: ${shift.name}`);
      console.log(`     - roleShifts:`, shift.roleShifts);
      
      if (shift.roleShifts && shift.roleShifts.length > 0) {
        const hasRole = shift.roleShifts.some(rs => 
          rs.role.id === userRoleId || rs.role.name === userRoleName
        );
        
        if (hasRole) {
          userShift = shift;
          console.log(`  ✅ MATCH! ${user.firstName} assigned to ${shift.name}`);
          break;
        }
      }
    }
    
    // Fallback to first active shift if no specific match
    if (!userShift) {
      userShift = shifts.find(s => s.isActive) || shifts[0] || defaultShift;
      console.log(`  📌 No specific shift match, using default: ${userShift.name}`);
    }
    
    return userShift;
  };

  // Helper: Check if check-in is late
  const isLate = (checkInTime: string, shiftStartTime: string) => {
    const checkIn = new Date(`1970-01-01T${new Date(checkInTime).toTimeString().slice(0, 5)}`);
    const shiftStart = new Date(`1970-01-01T${shiftStartTime}`);
    return checkIn > shiftStart;
  };

  // Helper: Calculate late/early minutes
  const getTimeDifference = (checkInTime: string, shiftStartTime: string) => {
    const checkIn = new Date(`1970-01-01T${new Date(checkInTime).toTimeString().slice(0, 5)}`);
    const shiftStart = new Date(`1970-01-01T${shiftStartTime}`);
    const diff = Math.abs(checkIn.getTime() - shiftStart.getTime()) / (1000 * 60);
    return Math.round(diff);
  };

  const fetchStaff = async () => {
    try {
      const response = await apiClient.getStaff();
      setStaff(response.staff || []);
    } catch (err: any) {
      console.error("Failed to fetch staff:", err);
      if (err.message?.includes("Insufficient permissions") || err.message?.includes("permission") || err.message?.includes("Access denied")) {
        setAccessDenied(true);
        setError("⚠️ Access Denied: This page is only accessible to Receptionist and Admin roles.");
      } else {
        setError("Failed to load staff members. Please try again.");
      }
    }
  };

  const fetchTodayAttendance = async () => {
    try {
      // Fetch ALL attendance without date filter to debug
      const response = await apiClient.getStaffAttendance("all", {});
      
      console.log("✅ Attendance data (all):", response.attendance);
      console.log("✅ Total records:", response.attendance?.length || 0);
      
      if (response.attendance && response.attendance.length > 0) {
        console.log("📋 Sample record:", response.attendance[0]);
        console.log("   - date field:", response.attendance[0].date);
        console.log("   - checkIn field:", response.attendance[0].checkIn);
      }
      
      // Store all attendance for filtering
      setAllAttendance(response.attendance || []);
      
      // Filter today's entries on frontend
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      
      console.log("📅 Today's date string:", todayStr);
      
      const todayData = (response.attendance || []).filter((entry: any) => {
        // Try multiple date formats
        const entryDate = new Date(entry.date);
        entryDate.setHours(0, 0, 0, 0);
        const entryDateStr = entryDate.toISOString().split('T')[0];
        
        console.log(`  - Entry date: ${entryDateStr}, Today: ${todayStr}, Match: ${entryDateStr === todayStr}`);
        
        return entryDateStr === todayStr;
      });
      
      console.log("✅ Today's filtered entries:", todayData);
      console.log("✅ Count:", todayData.length);
      
      setTodayEntries((prev) => {
        // Keep existing entries that are in todayData OR were added optimistically
        const merged = [...todayData];
        
        // Add any optimistic entries that aren't in server response yet
        prev.forEach((entry) => {
          if (!todayData.find((d: any) => d.userId === entry.userId)) {
            merged.push(entry);
          }
        });
        
        console.log("✅ Final merged entries:", merged);
        return merged;
      });
    } catch (err: any) {
      console.error("❌ Failed to fetch attendance:", err);
      setError(err.message || "Failed to load attendance data");
    }
  };

  // Filter attendance by date range
  const getFilteredAttendance = () => {
    console.log("🔍 Filtering attendance...");
    console.log("  Total records:", allAttendance.length);
    console.log("  Filter range:", filterStartDate, "to", filterEndDate);
    
    const filtered = allAttendance.filter((entry: any) => {
      const entryDate = new Date(entry.date);
      entryDate.setHours(0, 0, 0, 0);
      const entryDateStr = entryDate.toISOString().split('T')[0];
      
      console.log(`  Entry: ${entryDateStr}, Range: ${filterStartDate} - ${filterEndDate}, Match: ${entryDateStr >= filterStartDate && entryDateStr <= filterEndDate}`);
      
      return entryDateStr >= filterStartDate && entryDateStr <= filterEndDate;
    });
    
    console.log("✅ Filtered results:", filtered.length);
    return filtered;
  };

  // Quick date filter functions
  const setToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setFilterStartDate(today);
    setFilterEndDate(today);
  };

  const setYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    setFilterStartDate(dateStr);
    setFilterEndDate(dateStr);
  };

  const setThisWeek = () => {
    const today = new Date();
    const firstDay = new Date(today.setDate(today.getDate() - today.getDay()));
    const lastDay = new Date(today.setDate(today.getDate() - today.getDay() + 6));
    setFilterStartDate(firstDay.toISOString().split('T')[0]);
    setFilterEndDate(lastDay.toISOString().split('T')[0]);
  };

  const setThisMonth = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    setFilterStartDate(firstDay.toISOString().split('T')[0]);
    setFilterEndDate(lastDay.toISOString().split('T')[0]);
  };

  // Export to CSV
  const exportToCSV = (data: any[]) => {
    if (data.length === 0) {
      setError("No data to export");
      return;
    }

    // CSV Headers
    const headers = ["Date", "Employee Code", "Name", "Role", "Shift", "Check IN", "Check OUT", "Hours", "Status"];
    
    // CSV Rows
    const rows = data.map((entry: any) => {
      const userShift = getUserShift(entry.user);
      const actualHours = entry.checkIn && entry.checkOut ? 
        ((new Date(entry.checkOut).getTime() - new Date(entry.checkIn).getTime()) / (1000 * 60 * 60)).toFixed(1) : 
        "In Progress";
      
      const status = !entry.checkOut ? "Active" : 
        (parseFloat(actualHours) >= (userShift?.duration || 8) ? "Complete" : "Short");

      return [
        new Date(entry.date).toLocaleDateString(),
        entry.user.employeeCode || "-",
        `${entry.user.firstName} ${entry.user.lastName}`,
        entry.user.role?.name || "-",
        userShift?.name || "-",
        entry.checkIn ? new Date(entry.checkIn).toLocaleTimeString() : "-",
        entry.checkOut ? new Date(entry.checkOut).toLocaleTimeString() : "-",
        actualHours,
        status,
      ];
    });

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    const fileName = `attendance_report_${filterStartDate}_to_${filterEndDate}.csv`;
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSuccess(`✓ Exported ${data.length} records to CSV!`);
    setTimeout(() => setSuccess(null), 3000);
  };

  // Export to Excel (HTML table format)
  const exportToExcel = (data: any[]) => {
    if (data.length === 0) {
      setError("No data to export");
      return;
    }

    // Create HTML table
    let tableHTML = `
      <table border="1" style="border-collapse: collapse; width: 100%;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="padding: 8px;">Date</th>
            <th style="padding: 8px;">Employee Code</th>
            <th style="padding: 8px;">Name</th>
            <th style="padding: 8px;">Role</th>
            <th style="padding: 8px;">Shift</th>
            <th style="padding: 8px;">Check IN</th>
            <th style="padding: 8px;">Check OUT</th>
            <th style="padding: 8px;">Hours</th>
            <th style="padding: 8px;">Status</th>
          </tr>
        </thead>
        <tbody>
    `;

    data.forEach((entry: any) => {
      const userShift = getUserShift(entry.user);
      const actualHours = entry.checkIn && entry.checkOut ? 
        ((new Date(entry.checkOut).getTime() - new Date(entry.checkIn).getTime()) / (1000 * 60 * 60)).toFixed(1) : 
        "In Progress";
      
      const status = !entry.checkOut ? "Active" : 
        (parseFloat(actualHours) >= (userShift?.duration || 8) ? "Complete" : "Short");

      tableHTML += `
        <tr>
          <td style="padding: 8px;">${new Date(entry.date).toLocaleDateString()}</td>
          <td style="padding: 8px;">${entry.user.employeeCode || "-"}</td>
          <td style="padding: 8px;">${entry.user.firstName} ${entry.user.lastName}</td>
          <td style="padding: 8px;">${entry.user.role?.name || "-"}</td>
          <td style="padding: 8px;">${userShift?.name || "-"} (${userShift?.startTime}-${userShift?.endTime})</td>
          <td style="padding: 8px;">${entry.checkIn ? new Date(entry.checkIn).toLocaleTimeString() : "-"}</td>
          <td style="padding: 8px;">${entry.checkOut ? new Date(entry.checkOut).toLocaleTimeString() : "-"}</td>
          <td style="padding: 8px;">${actualHours}</td>
          <td style="padding: 8px;">${status}</td>
        </tr>
      `;
    });

    tableHTML += `
        </tbody>
      </table>
    `;

    // Create blob and download as Excel
    const blob = new Blob([tableHTML], { type: "application/vnd.ms-excel" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    const fileName = `attendance_report_${filterStartDate}_to_${filterEndDate}.xls`;
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSuccess(`✓ Exported ${data.length} records to Excel!`);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleCheckIn = async () => {
    if (!selectedStaffId) {
      setError("Please select a staff member");
      return;
    }

    // Check if already checked in today
    const existingEntry = todayEntries.find(
      (entry) => entry.userId === selectedStaffId && !entry.checkOut
    );

    if (existingEntry) {
      setError("This staff member is already checked in!");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log("🔵 Check-in request for userId:", selectedStaffId);
      
      const response = await apiClient.markAttendance({
        userId: selectedStaffId,
        status: "present",
        checkInTime: new Date().toISOString(),
      });

      console.log("✅ Check-in response:", response);

      const selectedStaff = staff.find((s) => s.id === selectedStaffId);
      const staffName = selectedStaff 
        ? `${selectedStaff.firstName} ${selectedStaff.lastName}` 
        : "Staff";

      // Immediately update UI with new entry (optimistic update)
      if (response.attendance && selectedStaff) {
        const newEntry: AttendanceEntry = {
          id: response.attendance.id || Date.now().toString(),
          userId: selectedStaffId,
          user: selectedStaff,
          checkIn: new Date().toISOString(),
          checkOut: null,
          date: new Date().toISOString(),
        };
        
        setTodayEntries((prev) => [newEntry, ...prev]);
        console.log("✅ Added new entry to UI immediately");
      }

      setSuccess(`✅ ${staffName} checked IN at ${new Date().toLocaleTimeString()}`);
      setTimeout(() => setSuccess(null), 3000);
      
      setSelectedStaffId("");
      setSearchTerm("");
      
      // Sync with server after delay
      setTimeout(async () => {
        console.log("🔄 Syncing with server...");
        await fetchTodayAttendance();
      }, 2000);
    } catch (err: any) {
      console.error("❌ Check-in error:", err);
      setError(err.message || "Failed to mark check-in");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async (entryId: string, userId: string) => {
    setLoading(true);
    setError(null);

    try {
      console.log("🔵 Check-out request for entryId:", entryId);
      
      // Find the entry to preserve check-in time
      const currentEntry = todayEntries.find((e) => e.id === entryId);
      
      await apiClient.updateAttendance(entryId, {
        checkOut: new Date().toISOString(),
      });

      const entry = todayEntries.find((e) => e.id === entryId);
      const staffName = entry 
        ? `${entry.user.firstName} ${entry.user.lastName}` 
        : "Staff";

      // Immediately update UI (optimistic update)
      setTodayEntries((prev) =>
        prev.map((e) =>
          e.id === entryId ? { ...e, checkOut: new Date().toISOString() } : e
        )
      );

      setSuccess(`✅ ${staffName} checked OUT at ${new Date().toLocaleTimeString()}`);
      setTimeout(() => setSuccess(null), 3000);
      
      // Sync with server
      setTimeout(async () => {
        await fetchTodayAttendance();
      }, 1000);
    } catch (err: any) {
      console.error("❌ Check-out error:", err);
      setError(err.message || "Failed to mark check-out");
    } finally {
      setLoading(false);
    }
  };

  const filteredStaff = staff.filter(
    (member) =>
      member.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.employeeCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sort by check-in time - LATEST FIRST (newest on top)
  const sortedEntries = [...todayEntries].sort((a, b) => {
    const timeA = new Date(a.checkIn).getTime();
    const timeB = new Date(b.checkIn).getTime();
    return timeB - timeA; // Descending order (latest first)
  });

  const checkedInStaff = sortedEntries.filter((entry) => !entry.checkOut);
  const checkedOutStaff = sortedEntries.filter((entry) => entry.checkOut);

  // Show loading screen
  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show access denied screen
  if (accessDenied) {
    return (
      <div className="w-full">
        <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto">
          <button
            onClick={() => router.back()}
            className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back</span>
          </button>

          <div className="bg-white rounded-xl shadow-lg border border-red-200 p-12 text-center">
            <div className="mb-6">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <X className="h-8 w-8 text-red-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Access Denied</h1>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              You don't have permission to access Staff Attendance Entry. 
              This page is only available for <strong>Receptionist</strong> and <strong>Admin</strong> roles.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => router.back()}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Go Back
              </button>
              <button
                onClick={() => router.push("/dashboard")}
                className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back</span>
        </button>

        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <UserCheck className="h-8 w-8 text-primary-600" />
              Staff Attendance {userRole === "ADMIN" ? "Report" : "Entry"}
            </h1>
            <p className="text-gray-600 mt-1">
              {userRole === "ADMIN" 
                ? "View and manage staff attendance records" 
                : "Mark staff check-in and check-out times"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                setLoading(true);
                await fetchTodayAttendance();
                setLoading(false);
                setSuccess("✓ Data refreshed!");
                setTimeout(() => setSuccess(null), 2000);
              }}
              disabled={loading}
              className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 font-medium shadow-lg disabled:opacity-50"
            >
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
              Refresh Data
            </button>
            <button
              onClick={() => setShowFullReportModal(true)}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 font-medium shadow-lg"
            >
              <FileText className="h-5 w-5" />
              View Full Report
            </button>
          </div>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800">
            <CheckCircle2 className="h-5 w-5" />
            {success}
          </div>
        )}
        {error && !accessDenied && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
            <X className="h-5 w-5" />
            {error}
          </div>
        )}

        {/* Check-In Section - Only visible to RECEPTIONIST */}
        {userRole === "RECEPTIONIST" && (
          <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <LogIn className="h-5 w-5 text-green-600" />
            Mark Staff Entry (Check-In)
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Select Staff Dropdown */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Staff Member
              </label>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white text-base"
              >
                <option value="">-- Select a staff member --</option>
                {staff.length === 0 ? (
                  <option disabled>Loading staff...</option>
                ) : (
                  staff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.firstName} {member.lastName}
                      {member.employeeCode && ` (${member.employeeCode})`}
                      {!member.employeeCode && ` - ${member.role.name}`}
                    </option>
                  ))
                )}
              </select>
              <p className="mt-2 text-xs text-gray-500">
                Total staff members: {staff.length}
              </p>
            </div>

            {/* Check-In Button */}
            <div className="flex items-end">
              <button
                onClick={handleCheckIn}
                disabled={loading || !selectedStaffId}
                className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <LogIn className="h-5 w-5" />
                Check IN
              </button>
            </div>
          </div>

          {/* Current Time Display */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <Clock className="h-4 w-4 inline mr-2" />
              Current Time: <span className="font-semibold">{new Date().toLocaleString()}</span>
            </p>
          </div>
        </div>
        )}

        {/* Today's Attendance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Checked IN (Active) */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-green-50 border-b border-green-200">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Checked IN ({checkedInStaff.length})
              </h3>
            </div>
            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
              {checkedInStaff.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No staff currently checked in</p>
              ) : (
                checkedInStaff.map((entry, index) => {
                  // Get shift for this specific user
                  const userShift = getUserShift(entry.user);
                  const late = userShift && entry.checkIn ? isLate(entry.checkIn, userShift.startTime) : false;
                  const timeDiff = userShift && entry.checkIn ? getTimeDifference(entry.checkIn, userShift.startTime) : 0;
                  const entryDate = new Date(entry.date);

                  return (
                    <div key={entry.id} className={`p-4 rounded-lg border-2 transition-all ${
                      index === 0 ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300 ring-2 ring-blue-200' : 
                      'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
                    }`}>
                      {index === 0 && (
                        <div className="mb-2 flex items-center gap-2">
                          <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">
                            LATEST
                          </span>
                          <span className="text-xs text-blue-700">Most recent punch</span>
                        </div>
                      )}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 flex items-center gap-2">
                            {entry.user.firstName} {entry.user.lastName}
                            {entry.user.employeeCode && (
                              <span className="text-sm text-primary-600 font-medium">
                                ({entry.user.employeeCode})
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-600 mt-0.5">{entry.user.role?.name || entry.user.email}</p>
                          
                          {/* Date Display */}
                          <div className="mt-2 flex items-center gap-2 text-xs">
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {entryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                          
                          {/* Shift Info */}
                          {userShift && (
                            <div className="mt-1 flex items-center gap-2 text-xs">
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">
                                🕐 {userShift.name}
                              </span>
                              <span className="text-gray-600 font-medium">
                                {userShift.startTime} - {userShift.endTime}
                              </span>
                              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-bold">
                                {userShift.duration}h
                              </span>
                            </div>
                          )}
                          {!userShift && (
                            <div className="mt-1 text-xs text-orange-600">
                              ⚠️ No shift assigned
                            </div>
                          )}
                        </div>
                        {/* Check Out button - Only visible to RECEPTIONIST */}
                        {userRole === "RECEPTIONIST" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCheckOut(entry.id, entry.userId);
                            }}
                            disabled={loading}
                            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 text-sm"
                          >
                            <LogOut className="h-4 w-4" />
                            Check OUT
                          </button>
                        )}
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 text-green-700 font-medium">
                            <Clock className="h-4 w-4" />
                            IN: {entry.checkIn ? new Date(entry.checkIn).toLocaleTimeString() : "N/A"}
                          </div>
                          
                          {/* Late/Early Indicator */}
                          {userShift && entry.checkIn && late && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full flex items-center gap-1">
                              ⚠️ Late by {timeDiff}min
                            </span>
                          )}
                          {userShift && entry.checkIn && !late && timeDiff > 0 && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full flex items-center gap-1">
                              ✓ Early by {timeDiff}min
                            </span>
                          )}
                          {userShift && entry.checkIn && !late && timeDiff === 0 && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                              ✓ On Time
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Checked OUT (Completed) */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <LogOut className="h-5 w-5 text-gray-600" />
                Checked OUT ({checkedOutStaff.length})
              </h3>
            </div>
            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
              {checkedOutStaff.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No completed entries today</p>
              ) : (
                checkedOutStaff.map((entry, index) => {
                  const userShift = getUserShift(entry.user);
                  const late = userShift && entry.checkIn ? isLate(entry.checkIn, userShift.startTime) : false;
                  const timeDiff = userShift && entry.checkIn ? getTimeDifference(entry.checkIn, userShift.startTime) : 0;
                  const entryDate = new Date(entry.date);
                  
                  const actualHours = entry.checkIn && entry.checkOut ? 
                    ((new Date(entry.checkOut).getTime() - new Date(entry.checkIn).getTime()) / (1000 * 60 * 60)).toFixed(1) : 
                    "0";
                  const shiftHours = userShift?.duration || 8;
                  const hoursShort = parseFloat(actualHours) < shiftHours;

                  return (
                    <div key={entry.id} className={`p-4 rounded-lg border-2 ${
                      index === 0 ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-blue-300 ring-2 ring-blue-200' :
                      'bg-gray-50 border-gray-200'
                    }`}>
                      {index === 0 && (
                        <div className="mb-2 flex items-center gap-2">
                          <span className="px-2 py-1 bg-purple-600 text-white text-xs font-bold rounded-full">
                            LATEST CHECKOUT
                          </span>
                        </div>
                      )}
                      <div className="mb-3">
                        <p className="font-semibold text-gray-900 flex items-center gap-2">
                          {entry.user.firstName} {entry.user.lastName}
                          {entry.user.employeeCode && (
                            <span className="text-sm text-primary-600 font-medium">
                              ({entry.user.employeeCode})
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5">{entry.user.role?.name || entry.user.email}</p>
                        
                        {/* Date Display */}
                        <div className="mt-2 flex items-center gap-2 text-xs">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {entryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        
                        {/* Shift Info */}
                        {userShift && (
                          <div className="mt-1 flex items-center gap-2 text-xs">
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">
                              🕐 {userShift.name}
                            </span>
                            <span className="text-gray-600 font-medium">
                              {userShift.startTime} - {userShift.endTime}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-green-700">
                            <Clock className="h-4 w-4" />
                            IN: {entry.checkIn ? new Date(entry.checkIn).toLocaleTimeString() : "N/A"}
                          </div>
                          {late && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                              ⚠️ {timeDiff}min late
                            </span>
                          )}
                        </div>
                        
                        {entry.checkOut && (
                          <>
                            <div className="flex items-center gap-2 text-red-700">
                              <Clock className="h-4 w-4" />
                              OUT: {new Date(entry.checkOut).toLocaleTimeString()}
                            </div>
                            <div className="pt-2 border-t border-gray-300">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-blue-700 font-bold">
                                  <Clock className="h-4 w-4" />
                                  Total: {actualHours}h
                                </div>
                                {userShift && (
                                  <div className="text-xs">
                                    <span className={`px-2 py-1 rounded-full font-medium ${
                                      hoursShort ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                                    }`}>
                                      {hoursShort ? `⚠️ ${shiftHours - parseFloat(actualHours)}h short` : `✓ Full shift`}
                                    </span>
                                  </div>
                                )}
                              </div>
                              {userShift && (
                                <p className="text-xs text-gray-600 mt-1">
                                  Expected: {shiftHours}h | Actual: {actualHours}h
                                </p>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Full Report Modal */}
        {showFullReportModal && (() => {
          // Use allAttendance if available, otherwise use todayEntries
          const dataToFilter = allAttendance.length > 0 ? allAttendance : todayEntries;
          console.log("📊 Modal data source:", dataToFilter.length, "records");
          
          console.log("🔍 Starting filter with dates:", filterStartDate, "to", filterEndDate);
          
          const filteredData = dataToFilter.filter((entry: any, idx: number) => {
            if (!entry.date) {
              console.log(`  ⚠️ Entry ${idx} has no date field!`);
              return false;
            }
            
            // Parse entry date
            const entryDate = new Date(entry.date);
            const entryYear = entryDate.getFullYear();
            const entryMonth = String(entryDate.getMonth() + 1).padStart(2, '0');
            const entryDay = String(entryDate.getDate()).padStart(2, '0');
            const entryDateStr = `${entryYear}-${entryMonth}-${entryDay}`;
            
            if (idx === 0) { // Log only first entry for debugging
              console.log(`  📅 Entry date raw: ${entry.date}`);
              console.log(`  📅 Entry date formatted: ${entryDateStr}`);
              console.log(`  📅 Filter start: ${filterStartDate}`);
              console.log(`  📅 Filter end: ${filterEndDate}`);
            }
            
            // Date filter
            const dateMatch = entryDateStr >= filterStartDate && entryDateStr <= filterEndDate;
            
            // Staff filter (by ID)
            const nameMatch = !staffNameFilter || entry.user?.id === staffNameFilter;
            
            // Role filter
            const roleName = entry.user?.role?.name || '';
            const roleMatch = !roleFilter || roleName === roleFilter;
            
            // Shift filter (based on assigned shift)
            const userShift = getUserShift(entry.user);
            const shiftMatch = !shiftFilter || userShift?.name === shiftFilter;
            
            if (idx === 0) {
              console.log(`  ✅ Date match: ${dateMatch}, Name match: ${nameMatch}, Role match: ${roleMatch}, Shift match: ${shiftMatch}`);
            }
            
            return dateMatch && nameMatch && roleMatch && shiftMatch;
          });
          
          console.log("📊 Filtered data:", filteredData.length, "records");
          
          const sortedFilteredData = [...filteredData].sort((a: any, b: any) => {
            return new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime();
          });
          
          return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-7xl w-full max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                      <FileText className="h-6 w-6 text-indigo-600" />
                      Attendance Report
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      {filterStartDate === filterEndDate 
                        ? new Date(filterStartDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                        : `${new Date(filterStartDate).toLocaleDateString()} - ${new Date(filterEndDate).toLocaleDateString()}`
                      }
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        await fetchTodayAttendance();
                        setSuccess("✓ Data refreshed!");
                        setTimeout(() => setSuccess(null), 2000);
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                      <RefreshCw className="h-5 w-5" />
                      Refresh
                    </button>
                    <button
                      onClick={() => setShowFullReportModal(false)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>
                </div>

                {/* Compact Filter Section */}
                <div className="px-6 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Date Filters */}
                    <input
                      type="date"
                      value={filterStartDate}
                      onChange={(e) => setFilterStartDate(e.target.value)}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <span className="text-gray-600 text-sm">to</span>
                    <input
                      type="date"
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    
                    <span className="mx-2 text-gray-400">|</span>
                    
                    {/* Staff Dropdown */}
                    <select
                      value={staffNameFilter}
                      onChange={(e) => setStaffNameFilter(e.target.value)}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    >
                      <option value="">All Staff</option>
                      {staff
                        .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
                        .map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.firstName} {member.lastName}
                            {member.employeeCode && ` (${member.employeeCode})`}
                          </option>
                        ))}
                    </select>
                    
                    {/* Role Dropdown */}
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    >
                      <option value="">All Roles</option>
                      <option value="TELECALLER">Telecaller</option>
                      <option value="RECEPTIONIST">Receptionist</option>
                      <option value="TEAM_LEADER">Team Leader</option>
                      <option value="COUNSELOR">Counselor</option>
                      <option value="HR_TEAM">HR Team</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                    
                    <span className="mx-2 text-gray-400">|</span>
                    
                    {/* Quick Buttons */}
                    <button onClick={setToday} className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">Today</button>
                    <button onClick={setYesterday} className="px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700">Yesterday</button>
                    <button onClick={setThisWeek} className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">Week</button>
                    <button onClick={setThisMonth} className="px-2 py-1 bg-orange-600 text-white rounded text-xs hover:bg-orange-700">Month</button>
                    
                    {/* Clear Filters */}
                    {(staffNameFilter || roleFilter) && (
                      <button
                        onClick={() => {
                          setStaffNameFilter("");
                          setRoleFilter("");
                          setShiftFilter("");
                        }}
                        className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                      >
                        ✕ Clear
                      </button>
                    )}
                  </div>
                </div>

              {/* Compact Statistics */}
              <div className="grid grid-cols-5 gap-3 px-6 py-3 bg-gray-50 border-b border-gray-200">
                <div className="text-center">
                  <p className="text-xl font-bold text-blue-600">{filteredData.length}</p>
                  <p className="text-xs text-gray-600">Total</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-green-600">
                    {filteredData.filter((e: any) => !e.checkOut).length}
                  </p>
                  <p className="text-xs text-gray-600">IN</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-gray-600">
                    {filteredData.filter((e: any) => e.checkOut).length}
                  </p>
                  <p className="text-xs text-gray-600">OUT</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-orange-600">
                    {filteredData.filter((e: any) => {
                      const userShift = getUserShift(e.user);
                      return userShift && e.checkIn ? isLate(e.checkIn, userShift.startTime) : false;
                    }).length}
                  </p>
                  <p className="text-xs text-gray-600">Late</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-purple-600">
                    {filteredData.length > 0 
                      ? (filteredData.reduce((sum: number, e: any) => {
                          if (!e.checkIn || !e.checkOut) return sum;
                          const hours = (new Date(e.checkOut).getTime() - new Date(e.checkIn).getTime()) / (1000 * 60 * 60);
                          return sum + hours;
                        }, 0) / filteredData.filter((e: any) => e.checkOut).length).toFixed(1)
                      : "0"}h
                  </p>
                  <p className="text-xs text-gray-600">Avg</p>
                </div>
              </div>

              {/* Table */}
              <div className="flex-1 overflow-auto bg-white">
                <table className="w-full">
                  <thead className="sticky top-0 z-50">
                    <tr className="bg-gray-200 border-b-2 border-gray-400">
                      <th className="px-4 py-4 text-left text-xs font-bold text-gray-800 uppercase bg-gray-200 border-b-2 border-gray-400">#</th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-gray-800 uppercase bg-gray-200 border-b-2 border-gray-400">Date</th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-gray-800 uppercase bg-gray-200 border-b-2 border-gray-400">Employee Code</th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-gray-800 uppercase bg-gray-200 border-b-2 border-gray-400">Name</th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-gray-800 uppercase bg-gray-200 border-b-2 border-gray-400">Role</th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-gray-800 uppercase bg-gray-200 border-b-2 border-gray-400">Shift</th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-gray-800 uppercase bg-gray-200 border-b-2 border-gray-400">Check IN</th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-gray-800 uppercase bg-gray-200 border-b-2 border-gray-400">Check OUT</th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-gray-800 uppercase bg-gray-200 border-b-2 border-gray-400">Hours</th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-gray-800 uppercase bg-gray-200 border-b-2 border-gray-400">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedFilteredData.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
                          No attendance records for selected date range
                        </td>
                      </tr>
                    ) : (
                      sortedFilteredData.map((entry: any, index: number) => {
                        const userShift = getUserShift(entry.user);
                        const late = userShift && entry.checkIn ? isLate(entry.checkIn, userShift.startTime) : false;
                        const timeDiff = userShift && entry.checkIn ? getTimeDifference(entry.checkIn, userShift.startTime) : 0;
                        const entryDate = new Date(entry.date);
                        
                        const actualHours = entry.checkIn && entry.checkOut ? 
                          ((new Date(entry.checkOut).getTime() - new Date(entry.checkIn).getTime()) / (1000 * 60 * 60)).toFixed(1) : 
                          "-";
                        
                        const shiftHours = userShift?.duration || 8;
                        const hoursShort = actualHours !== "-" && parseFloat(actualHours) < shiftHours;

                        return (
                          <tr key={entry.id} className={`hover:bg-gray-50 ${index === 0 ? 'bg-blue-50' : ''}`}>
                            <td className="px-4 py-4 whitespace-nowrap text-sm">
                              {index === 0 && (
                                <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">
                                  NEW
                                </span>
                              )}
                              {index !== 0 && <span className="text-gray-500">{index + 1}</span>}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-blue-700">
                                {entryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </div>
                              <div className="text-xs text-gray-500">
                                {entryDate.toLocaleDateString('en-US', { weekday: 'short' })}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className="text-sm font-medium text-primary-600">
                                {entry.user.employeeCode || "-"}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <p className="text-sm font-medium text-gray-900">
                                {entry.user.firstName} {entry.user.lastName}
                              </p>
                              <p className="text-xs text-gray-500">{entry.user.email}</p>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className="text-sm text-gray-700">{entry.user.role?.name || "-"}</span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              {userShift && (
                                <div>
                                  <p className="text-sm font-medium text-purple-700">{userShift.name}</p>
                                  <p className="text-xs text-gray-500">{userShift.startTime} - {userShift.endTime}</p>
                                </div>
                              )}
                              {!userShift && <span className="text-sm text-gray-400">-</span>}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div>
                                <p className="text-sm font-medium text-green-700">
                                  {entry.checkIn ? new Date(entry.checkIn).toLocaleTimeString() : "N/A"}
                                </p>
                                {late && (
                                  <span className="text-xs text-red-600 font-medium">
                                    ⚠️ {timeDiff}min late
                                  </span>
                                )}
                                {!late && timeDiff > 0 && entry.checkIn && (
                                  <span className="text-xs text-green-600 font-medium">
                                    ✓ {timeDiff}min early
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <p className="text-sm font-medium text-red-700">
                                {entry.checkOut ? new Date(entry.checkOut).toLocaleTimeString() : "-"}
                              </p>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div>
                                <p className={`text-sm font-bold ${
                                  actualHours === "-" ? "text-gray-400" :
                                  hoursShort ? "text-orange-700" : "text-blue-700"
                                }`}>
                                  {actualHours === "-" ? "In Progress" : `${actualHours}h`}
                                </p>
                                {actualHours !== "-" && userShift && (
                                  <p className="text-xs text-gray-500">of {shiftHours}h</p>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              {!entry.checkOut && (
                                <span className="inline-flex px-3 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full border border-green-300">
                                  ● Active
                                </span>
                              )}
                              {entry.checkOut && !hoursShort && (
                                <span className="inline-flex px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full border border-blue-300">
                                  ✓ Complete
                                </span>
                              )}
                              {entry.checkOut && hoursShort && (
                                <span className="inline-flex px-3 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded-full border border-orange-300">
                                  ⚠️ Short
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
                <p className="text-sm text-gray-600">
                  Showing: <span className="font-bold text-gray-900">{filteredData.length}</span> records
                  {filterStartDate === filterEndDate ? (
                    <span className="ml-2 text-xs">for {new Date(filterStartDate).toLocaleDateString()}</span>
                  ) : (
                    <span className="ml-2 text-xs">from {new Date(filterStartDate).toLocaleDateString()} to {new Date(filterEndDate).toLocaleDateString()}</span>
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => exportToCSV(filteredData)}
                    disabled={filteredData.length === 0}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Export to CSV"
                  >
                    <Download className="h-4 w-4" />
                    CSV
                  </button>
                  <button
                    onClick={() => exportToExcel(filteredData)}
                    disabled={filteredData.length === 0}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Export to Excel"
                  >
                    <Download className="h-4 w-4" />
                    Excel
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2 text-sm font-medium"
                    title="Print Report"
                  >
                    <FileText className="h-4 w-4" />
                    Print
                  </button>
                  <button
                    onClick={() => setShowFullReportModal(false)}
                    className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
          );
        })()}
      </div>
    </div>
  );
}

