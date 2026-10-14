"use client";

import { Fragment, useState, useEffect, useCallback, useRef, Suspense, type ReactNode } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getSession } from "next-auth/react";
import Link from "next/link";
import { ChevronRight, ChevronDown, RefreshCw, X, Search, Printer, Loader2, GitBranch, Package } from "lucide-react";
import { cn } from "@/shared/ui/utils";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/ui/dialog";
import type { ReplenishmentItem, SupplierGroup } from "@/replenishment/domain/ReplenishmentItem";
import type { StockoutItem, StockoutSupplierGroup } from "@/replenishment/domain/StockoutItem";
import type { PurchaseOrderResult } from "@/replenishment/domain/PurchaseOrder";
import { ORDER_PERIODS, type PeriodDays } from "@/replenishment/domain/orderPeriods";
import type { SafetyStockMode } from "@/replenishment/domain/ReplenishmentRepository";
import { parseManufacturerTokens } from "@/manufacturer/domain/manufacturerTokens";
import { useQuantityKeyboardNav } from "@/replenishment/ui/useQuantityKeyboardNav";
import {
  REVIEW_SESSION_VERSION,
  saveReviewSession,
  loadReviewSession,
  clearReviewSession,
  type ReviewSessionContext,
} from "@/replenishment/ui/reviewSession";

const PERIODS: { label: string; days: PeriodDays }[] = ORDER_PERIODS.map((days) => ({
  label: `${days}d`,
  days,
}));

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

const DATE_PRESETS = {
  week: { label: "Past Week", days: 6 },
  "2weeks": { label: "Past 2 Weeks", days: 13 },
  month: { label: "Past Month", days: 29 },
} as const;

function formatSaleDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function daysSince(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  return Math.floor((Date.now() - Date.UTC(year, month - 1, day)) / 86_400_000);
}

// Container for a joined segmented control: a muted track holding the segments.
const SEG_TRACK = "inline-flex rounded-lg bg-muted p-0.5";

function seg(active: boolean, compact = false): string {
  return cn(
    "rounded-md font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
    compact ? "min-h-11 px-3 py-1.5 text-sm" : "min-h-12 px-4 text-base",
    active
      ? "bg-background text-foreground shadow-sm"
      : "text-muted-foreground hover:text-foreground"
  );
}

function computeSuggestion(
  dailySalesRate: number,
  periodDays: number,
  leadTime: number,
  effectiveAvailable: number,
  roundUp: boolean,
  safetyStock = 0
): number {
  const raw = dailySalesRate * (periodDays + leadTime) - effectiveAvailable + safetyStock;
  return Math.max(0, roundUp ? Math.ceil(raw) : Math.floor(raw));
}

function computeStockoutSuggestion(
  dailySalesRate: number,
  periodDays: number,
  leadTime: number,
  roundUp: boolean
): number {
  const raw = dailySalesRate * (periodDays + leadTime);
  return Math.max(0, roundUp ? Math.ceil(raw) : Math.floor(raw));
}

// Splits the unrounded need into whole cases + remainder pieces for the ad-hoc
// "per piece" (split) order mode. The total need is rounded UP to whole base
// pieces, then divided into full cases and the leftover pieces — e.g. a 13.83-case
// need at 48/case becomes { cases: 13, pieces: 40 }. A whole-number case need
// yields pieces: 0 (and the cs/pc toggle is then hidden). Items without a real
// pack (factor ≤ 1) cannot be split.
function computeSplitOrder(
  dailySalesRate: number,
  periodDays: number,
  leadTime: number,
  effectiveAvailable: number,
  conversionFactor: number
): { cases: number; pieces: number; need: number; factor: number } {
  const need = dailySalesRate * (periodDays + leadTime) - effectiveAvailable;
  // `need` (unrounded case need) and `factor` (pieces per case) are surfaced so
  // the split control can explain where its piece count comes from.
  if (need <= 0 || conversionFactor <= 1) return { cases: 0, pieces: 0, need: Math.max(0, need), factor: Math.round(conversionFactor) };
  // Pieces-per-case is a whole count; round the factor so the split always yields
  // integer pieces even if the DB factor arrives with float noise.
  const factor = Math.round(conversionFactor);
  if (factor <= 1) return { cases: 0, pieces: 0, need, factor };
  // Round the case need first so float noise can't fabricate a fractional part
  // for a need that is really a whole number.
  const roundedNeed = Math.round(need * 1e6) / 1e6;
  const totalPieces = Math.max(0, Math.ceil(roundedNeed * factor - 1e-9));
  const cases = Math.floor(totalPieces / factor);
  const pieces = totalPieces - cases * factor;
  return { cases, pieces, need, factor };
}

// Feeder availability plus an optionally manually-entered selling-area count;
// every recompute consumes the combined figure while `effectiveAvailable`
// itself stays feeder-only (audit distinction between system and manual data).
function totalAvailable(l: Pick<POLineState, "effectiveAvailable" | "shelfOnHand">): number {
  return l.effectiveAvailable + (l.shelfOnHand ?? 0);
}

// Manufacturer sub-group key: unique within a supplier.
function mfgKey(supplierId: string, manufacturerId: number | null): string {
  return `${supplierId}:${manufacturerId ?? "nb"}`;
}

interface MfgGroup<T> {
  manufacturerId: number | null;
  manufacturerName: string | null;
  items: T[];
}

// Groups items by manufacturer: "No Brand" (null) first, then named alphabetically.
function groupByMfg<T extends { manufacturerId: number | null; manufacturerName: string | null }>(
  items: T[]
): MfgGroup<T>[] {
  const map = new Map<string, MfgGroup<T>>();
  for (const item of items) {
    const key = item.manufacturerId === null ? "nb" : String(item.manufacturerId);
    if (!map.has(key)) {
      map.set(key, { manufacturerId: item.manufacturerId, manufacturerName: item.manufacturerName, items: [] });
    }
    map.get(key)!.items.push(item);
  }
  return [...map.values()].sort((a, b) => {
    if (a.manufacturerId === null) return -1;
    if (b.manufacturerId === null) return 1;
    return (a.manufacturerName ?? "").localeCompare(b.manufacturerName ?? "");
  });
}

interface SupplierMinimum {
  minOrderValue: number | null;
  minOrderQuantity: number | null;
}

interface POLineState {
  sku: string;
  description: string;
  supplierId: string;
  supplierName: string;
  supplierLeadTime: number;
  dailySalesRate: number;
  effectiveAvailable: number;
  // Manually counted combined selling-area stock (purchase units), added on
  // top of effectiveAvailable; null/absent when not entered. Standard path only.
  shelfOnHand?: number | null;
  period: PeriodDays;
  roundUp: boolean;
  quantity: number;
  // Split (per-piece) mode: `quantity` holds whole cases and `pieceQty` the
  // remainder pieces. `pieceQty` is 0 in plain case mode.
  pieceQty: number;
  unitSymbol: string;
  baseUnitSymbol: string;
  conversionFactor: number;
  orderedPerPiece: boolean;
  /** Item cost per base unit; used for the ₱ running total in the minimum indicator. */
  unitCost: number;
  manufacturerId: number | null;
  manufacturerName: string | null;
  // Decision context for the history snapshot.
  path: "standard" | "stockout";
  suggestedQty: number;
  suggestedPieceQty: number;
  dos: number | null;
  sellingAreaDemand: number;
  sellingAreaNames: string[];
  lastSoldDate?: string;
  stockoutDailyRate?: number;
  stockoutWindowUnits?: number;
  safetyStockUnits: number;
  safetyStockPercent: number;
}

// Recomputes a review line's orderable quantity for its current mode. Split
// (per-piece) lines re-split into cases + pieces; if the fractional part has
// vanished (need became a whole number), they fall back to plain case mode so a
// line never lingers in split mode while its cs/pc toggle is hidden.
function recomputeLineQty(l: POLineState): { orderedPerPiece: boolean; quantity: number; pieceQty: number; suggestedQty: number; suggestedPieceQty: number } {
  const caseSuggested = computeSuggestion(l.dailySalesRate, l.period, l.supplierLeadTime, totalAvailable(l), l.roundUp, l.safetyStockUnits);
  if (l.orderedPerPiece) {
    const split = computeSplitOrder(
      l.dailySalesRate, l.period, l.supplierLeadTime, totalAvailable(l), l.conversionFactor,
    );
    if (l.conversionFactor > 1 && split.pieces > 0) {
      const totalNeed = split.need + l.safetyStockUnits;
      const factor = Math.round(l.conversionFactor);
      const totalPieces = Math.max(0, Math.ceil(totalNeed * factor - 1e-9));
      const quantity = Math.floor(totalPieces / factor);
      return {
        orderedPerPiece: true,
        quantity,
        pieceQty: totalPieces - quantity * factor,
        suggestedQty: quantity,
        suggestedPieceQty: totalPieces - quantity * factor,
      };
    }
  }
  return {
    orderedPerPiece: false,
    quantity: caseSuggested,
    pieceQty: 0,
    suggestedQty: caseSuggested,
    suggestedPieceQty: 0,
  };
}

// Rebuilds review lines from a restored localStorage snapshot. One malformed
// line rejects the whole snapshot — silently dropping individual lines would
// corrupt an order without the user noticing.
function sanitizePoLines(raw: unknown): POLineState[] {
  if (!Array.isArray(raw)) return [];
  const lines: POLineState[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) return [];
    const r = item as Record<string, unknown>;
    const reqStr = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
    const num = (v: unknown): number | null =>
      typeof v === "number" && Number.isFinite(v) ? v : null;

    const sku = reqStr(r.sku);
    const description = reqStr(r.description);
    const supplierId = reqStr(r.supplierId);
    const supplierName = reqStr(r.supplierName);
    const unitSymbol = reqStr(r.unitSymbol);
    const path = r.path === "standard" || r.path === "stockout" ? r.path : null;
    const period = (ORDER_PERIODS as readonly number[]).includes(r.period as number)
      ? (r.period as PeriodDays)
      : null;
    if (!sku || !description || !supplierId || !supplierName || !unitSymbol || !path || period === null) return [];
    if (
      [
        r.supplierLeadTime,
        r.dailySalesRate,
        r.effectiveAvailable,
        r.quantity,
        r.pieceQty,
        r.conversionFactor,
        r.suggestedQty,
        r.suggestedPieceQty,
        r.sellingAreaDemand,
        r.safetyStockUnits,
        r.safetyStockPercent,
        r.unitCost,
      ].some((v) => num(v) === null)
    ) {
      return [];
    }
    if (typeof r.roundUp !== "boolean" || typeof r.orderedPerPiece !== "boolean") return [];

    lines.push({
      sku,
      description,
      supplierId,
      supplierName,
      supplierLeadTime: r.supplierLeadTime as number,
      dailySalesRate: r.dailySalesRate as number,
      effectiveAvailable: r.effectiveAvailable as number,
      shelfOnHand: r.shelfOnHand == null ? null : num(r.shelfOnHand),
      period,
      roundUp: r.roundUp,
      quantity: Math.max(0, Math.trunc(r.quantity as number)),
      pieceQty: Math.max(0, Math.trunc(r.pieceQty as number)),
      unitSymbol,
      baseUnitSymbol: typeof r.baseUnitSymbol === "string" ? r.baseUnitSymbol : "",
      conversionFactor: r.conversionFactor as number,
      orderedPerPiece: r.orderedPerPiece,
      unitCost: r.unitCost as number,
      manufacturerId:
        r.manufacturerId === null || typeof r.manufacturerId === "number"
          ? (r.manufacturerId as number | null)
          : null,
      manufacturerName:
        r.manufacturerName === null || typeof r.manufacturerName === "string"
          ? (r.manufacturerName as string | null)
          : null,
      path,
      suggestedQty: r.suggestedQty as number,
      suggestedPieceQty: r.suggestedPieceQty as number,
      dos: r.dos === null || typeof r.dos === "number" ? (r.dos as number | null) : null,
      sellingAreaDemand: r.sellingAreaDemand as number,
      sellingAreaNames: Array.isArray(r.sellingAreaNames)
        ? r.sellingAreaNames.filter((s): s is string => typeof s === "string")
        : [],
      lastSoldDate: typeof r.lastSoldDate === "string" ? r.lastSoldDate : undefined,
      stockoutDailyRate: typeof r.stockoutDailyRate === "number" ? r.stockoutDailyRate : undefined,
      stockoutWindowUnits: typeof r.stockoutWindowUnits === "number" ? r.stockoutWindowUnits : undefined,
      safetyStockUnits: r.safetyStockUnits as number,
      safetyStockPercent: r.safetyStockPercent as number,
    });
  }
  return lines;
}

type Screen = "replenishment" | "po-review" | "summary";

const TH = "px-3 py-2 type-label text-muted-foreground whitespace-nowrap";

// Case-insensitive "contains" match used by the list search box. Matches the query
// literally (String.includes, not a regex) so special characters like `!` or `+`
// are treated as plain text. `String(f ?? "")` guards null/undefined/number fields.
function matchesQuery(query: string, ...fields: string[]): boolean {
  if (!query) return true;
  return fields.some((f) => String(f ?? "").toLowerCase().includes(query));
}

