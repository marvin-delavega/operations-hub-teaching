import type { SetupStateRepository, SetupAdminVerifier } from "../domain/SetupState";

export class IncorrectPasswordError extends Error {
  constructor() {
    super("Password is incorrect");
  }
}

export class ResetSetupUseCase {
  constructor(
    private readonly repo: SetupStateRepository,
    private readonly verifier: SetupAdminVerifier,
  ) {}

  async execute(userId: string, password: string, resetBy: string): Promise<void> {
    const valid = await this.verifier.verifyById(userId, password);
    if (!valid) throw new IncorrectPasswordError();
    await this.repo.markReset(resetBy, new Date());
  }
}
