import type { RoleRepository } from "../domain/RoleRepository";
import { RoleValidationError, RoleInUseError, ProtectedRoleError } from "./RoleErrors";

export class DeleteRoleUseCase {
  constructor(private readonly repository: RoleRepository) {}

  async execute(id: string): Promise<void> {
    const target = await this.repository.findById(id);
    if (!target) throw new RoleValidationError("Role not found");
    if (target.isProtected) throw new ProtectedRoleError();

    const count = await this.repository.memberCount(id);
    if (count > 0) throw new RoleInUseError(count);

    await this.repository.delete(id);
  }
}
