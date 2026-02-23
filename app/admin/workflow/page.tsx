"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Save, Play } from "lucide-react";
import { apiClient } from "@/lib/api";
import WorkflowCanvas from "@/components/admin/WorkflowCanvas";

interface Workflow {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  version: number;
  workflowData?: any;
  roleId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function AdminWorkflowPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canvasNodes, setCanvasNodes] = useState<any[]>([]);
  const [canvasEdges, setCanvasEdges] = useState<any[]>([]);
  
  // Use refs to store latest state for publish (to avoid stale closures)
  const workflowDataRef = useRef<any>(null);
  const canvasNodesRef = useRef<any[]>([]);
  const canvasEdgesRef = useRef<any[]>([]);
  
  // Workflow state
  const [workflowData, setWorkflowData] = useState<any>({
    name: "Lead Workflow",
    description: "Lead management workflow",
    navigation: {
      enabled: true,
      visibleRoles: ["TELECALLER", "COUNSELOR"],
      entryPoints: ["leads_page", "lead_detail", "call_detail"],
    },
    subButtons: [
      {
        id: "connected",
        label: "Connected",
        color: "#10b981",
        order: 1,
        enabled: true,
      },
      {
        id: "not_connected",
        label: "Not Connected",
        color: "#ef4444",
        order: 2,
        enabled: true,
      },
    ],
    tagGroups: {
      connected: [
        { id: "interested", name: "Interested", color: "#10b981" },
        { id: "discussion", name: "Discussion", color: "#3b82f6" },
        { id: "processing", name: "Processing", color: "#8b5cf6" },
        { id: "not_interested", name: "Not Interested", color: "#ef4444" },
      ],
      notConnected: [
        { id: "no_answer", name: "No Answer", color: "#f59e0b" },
        { id: "busy", name: "Busy", color: "#f97316" },
        { id: "switch_off", name: "Switch Off", color: "#6b7280" },
        { id: "invalid", name: "Invalid", color: "#dc2626" },
      ],
    },
    tags: {},
    version: 1,
    status: "draft",
  });

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getWorkflows();
      setWorkflows(response.workflows || []);
      
      // Try to find active workflow first, otherwise use the first workflow
      const activeWorkflow = response.workflows?.find((w: Workflow) => w.isActive);
      const workflowToLoad = activeWorkflow || response.workflows?.[0];
      
      if (workflowToLoad) {
        setSelectedWorkflow(workflowToLoad);
        if (workflowToLoad.workflowData) {
          try {
            const parsed = typeof workflowToLoad.workflowData === 'string' 
              ? JSON.parse(workflowToLoad.workflowData) 
              : workflowToLoad.workflowData;
            
            // Restore workflow configuration with canvas data
            // Only load nodes/edges if they exist and are valid
            const savedNodes = (parsed.nodes && Array.isArray(parsed.nodes) && parsed.nodes.length > 0) ? parsed.nodes : [];
            const savedEdges = (parsed.edges && Array.isArray(parsed.edges) && parsed.edges.length > 0) ? parsed.edges : [];
            
            const restoredData = {
              name: parsed.name || workflowToLoad.name,
              description: parsed.description || workflowToLoad.description,
              navigation: parsed.navigation || workflowData.navigation,
              controlButtons: parsed.controlButtons || [],
              subButtons: parsed.subButtons || workflowData.subButtons,
              tagGroups: parsed.tagGroups || workflowData.tagGroups,
              tags: parsed.tags || workflowData.tags,
              nodes: savedNodes,
              edges: savedEdges,
              version: parsed.version || workflowToLoad.version || workflowData.version,
              status: parsed.status || (workflowToLoad.isActive ? "live" : "draft"),
            };
            
            console.log("[WorkflowPage] Loaded workflow data:", {
              workflowName: workflowToLoad.name,
              hasTagGroups: !!restoredData.tagGroups,
              notConnectedTags: restoredData.tagGroups?.notConnected?.length || 0,
              systemTags: Object.values(restoredData.tags || {}).filter((t: any) => t.isSystem).length,
            });
            
            setWorkflowData(restoredData);
            // Update refs to keep them in sync
            workflowDataRef.current = restoredData;
            
            // Restore canvas nodes and edges (only if they exist)
            setCanvasNodes(savedNodes);
            setCanvasEdges(savedEdges);
            canvasNodesRef.current = savedNodes;
            canvasEdgesRef.current = savedEdges;
          } catch (error) {
            console.error("Error parsing workflow data:", error);
          }
        }
      }
    } catch (error: any) {
      console.error("Error fetching workflows:", error);
      alert(`Failed to load workflows: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (saveAsDraft: boolean = true) => {
    try {
      setSaving(true);
      
      // Combine workflowData with canvas nodes and edges
      const completeWorkflowData = {
        ...workflowData,
        nodes: canvasNodes,
        edges: canvasEdges,
      };
      
      const workflowPayload = {
        name: selectedWorkflow?.name || workflowData.name || "Lead Workflow",
        description: selectedWorkflow?.description || workflowData.description || "Lead management workflow",
        isActive: !saveAsDraft && workflowData.status === "live",
        workflowData: JSON.stringify(completeWorkflowData),
        version: (selectedWorkflow?.version || workflowData.version || 0) + 1,
      };

      if (selectedWorkflow) {
        await apiClient.updateWorkflow(selectedWorkflow.id, workflowPayload);
      } else {
        const response = await apiClient.createWorkflow(workflowPayload);
        setSelectedWorkflow(response.workflow);
      }

      alert(saveAsDraft ? "Workflow saved as draft" : "Workflow published successfully!");
      await fetchWorkflows();
    } catch (error: any) {
      console.error("Error saving workflow:", error);
      alert(`Failed to save workflow: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!confirm("Publish this workflow? It will become active and replace the current live workflow.")) {
      return;
    }
    
    try {
      setSaving(true);
      
      // Get the latest state from refs (these are always up-to-date)
      const latestWorkflowData = workflowDataRef.current || workflowData;
      const latestCanvasNodes = canvasNodesRef.current || canvasNodes;
      const latestCanvasEdges = canvasEdgesRef.current || canvasEdges;
      
      // Update status to live
      const updatedData = { 
        ...latestWorkflowData, 
        status: "live",
        // Ensure all arrays and objects are properly included
        controlButtons: latestWorkflowData.controlButtons || [],
        subButtons: latestWorkflowData.subButtons || [],
        tagGroups: latestWorkflowData.tagGroups || { connected: [], notConnected: [] },
        tags: latestWorkflowData.tags || {},
        navigation: latestWorkflowData.navigation || {
          enabled: true,
          visibleRoles: ["TELECALLER", "COUNSELOR"],
          entryPoints: ["leads_page", "lead_detail", "call_detail"],
        },
      };
      
      // Combine workflowData with canvas nodes and edges
      const completeWorkflowData = {
        ...updatedData,
        nodes: latestCanvasNodes,
        edges: latestCanvasEdges,
      };

      // Update local state before saving
      setWorkflowData(updatedData);
      setCanvasNodes(latestCanvasNodes);
      setCanvasEdges(latestCanvasEdges);

      const workflowPayload = {
        name: selectedWorkflow?.name || updatedData.name || "Lead Workflow",
        description: selectedWorkflow?.description || updatedData.description || "Lead management workflow",
        isActive: false, // Will be activated via activate endpoint
        workflowData: JSON.stringify(completeWorkflowData),
        version: (selectedWorkflow?.version || updatedData.version || 0) + 1,
      };

      let workflowId: string;
      
      if (selectedWorkflow) {
        await apiClient.updateWorkflow(selectedWorkflow.id, workflowPayload);
        workflowId = selectedWorkflow.id;
      } else {
        const response = await apiClient.createWorkflow(workflowPayload);
        setSelectedWorkflow(response.workflow);
        workflowId = response.workflow.id;
      }

      // Now activate the workflow (this will deactivate all others)
      await apiClient.activateWorkflow(workflowId);
      
      alert("Workflow published and activated successfully! Buttons will now appear on leads page.");
      await fetchWorkflows();
    } catch (error: any) {
      console.error("Error publishing workflow:", error);
      alert(`Failed to publish workflow: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 md:left-64 md:top-16 bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 z-50 flex-shrink-0">
        <div className="px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Workflow Engine Canvas</h1>
              <p className="text-xs text-gray-500 mt-0.5">Design and manage lead workflow</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2 disabled:opacity-50 text-sm"
              >
                <Save className="h-3 w-3" />
                {saving ? "Saving..." : "Save Draft"}
              </button>
              <button
                onClick={handlePublish}
                disabled={saving || workflowData.status === "live"}
                className="px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2 disabled:opacity-50 text-sm"
              >
                <Play className="h-3 w-3" />
                Publish
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Canvas */}
      <div className="flex-1 overflow-hidden">
        <WorkflowCanvas 
          workflowData={workflowData} 
          onUpdate={(data) => {
            // Ensure we're updating with the latest data - merge to preserve all changes
            setWorkflowData((prev) => {
              const updated = { ...prev, ...data };
              // Update ref to keep it in sync
              workflowDataRef.current = updated;
              return updated;
            });
          }}
          onUpdateWorkflow={(data) => {
            // Update workflow data immediately - this is called from child components
            setWorkflowData((prev) => {
              const updated = { ...prev, ...data };
              // Update ref to keep it in sync
              workflowDataRef.current = updated;
              return updated;
            });
          }}
          onPublish={handlePublish}
          onSaveDraft={async () => {
            // Save current state as draft
            try {
              const latestWorkflowData = workflowDataRef.current || workflowData;
              const latestCanvasNodes = canvasNodesRef.current || canvasNodes;
              const latestCanvasEdges = canvasEdgesRef.current || canvasEdges;
              
              // Combine workflowData with canvas nodes and edges
              const completeWorkflowData = {
                ...latestWorkflowData,
                nodes: latestCanvasNodes,
                edges: latestCanvasEdges,
              };
              
              const workflowPayload = {
                name: selectedWorkflow?.name || latestWorkflowData.name || "Lead Workflow",
                description: selectedWorkflow?.description || latestWorkflowData.description || "Lead management workflow",
                isActive: false, // Always save as draft
                workflowData: JSON.stringify(completeWorkflowData),
                version: (selectedWorkflow?.version || latestWorkflowData.version || 0) + 1,
              };

              if (selectedWorkflow) {
                await apiClient.updateWorkflow(selectedWorkflow.id, workflowPayload);
                // Refresh to get updated data
                await fetchWorkflows();
              } else {
                const response = await apiClient.createWorkflow(workflowPayload);
                setSelectedWorkflow(response.workflow);
                await fetchWorkflows();
              }
            } catch (error: any) {
              console.error("Error saving draft:", error);
              // Don't show alert for auto-save, just log
            }
          }}
          onCanvasUpdate={(nodes, edges) => {
            // Update canvas state immediately
            setCanvasNodes(nodes);
            setCanvasEdges(edges);
            // Update refs to keep them in sync
            canvasNodesRef.current = nodes;
            canvasEdgesRef.current = edges;
          }}
          onAddControlButton={(button) => {
            setWorkflowData((prev: any) => {
              const updated = { ...prev };
              if (!updated.controlButtons) {
                updated.controlButtons = [];
              }
              // Check if button already exists
              const exists = updated.controlButtons.find((b: any) => b.id === button.id || b.label === button.label);
              if (!exists) {
                updated.controlButtons = [...updated.controlButtons, button];
              }
              // Update ref to keep it in sync
              workflowDataRef.current = updated;
              return updated;
            });
          }}
        />
      </div>
    </div>
  );
}
