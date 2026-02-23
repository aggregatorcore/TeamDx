/**
 * Workflow Trigger Utility
 * Triggers workflow execution when a tag is applied to a lead
 */

import { apiClient } from "@/lib/api";

interface WorkflowNode {
  id: string;
  type: string;
  data: {
    label?: string;
    tagId?: string;
    tagName?: string;
    [key: string]: any;
  };
}

interface WorkflowData {
  nodes: WorkflowNode[];
  edges: any[];
}

/**
 * Find the trigger node in workflow that matches the applied tag
 * Returns the node ID if found, null otherwise
 */
function findTriggerNode(workflowData: WorkflowData, tagId: string, tagName?: string): string | null {
  if (!workflowData?.nodes) return null;

  for (const node of workflowData.nodes) {
    if (node.type === "childButton" || node.type === "tagButton") {
      if (node.data?.tagId === tagId) return node.id;
      if (tagName && node.data?.tagName?.toLowerCase() === tagName.toLowerCase()) return node.id;
      if (tagName && node.data?.label?.toLowerCase().replace(/\s+/g, "_") === tagName.toLowerCase().replace(/\s+/g, "_")) return node.id;
    }
  }
  return null;
}

/**
 * Trigger workflow execution when a tag is applied to a lead
 * @param leadId - The lead ID
 * @param tagId - The tag ID that was applied
 * @param tagName - The tag name (optional, for matching)
 */
export async function triggerWorkflowOnTagApplication(
  leadId: string,
  tagId: string,
  tagName?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    // 1. Get active workflow
    const activeWorkflowResponse = await apiClient.getActiveWorkflow();
    const activeWorkflow = activeWorkflowResponse.workflow;

    if (!activeWorkflow) return { success: false, message: "No active workflow" };

    // 2. Parse workflow data
    let workflowData: WorkflowData;
    try {
      workflowData = typeof activeWorkflow.workflowData === 'string'
        ? JSON.parse(activeWorkflow.workflowData)
        : activeWorkflow.workflowData;
    } catch (error) {
      console.error("[Workflow Trigger] Failed to parse workflow data:", error);
      return { success: false, error: "Invalid workflow data" };
    }

    const triggerNodeId = findTriggerNode(workflowData, tagId, tagName);
    if (!triggerNodeId) return { success: false, message: "No matching workflow trigger found" };

    try {
      const executionResponse = await apiClient.executeWorkflow({
        workflowId: activeWorkflow.id,
        leadId: leadId,
        triggerNodeId: triggerNodeId,
        tagId: tagId,
      });
      return { 
        success: true, 
        message: `Workflow triggered successfully (Execution ID: ${executionResponse.executionId})` 
      };
    } catch (executionError: any) {
      console.error("[Workflow Trigger] ❌ Workflow execution failed:", executionError);
      console.error("[Workflow Trigger] Error details:", {
        message: executionError.message,
        stack: executionError.stack,
        response: executionError.response?.data,
      });
      // Don't fail the tag application if workflow execution fails
      // Just log the error
      return { 
        success: false, 
        error: executionError.message || "Workflow execution failed" 
      };
    }
  } catch (error: any) {
    console.error("[Workflow Trigger] Error triggering workflow:", error);
    // Don't fail the tag application if workflow trigger fails
    return { 
      success: false, 
      error: error.message || "Failed to trigger workflow" 
    };
  }
}
