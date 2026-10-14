import type { RoleMember } from "../domain/Role";
import type { RoleRepository } from "../domain/RoleRepository";
import { RoleValidationError } from "./RoleErrors";

export class GetRoleMembersUseCase {
  constructor(private readonly repository: RoleRepository) {}

  async execute(id: string): Promise<RoleMember[]> {
    const target = await this.repository.findById(id);
    if (!target) throw new RoleValidationError("Role not found");
    return this.repository.getMembers(id);
  }
}
