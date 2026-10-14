/** A scannable item at the selected location, loaded to the client for local scan resolution. */
export interface CountableItem {
  code: string;
  itemId: number;
  description: string;
  unitSymbol: string;
}

/** One counted line submitted at commit. */
export interface CountLine {
  itemId: number;
  quantity: number;
}

/** Commit payload from the API adapter (session-derived user + sanitized lines). */
export interface CountCommit {
  locationId: number;
  counterUserId: number;
  note: string | null;
  continuousScanning: boolean;
  lines: CountLine[];
}

/** Resolved ActiveOne identities + display names for the counting user (the save gate). */
export interface CounterGate {
  countedByContactId: number | null;
  recordedByUserId: number | null;
  counterName: string | null;
  recorderName: string | null;
}

/** Minimal confirmation returned after a successful commit. */
export interface CountResult {
  code: string;
  inventoryCountId: number;
  itemCount: number;
  totalUnits: number;
}

/**
 * Raised when the counting user is missing either ActiveOne identity required to write
 * inventory_count (COUNTED_BY_ID / RECORDED_BY_ID are NOT NULL). The message names what is
 * missing so the UI can guide the admin to the right /admin Users fix.
 */
export class CounterNotLinkedError extends Error {
  constructor(missing: { employee: boolean; activeOneUser: boolean }) {
    const parts: string[] = [];
    if (missing.employee) parts.push("an ActiveOne employee link");
    if (missing.activeOneUser) parts.push("an ActiveOne login-user mapping");
    super(`Your account is missing ${parts.join(" and ")}. Saving is blocked.`);
    this.name = "CounterNotLinkedError";
  }
}

/** Raised when a commit carries no counted lines (empty-count guard, FR-15). */
export class EmptyCountError extends Error {
  constructor() {
    super("A count must have at least one item before saving.");
    this.name = "EmptyCountError";
  }
}
