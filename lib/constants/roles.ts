import { RoleName, RoleHierarchy } from "@/lib/types/roles";

export const ROLE_HIERARCHY: Record<RoleName, RoleHierarchy> = {
  ADMIN: {
    role: "ADMIN",
    level: 1,
    children: ["BRANCH_MANAGER", "IT_TEAM", "HR_TEAM"],
  },
  BRANCH_MANAGER: {
    role: "BRANCH_MANAGER",
    level: 2,
    parent: "ADMIN",
    children: ["TEAM_LEADER", "COUNSELOR", "RECEPTIONIST", "FILLING_OFFICER"],
  },
  TEAM_LEADER: {
    role: "TEAM_LEADER",
    level: 3,
    parent: "BRANCH_MANAGER",
    children: ["TELECALLER"],
  },
  TELECALLER: {
    role: "TELECALLER",
    level: 4,
    parent: "TEAM_LEADER",
  },
  COUNSELOR: {
    role: "COUNSELOR",
    level: 3,
    parent: "BRANCH_MANAGER",
  },
  RECEPTIONIST: {
    role: "RECEPTIONIST",
    level: 3,
    parent: "BRANCH_MANAGER",
  },
  FILLING_OFFICER: {
    role: "FILLING_OFFICER",
    level: 3,
    parent: "BRANCH_MANAGER",
  },
  IT_TEAM: {
    role: "IT_TEAM",
    level: 2,
    parent: "ADMIN",
  },
  HR_TEAM: {
    role: "HR_TEAM",
    level: 2,
    parent: "ADMIN",
  },
};

export const ROLE_DISPLAY_NAMES: Record<RoleName, string> = {
  ADMIN: "Admin",
  BRANCH_MANAGER: "Branch Manager",
  TEAM_LEADER: "Team Leader",
  TELECALLER: "Telecaller",
  COUNSELOR: "Counselor",
  RECEPTIONIST: "Receptionist",
  FILLING_OFFICER: "Filling Officer",
  IT_TEAM: "IT Team",
  HR_TEAM: "HR Team",
};

export const ROLE_DESCRIPTIONS: Record<RoleName, string> = {
  ADMIN: "Full system access and control",
  BRANCH_MANAGER: "Manages branch operations and staff",
  TEAM_LEADER: "Leads telecaller team",
  TELECALLER: "Handles customer calls and inquiries",
  COUNSELOR: "Provides immigration counseling services",
  RECEPTIONIST: "Front desk operations and client reception",
  FILLING_OFFICER: "Handles document filing and processing",
  IT_TEAM: "Technical support and system maintenance",
  HR_TEAM: "Human resources management",
};

export function getRoleLevel(role: RoleName): number {
  return ROLE_HIERARCHY[role].level;
}

export function getParentRole(role: RoleName): RoleName | undefined {
  return ROLE_HIERARCHY[role].parent;
}

export function getChildRoles(role: RoleName): RoleName[] {
  return ROLE_HIERARCHY[role].children || [];
}

export function canAccessRole(userRole: RoleName, targetRole: RoleName): boolean {
  const userLevel = getRoleLevel(userRole);
  const targetLevel = getRoleLevel(targetRole);
  
  // Admin can access everything
  if (userRole === "ADMIN") return true;
  
  // Users can only access roles at same or lower level
  return targetLevel >= userLevel;
}