function formatPeso(value: number): string {
  return "₱" + value.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * Computes the ₱ and quantity running totals for a supplier across its review lines.
 * ₱ = Σ(caseQty × unitCost × conversionFactor) + Σ(pieceQty × unitCost)
 * qty = Σ(caseQty + pieceQty)  — crude purchase-unit count (case=1, piece=1)
 */
function computeSupplierRunning(lines: POLineState[]): { runningValue: number; runningQuantity: number } {
  let runningValue = 0;
  let runningQuantity = 0;
  for (const l of lines) {
    const caseQty = l.quantity;
    const pieceQty = l.orderedPerPiece ? l.pieceQty : 0;
    runningValue += caseQty * l.unitCost * l.conversionFactor + pieceQty * l.unitCost;
    runningQuantity += caseQty + pieceQty;
  }
  return { runningValue, runningQuantity };
}

// Renders `text` with every case-insensitive occurrence of `query` wrapped in a
// highlight. `query` is expected pre-lowercased (the search box lowercases once).
function Highlight({ text, query }: { text: string; query: string }): ReactNode {
  if (!query) return text;
  const safe = String(text ?? "");
  const lower = safe.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  let hit = lower.indexOf(query);
  let key = 0;
  while (hit !== -1) {
    if (hit > cursor) parts.push(safe.slice(cursor, hit));
    parts.push(
      <mark key={key++} className="rounded bg-warning/40 text-foreground">
        {safe.slice(hit, hit + query.length)}
      </mark>
    );
    cursor = hit + query.length;
    hit = lower.indexOf(query, cursor);
  }
  if (cursor < safe.length) parts.push(safe.slice(cursor));
  return parts;
}

function ReplenishmentSkeleton({ showIncoming }: { showIncoming: boolean }) {
  const widths = ["w-12", "w-12", "w-12", "w-12", "w-12", "w-10", "w-14"];
  return (
    <div className="space-y-3">
      <p className="type-caption text-center text-muted-foreground">
        Crunching sales history… wide date ranges on busy locations can take a few seconds.
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead className="border-b border-border bg-muted">
            <tr>
              <th className="w-8 px-3 py-2" />
              <th className={cn(TH, "text-left")}>SKU</th>
              <th className={cn(TH, "text-left whitespace-normal")}>Description</th>
              <th className={cn(TH, "text-left")}>Unit</th>
              <th className={cn(TH, "text-right")}>On-Hand</th>
              {showIncoming && <th className={cn(TH, "text-right")}>Incoming</th>}
              <th className={cn(TH, "text-right")}>Under served</th>
              <th className={cn(TH, "text-right")}>Effective Stock</th>
              <th className={cn(TH, "text-right")}>Daily Rate</th>
              <th className={cn(TH, "text-right")}>DOS</th>
              <th className={cn(TH, "text-right")}>Safety</th>
              <th className={cn(TH, "text-right")}>Suggested Order</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 3 }).map((_, groupIndex) => (
              <Fragment key={groupIndex}>
                <tr className="border-t border-border bg-muted">
                  <td className="px-3 py-3" />
                  <td colSpan={11} className="px-3 py-3">
                    <Skeleton className="h-4 w-48" />
                  </td>
                </tr>
                {Array.from({ length: 4 }).map((_, rowIndex) => (
                  <tr key={rowIndex} className="border-t border-border/60">
                    <td className="px-3 py-3"><Skeleton className="mx-auto size-4" /></td>
                    <td className="px-3 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-3 py-3"><Skeleton className="h-4 w-40" /></td>
                    <td className="px-3 py-3"><Skeleton className="h-4 w-8" /></td>
                    {widths.map((w, colIndex) => (
                      <td key={colIndex} className="px-3 py-3">
                        <Skeleton className={cn("ml-auto h-4", w)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StockoutSkeleton() {
  return (
    <div className="space-y-3">
      <p className="type-caption text-center text-muted-foreground">
        Loading stockout candidates — checking sales history…
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead className="border-b border-border bg-muted">
            <tr>
              <th className="w-8 px-3 py-2" />
              <th className={cn(TH, "text-left")}>SKU</th>
              <th className={cn(TH, "text-left whitespace-normal")}>Description</th>
              <th className={cn(TH, "text-left")}>Unit</th>
              <th className={cn(TH, "text-right")}>Last Sold</th>
              <th className={cn(TH, "text-right")}>Daily Rate</th>
              <th className={cn(TH, "text-right")}>30d Units</th>
              <th className={cn(TH, "text-right")}>Suggested</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 3 }).map((_, groupIndex) => (
              <Fragment key={groupIndex}>
                <tr className="border-t border-border bg-muted">
                  <td className="px-3 py-3" />
                  <td colSpan={7} className="px-3 py-3">
                    <Skeleton className="h-4 w-48" />
                  </td>
                </tr>
                {Array.from({ length: 3 }).map((_, rowIndex) => (
                  <tr key={rowIndex} className="border-t border-border/60">
                    <td className="px-3 py-3"><Skeleton className="mx-auto size-4" /></td>
                    <td className="px-3 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-3 py-3"><Skeleton className="h-4 w-40" /></td>
                    <td className="px-3 py-3"><Skeleton className="h-4 w-8" /></td>
                    <td className="px-3 py-3"><Skeleton className="ml-auto h-4 w-20" /></td>
                    <td className="px-3 py-3"><Skeleton className="ml-auto h-4 w-12" /></td>
                    <td className="px-3 py-3"><Skeleton className="ml-auto h-4 w-12" /></td>
                    <td className="px-3 py-3"><Skeleton className="ml-auto h-4 w-14" /></td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatManilaDatetime(d: Date): string {
  return d.toLocaleString("en-PH", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
    timeZone: "Asia/Manila",
  });
}

interface WorksheetReportProps {
  groups: SupplierGroup[];
  stockoutGroups: StockoutSupplierGroup[] | null;
  companyName: string;
  locationName: string;
  appliedFrom: string;
  appliedTo: string;
  globalPeriod: PeriodDays;
  globalRoundUp: boolean;
  printedByName: string;
  printedAt: Date | null;
  getMfgPeriod: (supplierId: string, manufacturerId: number | null) => PeriodDays;
}

// Printable full-catalog worksheet for the LIVE Standard run (pre-PO). Renders from
// its own transient `groups` fetch (worksheet=true) — never the on-screen `groups`
// state, which excludes zero-sales items by design. Pattern mirrors the History
// replenishment run print report (app/(authenticated)/history/replenishment/[runId]/page.tsx).
function WorksheetColgroup() {
  return (
    <colgroup>
      {/* Barcode (item.CODE) — fixed, no-wrap */}
      <col style={{ width: "12%" }} />
      {/* Description — auto, takes remaining width */}
      <col />
      {/* Unit */}
      <col style={{ width: "6%" }} />
      {/* On-Hand */}
      <col style={{ width: "8%" }} />
      {/* Sales Rate */}
      <col style={{ width: "9%" }} />
      {/* Underserved */}
      <col style={{ width: "8%" }} />
      {/* Suggested */}
      <col style={{ width: "9%" }} />
      {/* Order Qty — header-text width */}
      <col style={{ width: "8%" }} />
    </colgroup>
  );
}

function WorksheetStockoutColgroup() {
  return (
    <colgroup>
      <col style={{ width: "12%" }} />
      <col />
      <col style={{ width: "6%" }} />
      <col style={{ width: "11%" }} />
      <col style={{ width: "9%" }} />
      <col style={{ width: "9%" }} />
      <col style={{ width: "8%" }} />
    </colgroup>
  );
}

function WorksheetReport({
  groups,
  stockoutGroups,
  companyName,
  locationName,
  appliedFrom,
  appliedTo,
  globalPeriod,
  globalRoundUp,
  printedByName,
  printedAt,
  getMfgPeriod,
}: WorksheetReportProps) {
  const nonEmptyGroups = groups.filter((g) => g.items.length > 0);
  const supplierNames = nonEmptyGroups.map((g) => g.supplierName).join(", ");
  const resolvedPrintedAt = printedAt ?? new Date();

  const nonEmptyStockoutGroups =
    stockoutGroups?.filter((g) => g.items.length > 0) ?? [];

  return (
    <div className="hidden print:block worksheet-report">
      {/* Document header — flows as normal content at the very top of page one. No
          fixed running header/footer: on filled pages those overlapped the table, so
          location/supplier now live here at the top beside the title. */}
      <div className="worksheet-doc-header">
        <div className="worksheet-doc-title">{companyName} · Ops Hub · Replenishment</div>
        <div className="worksheet-top-scope">
          <span><strong>Location:</strong> {locationName}</span>
          <span><strong>Suppliers:</strong> {supplierNames || "—"} ({nonEmptyGroups.length})</span>
        </div>
        <div className="worksheet-meta-grid">
          <span><strong>Sales range:</strong> {formatSaleDate(appliedFrom)} → {formatSaleDate(appliedTo)}</span>
          <span><strong>Order period:</strong> {globalPeriod}d</span>
          <span><strong>Rounding:</strong> {globalRoundUp ? "Round up" : "Round down"}</span>
        </div>
        <div className="worksheet-printed-line">
          Printed on {formatManilaDatetime(resolvedPrintedAt)} by {printedByName}
        </div>
      </div>

      {/* Manufacturer sub-group sections — one table per supplier × manufacturer, flowing
          continuously (no forced page break) like History's per-PO sections; table headers
          repeat across page breaks via thead { display: table-header-group }. */}
      {nonEmptyGroups.length === 0 ? (
        <p className="worksheet-empty">No active items for the selected suppliers.</p>
      ) : (
        nonEmptyGroups.map((group) =>
          groupByMfg(group.items).map((mfg) => {
            const period = getMfgPeriod(group.supplierId, mfg.manufacturerId);
            return (
              <section key={`${group.supplierId}-${mfg.manufacturerId ?? "nb"}`} className="worksheet-section">
                <div className="worksheet-section-header">
                  <span>{group.supplierName}</span>
                  <span> · {mfg.manufacturerName ?? "No Brand"}</span>
                  <span> · {period}d order period</span>
                </div>
                <table className="worksheet-table">
                  <WorksheetColgroup />
                  <thead>
                    <tr>
                      <th className="worksheet-th-left">Barcode</th>
                      <th className="worksheet-th-left">Description</th>
                      <th className="worksheet-th-left">Unit</th>
                      <th className="worksheet-th-right">On-Hand</th>
                      <th className="worksheet-th-right">Sales Rate</th>
                      <th className="worksheet-th-right">Under served</th>
                      <th className="worksheet-th-right">Suggested</th>
                      <th className="worksheet-th-left">Order Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mfg.items.map((item) => {
                      const effective = item.availableStock + item.incoming;
                      const suggested = computeSuggestion(
                        item.dailySalesRate, period, item.supplierLeadTime, effective, globalRoundUp, item.safetyStockUnits
                      );
                      const isZero = suggested === 0;
                      return (
                        <tr key={item.sku} className="worksheet-row">
                          <td className="worksheet-td-left worksheet-td-barcode type-data">{item.sku}</td>
                          <td className="worksheet-td-left worksheet-td-desc">{item.description}</td>
                          <td className="worksheet-td-left">{item.unitSymbol}</td>
                          <td className="worksheet-td-right">{item.availableStock.toFixed(2)}</td>
                          <td className="worksheet-td-right">{item.dailySalesRate.toFixed(2)}</td>
                          <td className="worksheet-td-right">
                            {item.underservedQuantity > 0 ? item.underservedQuantity.toFixed(2) : "—"}
                          </td>
                          <td className="worksheet-td-right worksheet-suggested">
                            {suggested}{isZero ? "*" : ""}
                          </td>
                          <td className="worksheet-td-blank" />
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            );
          })
        )
      )}

      {nonEmptyGroups.length > 0 && (
        <p className="worksheet-legend">
          * Suggested 0 — adequate stock, rounded down, or no recent sales. Review before writing an Order Qty.
        </p>
      )}

      {/* Stockout section — printed last, separate from the standard items. */}
      {nonEmptyStockoutGroups.length > 0 && (
        <div className="worksheet-stockout">
          <div className="worksheet-stockout-header">
            <span className="worksheet-stockout-title">Stockout — Currently Out of Stock</span>
          </div>
          {nonEmptyStockoutGroups.map((group) =>
            groupByMfg(group.items).map((mfg) => {
              const period = getMfgPeriod(group.supplierId, mfg.manufacturerId);
              return (
                <section
                  key={`so-${group.supplierId}-${mfg.manufacturerId ?? "nb"}`}
                  className="worksheet-section"
                >
                  <div className="worksheet-section-header">
                    <span>{group.supplierName}</span>
                    <span> · {mfg.manufacturerName ?? "No Brand"}</span>
                    <span> · {period}d order period</span>
                  </div>
                  <table className="worksheet-table">
                    <WorksheetStockoutColgroup />
                    <thead>
                      <tr>
                        <th className="worksheet-th-left">Barcode</th>
                        <th className="worksheet-th-left">Description</th>
                        <th className="worksheet-th-left">Unit</th>
                        <th className="worksheet-th-left">Last Sale</th>
                        <th className="worksheet-th-right">Daily Rate</th>
                        <th className="worksheet-th-right">Suggested</th>
                        <th className="worksheet-th-left">Order Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mfg.items.map((item) => {
                        const suggested = computeStockoutSuggestion(
                          item.dailySalesRate, period, item.supplierLeadTime, globalRoundUp
                        );
                        return (
                          <tr key={`so-${item.sku}`} className="worksheet-row">
                            <td className="worksheet-td-left worksheet-td-barcode type-data">{item.sku}</td>
                            <td className="worksheet-td-left worksheet-td-desc">{item.description}</td>
                            <td className="worksheet-td-left">{item.unitSymbol}</td>
                            <td className="worksheet-td-left">{formatSaleDate(item.lastSaleDate)}</td>
                            <td className="worksheet-td-right">{item.dailySalesRate.toFixed(2)}</td>
                            <td className="worksheet-td-right worksheet-suggested">{suggested}</td>
                            <td className="worksheet-td-blank" />
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </section>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function ReplenishmentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const locationIdParam = searchParams.get("locationId");
  const locationId = locationIdParam ? Number(locationIdParam) : null;
  const supplierIdsParam = searchParams.get("supplierIds");
  const manufacturerIdsParam = searchParams.get("manufacturerIds");
  const manufacturerPairs = parseManufacturerTokens(manufacturerIdsParam);

  const [activeTab, setActiveTab] = useState<"standard" | "stockout">("standard");

  // Item search — filters the visible list to SKU/description "contains" matches
  // and highlights the matched text. Applies to whichever tab is active.
  const [search, setSearch] = useState("");
  const searchQuery = search.trim().toLowerCase();

  // Standard state
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());
  const [appliedFrom, setAppliedFrom] = useState(from);
  const [appliedTo, setAppliedTo] = useState(to);
  const [globalPeriod, setGlobalPeriod] = useState<PeriodDays>(ORDER_PERIODS[0]);
  const [globalRoundUp, setGlobalRoundUp] = useState(true);
  const [locationName, setLocationName] = useState("");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [groups, setGroups] = useState<SupplierGroup[]>([]);
  const [loading, setLoading] = useState(false);
  // Per-manufacturer-subgroup period overrides; keyed by mfgKey(supplierId, manufacturerId)
  const [mfgPeriodOverrides, setMfgPeriodOverrides] = useState<Map<string, PeriodDays>>(new Map());
  const [expandedStandardGroups, setExpandedStandardGroups] = useState<Set<string>>(new Set());
  const [expandedStandardMfgs, setExpandedStandardMfgs] = useState<Set<string>>(new Set());
  const [selectedStandard, setSelectedStandard] = useState<Set<string>>(new Set());

  // Stockout state
  const [stockoutGroups, setStockoutGroups] = useState<StockoutSupplierGroup[]>([]);
  const [stockoutLoading, setStockoutLoading] = useState(false);
  const [stockoutError, setStockoutError] = useState<string | null>(null);
  const [stockoutFetched, setStockoutFetched] = useState(false);
  const [expandedStockoutGroups, setExpandedStockoutGroups] = useState<Set<string>>(new Set());
  const [expandedStockoutMfgs, setExpandedStockoutMfgs] = useState<Set<string>>(new Set());
  const [selectedStockout, setSelectedStockout] = useState<Set<string>>(new Set());

  // Per-supplier minimums for Standard; populated when groups load.
  const [supplierMinimums, setSupplierMinimums] = useState<Map<string, SupplierMinimum>>(new Map());

  // Show-all-items toggle (admin setting, fetched once on mount).
  const [showAllItems, setShowAllItems] = useState(false);
  const [showIncoming, setShowIncoming] = useState(true);
  const [safetyStockEnabled, setSafetyStockEnabled] = useState(false);
  const [safetyStockMode, setSafetyStockMode] = useState<SafetyStockMode>("off");
  const showAllItemsRef = useRef(false);
  const defaultPresetLoadedRef = useRef(false);
  const fetchSequenceRef = useRef(0);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Total manufacturer count (M) for the "Manufacturers: N of M" indicator — fetched
  // once from /manufacturer/api only while a manufacturer filter is active.
  const [manufacturerTotal, setManufacturerTotal] = useState<number | null>(null);

  // Print Worksheet (Standard only) — a separate, transient full-catalog fetch.
  // MUST NOT overwrite `groups`: the worksheet includes zero-sales items that must
  // never leak into the on-screen list.
  const [worksheetGroups, setWorksheetGroups] = useState<SupplierGroup[] | null>(null);
  const [worksheetPrintedAt, setWorksheetPrintedAt] = useState<Date | null>(null);
  const [pendingPrint, setPendingPrint] = useState(false);
  const [companyName, setCompanyName] = useState("Operations Hub");
  const [printedByName, setPrintedByName] = useState("");

  // Print modal state
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [includeStockout, setIncludeStockout] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printTotalItems, setPrintTotalItems] = useState(0);
  const [stockoutWorksheetGroups, setStockoutWorksheetGroups] = useState<StockoutSupplierGroup[] | null>(null);

  // PO / review state
  const [screen, setScreen] = useState<Screen>("replenishment");
  const [poLines, setPoLines] = useState<POLineState[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftSaveResult, setDraftSaveResult] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showDraftSavedModal, setShowDraftSavedModal] = useState(false);
  const [requireApproval, setRequireApproval] = useState(false);
  const [poError, setPoError] = useState<string | null>(null);
  const [poResults, setPoResults] = useState<PurchaseOrderResult[]>([]);
  const [draftRunId, setDraftRunId] = useState<number | null>(null);

  // Below-minimum acknowledgment dialog (Standard only) — shared by Submit PO and
  // Save as Draft so both commit paths record who acknowledged a short order.
  const [belowMinDialog, setBelowMinDialog] = useState<{
    action: "submit" | "draft";
    suppliersBelow: Array<{ supplierId: string; supplierName: string; minOrderValue: number | null; minOrderQuantity: number | null; runningValue: number; runningQuantity: number }>;
  } | null>(null);
  const [expandedReviewSuppliers, setExpandedReviewSuppliers] = useState<Set<string>>(new Set());
  const [expandedReviewMfgs, setExpandedReviewMfgs] = useState<Set<string>>(new Set());

  // Review resilience: localStorage autosave of the in-progress review.
  const [restoredFromSnapshot, setRestoredFromSnapshot] = useState(false);
  const [restoredSavedAt, setRestoredSavedAt] = useState<string | null>(null);
  const restoreAttemptedRef = useRef(false);
  // Inputs of the last Generate PO — an identical re-click re-enters Review
  // without rebuilding, preserving manual edits made there.
  const lastGenerateSignatureRef = useRef<string | null>(null);
  // Bumped whenever groups/stockout data is refetched so a stale signature can't
  // reuse lines computed from older data.
  const dataEpochRef = useRef(0);

  useEffect(() => {
    // Chain is location → supplier → manufacturer → run. manufacturerIds is optional
    // (absent = all manufacturers) so its absence never triggers a redirect here.
    if (!locationId) {
      router.replace(
        "/location?module=replenishment&returnTo=" +
          encodeURIComponent(
            "/supplier?returnTo=" +
              encodeURIComponent("/manufacturer?returnTo=" + encodeURIComponent("/replenishment"))
          )
      );
      return;
    }
    if (!supplierIdsParam) {
      router.replace(
        `/supplier?returnTo=${encodeURIComponent(
          "/manufacturer?returnTo=" + encodeURIComponent("/replenishment")
        )}&locationId=${locationId}`
      );
    }
  }, [locationId, supplierIdsParam, router]);

  // Restores an autosaved review once per mount. Runs on mount BEFORE the initial
  // data fetch (which waits for settings), and also rewinds the applied date range
  // so that fetch covers the same data window the saved run was built from.
  useEffect(() => {
    if (restoreAttemptedRef.current || !locationId || !supplierIdsParam) return;
    restoreAttemptedRef.current = true;
    const session = loadReviewSession<POLineState>(locationId);
    if (!session) return;
    const context: ReviewSessionContext = {
      supplierIds: supplierIdsParam,
      manufacturerIds: manufacturerIdsParam,
    };
    if (
      session.context.supplierIds !== context.supplierIds ||
      session.context.manufacturerIds !== context.manufacturerIds
    ) {
      return;
    }
    const restoredLines = sanitizePoLines(session.poLines);
    if (restoredLines.length === 0) return;
    setFrom(session.appliedFrom);
    setTo(session.appliedTo);
    setAppliedFrom(session.appliedFrom);
    setAppliedTo(session.appliedTo);
    setGlobalRoundUp(session.globalRoundUp);
    setPoLines(restoredLines);
    setExpandedReviewSuppliers(new Set(restoredLines.map((l) => l.supplierId)));
    setExpandedReviewMfgs(new Set(restoredLines.map((l) => mfgKey(l.supplierId, l.manufacturerId))));
    setRestoredSavedAt(session.savedAt);
    setRestoredFromSnapshot(true);
    setScreen("po-review");
  }, [locationId, supplierIdsParam, manufacturerIdsParam]);

  // Autosaves the in-progress review so navigating away or refreshing never loses it.
  useEffect(() => {
    if (screen !== "po-review" || poLines.length === 0 || !locationId || !supplierIdsParam) return;
    saveReviewSession(locationId, {
      version: REVIEW_SESSION_VERSION,
      context: { supplierIds: supplierIdsParam, manufacturerIds: manufacturerIdsParam },
      appliedFrom,
      appliedTo,
      globalRoundUp,
      savedAt: new Date().toISOString(),
      poLines,
    });
  }, [screen, poLines, globalRoundUp, appliedFrom, appliedTo, locationId, supplierIdsParam, manufacturerIdsParam]);

  useEffect(() => {
    fetch("/replenishment/api/settings")
      .then((r) => r.json())
      .then(
        (data: {
          settings: {
            replenishment_show_all_items: boolean;
            replenishment_show_incoming: boolean;
            replenishment_safety_stock_mode: SafetyStockMode;
            replenishment_require_approval: boolean;
            replenishment_default_date_preset: "week" | "2weeks" | "month";
          };
        }) => {
          setRequireApproval(data.settings.replenishment_require_approval ?? false);
          const val = data.settings.replenishment_show_all_items ?? false;
          showAllItemsRef.current = val;
          setShowAllItems(val);
          setShowIncoming(data.settings.replenishment_show_incoming ?? true);
          const mode = data.settings.replenishment_safety_stock_mode ?? "off";
          setSafetyStockMode(mode);
          setSafetyStockEnabled(mode !== "off");
          // Apply default date preset on first load only
          if (!defaultPresetLoadedRef.current) {
            const presetKey = data.settings.replenishment_default_date_preset ?? "month";
            const preset = DATE_PRESETS[presetKey];
            const fromDate = daysAgo(preset.days);
            const toDate = today();
            setFrom(fromDate);
            setTo(toDate);
            setAppliedFrom(fromDate);
            setAppliedTo(toDate);
            defaultPresetLoadedRef.current = true;
          }
          setSettingsLoaded(true);
        }
      )
      .catch(() => {
        setSettingsLoaded(true);
      });
  }, []);

  const fetchGroups = useCallback(
    (fetchFrom: string, fetchTo: string, seedPeriod: PeriodDays, seedRoundUp: boolean) => {
      if (!fetchFrom || !fetchTo || !locationId || !supplierIdsParam) return;
      // Ignore responses from superseded requests — rapid Refresh clicks
      // otherwise let a slower older response overwrite newer data.
      const sequence = ++fetchSequenceRef.current;
      setLoading(true);
      setLocationError(null);
      const params = new URLSearchParams({
        from: fetchFrom,
        to: fetchTo,
        locationId: String(locationId),
        supplierIds: supplierIdsParam,
      });
      if (showAllItemsRef.current) params.set("showAllItems", "true");
      if (manufacturerIdsParam) params.set("manufacturerIds", manufacturerIdsParam);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      fetch(`/replenishment/api?${params}`, { signal: controller.signal })
        .then(async (r) => {
          if (sequence !== fetchSequenceRef.current) return;
          const data: { groups?: SupplierGroup[]; locationName?: string; error?: string } =
            await r.json();
          if (r.status === 404) {
            setLocationError("Location not found. Please select a valid location.");
            return;
          }
          if (!r.ok) {
            setLocationError(data.error ?? "Failed to load data.");
            return;
          }
          // Commit the applied range only on success so a failed fetch keeps
          // dateFilterDirty true (the refresh hint stays visible).
          setAppliedFrom(fetchFrom);
          setAppliedTo(fetchTo);
          const loadedGroups = data.groups ?? [];
          setLocationName(data.locationName ?? "");
          setGroups(loadedGroups);
          dataEpochRef.current += 1;
          // Capture per-supplier minimums for the live indicator and submit warning.
          setSupplierMinimums(new Map(
            loadedGroups.map((g) => [
              g.supplierId,
              { minOrderValue: g.minOrderValue ?? null, minOrderQuantity: g.minOrderQuantity ?? null },
            ])
          ));
          // Default-check only items with a positive rounded suggestion (non-sub-case).
          // Sub-case items (rawNeed > 0 but rounds to 0 under round-down) start unchecked
          // so an ordinary run is not padded with marginal piece orders (FR-9).
          const defaultCheckedSkus = new Set(
            loadedGroups.flatMap((g) =>
              groupByMfg(g.items).flatMap((mfg) =>
                mfg.items
                  .filter((item) => {
                    const effective = item.availableStock + item.incoming;
                    return computeSuggestion(item.dailySalesRate, seedPeriod, item.supplierLeadTime, effective, seedRoundUp, item.safetyStockUnits) > 0;
                  })
                  .map((i) => i.sku)
              )
            )
          );
          setSelectedStandard(defaultCheckedSkus);
          setExpandedStandardGroups(new Set(loadedGroups.map((g) => g.supplierId)));
          setExpandedStandardMfgs(new Set(
            loadedGroups.flatMap((g) =>
              groupByMfg(g.items).map((mfg) => mfgKey(g.supplierId, mfg.manufacturerId))
            )
          ));
          setMfgPeriodOverrides(new Map());
        })
        .catch((err) => {
          if (sequence !== fetchSequenceRef.current) return;
          if (err.name === "AbortError") {
            setLocationError("Request timed out. Please try again.");
          } else {
            setLocationError("Failed to load data. Check your connection and tap Refresh.");
          }
        })
        .finally(() => {
          clearTimeout(timeoutId);
          if (sequence === fetchSequenceRef.current) setLoading(false);
        });
    },
    [locationId, supplierIdsParam, manufacturerIdsParam]
  );

  const fetchStockoutCandidates = useCallback(() => {
    if (!locationId) return;
    setStockoutLoading(true);
    setStockoutError(null);
    const manufacturerQuery = manufacturerIdsParam
      ? `&manufacturerIds=${encodeURIComponent(manufacturerIdsParam)}`
      : "";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    fetch(
      `/replenishment/stockout/api?locationId=${locationId}&supplierIds=${supplierIdsParam}${manufacturerQuery}`,
      { signal: controller.signal }
    )
      .then(async (r) => {
        const data: {
          groups?: StockoutSupplierGroup[];
          locationName?: string;
          error?: string;
        } = await r.json();
        if (r.status === 404) {
          setStockoutError("Location not found.");
          return;
        }
        if (!r.ok) {
          setStockoutError(data.error ?? "Failed to load stockout data.");
          return;
        }
        const loadedGroups = data.groups ?? [];
        if (data.locationName) setLocationName((prev) => prev || data.locationName!);
        setStockoutGroups(loadedGroups);
        dataEpochRef.current += 1;
        setExpandedStockoutGroups(new Set(loadedGroups.map((g) => g.supplierId)));
        setExpandedStockoutMfgs(new Set(
          loadedGroups.flatMap((g) =>
            groupByMfg(g.items).map((mfg) => mfgKey(g.supplierId, mfg.manufacturerId))
          )
        ));
      })
      .catch((err) => {
        if (err.name === "AbortError") {
          setStockoutError("Request timed out. Please try again.");
        } else {
          setStockoutError("Failed to load stockout data. Check your connection and tap Refresh.");
        }
      })
      .finally(() => {
        clearTimeout(timeoutId);
        setStockoutLoading(false);
        setStockoutFetched(true);
      });
  }, [locationId, supplierIdsParam, manufacturerIdsParam]);

  // Print Worksheet — opens the print-config modal; the fetch + print happens there.
  const handlePrintWorksheet = useCallback(() => {
    if (!locationId || !supplierIdsParam) return;
    setPrintModalOpen(true);
    setIncludeStockout(false);
    setPrintError(null);
    const upfrontTotal = groups.reduce((sum, g) => sum + g.items.length, 0);
    setPrintTotalItems(upfrontTotal);
  }, [locationId, supplierIdsParam, groups]);

  // Modal Print handler — fetches worksheet data (+ optional stockout), then fires print.
  const handlePrintFromModal = useCallback(async () => {
    if (!locationId || !supplierIdsParam) return;
    setPrintLoading(true);
    setPrintError(null);

    try {
      const params = new URLSearchParams({
        from: appliedFrom,
        to: appliedTo,
        locationId: String(locationId),
        supplierIds: supplierIdsParam,
        worksheet: "true",
      });
      if (manufacturerIdsParam) params.set("manufacturerIds", manufacturerIdsParam);

      const r = await fetch(`/replenishment/api?${params}`);
      const data: { groups?: SupplierGroup[]; error?: string } = await r.json();
      if (!r.ok) {
        setPrintError(data.error ?? "Failed to load the worksheet.");
        return;
      }
      const groups = data.groups ?? [];

      let stockoutGroups: StockoutSupplierGroup[] | null = null;
      if (includeStockout) {
        const soParams = new URLSearchParams({
          locationId: String(locationId),
          supplierIds: supplierIdsParam,
        });
        if (manufacturerIdsParam) soParams.set("manufacturerIds", manufacturerIdsParam);
        const soR = await fetch(`/replenishment/stockout/api?${soParams}`);
        const soData: { groups?: StockoutSupplierGroup[]; error?: string } = await soR.json();
        if (!soR.ok) {
          setPrintError(soData.error ?? "Failed to load stockout data.");
          return;
        }
        stockoutGroups = soData.groups ?? [];
      }

      const totalItems =
        groups.reduce((sum, g) => sum + g.items.length, 0) +
        (stockoutGroups?.reduce((sum, g) => sum + g.items.length, 0) ?? 0);
      setPrintTotalItems(totalItems);
      setWorksheetGroups(groups);
      setStockoutWorksheetGroups(stockoutGroups);
      setWorksheetPrintedAt(new Date());
      setPendingPrint(true);
    } catch {
      setPrintError("Failed to load the worksheet.");
    } finally {
      setPrintLoading(false);
    }
  }, [locationId, supplierIdsParam, appliedFrom, appliedTo, manufacturerIdsParam, includeStockout]);

  // Fires window.print() only after the hidden WorksheetReport DOM has committed.
  useEffect(() => {
    if (!pendingPrint || worksheetGroups === null) return;
    const raf = requestAnimationFrame(() => {
      window.print();
      setPendingPrint(false);
      setPrintModalOpen(false);
    });
    return () => cancelAnimationFrame(raf);
  }, [worksheetGroups, pendingPrint]);

  useEffect(() => {
    if (!settingsLoaded) return;
    if (activeTab !== "standard") return;
    fetchGroups(appliedFrom, appliedTo, globalPeriod, globalRoundUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- globalPeriod/globalRoundUp are seed values for initial computation only; client-side recomputation handles changes
  }, [settingsLoaded, activeTab, appliedFrom, appliedTo, fetchGroups]);

  useEffect(() => {
    if (activeTab === "stockout" && locationId && !stockoutFetched) {
      fetchStockoutCandidates();
    }
  }, [activeTab, locationId, stockoutFetched, fetchStockoutCandidates]);

  // Update the print-modal total when the stockout toggle changes.
  useEffect(() => {
    if (!printModalOpen) return;
    const standardCount = groups.reduce((sum, g) => sum + g.items.length, 0);
    const stockoutCount =
      includeStockout && stockoutGroups
        ? stockoutGroups.reduce((sum, g) => sum + g.items.length, 0)
        : 0;
    setPrintTotalItems(standardCount + stockoutCount);
  }, [printModalOpen, includeStockout, groups, stockoutGroups]);

  // M for the "Manufacturers: N of M" indicator — only fetched while a filter is active.
  useEffect(() => {
    if (!manufacturerIdsParam || !supplierIdsParam) {
      setManufacturerTotal(null);
      return;
    }
    let cancelled = false;
    fetch(`/manufacturer/api?supplierIds=${encodeURIComponent(supplierIdsParam)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { suppliers?: { manufacturers: unknown[] }[] } | null) => {
        if (cancelled || !data?.suppliers) return;
        setManufacturerTotal(data.suppliers.reduce((sum, s) => sum + s.manufacturers.length, 0));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [manufacturerIdsParam, supplierIdsParam]);

  // Worksheet doc-header metadata (company name + printed-by), fetched once on mount —
  // mirrors app/(authenticated)/history/replenishment/[runId]/page.tsx.
  useEffect(() => {
    fetch("/login/api")
      .then((r) => r.json())
      .then((data: { companyName?: string }) => {
        if (data.companyName?.trim()) setCompanyName(data.companyName.trim());
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    getSession().then((session) => {
      if (session?.user?.name) setPrintedByName(session.user.name);
    });
  }, []);

  const dateFilterDirty = from !== appliedFrom || to !== appliedTo;

  function getMfgPeriod(supplierId: string, manufacturerId: number | null): PeriodDays {
    return mfgPeriodOverrides.get(mfgKey(supplierId, manufacturerId)) ?? globalPeriod;
  }

  function handleGlobalPeriodChange(period: PeriodDays) {
    setGlobalPeriod(period);
    setMfgPeriodOverrides(new Map());
  }

  function handleMfgPeriodChange(supplierId: string, manufacturerId: number | null, period: PeriodDays) {
    setMfgPeriodOverrides((prev) => {
      const next = new Map(prev);
      next.set(mfgKey(supplierId, manufacturerId), period);
      return next;
    });
  }

  // Standard selection handlers
  function toggleStandardItem(sku: string) {
    setSelectedStandard((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });
  }

  function toggleStandardMfgGroup(visibleItems: ReplenishmentItem[]) {
    const skus = visibleItems.map((i) => i.sku);
    const allChecked = skus.every((s) => selectedStandard.has(s));
    setSelectedStandard((prev) => {
      const next = new Set(prev);
      if (allChecked) skus.forEach((s) => next.delete(s));
      else skus.forEach((s) => next.add(s));
      return next;
    });
  }

  function toggleStandardGroup(group: SupplierGroup) {
    const allVisibleSkus: string[] = [];
    for (const mfg of groupByMfg(group.items)) {
      const period = getMfgPeriod(group.supplierId, mfg.manufacturerId);
      for (const item of mfg.items) {
        const effective = item.availableStock + item.incoming;
        const rawNeed = item.dailySalesRate * (period + item.supplierLeadTime) - effective;
        if (showAllItems || rawNeed + item.safetyStockUnits > 0) allVisibleSkus.push(item.sku);
      }
    }
    const allChecked = allVisibleSkus.every((s) => selectedStandard.has(s));
    setSelectedStandard((prev) => {
      const next = new Set(prev);
      if (allChecked) allVisibleSkus.forEach((s) => next.delete(s));
      else allVisibleSkus.forEach((s) => next.add(s));
      return next;
    });
  }

  function toggleExpandStandardGroup(supplierId: string) {
    setExpandedStandardGroups((prev) => {
      const next = new Set(prev);
      if (next.has(supplierId)) next.delete(supplierId);
      else next.add(supplierId);
      return next;
    });
  }

  function toggleExpandStandardMfg(key: string) {
    setExpandedStandardMfgs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function expandAllStandard() {
    setExpandedStandardGroups(new Set(groups.map((g) => g.supplierId)));
    setExpandedStandardMfgs(new Set(
      groups.flatMap((g) => groupByMfg(g.items).map((mfg) => mfgKey(g.supplierId, mfg.manufacturerId)))
    ));
  }

  function collapseAllStandard() {
    setExpandedStandardGroups(new Set());
    setExpandedStandardMfgs(new Set());
  }

  // Stockout selection handlers
  function toggleStockoutItem(sku: string) {
    setSelectedStockout((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });
  }

  function toggleStockoutMfgGroup(visibleItems: StockoutItem[]) {
    const skus = visibleItems.map((i) => i.sku);
    const allChecked = skus.every((s) => selectedStockout.has(s));
    setSelectedStockout((prev) => {
      const next = new Set(prev);
      if (allChecked) skus.forEach((s) => next.delete(s));
      else skus.forEach((s) => next.add(s));
      return next;
    });
  }

  function toggleStockoutGroup(group: StockoutSupplierGroup) {
    const allVisibleSkus: string[] = [];
    for (const mfg of groupByMfg(group.items)) {
      const period = getMfgPeriod(group.supplierId, mfg.manufacturerId);
      for (const item of mfg.items) {
        if (item.dailySalesRate * (period + item.supplierLeadTime) > 0) {
          allVisibleSkus.push(item.sku);
        }
      }
    }
    const allChecked = allVisibleSkus.every((s) => selectedStockout.has(s));
    setSelectedStockout((prev) => {
      const next = new Set(prev);
      if (allChecked) allVisibleSkus.forEach((s) => next.delete(s));
      else allVisibleSkus.forEach((s) => next.add(s));
      return next;
    });
  }

  function toggleExpandStockoutGroup(supplierId: string) {
    setExpandedStockoutGroups((prev) => {
      const next = new Set(prev);
      if (next.has(supplierId)) next.delete(supplierId);
      else next.add(supplierId);
      return next;
    });
  }

  function toggleExpandStockoutMfg(key: string) {
    setExpandedStockoutMfgs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function expandAllStockout() {
    setExpandedStockoutGroups(new Set(stockoutGroups.map((g) => g.supplierId)));
    setExpandedStockoutMfgs(new Set(
      stockoutGroups.flatMap((g) => groupByMfg(g.items).map((mfg) => mfgKey(g.supplierId, mfg.manufacturerId)))
    ));
  }

  function collapseAllStockout() {
    setExpandedStockoutGroups(new Set());
    setExpandedStockoutMfgs(new Set());
  }

  // Computed selection counts
  // All skus that are visible (rawNeed > 0 at their current period) — includes sub-case items.
  const standardAllVisibleSkus = groups.flatMap((g) =>
    groupByMfg(g.items).flatMap((mfg) => {
      const period = getMfgPeriod(g.supplierId, mfg.manufacturerId);
      return mfg.items
        .filter((item) => {
          const effective = item.availableStock + item.incoming;
          const rawNeed = item.dailySalesRate * (period + item.supplierLeadTime) - effective;
          return showAllItems || rawNeed + item.safetyStockUnits > 0;
        })
        .map((i) => i.sku);
    })
  );
  const standardVisibleSelectedCount = standardAllVisibleSkus.filter((s) =>
    selectedStandard.has(s)
  ).length;

  const allStandardGroupsExpanded =
    groups.length > 0 &&
    groups.every((g) => {
      if (!expandedStandardGroups.has(g.supplierId)) return false;
      return groupByMfg(g.items).every((mfg) =>
        expandedStandardMfgs.has(mfgKey(g.supplierId, mfg.manufacturerId))
      );
    });

  const allStandardVisibleSelected =
    standardAllVisibleSkus.length > 0 &&
    standardVisibleSelectedCount === standardAllVisibleSkus.length;

  const stockoutAllVisibleSkus = stockoutGroups.flatMap((g) =>
    groupByMfg(g.items).flatMap((mfg) => {
      const period = getMfgPeriod(g.supplierId, mfg.manufacturerId);
      return mfg.items
        .filter((item) => item.dailySalesRate * (period + item.supplierLeadTime) > 0)
        .map((i) => i.sku);
    })
  );

  const allStockoutGroupsExpanded =
    stockoutGroups.length > 0 &&
    stockoutGroups.every((g) => {
      if (!expandedStockoutGroups.has(g.supplierId)) return false;
      return groupByMfg(g.items).every((mfg) =>
        expandedStockoutMfgs.has(mfgKey(g.supplierId, mfg.manufacturerId))
      );
    });

  const standardSelectedSkuSet = new Set(
    standardAllVisibleSkus.filter((s) => selectedStandard.has(s))
  );
  const stockoutOnlySelectedCount = stockoutAllVisibleSkus.filter(
    (s) => selectedStockout.has(s) && !standardSelectedSkuSet.has(s)
  ).length;
  const totalSelectedCount = standardSelectedSkuSet.size + stockoutOnlySelectedCount;

  // Whether the active search matches any currently-visible item (mirrors the
  // per-row predicate used in render). `1` when no search is active so the
  // "no matches" empty state only shows for a non-empty query.
  const standardSearchMatchCount = searchQuery
    ? groups.reduce(
        (sum, g) =>
          sum +
          g.items.filter((item) => {
            const effective = item.availableStock + item.incoming;
            const period = getMfgPeriod(g.supplierId, item.manufacturerId);
            const rawNeed = item.dailySalesRate * (period + item.supplierLeadTime) - effective;
            return (
              (showAllItems || rawNeed + item.safetyStockUnits > 0) &&
              matchesQuery(searchQuery, item.sku, item.description)
            );
          }).length,
        0
      )
    : 1;
  const stockoutSearchMatchCount = searchQuery
    ? stockoutGroups.reduce(
        (sum, g) =>
          sum +
          g.items.filter((item) => {
            const period = getMfgPeriod(g.supplierId, item.manufacturerId);
            return (
              item.dailySalesRate * (period + item.supplierLeadTime) > 0 &&
              matchesQuery(searchQuery, item.sku, item.description)
            );
          }).length,
        0
      )
    : 1;

  function toggleSelectAllStandard() {
    setSelectedStandard((prev) => {
      const next = new Set(prev);
      if (allStandardVisibleSelected) standardAllVisibleSkus.forEach((s) => next.delete(s));
      else standardAllVisibleSkus.forEach((s) => next.add(s));
      return next;
    });
  }

  function handleGeneratePO() {
    // Everything that determines the generated lines. An identical signature on a
    // re-click means the same inputs — re-enter Review without rebuilding so the
    // user's manual quantity/mode edits survive the Back → Generate round-trip.
    const generateSignature = JSON.stringify({
      standard: [...selectedStandard].sort(),
      stockout: [...selectedStockout].sort(),
      periods: [...mfgPeriodOverrides.entries()].sort(([a], [b]) => a.localeCompare(b)),
      globalPeriod,
      globalRoundUp,
      appliedFrom,
      appliedTo,
      showAllItems,
      safetyStockEnabled,
      dataEpoch: dataEpochRef.current,
    });
    if (generateSignature === lastGenerateSignatureRef.current && poLines.length > 0) {
      setScreen("po-review");
      return;
    }
    lastGenerateSignatureRef.current = generateSignature;

    const standardLines: POLineState[] = groups.flatMap((g) =>
      groupByMfg(g.items).flatMap((mfg) => {
        const period = getMfgPeriod(g.supplierId, mfg.manufacturerId);
        return mfg.items
          .filter((item) => {
            if (!selectedStandard.has(item.sku)) return false;
            const effective = item.availableStock + item.incoming;
            const rawNeed = item.dailySalesRate * (period + item.supplierLeadTime) - effective;
            // Include sub-case items (rawNeed > 0 but rounds to 0 under round-down);
            // they default to per-piece on Review (see the map below) so they arrive
            // with an orderable piece quantity rather than a dropped zero-qty case line.
            // With showAllItems ON, also include items with sufficient stock that the
            // user has explicitly checked — they start at qty 0 on Review and the user
            // must manually override.
            return showAllItems || rawNeed + item.safetyStockUnits > 0;
          })
          .map((item) => {
            const effective = item.availableStock + item.incoming;
            const safetyStockUnits = safetyStockEnabled ? item.safetyStockUnits : 0;
            const caseSuggested = computeSuggestion(item.dailySalesRate, period, item.supplierLeadTime, effective, globalRoundUp, safetyStockUnits);
            const split = computeSplitOrder(item.dailySalesRate, period, item.supplierLeadTime, effective, item.conversionFactor);
            // Sub-case items (case suggestion rounds to 0 but real fractional demand
            // exists) default to split/per-piece so they carry an orderable piece
            // quantity instead of being dropped at submit as a zero-qty case line.
            const autoPerPiece = caseSuggested === 0 && item.conversionFactor > 1 && split.pieces > 0;
            const dos = item.dailySalesRate > 0 ? effective / item.dailySalesRate : null;
            let quantity: number;
            let pieceQty = 0;
            let suggestedQty: number;
            let suggestedPieceQty = 0;
            let orderedPerPiece = false;
            if (autoPerPiece) {
              const totalNeed = split.need + safetyStockUnits;
              const factor = Math.round(item.conversionFactor);
              const totalPieces = Math.max(0, Math.ceil(totalNeed * factor - 1e-9));
              quantity = Math.floor(totalPieces / factor);
              pieceQty = totalPieces - quantity * factor;
              suggestedQty = quantity;
              suggestedPieceQty = pieceQty;
              orderedPerPiece = true;
            } else {
              quantity = computeSuggestion(item.dailySalesRate, period, item.supplierLeadTime, effective, globalRoundUp, safetyStockUnits);
              suggestedQty = quantity;
            }
            const rawNeed = item.dailySalesRate * (period + item.supplierLeadTime) - effective;
            const safetyPct = rawNeed > 0 ? Math.round(safetyStockUnits / rawNeed * 100) : 0;
            return {
              sku: item.sku,
              description: item.description,
              supplierId: item.supplierId,
              supplierName: item.supplierName,
              supplierLeadTime: item.supplierLeadTime,
              dailySalesRate: item.dailySalesRate,
              effectiveAvailable: effective,
              shelfOnHand: null,
              period,
              roundUp: globalRoundUp,
              quantity,
              pieceQty,
              unitSymbol: item.unitSymbol,
              baseUnitSymbol: item.baseUnitSymbol,
              conversionFactor: item.conversionFactor,
              orderedPerPiece,
              manufacturerId: item.manufacturerId,
              manufacturerName: item.manufacturerName,
              path: "standard" as const,
              suggestedQty,
              suggestedPieceQty,
              dos,
              sellingAreaDemand: item.sellingAreaDemand,
              sellingAreaNames: item.sellingAreaNames,
              unitCost: item.unitCost,
              safetyStockUnits,
              safetyStockPercent: safetyPct,
            };
          });
      })
    );

    const standardSkuSet = new Set(standardLines.map((l) => l.sku));

    const makeStockoutLine = (
      item: StockoutItem,
      period: PeriodDays,
      supplierLeadTime: number
    ): POLineState => {
      const caseSuggested = computeSuggestion(item.dailySalesRate, period, supplierLeadTime, 0, globalRoundUp);
      const split = computeSplitOrder(item.dailySalesRate, period, supplierLeadTime, 0, item.conversionFactor);
      const autoPerPiece = caseSuggested === 0 && item.conversionFactor > 1 && split.pieces > 0;
      return {
        sku: item.sku,
        description: item.description,
        supplierId: item.supplierId,
        supplierName: item.supplierName,
        supplierLeadTime,
        dailySalesRate: item.dailySalesRate,
        effectiveAvailable: 0,
        period,
        roundUp: globalRoundUp,
        quantity: autoPerPiece ? split.cases : caseSuggested,
        pieceQty: autoPerPiece ? split.pieces : 0,
        unitSymbol: item.unitSymbol,
        baseUnitSymbol: item.baseUnitSymbol,
        conversionFactor: item.conversionFactor,
        orderedPerPiece: autoPerPiece,
        manufacturerId: item.manufacturerId,
        manufacturerName: item.manufacturerName,
        path: "stockout" as const,
        suggestedQty: autoPerPiece ? split.cases : caseSuggested,
        suggestedPieceQty: autoPerPiece ? split.pieces : 0,
        dos: null,
        sellingAreaDemand: 0,
        sellingAreaNames: [],
        lastSoldDate: item.lastSaleDate,
        stockoutDailyRate: item.dailySalesRate,
        stockoutWindowUnits: item.windowUnitsSold,
        unitCost: item.unitCost,
        safetyStockUnits: 0,
        safetyStockPercent: 0,
      };
    };

    // Items checked in both Standard and Stockout use the stockout suggestion.
    const overlapSkus = new Set<string>();
    const overlapLines: POLineState[] = [];
    for (const g of stockoutGroups) {
      for (const mfg of groupByMfg(g.items)) {
        const period = getMfgPeriod(g.supplierId, mfg.manufacturerId);
        for (const item of mfg.items) {
          if (!selectedStockout.has(item.sku)) continue;
          if (!standardSkuSet.has(item.sku)) continue;
          if (item.dailySalesRate * (period + item.supplierLeadTime) <= 0) continue;
          overlapSkus.add(item.sku);
          overlapLines.push(makeStockoutLine(item, period, item.supplierLeadTime));
        }
      }
    }
    const replacedStandardLines = standardLines.map((l) =>
      overlapSkus.has(l.sku)
        ? (overlapLines.find((o) => o.sku === l.sku) ?? l)
        : l
    );

    const stockoutLines: POLineState[] = stockoutGroups.flatMap((g) =>
      groupByMfg(g.items).flatMap((mfg) => {
        const period = getMfgPeriod(g.supplierId, mfg.manufacturerId);
        return mfg.items
          .filter((item) => {
            if (!selectedStockout.has(item.sku)) return false;
            if (standardSkuSet.has(item.sku)) return false;
            return item.dailySalesRate * (period + item.supplierLeadTime) > 0;
          })
          .map((item) => makeStockoutLine(item, period, item.supplierLeadTime));
      })
    );

    const allLines = [...replacedStandardLines, ...stockoutLines];
    setPoLines(allLines);
    setPoError(null);
    setPoResults([]);
    setExpandedReviewSuppliers(new Set(allLines.map((l) => l.supplierId)));
    setExpandedReviewMfgs(new Set(allLines.map((l) => mfgKey(l.supplierId, l.manufacturerId))));
    setScreen("po-review");
  }

  function updateLinePeriod(sku: string, period: PeriodDays) {
    setPoLines((prev) =>
      prev.map((l) => {
        if (l.sku !== sku) return l;
        const next = { ...l, period };
        return { ...next, ...recomputeLineQty(next) };
      })
    );
  }

  function updateLineRoundUp(sku: string, roundUp: boolean) {
    setPoLines((prev) =>
      prev.map((l) => {
        if (l.sku !== sku) return l;
        const next = { ...l, roundUp };
        return { ...next, ...recomputeLineQty(next) };
      })
    );
  }

  // Case-quantity field (whole cases). In split mode cases may be 0 (sub-case);
  // in plain case mode a line stays at ≥1 (drop it by unchecking on the main list).
  function updateLineQuantity(sku: string, quantity: number) {
    setPoLines((prev) => prev.map((l) => (l.sku === sku ? { ...l, quantity } : l)));
  }

  // Remainder-pieces field, only meaningful while a line is in split mode.
  function updateLinePieceQty(sku: string, pieceQty: number) {
    setPoLines((prev) => prev.map((l) => (l.sku === sku ? { ...l, pieceQty } : l)));
  }

  function updateLinePerPiece(sku: string, orderedPerPiece: boolean) {
    setPoLines((prev) =>
      prev.map((l) => {
        if (l.sku !== sku) return l;
        if (orderedPerPiece) {
          const split = computeSplitOrder(
            l.dailySalesRate, l.period, l.supplierLeadTime,
            totalAvailable(l), l.conversionFactor,
          );
          const totalNeed = split.need + l.safetyStockUnits;
          const factor = Math.round(l.conversionFactor);
          const totalPieces = Math.max(0, Math.ceil(totalNeed * factor - 1e-9));
          const quantity = Math.floor(totalPieces / factor);
          return {
            ...l,
            orderedPerPiece: true,
            quantity,
            pieceQty: totalPieces - quantity * factor,
            suggestedQty: quantity,
            suggestedPieceQty: totalPieces - quantity * factor,
          };
        }
        const caseSuggested = computeSuggestion(
          l.dailySalesRate, l.period, l.supplierLeadTime, totalAvailable(l), l.roundUp, l.safetyStockUnits,
        );
        return {
          ...l,
          orderedPerPiece: false,
          quantity: caseSuggested,
          pieceQty: 0,
          suggestedQty: caseSuggested,
          suggestedPieceQty: 0,
        };
      })
    );
  }

  function updateLineSafetyStock(sku: string, percent: number) {
    setPoLines((prev) =>
      prev.map((l) => {
        if (l.sku !== sku || l.path === "stockout") return l;
        const rawNeed = l.dailySalesRate * (l.period + l.supplierLeadTime) - totalAvailable(l);
        const newUnits = Math.max(0, rawNeed) * Math.max(0, percent) / 100;
        const next = { ...l, safetyStockPercent: percent, safetyStockUnits: newUnits };
        return { ...next, ...recomputeLineQty(next) };
      })
    );
  }

  // Manual selling-area on-hand (purchase units): blank clears to null; a number
  // adds additively to availability. DOS is re-derived so the recorded value
  // matches what the user saw on screen.
  function updateLineShelfOnHand(sku: string, raw: string) {
    setPoLines((prev) =>
      prev.map((l) => {
        if (l.sku !== sku || l.path === "stockout") return l;
        const shelfOnHand = raw.trim() === "" ? null : Math.max(0, Math.trunc(Number(raw)) || 0);
        const next = { ...l, shelfOnHand };
        return {
          ...next,
          ...recomputeLineQty(next),
          dos: l.dailySalesRate > 0 ? totalAvailable(next) / l.dailySalesRate : null,
        };
      })
    );
  }

  async function submitPO(belowMinAck?: Array<{ supplierId: number; minOrderValue: number | null; minOrderQuantity: number | null; runningValue: number; runningQuantity: number }>) {
    setSubmitting(true);
    setPoError(null);
    try {
      const hasStandard = poLines.some((l) => l.path === "standard");
      const res = await fetch("/replenishment/api/po", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poDate: today(),
          locationId,
          rounding: globalRoundUp ? "up" : "down",
          salesRangeFrom: hasStandard ? appliedFrom : null,
          salesRangeTo: hasStandard ? appliedTo : null,
          lines: poLines.map((l) => ({
            sku: l.sku,
            description: l.description,
            supplierId: l.supplierId,
            quantity: l.quantity,
            // Split lines also carry a remainder-pieces quantity; the server writes
            // it as a separate base-unit PO line (FR-11/FR-12).
            pieceQty: l.pieceQty,
            path: l.path,
            orderPeriodDays: l.period,
            salesRate: l.dailySalesRate,
            sellingAreaDemand: l.sellingAreaDemand,
            sellingAreaNames: l.sellingAreaNames,
            effectiveAvailable: l.path === "standard" ? l.effectiveAvailable : null,
            dos: l.path === "standard" ? l.dos : null,
            shelfOnHand: l.path === "standard" ? (l.shelfOnHand ?? null) : null,
            suggestedQty: l.suggestedQty,
            suggestedPieceQty: l.suggestedPieceQty,
            lastSoldDate: l.lastSoldDate,
            stockoutDailyRate: l.stockoutDailyRate,
            stockoutWindowUnits: l.stockoutWindowUnits,
            // Send both symbols; the server labels the cases line with `unitSymbol`
            // and the pieces line with `baseUnitSymbol` (it re-derives unit/factor/
            // rate from the DB — the symbols are only for the history snapshot).
            unitSymbol: l.unitSymbol,
            baseUnitSymbol: l.baseUnitSymbol || "pc",
            orderedPerPiece: l.orderedPerPiece,
            safetyStockUnits: l.safetyStockUnits,
            safetyStockPercent: l.safetyStockPercent,
          })),
          ...(belowMinAck && belowMinAck.length > 0 ? { belowMinAck } : {}),
        }),
      });
      const data: { pos?: PurchaseOrderResult[]; error?: string } = await res.json();
      if (!res.ok || data.error) {
        setPoError(data.error ?? "Submission failed. Please try again.");
      } else {
        setPoResults(data.pos ?? []);
        if (locationId) clearReviewSession(locationId);
        setScreen("summary");
      }
    } catch {
      setPoError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveDraft(belowMinAck?: Array<{ supplierId: number; minOrderValue: number | null; minOrderQuantity: number | null; runningValue: number; runningQuantity: number }>) {
    setDraftSaving(true);
    setPoError(null);
    setDraftSaveResult(null);
    try {
      const hasStandard = poLines.some((l) => l.path === "standard");
      const res = await fetch("/replenishment/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poDate: today(),
          locationId,
          rounding: globalRoundUp ? "up" : "down",
          salesRangeFrom: hasStandard ? appliedFrom : null,
          salesRangeTo: hasStandard ? appliedTo : null,
          lines: poLines.map((l) => ({
            sku: l.sku,
            description: l.description,
            supplierId: l.supplierId,
            quantity: l.quantity,
            pieceQty: l.pieceQty,
            path: l.path,
            orderPeriodDays: l.period,
            salesRate: l.dailySalesRate,
            sellingAreaDemand: l.sellingAreaDemand,
            sellingAreaNames: l.sellingAreaNames,
            effectiveAvailable: l.path === "standard" ? l.effectiveAvailable : null,
            dos: l.path === "standard" ? l.dos : null,
            shelfOnHand: l.path === "standard" ? (l.shelfOnHand ?? null) : null,
            suggestedQty: l.suggestedQty,
            suggestedPieceQty: l.suggestedPieceQty,
            lastSoldDate: l.lastSoldDate,
            stockoutDailyRate: l.stockoutDailyRate,
            stockoutWindowUnits: l.stockoutWindowUnits,
            unitSymbol: l.unitSymbol,
            baseUnitSymbol: l.baseUnitSymbol || "pc",
            orderedPerPiece: l.orderedPerPiece,
            safetyStockUnits: l.safetyStockUnits,
            safetyStockPercent: l.safetyStockPercent,
          })),
          ...(belowMinAck && belowMinAck.length > 0 ? { belowMinAck } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setDraftSaveResult({ type: "error", text: data.error ?? "Failed to save draft." });
        setTimeout(() => setDraftSaveResult(null), 5000);
      } else {
        setDraftRunId(data.runId);
        setShowDraftSavedModal(true);
      }
    } catch {
      setDraftSaveResult({ type: "error", text: "Network error. Please try again." });
      setTimeout(() => setDraftSaveResult(null), 5000);
    } finally {
      setDraftSaving(false);
    }
  }

  function handlePlanAnotherRun() {
    setShowDraftSavedModal(false);
    if (locationId) clearReviewSession(locationId);
    lastGenerateSignatureRef.current = null;
    const chainReturnTo = encodeURIComponent(
      `/supplier?returnTo=${encodeURIComponent("/manufacturer?returnTo=%2Freplenishment")}`
    );
    router.push(`/location?module=replenishment&returnTo=${chainReturnTo}`);
  }

  // Standard-only: per-supplier running totals vs configured minimums (FR-13/FR-16).
  function computeSuppliersBelow() {
    const suppliersBelow: Array<{
      supplierId: string;
      supplierName: string;
      minOrderValue: number | null;
      minOrderQuantity: number | null;
      runningValue: number;
      runningQuantity: number;
    }> = [];

    if (poLines.some((l) => l.path === "standard")) {
      // Group standard lines by supplier to compute per-supplier running totals.
      const standardBySupplierId = new Map<string, POLineState[]>();
      for (const l of poLines) {
        if (l.path !== "standard") continue;
        const existing = standardBySupplierId.get(l.supplierId) ?? [];
        existing.push(l);
        standardBySupplierId.set(l.supplierId, existing);
      }

      for (const [supplierId, lines] of standardBySupplierId) {
        const min = supplierMinimums.get(supplierId);
        if (!min || (min.minOrderValue == null && min.minOrderQuantity == null)) continue;
        const { runningValue, runningQuantity } = computeSupplierRunning(lines);
        const valueFails = min.minOrderValue != null && runningValue < min.minOrderValue;
        const qtyFails = min.minOrderQuantity != null && runningQuantity < min.minOrderQuantity;
        if (valueFails || qtyFails) {
          suppliersBelow.push({
            supplierId,
            supplierName: lines[0].supplierName,
            minOrderValue: min.minOrderValue,
            minOrderQuantity: min.minOrderQuantity,
            runningValue,
            runningQuantity,
          });
        }
      }
    }
    return suppliersBelow;
  }

  async function handleSubmitPO() {
    const suppliersBelow = computeSuppliersBelow();
    if (suppliersBelow.length > 0) {
      setBelowMinDialog({ action: "submit", suppliersBelow });
      return;
    }
    await submitPO();
  }

  async function handleSaveDraftClick() {
    const suppliersBelow = computeSuppliersBelow();
    if (suppliersBelow.length > 0) {
      setBelowMinDialog({ action: "draft", suppliersBelow });
      return;
    }
    await saveDraft();
  }

  async function handleBelowMinConfirm() {
    if (!belowMinDialog) return;
    const action = belowMinDialog.action;
    const ack = belowMinDialog.suppliersBelow.map((s) => ({
      supplierId: Number(s.supplierId),
      minOrderValue: s.minOrderValue,
      minOrderQuantity: s.minOrderQuantity,
      runningValue: s.runningValue,
      runningQuantity: s.runningQuantity,
    }));
    setBelowMinDialog(null);
    if (action === "draft") await saveDraft(ack);
    else await submitPO(ack);
  }

  function handleDone() {
    if (locationId) clearReviewSession(locationId);
    lastGenerateSignatureRef.current = null;
    setScreen("replenishment");
    setPoLines([]);
    setPoResults([]);
    setDraftRunId(null);
    setPoError(null);
    setSelectedStockout(new Set());
    setStockoutFetched(false);
    fetchGroups(appliedFrom, appliedTo, globalPeriod, globalRoundUp);
  }

  function handleOrderForDifferentSuppliers() {
    router.push(
      `/supplier?returnTo=${encodeURIComponent(`/replenishment?locationId=${locationId}`)}`
    );
  }

  function handleDiscardRestored() {
    if (locationId) clearReviewSession(locationId);
    lastGenerateSignatureRef.current = null;
    setRestoredFromSnapshot(false);
    setRestoredSavedAt(null);
    setPoLines([]);
    setPoError(null);
    setPoResults([]);
    setDraftRunId(null);
    setScreen("replenishment");
  }

  function differenceInDays(to: string, from: string): number {
    const [ty, tm, td] = to.split("-").map(Number);
    const [fy, fm, fd] = from.split("-").map(Number);
    const toMs = Date.UTC(ty, tm - 1, td);
    const fromMs = Date.UTC(fy, fm - 1, fd);
    return Math.round((toMs - fromMs) / 86_400_000);
  }

  // Two-level review groups: supplier → manufacturer sub-group → lines
  const reviewGroups = Array.from(
    poLines.reduce(
      (supplierMap, line) => {
        if (!supplierMap.has(line.supplierId)) {
          supplierMap.set(line.supplierId, { supplierName: line.supplierName, mfgMap: new Map() });
        }
        const supplier = supplierMap.get(line.supplierId)!;
        const mk = mfgKey(line.supplierId, line.manufacturerId);
        if (!supplier.mfgMap.has(mk)) {
          supplier.mfgMap.set(mk, {
            manufacturerId: line.manufacturerId,
            manufacturerName: line.manufacturerName,
            lines: [],
          });
        }
        supplier.mfgMap.get(mk)!.lines.push({
          ...line,
          canSplit: line.conversionFactor > 1,
        });
        return supplierMap;
      },
      new Map<
        string,
        {
          supplierName: string;
          mfgMap: Map<string, { manufacturerId: number | null; manufacturerName: string | null; lines: (POLineState & { canSplit: boolean })[] }>;
        }
      >()
    )
  ).map(([supplierId, { supplierName, mfgMap }]) => ({
    supplierId,
    supplierName,
    mfgGroups: [...mfgMap.values()].sort((a, b) => {
      if (a.manufacturerId === null) return -1;
      if (b.manufacturerId === null) return 1;
      return (a.manufacturerName ?? "").localeCompare(b.manufacturerName ?? "");
    }),
  }));

  const { registerInput, createNavHandlers } = useQuantityKeyboardNav({
    reviewGroups,
    expandedReviewSuppliers,
    expandedReviewMfgs,
    onSplit: updateLinePerPiece,
  });

  // Guards
  if (!locationId) {
    return (
      <main className="p-4">
        <div className="py-16 text-center type-body text-muted-foreground">Redirecting…</div>
      </main>
    );
  }

  if (!supplierIdsParam) {
    return (
      <main className="p-4">
        <div className="py-16 text-center type-body text-muted-foreground">Redirecting…</div>
      </main>
    );
  }

  if (locationError) {
    return (
      <main className="space-y-3 p-4 text-center">
        <p className="type-body text-destructive">{locationError}</p>
        <a
          href="/location?module=replenishment&returnTo=%2Fsupplier%3FreturnTo%3D%2Freplenishment"
          className="type-body text-primary hover:underline"
        >
          Select a different location
        </a>
      </main>
    );
  }

  if (screen === "summary") {
    // Group results by supplier for the two-level success display
    const resultsBySupplier = Array.from(
      poResults
        .reduce((map, r) => {
          if (!map.has(r.supplierId)) {
            map.set(r.supplierId, { supplierName: r.supplierName, pos: [] });
          }
          map.get(r.supplierId)!.pos.push(r);
          return map;
        }, new Map<string, { supplierName: string; pos: PurchaseOrderResult[] }>())
        .entries()
    ).map(([supplierId, { supplierName, pos }]) => ({ supplierId, supplierName, pos }));

    return (
      <main className="mx-auto max-w-screen-lg space-y-6 p-4">
        <h1 className="type-page-title">Purchase Orders Created</h1>
        <div className="space-y-4">
          {resultsBySupplier.map((supplier) => (
            <div key={supplier.supplierId} className="overflow-hidden rounded-lg border border-success/30 bg-success/10">
              <div className="border-b border-success/20 bg-success/15 px-4 py-2">
                <span className="type-body font-semibold text-success">{supplier.supplierName}</span>
              </div>
              <table className="min-w-full text-sm">
                <thead className="border-b border-success/30 bg-success/15">
                  <tr>
                    <th className="px-4 py-3 text-left type-label text-success">Manufacturer</th>
                    <th className="px-4 py-3 text-left type-label text-success">PO Number</th>
                    <th className="px-4 py-3 text-right type-label text-success">Items Ordered</th>
                    <th className="px-4 py-3 text-center type-label text-success">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-success/20">
                  {supplier.pos.map((r) => (
                    <tr key={r.poNumber}>
                      <td className="px-4 py-3 text-foreground">
                        {r.manufacturerName ?? "No Brand"}
                      </td>
                      <td className="px-4 py-3 type-data font-semibold text-success">{r.poNumber}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        {r.itemCount} {r.itemCount === 1 ? "item" : "items"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            const runId = r.runId ?? draftRunId;
                            if (runId) {
                              window.open(`/history/replenishment/${runId}?printPo=${encodeURIComponent(r.poNumber)}`, "_blank");
                            }
                          }}
                          disabled={!r.runId && !draftRunId}
                        >
                          Print PO
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-4">
          <Button variant="secondary" onClick={handleOrderForDifferentSuppliers}>
            Order for different suppliers
          </Button>
          <Button onClick={handleDone}>Done</Button>
        </div>
      </main>
    );
  }

  if (screen === "po-review") {
    // Review has 10 columns (11 with safety stock): [empty] | SKU | Description | Unit | Period | Rounding | Suggested | [Safety] | Selling-area On-hand | Quantity | Action
    const reviewColSpan = 10 + (safetyStockEnabled ? 1 : 0);
    return (
      <main className="mx-auto max-w-screen-xl space-y-4 p-4 pb-28">
        <div className="flex items-center gap-3">
          <Button variant="link" size="sm" onClick={() => setScreen("replenishment")}>
            ← Back
          </Button>
          <h1 className="type-page-title">PO Review</h1>
        </div>

        {restoredFromSnapshot && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted px-3 py-2">
            <span className="type-caption text-muted-foreground">
              Restored unsaved review
              {restoredSavedAt &&
                ` · saved ${new Date(restoredSavedAt).toLocaleTimeString("en-PH", {
                  hour: "numeric",
                  minute: "2-digit",
                })}`}
            </span>
            <Button variant="link" size="sm" onClick={handleDiscardRestored}>
              Discard
            </Button>
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full text-sm">
            <thead className="border-b border-border bg-muted">
              <tr>
                <th className="w-8 px-3 py-2" />
                <th className={cn(TH, "text-left")}>SKU</th>
                <th className={cn(TH, "text-left whitespace-normal")}>Description</th>
                <th className={cn(TH, "text-left")}>Unit</th>
                <th className={cn(TH, "text-center")}>Period</th>
                <th className={cn(TH, "text-center")}>Rounding</th>
                <th className={cn(TH, "text-right")}>Suggested</th>
                {safetyStockEnabled && (
                  <th className={cn(TH, "text-right")}>Safety</th>
                )}
                <th className={cn(TH, "text-right")}>Selling-area On-hand</th>
                <th className={cn(TH, "text-right")}>Quantity</th>
                <th className={cn(TH, "text-center")}>Action</th>
              </tr>
            </thead>
            <tbody>
              {reviewGroups.map((group) => {
                const isSupplierExpanded = expandedReviewSuppliers.has(group.supplierId);
                const toggleSupplier = () =>
                  setExpandedReviewSuppliers((prev) => {
                    const next = new Set(prev);
                    if (next.has(group.supplierId)) next.delete(group.supplierId);
                    else next.add(group.supplierId);
                    return next;
                  });
                // Minimum indicator on Review: use final POLineState quantities.
                const reviewSupplierMin = supplierMinimums.get(group.supplierId);
                const reviewRunning = (() => {
                  if (!reviewSupplierMin || (reviewSupplierMin.minOrderValue == null && reviewSupplierMin.minOrderQuantity == null)) return null;
                  const supplierLines = poLines.filter((l) => l.supplierId === group.supplierId && l.path === "standard");
                  return computeSupplierRunning(supplierLines);
                })();
                // Estimated spend across every line for this supplier (all paths),
                // shown regardless of whether a minimum is configured.
                const supplierEstimated = computeSupplierRunning(
                  group.mfgGroups.flatMap((mfg) => mfg.lines),
                ).runningValue;
                return (
                  <Fragment key={group.supplierId}>
                    {/* Supplier header */}
                    <tr className="border-t border-border bg-muted">
                      <td colSpan={reviewColSpan} className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <button
                              onClick={toggleSupplier}
                              className="flex items-center gap-2 text-left"
                            >
                              {isSupplierExpanded ? (
                                <ChevronDown className="size-4" />
                              ) : (
                                <ChevronRight className="size-4" />
                              )}
                              {group.supplierName}
                            </button>
                            {reviewRunning && reviewSupplierMin && (
                              <span className="flex items-center gap-2 type-caption">
                                {reviewSupplierMin.minOrderValue != null && (
                                  <span className={cn(
                                    "whitespace-nowrap",
                                    reviewRunning.runningValue < reviewSupplierMin.minOrderValue
                                      ? "text-warning"
                                      : "text-muted-foreground"
                                  )}>
                                    {formatPeso(reviewRunning.runningValue)} / {formatPeso(reviewSupplierMin.minOrderValue)} min
                                  </span>
                                )}
                                {reviewSupplierMin.minOrderQuantity != null && (
                                  <span className={cn(
                                    "whitespace-nowrap",
                                    reviewRunning.runningQuantity < reviewSupplierMin.minOrderQuantity
                                      ? "text-warning"
                                      : "text-muted-foreground"
                                  )}>
                                    {reviewRunning.runningQuantity} / {reviewSupplierMin.minOrderQuantity} units min
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                          <span className="type-caption font-medium text-foreground whitespace-nowrap">
                            Est. {formatPeso(supplierEstimated)}
                          </span>
                        </div>
                      </td>
                    </tr>

                    {isSupplierExpanded &&
                      group.mfgGroups.map((mfg) => {
                        const mk = mfgKey(group.supplierId, mfg.manufacturerId);
                        const isMfgExpanded = expandedReviewMfgs.has(mk);
                        const toggleMfg = () =>
                          setExpandedReviewMfgs((prev) => {
                            const next = new Set(prev);
                            if (next.has(mk)) next.delete(mk);
                            else next.add(mk);
                            return next;
                          });
                        return (
                          <Fragment key={mk}>
                            {/* Manufacturer sub-group header — one PO per manufacturer */}
                            <tr className="border-t border-border bg-muted/60">
                              <td colSpan={reviewColSpan} className="px-3 py-2">
                                <div className="flex items-center justify-between gap-3">
                                  <button
                                    onClick={toggleMfg}
                                    className="flex items-center gap-2 text-left"
                                  >
                                    {isMfgExpanded ? (
                                      <ChevronDown className="size-4" />
                                    ) : (
                                      <ChevronRight className="size-4" />
                                    )}
                                    <span className="type-body font-medium text-foreground">
                                      {mfg.manufacturerName ?? "No Brand"}
                                    </span>
                                    <span className="type-caption text-muted-foreground whitespace-nowrap">
                                      {mfg.lines.length} {mfg.lines.length === 1 ? "item" : "items"}
                                    </span>
                                  </button>
                                  <span className="type-caption text-muted-foreground whitespace-nowrap">
                                    Est. {formatPeso(computeSupplierRunning(mfg.lines).runningValue)}
                                  </span>
                                </div>
                              </td>
                            </tr>

                            {isMfgExpanded &&
                              mfg.lines.map((line) => {
                                const split = computeSplitOrder(
                                  line.dailySalesRate,
                                  line.period,
                                  line.supplierLeadTime,
                                  line.effectiveAvailable,
                                  line.conversionFactor,
                                );
                                const baseSym = line.baseUnitSymbol || "pc";
                                const isSplit = line.orderedPerPiece === true;
                                // "Order by <pieces>" is offered only when a
                                // fractional-case remainder exists; a whole-number
                                // need can't be split.
                                const canSplit = line.conversionFactor > 1;
                                // Safety-inclusive split for the toggle label/tooltip:
                                // the order (raw need + safety) rounded up to whole pieces.
                                const splitNeed = split.need + line.safetyStockUnits;
                                const splitFactor = Math.round(line.conversionFactor);
                                const splitTotalPieces = Math.max(0, Math.ceil(splitNeed * splitFactor - 1e-9));
                                const splitCases = Math.floor(splitTotalPieces / splitFactor);
                                const splitPieces = splitTotalPieces - splitCases * splitFactor;
                                return (
                                  <Fragment key={line.sku}>
                                    {/* Cases line */}
                                    <tr className="border-t border-border/60 hover:bg-muted/60">
                                      <td />
                                      <td className="px-3 py-2 type-data text-muted-foreground">
                                        {line.sku}
                                      </td>
                                      <td className="px-3 py-2 text-foreground">
                                        {line.description}
                                      </td>
                                      <td className="px-3 py-2 type-data text-muted-foreground">
                                        {line.unitSymbol}
                                      </td>
                                      <td className="px-3 py-2">
                                        <div className="flex justify-center">
                                          <div className={SEG_TRACK}>
                                            {PERIODS.map((p) => (
                                              <button
                                                key={p.days}
                                                onClick={() => updateLinePeriod(line.sku, p.days)}
                                                className={seg(line.period === p.days, true)}
                                              >
                                                {p.label}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-3 py-2">
                                        <div className="flex justify-center">
                                          <div className={cn(SEG_TRACK)}>
                                            {[
                                              { label: "↑Up", value: true },
                                              { label: "↓Dn", value: false },
                                            ].map(({ label, value }) => (
                                              <button
                                                key={String(value)}
                                                onClick={() => updateLineRoundUp(line.sku, value)}
                                                className={seg(line.roundUp === value, true)}
                                              >
                                                {label}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                                          {line.suggestedQty}
                                        </td>
                                        {safetyStockEnabled && (
                                          <td className="px-3 py-2 text-right">
                                            {safetyStockMode === "days" ? (
                                              <span className="tabular-nums text-muted-foreground">
                                                {line.safetyStockUnits.toFixed(2)}
                                              </span>
                                            ) : (
                                              <Input
                                                type="number"
                                                min={0}
                                                step={1}
                                                value={line.safetyStockPercent}
                                                onChange={(e) =>
                                                  updateLineSafetyStock(
                                                    line.sku,
                                                    Math.max(0, Math.trunc(Number(e.target.value)) || 0),
                                                  )
                                                }
                                                className="h-9 min-h-9 w-20 px-2 py-1 text-right tabular-nums"
                                                title="Safety stock percentage of suggested qty"
                                              />
                                            )}
                                          </td>
                                        )}
                                        {line.path === "standard" ? (
                                          <td className="px-3 py-2 text-right">
                                            <Input
                                              ref={registerInput(`shelf:${line.sku}`)}
                                              type="number"
                                              min={0}
                                              step={1}
                                              value={line.shelfOnHand ?? ""}
                                              placeholder="—"
                                              onChange={(e) =>
                                                updateLineShelfOnHand(line.sku, e.target.value)
                                              }
                                              className="h-9 min-h-9 w-20 px-2 py-1 text-right tabular-nums"
                                              title="Manually counted selling-area stock, added to effective available"
                                              {...createNavHandlers(`shelf:${line.sku}`)}
                                            />
                                          </td>
                                        ) : (
                                          <td />
                                        )}
                                        <td className="px-3 py-2 text-right">
                                          <div className="flex items-center justify-end">
                                            <Input
                                              ref={registerInput(`case:${line.sku}`)}
                                              type="number"
                                              min={0}
                                              step={1}
                                              value={line.quantity}
                                            onChange={(e) =>
                                              updateLineQuantity(
                                                line.sku,
                                                Math.max(0, Math.trunc(Number(e.target.value)) || 0),
                                              )
                                            }
                                            className="h-9 min-h-9 w-20 px-2 py-1 text-right tabular-nums"
                                            {...createNavHandlers(`case:${line.sku}`)}
                                          />
                                        </div>
                                      </td>
                                      <td className="px-3 py-2">
                                        <div className="flex justify-center">
                                          {canSplit && !isSplit && (
                                            <TooltipProvider>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <button
                                                    onClick={() => updateLinePerPiece(line.sku, true)}
                                                    className="inline-flex h-9 min-h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground motion-safe:active:scale-95"
                                                    aria-label="Split order into cases and pieces"
                                                  >
                                                    <GitBranch className="size-4" />
                                                  </button>
                                                </TooltipTrigger>
                                                <TooltipContent className="max-w-60">
                                                  Real suggested order is {splitNeed.toFixed(2)} {line.unitSymbol}.
                                                  You can split the order into {splitCases} {line.unitSymbol} + {splitPieces} {baseSym}.
                                                </TooltipContent>
                                              </Tooltip>
                                            </TooltipProvider>
                                          )}
                                        </div>
                                      </td>
                                    </tr>

                                    {/* Pieces line — split remainder, written as its
                                        own ActiveOne line for the same item. */}
                                    {isSplit && (
                                      <tr className="border-t border-border/40 bg-muted/20 hover:bg-muted/60">
                                        <td />
                                        <td className="px-3 py-2 type-data text-muted-foreground">
                                          {line.sku}
                                        </td>
                                        <td className="px-3 py-2 text-muted-foreground">
                                          <span className="text-muted-foreground/70">↳ </span>
                                          {line.description}
                                        </td>
                                        <td className="px-3 py-2 type-data text-muted-foreground">
                                          {baseSym}
                                        </td>
                                        <td />
                                        <td />
                                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                                          {line.suggestedPieceQty}
                                        </td>
                                        {safetyStockEnabled && (
                                          <td className="px-3 py-2 text-right">
                                            {safetyStockMode === "days" ? (
                                              <span className="tabular-nums text-muted-foreground">
                                                {line.safetyStockUnits.toFixed(2)}
                                              </span>
                                            ) : (
                                              <Input
                                                type="number"
                                                min={0}
                                                step={1}
                                                value={line.safetyStockPercent}
                                                onChange={(e) =>
                                                  updateLineSafetyStock(
                                                    line.sku,
                                                    Math.max(0, Math.trunc(Number(e.target.value)) || 0),
                                                  )
                                                }
                                                className="h-9 min-h-9 w-20 px-2 py-1 text-right tabular-nums"
                                                title="Safety stock percentage of suggested qty"
                                              />
                                            )}
                                          </td>
                                        )}
                                        <td />
                                        <td className="px-3 py-2 text-right">
                                          <div className="flex items-center justify-end">
                                             <Input
                                              ref={registerInput(`piece:${line.sku}`)}
                                              type="number"
                                              min={0}
                                              step={1}
                                              value={line.pieceQty}
                                              onChange={(e) =>
                                                updateLinePieceQty(
                                                  line.sku,
                                                  Math.max(0, Math.trunc(Number(e.target.value)) || 0),
                                                )
                                              }
                                              className="h-9 min-h-9 w-20 px-2 py-1 text-right tabular-nums"
                                              {...createNavHandlers(`piece:${line.sku}`)}
                                            />
                                          </div>
                                        </td>
                                        <td className="px-3 py-2">
                                          <div className="flex justify-end">
                                            <button
                                              onClick={() => updateLinePerPiece(line.sku, false)}
                                              aria-label="Order by case unit"
                                              className="inline-flex h-9 min-h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground motion-safe:active:scale-95"
                                            >
                                              <Package className="size-4" />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </Fragment>
                                );
                              })}
                          </Fragment>
                        );
                      })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {poError && (
          <div className="rounded-lg border border-critical/30 bg-critical/10 px-4 py-3 type-body text-critical">
            {poError}
          </div>
        )}

        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background p-4">
          {draftSaveResult && draftSaveResult.type === "error" && (
            <div className="mx-auto max-w-screen-xl px-4 mb-2">
              <p className="type-body text-destructive">
                {draftSaveResult.text}
              </p>
            </div>
          )}
          <div className="mx-auto flex max-w-screen-xl flex-wrap items-center justify-between gap-3 px-4">
            <div className="type-body">
              <span className="text-muted-foreground">Estimated total (pre-tax): </span>
              <span className="font-semibold text-foreground">
                {formatPeso(computeSupplierRunning(poLines).runningValue)}
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleSaveDraftClick} disabled={submitting || draftSaving}>
                {draftSaving ? "Saving…" : "Save as Draft"}
              </Button>
              {!requireApproval && (
                <Button onClick={handleSubmitPO} disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit PO"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Below-minimum acknowledgment dialog (Standard only, advisory) */}
        <Dialog open={belowMinDialog !== null} onOpenChange={(open) => { if (!open) setBelowMinDialog(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Order below minimum</DialogTitle>
              <DialogDescription>
                The following suppliers have orders below their configured minimums.
                You can still {belowMinDialog?.action === "draft" ? "save this draft" : "submit"} — this is advisory only.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {belowMinDialog?.suppliersBelow.map((s) => (
                <div key={s.supplierId} className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 space-y-0.5">
                  <p className="type-body font-medium text-warning">{s.supplierName}</p>
                  {s.minOrderValue != null && (
                    <p className="type-caption">
                      ₱ value: {formatPeso(s.runningValue)} of {formatPeso(s.minOrderValue)} min
                      {s.runningValue < s.minOrderValue && (
                        <span className="text-warning"> (short {formatPeso(s.minOrderValue - s.runningValue)})</span>
                      )}
                    </p>
                  )}
                  {s.minOrderQuantity != null && (
                    <p className="type-caption">
                      Qty: {s.runningQuantity} of {s.minOrderQuantity} units min
                      {s.runningQuantity < s.minOrderQuantity && (
                        <span className="text-warning"> (short {s.minOrderQuantity - s.runningQuantity} units)</span>
                      )}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setBelowMinDialog(null)}>Cancel</Button>
              <Button onClick={handleBelowMinConfirm} disabled={submitting || draftSaving}>
                {belowMinDialog?.action === "draft"
                  ? (draftSaving ? "Saving…" : "Save anyway")
                  : (submitting ? "Submitting…" : "Submit anyway")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Draft saved success dialog */}
        <Dialog open={showDraftSavedModal} onOpenChange={setShowDraftSavedModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Draft saved</DialogTitle>
              <DialogDescription>
                Your replenishment draft has been saved successfully.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setShowDraftSavedModal(false)}>Close</Button>
              <Button onClick={handlePlanAnotherRun}>Plan another run</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: letter portrait;
            margin: 12mm;
          }

          /* Hide all non-worksheet content */
          body > * { display: none !important; }
          body > *:has(.worksheet-report) { display: block !important; }
          .worksheet-report { display: block !important; }

          .worksheet-report {
            color: #000;
            background: #fff;
          }

          .worksheet-report * {
            color: #000 !important;
            background: transparent !important;
          }

          /* Document header — flows once at the top (no fixed running header/footer) */
          .worksheet-doc-header {
            margin-bottom: 6mm;
            border-bottom: 1px solid #000;
            padding-bottom: 3mm;
          }
          .worksheet-doc-title {
            font-size: 14pt;
            font-weight: bold;
            margin-bottom: 1.5mm;
          }
          /* Location + suppliers — prominent, at the very top beside the title line */
          .worksheet-top-scope {
            display: flex;
            flex-wrap: wrap;
            gap: 1mm 8mm;
            font-size: 9pt;
            margin-bottom: 2mm;
          }
          .worksheet-meta-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 2mm 8mm;
            font-size: 8pt;
            margin-bottom: 2mm;
          }
          .worksheet-printed-line {
            font-size: 7pt;
            color: #444;
            margin-top: 2mm;
          }

          /* Manufacturer sub-group sections — flow continuously, one after another
             (no forced page break), like History's per-PO sections. */
          .worksheet-section {
            margin-top: 5mm;
            break-inside: auto;
          }
          .worksheet-section-header {
            font-size: 9pt;
            font-weight: bold;
            border-bottom: 1px solid #000;
            padding-bottom: 1mm;
            margin-bottom: 0;
            break-after: avoid;
          }

          /* Tables — fixed layout + a shared colgroup give every section identical
             column widths so they align down the page. */
          .worksheet-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: 8pt;
            margin-bottom: 2mm;
          }
          .worksheet-table thead {
            display: table-header-group;
          }
          .worksheet-table tr {
            break-inside: avoid;
          }
          .worksheet-th-left,
          .worksheet-th-right {
            border-bottom: 1px solid #000;
            padding: 1mm 2mm;
            font-weight: bold;
            font-size: 7.5pt;
          }
          .worksheet-th-left { text-align: left; }
          .worksheet-th-right { text-align: right; }

          .worksheet-td-left,
          .worksheet-td-right {
            border-bottom: 1px solid #ccc;
            padding: 1.5mm 2mm;
            font-size: 8pt;
            overflow-wrap: break-word;
          }
          .worksheet-td-left { text-align: left; }
          .worksheet-td-right { text-align: right; }
          .worksheet-td-barcode { white-space: nowrap; font-weight: bold; }
          .worksheet-td-desc { font-weight: bold; }
          .worksheet-suggested { font-weight: 600; }

          /* Blank write-in column — underline sized for handwriting */
          .worksheet-td-blank {
            border-bottom: 1px solid #000;
            height: 6mm;
          }

          .worksheet-legend {
            margin-top: 3mm;
            font-size: 7.5pt;
          }
          .worksheet-empty {
            margin-top: 6mm;
            font-size: 9pt;
          }

          /* Stockout section — printed last, separated from standard items. */
          .worksheet-stockout {
            margin-top: 6mm;
            padding-top: 3mm;
            border-top: 2px solid #000;
          }
          .worksheet-stockout-header {
            margin-bottom: 4mm;
            break-after: avoid;
          }
          .worksheet-stockout-title {
            font-size: 12pt;
            font-weight: bold;
          }
        }
      `}</style>

      <main className="mx-auto max-w-screen-xl space-y-4 p-4 pb-28 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="type-body flex-shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Home
          </Link>
          <div className="flex items-baseline gap-3">
            <h1 className="type-page-title">Replenishment</h1>
            {locationName && (
              <span className="type-body text-muted-foreground">— {locationName}</span>
            )}
          </div>
          {locationId && supplierIdsParam && (
            <div className="flex items-center gap-4">
              <Link
                href={`/supplier?returnTo=${encodeURIComponent(`/replenishment?locationId=${locationId}`)}`}
                className="type-label px-2 py-3 text-primary hover:underline"
              >
                Change suppliers
              </Link>
              <Link
                href={`/location?module=replenishment&returnTo=${encodeURIComponent(
                  `/replenishment?supplierIds=${encodeURIComponent(supplierIdsParam)}`
                )}`}
                className="type-label px-2 py-3 text-primary hover:underline"
              >
                Change location
              </Link>
            </div>
          )}
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
          <button
            onClick={() => setActiveTab("standard")}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition-colors",
              activeTab === "standard"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Standard
          </button>
          <button
            onClick={() => setActiveTab("stockout")}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition-colors",
              activeTab === "stockout"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Stockout
          </button>
        </div>
      </div>

      {/* FR-21: Manufacturers filter indicator + Change link — hidden when no filter active. */}
      {manufacturerPairs && locationId && supplierIdsParam && (
        <div className="flex flex-wrap items-center gap-2 type-caption text-muted-foreground">
          <span>
            Manufacturers: {manufacturerPairs.length} of {manufacturerTotal ?? "…"}
          </span>
          <Link
            href={`/manufacturer?returnTo=%2Freplenishment&locationId=${locationId}&supplierIds=${encodeURIComponent(
              supplierIdsParam
            )}&manufacturerIds=${encodeURIComponent(manufacturerIdsParam ?? "")}`}
            className="type-label text-primary hover:underline"
          >
            Change
          </Link>
        </div>
      )}

      {/* Controls bar */}
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-muted/50 p-4">
        {activeTab === "standard" && (
          <>
            <div className="flex flex-col gap-1">
              <label className="type-label text-muted-foreground">From</label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                onClick={(e) =>
                  (e.target as HTMLInputElement & { showPicker?: () => void }).showPicker?.()
                }
                className="w-auto cursor-pointer"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="type-label text-muted-foreground">To</label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                onClick={(e) =>
                  (e.target as HTMLInputElement & { showPicker?: () => void }).showPicker?.()
                }
                className="w-auto cursor-pointer"
              />
</div>
           </>
         )}
         {activeTab === "standard" && (
           <div className="flex flex-col gap-1">
             <span className="type-label text-muted-foreground">Quick Range</span>
             <div className={cn(SEG_TRACK, "w-fit")}>
               {(Object.entries(DATE_PRESETS) as [keyof typeof DATE_PRESETS, typeof DATE_PRESETS[keyof typeof DATE_PRESETS]][]).map(([key, preset]) => (
                 <button
                   key={key}
                   type="button"
                   onClick={() => {
                     const fromDate = daysAgo(preset.days);
                     const toDate = today();
                     setFrom(fromDate);
                     setTo(toDate);
                   }}
                   className={seg(differenceInDays(to, from) === preset.days)}
                 >
                   {preset.label}
                 </button>
               ))}
             </div>
           </div>
         )}
         <div className="flex flex-col gap-1">
          <span className="type-label text-muted-foreground">Order Period</span>
          <div className={cn(SEG_TRACK, "w-fit")}>
            {PERIODS.map((p) => (
              <button
                key={p.days}
                onClick={() => handleGlobalPeriodChange(p.days)}
                className={seg(globalPeriod === p.days)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="type-label text-muted-foreground">Rounding</span>
          <div className={cn(SEG_TRACK, "w-fit")}>
            {[
              { label: "↑ Up", value: true },
              { label: "↓ Down", value: false },
            ].map(({ label, value }) => (
              <button
                key={String(value)}
                onClick={() => setGlobalRoundUp(value)}
                className={seg(globalRoundUp === value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {activeTab === "standard" && (
          <>
            <Button
              variant={dateFilterDirty ? "primary" : "secondary"}
              onClick={() => {
                setAppliedFrom(from);
                setAppliedTo(to);
                fetchGroups(from, to, globalPeriod, globalRoundUp);
              }}
              disabled={loading}
              className="ml-auto min-h-12 gap-2 self-end"
            >
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
              Refresh
            </Button>
            {dateFilterDirty && !loading && (
              <p className="basis-full type-label text-warning">
                Date range changed — tap Refresh to apply the new filter.
              </p>
            )}
          </>
        )}
        {activeTab === "stockout" && (
          <p className="ml-auto self-end type-caption text-muted-foreground">
            Stockout items are opt-in — check the items you want to reorder.
          </p>
        )}
      </div>

      {/* Item search — filters the active tab's list to SKU/description matches */}
      {((activeTab === "standard" && !loading && groups.length > 0) ||
        (activeTab === "stockout" && !stockoutLoading && !stockoutError && stockoutGroups.length > 0)) && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            inputMode="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items by name or SKU…"
            className="pl-9 pr-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted motion-safe:active:scale-95"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      )}

      {/* Standard tab */}
      {activeTab === "standard" && (
        <>
          {!loading && groups.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="link"
                size="sm"
                onClick={allStandardGroupsExpanded ? collapseAllStandard : expandAllStandard}
              >
                {allStandardGroupsExpanded ? "Collapse All" : "Expand All"}
              </Button>
              <span className="text-muted-foreground/40">·</span>
              <Button variant="link" size="sm" onClick={toggleSelectAllStandard}>
                {allStandardVisibleSelected ? "Deselect All" : "Select All"}
              </Button>
            </div>
          )}

          {loading && <ReplenishmentSkeleton showIncoming={showIncoming} />}

          {!loading && groups.length === 0 && (
            <div className="py-16 text-center type-body text-muted-foreground">
              No items need ordering for the selected period and date range.<br />
              Try a longer order period or adjusting the date range.
            </div>
          )}

          {!loading && groups.length > 0 && standardSearchMatchCount === 0 && (
            <div className="py-16 text-center type-body text-muted-foreground">
              No items match “{search.trim()}”.
            </div>
          )}

          {!loading && groups.length > 0 && standardSearchMatchCount > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="min-w-full text-sm">
                <thead className="border-b border-border bg-muted">
                  <tr>
                    <th className="w-8 px-3 py-2" />
                    <th className={cn(TH, "text-left")}>SKU</th>
                    <th className={cn(TH, "text-left whitespace-normal")}>Description</th>
                    <th className={cn(TH, "text-left")}>Unit</th>
                    <th className={cn(TH, "text-right")}>On-Hand</th>
                    {showIncoming && (
                      <th className={cn(TH, "text-right")}>Incoming</th>
                    )}
                    <th className={cn(TH, "text-right")}>Under served</th>
                    <th className={cn(TH, "text-right")}>Total Stock</th>
                    <th className={cn(TH, "text-right")}>Daily Rate</th>
                    <th className={cn(TH, "text-right")}>Added Rate</th>
                    <th className={cn(TH, "text-right")}>DOS</th>
                    {safetyStockEnabled && (
                      <th className={cn(TH, "text-right")}>Safety</th>
                    )}
                    <th className={cn(TH, "text-right")}>Suggested</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => {
                    const stdColSpan = (showIncoming ? 11 : 10) + (safetyStockEnabled ? 1 : 0);
                    const mfgGroups = groupByMfg(group.items);
                    // Compute visible items per mfg sub-group using that sub-group's period
                    const mfgGroupsWithVisible = mfgGroups
                      .map((mfg) => {
                        const period = getMfgPeriod(group.supplierId, mfg.manufacturerId);
                        const visibleItems = mfg.items.filter((item) => {
                          const effective = item.availableStock + item.incoming;
                          const rawNeed = item.dailySalesRate * (period + item.supplierLeadTime) - effective;
                          // Visible if there is a positive combined need (raw + safety)
                          // (includes sub-case items surfaced under round-down) or if
                          // showAllItems is on (zero-need items appear unchecked).
                          return (
                            (showAllItems || rawNeed + item.safetyStockUnits > 0) &&
                            matchesQuery(searchQuery, item.sku, item.description)
                          );
                        });
                        return { ...mfg, visibleItems, period };
                      })
                      .filter((mfg) => mfg.visibleItems.length > 0);

                    if (mfgGroupsWithVisible.length === 0) return null;

                    const allVisibleSkus = mfgGroupsWithVisible.flatMap((mfg) =>
                      mfg.visibleItems.map((i) => i.sku)
                    );
                    const groupCheckedCount = allVisibleSkus.filter((s) => selectedStandard.has(s)).length;
                    const groupChecked = groupCheckedCount === allVisibleSkus.length && allVisibleSkus.length > 0;
                    const groupIndeterminate = groupCheckedCount > 0 && groupCheckedCount < allVisibleSkus.length;
                    const criticalCount = mfgGroupsWithVisible.flatMap((mfg) => mfg.visibleItems).filter((i) => i.isCritical).length;
                    const isGroupExpanded = expandedStandardGroups.has(group.supplierId);

                    // Compute the minimum indicator for this supplier on the main list.
                    // Uses each checked item's current-period suggestion (case lines only).
                    const supplierMin = supplierMinimums.get(group.supplierId);
                    const mainListRunning = (() => {
                      if (!supplierMin || (supplierMin.minOrderValue == null && supplierMin.minOrderQuantity == null)) return null;
                      let rv = 0; let rq = 0;
                      for (const mfg of mfgGroupsWithVisible) {
                        for (const item of mfg.visibleItems) {
                          if (!selectedStandard.has(item.sku)) continue;
                          const effective = item.availableStock + item.incoming;
                          const qty = computeSuggestion(item.dailySalesRate, mfg.period, item.supplierLeadTime, effective, globalRoundUp, item.safetyStockUnits);
                          rv += qty * item.unitCost * item.conversionFactor;
                          rq += qty;
                        }
                      }
                      return { runningValue: rv, runningQuantity: rq };
                    })();

                    return (
                      <Fragment key={group.supplierId}>
                        {/* Supplier header — no period selector (moved to mfg sub-group level) */}
                        <tr className="border-t border-border bg-muted">
                          <td className="px-3 py-2.5 text-center">
                            <Checkbox
                              checked={groupIndeterminate ? "indeterminate" : groupChecked}
                              onCheckedChange={() => toggleStandardGroup(group)}
                              className="mx-auto"
                            />
                          </td>
                          <td colSpan={stdColSpan} className="px-3 py-2.5">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <button
                                onClick={() => toggleExpandStandardGroup(group.supplierId)}
                                className="flex items-center gap-2 text-left"
                              >
                                {isGroupExpanded ? (
                                  <ChevronDown className="size-4" />
                                ) : (
                                  <ChevronRight className="size-4" />
                                )}
                                <span className="type-body font-semibold text-foreground">
                                  {group.supplierName}
                                </span>
                                {(group.dueStatus === "due_today" || group.dueStatus === "due_tomorrow") && (
                                  <Badge variant="warning">Due</Badge>
                                )}
                                <span className="type-caption whitespace-nowrap">
                                  {allVisibleSkus.length}{" "}
                                  {allVisibleSkus.length === 1 ? "item" : "items"}
                                </span>
                                <span className="type-caption whitespace-nowrap">
                                  · {group.leadTimeDays}d lead time
                                </span>
                                {criticalCount > 0 && (
                                  <span className="type-label whitespace-nowrap text-critical">
                                    · {criticalCount} critical
                                  </span>
                                )}
                              </button>
                              {mainListRunning && supplierMin && (
                                <span className="flex items-center gap-2 type-caption">
                                  {supplierMin.minOrderValue != null && (
                                    <span className={cn(
                                      "whitespace-nowrap",
                                      mainListRunning.runningValue < supplierMin.minOrderValue
                                        ? "text-warning"
                                        : "text-muted-foreground"
                                    )}>
                                      {formatPeso(mainListRunning.runningValue)} / {formatPeso(supplierMin.minOrderValue)} min
                                    </span>
                                  )}
                                  {supplierMin.minOrderQuantity != null && (
                                    <span className={cn(
                                      "whitespace-nowrap",
                                      mainListRunning.runningQuantity < supplierMin.minOrderQuantity
                                        ? "text-warning"
                                        : "text-muted-foreground"
                                    )}>
                                      {mainListRunning.runningQuantity} / {supplierMin.minOrderQuantity} units min
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>

                        {isGroupExpanded &&
                          mfgGroupsWithVisible.map((mfg) => {
                            const mk = mfgKey(group.supplierId, mfg.manufacturerId);
                            const isMfgExpanded = expandedStandardMfgs.has(mk);
                            const mfgSkus = mfg.visibleItems.map((i) => i.sku);
                            const mfgCheckedCount = mfgSkus.filter((s) => selectedStandard.has(s)).length;
                            const mfgChecked = mfgCheckedCount === mfgSkus.length && mfgSkus.length > 0;
                            const mfgIndeterminate = mfgCheckedCount > 0 && mfgCheckedCount < mfgSkus.length;
                            const mfgCriticalCount = mfg.visibleItems.filter((i) => i.isCritical).length;

                            return (
                              <Fragment key={mk}>
                                {/* Manufacturer sub-group header */}
                                <tr className="border-t border-border/60 bg-muted/50">
                                  <td className="px-3 py-2 text-center">
                                    <Checkbox
                                      checked={mfgIndeterminate ? "indeterminate" : mfgChecked}
                                      onCheckedChange={() => toggleStandardMfgGroup(mfg.visibleItems)}
                                      className="mx-auto"
                                    />
                                  </td>
                                  <td colSpan={stdColSpan} className="px-3 py-2">
                                    <div className="flex items-center justify-between gap-4">
                                      <button
                                        onClick={() => toggleExpandStandardMfg(mk)}
                                        className="flex min-w-0 items-center gap-2 text-left"
                                      >
                                        {isMfgExpanded ? (
                                          <ChevronDown className="size-4" />
                                        ) : (
                                          <ChevronRight className="size-4" />
                                        )}
                                        <span className="type-body font-medium text-foreground">
                                          {mfg.manufacturerName ?? "No Brand"}
                                        </span>
                                        <span className="type-caption whitespace-nowrap text-muted-foreground">
                                          {mfg.visibleItems.length}{" "}
                                          {mfg.visibleItems.length === 1 ? "item" : "items"}
                                        </span>
                                        {mfgCriticalCount > 0 && (
                                          <span className="type-label whitespace-nowrap text-critical">
                                            · {mfgCriticalCount} critical
                                          </span>
                                        )}
                                      </button>
                                      <div
                                        className={cn(SEG_TRACK, "shrink-0")}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {PERIODS.map((p) => (
                                          <button
                                            key={p.days}
                                            onClick={() =>
                                              handleMfgPeriodChange(group.supplierId, mfg.manufacturerId, p.days)
                                            }
                                            className={seg(mfg.period === p.days)}
                                          >
                                            {p.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </td>
                                </tr>

                                {isMfgExpanded &&
                                  mfg.visibleItems.map((item) => {
                                    const isSelected = selectedStandard.has(item.sku);
                                    const effective = item.availableStock + item.incoming;
                                    const suggested = computeSuggestion(
                                      item.dailySalesRate,
                                      mfg.period,
                                      item.supplierLeadTime,
                                      effective,
                                      globalRoundUp,
                                      item.safetyStockUnits
                                    );
const isSubCase = suggested === 0;
                                     return (
                                      <tr
                                        key={item.sku}
                                        onClick={() => toggleStandardItem(item.sku)}
                                        className="cursor-pointer border-t border-border/60 transition-colors hover:bg-muted/60"
                                      >
                                        <td
                                          className="h-12 px-3 py-2 text-center"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={() => toggleStandardItem(item.sku)}
                                            className="mx-auto"
                                          />
                                        </td>
                                        <td className="px-3 py-2 type-data text-muted-foreground">
                                          <Highlight text={item.sku} query={searchQuery} />
                                        </td>
                                        <td className="px-3 py-2 text-foreground">
                                          <div className="flex flex-wrap gap-2">
                                            <span><Highlight text={item.description} query={searchQuery} /></span>
                                            {item.isCritical && (
                                              <Badge variant="critical">Critical</Badge>
                                            )}
                                          </div>
                                        </td>
                                        <td className="px-3 py-2 type-data text-muted-foreground">
                                          {item.unitSymbol}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                                          {item.availableStock.toFixed(2)}
                                        </td>
                                        {showIncoming && (
                                          <td className="px-3 py-2 text-right tabular-nums">
                                            {item.incoming > 0 ? (
                                              <span className="text-incoming">
                                                +{item.incoming.toFixed(2)}
                                              </span>
                                            ) : (
                                              <span className="text-muted-foreground/50">—</span>
                                            )}
                                          </td>
                                        )}
                                        <td className="px-3 py-2 text-right tabular-nums">
                                          {item.underservedQuantity > 0 ? (
                                            <span className="text-warning">
                                              {item.underservedQuantity.toFixed(2)}
                                            </span>
                                          ) : (
                                            <span className="text-muted-foreground/50">—</span>
                                          )}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                                          {effective.toFixed(2)}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                                          {item.dailySalesRate.toFixed(2)}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                                          {item.sellingAreaDemand > 0 ? (
                                            <TooltipProvider>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <span
                                                    className="cursor-default underline decoration-dotted"
                                                  >
                                                    {item.sellingAreaDemand.toFixed(2)}
                                                  </span>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  {item.sellingAreaNames.join(", ")}
                                                </TooltipContent>
                                              </Tooltip>
                                            </TooltipProvider>
                                          ) : (
                                            <span className="text-muted-foreground/40">—</span>
                                          )}
                                        </td>
                                        <td
                                          className={cn(
                                            "px-3 py-2 text-right font-medium tabular-nums",
                                            item.isCritical ? "text-critical" : "text-foreground"
                                          )}
                                        >
                                          {item.daysOfSupply ?? "—"}
                                        </td>
                                        {safetyStockEnabled && (
                                          <td className="px-3 py-2 text-right tabular-nums type-data text-muted-foreground">
                                            {item.safetyStockUnits > 0 ? (
                                              item.safetyStockUnits.toFixed(2)
                                            ) : (
                                              "—"
                                            )}
                                          </td>
                                        )}
<td className="px-3 py-2 text-right font-semibold tabular-nums text-primary">
                                           {isSubCase ? (
                                             <span className="tabular-nums">0</span>
                                           ) : (
                                             suggested
                                           )}
                                         </td>
                                      </tr>
                                    );
                                  })}
                              </Fragment>
                            );
                          })}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Stockout tab */}
      {activeTab === "stockout" && (
        <>
          {!stockoutLoading && !stockoutError && stockoutGroups.length > 0 && (
            <div className="flex items-center">
              <Button
                variant="link"
                size="sm"
                onClick={allStockoutGroupsExpanded ? collapseAllStockout : expandAllStockout}
              >
                {allStockoutGroupsExpanded ? "Collapse All" : "Expand All"}
              </Button>
            </div>
          )}

          {stockoutLoading && <StockoutSkeleton />}

          {stockoutError && (
            <div className="py-8 text-center">
              <p className="type-body text-destructive mb-3">{stockoutError}</p>
              <Button variant="secondary" size="sm" onClick={fetchStockoutCandidates}>
                Retry
              </Button>
            </div>
          )}

          {!stockoutLoading && !stockoutError && stockoutFetched && stockoutGroups.length === 0 && (
            <div className="py-16 text-center type-body text-muted-foreground">
              No stocked-out items with sales history at this location.
            </div>
          )}

          {!stockoutLoading && !stockoutError && stockoutGroups.length > 0 && stockoutSearchMatchCount === 0 && (
            <div className="py-16 text-center type-body text-muted-foreground">
              No items match “{search.trim()}”.
            </div>
          )}

          {!stockoutLoading && !stockoutError && stockoutGroups.length > 0 && stockoutSearchMatchCount > 0 && (
            <>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="min-w-full text-sm">
                  <thead className="border-b border-border bg-muted">
                    <tr>
                      <th className="w-8 px-3 py-2" />
                      <th className={cn(TH, "text-left")}>SKU</th>
                      <th className={cn(TH, "text-left whitespace-normal")}>Description</th>
                      <th className={cn(TH, "text-left")}>Unit</th>
                      <th className={cn(TH, "text-right")}>Last Sold</th>
                      <th className={cn(TH, "text-right")}>Daily Rate</th>
                      <th className={cn(TH, "text-right")}>30d Units</th>
                      <th className={cn(TH, "text-right")}>Suggested</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockoutGroups.map((group) => {
                      const mfgGroups = groupByMfg(group.items);
                      const mfgGroupsWithVisible = mfgGroups
                        .map((mfg) => {
                          const period = getMfgPeriod(group.supplierId, mfg.manufacturerId);
                          const visibleItems = mfg.items.filter(
                            (item) =>
                              item.dailySalesRate * (period + item.supplierLeadTime) > 0 &&
                              matchesQuery(searchQuery, item.sku, item.description)
                          );
                          return { ...mfg, visibleItems, period };
                        })
                        .filter((mfg) => mfg.visibleItems.length > 0);

                      if (mfgGroupsWithVisible.length === 0) return null;

                      const allVisibleSkus = mfgGroupsWithVisible.flatMap((mfg) =>
                        mfg.visibleItems.map((i) => i.sku)
                      );
                      const groupCheckedCount = allVisibleSkus.filter((s) => selectedStockout.has(s)).length;
                      const groupChecked = groupCheckedCount === allVisibleSkus.length && allVisibleSkus.length > 0;
                      const groupIndeterminate = groupCheckedCount > 0 && groupCheckedCount < allVisibleSkus.length;
                      const isGroupExpanded = expandedStockoutGroups.has(group.supplierId);

                      return (
                        <Fragment key={group.supplierId}>
                          {/* Supplier header */}
                          <tr className="border-t border-border bg-muted">
                            <td className="px-3 py-2.5 text-center">
                              <Checkbox
                                checked={groupIndeterminate ? "indeterminate" : groupChecked}
                                onCheckedChange={() => toggleStockoutGroup(group)}
                                className="mx-auto"
                              />
                            </td>
                            <td colSpan={7} className="px-3 py-2.5">
                              <button
                                onClick={() => toggleExpandStockoutGroup(group.supplierId)}
                                className="flex items-center gap-2 text-left"
                              >
                                {isGroupExpanded ? (
                                  <ChevronDown className="size-4" />
                                ) : (
                                  <ChevronRight className="size-4" />
                                )}
                                <span className="type-body font-semibold text-foreground">
                                  {group.supplierName}
                                </span>
                                <span className="type-caption whitespace-nowrap">
                                  {allVisibleSkus.length}{" "}
                                  {allVisibleSkus.length === 1 ? "item" : "items"}
                                </span>
                              </button>
                            </td>
                          </tr>

                          {isGroupExpanded &&
                            mfgGroupsWithVisible.map((mfg) => {
                              const mk = mfgKey(group.supplierId, mfg.manufacturerId);
                              const isMfgExpanded = expandedStockoutMfgs.has(mk);
                              const mfgSkus = mfg.visibleItems.map((i) => i.sku);
                              const mfgCheckedCount = mfgSkus.filter((s) => selectedStockout.has(s)).length;
                              const mfgChecked = mfgCheckedCount === mfgSkus.length && mfgSkus.length > 0;
                              const mfgIndeterminate = mfgCheckedCount > 0 && mfgCheckedCount < mfgSkus.length;

                              return (
                                <Fragment key={mk}>
                                  {/* Manufacturer sub-group header (no critical badge per FR-10) */}
                                  <tr className="border-t border-border/60 bg-muted/50">
                                    <td className="px-3 py-2 text-center">
                                      <Checkbox
                                        checked={mfgIndeterminate ? "indeterminate" : mfgChecked}
                                        onCheckedChange={() => toggleStockoutMfgGroup(mfg.visibleItems)}
                                        className="mx-auto"
                                      />
                                    </td>
                                    <td colSpan={7} className="px-3 py-2">
                                      <div className="flex items-center justify-between gap-4">
                                        <button
                                          onClick={() => toggleExpandStockoutMfg(mk)}
                                          className="flex min-w-0 items-center gap-2 text-left"
                                        >
                                          <span className="text-muted-foreground transition-colors hover:text-foreground">
                                            {isMfgExpanded ? (
                                              <ChevronDown className="size-4" />
                                            ) : (
                                              <ChevronRight className="size-4" />
                                            )}
                                          </span>
                                          <span className="type-body font-medium text-foreground">
                                            {mfg.manufacturerName ?? "No Brand"}
                                          </span>
                                          <span className="type-caption whitespace-nowrap text-muted-foreground">
                                            {mfg.visibleItems.length}{" "}
                                            {mfg.visibleItems.length === 1 ? "item" : "items"}
                                          </span>
                                        </button>
                                        <div
                                          className={cn(SEG_TRACK, "shrink-0")}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {PERIODS.map((p) => (
                                            <button
                                              key={p.days}
                                              onClick={() =>
                                                handleMfgPeriodChange(group.supplierId, mfg.manufacturerId, p.days)
                                              }
                                              className={seg(mfg.period === p.days)}
                                            >
                                              {p.label}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    </td>
                                  </tr>

                                  {isMfgExpanded &&
                                      mfg.visibleItems.map((item) => {
                                        const isSelected = selectedStockout.has(item.sku);
                                        const suggested = computeSuggestion(
                                          item.dailySalesRate,
                                          mfg.period,
                                          item.supplierLeadTime,
                                          0,
                                          globalRoundUp
                                        );
const isSubCase = suggested === 0;
                                         const ago = daysSince(item.lastSaleDate);
                                       return (
                                        <tr
                                          key={item.sku}
                                          onClick={() => toggleStockoutItem(item.sku)}
                                          className="cursor-pointer border-t border-border/60 transition-colors hover:bg-muted/60"
                                        >
                                          <td
                                            className="h-12 px-3 py-2 text-center"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <Checkbox
                                              checked={isSelected}
                                              onCheckedChange={() => toggleStockoutItem(item.sku)}
                                              className="mx-auto"
                                            />
                                          </td>
                                          <td className="px-3 py-2 type-data text-muted-foreground">
                                            <Highlight text={item.sku} query={searchQuery} />
                                          </td>
                                          <td className="px-3 py-2 text-foreground">
                                            <Highlight text={item.description} query={searchQuery} />
                                          </td>
                                          <td className="px-3 py-2 type-data text-muted-foreground">
                                            {item.unitSymbol}
                                          </td>
                                          <td className="px-3 py-2 text-right tabular-nums">
                                            <div className="text-foreground">
                                              {formatSaleDate(item.lastSaleDate)}
                                            </div>
                                            <div className="type-caption text-muted-foreground">
                                              {ago}d ago
                                            </div>
                                          </td>
                                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                                            {item.dailySalesRate.toFixed(2)}
                                          </td>
                                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                                            {item.windowUnitsSold.toFixed(2)}
                                          </td>
<td className="px-3 py-2 text-right font-semibold tabular-nums text-primary">
                                             {isSubCase ? (
                                               <span className="tabular-nums">0</span>
                                             ) : (
                                               suggested
                                             )}
                                           </td>
                                        </tr>
                                      );
                                    })}
                                </Fragment>
                              );
                            })}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {((activeTab === "standard" && !loading && groups.length > 0) ||
        (activeTab === "stockout" &&
          !stockoutLoading &&
          !stockoutError &&
          stockoutGroups.length > 0)) && (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background p-4">
          <div className="mx-auto max-w-screen-xl px-4">
            <div className="flex justify-end gap-2">
              {activeTab === "standard" && (
                <Button
                  variant="secondary"
                  onClick={handlePrintWorksheet}
                  disabled={groups.length === 0}
                  className="gap-2"
                >
                  <Printer className="size-4" />
                  Print Worksheet
                </Button>
              )}
              <Button disabled={totalSelectedCount === 0} onClick={handleGeneratePO}>
                Generate PO ({totalSelectedCount} {totalSelectedCount === 1 ? "item" : "items"})
              </Button>
            </div>
          </div>
        </div>
      )}
      </main>

      {/* Print Worksheet modal */}
      <Dialog open={printModalOpen} onOpenChange={(open) => { if (!open) setPrintModalOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Print Worksheet</DialogTitle>
            <DialogDescription>
              Configure the worksheet before printing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {printError && (
              <p className="type-caption text-destructive">{printError}</p>
            )}
            <div className="flex items-center justify-between">
              <span className="type-body">Total items</span>
              <span className="type-body font-medium">
                {printTotalItems > 0 ? printTotalItems.toLocaleString() : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="type-body">Page size</span>
              <span className="type-body text-muted-foreground">Letter — 8.5″ × 11″ (Portrait)</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="include-stockout" className="type-body cursor-pointer select-none">
                Include stockout section
              </label>
              <Checkbox
                id="include-stockout"
                checked={includeStockout}
                onCheckedChange={(checked) => setIncludeStockout(!!checked)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setPrintModalOpen(false)}
              disabled={printLoading}
            >
              Cancel
            </Button>
            <Button onClick={handlePrintFromModal} disabled={printLoading}>
              {printLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Preparing…
                </>
              ) : (
                <>
                  <Printer className="size-4" />
                  Print
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {worksheetGroups !== null && (
        <WorksheetReport
          groups={worksheetGroups}
          stockoutGroups={stockoutWorksheetGroups}
          companyName={companyName}
          locationName={locationName}
          appliedFrom={appliedFrom}
          appliedTo={appliedTo}
          globalPeriod={globalPeriod}
          globalRoundUp={globalRoundUp}
          printedByName={printedByName}
          printedAt={worksheetPrintedAt}
          getMfgPeriod={getMfgPeriod}
        />
      )}
    </>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="p-4">
          <div className="py-16 text-center type-body text-muted-foreground">Loading…</div>
        </main>
      }
    >
      <ReplenishmentContent />
    </Suspense>
  );
}
