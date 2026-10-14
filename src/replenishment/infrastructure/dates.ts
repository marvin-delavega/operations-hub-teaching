/**
 * Date helpers for repositories that read MySQL DATE columns.
 *
 * mysql2 (without a `dateStrings` pool option) returns DATE columns as JS Dates
 * pinned to *server-local* midnight. Formatting those with `toISOString()` (UTC)
 * shifts the calendar date one day back on any timezone ahead of UTC — this app
 * runs in Asia/Manila (UTC+8), so every date would land on the previous day.
 */

/** Format a mysql2-returned DATE column value as YYYY-MM-DD using local components. */
export function dateColumnToStr(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Today's calendar date (YYYY-MM-DD) in Asia/Manila — never server-local or UTC. */
export function todayManilaStr(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}
