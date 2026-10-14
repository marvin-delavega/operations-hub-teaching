import type { UserRepository } from "../domain/UserRepository";
import { UserValidationError, UsernameTakenError, ProtectedUserError } from "./UserErrors";

export interface UpdateUserCommand {
  name: string;
  username: string;
  roleIds: string[];
  employeeCode: string | null;
  activeOneUserId: string | null;
}

export class UpdateUserUseCase {
  constructor(private readonly repository: UserRepository) {}

  async execute(id: string, command: UpdateUserCommand): Promise<void> {
    const target = await this.repository.findById(id);
    if (!target) throw new UserValidationError("User not found");
    if (target.isProtected) throw new ProtectedUserError();

    const name = command.name.trim();
    const username = command.username.trim();
    if (!name) throw new UserValidationError("Name is required");
    if (!username) throw new UserValidationError("Username is required");
    if (await this.repository.usernameExists(username, id)) throw new UsernameTakenError();

    await this.repository.update(id, {
      name,
      username,
      roleIds: [...new Set(command.roleIds.map(String))],
      employeeCode: command.employeeCode?.trim() || null,
      activeOneUserId: command.activeOneUserId?.trim() || null,
    });
  }
}
