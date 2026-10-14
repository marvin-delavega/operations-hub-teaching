import type { SetupStatus, SetupStateRepository } from "../domain/SetupState";

export class GetSetupStatusUseCase {
  constructor(private readonly repo: SetupStateRepository) {}

  execute(): Promise<SetupStatus> {
    return this.repo.getStatus();
  }
}
