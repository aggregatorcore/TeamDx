"use client";

import { useCallback, useMemo } from "react";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";
import { Navigation, Circle, Tag, Settings, Play, Save, PhoneOff, PhoneMissed, Phone, PhoneCall, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import WorkflowCanvasSidebar from "./WorkflowCanvasSidebar";
import ButtonSettingsDrawer from "./ButtonSettingsDrawer";

interface WorkflowCanvasProps {
  workflowData?: any;
  onUpdate?: (data: any) => void;
  onAddControlButton?: (button: any) => void;
  onUpdateWorkflow?: (data: any) => void;
  onPublish?: () => void;
  onSaveDraft?: () => void;
  onCanvasUpdate?: (nodes: Node[], edges: Edge[]) => void;
}

// Custom Node Components
const CustomNode = ({ data, selected, id, xPos, yPos, onSettingsClick, edges, nodes }: { data: any; selected?: boolean; id?: string; xPos?: number; yPos?: number; onSettingsClick?: (nodeId: string, nodeData: any) => void; edges?: Edge[]; nodes?: Node[] }) => {
  // Find connected sub button for tag nodes
  const getConnectedSubButton = () => {
    if (!data || data.nodeType !== "tag" || !id || !edges || !nodes) return null;
    
    // Find edge where this tag node is the target (connected from sub button)
    const connectedEdge = edges.find((edge: Edge) => edge.target === id);
    if (!connectedEdge) return null;
    
    // Find the source node (sub button)
    const sourceNode = nodes.find((node: Node) => node.id === connectedEdge.source);
    if (!sourceNode || sourceNode.data?.nodeType !== "subButton") return null;
    
    return sourceNode;
  };
  
  const connectedSubButton = getConnectedSubButton();
  // Icon mapping - using lucide-react icons for consistency
  const getIcon = () => {
    if (!data.icon) return null;
    
    const iconMap: { [key: string]: any } = {
      navigation: () => <Navigation className="h-4 w-4" />,
      circle: () => <Circle className="h-4 w-4" />,
      tag: () => <Tag className="h-4 w-4" />,
      settings: () => <Settings className="h-4 w-4" />,
      play: () => <Play className="h-4 w-4" />,
      save: () => <Save className="h-4 w-4" />,
      phoneoff: () => <PhoneOff className="h-4 w-4" />,
      wrongnumber: () => <PhoneMissed className="h-4 w-4" />,
      phone: () => <Phone className="h-4 w-4" />,
      phonecall: () => <PhoneCall className="h-4 w-4" />,
      phoneincoming: () => <PhoneIncoming className="h-4 w-4" />,
      phoneoutgoing: () => <PhoneOutgoing className="h-4 w-4" />,
    };

    const iconKey = data.icon.toLowerCase();
    const IconComponent = iconMap[iconKey];
    return IconComponent ? IconComponent() : null;
  };

  return (
    <div
      className={`bg-white border-2 rounded-lg shadow-md min-w-[180px] transition-all relative group ${
        selected ? "ring-2 ring-primary-500 border-primary-500" : "border-gray-300"
      }`}
      style={{
        borderColor: data.borderColor || (selected ? "#3b82f6" : "#d1d5db"),
        borderWidth: `${data.borderWidth || 2}px`,
        borderRadius: `${data.borderRadius || 8}px`,
        borderStyle: "solid",
        backgroundColor: data.color || "#ffffff", // Full button background color
        color: data.textColor || (data.color ? "#ffffff" : "#1f2937"), // Text color
        padding: data.paddingX || data.paddingY ? `${data.paddingY || 12}px ${data.paddingX || 16}px` : "12px 16px",
        boxShadow: data.shadow !== false ? `0 2px 4px ${data.shadowColor || "rgba(0, 0, 0, 0.1)"}` : "none",
        opacity: data.opacity !== undefined ? data.opacity / 100 : 1,
      }}
    >
        <Handle type="target" position={Position.Top} className="w-3 h-3 bg-gray-400" />
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1">
            {data.icon ? (
              <div 
                className="flex items-center justify-center"
                style={{ color: data.iconColor || data.textColor || "#ffffff" }}
              >
                {getIcon()}
              </div>
            ) : (
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: data.color || "#3b82f6" }} />
            )}
            <div className="flex items-center gap-2">
              <div 
                className="font-semibold text-sm"
                style={{ 
                  color: data.textColor || (data.color ? "#ffffff" : "#1f2937"),
                  fontFamily: data.fontFamily || "system-ui",
                  fontSize: data.fontSize ? `${data.fontSize}px` : undefined,
                  fontWeight: data.fontWeight || "600",
                }}
              >
                {data.label || "Node"}
              </div>
              {data.isSystem === true && (
                <span 
                  className="px-1.5 py-0.5 text-xs font-medium rounded border"
                  style={{
                    backgroundColor: data.badgeBgColor || "rgba(255, 255, 255, 0.2)",
                    color: data.badgeColor || "#ffffff",
                    borderColor: data.badgeBorderColor || "rgba(255, 255, 255, 0.3)",
                  }}
                >
                  System
                </span>
              )}
            </div>
            {/* Category text for tag nodes - only show when connected to sub button */}
            {data.nodeType === "tag" && connectedSubButton && (
              <div 
                className="text-xs capitalize mt-1"
                style={{
                  color: data.categoryTextColor || data.color || (data.category === "connected" ? "#10b981" : data.category === "notConnected" ? "#f59e0b" : "#ffffff"),
                  opacity: data.categoryTextOpacity !== undefined ? data.categoryTextOpacity / 100 : 1,
                  fontWeight: data.categoryTextFontWeight || "600",
                  fontSize: data.categoryTextFontSize ? `${data.categoryTextFontSize}px` : undefined,
                }}
              >
                {data.showConnectedLabel !== false ? (connectedSubButton.data?.label || connectedSubButton.data?.name || "Connected") : (data.category?.replace(/_/g, " ") || "")}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              console.log("[CustomNode] Settings button clicked", { id, data, onSettingsClick: !!onSettingsClick });
              if (onSettingsClick && id) {
                console.log("[CustomNode] Calling onSettingsClick", { id, data });
                onSettingsClick(id, data);
              } else {
                console.warn("[CustomNode] onSettingsClick not available or id missing", { onSettingsClick: !!onSettingsClick, id });
              }
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            onMouseUp={(e) => {
              e.stopPropagation();
            }}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors flex-shrink-0 cursor-pointer"
            style={{
              backgroundColor: "transparent",
              zIndex: 10,
              pointerEvents: "auto",
              position: "relative",
            }}
            title="Settings"
          >
            <Settings className="h-3.5 w-3.5 text-gray-600" />
          </button>
        </div>
        <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-gray-400" />
      </div>
  );
};

export default function WorkflowCanvas({ workflowData, onUpdate, onAddControlButton, onUpdateWorkflow, onPublish, onSaveDraft, onCanvasUpdate }: WorkflowCanvasProps) {
  // Always start with empty canvas - nodes will be loaded from workflowData if available
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeForSettings, setSelectedNodeForSettings] = useState<{ id: string; data: any; isEdit?: boolean; type?: "navigation" | "subButton" | "tag" } | null>(null);
  const hasLoadedRef = useRef(false);
  
  // Sync canvas nodes/edges to parent when they change
  useEffect(() => {
    if (onCanvasUpdate) {
      onCanvasUpdate(nodes, edges);
    }
  }, [nodes, edges, onCanvasUpdate]);
  
  // Load canvas data from workflowData when it changes (only once, when data becomes available)
  useEffect(() => {
    // Skip if already loaded or if workflowData is not ready
    if (hasLoadedRef.current) return;
    
    const nodesData = workflowData?.nodes;
    const edgesData = workflowData?.edges;
    
    // Only load if we have valid data
    if (nodesData && Array.isArray(nodesData) && nodesData.length > 0) {
      // Sync node colors with tag colors from workflowData
      const syncedNodes = nodesData.map((node: any) => {
        if (node.data?.nodeType === "tag" && node.id) {
          // Try to find the tag in workflowData.tags or tagGroups
          let tagColor = node.data?.color;
          
          // Check in workflowData.tags
          if (workflowData?.tags && workflowData.tags[node.id]) {
            tagColor = workflowData.tags[node.id].color || tagColor;
          }
          
          // Check in tagGroups
          if (workflowData?.tagGroups) {
            Object.keys(workflowData.tagGroups).forEach((groupKey) => {
              const group = workflowData.tagGroups[groupKey];
              if (Array.isArray(group)) {
                const tag = group.find((t: any) => t.id === node.id || t.name === node.data?.label || t.label === node.data?.label);
                if (tag && tag.color) {
                  tagColor = tag.color;
                }
              }
            });
          }
          
          return {
            ...node,
            data: {
              ...node.data,
              color: tagColor || node.data?.color || "#3b82f6",
            },
          };
        }
        return node;
      });
      
      setNodes(syncedNodes);
      hasLoadedRef.current = true;
    }
    if (edgesData && Array.isArray(edgesData) && edgesData.length > 0) {
      setEdges(edgesData);
      hasLoadedRef.current = true;
    }
    
    // If workflowData exists but has no nodes/edges, mark as loaded (empty canvas is valid)
    if (workflowData && (!nodesData || nodesData.length === 0) && (!edgesData || edgesData.length === 0)) {
      hasLoadedRef.current = true;
    }
  }, [workflowData, setNodes, setEdges]); // Watch for workflowData changes

  // Sync node colors with tag colors from workflowData when workflowData changes
  useEffect(() => {
    if (!workflowData || !hasLoadedRef.current) return;
    
    setNodes((currentNodes) => {
      return currentNodes.map((node: any) => {
        if (node.data?.nodeType === "tag" && node.id) {
          // Try to find the tag in workflowData.tags or tagGroups
          let tagColor = node.data?.color;
          
          // Check in workflowData.tags
          if (workflowData?.tags && workflowData.tags[node.id]) {
            tagColor = workflowData.tags[node.id].color || tagColor;
          }
          
          // Check in tagGroups
          if (workflowData?.tagGroups) {
            Object.keys(workflowData.tagGroups).forEach((groupKey) => {
              const group = workflowData.tagGroups[groupKey];
              if (Array.isArray(group)) {
                const tag = group.find((t: any) => 
                  t.id === node.id || 
                  t.name === node.data?.label || 
                  t.label === node.data?.label ||
                  t.name === node.data?.name
                );
                if (tag && tag.color) {
                  tagColor = tag.color;
                }
              }
            });
          }
          
          // Only update if color changed
          if (tagColor && tagColor !== node.data?.color) {
            return {
              ...node,
              data: {
                ...node.data,
                color: tagColor,
              },
            };
          }
        }
        return node;
      });
    });
  }, [workflowData, setNodes]);

  // Handle node settings click
  const handleNodeSettingsClick = useCallback((nodeId: string, nodeData: any) => {
    // Determine node type from nodeData
    const nodeType = nodeData?.nodeType || 
      (nodeId?.startsWith("navigation-") ? "navigation" : 
       nodeId?.startsWith("subButton-") ? "subButton" : 
       nodeId?.startsWith("tag-") ? "tag" : "navigation");
    
    setSelectedNodeForSettings({ 
      id: nodeId, 
      data: nodeData,
      isEdit: true,
      type: nodeType as "navigation" | "subButton" | "tag"
    });
  }, []);

  // Handle updating nodes
  const handleUpdateNode = useCallback((nodeId: string, updatedData: any) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...updatedData } }
          : node
      )
    );
  }, [setNodes]);

  // Handle adding nodes
  const handleAddNode = useCallback((type: "navigation" | "subButton" | "tag", data?: any) => {
    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type: "custom",
      position: { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
      data: {
        label: data?.label || type.charAt(0).toUpperCase() + type.slice(1),
        color: data?.color || "#3b82f6",
        nodeType: type, // Store the actual node type in data
        ...data,
      },
    };
    setNodes((nds) => [...nds, newNode]);

    // If it's a navigation/control button, add it to workflowData
    if (type === "navigation" && onAddControlButton) {
      const buttonData = {
        id: newNode.id,
        label: data?.label || "Navigation",
        color: data?.color || "#3b82f6",
        icon: data?.icon,
        borderColor: data?.borderColor,
        borderWidth: data?.borderWidth,
        borderRadius: data?.borderRadius,
        entryPoints: data?.entryPoints || ["leads_page"],
        visibleRoles: data?.visibleRoles || ["TELECALLER", "COUNSELOR"],
      };
      onAddControlButton(buttonData);
    }
    
    // If it's a subButton, add it to workflowData.subButtons
    if (type === "subButton" && onUpdate) {
      const updatedData = { ...workflowData };
      if (!updatedData.subButtons) {
        updatedData.subButtons = [];
      }
      // Check if button already exists
      const exists = updatedData.subButtons.find(
        (btn: any) => btn.id === newNode.id || btn.label === data?.label
      );
      if (!exists) {
        const subButtonData = {
          id: newNode.id,
          label: data?.label || "Sub Button",
          color: data?.color || "#3b82f6",
          icon: data?.icon,
          iconColor: data?.iconColor,
          textColor: data?.textColor,
          fontFamily: data?.fontFamily,
          fontSize: data?.fontSize,
          fontWeight: data?.fontWeight,
          textAlign: data?.textAlign,
          paddingX: data?.paddingX,
          paddingY: data?.paddingY,
          shadow: data?.shadow,
          shadowColor: data?.shadowColor,
          hoverColor: data?.hoverColor,
          opacity: data?.opacity,
          borderColor: data?.borderColor,
          borderWidth: data?.borderWidth,
          borderRadius: data?.borderRadius,
          order: updatedData.subButtons.length + 1,
          enabled: true,
        };
        updatedData.subButtons = [...updatedData.subButtons, subButtonData];
        onUpdate(updatedData);
      }
    }
    
    // If it's a tag, add it to workflowData.tags (only if not already in workflowData)
    if (type === "tag" && onUpdate) {
      const updatedData = { ...workflowData };
      if (!updatedData.tags) {
        updatedData.tags = {};
      }
      
      // Check if tag already exists in workflowData (by ID or name)
      const tagId = newNode.id;
      const tagName = data?.name || data?.label || "Tag";
      
      // Check in tags object
      const existsInTags = updatedData.tags[tagId] || 
        Object.values(updatedData.tags).some((tag: any) => 
          tag.name === tagName || tag.label === tagName
        );
      
      // Check in tagGroups
      const existsInGroups = 
        (updatedData.tagGroups?.connected || []).some((tag: any) => 
          tag.id === tagId || tag.name === tagName || tag.label === tagName
        ) ||
        (updatedData.tagGroups?.notConnected || []).some((tag: any) => 
          tag.id === tagId || tag.name === tagName || tag.label === tagName
        );
      
      // Only add if it doesn't exist anywhere
      if (!existsInTags && !existsInGroups) {
        const tagData = {
          id: tagId,
          name: tagName,
          label: data?.label || data?.name || "Tag",
          color: data?.color || "#3b82f6",
          icon: data?.icon,
          iconColor: data?.iconColor,
          textColor: data?.textColor,
          category: data?.category, // Preserve category
          fontFamily: data?.fontFamily,
          fontSize: data?.fontSize,
          fontWeight: data?.fontWeight,
          textAlign: data?.textAlign,
          paddingX: data?.paddingX,
          paddingY: data?.paddingY,
          shadow: data?.shadow,
          shadowColor: data?.shadowColor,
          hoverColor: data?.hoverColor,
          opacity: data?.opacity,
          borderColor: data?.borderColor,
          borderWidth: data?.borderWidth,
          borderRadius: data?.borderRadius,
          tagConfig: data?.tagConfig, // Include tagConfig if present
        };
        updatedData.tags[tagId] = tagData;
        onUpdate(updatedData);
      }
    }
  }, [setNodes, onAddControlButton, workflowData, onUpdate]);

  // Handle saving node settings
  const handleSaveNodeSettings = useCallback((settings: any) => {
    if (selectedNodeForSettings) {
      if (selectedNodeForSettings.id === "new" || (!selectedNodeForSettings.isEdit && !selectedNodeForSettings.data)) {
        // Create new button
        const buttonType = selectedNodeForSettings.type || "navigation";
        const nodeType = buttonType === "subButton" ? "subButton" : buttonType === "tag" ? "tag" : "navigation";
        handleAddNode(nodeType, {
          label: settings.label,
          name: settings.label, // For tags, name is also needed
          color: settings.color,
          icon: settings.icon,
          iconColor: settings.iconColor,
          textColor: settings.textColor,
          fontFamily: settings.fontFamily,
          fontSize: settings.fontSize,
          fontWeight: settings.fontWeight,
          textAlign: settings.textAlign,
          paddingX: settings.paddingX,
          paddingY: settings.paddingY,
          shadow: settings.shadow,
          shadowColor: settings.shadowColor,
          hoverColor: settings.hoverColor,
          opacity: settings.opacity,
          borderColor: settings.borderColor,
          borderWidth: settings.borderWidth,
          borderRadius: settings.borderRadius,
          entryPoints: ["leads_page"],
          visibleRoles: ["TELECALLER", "COUNSELOR"],
          // Tag behavior config (only for tag nodes)
          tagConfig: settings.tagConfig || undefined,
        });
      } else {
        // Update existing button in workflowData
        if (onUpdate && selectedNodeForSettings.data) {
          const updatedData = { ...workflowData };
          const originalButton = selectedNodeForSettings.data;
          const buttonType = selectedNodeForSettings.type || "navigation";
          
          if (buttonType === "subButton") {
            // Update sub button - use strict ID matching to prevent updating wrong buttons
            if (updatedData.subButtons) {
              // First try to find by exact ID match
              let buttonIndex = updatedData.subButtons.findIndex(
                (btn: any) => btn.id === originalButton.id
              );
              
              // If not found by ID, try to find by label (but only if ID is not available)
              if (buttonIndex === -1 && !originalButton.id) {
                buttonIndex = updatedData.subButtons.findIndex(
                  (btn: any) => btn.label === originalButton.label
                );
              }
              
              if (buttonIndex !== -1) {
                // Create a new array with the updated button to avoid reference issues
                updatedData.subButtons = updatedData.subButtons.map((btn: any, idx: number) => {
                  if (idx === buttonIndex) {
                    return {
                      ...btn,
                      ...settings,
                      // Preserve system button properties
                      id: btn.id,
                      isSystem: btn.isSystem,
                      deletable: btn.deletable,
                    };
                  }
                  return btn;
                });
              } else {
                console.warn("[WorkflowCanvas] SubButton not found for update:", {
                  originalButton,
                  availableIds: updatedData.subButtons.map((b: any) => b.id),
                  availableLabels: updatedData.subButtons.map((b: any) => b.label),
                });
              }
            }
          } else if (buttonType === "tag") {
            // Update tag
            if (updatedData.tags) {
              const tagId = originalButton.id || originalButton.name || originalButton.label;
              if (updatedData.tags[tagId]) {
                updatedData.tags[tagId] = {
                  ...updatedData.tags[tagId],
                  ...settings,
                  name: settings.label || updatedData.tags[tagId].name,
                };
              }
            }
            // Also check tagGroups
            if (updatedData.tagGroups) {
              Object.keys(updatedData.tagGroups).forEach((groupKey) => {
                const group = updatedData.tagGroups[groupKey];
                if (Array.isArray(group)) {
                  const tagIndex = group.findIndex(
                    (tag: any) => 
                      tag.id === originalButton.id || 
                      tag.name === originalButton.name ||
                      tag.label === originalButton.label
                  );
                  if (tagIndex !== -1) {
                    group[tagIndex] = {
                      ...group[tagIndex],
                      ...settings,
                      name: settings.label || group[tagIndex].name,
                    };
                  }
                }
              });
            }
          } else {
            // Update control button
            // Find and update the button in controlButtons array
            if (updatedData.controlButtons) {
              const buttonIndex = updatedData.controlButtons.findIndex(
                (btn: any) => 
                  btn.id === originalButton.id || 
                  btn.label === originalButton.label ||
                  btn.name === originalButton.name
              );
              if (buttonIndex !== -1) {
                updatedData.controlButtons[buttonIndex] = {
                  ...updatedData.controlButtons[buttonIndex],
                  ...settings,
                };
              }
            }
            
            // Also update navigation if it matches
            if (updatedData.navigation && (
              updatedData.navigation.id === originalButton.id ||
              updatedData.navigation.label === originalButton.label ||
              updatedData.navigation.name === originalButton.name
            )) {
              updatedData.navigation = {
                ...updatedData.navigation,
                ...settings,
              };
            }
          }
          
          onUpdate(updatedData);
          
          // Save to database as draft after updating
          if (onSaveDraft) {
            // Use setTimeout to ensure state is updated before saving
            setTimeout(() => {
              onSaveDraft();
            }, 100);
          }
        }
        
        // Also update canvas node if it exists
        const canvasNode = nodes.find(n => 
          n.id === selectedNodeForSettings.id ||
          n.data.label === selectedNodeForSettings.data?.label ||
          n.data.label === selectedNodeForSettings.data?.name
        );
        if (canvasNode) {
          // Preserve nodeType when updating
          const nodeType = canvasNode.data?.nodeType || 
            (canvasNode.id?.startsWith("navigation-") ? "navigation" : 
             canvasNode.id?.startsWith("subButton-") ? "subButton" : 
             canvasNode.id?.startsWith("tag-") ? "tag" : undefined);
          handleUpdateNode(canvasNode.id, { 
            ...settings, 
            nodeType: nodeType || settings.nodeType,
            tagConfig: settings.tagConfig || canvasNode.data?.tagConfig, // Preserve tagConfig
          });
          
          // Update edges connected to this node to use the new color (if this is the target/end node)
          if (settings.color) {
            setEdges((eds) =>
              eds.map((edge) => {
                if (edge.target === canvasNode.id) {
                  return {
                    ...edge,
                    style: { 
                      stroke: settings.color, 
                      strokeWidth: edge.style?.strokeWidth || 2 
                    },
                    animated: true,
                    markerEnd: {
                      type: MarkerType.ArrowClosed,
                      color: settings.color,
                    },
                  };
                }
                return edge;
              })
            );
          }
        }
      }
      setSelectedNodeForSettings(null);
    }
  }, [selectedNodeForSettings, handleUpdateNode, handleAddNode, workflowData, onUpdate, nodes, setEdges]);

  // Memoize nodeTypes to prevent React Flow warnings
  // Use refs to access edges and nodes without including them in dependencies
  const edgesRef = useRef(edges);
  const nodesRef = useRef(nodes);
  
  useEffect(() => {
    edgesRef.current = edges;
    nodesRef.current = nodes;
  }, [edges, nodes]);
  
  const nodeTypes = useMemo(() => {
    const CustomNodeWrapper = (props: any) => {
      if (!props || !props.data) return null;
      return (
        <CustomNode 
          data={props.data}
          selected={props.selected}
          id={props.id}
          xPos={props.xPos}
          yPos={props.yPos}
          onSettingsClick={handleNodeSettingsClick}
          edges={edgesRef.current}
          nodes={nodesRef.current}
        />
      );
    };
    return {
      custom: CustomNodeWrapper,
    };
  }, [handleNodeSettingsClick]);

  // Handle new connections
  const onConnect = useCallback(
    (params: Connection) => {
      // Get target node to use its color for the edge (end node's color)
      const targetNode = nodes.find(n => n.id === params.target);
      const edgeColor = targetNode?.data?.color || "#3b82f6";
      
      const newEdge: Edge = {
        ...params,
        id: `edge-${params.source}-${params.target}`,
        style: { stroke: edgeColor, strokeWidth: 2 },
        type: "smoothstep",
        animated: true,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeColor,
        },
      };
      
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges, nodes]
  );

  // Optimized node types

  return (
    <ReactFlowProvider>
      <div className="h-full w-full relative">
        {/* Sticky Icon Sidebar */}
        <WorkflowCanvasSidebar 
          onAddNode={handleAddNode} 
          workflowData={workflowData}
          onUpdateWorkflow={onUpdateWorkflow}
          onPublish={onPublish}
          onDrawerOpen={() => {
            // Close settings drawer when any drawer opens
            setSelectedNodeForSettings(null);
          }}
          onRemoveButton={(buttonId, type?: "control" | "sub" | "tag") => {
            // Remove button from workflowData
            if (onUpdate) {
              const updatedData = { ...workflowData };
              if (type === "sub") {
                // Remove sub button
                if (updatedData.subButtons) {
                  updatedData.subButtons = updatedData.subButtons.filter(
                    (btn: any) => btn.id !== buttonId && btn.label !== buttonId && btn.name !== buttonId
                  );
                }
              } else if (type === "tag") {
                // Check if it's a system tag - prevent deletion
                const tagToDelete = updatedData.tags?.[buttonId] || 
                  [...(updatedData.tagGroups?.connected || []), ...(updatedData.tagGroups?.notConnected || [])]
                    .find((tag: any) => tag.id === buttonId || tag.name === buttonId || tag.label === buttonId);
                
                if (tagToDelete?.isSystem === true) {
                  alert("System tags cannot be deleted. You can create a custom copy instead.");
                  return;
                }

                // Remove tag
                if (updatedData.tags) {
                  delete updatedData.tags[buttonId];
                }
                // Also remove from tagGroups
                if (updatedData.tagGroups) {
                  Object.keys(updatedData.tagGroups).forEach((groupKey) => {
                    const group = updatedData.tagGroups[groupKey];
                    if (Array.isArray(group)) {
                      updatedData.tagGroups[groupKey] = group.filter(
                        (tag: any) => 
                          tag.id !== buttonId && 
                          tag.name !== buttonId && 
                          tag.label !== buttonId
                      );
                    }
                  });
                }
                // Remove node from canvas
                setNodes((nds) => nds.filter((n) => n.id !== buttonId && n.data.label !== buttonId && n.data.name !== buttonId));
                // Remove edges connected to this node
                setEdges((eds) => eds.filter((e) => e.source !== buttonId && e.target !== buttonId));
              } else {
                // Remove control button
                if (updatedData.controlButtons) {
                  updatedData.controlButtons = updatedData.controlButtons.filter(
                    (btn: any) => btn.id !== buttonId && btn.label !== buttonId && btn.name !== buttonId
                  );
                }
                if (buttonId === "navigation" || updatedData.navigation?.id === buttonId) {
                  delete updatedData.navigation;
                }
              }
              onUpdate(updatedData);
            }
          }}
          onOpenSettings={(button, type?: "navigation" | "subButton" | "tag") => {
            if (button) {
              // Editing existing button - use a unique identifier
              const buttonId = button.id || `edit-${button.label || button.name || Date.now()}`;
              setSelectedNodeForSettings({ id: buttonId, data: button, isEdit: true, type: type || "navigation" });
            } else {
              // Create new button
              setSelectedNodeForSettings({ id: "new", data: null, isEdit: false, type: type || "navigation" });
            }
          }}
        />

        {/* Canvas - Full width, sidebar is fixed */}
        <div className="h-full w-full">
          <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          nodesDraggable={true}
          nodesConnectable={true}
          elementsSelectable={true}
          fitView
          deleteKeyCode={["Backspace", "Delete"]}
          attributionPosition="bottom-left"
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          minZoom={0.1}
          maxZoom={2}
          snapToGrid={true}
          snapGrid={[20, 20]}
          connectionLineStyle={{ stroke: "#3b82f6", strokeWidth: 2 }}
          defaultEdgeOptions={{
            style: { stroke: "#3b82f6", strokeWidth: 2 },
            type: "smoothstep",
            animated: true,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "#3b82f6",
            },
          }}
        >
          <Controls
            showInteractive={false}
            position="bottom-left"
            style={{
              button: {
                backgroundColor: "white",
                border: "1px solid #e5e7eb",
                color: "#374151",
              },
              bottom: "20px",
              left: "80px",
            }}
          />
          <Background
            variant="dots"
            gap={20}
            size={1}
            color="#e5e7eb"
            className="bg-gray-50"
          />
          <MiniMap
            nodeColor="#3b82f6"
            maskColor="rgba(0, 0, 0, 0.1)"
            style={{
              backgroundColor: "#f9fafb",
              border: "1px solid #e5e7eb",
              bottom: "80px",
              right: "20px",
            }}
            position="bottom-right"
            pannable
            zoomable
          />
        </ReactFlow>
        </div>

        {/* Node Settings Drawer - Opens at ControlDrawer position */}
        {selectedNodeForSettings && (
          <div
            className="fixed z-[70]"
            style={{
              left: "660px",
              top: "150px",
            }}
          >
            <ButtonSettingsDrawer
              isOpen={!!selectedNodeForSettings}
              onClose={() => setSelectedNodeForSettings(null)}
              onSave={handleSaveNodeSettings}
              initialData={selectedNodeForSettings?.data}
              nodeType={selectedNodeForSettings?.type}
              onLiveUpdate={(liveData) => {
                // Update canvas node in real-time
                if (selectedNodeForSettings && selectedNodeForSettings.id !== "new") {
                  setNodes((nds) =>
                    nds.map((node) =>
                      node.id === selectedNodeForSettings.id
                        ? {
                            ...node,
                            data: {
                              ...node.data,
                              ...liveData,
                            },
                          }
                        : node
                    )
                  );
                  
                  // Update workflowData in real-time
                  if (onUpdate && selectedNodeForSettings.data) {
                    const updatedData = { ...workflowData };
                    const originalButton = selectedNodeForSettings.data;
                    const buttonType = selectedNodeForSettings.type || "navigation";
                    
                    if (buttonType === "subButton") {
                      if (updatedData.subButtons) {
                        // Use strict ID matching for live updates too
                        let buttonIndex = updatedData.subButtons.findIndex(
                          (btn: any) => btn.id === originalButton.id
                        );
                        
                        // Only fallback to label if ID is not available
                        if (buttonIndex === -1 && !originalButton.id) {
                          buttonIndex = updatedData.subButtons.findIndex(
                            (btn: any) => btn.label === originalButton.label
                          );
                        }
                        
                        if (buttonIndex !== -1) {
                          // Create new array to avoid reference issues
                          updatedData.subButtons = updatedData.subButtons.map((btn: any, idx: number) => {
                            if (idx === buttonIndex) {
                              return {
                                ...btn,
                                ...liveData,
                                // Preserve system button properties
                                id: btn.id,
                                isSystem: btn.isSystem,
                                deletable: btn.deletable,
                              };
                            }
                            return btn;
                          });
                          onUpdate(updatedData);
                        }
                      }
                    } else if (buttonType === "tag") {
                      if (updatedData.tags) {
                        const tagId = originalButton.id || originalButton.name || originalButton.label;
                        if (updatedData.tags[tagId]) {
                          updatedData.tags[tagId] = {
                            ...updatedData.tags[tagId],
                            ...liveData,
                            name: liveData.label || updatedData.tags[tagId].name,
                          };
                          onUpdate(updatedData);
                        }
                      }
                      // Also update tagGroups
                      if (updatedData.tagGroups) {
                        Object.keys(updatedData.tagGroups).forEach((groupKey) => {
                          const group = updatedData.tagGroups[groupKey];
                          if (Array.isArray(group)) {
                            const tagIndex = group.findIndex(
                              (tag: any) => 
                                tag.id === originalButton.id || 
                                tag.name === originalButton.name ||
                                tag.label === originalButton.label
                            );
                            if (tagIndex !== -1) {
                              group[tagIndex] = {
                                ...group[tagIndex],
                                ...liveData,
                                name: liveData.label || group[tagIndex].name,
                              };
                              // Force update by creating new array reference
                              updatedData.tagGroups[groupKey] = [...group];
                              onUpdate(updatedData);
                            }
                          }
                        });
                      }
                    }
                  }
                }
              }}
            />
          </div>
        )}
      </div>
    </ReactFlowProvider>
  );
}
