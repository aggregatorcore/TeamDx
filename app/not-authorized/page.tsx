"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldX, Home, LogOut } from "lucide-react";
import { tabStorage } from "@/lib/storage";

export default function NotAuthorizedPage() {
    const router = useRouter();

    const handleLogout = () => {
        tabStorage.removeItem("token");
        tabStorage.removeItem("user");
        router.push("/login");
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-lg shadow-lg border border-gray-200 p-8 text-center">
                <div className="flex justify-center mb-6">
                    <div className="h-20 w-20 bg-red-100 rounded-full flex items-center justify-center">
                        <ShieldX className="h-10 w-10 text-red-600" />
                    </div>
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-3">Access Denied</h1>
                <p className="text-gray-600 mb-2">
                    You don't have permission to access this resource.
                </p>
                <p className="text-sm text-gray-500 mb-8">
                    Please contact your administrator if you believe this is an error.
                </p>
                <div className="flex flex-col gap-3">
                    <button
                        onClick={() => router.push("/dashboard")}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                    >
                        <Home className="h-4 w-4" />
                        Go to Dashboard
                    </button>
                    <button
                        onClick={handleLogout}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                    >
                        <LogOut className="h-4 w-4" />
                        Logout
                    </button>
                </div>
            </div>
        </div>
    );
}

