import { isPermissionKey } from "@/shared/domain/Permissions";
import type { RoleRepository } from "../domain/RoleRepository";
import { RoleValidationError, RoleNameTakenError } from "./RoleErrors";

const RESERVED_NAME = "Administrator";

export interface CreateRoleCommand {
  name: string;
  description: string | null;
  isActive: boolean;
  permissions: string[];
}

export class CreateRoleUseCase {
  constructor(private readonly repository: RoleRepository) {}

  async execute(command: CreateRoleCommand): Promise<string> {
    const name = command.name.trim();
    if (!name) throw new RoleValidationError("Role name is required");
    if (name.toLowerCase() === RESERVED_NAME.toLowerCase()) {
      throw new RoleValidationError('"Administrator" is a reserved role name');
    }
    if (await this.repository.nameExists(name)) throw new RoleNameTakenError();

    return this.repository.create({
      name,
      description: command.description?.trim() || null,
      isActive: command.isActive,
      permissions: command.permissions.filter(isPermissionKey),
    });
  }
}
