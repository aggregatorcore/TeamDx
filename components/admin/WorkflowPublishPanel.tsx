"use client";

import { useState } from "react";
import { GitBranch, Play, RotateCcw, CheckCircle2, XCircle, Clock } from "lucide-react";

interface Workflow {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface WorkflowPublishPanelProps {
  workflows: Workflow[];
  selectedWorkflow: Workflow | null;
  onSelectWorkflow: (workflow: Workflow | null) => void;
  onRollback: (workflowId: string) => void;
}

export default function WorkflowPublishPanel({
  workflows,
  selectedWorkflow,
  onSelectWorkflow,
  onRollback,
}: WorkflowPublishPanelProps) {
  const sortedWorkflows = [...workflows].sort((a, b) => {
    // Active first, then by version desc
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    return b.version - a.version;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <GitBranch className="h-6 w-6 text-primary-600" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Publish & Version Control</h2>
          <p className="text-sm text-gray-500">Manage workflow versions, publish, and rollback</p>
        </div>
      </div>

      {/* Current Status */}
      <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-700">Current Status</div>
            <div className="text-xs text-gray-500 mt-1">
              {selectedWorkflow ? (
                <>
                  {selectedWorkflow.isActive ? (
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      Live (Version {selectedWorkflow.version})
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-gray-500">
                      <XCircle className="h-4 w-4" />
                      Draft (Version {selectedWorkflow.version})
                    </span>
                  )}
                </>
              ) : (
                <span className="text-gray-500">No workflow selected</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Versions List */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Workflow Versions</h3>
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {sortedWorkflows.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
              <p className="text-gray-500">No workflows found</p>
            </div>
          ) : (
            sortedWorkflows.map((workflow) => (
              <div
                key={workflow.id}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedWorkflow?.id === workflow.id
                    ? "border-primary-500 bg-primary-50"
                    : workflow.isActive
                    ? "border-green-200 bg-green-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
                onClick={() => onSelectWorkflow(workflow)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">{workflow.name}</span>
                      {workflow.isActive && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium flex items-center gap-1">
                          <Play className="h-3 w-3" />
                          Live
                        </span>
                      )}
                      {!workflow.isActive && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">
                          Draft
                        </span>
                      )}
                    </div>
                    {workflow.description && (
                      <p className="text-sm text-gray-500 mb-2">{workflow.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <GitBranch className="h-3 w-3" />
                        Version {workflow.version}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(workflow.updatedAt)}
                      </span>
                    </div>
                  </div>
                  {!workflow.isActive && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRollback(workflow.id);
                      }}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2 text-sm font-medium"
                      title="Rollback to this version"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Rollback
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Publish Instructions */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">Publishing Workflow</h4>
        <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
          <li>Save your workflow as draft first to test changes</li>
          <li>Click "Publish" to make the workflow live</li>
          <li>Only one workflow can be active at a time</li>
          <li>Use "Rollback" to revert to a previous version</li>
        </ul>
      </div>
    </div>
  );
}
