import bcrypt from "bcryptjs";
import { MIN_PASSWORD_LENGTH } from "@/shared/domain/Password";
import type { UserRepository } from "../domain/UserRepository";
import { UserValidationError, UsernameTakenError } from "./UserErrors";

export interface CreateUserCommand {
  name: string;
  username: string;
  roleIds: string[];
  password: string;
  employeeCode: string | null;
  activeOneUserId: string | null;
}

export class CreateUserUseCase {
  constructor(private readonly repository: UserRepository) {}

  async execute(command: CreateUserCommand): Promise<string> {
    const name = command.name.trim();
    const username = command.username.trim();
    if (!name) throw new UserValidationError("Name is required");
    if (!username) throw new UserValidationError("Username is required");
    if (command.password.length < MIN_PASSWORD_LENGTH) {
      throw new UserValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    if (await this.repository.usernameExists(username)) throw new UsernameTakenError();

    const passwordHash = await bcrypt.hash(command.password, 10);
    return this.repository.create({
      name,
      username,
      roleIds: [...new Set(command.roleIds.map(String))],
      passwordHash,
      employeeCode: command.employeeCode?.trim() || null,
      activeOneUserId: command.activeOneUserId?.trim() || null,
    });
  }
}
