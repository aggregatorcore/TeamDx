/**
 * Shared TypeScript types for authentication and authorization
 */

export type RoleName =
  | "ADMIN"
  | "BRANCH_MANAGER"
  | "TEAM_LEADER"
  | "TELECALLER"
  | "COUNSELOR"
  | "RECEPTIONIST"
  | "FILLING_OFFICER"
  | "IT_TEAM"
  | "HR_TEAM";

export interface JWTPayload {
  userId: string;
  email: string;
  role: RoleName;
  roleId: string;
}

export interface Role {
  id: string;
  name: RoleName;
  description?: string;
  level: number;
  parentId?: string;
  isActive: boolean;
}

export interface Permission {
  id: string;
  name: string;
  description?: string;
  module: string;
  action: string;
}

export interface RolePermission {
  roleId: string;
  permissionId: string;
  permission: Permission;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  isActive: boolean;
  role: Role;
  roleId: string;
}

export interface RoleHierarchy {
  role: RoleName;
  level: number;
  parent?: RoleName;
  children?: RoleName[];
}








