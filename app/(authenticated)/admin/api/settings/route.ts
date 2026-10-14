import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import type { RowDataPacket } from "mysql2";
import pool, { activeoneSchemaName } from "@/shared/infrastructure/db";
import { createGetAppSettingUseCase, createUpdateAppSettingUseCase } from "@/container";
import { DEFAULT_PO_CODE_PREFIX } from "@/shared/infrastructure/activeoneConstants";
import {
  PO_CODE_DISPLAY_WIDTH,
  PO_CODE_DISPLAY_WIDTH_MAX,
} from "@/shared/infrastructure/poCodeDisplay";
import { requirePermission } from "@/admin/api/requirePermission";

const SCAN_BATCH_DELAY_MIN_MS = 200;
const SCAN_BATCH_DELAY_MAX_MS = 10000;
const SCAN_BATCH_DELAY_DEFAULT_MS = 2000;

const SAFETY_STOCK_LEVEL_DEFAULT = 90;
const SAFETY_STOCK_MAX_LEVEL_DEFAULT = 99;
const SAFETY_STOCK_DAYS_DEFAULT = 7;

const DEFAULT_DATE_PRESET_DEFAULT = "month" as const;

// Parses a numeric app-setting value. Returns null when the setting is unset,
// empty, or not a finite number — so an unset value falls back to its default
// instead of collapsing to 0 (Number(null) === 0).
function parseSettingNumber(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseDisplayWidth(raw: string | null | undefined): number {
  const n = parseSettingNumber(raw);
  return n === null
    ? PO_CODE_DISPLAY_WIDTH
    : Math.min(PO_CODE_DISPLAY_WIDTH_MAX, Math.max(0, Math.trunc(n)));
}

// Reserved ID units digit for a PO object table (0-9). Default 1; any out-of-range
// or unset value falls back to 1. These digits keep app-minted PO/PO-line IDs in a
// sub-stream native ActiveOne never emits.
function parseReservedDigit(raw: string | null | undefined): number {
  const n = parseSettingNumber(raw);
  return n !== null && Number.isInteger(n) && n >= 0 && n <= 9 ? n : 1;
}

// True when the prefix already has app PO history — a `po_code_counter` row (the
// app has minted under it) or existing purchase_order codes of the `{prefix}-`
// shape. Drives the "Reset numbering to 1" confirm-dialog warning. Fail-open on
// a DB hiccup (e.g. tables not yet created) so the settings read never blocks.
async function prefixHasAppHistory(prefix: string): Promise<boolean> {
  try {
    const ao = activeoneSchemaName();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         (SELECT COUNT(*) FROM po_code_counter WHERE prefix = ?) AS counter_rows,
         (SELECT COUNT(*) FROM ${ao}.purchase_order WHERE CODE LIKE CONCAT(?, '-%')) AS po_rows`,
      [prefix, prefix],
    );
    const row = rows[0] as unknown as { counter_rows: number; po_rows: number };
    return row.counter_rows > 0 || row.po_rows > 0;
  } catch {
    return false;
  }
}

export async function GET(_req: NextRequest) {
  const [
    company_name,
    scanBatchDelayRaw,
    continuousRaw,
    blindRaw,
    countingContinuousRaw,
    replenishmentShowAllRaw,
    replenishmentShowIncomingRaw,
    replenishmentSafetyStockModeRaw,
    replenishmentSafetyStockLevelRaw,
    replenishmentSafetyStockMaxLevelRaw,
    replenishmentSafetyStockDaysRaw,
    replenishmentSafetyStockLegacyRaw,
    replenishmentRequireApprovalRaw,
    replenishmentDefaultDatePresetRaw,
    shelfguideDefaultLocationRaw,
    poCodePrefixRaw,
    poCodeDisplayWidthRaw,
    poHeaderReservedDigitRaw,
    poLineReservedDigitRaw,
  ] = await Promise.all([
    createGetAppSettingUseCase().execute("company_name"),
    createGetAppSettingUseCase().execute("scan_batch_delay_ms"),
    createGetAppSettingUseCase().execute("delivery_continuous_scanning"),
    createGetAppSettingUseCase().execute("delivery_blind_delivery"),
    createGetAppSettingUseCase().execute("counting_continuous_scanning"),
    createGetAppSettingUseCase().execute("replenishment_show_all_items"),
    createGetAppSettingUseCase().execute("replenishment_show_incoming"),
    createGetAppSettingUseCase().execute("replenishment_safety_stock_mode"),
    createGetAppSettingUseCase().execute("replenishment_safety_stock_level"),
    createGetAppSettingUseCase().execute("replenishment_safety_stock_max_level"),
    createGetAppSettingUseCase().execute("replenishment_safety_stock_days"),
    createGetAppSettingUseCase().execute("replenishment_safety_stock"),
    createGetAppSettingUseCase().execute("replenishment_require_approval"),
    createGetAppSettingUseCase().execute("replenishment_default_date_preset"),
    createGetAppSettingUseCase().execute("shelfguide_default_location_id"),
    createGetAppSettingUseCase().execute("po_code_prefix"),
    createGetAppSettingUseCase().execute("po_code_display_width"),
    createGetAppSettingUseCase().execute("po_header_id_reserved_digit"),
    createGetAppSettingUseCase().execute("po_line_id_reserved_digit"),
  ]);
  const scan_batch_delay_ms = Number(scanBatchDelayRaw);
  const safetyStockMode: "off" | "percentage" | "dynamic" | "days" =
    replenishmentSafetyStockModeRaw === "percentage" || replenishmentSafetyStockModeRaw === "dynamic" || replenishmentSafetyStockModeRaw === "days" || replenishmentSafetyStockModeRaw === "off"
      ? replenishmentSafetyStockModeRaw
      : replenishmentSafetyStockModeRaw === "fixed" || replenishmentSafetyStockLegacyRaw === "on"
        ? "percentage"
        : "off";
  const safetyStockLevel = parseSettingNumber(replenishmentSafetyStockLevelRaw);
  const safetyStockMaxLevel = parseSettingNumber(replenishmentSafetyStockMaxLevelRaw);
  const safetyStockDays = parseSettingNumber(replenishmentSafetyStockDaysRaw);
  const livePoCodePrefix = poCodePrefixRaw ?? DEFAULT_PO_CODE_PREFIX;
  return NextResponse.json({
    settings: {
      company_name: company_name ?? "",
      scan_batch_delay_ms: Number.isFinite(scan_batch_delay_ms) && scan_batch_delay_ms > 0
        ? scan_batch_delay_ms
        : SCAN_BATCH_DELAY_DEFAULT_MS,
      delivery_continuous_scanning: continuousRaw === null ? true : continuousRaw === "on",
      delivery_blind_delivery: blindRaw === null ? false : blindRaw === "on",
      counting_continuous_scanning: countingContinuousRaw === null ? true : countingContinuousRaw === "on",
      replenishment_show_all_items: replenishmentShowAllRaw === null ? false : replenishmentShowAllRaw === "on",
      replenishment_show_incoming: replenishmentShowIncomingRaw === null ? true : replenishmentShowIncomingRaw === "on",
      replenishment_safety_stock_mode: safetyStockMode,
      replenishment_safety_stock_level: safetyStockLevel === null
        ? SAFETY_STOCK_LEVEL_DEFAULT
        : Math.min(100, Math.max(1, safetyStockLevel)),
      replenishment_safety_stock_max_level: safetyStockMaxLevel === null
        ? SAFETY_STOCK_MAX_LEVEL_DEFAULT
        : Math.min(99.99, Math.max(1, safetyStockMaxLevel)),
      replenishment_safety_stock_days: safetyStockDays === null
        ? SAFETY_STOCK_DAYS_DEFAULT
        : Math.min(30, Math.max(1, safetyStockDays)),
      replenishment_require_approval: replenishmentRequireApprovalRaw === null ? false : replenishmentRequireApprovalRaw === "on",
      replenishment_default_date_preset: replenishmentDefaultDatePresetRaw === null || !["week", "2weeks", "month"].includes(replenishmentDefaultDatePresetRaw)
        ? DEFAULT_DATE_PRESET_DEFAULT
        : replenishmentDefaultDatePresetRaw,
      shelfguide_default_location_id: parseSettingNumber(shelfguideDefaultLocationRaw),
      po_code_prefix: livePoCodePrefix,
      po_code_display_width: parseDisplayWidth(poCodeDisplayWidthRaw),
      po_code_prefix_has_app_history: await prefixHasAppHistory(livePoCodePrefix),
      po_header_id_reserved_digit: parseReservedDigit(poHeaderReservedDigitRaw),
      po_line_id_reserved_digit: parseReservedDigit(poLineReservedDigitRaw),
    },
  });
}

const FORBIDDEN = NextResponse.json({ error: "Forbidden" }, { status: 403 });

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { company_name, scan_batch_delay_ms, delivery_continuous_scanning, delivery_blind_delivery, counting_continuous_scanning, replenishment_show_all_items, replenishment_show_incoming, replenishment_safety_stock_mode, replenishment_safety_stock_level, replenishment_safety_stock_max_level, replenishment_safety_stock_days, replenishment_require_approval, replenishment_default_date_preset, shelfguide_default_location_id, po_code_prefix, po_code_display_width, reset_po_numbering, po_header_id_reserved_digit, po_line_id_reserved_digit } = body as {
    company_name?: unknown;
    scan_batch_delay_ms?: unknown;
    delivery_continuous_scanning?: unknown;
    delivery_blind_delivery?: unknown;
    counting_continuous_scanning?: unknown;
    replenishment_show_all_items?: unknown;
    replenishment_show_incoming?: unknown;
    replenishment_safety_stock_mode?: unknown;
    replenishment_safety_stock_level?: unknown;
    replenishment_safety_stock_max_level?: unknown;
    replenishment_safety_stock_days?: unknown;
    replenishment_require_approval?: unknown;
    replenishment_default_date_preset?: unknown;
    shelfguide_default_location_id?: unknown;
    po_code_prefix?: unknown;
    po_code_display_width?: unknown;
    reset_po_numbering?: unknown;
    po_header_id_reserved_digit?: unknown;
    po_line_id_reserved_digit?: unknown;
  };

  // Each key is owned by a different admin tab, so authorize per key against that tab's permission.
  if ((company_name !== undefined || scan_batch_delay_ms !== undefined || po_code_prefix !== undefined || po_code_display_width !== undefined || reset_po_numbering !== undefined || po_header_id_reserved_digit !== undefined || po_line_id_reserved_digit !== undefined) && !(await requirePermission("admin.general_settings"))) {
    return FORBIDDEN;
  }
  if ((delivery_continuous_scanning !== undefined || delivery_blind_delivery !== undefined) && !(await requirePermission("admin.delivery_settings"))) {
    return FORBIDDEN;
  }
  if (counting_continuous_scanning !== undefined && !(await requirePermission("admin.counting_settings"))) {
    return FORBIDDEN;
  }
  if (replenishment_show_all_items !== undefined && !(await requirePermission("admin.replenishment_settings"))) {
    return FORBIDDEN;
  }
  if (replenishment_show_incoming !== undefined && !(await requirePermission("admin.replenishment_settings"))) {
    return FORBIDDEN;
  }
  if (replenishment_safety_stock_mode !== undefined || replenishment_safety_stock_level !== undefined || replenishment_safety_stock_max_level !== undefined || replenishment_safety_stock_days !== undefined) {
    if (!(await requirePermission("admin.replenishment_settings"))) {
      return FORBIDDEN;
    }
  }
  if (replenishment_require_approval !== undefined && !(await requirePermission("admin.replenishment_settings"))) {
    return FORBIDDEN;
  }
  if (replenishment_default_date_preset !== undefined && !(await requirePermission("admin.replenishment_settings"))) {
    return FORBIDDEN;
  }
  if (shelfguide_default_location_id !== undefined && !(await requirePermission("admin.shelfguide_settings"))) {
    return FORBIDDEN;
  }

  if (company_name !== undefined) {
    if (typeof company_name !== "string") {
      return NextResponse.json({ error: "company_name must be a string" }, { status: 400 });
    }
    const trimmed = company_name.trim();
    if (trimmed.length > 100) {
      return NextResponse.json(
        { error: "company_name must be 100 characters or fewer" },
        { status: 400 }
      );
    }
    await createUpdateAppSettingUseCase().execute("company_name", trimmed);
  }

  if (po_code_prefix !== undefined) {
    if (typeof po_code_prefix !== "string") {
      return NextResponse.json({ error: "po_code_prefix must be a string" }, { status: 400 });
    }
    const trimmed = po_code_prefix.trim().toUpperCase();
    if (trimmed.length === 0) {
      return NextResponse.json({ error: "po_code_prefix is required" }, { status: 400 });
    }
    if (trimmed.length > 8) {
      return NextResponse.json({ error: "po_code_prefix must be 8 characters or fewer" }, { status: 400 });
    }
    if (!/^[A-Z0-9]+$/.test(trimmed)) {
      return NextResponse.json({ error: "po_code_prefix must contain only letters and numbers" }, { status: 400 });
    }
    await createUpdateAppSettingUseCase().execute("po_code_prefix", trimmed);
  }

  if (po_code_display_width !== undefined) {
    const width = Number(po_code_display_width);
    if (!Number.isInteger(width) || width < 0 || width > PO_CODE_DISPLAY_WIDTH_MAX) {
      return NextResponse.json(
        { error: `po_code_display_width must be an integer between 0 and ${PO_CODE_DISPLAY_WIDTH_MAX}` },
        { status: 400 },
      );
    }
    await createUpdateAppSettingUseCase().execute("po_code_display_width", String(width));
  }

  if (po_header_id_reserved_digit !== undefined) {
    const digit = Number(po_header_id_reserved_digit);
    if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
      return NextResponse.json(
        { error: "po_header_id_reserved_digit must be an integer between 0 and 9" },
        { status: 400 },
      );
    }
    await createUpdateAppSettingUseCase().execute("po_header_id_reserved_digit", String(digit));
  }

  if (po_line_id_reserved_digit !== undefined) {
    const digit = Number(po_line_id_reserved_digit);
    if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
      return NextResponse.json(
        { error: "po_line_id_reserved_digit must be an integer between 0 and 9" },
        { status: 400 },
      );
    }
    await createUpdateAppSettingUseCase().execute("po_line_id_reserved_digit", String(digit));
  }

  if (scan_batch_delay_ms !== undefined) {
    const delay = Number(scan_batch_delay_ms);
    if (!Number.isInteger(delay) || delay < SCAN_BATCH_DELAY_MIN_MS || delay > SCAN_BATCH_DELAY_MAX_MS) {
      return NextResponse.json(
        { error: `scan_batch_delay_ms must be an integer between ${SCAN_BATCH_DELAY_MIN_MS} and ${SCAN_BATCH_DELAY_MAX_MS}` },
        { status: 400 }
      );
    }
    await createUpdateAppSettingUseCase().execute("scan_batch_delay_ms", String(delay));
  }

  if (delivery_continuous_scanning !== undefined) {
    if (typeof delivery_continuous_scanning !== "boolean") {
      return NextResponse.json({ error: "delivery_continuous_scanning must be a boolean" }, { status: 400 });
    }
    await createUpdateAppSettingUseCase().execute("delivery_continuous_scanning", delivery_continuous_scanning ? "on" : "off");
  }

  if (delivery_blind_delivery !== undefined) {
    if (typeof delivery_blind_delivery !== "boolean") {
      return NextResponse.json({ error: "delivery_blind_delivery must be a boolean" }, { status: 400 });
    }
    await createUpdateAppSettingUseCase().execute("delivery_blind_delivery", delivery_blind_delivery ? "on" : "off");
  }

  if (counting_continuous_scanning !== undefined) {
    if (typeof counting_continuous_scanning !== "boolean") {
      return NextResponse.json({ error: "counting_continuous_scanning must be a boolean" }, { status: 400 });
    }
    await createUpdateAppSettingUseCase().execute("counting_continuous_scanning", counting_continuous_scanning ? "on" : "off");
  }

  if (replenishment_show_all_items !== undefined) {
    if (typeof replenishment_show_all_items !== "boolean") {
      return NextResponse.json({ error: "replenishment_show_all_items must be a boolean" }, { status: 400 });
    }
    await createUpdateAppSettingUseCase().execute("replenishment_show_all_items", replenishment_show_all_items ? "on" : "off");
  }

  if (replenishment_show_incoming !== undefined) {
    if (typeof replenishment_show_incoming !== "boolean") {
      return NextResponse.json({ error: "replenishment_show_incoming must be a boolean" }, { status: 400 });
    }
    await createUpdateAppSettingUseCase().execute("replenishment_show_incoming", replenishment_show_incoming ? "on" : "off");
  }

  if (replenishment_safety_stock_mode !== undefined) {
    if (replenishment_safety_stock_mode !== "off" && replenishment_safety_stock_mode !== "percentage" && replenishment_safety_stock_mode !== "dynamic" && replenishment_safety_stock_mode !== "days") {
      return NextResponse.json(
        { error: "replenishment_safety_stock_mode must be one of 'off', 'percentage', 'dynamic', or 'days'" },
        { status: 400 }
      );
    }
    await createUpdateAppSettingUseCase().execute("replenishment_safety_stock_mode", replenishment_safety_stock_mode);
  }

  if (replenishment_safety_stock_level !== undefined) {
    const level = Number(replenishment_safety_stock_level);
    if (!Number.isInteger(level) || level < 1 || level > 100) {
      return NextResponse.json(
        { error: "replenishment_safety_stock_level must be an integer between 1 and 100" },
        { status: 400 }
      );
    }
    await createUpdateAppSettingUseCase().execute("replenishment_safety_stock_level", String(level));
  }

  if (replenishment_safety_stock_max_level !== undefined) {
    const maxLevel = Number(replenishment_safety_stock_max_level);
    if (!Number.isFinite(maxLevel) || maxLevel < 1 || maxLevel > 99.99) {
      return NextResponse.json(
        { error: "replenishment_safety_stock_max_level must be between 1 and 99.99" },
        { status: 400 }
      );
    }
    await createUpdateAppSettingUseCase().execute("replenishment_safety_stock_max_level", String(maxLevel));
  }

  if (replenishment_safety_stock_days !== undefined) {
    const days = Number(replenishment_safety_stock_days);
    if (!Number.isInteger(days) || days < 1 || days > 30) {
      return NextResponse.json(
        { error: "replenishment_safety_stock_days must be an integer between 1 and 30" },
        { status: 400 }
      );
    }
    await createUpdateAppSettingUseCase().execute("replenishment_safety_stock_days", String(days));
  }

  if (replenishment_require_approval !== undefined) {
    if (typeof replenishment_require_approval !== "boolean") {
      return NextResponse.json({ error: "replenishment_require_approval must be a boolean" }, { status: 400 });
    }
    await createUpdateAppSettingUseCase().execute("replenishment_require_approval", replenishment_require_approval ? "on" : "off");
  }

  if (replenishment_default_date_preset !== undefined) {
    if (typeof replenishment_default_date_preset !== "string" || !["week", "2weeks", "month"].includes(replenishment_default_date_preset)) {
      return NextResponse.json(
        { error: "replenishment_default_date_preset must be one of 'week', '2weeks', or 'month'" },
        { status: 400 }
      );
    }
    await createUpdateAppSettingUseCase().execute("replenishment_default_date_preset", replenishment_default_date_preset);
  }

  if (shelfguide_default_location_id !== undefined) {
    if (shelfguide_default_location_id === null) {
      await createUpdateAppSettingUseCase().execute("shelfguide_default_location_id", "");
    } else {
      const locationId = Number(shelfguide_default_location_id);
      if (!Number.isInteger(locationId) || locationId <= 0) {
        return NextResponse.json(
          { error: "shelfguide_default_location_id must be a positive integer or null" },
          { status: 400 }
        );
      }
      await createUpdateAppSettingUseCase().execute("shelfguide_default_location_id", String(locationId));
    }
  }

  // One-time, manual "Reset numbering to 1" (FR-4): sets the app-owned CODE counter
  // back to 1 for the live prefix. Only the counter is touched — the admin UI's
  // confirm dialog warns when the prefix already has app PO history. Runs after the
  // prefix write above so a combined payload resets the newly-saved prefix.
  if (reset_po_numbering !== undefined) {
    if (typeof reset_po_numbering !== "boolean") {
      return NextResponse.json({ error: "reset_po_numbering must be a boolean" }, { status: 400 });
    }
    if (reset_po_numbering) {
      const livePrefix =
        (await createGetAppSettingUseCase().execute("po_code_prefix")) ?? DEFAULT_PO_CODE_PREFIX;
      await pool.execute(
        `INSERT INTO po_code_counter (prefix, next_value) VALUES (?, 1)
         ON DUPLICATE KEY UPDATE next_value = 1`,
        [livePrefix],
      );
    }
  }

  revalidateTag("app-settings");
  return NextResponse.json({ success: true });
}
