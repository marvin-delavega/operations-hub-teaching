/**
 * The selectable order periods (in days) offered both as the global header default
 * and per-supplier. A larger period only ever increases an item's suggested order,
 * so the largest period defines the superset of candidate items the data layer must
 * return — all narrower per-supplier filtering happens client-side.
 */
export const ORDER_PERIODS = [7, 14, 30] as const;

export type PeriodDays = (typeof ORDER_PERIODS)[number];

export const MAX_ORDER_PERIOD: PeriodDays = ORDER_PERIODS[ORDER_PERIODS.length - 1];
