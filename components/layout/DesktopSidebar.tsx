"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  Shield,
  Phone,
  UserCheck,
  ClipboardList,
  Building2,
  HeadphonesIcon,
  UserPlus,
  Target,
  FileSpreadsheet,
  Calendar,
  CalendarDays,
  CheckSquare,
  CheckCircle2,
  Tag,
  ChevronDown,
  ChevronRight,
  Briefcase,
  ArrowUpCircle,
  Workflow,
  FolderKanban,
} from "lucide-react";
import { RoleName } from "@/lib/types/roles";
import { ROLE_DISPLAY_NAMES } from "@/lib/constants/roles";

interface NavItem {
  name: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: RoleName[];
  children?: NavItem[];
}

const navigationItems: NavItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: [
      "BRANCH_MANAGER",
      "TEAM_LEADER",
      "TELECALLER",
      "COUNSELOR",
      "RECEPTIONIST",
      "FILLING_OFFICER",
      "IT_TEAM",
    ],
  },
  {
    name: "Admin Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    roles: ["ADMIN"],
  },
  {
    name: "Buckets Control",
    href: "/admin/buckets",
    icon: FolderKanban,
    roles: ["ADMIN"],
  },
  {
    name: "Applications",
    href: "/dashboard/applications",
    icon: FileText,
    roles: [
      "ADMIN",
      "BRANCH_MANAGER",
      "COUNSELOR",
      "RECEPTIONIST",
      "FILLING_OFFICER",
    ],
  },
  {
    name: "Visit Entry",
    href: "/dashboard/client-visit",
    icon: UserPlus,
    roles: ["RECEPTIONIST", "ADMIN"],
  },
  {
    name: "Staff Attendance",
    href: "/dashboard/staff-attendance",
    icon: UserCheck,
    roles: ["RECEPTIONIST", "ADMIN"],
  },
  {
    name: "Clients",
    href: "/dashboard/clients",
    icon: Users,
    roles: [
      "ADMIN",
      "BRANCH_MANAGER",
      "COUNSELOR",
      "RECEPTIONIST",
      "TEAM_LEADER",
      "TELECALLER",
    ],
  },
  {
    name: "Leads",
    href: "/dashboard/leads",
    icon: Target,
    roles: ["ADMIN", "BRANCH_MANAGER", "TEAM_LEADER", "COUNSELOR", "TELECALLER"],
  },
  {
    name: "Calls",
    href: "/dashboard/calls",
    icon: Phone,
    roles: ["ADMIN", "BRANCH_MANAGER", "TEAM_LEADER", "TELECALLER"],
  },
  {
    name: "Staff",
    href: "/dashboard/staff",
    icon: UserCheck,
    roles: ["ADMIN", "BRANCH_MANAGER"],
  },
  {
    name: "Attendance",
    href: "/dashboard/attendance",
    icon: Calendar,
    roles: ["ADMIN", "BRANCH_MANAGER"],
  },
  {
    name: "Document Checklist",
    href: "/dashboard/document-checklist",
    icon: CheckSquare,
    roles: ["FILLING_OFFICER", "ADMIN"],
  },
  {
    name: "Documents",
    href: "/dashboard/document-section",
    icon: FileText,
    roles: ["ADMIN", "BRANCH_MANAGER", "TEAM_LEADER", "COUNSELOR", "TELECALLER", "FILLING_OFFICER"],
  },
  {
    name: "Reports",
    href: "/dashboard/reports",
    icon: ClipboardList,
    roles: ["ADMIN", "BRANCH_MANAGER", "TEAM_LEADER"],
  },
  {
    name: "Roles & Permissions",
    href: "/admin/roles",
    icon: Shield,
    roles: ["ADMIN"],
  },
  {
    name: "Users Management",
    href: "/admin/users",
    icon: Users,
    roles: ["ADMIN"],
  },
  {
    name: "Team Management",
    href: "/admin/teams",
    icon: Users,
    roles: ["ADMIN"],
  },
  {
    name: "Leads Management",
    href: "/admin/leads",
    icon: Target,
    roles: ["ADMIN"],
  },
  {
    name: "Google Sheets Sync",
    href: "/admin/sheet-sync",
    icon: FileSpreadsheet,
    roles: ["ADMIN"],
  },
  {
    name: "Operations",
    icon: Briefcase,
    roles: ["ADMIN"],
    children: [
      {
        name: "Task Management",
        href: "/admin/task-management",
        icon: CheckSquare,
        roles: ["ADMIN"],
      },
      {
        name: "Workflow Engine",
        href: "/admin/workflow",
        icon: Workflow,
        roles: ["ADMIN"],
      },
      {
        name: "Escalations",
        href: "/admin/escalations",
        icon: ArrowUpCircle,
        roles: ["ADMIN"],
      },
    ],
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    roles: [
      "ADMIN",
      "BRANCH_MANAGER",
      "IT_TEAM",
    ],
  },
];

