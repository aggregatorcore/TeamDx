"use client";

import { PanelRightClose, PanelRightOpen } from "lucide-react";

interface RightSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}

export default function RightSidebar({ isOpen, onToggle, children }: RightSidebarProps) {
  return (
    <>
      {/* Toggle button - fixed on the right with gap from main content */}
      <button
        type="button"
        onClick={onToggle}
        className="hidden md:flex fixed right-3 top-1/2 -translate-y-1/2 z-30 h-12 w-6 items-center justify-center rounded-l-lg border-0 bg-primary-500 text-white shadow-md hover:bg-primary-600 active:bg-primary-700 transition-colors"
        aria-label={isOpen ? "Close right panel" : "Open right panel"}
      >
        {isOpen ? (
          <PanelRightClose className="h-4 w-4" />
        ) : (
          <PanelRightOpen className="h-4 w-4" />
        )}
      </button>

      {/* Right sidebar - half width of main content area */}
      <aside
        className={`hidden md:flex flex-col flex-shrink-0 min-h-0 border-l border-gray-200 bg-white transition-[width] duration-200 ease-out overflow-hidden ${
          isOpen ? "w-1/2 max-w-md" : "w-0 border-0"
        }`}
        aria-hidden={!isOpen}
      >
        {isOpen && (
          <div className="flex flex-col h-full min-w-0 overflow-hidden">
            <div className="shrink-0 px-4 py-3 border-b border-gray-200 bg-gray-50/80">
              <h2 className="text-sm font-semibold text-gray-700">Right panel</h2>
              <p className="text-xs text-gray-500 mt-0.5">Content to be added later</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 min-h-0 custom-scrollbar">
              {children ?? (
                <p className="text-sm text-gray-500">Add content here later.</p>
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
