"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Tag,
  Plus,
  Edit,
  Trash2,
  X,
  ArrowLeft,
  Play,
  Pause,
  Search,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  GripVertical,
  ChevronDown,
  ChevronRight,
  List,
  Workflow,
  Download,
  Upload,
  Save,
  FileText,
  Pencil,
  Check,
  Send,
} from "lucide-react";
import { Node, Edge, Connection, addEdge, useNodesState, useEdgesState } from "reactflow";
import { apiClient } from "@/lib/api";
import ActionRulesEditor from "@/components/tags/ActionRulesEditor";
import CanvasToolbar from "@/components/workflow/CanvasToolbar";
import EdgePlusMenu from "@/components/workflow/EdgePlusMenu";
import PropertiesPanel from "@/components/workflow/PropertiesPanel";
import TagSelectionModal from "@/components/workflow/TagSelectionModal";
import dynamic from "next/dynamic";

// Dynamic import for FlowCanvas to avoid SSR issues
const DynamicFlowCanvas = dynamic(() => import("@/components/workflow/FlowCanvas"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-50 flex items-center justify-center">
      <div className="text-gray-500">Loading canvas...</div>
    </div>
  ),
});

// ==================== TYPES & INTERFACES ====================

interface TagFlow {
  id: string;
  name: string;
  description?: string | null;
  tagValue: string;
  icon: string;
  color: string;
  category: "call_status" | "lead_status" | "priority" | "custom";
  isActive: boolean;
  isExclusive: boolean;
  requiresNote?: boolean;
  requiresCallback?: boolean;
  requiresFollowUp?: boolean;
  order?: number;
  parentId?: string | null;
  nextTagIds?: string | null;
  appliesTo?: string; // "lead", "call", "task", "all"
  createdAt: string;
  updatedAt: string;
  createdById?: string | null;
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  usageCount: number;
  children?: TagFlow[];
}

// ==================== MAIN COMPONENT ====================

