"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function AdminLeadsPage() {
  const router = useRouter();

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-8 max-w-md">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Leads Management</h1>
        <p className="text-gray-600 mb-6">
          This page is temporarily removed. New version will be built later.
        </p>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>
    </div>
  );
}
