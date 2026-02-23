"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2, Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { apiClient } from "@/lib/api";
import LoadingButton from "@/components/LoadingButton";
import { tabStorage } from "@/lib/storage";
import CheckInRequiredNotification from "@/components/CheckInRequiredNotification";
import { getSocketClient } from "@/lib/socket";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [requiresCheckIn, setRequiresCheckIn] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // E2E/automation workaround: read from DOM if React state is empty (e.g. Playwright didn't trigger onChange)
    const emailEl = document.getElementById("email") as HTMLInputElement | null;
    const passwordEl = document.getElementById("password") as HTMLInputElement | null;
    const email = formData.email || emailEl?.value?.trim() || "";
    const password = formData.password || passwordEl?.value || "";

    if (!email || !password) {
      setError("Please enter email and password.");
      setLoading(false);
      return;
    }

    try {
      const response = await apiClient.login(email, password);
      
      // Store token in tab-specific storage
      tabStorage.setItem("token", response.token);
      tabStorage.setItem("user", JSON.stringify(response.user));
      if (response.sessionId) {
        tabStorage.setItem("sessionId", response.sessionId);
      }
      
      // Check if check-in is required
      if (response.requiresCheckIn) {
        setRequiresCheckIn(true);
        // Still redirect but show notification
      }
      
      // Verify token was stored
      const storedToken = tabStorage.getItem("token");
      const storedUser = tabStorage.getItem("user");
      console.log("[LOGIN] Token stored:", {
        hasToken: !!storedToken,
        tokenLength: storedToken?.length || 0,
        hasUser: !!storedUser,
        requiresCheckIn: response.requiresCheckIn,
      });
      
      // Redirect based on user role
      const userRole = response.user?.role?.name;
      if (userRole === "ADMIN") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md px-6">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <img 
              src="/TVF_LOGO.png" 
              alt="TVF DX Logo" 
              className="h-20 w-auto object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            TVF DX
          </h1>
          <p className="text-sm text-gray-500 mb-1">Powered by The Visa Fox</p>
          <p className="text-gray-600">Sign in to your account</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Field */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Enter your email"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between">
            <label className="flex items-center">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="ml-2 text-sm text-gray-600">Remember me</span>
            </label>
            <a
              href="#"
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Forgot password?
            </a>
          </div>

          {/* Submit Button */}
          <LoadingButton
            type="submit"
            loading={loading}
            className="w-full py-3"
            size="lg"
          >
            Sign In
          </LoadingButton>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{" "}
            <a href="#" className="text-primary-600 hover:text-primary-700 font-medium">
              Contact Administrator
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