export default function WorkflowEnginePage() {
  const router = useRouter();
  const [tagFlows, setTagFlows] = useState<TagFlow[]>([]);
  const [loading, setLoading] = useState(true);
  // Removed: searchTerm, filterCategory, filterActive, filterAppliesTo, viewMode (not needed for workflow canvas)

  // ReactFlow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [edgePlusMenu, setEdgePlusMenu] = useState<{ edge: Edge; position: { x: number; y: number } } | null>(null);

  // Workflow state
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [activeWorkflow, setActiveWorkflow] = useState<any | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "canvas">("list"); // "list" or "canvas"
  const [workflowToDelete, setWorkflowToDelete] = useState<any | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingWorkflowName, setEditingWorkflowName] = useState<string | null>(null);
  const [workflowNameInput, setWorkflowNameInput] = useState("");
  const [roles, setRoles] = useState<any[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedWorkflowData, setLastSavedWorkflowData] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingFlow, setEditingFlow] = useState<TagFlow | null>(null);
  const [activeTab, setActiveTab] = useState<"basic" | "actions">("basic");
  const [showTagSelectionModal, setShowTagSelectionModal] = useState(false);
  const [pendingTagButtonPosition, setPendingTagButtonPosition] = useState<{ x: number; y: number } | null>(null);

  // Form data
  const [flowForm, setFlowForm] = useState<Partial<TagFlow>>({
    name: "",
    description: "",
    tagValue: "",
    icon: "Tag",
    color: "#3B82F6",
    category: "call_status",
    isActive: true,
    isExclusive: false,
    requiresNote: false,
    requiresCallback: false,
    requiresFollowUp: false,
    order: 0,
    parentId: null,
    nextTagIds: null,
    appliesTo: "all",
  });

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ==================== LIFECYCLE ====================

  useEffect(() => {
    // Fetch data first
    fetchTagFlows();
    fetchRoles();

    // Check sessionStorage and restore view
    const restoreView = async () => {
      if (typeof window !== 'undefined') {
        const savedViewMode = sessionStorage.getItem('workflow_view_mode');
        const savedWorkflowId = sessionStorage.getItem('workflow_selected_id');

        if (savedViewMode === "canvas") {
          if (savedWorkflowId === "new") {
            // Restore new workflow canvas
            setViewMode("canvas");
            setSelectedWorkflow(null);
            setNodes([]);
            setEdges([]);
            setSelectedRoleId(null);
          } else if (savedWorkflowId) {
            // Restore existing workflow canvas - fetch workflows first
            const workflowsResponse = await fetchWorkflows();
            // Use workflows from response directly, not from state (state might not be updated yet)
            setTimeout(() => {
              // Get workflows from response or state (prefer response)
              const allWorkflows = workflowsResponse?.workflows || workflows;
              const workflow = allWorkflows.find((w: any) => w.id === savedWorkflowId);
              if (workflow) {
                // Restore state directly to avoid double save
                setSelectedWorkflow(workflow);
                setSelectedRoleId(workflow.roleId || null);
                setViewMode("canvas");

                // Load workflow data
                if (workflow.workflowData) {
                  try {
                    const workflowData = typeof workflow.workflowData === 'string'
                      ? JSON.parse(workflow.workflowData)
                      : workflow.workflowData;
                    if (workflowData.nodes && workflowData.edges) {
                      // Fix: Ensure action nodes have default values
                      const fixedNodes = workflowData.nodes.map((node: any) => {
                        if (node.type === 'action' && node.data) {
                          // If action node has actionType but no dueInMinutes, add default
                          if (node.data.actionType === 'callback' && !node.data.dueInMinutes && !node.data.delayMinutes) {
                            node.data.dueInMinutes = 60;
                          }
                        }
                        return node;
                      });
                      
                      setNodes(fixedNodes);
                      setEdges(workflowData.edges);
                    }
                  } catch (error) {
                    console.error("Error loading workflow data:", error);
                  }
                }
              } else {
                setViewMode("list");
                sessionStorage.removeItem('workflow_selected_id');
                sessionStorage.removeItem('workflow_view_mode');
              }
            }, 300);
          }
        } else {
          // Start with list view
          setViewMode("list");
          setSelectedWorkflow(null);
          setNodes([]);
          setEdges([]);
        }
      } else {
        // Server-side: always start with list view
        setViewMode("list");
        setSelectedWorkflow(null);
        setNodes([]);
        setEdges([]);
      }
    };

    // Fetch workflows first, then restore view
    fetchWorkflows().then(() => {
      restoreView();
    });

    fetchActiveWorkflow();

  }, []);

  const fetchRoles = async () => {
    try {
      const response: any = await apiClient.getRoles();
      if (response.roles) {
        setRoles(response.roles);
      }
    } catch (err: any) {
      console.error("Error fetching roles:", err);
    }
  };

  const fetchWorkflows = async () => {
    try {
      const response = await apiClient.getWorkflows();
      if (response.workflows) {
        setWorkflows(response.workflows);
        return response;
      } else {
        setWorkflows([]);
        return { workflows: [] };
      }
    } catch (err: any) {
      console.error("[Workflow Engine] Error fetching workflows:", err);
      setError(err.message || "Failed to fetch workflows");
      return { workflows: [] };
    }
  };

  const fetchActiveWorkflow = async () => {
    try {
      const response = await apiClient.getActiveWorkflow();
      if (response.workflow) {
        setActiveWorkflow(response.workflow);
        // Don't auto-load workflow data or switch to canvas on refresh
        // User must manually select workflow to edit
      } else {
        setActiveWorkflow(null);
      }
    } catch (err: any) {
      console.error("Error fetching active workflow:", err);
      setActiveWorkflow(null);
    }
  };

  const handleActivateWorkflow = async () => {
    if (nodes.length === 0) {
      setError("Cannot activate empty workflow. Please add nodes first.");
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      const workflowData = {
        nodes,
        edges,
        metadata: {
          savedAt: new Date().toISOString(),
          version: "1.0",
        },
      };

      // If we're editing an existing workflow, update it instead of creating new
      if (selectedWorkflow) {
        // Update existing workflow
        const updateResponse = await apiClient.updateWorkflow(selectedWorkflow.id, {
          workflowData: JSON.stringify(workflowData),
          roleId: selectedRoleId || null,
        });

        if (updateResponse.workflow) {
          // Then activate it
          const activateResponse = await apiClient.activateWorkflow(updateResponse.workflow.id);
          if (activateResponse.workflow) {
            setActiveWorkflow(activateResponse.workflow);
            setSelectedWorkflow(activateResponse.workflow);
            setSuccess("Workflow updated and activated successfully!");
            setTimeout(() => setSuccess(null), 3000);
            fetchWorkflows();
            fetchActiveWorkflow();
          }
        }
      } else {
        // Create new workflow only if no workflow is selected
        const workflowName = `Workflow ${new Date().toISOString().split("T")[0]}`;
        const createResponse = await apiClient.createWorkflow({
          name: workflowName,
          description: "Active workflow from canvas",
          isActive: false,
          roleId: selectedRoleId || null,
          workflowData: JSON.stringify(workflowData),
          version: 1,
        });

        if (createResponse.workflow) {
          // Set as selected workflow
          setSelectedWorkflow(createResponse.workflow);
          // Then activate it
          const activateResponse = await apiClient.activateWorkflow(createResponse.workflow.id);
          if (activateResponse.workflow) {
            setActiveWorkflow(activateResponse.workflow);
            setSelectedWorkflow(activateResponse.workflow);
            // Save to sessionStorage
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('workflow_selected_id', activateResponse.workflow.id);
            }
            setSuccess("Workflow created and activated successfully!");
            setTimeout(() => setSuccess(null), 3000);
            fetchWorkflows();
            fetchActiveWorkflow();
          }
        }
      }
    } catch (err: any) {
      console.error("Error activating workflow:", err);
      setError(err.message || "Failed to activate workflow");
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleActivateWorkflowById = async (workflowId: string) => {
    try {
      const response = await apiClient.activateWorkflow(workflowId);
      if (response.workflow) {
        setActiveWorkflow(response.workflow);
        setSuccess("Workflow activated successfully!");
        setTimeout(() => setSuccess(null), 3000);
        fetchWorkflows();
        fetchActiveWorkflow();
      }
    } catch (err: any) {
      console.error("Error activating workflow:", err);
      setError(err.message || "Failed to activate workflow");
      setTimeout(() => setError(null), 5000);
    }
  };

  const handlePublishWorkflow = async () => {
    if (!activeWorkflow || !selectedWorkflow || activeWorkflow.id !== selectedWorkflow.id) {
      setError("No active workflow to publish changes to.");
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (nodes.length === 0) {
      setError("Cannot publish empty workflow. Please add nodes first.");
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      const workflowData = {
        nodes,
        edges,
        metadata: {
          savedAt: new Date().toISOString(),
          version: "1.0",
          publishedAt: new Date().toISOString(),
        },
      };

      const serializedData = JSON.stringify(workflowData);
      // Update the active workflow with current canvas changes
      const updateResponse = await apiClient.updateWorkflow(activeWorkflow.id, {
        workflowData: serializedData,
        roleId: selectedRoleId || null,
      });

      if (updateResponse.workflow) {
        setActiveWorkflow(updateResponse.workflow);
        setSelectedWorkflow(updateResponse.workflow);
        const savedData = JSON.stringify({ nodes, edges });
        setLastSavedWorkflowData(savedData);
        setHasUnsavedChanges(false);
        setSuccess("Workflow changes published successfully!");
        setTimeout(() => setSuccess(null), 3000);
        fetchWorkflows();
        fetchActiveWorkflow();
      }
    } catch (err: any) {
      console.error("Error publishing workflow:", err);
      setError(err.message || "Failed to publish workflow changes");
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleDeactivateWorkflow = async (workflowId: string) => {
    try {
      const response = await apiClient.deactivateWorkflow(workflowId);
      if (response.workflow) {
        setActiveWorkflow(null);
        setSuccess("Workflow paused/deactivated successfully!");
        setTimeout(() => setSuccess(null), 3000);
        fetchWorkflows();
        fetchActiveWorkflow();
      }
    } catch (err: any) {
      console.error("Error deactivating workflow:", err);
      setError(err.message || "Failed to pause workflow");
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleDeleteWorkflow = async (workflow: any) => {
    // Close modal immediately to prevent UI issues
    setShowDeleteModal(false);
    const workflowToDeleteId = workflow.id;
    setWorkflowToDelete(null);

    // Check if workflow is active
    if (workflow.isActive) {
      setError("Cannot delete active workflow. Please pause it first.");
      setTimeout(() => setError(null), 5000);
      return;
    }

    try {
      await apiClient.deleteWorkflow(workflow.id);
      setSuccess("Workflow deleted successfully!");
      setTimeout(() => setSuccess(null), 3000);

      // If deleted workflow was selected, clear it
      if (selectedWorkflow?.id === workflowToDeleteId) {
        setSelectedWorkflow(null);
        setNodes([]);
        setEdges([]);
        setViewMode("list");
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('workflow_selected_id');
        }
      }

      // If deleted workflow was active, clear it
      if (activeWorkflow?.id === workflowToDeleteId) {
        setActiveWorkflow(null);
      }

      // Remove from local state immediately
      setWorkflows(prev => prev.filter(w => w.id !== workflowToDeleteId));

      // Then refresh from server
      await fetchWorkflows();
      await fetchActiveWorkflow();
    } catch (err: any) {
      console.error("[Workflow Engine] Error deleting workflow:", err);
      setError(err.message || "Failed to delete workflow");
      setTimeout(() => setError(null), 5000);
    }
  };

  const confirmDeleteWorkflow = (workflow: any) => {
    setWorkflowToDelete(workflow);
    setTimeout(() => {
      setShowDeleteModal(true);
      setTimeout(() => {
        const modal = document.querySelector('[data-delete-modal]');
        if (modal) {
          (modal as HTMLElement).style.display = 'flex';
          (modal as HTMLElement).style.zIndex = '9999';
        }
      }, 10);
    }, 10);
  };

  const handleStartEditName = (workflow: any) => {
    setEditingWorkflowName(workflow.id);
    setWorkflowNameInput(workflow.name || "");
  };

  const handleCancelEditName = () => {
    setEditingWorkflowName(null);
    setWorkflowNameInput("");
  };

  const handleSaveWorkflowName = async (workflowId: string) => {
    if (!workflowNameInput.trim()) {
      setError("Workflow name cannot be empty");
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      const workflow = workflows.find(w => w.id === workflowId);
      if (!workflow) return;

      await apiClient.updateWorkflow(workflowId, {
        name: workflowNameInput.trim(),
      });

      setSuccess("Workflow name updated successfully!");
      setTimeout(() => setSuccess(null), 3000);
      await fetchWorkflows();
      setEditingWorkflowName(null);
      setWorkflowNameInput("");
    } catch (err: any) {
      console.error("Error updating workflow name:", err);
      setError(err.message || "Failed to update workflow name");
      setTimeout(() => setError(null), 5000);
    }
  };

  // ==================== API FUNCTIONS ====================

  const fetchTagFlows = async () => {
    setLoading(true);
    try {
      const response = await apiClient.getTagFlows();
      const flows = response.tagFlows || [];
      setTagFlows(flows);
    } catch (err: any) {
      console.error("Error fetching tag flows:", err);
      setError(err.message || "Failed to fetch tag flows");
      setTagFlows([]);
    } finally {
      setLoading(false);
    }
  };

  const saveTagFlow = async (flow: Partial<TagFlow>) => {
    try {
      // Clean up the data before sending
      const cleanData: any = {};

      // Only include fields that have values (for update) or required fields (for create)
      if (flow.name !== undefined && flow.name !== null && flow.name !== "") {
        cleanData.name = flow.name;
      }
      if (flow.description !== undefined) {
        cleanData.description = flow.description || null;
      }
      if (flow.tagValue !== undefined && flow.tagValue !== null && flow.tagValue !== "") {
        cleanData.tagValue = flow.tagValue;
      }
      if (flow.icon !== undefined) {
        cleanData.icon = flow.icon;
      }
      if (flow.color !== undefined) {
        cleanData.color = flow.color;
      }
      if (flow.category !== undefined) {
        cleanData.category = flow.category;
      }
      if (flow.appliesTo !== undefined && flow.appliesTo !== null && flow.appliesTo !== "") {
        cleanData.appliesTo = flow.appliesTo;
      } else if (!editingFlow) {
        // For create, always set appliesTo to "all" if not provided
        cleanData.appliesTo = "all";
      }
      if (flow.isActive !== undefined) {
        cleanData.isActive = flow.isActive;
      }
      if (flow.isExclusive !== undefined) {
        cleanData.isExclusive = flow.isExclusive;
      }
      if (flow.requiresNote !== undefined) {
        cleanData.requiresNote = flow.requiresNote;
      }
      if (flow.requiresCallback !== undefined) {
        cleanData.requiresCallback = flow.requiresCallback;
      }
      if (flow.requiresFollowUp !== undefined) {
        cleanData.requiresFollowUp = flow.requiresFollowUp;
      }
      if (flow.order !== undefined) {
        // Ensure order is a number
        const orderValue = typeof flow.order === 'string' ? parseInt(flow.order, 10) : flow.order;
        cleanData.order = isNaN(orderValue) ? 0 : orderValue;
      }
      if (flow.parentId !== undefined) {
        cleanData.parentId = flow.parentId && flow.parentId !== "" ? flow.parentId : null;
      }
      if (flow.nextTagIds !== undefined) {
        // Ensure nextTagIds is a string or null
        if (Array.isArray(flow.nextTagIds)) {
          cleanData.nextTagIds = flow.nextTagIds.length > 0 ? JSON.stringify(flow.nextTagIds) : null;
        } else if (typeof flow.nextTagIds === 'string') {
          cleanData.nextTagIds = flow.nextTagIds && flow.nextTagIds !== "" ? flow.nextTagIds : null;
        } else {
          cleanData.nextTagIds = null;
        }
      }
      if (flow.actions !== undefined) {
        cleanData.actions = flow.actions && flow.actions !== "" ? flow.actions : null;
      }

      // For create, ensure required fields are present
      if (!editingFlow) {
        if (!cleanData.name || !cleanData.tagValue) {
          setError("Name and Tag Value are required");
          return;
        }
        if (!cleanData.category) {
          cleanData.category = "call_status";
        }
        if (cleanData.isActive === undefined) {
          cleanData.isActive = true;
        }
        if (cleanData.isExclusive === undefined) {
          cleanData.isExclusive = false;
        }
        if (cleanData.order === undefined) {
          cleanData.order = 0;
        }
        // Always set appliesTo for create (default to "all" if not provided)
        if (!cleanData.appliesTo || cleanData.appliesTo === undefined || cleanData.appliesTo === "") {
          cleanData.appliesTo = "all";
        }
      }

      // Remove undefined values for both create and update requests
      const finalData = Object.keys(cleanData).reduce((acc: any, key) => {
        if (cleanData[key] !== undefined && cleanData[key] !== null) {
          acc[key] = cleanData[key];
        }
        return acc;
      }, {});

      const response = editingFlow
        ? await apiClient.updateTagFlow(editingFlow.id, finalData)
        : await apiClient.createTagFlow(finalData);

      if (response.tagFlow) {
        setSuccess(editingFlow ? "Tag flow updated successfully!" : "Tag flow created successfully!");
        setTimeout(() => setSuccess(null), 3000);
        setShowCreateModal(false);
        setShowEditModal(false);
        setEditingFlow(null);
        setFlowForm({
          name: "",
          description: "",
          tagValue: "",
          icon: "Tag",
          color: "#3B82F6",
          category: "call_status",
          isActive: true,
          isExclusive: false,
          requiresNote: false,
          requiresCallback: false,
          requiresFollowUp: false,
          order: 0,
          parentId: null,
          nextTagIds: null,
        });
        fetchTagFlows();
      }
    } catch (err: any) {
      console.error("Error saving tag flow:", err);
      console.error("Full error details:", {
        message: err.message,
        userRole: err.userRole,
        requiredRoles: err.requiredRoles,
        status: err.status,
        details: err.details,
        validationDetails: err.validationDetails,
        fullError: err
      });

      // Log validation error details in a more readable format
      if (err.details || err.validationDetails) {
        const validationErrors = err.details || err.validationDetails;
        console.error("=".repeat(60));
        console.error("[TagFlow Save] ❌ VALIDATION ERROR DETECTED");
        console.error("=".repeat(60));
        console.error("[TagFlow Save] Validation error details (full JSON):", JSON.stringify(validationErrors, null, 2));
        if (Array.isArray(validationErrors) && validationErrors.length > 0) {
          console.error(`[TagFlow Save] Total errors: ${validationErrors.length}`);
          console.error("[TagFlow Save] Validation errors breakdown:");
          validationErrors.forEach((error: any, index: number) => {
            const fieldPath = Array.isArray(error.path) ? error.path.join('.') : (error.path || 'unknown');
            console.error(`\n  ❌ Error ${index + 1}:`);
            console.error(`     Field: ${fieldPath}`);
            console.error(`     Message: ${error.message || 'Validation failed'}`);
            console.error(`     Code: ${error.code || 'unknown'}`);
            if (error.received !== undefined) console.error(`     Received: ${error.received} (type: ${typeof error.received})`);
            if (error.expected !== undefined) console.error(`     Expected: ${error.expected}`);
            console.error(`     Full error object:`, error);
          });
        }
        console.error("=".repeat(60));
      }

      // Handle validation errors specifically
      if (err.message && (err.message.includes("Validation error") || err.details || err.validationDetails)) {
        const validationDetails = err.details || err.validationDetails || [];
        console.error("[TagFlow Save] Validation error details:", validationDetails);
        // Log each validation error field clearly
        if (Array.isArray(validationDetails) && validationDetails.length > 0) {
          validationDetails.forEach((detail: any, index: number) => {
            console.error(`[TagFlow Save] Validation Error ${index + 1}:`, {
              field: detail.path?.join('.') || detail.field || 'unknown',
              message: detail.message || 'Validation failed',
              code: detail.code,
              received: detail.received,
              expected: detail.expected
            });
          });
        }
        console.error("[TagFlow Save] Full error object:", err);

        if (Array.isArray(validationDetails) && validationDetails.length > 0) {
          const errorDetails = validationDetails.map((v: any) => {
            const field = v.path?.join('.') || v.path?.[0] || 'field';
            return `${field}: ${v.message}`;
          }).join(', ');
          setError(`Validation error: ${errorDetails}`);
        } else if (typeof validationDetails === 'object') {
          setError(`Validation error: ${JSON.stringify(validationDetails)}`);
        } else {
          setError(`Validation error: ${err.message}. Check console for details.`);
        }
      } else {
        const errorMsg = err.userRole
          ? `Permission denied. Your role: ${err.userRole}. Required roles: ${err.requiredRoles?.join(", ") || "ADMIN, BRANCH_MANAGER"}`
          : err.message || "Failed to save tag flow";
        setError(errorMsg);
      }
      setTimeout(() => setError(null), 5000);
    }
  };

  const deleteTagFlow = async (flowId: string) => {
    if (!confirm("Are you sure you want to delete this tag flow? This action cannot be undone.")) {
      return;
    }

    try {
      await apiClient.deleteTagFlow(flowId);
      setTagFlows(tagFlows.filter(f => f.id !== flowId));
      setSuccess("Tag flow deleted successfully!");
      setTimeout(() => setSuccess(null), 3000);
      fetchTagFlows();
    } catch (err: any) {
      console.error("Error deleting tag flow:", err);
      setError(err.message || "Failed to delete tag flow");
      setTimeout(() => setError(null), 5000);
    }
  };

  const toggleFlowActive = async (flowId: string) => {
    try {
      const flow = tagFlows.find(f => f.id === flowId);
      if (!flow) return;

      const response = await apiClient.updateTagFlow(flowId, { isActive: !flow.isActive });
      if (response.tagFlow) {
        setTagFlows(tagFlows.map(f =>
          f.id === flowId ? response.tagFlow as TagFlow : f
        ));
        setSuccess(`Tag flow ${!flow.isActive ? "activated" : "deactivated"} successfully!`);
        setTimeout(() => setSuccess(null), 3000);
        fetchTagFlows();
      }
    } catch (err: any) {
      console.error("Error updating tag flow:", err);
      setError(err.message || "Failed to update tag flow");
      setTimeout(() => setError(null), 5000);
    }
  };

  const updateTagOrder = async (tagId: string, newOrder: number) => {
    try {
      await apiClient.updateTagFlow(tagId, { order: newOrder });
      fetchTagFlows();
    } catch (err: any) {
      console.error("Error updating tag order:", err);
      setError(err.message || "Failed to update tag order");
      setTimeout(() => setError(null), 5000);
    }
  };

  // ==================== REACTFLOW HANDLERS ====================

  const onConnect = useCallback((params: Connection) => {
    // Validation: Check connection rules
    const sourceNode = nodes.find(n => n.id === params.source);
    const targetNode = nodes.find(n => n.id === params.target);

    if (!sourceNode || !targetNode) {
      console.warn("[Workflow Engine] Invalid connection: node not found");
      return;
    }

    // Connection Rules:
    // 1. Control Button → Sub Button (only)
    // 2. Sub Button → Tag Button (only)
    // 3. Tag Button → Action (only)
    // 4. No circular links
    // 5. No direct connections skipping levels

    const isValidConnection =
      (sourceNode.type === "parentButtons" && targetNode.type === "childButton") ||
      (sourceNode.type === "navigation" && targetNode.type === "parentButtons") ||
      (sourceNode.type === "childButton" && targetNode.type === "action");

    if (!isValidConnection) {
      console.warn("[Workflow Engine] Invalid connection:", {
        from: sourceNode.type,
        to: targetNode.type,
        message: "Connection not allowed. Rules: Control Button→Sub Button, Sub Button→Tag Button, Tag Button→Action"
      });
      setError("Invalid connection. Only Control Button→Sub Button, Sub Button→Tag Button, and Tag Button→Action are allowed.");
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Check for circular links (simple check - prevent connecting to ancestor)
    const hasCircularLink = edges.some(edge =>
      edge.target === params.source && edge.source === params.target
    );

    if (hasCircularLink) {
      console.warn("[Workflow Engine] Circular link detected");
      setError("Circular links are not allowed.");
      setTimeout(() => setError(null), 3000);
      return;
    }

    setEdges((eds) => addEdge(params, eds));
  }, [setEdges, nodes, edges]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    // Show plus menu at click position
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    setEdgePlusMenu({
      edge,
      position: { x: event.clientX, y: event.clientY },
    });
  }, []);

  const handleNodeUpdate = useCallback((nodeId: string, updateData: any) => {
    setNodes((nds) => {
      const updated = nds.map((node) => {
        if (node.id === nodeId) {
          const newData = { ...node.data, ...updateData };
          if ('enableRetry' in updateData) {
            newData.enableRetry = Boolean(updateData.enableRetry);
          }
          return {
            ...node,
            data: newData,
            id: node.id,
          };
        }
        return node;
      });

      // Force ReactFlow to recognize the change
      return updated;
    });

    // Force properties panel to update by updating selected node immediately
    setSelectedNode((prev) => {
      if (prev && prev.id === nodeId) {
        // Directly update with new data
        const updatedData = { ...prev.data, ...updateData };
        // Force enableRetry to be boolean
        if ('enableRetry' in updateData) {
          updatedData.enableRetry = Boolean(updateData.enableRetry);
        }
        return {
          ...prev,
          data: updatedData
        };
      }
      return prev;
    });

    // Mark workflow as having unsaved changes
    setHasUnsavedChanges(true);
  }, [setNodes, nodes, setSelectedNode]);

  const handleAddTagButton = useCallback((edgeId: string) => {
    const edge = edges.find((e) => e.id === edgeId);
    if (!edge) return;

    const sourceNode = nodes.find((n) => n.id === edge.source);
    if (!sourceNode) return;

    // Create tag button node connected to the source
    const newNode: Node = {
      id: `childButton-${Date.now()}`,
      type: "childButton",
      position: {
        x: (sourceNode.position.x || 0) + 200,
        y: (sourceNode.position.y || 0) + 100,
      },
      data: {
        label: "New Tag",
        color: "#F59E0B",
        order: 0,
        tagName: "",
        tagId: "",
      },
    };

    setNodes((nds) => [...nds, newNode]);

    // Create edge from source to new child
    const newEdge: Edge = {
      id: `edge-${edge.source}-${newNode.id}`,
      source: edge.source,
      target: newNode.id,
    };

    setEdges((eds) => [...eds, newEdge]);
  }, [nodes, edges, setNodes, setEdges]);

  const handleAddChildFromParentButton = useCallback((nodeId: string, buttonIndex: number) => {
    const parentNode = nodes.find((n) => n.id === nodeId);
    if (!parentNode || parentNode.type !== "parentButtons") return;

    // Get button info
    const buttons = parentNode.data.buttons || [
      { name: parentNode.data.button1Name || "Connected", color: parentNode.data.button1Color || "#10B981", order: 0 },
      { name: parentNode.data.button2Name || "Not Connected", color: parentNode.data.button2Color || "#EF4444", order: 1 },
    ];
    const button = buttons[buttonIndex];
    if (!button) return;

    // Create child button node
    const newNode: Node = {
      id: `childButton-${Date.now()}`,
      type: "childButton",
      position: {
        x: (parentNode.position.x || 0) + 250,
        y: (parentNode.position.y || 0) + (buttonIndex * 120),
      },
      data: {
        label: `Tag Button for ${button.name}`,
        color: button.color,
        order: buttonIndex,
        tagName: "",
        tagId: "",
      },
    };

    setNodes((nds) => [...nds, newNode]);

    // Create edge from specific button handle to new child
    const newEdge: Edge = {
      id: `edge-${nodeId}-button-${buttonIndex}-${newNode.id}`,
      source: nodeId,
      sourceHandle: `button-${buttonIndex}`, // Connect from specific button handle
      target: newNode.id,
    };

    setEdges((eds) => [...eds, newEdge]);
  }, [nodes, setNodes, setEdges]);

  const handleAddActionNode = useCallback((edgeId: string) => {
    const edge = edges.find((e) => e.id === edgeId);
    if (!edge) return;

    const sourceNode = nodes.find((n) => n.id === edge.source);
    if (!sourceNode) return;

    // Create action node connected to the source with default callback action
    const newNode: Node = {
      id: `action-${Date.now()}`,
      type: "action",
      position: {
        x: (sourceNode.position.x || 0) + 200,
        y: (sourceNode.position.y || 0) + 100,
      },
      data: {
        actionType: "callback",
        dueInMinutes: 60, // Default callback delay
      },
    };

    setNodes((nds) => [...nds, newNode]);

    // Create edge from source to new action
    const newEdge: Edge = {
      id: `edge-${edge.source}-${newNode.id}`,
      source: edge.source,
      target: newNode.id,
    };

    setEdges((eds) => [...eds, newEdge]);
  }, [nodes, edges, setNodes, setEdges]);

  // ==================== SAVE/LOAD DRAFT ====================

  const handleSaveDraft = useCallback(() => {
    const draftData = {
      nodes,
      edges,
      metadata: {
        savedAt: new Date().toISOString(),
        version: "1.0",
      },
    };

    const jsonString = JSON.stringify(draftData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `workflow-draft-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setSuccess("Draft saved successfully!");
    setTimeout(() => setSuccess(null), 3000);
  }, [nodes, edges]);

  const handleLoadDraft = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event: any) => {
        try {
          const draftData = JSON.parse(event.target.result);

          if (!draftData.nodes || !draftData.edges) {
            throw new Error("Invalid draft format");
          }

          setNodes(draftData.nodes);
          setEdges(draftData.edges);
          setSuccess(`Draft loaded successfully! (Saved: ${draftData.metadata?.savedAt || "Unknown"})`);
          setTimeout(() => setSuccess(null), 3000);
        } catch (error: any) {
          console.error("Error loading draft:", error);
          setError("Failed to load draft: " + error.message);
          setTimeout(() => setError(null), 5000);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [setNodes, setEdges]);


  const handleAddNode = useCallback((type: "navigation" | "parentButtons" | "subButtons" | "childButton" | "tagButton" | "action", data?: any) => {
    // If tagButton type, show modal instead of directly adding
    if (type === "tagButton" || type === "childButton") {
      const basePosition = {
        x: Math.random() * 400 + 100,
        y: Math.random() * 400 + 100
      };
      setPendingTagButtonPosition(basePosition);
      setShowTagSelectionModal(true);
      return;
    }

    const basePosition = {
      x: Math.random() * 400 + 100,
      y: Math.random() * 400 + 100
    };

    let nodeData: any = {};

    switch (type) {
      case "navigation":
        nodeData = {
          label: data?.label || "Navigation",
          enabled: data?.enabled !== false,
        };
        break;
      case "parentButtons":
      case "subButtons":
        nodeData = {
          buttons: data?.buttons || [
            { name: data?.button1Name || "Connected", color: data?.button1Color || "#10B981", order: 0 },
            { name: data?.button2Name || "Not Connected", color: data?.button2Color || "#EF4444", order: 1 },
          ],
        };
        break;
      case "action":
        // Initialize with default callback action configuration
        nodeData = {
          actionType: data?.actionType || "callback",
          // For callback action, set default dueInMinutes
          ...(data?.actionType === "callback" || !data?.actionType ? {
            dueInMinutes: 60,
          } : {}),
          // Include any additional config from data
          ...(data?.config || {}),
        };
        break;
    }

    const nodeId = `${type}-${Date.now()}`;
    const newNode: Node = {
      id: nodeId,
      type: type === "subButtons" ? "parentButtons" : type, // Map subButtons to parentButtons for ReactFlow
      position: basePosition,
      data: nodeData,
    };

    // For parentButtons, add handlers after node is created
    if (type === "parentButtons" || type === "subButtons") {
      newNode.data.onAddChild = (buttonIndex: number) => {
        handleAddChildFromParentButton(nodeId, buttonIndex);
      };
      newNode.data.onButtonClick = (buttonIndex: number) => {
      };
    }

    setNodes((nds) => [...nds, newNode]);
  }, [setNodes, handleAddChildFromParentButton]);

  // Handle tag selection from modal
  const handleTagSelected = useCallback((tag: { id: string; name: string; color?: string }) => {
    if (!pendingTagButtonPosition) return;

    const nodeId = `childButton-${Date.now()}`;
    const newNode: Node = {
      id: nodeId,
      type: "childButton",
      position: pendingTagButtonPosition,
      data: {
        label: tag.name,
        color: tag.color || "#F59E0B",
        order: 0,
        tagName: tag.name,
        tagId: tag.id,
      },
    };

    setNodes((nds) => [...nds, newNode]);
    setShowTagSelectionModal(false);
    setPendingTagButtonPosition(null);
  }, [pendingTagButtonPosition, setNodes]);

  // Handle tag creation from modal
  const handleCreateTag = useCallback(async (tagData: { name: string; color: string; category: string }): Promise<{ id: string; name: string; color?: string }> => {
    try {
      const response = await apiClient.createTagFlow({
        name: tagData.name,
        tagValue: tagData.name.toLowerCase().replace(/\s+/g, "_"),
        color: tagData.color,
        category: (tagData.category as "call_status" | "lead_status" | "priority" | "custom") || "call_status",
        isActive: true,
        isExclusive: false,
        appliesTo: "all",
      });

      if (response.tagFlow) {
        // Refresh tag flows list
        await fetchTagFlows();

        return {
          id: response.tagFlow.id,
          name: response.tagFlow.name,
          color: response.tagFlow.color,
        };
      }
      throw new Error("Failed to create tag");
    } catch (error: any) {
      console.error("Error creating tag:", error);
      throw error;
    }
  }, []);

  // ==================== REMOVED: Old Flow Structure & List View Code ====================
  // These functions are no longer needed - Workflow Engine only uses Canvas Editor

  // ==================== RENDER ====================

  // Handle workflow selection
  // Track changes in canvas
  useEffect(() => {
    if (!selectedWorkflow || !activeWorkflow || selectedWorkflow.id !== activeWorkflow.id) {
      setHasUnsavedChanges(false);
      return;
    }

    // Compare current nodes/edges with last saved state
    const currentData = JSON.stringify({ nodes, edges });
    if (lastSavedWorkflowData && currentData !== lastSavedWorkflowData) {
      setHasUnsavedChanges(true);
    } else if (!lastSavedWorkflowData) {
      // If no saved state, check against workflow's current data
      if (activeWorkflow.workflowData) {
        try {
          const savedData = typeof activeWorkflow.workflowData === 'string'
            ? JSON.parse(activeWorkflow.workflowData)
            : activeWorkflow.workflowData;
          const savedDataStr = JSON.stringify({ nodes: savedData.nodes || [], edges: savedData.edges || [] });
          if (currentData !== savedDataStr) {
            setHasUnsavedChanges(true);
          } else {
            setHasUnsavedChanges(false);
          }
        } catch (error) {
          console.error("Error comparing workflow data:", error);
        }
      }
    } else {
      setHasUnsavedChanges(false);
    }
  }, [nodes, edges, selectedWorkflow, activeWorkflow, lastSavedWorkflowData]);

  const handleSelectWorkflow = async (workflow: any) => {
    setSelectedWorkflow(workflow);
    setSelectedRoleId(workflow.roleId || null); // Set role for selected workflow
    setViewMode("canvas");

    // Save canvas view state to sessionStorage
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('workflow_view_mode', 'canvas');
      sessionStorage.setItem('workflow_selected_id', workflow.id);
    }

    // Load workflow data to canvas
    if (workflow.workflowData) {
      try {
        const workflowData = typeof workflow.workflowData === 'string'
          ? JSON.parse(workflow.workflowData)
          : workflow.workflowData;

        if (workflowData.nodes && workflowData.edges) {
          // Fix: Ensure action nodes have default values
          const fixedNodes = workflowData.nodes.map((node: any) => {
            if (node.type === 'action' && node.data) {
              // If action node has actionType but no dueInMinutes, add default
              if (node.data.actionType === 'callback' && !node.data.dueInMinutes && !node.data.delayMinutes) {
                node.data.dueInMinutes = 60;
              }
            }
            return node;
          });
          
          setNodes(fixedNodes);
          setEdges(workflowData.edges);
          // Save initial state for change tracking
          setLastSavedWorkflowData(JSON.stringify({ nodes: fixedNodes, edges: workflowData.edges }));
        }
      } catch (error) {
        console.error("Error loading workflow data:", error);
      }
    } else {
      // No workflow data, reset saved state
      setLastSavedWorkflowData(null);
    }
    setHasUnsavedChanges(false);
  };

  const handleCreateNewWorkflow = () => {
    setSelectedWorkflow(null);
    setActiveWorkflow(null); // Clear active workflow for new workflow
    setNodes([]);
    setEdges([]);
    setSelectedRoleId(null); // Reset role selection for new workflow
    setViewMode("canvas");
    // Save canvas view state to sessionStorage for new workflow
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('workflow_view_mode', 'canvas');
      sessionStorage.setItem('workflow_selected_id', 'new'); // Mark as new workflow
    }
  };

  const handleBackToList = () => {
    setViewMode("list");
    setSelectedWorkflow(null);
    // Clear sessionStorage when going back to list
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('workflow_selected_id');
      sessionStorage.removeItem('workflow_view_mode');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Show workflow list view
  if (viewMode === "list") {
    return (
      <div className="w-full min-h-screen p-4 md:p-6 lg:p-8 bg-gray-50">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back</span>
          </button>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Workflow className="h-8 w-8 text-primary-600" />
            Workflow Engine
          </h1>
          <p className="text-gray-600 mt-1">Design and manage automated workflows for tags and actions</p>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800">
            <CheckCircle2 className="h-5 w-5" />
            {success}
          </div>
        )}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        )}

        {/* Create New Workflow Button */}
        <div className="mb-6">
          <button
            onClick={handleCreateNewWorkflow}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2 transition-colors shadow-lg"
          >
            <Plus className="h-5 w-5" />
            <span className="font-semibold">Create New Workflow</span>
          </button>
        </div>

        {/* All Workflows Section */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">All Workflows</h2>
          {workflows.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <Workflow className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg font-medium mb-2">No workflows found</p>
              <p className="text-gray-500 text-sm">Create your first workflow to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between gap-4">
                    {/* Left: Workflow Info */}
                    <div className="flex-1 flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {editingWorkflowName === workflow.id ? (
                            <div className="flex items-center gap-2 flex-1">
                              <input
                                type="text"
                                value={workflowNameInput}
                                onChange={(e) => setWorkflowNameInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    handleSaveWorkflowName(workflow.id);
                                  } else if (e.key === "Escape") {
                                    handleCancelEditName();
                                  }
                                }}
                                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-lg font-semibold"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveWorkflowName(workflow.id)}
                                className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                                title="Save name"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={handleCancelEditName}
                                className="p-1.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                                title="Cancel"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <h3
                                className="text-lg font-semibold text-gray-900 cursor-pointer"
                                onClick={() => handleSelectWorkflow(workflow)}
                              >
                                {workflow.name || "Unnamed Workflow"}
                              </h3>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEditName(workflow);
                                }}
                                className="p-1 text-gray-400 hover:text-primary-600 transition-colors"
                                title="Edit workflow name"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {workflow.isActive ? (
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                              Inactive
                            </span>
                          )}
                        </div>
                        {workflow.description && (
                          <p className="text-gray-600 text-sm mb-2 line-clamp-1">{workflow.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>v{workflow.version || 1}</span>
                          <span>Updated: {new Date(workflow.updatedAt).toLocaleDateString()}</span>
                          <span>Created: {new Date(workflow.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Action Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleSelectWorkflow(workflow);
                        }}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2 transition-colors"
                      >
                        <span>Edit</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                      {workflow.isActive ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeactivateWorkflow(workflow.id);
                          }}
                          className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 flex items-center gap-2 transition-colors"
                          title="Pause/Deactivate workflow"
                        >
                          <Pause className="h-4 w-4" />
                          <span>Pause</span>
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleActivateWorkflowById(workflow.id);
                          }}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 transition-colors"
                          title="Activate workflow"
                        >
                          <Play className="h-4 w-4" />
                          <span>Activate</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          e.nativeEvent.stopImmediatePropagation();
                          confirmDeleteWorkflow(workflow);
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                        }}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2 transition-colors"
                        title="Delete workflow"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal - For List View */}
        {showDeleteModal && workflowToDelete && (
          <div
            data-delete-modal
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
            style={{ zIndex: 9999 }}
            onClick={(e) => {
              // Close modal when clicking outside
              if (e.target === e.currentTarget) {
                setShowDeleteModal(false);
                setWorkflowToDelete(null);
              }
            }}
            onMouseDown={(e) => {
              // Prevent any event bubbling
              if (e.target === e.currentTarget) {
                e.stopPropagation();
              }
            }}
          >
            <div
              className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 rounded-full">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Workflow</h3>
              </div>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete <span className="font-semibold text-gray-900">"{workflowToDelete.name || "Unnamed Workflow"}"</span>?
                This action cannot be undone.
              </p>
              {workflowToDelete.isActive && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> This workflow is currently active. You need to pause it first before deleting.
                  </p>
                </div>
              )}
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setWorkflowToDelete(null);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await handleDeleteWorkflow(workflowToDelete);
                  }}
                  disabled={workflowToDelete.isActive}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Show canvas view
  return (
    <div className="w-full h-screen flex flex-col">
      <div className="flex-shrink-0 p-4 md:p-6 lg:p-8 bg-white border-b border-gray-200">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <button
              onClick={handleBackToList}
              className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back to Workflows</span>
            </button>
            <div className="flex items-center gap-3">
              {editingWorkflowName === selectedWorkflow?.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={workflowNameInput}
                    onChange={(e) => setWorkflowNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSaveWorkflowName(selectedWorkflow.id);
                      } else if (e.key === "Escape") {
                        handleCancelEditName();
                      }
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-3xl font-bold"
                    autoFocus
                  />
                  <button
                    onClick={() => handleSaveWorkflowName(selectedWorkflow.id)}
                    className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                    title="Save name"
                  >
                    <Check className="h-5 w-5" />
                  </button>
                  <button
                    onClick={handleCancelEditName}
                    className="p-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                    title="Cancel"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                  <Workflow className="h-8 w-8 text-primary-600" />
                  {selectedWorkflow ? selectedWorkflow.name || "Edit Workflow" : "New Workflow"}
                  {selectedWorkflow && (
                    <button
                      onClick={() => handleStartEditName(selectedWorkflow)}
                      className="p-1.5 text-gray-400 hover:text-primary-600 transition-colors ml-2"
                      title="Edit workflow name"
                    >
                      <Pencil className="h-5 w-5" />
                    </button>
                  )}
                </h1>
              )}
            </div>
            <p className="text-gray-600 mt-1">Design and manage automated workflows for tags and actions</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Active Flow Button */}
            {/* Only show active workflow if it matches the currently selected workflow, or if no workflow is selected (new workflow) */}
            {activeWorkflow && (selectedWorkflow ? activeWorkflow.id === selectedWorkflow.id : false) ? (
              <div className="flex items-center gap-2">
                <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700">
                    Active: {activeWorkflow.name || "Workflow"}
                  </span>
                </div>
                {/* Publish Button - Show when there are unsaved changes */}
                {hasUnsavedChanges && (
                  <button
                    onClick={handlePublishWorkflow}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors shadow-md"
                    title="Publish changes to active workflow"
                  >
                    <Send className="h-4 w-4" />
                    <span className="hidden md:inline">Publish</span>
                  </button>
                )}
                <button
                  onClick={() => handleDeactivateWorkflow(activeWorkflow.id)}
                  className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 flex items-center gap-2 transition-colors"
                  title="Pause/Deactivate workflow"
                >
                  <Pause className="h-4 w-4" />
                  <span className="hidden md:inline">Pause</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleActivateWorkflow}
                disabled={nodes.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                title={selectedWorkflow ? "Activate this workflow" : "Create and activate new workflow"}
              >
                <Play className="h-4 w-4" />
                <span className="hidden md:inline">{selectedWorkflow ? "Activate Flow" : "Create & Activate"}</span>
              </button>
            )}
            {selectedWorkflow && (
              <button
                onClick={() => confirmDeleteWorkflow(selectedWorkflow)}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2 transition-colors"
                title="Delete workflow"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden md:inline">Delete</span>
              </button>
            )}
            <button
              onClick={handleSaveDraft}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2 transition-colors"
              title="Save workflow as JSON file"
            >
              <Download className="h-4 w-4" />
              <span className="hidden md:inline">Save Draft</span>
            </button>
            <button
              onClick={handleLoadDraft}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2 transition-colors"
              title="Load workflow from JSON file"
            >
              <Upload className="h-4 w-4" />
              <span className="hidden md:inline">Load Draft</span>
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
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        )}
      </div>

      {/* Workflow Canvas Editor - Full Background */}
      <div className="flex-1 overflow-hidden flex relative bg-gray-50">
        {/* Left Toolbar */}
        <CanvasToolbar onAddNode={handleAddNode} />

        {/* Center Canvas */}
        <div className="flex-1 relative overflow-hidden">
          {nodes.length === 0 && edges.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <Workflow className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 text-lg font-medium mb-2">Start Building Your Workflow</p>
                <p className="text-gray-500 text-sm mb-4">
                  Click on any workflow step in the left panel to add it to your canvas.
                  You can connect steps together to create your automation flow.
                </p>
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-left">
                  <p className="text-xs font-medium text-blue-900 mb-2">💡 Getting Started:</p>
                  <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                    <li>Add a Navigation Button (start point)</li>
                    <li>Add Parent Options (Connected/Not Connected)</li>
                    <li>Add Child Options (specific outcomes)</li>
                    <li>Add Action Steps (what to do next)</li>
                    <li>Connect them by dragging from connection points</li>
                  </ol>
                </div>
              </div>
            </div>
          ) : (
            <DynamicFlowCanvas
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onEdgeClick={onEdgeClick}
            />
          )}
        </div>

        {/* Right Properties Panel */}
        <PropertiesPanel
          selectedNode={selectedNode}
          onClose={() => setSelectedNode(null)}
          onUpdate={handleNodeUpdate}
          tagFlows={tagFlows}
        />

        {/* Edge Plus Menu */}
        {edgePlusMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setEdgePlusMenu(null)}
            />
            <EdgePlusMenu
              edge={edgePlusMenu.edge}
              position={edgePlusMenu.position}
              onAddChildButton={handleAddTagButton}
              onAddActionNode={handleAddActionNode}
              onClose={() => setEdgePlusMenu(null)}
            />
          </>
        )}

        {/* Tag Selection Modal */}
        <TagSelectionModal
          isOpen={showTagSelectionModal}
          onClose={() => {
            setShowTagSelectionModal(false);
            setPendingTagButtonPosition(null);
          }}
          onSelectTag={handleTagSelected}
          onCreateTag={handleCreateTag}
          onDeleteTag={async (tagId: string) => {
            try {
              await apiClient.deleteTagFlow(tagId);
              // Refresh tag flows list
              await fetchTagFlows();
              setSuccess("Tag deleted successfully!");
              setTimeout(() => setSuccess(null), 3000);
            } catch (error: any) {
              // Re-throw error so modal can show it
              throw error;
            }
          }}
        />
      </div>

      {/* Create/Edit Tag Flow Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingFlow ? "Edit Tag" : "Create Tag"}
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setEditingFlow(null);
                  setActiveTab("basic");
                  setFlowForm({
                    name: "",
                    description: "",
                    tagValue: "",
                    icon: "Tag",
                    color: "#3B82F6",
                    category: "call_status",
                    isActive: true,
                    isExclusive: false,
                    requiresNote: false,
                    requiresCallback: false,
                    requiresFollowUp: false,
                    order: 0,
                    parentId: null,
                    nextTagIds: null,
                    appliesTo: "all",
                  });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Tabs - Only show for edit mode */}
            {editingFlow && (
              <div className="flex items-center gap-2 mb-4 border-b border-gray-200">
                <button
                  onClick={() => setActiveTab("basic")}
                  className={`px-4 py-2 font-medium text-sm transition-colors ${activeTab === "basic"
                    ? "text-primary-600 border-b-2 border-primary-600"
                    : "text-gray-600 hover:text-gray-900"
                    }`}
                >
                  Basic Info
                </button>
                <button
                  onClick={() => setActiveTab("actions")}
                  className={`px-4 py-2 font-medium text-sm transition-colors ${activeTab === "actions"
                    ? "text-primary-600 border-b-2 border-primary-600"
                    : "text-gray-600 hover:text-gray-900"
                    }`}
                >
                  Action Rules
                </button>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={flowForm.name || ""}
                  onChange={(e) => setFlowForm({ ...flowForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., Interested, Ready to Process"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={flowForm.description || ""}
                  onChange={(e) => setFlowForm({ ...flowForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                  placeholder="Describe what this tag does..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tag Value *</label>
                  <input
                    type="text"
                    value={flowForm.tagValue || ""}
                    onChange={(e) => setFlowForm({ ...flowForm, tagValue: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="e.g., interested, ready_to_process"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={flowForm.category || "call_status"}
                    onChange={(e) => setFlowForm({ ...flowForm, category: e.target.value as TagFlow["category"] })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="call_status">Call Status</option>
                    <option value="lead_status">Lead Status</option>
                    <option value="priority">Priority</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Applies To *</label>
                <select
                  value={flowForm.appliesTo || "all"}
                  onChange={(e) => setFlowForm({ ...flowForm, appliesTo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="all">All (Lead/Call/Task)</option>
                  <option value="lead">Leads Only</option>
                  <option value="call">Calls Only</option>
                  <option value="task">Tasks Only</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Select where this tag can be applied</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Order (Display Sequence)</label>
                  <input
                    type="number"
                    value={flowForm.order || 0}
                    onChange={(e) => setFlowForm({ ...flowForm, order: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">Lower numbers appear first</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Parent Tag (Optional)</label>
                  <select
                    value={flowForm.parentId || ""}
                    onChange={(e) => setFlowForm({ ...flowForm, parentId: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">None (Root Level)</option>
                    {(() => {
                      const formCategory = flowForm.category || "call_status";
                      // Filter: Only ROOT tags (parentId === null) + same category + exclude current tag
                      const rootTags = tagFlows.filter(f => {
                        return f.parentId === null &&
                          f.category === formCategory &&
                          f.id !== editingFlow?.id;
                      });

                      if (rootTags.length === 0) {
                        return null; // No root tags available
                      }

                      return rootTags.map(tag => (
                        <option key={tag.id} value={tag.id}>{tag.name}</option>
                      ));
                    })()}
                  </select>
                  <p className={`text-xs mt-1 ${(() => {
                    const formCategory = flowForm.category || "call_status";
                    const rootTags = tagFlows.filter(f =>
                      f.parentId === null &&
                      f.category === formCategory &&
                      f.id !== editingFlow?.id
                    );
                    return rootTags.length === 0 ? "text-red-600 font-medium" : "text-gray-500";
                  })()
                    }`}>
                    {(() => {
                      const formCategory = flowForm.category || "call_status";
                      const rootTags = tagFlows.filter(f =>
                        f.parentId === null &&
                        f.category === formCategory &&
                        f.id !== editingFlow?.id
                      );
                      return rootTags.length === 0
                        ? "⚠️ No root tags available in this category. Create root tags first."
                        : "Select parent tag for hierarchy (only root tags shown)";
                    })()}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Next Possible Tags (Optional)</label>
                <select
                  multiple
                  value={flowForm.nextTagIds ? JSON.parse(flowForm.nextTagIds) : []}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    setFlowForm({ ...flowForm, nextTagIds: selected.length > 0 ? JSON.stringify(selected) : null });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg min-h-[100px]"
                  size={5}
                >
                  {tagFlows
                    .filter(f => {
                      const formCategory = flowForm.category || "call_status";
                      return f.category === formCategory && f.id !== editingFlow?.id;
                    })
                    .map(tag => (
                      <option key={tag.id} value={tag.id}>{tag.name}</option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Icon Name</label>
                  <input
                    type="text"
                    value={flowForm.icon || "Tag"}
                    onChange={(e) => setFlowForm({ ...flowForm, icon: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="e.g., CheckCircle2, Phone, X"
                  />
                  <p className="text-xs text-gray-500 mt-1">Use Lucide icon names</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                  <input
                    type="color"
                    value={flowForm.color || "#3B82F6"}
                    onChange={(e) => setFlowForm({ ...flowForm, color: e.target.value })}
                    className="w-full h-10 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={flowForm.isActive !== false}
                    onChange={(e) => setFlowForm({ ...flowForm, isActive: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={flowForm.isExclusive || false}
                    onChange={(e) => setFlowForm({ ...flowForm, isExclusive: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">Exclusive</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={flowForm.requiresNote || false}
                    onChange={(e) => setFlowForm({ ...flowForm, requiresNote: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">Requires Note</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={flowForm.requiresCallback || false}
                    onChange={(e) => setFlowForm({ ...flowForm, requiresCallback: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">Requires Callback</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={flowForm.requiresFollowUp || false}
                    onChange={(e) => setFlowForm({ ...flowForm, requiresFollowUp: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">Requires Follow-up</span>
                </label>
              </div>

              {/* Action Rules Tab - Only for edit mode */}
              {editingFlow && activeTab === "actions" && (
                <div>
                  <ActionRulesEditor
                    value={flowForm.actions || null}
                    onChange={(value) => {
                      setFlowForm({ ...flowForm, actions: value });
                    }}
                    onSave={() => {
                      // Auto-save is handled by onChange, but we can trigger manual save
                      saveTagFlow(flowForm);
                    }}
                  />
                </div>
              )}

              {/* Show buttons only on basic tab or create mode */}
              {(activeTab === "basic" || !editingFlow) && (
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setShowEditModal(false);
                      setEditingFlow(null);
                      setActiveTab("basic");
                      setFlowForm({
                        name: "",
                        description: "",
                        tagValue: "",
                        icon: "Tag",
                        color: "#3B82F6",
                        category: "call_status",
                        isActive: true,
                        isExclusive: false,
                        requiresNote: false,
                        requiresCallback: false,
                        requiresFollowUp: false,
                        order: 0,
                        parentId: null,
                        nextTagIds: null,
                        appliesTo: "all",
                      });
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => saveTagFlow(flowForm)}
                    className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    {editingFlow ? "Update" : "Create"} Tag
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal - Outside viewMode to work in both list and canvas */}
      {showDeleteModal && workflowToDelete && (
        <div
          data-delete-modal
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
          style={{ zIndex: 9999 }}
          onClick={(e) => {
            // Close modal when clicking outside
            if (e.target === e.currentTarget) {
              setShowDeleteModal(false);
              setWorkflowToDelete(null);
            }
          }}
          onMouseDown={(e) => {
            // Prevent any event bubbling
            if (e.target === e.currentTarget) {
              e.stopPropagation();
            }
          }}
        >
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Delete Workflow</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <span className="font-semibold text-gray-900">"{workflowToDelete.name || "Unnamed Workflow"}"</span>?
              This action cannot be undone.
            </p>
            {workflowToDelete.isActive && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> This workflow is currently active. You need to pause it first before deleting.
                </p>
              </div>
            )}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setWorkflowToDelete(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await handleDeleteWorkflow(workflowToDelete);
                }}
                disabled={workflowToDelete.isActive}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
