import bcrypt from "bcryptjs";
import { MIN_PASSWORD_LENGTH } from "@/shared/domain/Password";
import type { AccountRepository } from "../domain/AccountRepository";
import { IncorrectPasswordError, PasswordValidationError } from "./PasswordErrors";

export class ChangeOwnPasswordUseCase {
  constructor(private readonly repository: AccountRepository) {}

  async execute(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new PasswordValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    const currentHash = await this.repository.getPasswordHash(userId);
    if (!currentHash) throw new IncorrectPasswordError();
    if (!(await bcrypt.compare(currentPassword, currentHash))) throw new IncorrectPasswordError();

    const newHash = await bcrypt.hash(newPassword, 10);
    await this.repository.updatePassword(userId, newHash);
  }
}
