import type { UserRepository } from "../domain/UserRepository";
import { UserValidationError, ProtectedUserError } from "./UserErrors";

export class SetUserActiveUseCase {
  constructor(private readonly repository: UserRepository) {}

  async execute(id: string, isActive: boolean): Promise<void> {
    const target = await this.repository.findById(id);
    if (!target) throw new UserValidationError("User not found");
    if (target.isProtected && !isActive) throw new ProtectedUserError();

    await this.repository.setActive(id, isActive);
  }
}
