import type { User } from "./User";

export interface CreateUserInput {
  name: string;
  username: string;
  roleIds: string[];
  passwordHash: string;
  employeeCode: string | null;
  activeOneUserId: string | null;
}

export interface UpdateUserInput {
  name: string;
  username: string;
  roleIds: string[];
  employeeCode: string | null;
  activeOneUserId: string | null;
}

export interface UserRepository {
  getAll(): Promise<User[]>;
  findById(id: string): Promise<User | null>;
  usernameExists(username: string, excludeId?: string): Promise<boolean>;
  create(input: CreateUserInput): Promise<string>;
  update(id: string, input: UpdateUserInput): Promise<void>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
  setActive(id: string, isActive: boolean): Promise<void>;
}
