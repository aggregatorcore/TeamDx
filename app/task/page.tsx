"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /task - Redirects to dashboard.
 * Task/My Task flow removed; Connect device (mobile dialer) status is now in the header.
 */
export default function TaskPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500 border-t-transparent mx-auto" />
        <p className="mt-3 text-sm text-gray-600">Redirecting to dashboard...</p>
      </div>
    </div>
  );
}
