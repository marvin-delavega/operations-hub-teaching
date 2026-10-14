import type { AppSettingsRepository } from "../domain/AppSettingsRepository";

export class UpdateAppSettingUseCase {
  constructor(private readonly repo: AppSettingsRepository) {}

  async execute(key: string, value: string): Promise<void> {
    return this.repo.set(key, value);
  }
}
