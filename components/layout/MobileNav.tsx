"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  FileText,
  Users,
  Phone,
  Settings,
  UserPlus,
  Target,
  ClipboardList,
  Calendar,
  CalendarDays,
  UserCheck,
  CheckSquare,
  CheckCircle2,
  Tag,
  ArrowUpCircle,
  Briefcase,
} from "lucide-react";
import { RoleName } from "@/lib/types/roles";

interface MobileNavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: RoleName[];
}

const mobileNavItems: MobileNavItem[] = [
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
    name: "Reports",
    href: "/dashboard/reports",
    icon: ClipboardList,
    roles: ["ADMIN", "BRANCH_MANAGER", "TEAM_LEADER"],
  },
  {
    name: "Attendance",
    href: "/dashboard/attendance",
    icon: Calendar,
    roles: ["ADMIN", "BRANCH_MANAGER"],
  },
  {
    name: "Documents",
    href: "/dashboard/document-section",
    icon: FileText,
    roles: ["ADMIN", "BRANCH_MANAGER", "TEAM_LEADER", "COUNSELOR", "TELECALLER", "FILLING_OFFICER"],
  },
  {
    name: "Task Mgmt",
    href: "/admin/task-management",
    icon: CheckSquare,
    roles: ["ADMIN"],
  },
  {
    name: "Workflow",
    href: "/admin/workflow",
    icon: Tag,
    roles: ["ADMIN"],
  },
  {
    name: "Escalations",
    href: "/admin/escalations",
    icon: ArrowUpCircle,
    roles: ["ADMIN"],
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

interface MobileNavProps {
  userRole: RoleName;
}

export default function MobileNav({ userRole }: MobileNavProps) {
  const pathname = usePathname();

  const filteredNavItems = mobileNavItems.filter((item) =>
    item.roles.includes(userRole)
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <div
              key={item.href}
              className="flex flex-col items-center justify-center flex-1 h-full relative"
            >
              <Link
                href={item.href}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors w-full ${isActive
                    ? "text-primary-600"
                    : "text-gray-500 hover:text-gray-700"
                  }`}
              >
                <Icon className="h-6 w-6 mb-1" />
                <span className="text-xs font-medium">{item.name}</span>
              </Link>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

