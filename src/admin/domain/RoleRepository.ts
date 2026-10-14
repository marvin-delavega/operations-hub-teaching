import type { Role, RoleMember } from "./Role";

export interface CreateRoleInput {
  name: string;
  description: string | null;
  isActive: boolean;
  permissions: string[];
}

export interface UpdateRoleInput {
  name: string;
  description: string | null;
  isActive: boolean;
  permissions: string[];
}

export interface RoleRepository {
  getAll(): Promise<Role[]>;
  findById(id: string): Promise<Role | null>;
  nameExists(name: string, excludeId?: string): Promise<boolean>;
  create(input: CreateRoleInput): Promise<string>;
  update(id: string, input: UpdateRoleInput): Promise<void>;
  delete(id: string): Promise<void>;
  memberCount(id: string): Promise<number>;
  getMembers(id: string): Promise<RoleMember[]>;
  setMembers(id: string, userIds: string[]): Promise<void>;
}
