import { ALL_PERMISSION_KEYS } from "@/shared/domain/Permissions";
import type { Role } from "../domain/Role";
import type { RoleRepository } from "../domain/RoleRepository";

export class GetRolesUseCase {
  constructor(private readonly repository: RoleRepository) {}

  async execute(): Promise<Role[]> {
    const roles = await this.repository.getAll();
    // A protected (Administrator) role always reports the full catalog — its permissions
    // are resolved in code, not stored as role_permission rows.
    return roles.map((role) =>
      role.isProtected ? { ...role, permissions: [...ALL_PERMISSION_KEYS] } : role,
    );
  }
}
