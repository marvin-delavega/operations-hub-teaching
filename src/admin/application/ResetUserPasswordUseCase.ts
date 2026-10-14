import bcrypt from "bcryptjs";
import { MIN_PASSWORD_LENGTH } from "@/shared/domain/Password";
import type { UserRepository } from "../domain/UserRepository";
import { UserValidationError, ProtectedUserError } from "./UserErrors";

export class ResetUserPasswordUseCase {
  constructor(private readonly repository: UserRepository) {}

  async execute(id: string, password: string): Promise<void> {
    const target = await this.repository.findById(id);
    if (!target) throw new UserValidationError("User not found");
    if (target.isProtected) throw new ProtectedUserError();
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new UserValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await this.repository.updatePassword(id, passwordHash);
  }
}
