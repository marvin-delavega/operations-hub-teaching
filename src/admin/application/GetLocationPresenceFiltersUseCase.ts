import type { AppSettingsRepository } from "../domain/AppSettingsRepository";
import { PRESENCE_FILTER_KEY_PREFIX } from "@/shared/domain/PresenceFilterSetting";

export class GetLocationPresenceFiltersUseCase {
  constructor(private readonly repo: AppSettingsRepository) {}

  async execute(): Promise<Record<number, boolean>> {
    const settings = await this.repo.getByPrefix(PRESENCE_FILTER_KEY_PREFIX);
    const filters: Record<number, boolean> = {};
    for (const [key, value] of Object.entries(settings)) {
      const locationId = Number(key.slice(PRESENCE_FILTER_KEY_PREFIX.length));
      if (Number.isInteger(locationId) && locationId > 0) {
        filters[locationId] = value === "on";
      }
    }
    return filters;
  }
}