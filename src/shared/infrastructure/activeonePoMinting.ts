import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import pool from "@/shared/infrastructure/db";
import { DEFAULT_PO_CODE_PREFIX, OBJECT_TYPE_PO, OBJECT_TYPE_PO_LINES } from "./activeoneConstants";

/**
 * ActiveOne mints document PKs from `object_type_map.NEXT_ID` at insert time (no
 * AUTO_INCREMENT on these tables) — verified runtime-faithful against the
 * full-year dump (PO rows step by 10, ending in ...2). This app mirrors native's
 * allocator: IDs are reserved atomically from object_type_map.NEXT_ID
 * (fetch-then-bump via acquireNextObjectId), with ensurePoIdCountersLive guarding a
 * stale counter, so native ActiveOne never re-issues an app-taken ID. See
 * PRD-po-id-code-minting.md.
 */
export const PO_ID_INCREMENT = 10;

const MAX_RETRIES = 3;

interface PoCodeCounterRow extends RowDataPacket {
  next_value: number;
}
interface PoCodeRow extends RowDataPacket {
  CODE: string;
}

/**
 * Human-readable CODE for a PO this app creates. App codes live in a disjoint
 * `OHPO-` namespace so they never collide with ActiveOne's own numbering:
 * ActiveOne derives the next code from MAX over *numeric* codes, and `OHPO-…`
 * casts to 0, so it is ignored. The trailing number is the app-owned counter
 * value from `acquireNextPoNumber` (NOT the ActiveOne PK), stored minimal — any
 * leading-zero width is applied only at render. See PRD-po-code-numbering.md.
 */
export function poCode(number: number, prefix?: string): string {
  const p = prefix ?? DEFAULT_PO_CODE_PREFIX;
  return `${p}-${number}`;
}

/**
 * Mints the next readable CODE number for the active prefix inside the caller's
 * transaction: SELECT … FOR UPDATE locks the `po_code_counter` row, bumps it,
 * and returns the captured value, so concurrent writers never share a number.
 * When no row exists yet (first PO under this prefix — Continue mode), the row
 * is lazily seeded to `max(numeric tail of existing {ao}.purchase_order.CODE
 * under `{prefix}-`) + 1` (1 when none), so existing installs keep numbering
 * forward without collisions. Must run inside the same transaction that inserts
 * the PO: a withPoMintRetry dup-key retry rolls the bump/lazy-seed back too.
 */
export async function acquireNextPoNumber(
  conn: PoolConnection,
  ao: string,
  prefix: string,
): Promise<number> {
  // `prefix` is the po_code_counter PK (varchar(16)); a longer value would truncate.
  if (prefix.length > 16) {
    throw new Error(`PO code prefix is too long: "${prefix}"`);
  }

  const [counterRows] = await conn.query<PoCodeCounterRow[]>(
    "SELECT next_value FROM po_code_counter WHERE prefix = ? FOR UPDATE",
    [prefix],
  );

  let nextValue: number;
  if (counterRows.length > 0) {
    nextValue = Number(counterRows[0].next_value);
  } else {
    const [codeRows] = await conn.query<PoCodeRow[]>(
      `SELECT CODE FROM ${ao}.purchase_order WHERE CODE LIKE CONCAT(?, '-%')`,
      [prefix],
    );
    let maxTail = 0;
    for (const row of codeRows) {
      const tail = row.CODE.slice(prefix.length + 1);
      if (/^\d+$/.test(tail)) {
        const parsed = Number(tail);
        if (Number.isSafeInteger(parsed) && parsed > maxTail) maxTail = parsed;
      }
    }
    nextValue = maxTail + 1;
    await conn.execute(
      "INSERT INTO po_code_counter (prefix, next_value) VALUES (?, ?)",
      [prefix, nextValue],
    );
  }

  await conn.execute(
    "UPDATE po_code_counter SET next_value = next_value + 1 WHERE prefix = ?",
    [prefix],
  );

  return nextValue;
}

/**
 * Thrown when PO-number assignment loses the MAX(ID)+10 race against ActiveOne's
 * concurrent native writer on every retry. Surfaced to the user, who retries.
 */
export class PoNumberAssignmentError extends Error {
  constructor() {
    super("Could not assign a PO number, please retry.");
    this.name = "PoNumberAssignmentError";
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    ((error as { code?: string }).code === "ER_DUP_ENTRY" ||
      (error as { errno?: number }).errno === 1062)
  );
}

