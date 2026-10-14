import type { SetupStateRepository } from "../domain/SetupState";

export class FinishSetupUseCase {
  constructor(private readonly repo: SetupStateRepository) {}

  async execute(completedBy: string): Promise<void> {
    await this.repo.markCompleted(completedBy, new Date());
  }
}
