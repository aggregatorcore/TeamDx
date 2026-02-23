"use client";

import { useState, useEffect } from "react";
import { Navigation, X, ChevronLeft } from "lucide-react";
import { apiClient } from "@/lib/api";
import TagApplicationModal from "./tags/TagApplicationModal";
import { triggerWorkflowOnTagApplication } from "@/lib/utils/workflowTrigger";

export interface TagApplyResult {
  shuffled?: boolean;
  newOwnerId?: string;
  newOwnerName?: string;
  message?: string;
  /** When set, parent can show Wrong Number animation then redirect to leads */
  appliedTagValue?: string;
  appliedTagName?: string;
}

interface AgentTagNavigationProps {
  entityType: "lead" | "call";
  entityId: string;
  onSelect?: (selection: { subButton: string; tag: string }) => void;
  onTagApplied?: (result?: TagApplyResult) => void;
}

interface TagFlow {
  id: string;
  name: string;
  tagValue: string;
  color: string;
  requiresNote?: boolean;
  requiresCallback?: boolean;
  requiresFollowUp?: boolean;
  actions?: string | null;
}

// Workflow-based structure will be loaded from active workflow

interface WorkflowNode {
  id: string;
  type: string;
  data: {
    label?: string;
    color?: string;
    tagId?: string;
    tagName?: string;
    [key: string]: any;
  };
}

interface WorkflowStructure {
  subButtons: Array<{
    id: string;
    label: string;
    color?: string;
    tags: Array<{
      id: string;
      label: string;
      color?: string;
      tagId?: string;
      tagName?: string;
    }>;
  }>;
}

