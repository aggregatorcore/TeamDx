"use client";

import { useState, useEffect } from "react";
import { User, Mail, Phone, Briefcase, Hash } from "lucide-react";
import { tabStorage } from "@/lib/storage";

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userStr = tabStorage.getItem("user");
    if (userStr) {
      try {
        setUser(JSON.parse(userStr));
      } catch (e) {
        console.error("Error parsing user data:", e);
      }
    }
  }, []);

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
          Settings
        </h1>
        <p className="text-gray-600">Manage your account and preferences</p>
      </div>
      
      {user && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-primary-600" />
            Profile Information
          </h2>
          
          <div className="space-y-4">
            {user.employeeCode && (
              <div className="flex items-center gap-3 p-3 bg-primary-50 rounded-lg border border-primary-200">
                <Hash className="h-5 w-5 text-primary-600 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-600 mb-1">Employee Code</p>
                  <p className="text-lg font-mono font-semibold text-primary-700">
                    {user.employeeCode}
                  </p>
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <User className="h-5 w-5 text-gray-600 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-600 mb-1">Full Name</p>
                <p className="text-base font-medium text-gray-900">
                  {user.firstName} {user.lastName}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Mail className="h-5 w-5 text-gray-600 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-600 mb-1">Email</p>
                <p className="text-base font-medium text-gray-900">{user.email}</p>
              </div>
            </div>
            
            {user.phone && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Phone className="h-5 w-5 text-gray-600 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-600 mb-1">Phone</p>
                  <p className="text-base font-medium text-gray-900">{user.phone}</p>
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Briefcase className="h-5 w-5 text-gray-600 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-600 mb-1">Role</p>
                <p className="text-base font-medium text-gray-900">
                  {user.role?.name?.replace("_", " ") || "N/A"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {!user && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-gray-600">Loading profile information...</p>
        </div>
      )}
    </div>
  );
}

