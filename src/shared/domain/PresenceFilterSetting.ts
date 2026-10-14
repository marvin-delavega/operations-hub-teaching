export const PRESENCE_FILTER_KEY_PREFIX = "replenishment_item_presence_filter:";

export function presenceFilterSettingKey(locationId: number): string {
  return `${PRESENCE_FILTER_KEY_PREFIX}${locationId}`;
}
