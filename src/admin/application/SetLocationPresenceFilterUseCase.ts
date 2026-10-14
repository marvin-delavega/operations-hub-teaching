import type { AppSettingsRepository } from "../domain/AppSettingsRepository";
import { presenceFilterSettingKey } from "@/shared/domain/PresenceFilterSetting";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class SetLocationPresenceFilterUseCase {
  constructor(private readonly repo: AppSettingsRepository) {}

  async execute(locationId: number, enabled: boolean): Promise<void> {
    if (!Number.isInteger(locationId) || locationId <= 0) {
      throw new ValidationError("locationId must be a positive integer.");
    }
    await this.repo.set(presenceFilterSettingKey(locationId), enabled ? "on" : "off");
  }
}