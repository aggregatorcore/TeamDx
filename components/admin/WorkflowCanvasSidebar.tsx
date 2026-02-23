"use client";

import { useState } from "react";
import { Navigation, Circle, Tag, Play, Settings, Menu, Zap } from "lucide-react";
import ControlDrawer from "./ControlDrawer";
import SubDrawer from "./SubDrawer";
import TagDrawer from "./TagDrawer";
import TagBehaviorDrawer from "./TagBehaviorDrawer";
import WorkflowSettingsDrawer from "./WorkflowSettingsDrawer";

interface WorkflowCanvasSidebarProps {
  onAddNode?: (type: "navigation" | "subButton" | "tag", data?: any) => void;
  onTabChange?: (tab: "control" | "sub" | "tag") => void;
  onDrawerOpen?: () => void;
  onRemoveButton?: (buttonId: string | number, type?: "control" | "sub" | "tag") => void;
  onOpenSettings?: (button: any, type?: "navigation" | "subButton" | "tag") => void;
  onUpdateWorkflow?: (data: any) => void;
  onPublish?: () => void;
  workflowData?: any;
}

export default function WorkflowCanvasSidebar({ onAddNode, onTabChange, onDrawerOpen, onRemoveButton, onOpenSettings, onUpdateWorkflow, onPublish, workflowData }: WorkflowCanvasSidebarProps) {
  const [activeTab, setActiveTab] = useState<"control" | "sub" | "tag" | null>(null);
  const [isControlDrawerOpen, setIsControlDrawerOpen] = useState(false);
  const [isSubDrawerOpen, setIsSubDrawerOpen] = useState(false);
  const [isTagDrawerOpen, setIsTagDrawerOpen] = useState(false);
  const [isTagBehaviorDrawerOpen, setIsTagBehaviorDrawerOpen] = useState(false);
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);

  const handleTabClick = (tab: "control" | "sub" | "tag") => {
    if (tab === "control") {
      const willOpen = !isControlDrawerOpen;
      setIsControlDrawerOpen(willOpen);
      setIsSubDrawerOpen(false); // Close sub drawer if open
      setIsTagDrawerOpen(false); // Close tag drawer if open
      setIsTagBehaviorDrawerOpen(false); // Close tag behavior drawer if open
      setActiveTab(activeTab === tab ? null : tab);
      if (willOpen) {
        onDrawerOpen?.(); // Close settings drawer when opening control drawer
      }
    } else if (tab === "sub") {
      const willOpen = !isSubDrawerOpen;
      setIsSubDrawerOpen(willOpen);
      setIsControlDrawerOpen(false); // Close control drawer if open
      setIsTagDrawerOpen(false); // Close tag drawer if open
      setIsTagBehaviorDrawerOpen(false); // Close tag behavior drawer if open
      setActiveTab(activeTab === tab ? null : tab);
      if (willOpen) {
        onDrawerOpen?.(); // Close settings drawer when opening sub drawer
      }
    } else if (tab === "tag") {
      const willOpen = !isTagDrawerOpen;
      setIsTagDrawerOpen(willOpen);
      setIsControlDrawerOpen(false); // Close control drawer if open
      setIsSubDrawerOpen(false); // Close sub drawer if open
      setIsTagBehaviorDrawerOpen(false); // Close tag behavior drawer if open
      setActiveTab(activeTab === tab ? null : tab);
      if (willOpen) {
        onDrawerOpen?.(); // Close settings drawer when opening tag drawer
      }
    } else {
      setIsControlDrawerOpen(false);
      setIsSubDrawerOpen(false);
      setIsTagDrawerOpen(false);
      setActiveTab(activeTab === tab ? null : tab);
    }
    onTabChange?.(tab);
  };

  return (
    <div className="fixed left-64 top-[134px] bottom-0 md:bottom-0 pb-20 md:pb-0 w-16 bg-white border-r border-gray-200 z-40 flex flex-col items-center py-4 shadow-sm">
      {/* Icon Buttons */}
      <div className="flex flex-col gap-2 w-full">
        {/* Control Button */}
        <button
          onClick={() => handleTabClick("control")}
          className={`p-3 rounded-lg transition-all group relative ${
            isControlDrawerOpen
              ? "bg-primary-600 text-white shadow-md"
              : "hover:bg-primary-50 text-gray-600 hover:text-primary-600 hover:shadow-sm"
          }`}
          title="Control Buttons"
        >
          <Navigation className="h-5 w-5 mx-auto" />
          {isControlDrawerOpen && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full" />
          )}
        </button>

        {/* Sub Button */}
        <button
          onClick={() => handleTabClick("sub")}
          className={`p-3 rounded-lg transition-all group relative ${
            isSubDrawerOpen
              ? "bg-primary-600 text-white shadow-md"
              : "hover:bg-primary-50 text-gray-600 hover:text-primary-600 hover:shadow-sm"
          }`}
          title="Sub Buttons"
        >
          <Circle className="h-5 w-5 mx-auto" />
          {isSubDrawerOpen && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full" />
          )}
        </button>

        {/* Tag Button */}
        <button
          onClick={() => handleTabClick("tag")}
          className={`p-3 rounded-lg transition-all group relative ${
            isTagDrawerOpen
              ? "bg-primary-600 text-white shadow-md"
              : "hover:bg-primary-50 text-gray-600 hover:text-primary-600 hover:shadow-sm"
          }`}
          title="Tags"
        >
          <Tag className="h-5 w-5 mx-auto" />
          {isTagDrawerOpen && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full" />
          )}
        </button>

        {/* Tag Behavior Button */}
        <button
          onClick={() => {
            const willOpen = !isTagBehaviorDrawerOpen;
            setIsTagBehaviorDrawerOpen(willOpen);
            setIsControlDrawerOpen(false);
            setIsSubDrawerOpen(false);
            setIsTagDrawerOpen(false);
            setIsSettingsDrawerOpen(false);
            if (willOpen) {
              onDrawerOpen?.();
            }
          }}
          className={`p-3 rounded-lg transition-colors group relative ${
            isTagBehaviorDrawerOpen
              ? "bg-primary-600 text-white"
              : "hover:bg-primary-50 text-gray-600 hover:text-primary-600"
          }`}
          title="Tag Behavior"
        >
          <Zap className="h-5 w-5 mx-auto" />
        </button>

        <div className="h-px bg-gray-200 my-2" />

        {/* Settings Button */}
        <button
          onClick={() => {
            setIsSettingsDrawerOpen(!isSettingsDrawerOpen);
            setIsControlDrawerOpen(false);
            setIsSubDrawerOpen(false);
            setIsTagDrawerOpen(false);
            setIsTagBehaviorDrawerOpen(false);
            onDrawerOpen?.();
          }}
          className={`p-3 rounded-lg transition-colors group relative ${
            isSettingsDrawerOpen
              ? "bg-primary-600 text-white"
              : "hover:bg-gray-50 text-gray-600 hover:text-gray-900"
          }`}
          title="Settings"
        >
          <Settings className="h-5 w-5 mx-auto" />
        </button>

        {/* Publish Button */}
        <button
          onClick={() => {
            if (onPublish) {
              if (confirm("Publish this workflow? It will become active and replace the current live workflow.")) {
                onPublish();
              }
            }
          }}
          className="p-3 rounded-lg hover:bg-green-50 text-gray-600 hover:text-green-600 transition-colors group relative"
          title="Publish"
        >
          <Play className="h-5 w-5 mx-auto" />
        </button>
      </div>

      {/* Control Drawer */}
      <ControlDrawer
        isOpen={isControlDrawerOpen}
        onClose={() => setIsControlDrawerOpen(false)}
        onAddNode={onAddNode}
        onRemoveButton={onRemoveButton}
        onOpenSettings={onOpenSettings}
        workflowData={workflowData}
      />

      {/* Sub Drawer */}
      <SubDrawer
        isOpen={isSubDrawerOpen}
        onClose={() => setIsSubDrawerOpen(false)}
        onAddNode={onAddNode}
        onRemoveButton={onRemoveButton}
        onOpenSettings={onOpenSettings}
        workflowData={workflowData}
      />

      {/* Tag Drawer */}
      <TagDrawer
        isOpen={isTagDrawerOpen}
        onClose={() => setIsTagDrawerOpen(false)}
        onAddNode={onAddNode}
        onRemoveButton={onRemoveButton}
        onOpenSettings={onOpenSettings}
        onUpdate={onUpdateWorkflow}
        workflowData={workflowData}
      />

      {/* Tag Behavior Drawer */}
      <TagBehaviorDrawer
        isOpen={isTagBehaviorDrawerOpen}
        onClose={() => setIsTagBehaviorDrawerOpen(false)}
        workflowData={workflowData}
        onUpdate={onUpdateWorkflow}
      />

      {/* Workflow Settings Drawer */}
      <WorkflowSettingsDrawer
        isOpen={isSettingsDrawerOpen}
        onClose={() => setIsSettingsDrawerOpen(false)}
        workflowData={workflowData}
        onUpdate={onUpdateWorkflow}
      />
    </div>
  );
}
