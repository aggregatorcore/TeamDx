"use client";

import { useCallback, useMemo, useEffect, useState } from "react";
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  NodeTypes,
  BackgroundVariant,
} from "reactflow";
import "reactflow/dist/style.css";
import NavigationNode from "./nodes/NavigationNode";
import ParentButtonsNode from "./nodes/ParentButtonsNode";
import ChildButtonNode from "./nodes/ChildButtonNode";
import ActionNode from "./nodes/ActionNode";

// Define nodeTypes outside component to prevent recreation on every render
// Support both old and new names for backward compatibility
const nodeTypes: NodeTypes = {
  navigation: NavigationNode,
  parentButtons: ParentButtonsNode, // Legacy support
  subButtons: ParentButtonsNode,
  childButton: ChildButtonNode, // Legacy support
  tagButton: ChildButtonNode,
  action: ActionNode,
};

// Memoize to ensure stable reference
const memoizedNodeTypes = nodeTypes;

interface FlowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  onConnect: (connection: Connection) => void;
  onNodeClick?: (event: React.MouseEvent, node: Node) => void;
  onEdgeClick?: (event: React.MouseEvent, edge: Edge) => void;
}

export default function FlowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onEdgeClick,
}: FlowCanvasProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-full bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading canvas...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gray-50 overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        nodeTypes={memoizedNodeTypes}
        fitView
        attributionPosition="bottom-left"
        nodesDraggable={true}
        nodesConnectable={true}
        elementsSelectable={true}
        preventScrolling={false}
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === "navigation") return "#3B82F6";
            if (node.type === "parentButtons" || node.type === "subButtons") return "#10B981";
            if (node.type === "childButton" || node.type === "tagButton") return "#F59E0B";
            if (node.type === "action") return "#8B5CF6";
            return "#94A3B8";
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>
    </div>
  );
}
