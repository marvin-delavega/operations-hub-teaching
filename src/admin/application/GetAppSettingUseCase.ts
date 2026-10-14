import type { AppSettingsRepository } from "../domain/AppSettingsRepository";

export class GetAppSettingUseCase {
  constructor(private readonly repo: AppSettingsRepository) {}

  async execute(key: string): Promise<string | null> {
    return this.repo.get(key);
  }
}
