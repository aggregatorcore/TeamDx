"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  Award,
  Plus,
  AlertCircle,
  X,
} from "lucide-react";
import { apiClient } from "@/lib/api";

interface PerformanceReview {
  id: string;
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: {
      name: string;
    };
  };
  reviewPeriod: string;
  reviewDate: string;
  reviewedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  rating: number;
  goals: string | null;
  achievements: string | null;
  areasForImprovement: string | null;
  comments: string | null;
  nextReviewDate: string | null;
  createdAt: string;
}

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: {
    name: string;
  };
}

export default function PerformancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [performanceReviews, setPerformanceReviews] = useState<PerformanceReview[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);

  useEffect(() => {
    fetchStaff();
    fetchPerformanceReviews();
  }, []);

  const fetchStaff = async () => {
    try {
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

  const fetchPerformanceReviews = async () => {
    try {
      setError(null);
      const response = await apiClient.getPerformanceReviews();
      setPerformanceReviews(response.reviews || []);
    } catch (err: any) {
      console.error("Failed to fetch performance reviews:", err);
      if (err.message && !err.message.includes("not found")) {
        setError(err.message || "Failed to fetch performance reviews");
      } else {
        setPerformanceReviews([]);
      }
    }
  };

  const handleCreatePerformance = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      await apiClient.createPerformanceReview({
        userId: formData.get("userId") as string,
        reviewPeriod: formData.get("reviewPeriod") as string,
        reviewDate: formData.get("reviewDate") as string,
        rating: parseInt(formData.get("rating") as string),
        goals: formData.get("goals") as string,
        achievements: formData.get("achievements") as string,
        areasForImprovement: formData.get("areasForImprovement") as string,
        comments: formData.get("comments") as string,
        nextReviewDate: formData.get("nextReviewDate") as string,
      });
      setShowPerformanceModal(false);
      setSuccess("Performance review created successfully!");
      setTimeout(() => setSuccess(null), 3000);
      fetchPerformanceReviews();
    } catch (err: any) {
      setError(err.message || "Failed to create performance review");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Performance Reviews</h1>
          <p className="text-gray-600">Track and manage employee performance reviews</p>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
            <Award className="h-5 w-5 text-green-600 flex-shrink-0" />
            <p className="text-green-800 font-medium">{success}</p>
            <button
              onClick={() => setSuccess(null)}
              className="ml-auto p-1 hover:bg-green-100 rounded"
            >
              <X className="h-4 w-4 text-green-600" />
            </button>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <p className="text-red-800">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto p-1 hover:bg-red-100 rounded"
            >
              <X className="h-4 w-4 text-red-600" />
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="mb-6 flex justify-end">
          <button
            onClick={() => setShowPerformanceModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>New Performance Review</span>
          </button>
        </div>

        {/* Performance Reviews Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {performanceReviews.length === 0 ? (
            <div className="col-span-full bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <Award className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No performance reviews found
              </h3>
              <p className="text-gray-600">Create your first performance review</p>
            </div>
          ) : (
            performanceReviews.map((review) => (
              <div
                key={review.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">
                      {review.user.firstName} {review.user.lastName}
                    </h3>
                    <p className="text-xs text-gray-500">{review.user.role.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{review.reviewPeriod}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Award
                        key={i}
                        className={`h-4 w-4 ${
                          i < review.rating
                            ? "text-yellow-500 fill-current"
                            : "text-gray-300"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  Reviewed by: {review.reviewedBy.firstName} {review.reviewedBy.lastName}
                </div>
                {review.achievements && (
                  <div className="text-sm text-gray-700 mb-2">
                    <strong>Achievements:</strong>{" "}
                    {review.achievements.length > 100
                      ? `${review.achievements.substring(0, 100)}...`
                      : review.achievements}
                  </div>
                )}
                {review.areasForImprovement && (
                  <div className="text-sm text-gray-700 mb-2">
                    <strong>Areas for Improvement:</strong>{" "}
                    {review.areasForImprovement.length > 100
                      ? `${review.areasForImprovement.substring(0, 100)}...`
                      : review.areasForImprovement}
                  </div>
                )}
                <div className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-200">
                  Review Date: {new Date(review.reviewDate).toLocaleDateString()}
                  {review.nextReviewDate && (
                    <div className="mt-1">
                      Next Review: {new Date(review.nextReviewDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Create Performance Review Modal */}
        {showPerformanceModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Create Performance Review</h2>
              </div>
              <form onSubmit={handleCreatePerformance} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Staff Member *
                  </label>
                  <select
                    name="userId"
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select Staff Member</option>
                    {staff.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.firstName} {member.lastName} ({member.role.name})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Review Period *
                  </label>
                  <input
                    type="text"
                    name="reviewPeriod"
                    required
                    placeholder="e.g., Q1 2024, Annual 2024"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Review Date *
                  </label>
                  <input
                    type="date"
                    name="reviewDate"
                    required
                    defaultValue={new Date().toISOString().split("T")[0]}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rating * (1-5)
                  </label>
                  <select
                    name="rating"
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="1">1 - Needs Improvement</option>
                    <option value="2">2 - Below Expectations</option>
                    <option value="3">3 - Meets Expectations</option>
                    <option value="4">4 - Exceeds Expectations</option>
                    <option value="5">5 - Outstanding</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Goals</label>
                  <textarea
                    name="goals"
                    rows={3}
                    placeholder="Employee goals and objectives"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Achievements
                  </label>
                  <textarea
                    name="achievements"
                    rows={3}
                    placeholder="Key achievements and accomplishments"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Areas for Improvement
                  </label>
                  <textarea
                    name="areasForImprovement"
                    rows={3}
                    placeholder="Areas that need improvement"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Comments</label>
                  <textarea
                    name="comments"
                    rows={3}
                    placeholder="Additional comments or notes"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Next Review Date
                  </label>
                  <input
                    type="date"
                    name="nextReviewDate"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Create Review
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPerformanceModal(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


