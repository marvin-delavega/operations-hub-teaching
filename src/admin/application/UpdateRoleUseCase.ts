import { isPermissionKey } from "@/shared/domain/Permissions";
import type { RoleRepository } from "../domain/RoleRepository";
import { RoleValidationError, RoleNameTakenError, ProtectedRoleError } from "./RoleErrors";

const RESERVED_NAME = "Administrator";

export interface UpdateRoleCommand {
  name: string;
  description: string | null;
  isActive: boolean;
  permissions: string[];
}

export class UpdateRoleUseCase {
  constructor(private readonly repository: RoleRepository) {}

  async execute(id: string, command: UpdateRoleCommand): Promise<void> {
    const target = await this.repository.findById(id);
    if (!target) throw new RoleValidationError("Role not found");
    if (target.isProtected) throw new ProtectedRoleError();

    const name = command.name.trim();
    if (!name) throw new RoleValidationError("Role name is required");
    if (name.toLowerCase() === RESERVED_NAME.toLowerCase()) {
      throw new RoleValidationError('"Administrator" is a reserved role name');
    }
    if (await this.repository.nameExists(name, id)) throw new RoleNameTakenError();

    await this.repository.update(id, {
      name,
      description: command.description?.trim() || null,
      isActive: command.isActive,
      permissions: command.permissions.filter(isPermissionKey),
    });
  }
}