export default function AgentTagNavigation({
  entityType,
  entityId,
  onSelect,
  onTagApplied,
}: AgentTagNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSubButton, setSelectedSubButton] = useState<string | null>(null);
  const [availableTags, setAvailableTags] = useState<TagFlow[]>([]);
  const [selectedTag, setSelectedTag] = useState<TagFlow | null>(null);
  const [showTagModal, setShowTagModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applyingTagId, setApplyingTagId] = useState<string | null>(null);
  const [workflowStructure, setWorkflowStructure] = useState<WorkflowStructure | null>(null);
  const [workflowLoading, setWorkflowLoading] = useState(true);

  // Fetch workflow structure and tags on mount and when entity changes
  useEffect(() => {
    fetchWorkflowStructure();
    fetchTags();
  }, [entityId]);

  // Refresh workflow structure periodically to catch updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchWorkflowStructure();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const fetchWorkflowStructure = async () => {
    try {
      setWorkflowLoading(true);
      const response = await apiClient.getActiveWorkflow();
      const activeWorkflow = response.workflow;

      console.log("[AgentTagNavigation] Active workflow response:", {
        hasWorkflow: !!activeWorkflow,
        workflowId: activeWorkflow?.id,
        workflowName: activeWorkflow?.name,
        isActive: activeWorkflow?.isActive,
        hasWorkflowData: !!activeWorkflow?.workflowData,
      });

      if (!activeWorkflow) {
        console.log("[AgentTagNavigation] No active workflow found");
        setWorkflowStructure(null);
        setWorkflowLoading(false);
        return;
      }

      // Parse workflow data
      let workflowData: { nodes: WorkflowNode[]; edges: any[] };
      try {
        workflowData = typeof activeWorkflow.workflowData === 'string'
          ? JSON.parse(activeWorkflow.workflowData)
          : activeWorkflow.workflowData;
        
        console.log("[AgentTagNavigation] Parsed workflow data:", {
          nodesCount: workflowData?.nodes?.length || 0,
          edgesCount: workflowData?.edges?.length || 0,
          nodeTypes: workflowData?.nodes?.map(n => n.type) || [],
          allNodes: workflowData?.nodes?.map(n => ({
            id: n.id,
            type: n.type,
            label: n.data?.label,
          })) || [],
          allEdges: workflowData?.edges?.map(e => ({
            source: e.source,
            target: e.target,
          })) || [],
        });
      } catch (error) {
        console.error("[AgentTagNavigation] Failed to parse workflow data:", error);
        setWorkflowStructure(null);
        setWorkflowLoading(false);
        return;
      }

      if (!workflowData || !workflowData.nodes || workflowData.nodes.length === 0) {
        console.warn("[AgentTagNavigation] Workflow has no nodes");
        setWorkflowStructure(null);
        setWorkflowLoading(false);
        return;
      }

      // Build structure from workflow nodes
      const structure: WorkflowStructure = {
        subButtons: [],
      };

      // Debug: Log all nodes and edges with full details
      console.log("[AgentTagNavigation] All workflow nodes:", JSON.stringify(workflowData.nodes.map(n => ({
        id: n.id,
        type: n.type,
        label: n.data?.label || n.data?.name || "Unknown",
        buttons: n.data?.buttons || [],
        buttonsCount: n.data?.buttons?.length || 0,
        tagId: n.data?.tagId,
        tagName: n.data?.tagName,
      })), null, 2));
      console.log("[AgentTagNavigation] All workflow edges:", JSON.stringify(workflowData.edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      })), null, 2));

      // Helper function to get node type (check data.nodeType first, then ID pattern, then node.type)
      const getNodeType = (node: any): string => {
        if (node.data?.nodeType) return node.data.nodeType;
        if (node.id?.startsWith("navigation-")) return "navigation";
        if (node.id?.startsWith("subButton-")) return "subButton";
        if (node.id?.startsWith("tag-")) return "tag";
        return node.type || "custom";
      };

      // First, find the navigation node (starting point)
      const navigationNode = workflowData.nodes.find(
        (node) => getNodeType(node) === "navigation"
      );

      if (!navigationNode) {
        console.log("[AgentTagNavigation] No navigation node found, trying to find sub buttons directly");
        // Fallback: If no navigation node, find sub buttons directly
        const subButtonNodes = workflowData.nodes.filter(
          (node) => {
            const nodeType = getNodeType(node);
            return nodeType === "parentButtons" || nodeType === "parentButton" || nodeType === "subButtons" || nodeType === "subButton";
          }
        );

        subButtonNodes.forEach((subButtonNode) => {
          // SubButtonsNode can have multiple buttons in data.buttons array
          const buttons = subButtonNode.data.buttons || [];
          
          if (buttons.length > 0) {
            // Handle multiple buttons in one node
            buttons.forEach((button: any, buttonIndex: number) => {
              // Find edges from this specific button handle
              const buttonHandleId = `button-${buttonIndex}`;
              const tagEdges = workflowData.edges.filter(
                (edge) => edge.source === subButtonNode.id && edge.sourceHandle === buttonHandleId
              );

              // If no specific handle match, try all edges from this sub button node
              const allTagEdges = tagEdges.length > 0 
                ? tagEdges 
                : workflowData.edges.filter((edge) => edge.source === subButtonNode.id);

              const tagNodes = allTagEdges
                .map((edge) => {
                  const tagNode = workflowData.nodes.find(
                    (node) => {
                      if (node.id !== edge.target) return false;
                      const nodeType = getNodeType(node);
                      return nodeType === "childButton" || nodeType === "tagButton" || nodeType === "tag";
                    }
                  );
                  return tagNode;
                })
                .filter((node) => node !== undefined) as WorkflowNode[];

              structure.subButtons.push({
                id: `${subButtonNode.id}-button-${buttonIndex}`,
                label: button.name || button.label || `Button ${buttonIndex + 1}`,
                color: button.color,
                tags: tagNodes.map((tag) => ({
                  id: tag.id,
                  label: tag.data.label || "Unknown",
                  color: tag.data.color,
                  tagId: tag.data.tagId,
                  tagName: tag.data.tagName || tag.data.label,
                })),
              });
            });
          } else {
            // Single sub button node (old format)
            const tagEdges = workflowData.edges.filter(
              (edge) => edge.source === subButtonNode.id
            );

            const tagNodes = tagEdges
              .map((edge) => {
                const tagNode = workflowData.nodes.find(
                  (node) => {
                    if (node.id !== edge.target) return false;
                    const nodeType = getNodeType(node);
                    return nodeType === "childButton" || nodeType === "tag";
                  }
                );
                return tagNode;
              })
              .filter((node) => node !== undefined) as WorkflowNode[];

            structure.subButtons.push({
              id: subButtonNode.id,
              label: subButtonNode.data.label || "Unknown",
              color: subButtonNode.data.color,
              tags: tagNodes.map((tag) => ({
                id: tag.id,
                label: tag.data.label || "Unknown",
                color: tag.data.color,
                tagId: tag.data.tagId,
                tagName: tag.data.tagName || tag.data.label,
              })),
            });
          }
        });
      } else {
        // Find sub buttons connected to navigation node
        const navigationEdges = workflowData.edges.filter(
          (edge) => edge.source === navigationNode.id
        );

        // Find sub button nodes connected to navigation
        const subButtonNodesFromNav = navigationEdges
          .map((edge) => {
            const subButtonNode = workflowData.nodes.find(
              (node) => {
                if (node.id !== edge.target) return false;
                const nodeType = getNodeType(node);
                return nodeType === "parentButtons" || nodeType === "parentButton" || nodeType === "subButtons" || nodeType === "subButton";
              }
            );
            return subButtonNode;
          })
          .filter((node) => node !== undefined) as WorkflowNode[];

        // For each sub button, find its tags
        subButtonNodesFromNav.forEach((subButtonNode) => {
          // SubButtonsNode can have multiple buttons in data.buttons array
          const buttons = subButtonNode.data.buttons || [];
          
          if (buttons.length > 0) {
            // Handle multiple buttons in one node
            buttons.forEach((button: any, buttonIndex: number) => {
              // Find edges from this specific button handle
              const buttonHandleId = `button-${buttonIndex}`;
              const tagEdges = workflowData.edges.filter(
                (edge) => edge.source === subButtonNode.id && edge.sourceHandle === buttonHandleId
              );

              // If no specific handle match, try all edges from this sub button node
              const allTagEdges = tagEdges.length > 0 
                ? tagEdges 
                : workflowData.edges.filter((edge) => edge.source === subButtonNode.id);

              const tagNodes = allTagEdges
                .map((edge) => {
                  const tagNode = workflowData.nodes.find(
                    (node) => {
                      if (node.id !== edge.target) return false;
                      const nodeType = getNodeType(node);
                      return nodeType === "childButton" || nodeType === "tagButton" || nodeType === "tag";
                    }
                  );
                  return tagNode;
                })
                .filter((node) => node !== undefined) as WorkflowNode[];

              structure.subButtons.push({
                id: `${subButtonNode.id}-button-${buttonIndex}`,
                label: button.name || button.label || `Button ${buttonIndex + 1}`,
                color: button.color,
                tags: tagNodes.map((tag) => ({
                  id: tag.id,
                  label: tag.data.label || "Unknown",
                  color: tag.data.color,
                  tagId: tag.data.tagId,
                  tagName: tag.data.tagName || tag.data.label,
                })),
              });
            });
          } else {
            // Single sub button node (old format)
            const tagEdges = workflowData.edges.filter(
              (edge) => edge.source === subButtonNode.id
            );

            const tagNodes = tagEdges
              .map((edge) => {
                const tagNode = workflowData.nodes.find(
                  (node) => {
                    if (node.id !== edge.target) return false;
                    const nodeType = getNodeType(node);
                    return nodeType === "childButton" || nodeType === "tag";
                  }
                );
                return tagNode;
              })
              .filter((node) => node !== undefined) as WorkflowNode[];

            structure.subButtons.push({
              id: subButtonNode.id,
              label: subButtonNode.data.label || "Unknown",
              color: subButtonNode.data.color,
              tags: tagNodes.map((tag) => ({
                id: tag.id,
                label: tag.data.label || "Unknown",
                color: tag.data.color,
                tagId: tag.data.tagId,
                tagName: tag.data.tagName || tag.data.label,
              })),
            });
          }
        });
      }

      console.log("[AgentTagNavigation] Workflow structure loaded:", {
        subButtonsCount: structure.subButtons.length,
        totalTags: structure.subButtons.reduce((sum, s) => sum + s.tags.length, 0),
        structure,
      });
      
      // Detailed structure logging for debugging
      console.log("[AgentTagNavigation] Detailed structure:", JSON.stringify({
        subButtons: structure.subButtons.map(sb => ({
          id: sb.id,
          label: sb.label,
          color: sb.color,
          tagsCount: sb.tags.length,
          tags: sb.tags.map(t => ({
            id: t.id,
            label: t.label,
            color: t.color,
            tagId: t.tagId,
            tagName: t.tagName,
          })),
        })),
      }, null, 2));

      if (structure.subButtons.length === 0) {
        console.warn("[AgentTagNavigation] No sub buttons found in workflow structure");
        setWorkflowStructure(null);
      } else {
        setWorkflowStructure(structure);
      }
    } catch (error) {
      console.error("[AgentTagNavigation] Error fetching workflow structure:", error);
      setWorkflowStructure(null);
    } finally {
      setWorkflowLoading(false);
    }
  };

  const fetchTags = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getTagFlows();
      const tags = response.tagFlows || [];
      // Filter for call_status category and active tags
      const filteredTags = tags.filter(
        (t: TagFlow) => t.category === "call_status" && t.isActive !== false
      );
      setAvailableTags(filteredTags);
    } catch (error) {
      console.error("Error fetching tags:", error);
    } finally {
      setLoading(false);
    }
  };

  // Find tag by tag node ID from workflow
  const findTagByTagNodeId = (tagNodeId: string): TagFlow | null => {
    if (!workflowStructure) {
      console.log("[AgentTagNavigation] No workflow structure available");
      return null;
    }

    // Find tag node in workflow structure
    for (const subButton of workflowStructure.subButtons) {
      const tag = subButton.tags.find((t) => t.id === tagNodeId);
      if (tag) {
        console.log("[AgentTagNavigation] Found tag in structure:", {
          tagId: tag.id,
          tagLabel: tag.label,
          tagTagId: tag.tagId,
          tagTagName: tag.tagName,
          availableTagsCount: availableTags.length,
        });

        // Try to find tag by tagId or tagName
        if (tag.tagId) {
          const foundTag = availableTags.find((t) => t.id === tag.tagId);
          if (foundTag) {
            console.log("[AgentTagNavigation] Tag found by tagId:", foundTag.name);
            return foundTag;
          }
        }
        if (tag.tagName) {
          // Try exact match first
          let foundTag = availableTags.find(
            (t) => t.name.toLowerCase() === tag.tagName?.toLowerCase()
          );
          if (foundTag) {
            console.log("[AgentTagNavigation] Tag found by exact tagName match:", foundTag.name);
            return foundTag;
          }
          // Try normalized match (remove spaces, special chars)
          const normalizedTagName = tag.tagName.toLowerCase().replace(/[^a-z0-9]/g, '');
          foundTag = availableTags.find((t) => {
            const normalizedTag = t.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            return normalizedTag === normalizedTagName;
          });
          if (foundTag) {
            console.log("[AgentTagNavigation] Tag found by normalized tagName match:", foundTag.name);
            return foundTag;
          }
          // Try partial match
          foundTag = availableTags.find((t) => {
            const tagNameLower = t.name.toLowerCase();
            const tagTagNameLower = tag.tagName.toLowerCase();
            return tagNameLower.includes(tagTagNameLower) || tagTagNameLower.includes(tagNameLower);
          });
          if (foundTag) {
            console.log("[AgentTagNavigation] Tag found by partial tagName match:", foundTag.name);
            return foundTag;
          }
        }
        // Try by exact label match
        let foundTag = availableTags.find(
          (t) => t.name.toLowerCase() === tag.label.toLowerCase()
        );
        if (foundTag) {
          console.log("[AgentTagNavigation] Tag found by exact label match:", foundTag.name);
          return foundTag;
        }
        // Try by partial label match (remove spaces, special chars)
        const normalizedLabel = tag.label.toLowerCase().replace(/[^a-z0-9]/g, '');
        foundTag = availableTags.find((t) => {
          const normalizedTagName = t.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          return normalizedTagName === normalizedLabel || normalizedTagName.includes(normalizedLabel) || normalizedLabel.includes(normalizedTagName);
        });
        if (foundTag) {
          console.log("[AgentTagNavigation] Tag found by partial label match:", foundTag.name);
          return foundTag;
        }
        // Try by tagValue if available
        if (tag.label) {
          foundTag = availableTags.find((t) => {
            const tagValue = (t as any).tagValue?.toLowerCase();
            const labelLower = tag.label.toLowerCase();
            return tagValue === labelLower || tagValue?.includes(labelLower) || labelLower.includes(tagValue);
          });
          if (foundTag) {
            console.log("[AgentTagNavigation] Tag found by tagValue:", foundTag.name);
            return foundTag;
          }
        }
        // Log detailed info for debugging
        const availableTagInfo = availableTags.map(t => ({ 
          id: t.id, 
          name: t.name, 
          tagValue: (t as any).tagValue,
          category: (t as any).category,
          normalizedName: t.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
        }));
        const tagNormalized = tag.tagName?.toLowerCase().replace(/[^a-z0-9]/g, '') || tag.label.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // Log available tag names as strings for easy reading
        const availableTagNamesList = availableTags.map(t => t.name);
        console.log("[AgentTagNavigation] Available tag names:", availableTagNamesList);
        console.log("[AgentTagNavigation] Available tag details:", availableTagInfo);
        console.log("[AgentTagNavigation] Looking for tag matching:", {
          tagLabel: tag.label,
          tagTagName: tag.tagName,
          tagNormalized: tagNormalized,
        });
        
        // Enhanced matching: Try multiple strategies
        const trimmedTagLabel = tag.label.trim();
        const trimmedTagTagName = tag.tagName?.trim();
        
        // Strategy 1: Exact match (case-insensitive, trimmed)
        let finalTag = availableTags.find(t => {
          const tagName = t.name.trim();
          return (
            tagName.toLowerCase() === trimmedTagLabel.toLowerCase() ||
            tagName.toLowerCase() === trimmedTagTagName?.toLowerCase()
          );
        });
        
        if (finalTag) {
          console.log("[AgentTagNavigation] Tag found with exact match:", finalTag.name);
          return finalTag;
        }
        
        // Strategy 2: Remove all spaces and compare
        finalTag = availableTags.find(t => {
          const tagName = t.name.trim();
          const tagNameNoSpaces = tagName.toLowerCase().replace(/\s+/g, '');
          const tagLabelNoSpaces = trimmedTagLabel.toLowerCase().replace(/\s+/g, '');
          const tagTagNameNoSpaces = trimmedTagTagName?.toLowerCase().replace(/\s+/g, '') || '';
          return (
            tagNameNoSpaces === tagLabelNoSpaces ||
            tagNameNoSpaces === tagTagNameNoSpaces
          );
        });
        
        if (finalTag) {
          console.log("[AgentTagNavigation] Tag found with no-spaces match:", finalTag.name);
          return finalTag;
        }
        
        // Strategy 3: Replace underscores/hyphens with spaces and compare
        finalTag = availableTags.find(t => {
          const tagName = t.name.trim();
          const tagNameNormalized = tagName.toLowerCase().replace(/[_\-\s]+/g, ' ');
          const tagLabelNormalized = trimmedTagLabel.toLowerCase().replace(/[_\-\s]+/g, ' ');
          const tagTagNameNormalized = trimmedTagTagName?.toLowerCase().replace(/[_\-\s]+/g, ' ') || '';
          return (
            tagNameNormalized.trim() === tagLabelNormalized.trim() ||
            tagNameNormalized.trim() === tagTagNameNormalized.trim()
          );
        });
        
        if (finalTag) {
          console.log("[AgentTagNavigation] Tag found with normalized match:", finalTag.name);
          return finalTag;
        }
        
        // Strategy 4: Partial match (contains)
        finalTag = availableTags.find(t => {
          const tagName = t.name.trim().toLowerCase();
          const tagLabelLower = trimmedTagLabel.toLowerCase();
          const tagTagNameLower = trimmedTagTagName?.toLowerCase() || '';
          return (
            tagName.includes(tagLabelLower) ||
            tagLabelLower.includes(tagName) ||
            tagName.includes(tagTagNameLower) ||
            tagTagNameLower.includes(tagName)
          );
        });
        
        if (finalTag) {
          console.log("[AgentTagNavigation] Tag found with partial match:", finalTag.name);
          return finalTag;
        }
        
        // Log detailed error with all available tag names expanded
        console.warn("[AgentTagNavigation] No tag found for tag button:", {
          tagLabel: tag.label,
          tagTagId: tag.tagId,
          tagTagName: tag.tagName,
          tagNormalized: tagNormalized,
          availableTagNames: availableTagNamesList, // Expanded array
          availableTagNamesExpanded: availableTagNamesList.join(', '), // As string for easy reading
          availableTags: availableTagInfo,
          matchingAttempts: {
            exactTagName: tag.tagName ? availableTags.find(t => t.name.toLowerCase() === tag.tagName?.toLowerCase())?.name || null : null,
            normalizedTagName: tag.tagName ? availableTags.find(t => t.name.toLowerCase().replace(/[^a-z0-9]/g, '') === tagNormalized)?.name || null : null,
            exactLabel: availableTags.find(t => t.name.toLowerCase() === tag.label.toLowerCase())?.name || null,
            normalizedLabel: availableTags.find(t => t.name.toLowerCase().replace(/[^a-z0-9]/g, '') === tagNormalized)?.name || null,
            noSpacesMatch: availableTags.find(t => {
              const tagNameNoSpaces = t.name.toLowerCase().replace(/\s+/g, '');
              const tagLabelNoSpaces = trimmedTagLabel.toLowerCase().replace(/\s+/g, '');
              return tagNameNoSpaces === tagLabelNoSpaces;
            })?.name || null,
          },
          suggestion: `Available tags: ${availableTagNamesList.join(', ')}. Looking for: "${tag.label}" or "${tag.tagName}". Please check if the tag name matches exactly (case-insensitive, spaces matter).`,
        });
      }
    }
    return null;
  };

  const handleSubButtonSelect = (subButtonId: string) => {
    setSelectedSubButton(subButtonId);
  };

  const handleTagSelect = async (tagNodeId: string) => {
    if (!selectedSubButton || !workflowStructure) return;
    if (applyingTagId) return;

    // Find sub button and tag from workflow structure
    const subButton = workflowStructure.subButtons.find((s) => s.id === selectedSubButton);
    const tag = subButton?.tags.find((t) => t.id === tagNodeId);

    if (!subButton || !tag) {
      console.warn("[AgentTagNavigation] Sub button or tag not found");
      return;
    }

    // IMPORTANT: Sub Buttons should NEVER be applied as tags
    // Only Tag Buttons (child buttons) should be applied
    if (!tag.tagId && !tag.tagName) {
      console.warn("[AgentTagNavigation] Tag button has no tagId or tagName configured:", {
        tagLabel: tag.label,
        tagId: tagNodeId,
        subButtonLabel: subButton.label,
        message: "This tag button is not properly configured with a tag. Please configure it in the workflow engine."
      });
      showErrorToast(
        `Tag button "${tag.label}" is not configured with a tag. Please configure it in Workflow Engine by selecting a tag in the tag button properties.`
      );
      return;
    }

    const selection = {
      subButton: subButton.label,
      tag: tag.label,
    };

    // Log selection with detailed info
    console.log("[AgentTagNavigation] Selection:", {
      ...selection,
      tagNodeId,
      tagTagId: tag.tagId,
      tagTagName: tag.tagName,
      subButtonId: selectedSubButton,
    });

    // Find the corresponding tag
    const foundTag = findTagByTagNodeId(tagNodeId);
    
    // Additional validation: Ensure we found a valid tag
    if (!foundTag) {
      console.error("[AgentTagNavigation] Tag not found after search:", {
        tagLabel: tag.label,
        tagTagId: tag.tagId,
        tagTagName: tag.tagName,
        tagNodeId,
      });
    }
    
    if (foundTag) {
      // If tag requires input, show modal (AG_UI_05)
      if (foundTag.requiresNote || foundTag.requiresCallback || foundTag.requiresFollowUp) {
        setSelectedTag(foundTag);
        setShowTagModal(true);
        // Keep panel open for now, will close after tag application
      } else {
        setApplyingTagId(tagNodeId);
        try {
          await applyTag(foundTag);
        } finally {
          setApplyingTagId(null);
        }
      }
    } else {
      // Tag not found, show detailed error
      const availableTagDetails = availableTags.map(t => ({ 
        id: t.id, 
        name: t.name,
        tagValue: (t as any).tagValue,
        category: (t as any).category 
      }));
      
      console.warn("[AgentTagNavigation] Tag not found for tag button:", {
        tagLabel: tag.label,
        tagId: tagNodeId,
        tagTagId: tag.tagId,
        tagTagName: tag.tagName,
        availableTags: availableTagDetails,
        suggestion: `Please ensure a tag exists with name "${tag.label}" or "${tag.tagName}" in the call_status category, or configure the tag button with the correct tagId/tagName in the workflow.`,
      });
      
      // Show error toast with available tag info and helpful guidance
      const availableTagNames = availableTags.map(t => t.name).join(", ");
      const missingTagName = tag.tagName || tag.label;
      showErrorToast(
        `Tag "${missingTagName}" not found in system. ` +
        (availableTags.length > 0 
          ? `Available tags: ${availableTagNames}. ` +
            `Please either: (1) Create "${missingTagName}" tag in Admin > Tags page, or ` +
            `(2) Update workflow to use an existing tag by selecting it in the tag button properties.`
          : `No tags available. Please create a tag first in Admin > Tags page.`)
      );
      
      // Still call onSelect callback
      if (onSelect) {
        onSelect(selection);
      }
      // Reset and close
      setSelectedSubButton(null);
      setIsOpen(false);
    }
  };

  const applyTag = async (tag: TagFlow) => {
    try {
      console.log("[AgentTagNavigation] 🏷️ applyTag called:", {
        tagId: tag.id,
        tagName: tag.name,
        entityType,
        entityId,
      });
      
      const data: any = { tagId: tag.id };
      
      let tagApplyResult: TagApplyResult | undefined;
      if (entityType === "lead") {
        console.log("[AgentTagNavigation] 📝 Applying tag to lead:", {
          leadId: entityId,
          tagId: tag.id,
          tagName: tag.name,
        });
        
        const applyResult = await apiClient.applyTagToLead(entityId, data);
        tagApplyResult = applyResult as TagApplyResult;
        if (tagApplyResult?.shuffled) {
          console.log("[AgentTagNavigation] 🔄 Lead shuffled:", tagApplyResult.newOwnerName);
        }
        
        console.log("[AgentTagNavigation] ✅ Tag applied successfully, now triggering workflow");
        
        // Trigger workflow execution if active workflow exists (skip if lead was shuffled - already transferred)
        if (!tagApplyResult?.shuffled) {
          console.log("[AgentTagNavigation] 🔄 Attempting to trigger workflow:", {
            entityId,
            tagId: tag.id,
            tagName: tag.name,
          });
          try {
            const workflowResult = await triggerWorkflowOnTagApplication(
              entityId,
              tag.id,
              tag.name
            );
            
            if (workflowResult.success) {
              console.log("[AgentTagNavigation] ✅ Workflow triggered:", workflowResult.message);
            } else {
              console.log("[AgentTagNavigation] ⚠️ Workflow not triggered:", workflowResult.message || workflowResult.error);
            }
          } catch (workflowError: any) {
            // Don't fail tag application if workflow trigger fails
            console.error("[AgentTagNavigation] ❌ Workflow trigger error:", workflowError);
            console.error("[AgentTagNavigation] Error details:", {
              message: workflowError.message,
              stack: workflowError.stack,
            });
          }
        }
      } else if (entityType === "call") {
        console.log("[AgentTagNavigation] 📞 Applying tag to call:", {
          callId: entityId,
          tagId: tag.id,
          tagName: tag.name,
        });
        await apiClient.applyTagToCall(entityId, data);
      }

      // Show success toast (AG_UI_07) — different message if shuffled
      showSuccessToast(tagApplyResult?.shuffled ? "Lead transferred to next agent" : "Tag applied successfully");
      
      // Call callbacks with result (so parent can show shuffle overlay or Wrong Number animation)
      if (onTagApplied) onTagApplied({
        ...tagApplyResult,
        appliedTagValue: (tag as any).tagValue,
        appliedTagName: tag.name,
      });
      if (onSelect) {
        onSelect({
          subButton: selectedSubButton || "",
          tag: "",
        });
      }
      
      // Close panel
      setSelectedSubButton(null);
      setIsOpen(false);
    } catch (error: any) {
      console.error("Error applying tag:", error);
      showErrorToast(error.message || "Failed to apply tag");
    }
  };

  const showSuccessToast = (message: string) => {
    // Create toast element (AG_UI_07)
    const toast = document.createElement("div");
    toast.className = "fixed top-4 right-4 z-[60] bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-top";
    toast.innerHTML = `
      <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
      </svg>
      <span>${message}</span>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add("animate-out", "slide-out-to-top");
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  };

  const showErrorToast = (message: string) => {
    const toast = document.createElement("div");
    toast.className = "fixed top-4 right-4 z-[60] bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2";
    toast.innerHTML = `
      <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
      </svg>
      <span>${message}</span>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  };

  const handleBack = () => {
    setSelectedSubButton(null);
  };

  const handleClose = () => {
    setIsOpen(false);
    setSelectedSubButton(null);
  };

  return (
    <>
      {/* Floating Navigation Button (AG_UI_01, AG_UI_09) */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-40 flex items-center gap-2 px-4 py-3 md:px-6 md:py-3 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all hover:shadow-xl active:scale-95 text-sm md:text-base touch-manipulation"
        aria-label="Open Navigation"
      >
        <Navigation className="h-4 w-4 md:h-5 md:w-5" />
        <span className="font-medium hidden sm:inline">Navigation</span>
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
          onClick={handleClose}
        />
      )}

      {/* Navigation Panel (AG_UI_04: One-Level-at-a-Time) */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 w-[calc(100vw-2rem)] max-w-sm md:w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-primary-600 text-white">
            <h3 className="font-semibold text-lg">
              {selectedSubButton ? "Select Tag" : "Navigation"}
            </h3>
            <button
              onClick={handleClose}
              className="p-1 rounded-lg hover:bg-primary-700 transition-colors touch-manipulation"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 max-h-96 overflow-y-auto">
            {workflowLoading ? (
              <div className="text-center py-8 text-gray-500">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
                <p className="mt-2 text-sm">Loading workflow...</p>
              </div>
            ) : !workflowStructure || workflowStructure.subButtons.length === 0 ? (
              /* No Active Workflow */
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">No active workflow found</p>
                <p className="text-xs mt-2 text-gray-400">
                  Please activate a workflow in Workflow Engine
                </p>
              </div>
            ) : !selectedSubButton ? (
              /* Sub Button Selection (AG_UI_01) - From Workflow */
              <div className="space-y-3">
                <p className="text-sm text-gray-600 mb-4">
                  Select option:
                </p>
                {workflowStructure.subButtons.map((subButton) => (
                  <button
                    key={subButton.id}
                    onClick={() => handleSubButtonSelect(subButton.id)}
                    className="w-full px-4 py-3 text-left bg-gray-50 hover:bg-primary-50 border-2 border-gray-200 hover:border-primary-300 rounded-lg transition-all font-medium text-gray-900 hover:text-primary-700 touch-manipulation min-h-[44px] flex items-center gap-2"
                    style={{
                      borderColor: subButton.color || undefined,
                    }}
                  >
                    {subButton.color && (
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: subButton.color }}
                      />
                    )}
                    {subButton.label}
                  </button>
                ))}
              </div>
            ) : (
              /* Tag Selection (AG_UI_02, AG_UI_03) - From Workflow */
              <div className="space-y-3">
                <button
                  onClick={handleBack}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4 touch-manipulation min-h-[44px]"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>
                <p className="text-sm text-gray-600 mb-4">
                  Select tag:
                </p>
                {workflowStructure.subButtons
                  .find((s) => s.id === selectedSubButton)
                  ?.tags.map((tag) => {
                    const isApplying = applyingTagId === tag.id;
                    return (
                      <button
                        key={tag.id}
                        onClick={() => handleTagSelect(tag.id)}
                        disabled={applyingTagId !== null}
                        className="w-full px-4 py-3 text-left bg-gray-50 hover:bg-primary-50 border-2 border-gray-200 hover:border-primary-300 rounded-lg transition-all font-medium text-gray-900 hover:text-primary-700 touch-manipulation min-h-[44px] flex items-center gap-2 disabled:opacity-60 disabled:pointer-events-none"
                        style={{
                          borderColor: tag.color || undefined,
                        }}
                      >
                        {tag.color && (
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: tag.color }}
                          />
                        )}
                        {isApplying ? "Applying…" : tag.label}
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tag Application Modal (AG_UI_05: Required Input Popup) */}
      {showTagModal && selectedTag && (
        <TagApplicationModal
          isOpen={showTagModal}
          onClose={() => {
            setShowTagModal(false);
            setSelectedTag(null);
            setSelectedSubButton(null);
            setIsOpen(false);
          }}
          tag={selectedTag}
          entityType={entityType}
          entityId={entityId}
          onSuccess={() => {
            if (onTagApplied) onTagApplied();
            setShowTagModal(false);
            setSelectedTag(null);
            setSelectedSubButton(null);
            setIsOpen(false);
            showSuccessToast("Tag applied successfully");
          }}
        />
      )}
    </>
  );
}