/**
 * Runs a PO-writing transaction, re-minting on a duplicate-key collision with
 * ActiveOne's concurrent native writer. `run` must read MAX(ID) and build every
 * insert itself, so each attempt observes any ID inserted since the last try
 * (FR-4). On ER_DUP_ENTRY (PK or UNIQUE CODE) the whole transaction rolls back
 * and retries up to MAX_RETRIES times; sustained contention throws
 * PoNumberAssignmentError. Any non-duplicate error propagates immediately.
 */
export async function withPoMintRetry<T>(
  run: (conn: PoolConnection) => Promise<T>,
): Promise<T> {
  const conn = await pool.getConnection();
  try {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      await conn.beginTransaction();
      try {
        const result = await run(conn);
        await conn.commit();
        return result;
      } catch (error) {
        await conn.rollback();
        if (isDuplicateKeyError(error)) continue;
        throw error;
      }
    }
    throw new PoNumberAssignmentError();
  } finally {
    conn.release();
  }
}

/**
 * Raises object_type_map.NEXT_ID for both PO tables to at least MAX(id)+increment so a
 * stale counter (e.g. one frozen before counter-sync existed) can never make the app mint
 * an already-used id. GREATEST() keeps it monotonic — it never lowers a counter native has
 * already advanced. Call once at the start of a PO-writing save, inside its transaction.
 */
export async function ensurePoIdCountersLive(
  conn: PoolConnection,
  ao: string,
): Promise<void> {
  await conn.execute(
    `UPDATE ${ao}.object_type_map o
     SET NEXT_ID = GREATEST(
       COALESCE(o.NEXT_ID, 0),
       COALESCE((SELECT MAX(p.ID) FROM ${ao}.purchase_order p), 0) + COALESCE(o.INCREMENT, ?)
     )
     WHERE o.TABLE_NAME = ?`,
    [PO_ID_INCREMENT, OBJECT_TYPE_PO],
  );
  await conn.execute(
    `UPDATE ${ao}.object_type_map o
     SET NEXT_ID = GREATEST(
       COALESCE(o.NEXT_ID, 0),
       COALESCE((SELECT MAX(pi.ID) FROM ${ao}.purchase_order_items pi), 0) + COALESCE(o.INCREMENT, ?)
     )
     WHERE o.TABLE_NAME = ?`,
    [PO_ID_INCREMENT, OBJECT_TYPE_PO_LINES],
  );
}

interface NextIdRow extends RowDataPacket {
  v: number;
}

/**
 * Atomically reserves the next document ID from object_type_map.NEXT_ID, mirroring native
 * ActiveOne's fetch-then-bump allocator: the counter holds the NEXT id to assign, and a
 * single UPDATE both returns that pre-bump value and advances the counter by the row's
 * INCREMENT. LAST_INSERT_ID() is per-connection, so the fetch can't be stolen by another
 * writer between the bump and the read. Must run inside the PO-writing transaction.
 *
 * Native ActiveOne does NOT follow object_type_map.NEXT_ID for PO saves — it continues its
 * own self-generated PO stream, so an ID reserved here would collide with native's next PO.
 * When `reservedDigit` (0-9) is supplied, the counter is still advanced by INCREMENT (a
 * separate outlier process keys off it), but the returned ID — what the caller INSERTs — has
 * its units digit forced to `reservedDigit`. Native's own stream keeps its natural units
 * digit and so never emits it, placing app rows in a disjoint sub-stream with no shared slot.
 */
export async function acquireNextObjectId(
  conn: PoolConnection,
  ao: string,
  objectTableName: string,
  reservedDigit?: number,
): Promise<number> {
  await conn.execute(
    `UPDATE ${ao}.object_type_map
     SET NEXT_ID = LAST_INSERT_ID(COALESCE(NEXT_ID, 0)) + COALESCE(INCREMENT, ?)
     WHERE TABLE_NAME = ?`,
    [PO_ID_INCREMENT, objectTableName],
  );
  const [rows] = await conn.query<NextIdRow[]>(`SELECT LAST_INSERT_ID() AS v`);
  const next = Number(rows[0]?.v ?? 0);
  if (reservedDigit === undefined || reservedDigit % 10 === next % 10) {
    return next;
  }
  return Math.floor(next / 10) * 10 + (reservedDigit % 10);
}
