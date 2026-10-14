import type { RoleRepository } from "../domain/RoleRepository";
import type { UserRepository } from "../domain/UserRepository";
import { RoleValidationError, ProtectedRoleError } from "./RoleErrors";

export class SetRoleMembersUseCase {
  constructor(
    private readonly roles: RoleRepository,
    private readonly users: UserRepository,
  ) {}

  async execute(roleId: string, userIds: string[]): Promise<void> {
    const target = await this.roles.findById(roleId);
    if (!target) throw new RoleValidationError("Role not found");

    const uniqueIds = [...new Set(userIds.map(String))];

    // The protected system account can never be removed from the Administrator role.
    if (target.isProtected) {
      const allUsers = await this.users.getAll();
      const protectedUser = allUsers.find((u) => u.isProtected);
      if (protectedUser && !uniqueIds.includes(protectedUser.id)) {
        throw new ProtectedRoleError("The system account cannot be removed from Administrator");
      }
    }

    await this.roles.setMembers(roleId, uniqueIds);
  }
}
