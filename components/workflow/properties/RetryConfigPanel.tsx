"use client";

import { Clock, Info, AlertCircle } from "lucide-react";

interface RetryConfigPanelProps {
  data: any;
  onUpdate: (data: any) => void;
}

export default function RetryConfigPanel({
  data,
  onUpdate,
}: RetryConfigPanelProps) {
  const maxAttempts = data.maxAttempts || 3;
  const attempts = data.attempts || [];

  // Initialize attempts array if empty
  const getAttempts = () => {
    if (attempts.length === 0) {
      return Array.from({ length: maxAttempts }, (_, i) => ({
        attemptNumber: i + 1,
        timeType: i === 0 ? "minutes" : i === 1 ? "nextDay" : "hours",
        timeValue: i === 0 ? 60 : i === 1 ? 1 : 48,
        sameDayAllowed: i === 0 ? true : false,
        escalationTarget: i === maxAttempts - 1 ? "teamLead" : null,
        finalStatus: i === maxAttempts - 1 ? "hardToReach" : null,
      }));
    }
    return attempts;
  };

  const currentAttempts = getAttempts();

  const handleAttemptsChange = (newMaxAttempts: number) => {
    const newAttempts = Array.from({ length: newMaxAttempts }, (_, i) => {
      const existing = currentAttempts[i];
      if (existing) return existing;
      return {
        attemptNumber: i + 1,
        timeType: i === 0 ? "minutes" : i === 1 ? "nextDay" : "hours",
        timeValue: i === 0 ? 60 : i === 1 ? 1 : 48,
        sameDayAllowed: i === 0 ? true : false,
        escalationTarget: i === newMaxAttempts - 1 ? "teamLead" : null,
        finalStatus: i === newMaxAttempts - 1 ? "hardToReach" : null,
      };
    });
    onUpdate({ ...data, maxAttempts: newMaxAttempts, attempts: newAttempts });
  };

  const handleAttemptUpdate = (index: number, updates: any) => {
    const updated = [...currentAttempts];
    updated[index] = { ...updated[index], ...updates };
    onUpdate({ ...data, attempts: updated });
  };

  const getPreviewText = (attempt: any, attemptNum: number) => {
    if (attemptNum === 1) {
      if (attempt.timeType === "minutes") {
        return `System will remind you automatically after ${attempt.timeValue} minutes`;
      }
      return `System will remind you automatically after ${attempt.timeValue} ${attempt.timeType}`;
    } else if (attemptNum === 2) {
      if (attempt.timeType === "nextDay") {
        return "Next retry will be scheduled tomorrow";
      }
      return `Next retry will be scheduled after ${attempt.timeValue} ${attempt.timeType}`;
    } else {
      return `Final escalation after last attempt`;
    }
  };

  return (
    <div className="space-y-4 border-t border-gray-200 pt-4">
      {/* Step 1: Select Number of Attempts */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Number of Attempts
        </label>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleAttemptsChange(num)}
              className={`px-4 py-2 rounded-lg border-2 transition-colors ${maxAttempts === num
                  ? "border-primary-600 bg-primary-50 text-primary-700 font-medium"
                  : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                }`}
            >
              {num}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Choose how many times to retry (Default: 3)
        </p>
      </div>

      {/* For Each Attempt - Separate Box Vertically */}
      <div className="space-y-4 mt-6">
        {currentAttempts.map((attempt: any, index: number) => {
          const attemptNum = index + 1;
          const isFinalAttempt = attemptNum === maxAttempts;
          const isFirstAttempt = attemptNum === 1;
          const isSecondAttempt = attemptNum === 2;

          return (
            <div
              key={attemptNum}
              className="border-2 border-gray-300 rounded-lg p-4 bg-white"
            >
              {/* Attempt Header */}
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-5 w-5 text-primary-600" />
                <h4 className="font-semibold text-gray-900">
                  {isFinalAttempt ? "Final Attempt" : `Attempt ${attemptNum}`}
                </h4>
              </div>

              {/* Time Selector */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  When to Retry
                </label>
                <div className="flex gap-2">
                  <select
                    value={attempt.timeType || "minutes"}
                    onChange={(e) => {
                      const timeType = e.target.value;
                      let timeValue = attempt.timeValue || 60;

                      // Set default values based on time type
                      if (timeType === "minutes") timeValue = 60;
                      else if (timeType === "nextDay") timeValue = 1;
                      else if (timeType === "hours") timeValue = 48;
                      else if (timeType === "days") timeValue = 1;

                      handleAttemptUpdate(index, {
                        timeType,
                        timeValue,
                      });
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="minutes">After Minutes</option>
                    <option value="hours">After Hours</option>
                    <option value="nextDay">Next Day</option>
                    <option value="days">After Days</option>
                  </select>

                  {attempt.timeType !== "nextDay" && (
                    <input
                      type="number"
                      min="1"
                      value={attempt.timeValue || 60}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 1;
                        handleAttemptUpdate(index, { timeValue: value });
                      }}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                      placeholder="60"
                    />
                  )}
                </div>
              </div>

              {/* Same Day Toggle - Only for Attempt 1 */}
              {isFirstAttempt && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        Same Day Allowed
                      </label>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Allow retry on the same day
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        handleAttemptUpdate(index, {
                          sameDayAllowed: !attempt.sameDayAllowed,
                        });
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${attempt.sameDayAllowed !== false
                          ? "bg-primary-600"
                          : "bg-gray-300"
                        }`}
                      role="switch"
                      aria-checked={attempt.sameDayAllowed !== false}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${attempt.sameDayAllowed !== false
                            ? "translate-x-6"
                            : "translate-x-1"
                          }`}
                      />
                    </button>
                  </div>
                  {attempt.sameDayAllowed !== false && (
                    <p className="text-xs text-green-700 mt-2 flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      Same day repeat call is allowed
                    </p>
                  )}
                </div>
              )}

              {/* Same Day Toggle - Attempt 2 (Locked OFF) */}
              {isSecondAttempt && (
                <div className="mb-4 p-3 bg-gray-50 border border-gray-300 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        Same Day Allowed
                      </label>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Same day repeat call not allowed
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled
                      className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300 cursor-not-allowed opacity-50"
                    >
                      <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
                    </button>
                  </div>
                  <p className="text-xs text-amber-700 mt-2 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Same day repeat call not allowed
                  </p>
                </div>
              )}

              {/* Escalation Selector - Only for Final Attempt */}
              {isFinalAttempt && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Escalate To
                    </label>
                    <select
                      value={attempt.escalationTarget || "teamLead"}
                      onChange={(e) => {
                        handleAttemptUpdate(index, {
                          escalationTarget: e.target.value,
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="teamLead">Team Lead</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  {/* Final Status Selector */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Final Status
                    </label>
                    <select
                      value={attempt.finalStatus || "hardToReach"}
                      onChange={(e) => {
                        handleAttemptUpdate(index, {
                          finalStatus: e.target.value,
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="hardToReach">Hard to Reach</option>
                      <option value="notInterested">Not Interested</option>
                      <option value="followUpRequired">Follow Up Required</option>
                      <option value="escalated">Escalated</option>
                    </select>
                  </div>
                </>
              )}

              {/* Preview Text (Agent Side) */}
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-xs font-medium text-green-800 mb-1">
                  Agent will see:
                </p>
                <p className="text-sm text-green-900">
                  "{getPreviewText(attempt, attemptNum)}"
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Flow End Info */}
      <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-xs text-gray-600">
          <strong>Note:</strong> After final attempt, flow will automatically close and escalate according to settings above.
        </p>
      </div>
    </div>
  );
}