interface DesktopSidebarProps {
  userRole: RoleName;
  isOpen?: boolean;
}

export default function DesktopSidebar({ userRole, isOpen = true }: DesktopSidebarProps) {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerSingleItem, setDrawerSingleItem] = useState<NavItem | null>(null);
  const [drawerSingleItemTop, setDrawerSingleItemTop] = useState<number>(0);
  const closeSingleItemTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDrawerOpen(false);
    setDrawerSingleItem(null);
  }, [pathname]);

  const scheduleCloseSingleItem = () => {
    if (closeSingleItemTimeoutRef.current) clearTimeout(closeSingleItemTimeoutRef.current);
    closeSingleItemTimeoutRef.current = setTimeout(() => {
      setDrawerOpen(false);
      setDrawerSingleItem(null);
      closeSingleItemTimeoutRef.current = null;
    }, 200);
  };

  const cancelCloseSingleItem = () => {
    if (closeSingleItemTimeoutRef.current) {
      clearTimeout(closeSingleItemTimeoutRef.current);
      closeSingleItemTimeoutRef.current = null;
    }
  };

  const openSingleItemDrawer = (item: NavItem, el: HTMLElement | null) => {
    cancelCloseSingleItem();
    if (el) {
      const rect = el.getBoundingClientRect();
      setDrawerSingleItemTop(rect.top);
    } else {
      setDrawerSingleItemTop(0);
    }
    setDrawerSingleItem(item);
    setDrawerOpen(true);
  };

  const filteredNavItems = useMemo(() => 
    navigationItems.filter((item) => item.roles.includes(userRole)),
    [userRole]
  );

  const toggleExpand = (itemName: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemName)) {
        newSet.delete(itemName);
      } else {
        newSet.add(itemName);
      }
      return newSet;
    });
  };

  // Longest matching href wins (so /dashboard is not active when pathname is /dashboard/leads)
  const activeHref = useMemo(() => {
    let best = "";
    const check = (href: string) => {
      if (!href) return;
      const match = pathname === href || pathname.startsWith(href + "/");
      if (match && href.length > best.length) best = href;
    };
    filteredNavItems.forEach((item) => {
      if (item.href) check(item.href);
      item.children?.forEach((child) => { if (child.href) check(child.href); });
    });
    return best;
  }, [pathname, filteredNavItems]);

  const isItemActive = (item: NavItem): boolean => {
    if (item.href && item.href === activeHref) return true;
    if (item.children) {
      return item.children.some((child) => child.href === activeHref);
    }
    return false;
  };

  // Auto-expand items with active children (only when pathname changes)
  useEffect(() => {
    const itemsToExpand = new Set<string>();
    
    filteredNavItems.forEach((item) => {
      if (item.children) {
        const filteredChildren = item.children.filter((child) => child.roles.includes(userRole));
        const hasActiveChild = filteredChildren.some((child) => {
          if (child.href) {
            return pathname === child.href || pathname.startsWith(child.href + "/");
          }
          return false;
        });
        if (hasActiveChild) {
          itemsToExpand.add(item.name);
        }
      }
    });
    
    // Only update if there are changes to avoid infinite loops
    if (itemsToExpand.size > 0) {
      setExpandedItems((prev) => {
        const hasChanges = Array.from(itemsToExpand).some(item => !prev.has(item));
        if (!hasChanges) return prev; // No changes, return same reference
        return new Set([...prev, ...itemsToExpand]);
      });
    }
  }, [pathname, userRole, filteredNavItems]);

  const navItemBase =
    "flex items-center gap-3 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40";
  const navItemActive = "bg-primary-50 text-primary-700 font-medium border-l-2 border-primary-500 pl-[14px]";
  const navItemInactive = "text-gray-700 hover:bg-gray-50 border-l-2 border-transparent pl-4";

  const renderNavItem = (item: NavItem, compact?: boolean) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.name);
    const isActive = isItemActive(item);
    const filteredChildren = hasChildren
      ? item.children!.filter((child) => child.roles.includes(userRole))
      : [];

    if (hasChildren && filteredChildren.length === 0) {
      return null;
    }

    const linkClass = compact
      ? `${navItemBase} h-full min-h-[40px] py-0 px-3 rounded-l-none border-l border-gray-200 ${isActive ? navItemActive : navItemInactive}`
      : `${navItemBase} py-2.5 px-4 ${isActive ? navItemActive : navItemInactive}`;

    return (
      <div key={item.name || item.href} className={compact ? "relative h-full flex" : "relative"}>
        {hasChildren ? (
          <>
            <button
              onClick={() => toggleExpand(item.name)}
              className={`w-full ${navItemBase} justify-between py-2.5 px-4 ${
                isActive ? navItemActive : navItemInactive
              }`}
            >
              <span className="truncate min-w-0">{item.name}</span>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
              )}
            </button>
            {isExpanded && filteredChildren.length > 0 && (
              <div className="ml-4 mt-0.5 space-y-0.5 border-l border-gray-200 pl-3">
                {filteredChildren.map((child) => {
                  const isChildActive = isItemActive(child);
                  return (
                    <Link
                      key={child.href}
                      href={child.href!}
                      className={`${navItemBase} py-2 px-3 text-sm ${
                        isChildActive ? "bg-primary-50 text-primary-700 font-medium" : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <span className="truncate">{child.name}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <Link href={item.href!} className={linkClass}>
            <span className="truncate">{item.name}</span>
          </Link>
        )}
      </div>
    );
  };

  const railWidth = "w-20"; // 80px icon rail

  return (
    <>
      {/* Icon-only rail - 3D raised panel */}
      <aside
        className={`hidden md:flex fixed left-0 top-0 h-screen flex-col ${railWidth} bg-gray-50 border-r border-gray-200 transition-all duration-300 z-40 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          boxShadow: "4px 0 20px rgba(0,0,0,0.06), 2px 0 8px rgba(0,0,0,0.04), inset 1px 0 0 rgba(255,255,255,0.8)",
        }}
      >
        {/* Logo + Nav merged in one scrollable block */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="h-16 shrink-0 flex flex-col items-center justify-center border-b border-gray-200 bg-white">
            <img
              src="/TVF_LOGO.png"
              alt="TVF DX"
              className="h-8 w-8 object-contain"
            />
          </div>
          <nav className="flex-1 overflow-y-auto pt-0 pb-3 px-2 min-h-0 custom-scrollbar">
            <div className="flex flex-col items-center gap-0.5">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const hasChildren = item.children && item.children.length > 0;
              const isActive = isItemActive(item);
              const filteredChildren = hasChildren
                ? item.children!.filter((c) => c.roles.includes(userRole))
                : [];
              if (hasChildren && filteredChildren.length === 0) return null;

              if (hasChildren) {
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={(e) => openSingleItemDrawer(item, e.currentTarget)}
                    onMouseEnter={(e) => openSingleItemDrawer(item, e.currentTarget)}
                    onMouseLeave={scheduleCloseSingleItem}
                    title={item.name}
                    className={`p-2.5 rounded-lg transition-colors ${
                      isActive
                        ? "bg-primary-600 text-white shadow-sm"
                        : "text-gray-500 hover:bg-primary-600 hover:text-white hover:shadow-sm"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                  </button>
                );
              }
              return (
                <button
                  key={item.name}
                  type="button"
                  title={item.name}
                  onClick={(e) => openSingleItemDrawer(item, e.currentTarget)}
                  onMouseEnter={(e) => openSingleItemDrawer(item, e.currentTarget)}
                  onMouseLeave={scheduleCloseSingleItem}
                  className={`p-2.5 rounded-lg transition-colors block ${
                    isActive
                      ? "bg-primary-600 text-white shadow-sm"
                      : "text-gray-500 hover:bg-primary-600 hover:text-white hover:shadow-sm"
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                </button>
              );
            })}
            </div>
          </nav>
        </div>

        <div className="p-2 border-t border-gray-200 shrink-0">
          <div className="text-[10px] text-gray-400 text-center truncate" title={ROLE_DISPLAY_NAMES[userRole]}>
            {ROLE_DISPLAY_NAMES[userRole].slice(0, 6)}
          </div>
        </div>
      </aside>

      {/* Drawer: portal to body so it's never clipped; only mount when open */}
      {typeof document !== "undefined" &&
        isOpen &&
        drawerOpen &&
        createPortal(
          <>
            {!drawerSingleItem && (
              <div
                className="fixed inset-0 bg-black/30 z-[45] cursor-pointer"
                style={{ pointerEvents: "auto" }}
                aria-hidden
                onClick={() => { setDrawerOpen(false); setDrawerSingleItem(null); }}
              />
            )}
            {drawerSingleItem ? (
              <div
                role="dialog"
                aria-label={drawerSingleItem.name}
                className="fixed left-20 z-[50] w-auto max-w-48 flex items-stretch bg-white border-r border-b border-gray-200 rounded-r-lg shadow-md"
                style={{
                  top: Math.max(8, Math.min(drawerSingleItemTop, typeof window !== "undefined" ? window.innerHeight - 80 : 0)),
                  height: 40,
                }}
                onMouseEnter={cancelCloseSingleItem}
                onMouseLeave={scheduleCloseSingleItem}
              >
                <nav className="min-w-0 py-0 px-0 flex items-stretch shrink-0">
                  <div className="h-full flex">
                    {[drawerSingleItem].map((item) => renderNavItem(item, true))}
                  </div>
                </nav>
              </div>
            ) : (
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Navigation menu"
                className="fixed left-20 top-0 h-screen w-64 flex flex-col bg-white border-r border-gray-200 shadow-xl z-[50]"
                style={{ display: "flex" }}
              >
                <div className="h-14 flex items-center justify-between px-4 border-b border-gray-100 shrink-0">
                  <span className="text-sm font-semibold text-gray-800 tracking-tight">Navigation</span>
                  <button
                    type="button"
                    onClick={() => { setDrawerOpen(false); setDrawerSingleItem(null); }}
                    className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    aria-label="Close menu"
                  >
                    <ChevronRight className="h-5 w-5 rotate-180" />
                  </button>
                </div>
                <nav className="flex-1 overflow-y-auto py-3 px-2 min-h-0">
                  <div className="space-y-0.5">
                    {filteredNavItems.map((item) => renderNavItem(item))}
                  </div>
                </nav>
                <div className="px-4 py-3 border-t border-gray-100 shrink-0 bg-gray-50/50">
                  <p className="text-xs text-gray-500 font-medium">Role</p>
                  <p className="text-sm text-gray-700 mt-0.5">{ROLE_DISPLAY_NAMES[userRole]}</p>
                </div>
              </div>
            )}
          </>,
          document.body
        )}
    </>
  );
}

