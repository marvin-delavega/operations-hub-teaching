import type { UserRepository } from "../domain/UserRepository";
import type { EmployeeDirectory } from "./EmployeeDirectory";
import type { ActiveOneUserDirectory } from "./ActiveOneUserDirectory";

export interface UserListItem {
  id: string;
  name: string;
  username: string;
  roleIds: string[];
  roleNames: string[];
  isActive: boolean;
  employeeCode: string | null;
  employeeName: string | null;
  activeOneUserId: string | null;
  activeOneUserName: string | null;
  isProtected: boolean;
}

export class GetUsersUseCase {
  constructor(
    private readonly repository: UserRepository,
    private readonly employees: EmployeeDirectory,
    private readonly activeOneUsers: ActiveOneUserDirectory,
  ) {}

  async execute(): Promise<UserListItem[]> {
    const users = await this.repository.getAll();

    const codes = users
      .map((user) => user.employeeCode)
      .filter((code): code is string => code !== null && code !== "");
    const employeeNames = codes.length ? await this.employees.resolveNames(codes) : new Map<string, string>();

    const activeOneIds = users
      .map((user) => user.activeOneUserId)
      .filter((id): id is string => id !== null && id !== "");
    const activeOneNames = activeOneIds.length
      ? await this.activeOneUsers.resolveNames(activeOneIds)
      : new Map<string, string>();

    return users.map((user) => ({
      id: user.id,
      name: user.name,
      username: user.username,
      roleIds: user.roleIds,
      roleNames: user.roleNames,
      isActive: user.isActive,
      employeeCode: user.employeeCode,
      employeeName: user.employeeCode ? employeeNames.get(user.employeeCode) ?? null : null,
      activeOneUserId: user.activeOneUserId,
      activeOneUserName: user.activeOneUserId ? activeOneNames.get(user.activeOneUserId) ?? null : null,
      isProtected: user.isProtected,
    }));
  }
}
