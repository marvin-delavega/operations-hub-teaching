import type { SetupStateRepository } from "../domain/SetupState";

const MIN_STEP = 1;
const MAX_STEP = 4;

export class AdvanceSetupProgressUseCase {
  constructor(private readonly repo: SetupStateRepository) {}

  async execute(step: number): Promise<void> {
    if (!Number.isInteger(step) || step < MIN_STEP || step > MAX_STEP) {
      throw new Error(`step must be an integer between ${MIN_STEP} and ${MAX_STEP}`);
    }

    const current = await this.repo.getStatus();
    // Only advance — never regress the persisted progress marker.
    if (step > current.currentStep) {
      await this.repo.setProgress(step);
    }
  }
}
