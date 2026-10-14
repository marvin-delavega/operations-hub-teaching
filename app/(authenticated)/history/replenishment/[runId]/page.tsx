"use client";

import { useState, useEffect, use, useCallback, Fragment } from "react";
import { getSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Label } from "@/shared/ui/label";
import { ConfirmDialog } from "@/admin/ConfirmDialog";
import { POPrintReport } from "@/shared/ui/POPrintReport";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/ui/dialog";
import { Printer } from "lucide-react";
import type { ReplenishmentRunDetail, ReplenishmentRunPoDetail, ReplenishmentRunLineDetail } from "@/history/domain/ReplenishmentRunSummary";
import type { DraftLineQtyUpdate } from "@/history/domain/ReplenishmentHistoryRepository";

const MANILA_OFFSET = 8 * 60 * 60 * 1000;

function toManilaDatetime(isoStr: string): string {
  const d = new Date(isoStr.endsWith("Z") ? isoStr : isoStr + "Z");
  const manila = new Date(d.getTime() + MANILA_OFFSET);
  return manila.toLocaleString("en-PH", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
    timeZone: "UTC",
  });
}

function toManilaDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-PH", {
    year: "numeric", month: "short", day: "numeric",
    timeZone: "Asia/Manila",
  });
}

function fmt(n: number | null, decimals = 2): string {
  if (n === null) return "—";
  return n.toFixed(decimals);
}

function exportCsv(run: ReplenishmentRunDetail) {
  const isStockout = run.path === "stockout";
  const headers = isStockout
    ? ["PO Code", "Supplier", "Manufacturer", "SKU", "Description", "Unit", "Ordered Per Piece", "Order Period", "Daily Rate", "Last Sold", "30d Rate", "Window Units", "Suggested Qty", "Final Qty"]
    : ["PO Code", "Supplier", "Manufacturer", "SKU", "Description", "Unit", "Ordered Per Piece", "Order Period", "Sales Rate", "Selling Area Demand", "Effective Available", "Selling-Area On-hand", "DOS", "Suggested Qty", "Final Qty"];

  const rows: string[][] = [];
  for (const po of run.pos) {
    for (const line of po.lines) {
      const perPiece = line.orderedPerPiece ? "Yes" : "";
      if (isStockout) {
        rows.push([
          po.poCode, po.supplierName, po.manufacturerName ?? "No Brand",
          line.itemCode ?? "", line.itemDescription, line.unitSymbol, perPiece,
          String(line.orderPeriodDays), fmt(line.salesRate), line.lastSoldDate ?? "",
          fmt(line.stockoutDailyRate), fmt(line.stockoutWindowUnits),
          String(line.suggestedQty), String(line.finalQty),
        ]);
      } else {
        rows.push([
          po.poCode, po.supplierName, po.manufacturerName ?? "No Brand",
          line.itemCode ?? "", line.itemDescription, line.unitSymbol, perPiece,
          String(line.orderPeriodDays), fmt(line.salesRate),
          fmt(line.sellingAreaDemand), fmt(line.effectiveAvailable), fmt(line.shelfOnHand), fmt(line.dos),
          String(line.suggestedQty), String(line.finalQty),
        ]);
      }
    }
  }

  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `replenishment-run-${run.id}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface LineRowProps {
  line: ReplenishmentRunLineDetail;
  isStockout: boolean;
  editValue?: string;
  onEditValueChange?: (value: string) => void;
}

function LineRow({ line, isStockout, editValue, onEditValueChange }: LineRowProps) {
  const isOverridden = line.finalQty !== line.suggestedQty;
  const editing = typeof editValue === "string" && Boolean(onEditValueChange);
  return (
    <tr className={`border-t border-border/60 ${isOverridden ? "bg-warning/10" : ""}`}>
      <td className="px-3 py-2 type-data text-muted-foreground">{line.itemCode ?? "—"}</td>
      <td className="px-3 py-2 type-body">{line.itemDescription}</td>
      <td className="px-3 py-2 type-data text-muted-foreground">
        <div className="flex items-center gap-1.5">
          {line.unitSymbol}
          {line.orderedPerPiece && (
            <Badge variant="neutral">per pc</Badge>
          )}
        </div>
      </td>
      {isStockout ? (
        <>
          <td className="px-3 py-2 text-right tabular-nums type-caption">{toManilaDate(line.lastSoldDate ?? "—")}</td>
          <td className="px-3 py-2 text-right tabular-nums type-caption">{fmt(line.stockoutDailyRate)}</td>
          <td className="px-3 py-2 text-right tabular-nums type-caption">{fmt(line.stockoutWindowUnits)}</td>
        </>
      ) : (
        <>
          <td className="px-3 py-2 text-right tabular-nums type-caption">{fmt(line.salesRate)}</td>
          <td className="px-3 py-2 text-right tabular-nums type-caption">{fmt(line.sellingAreaDemand)}</td>
          <td className="px-3 py-2 text-right tabular-nums type-caption">{fmt(line.effectiveAvailable)}</td>
          <td className="px-3 py-2 text-right tabular-nums type-caption">{fmt(line.shelfOnHand)}</td>
          <td className="px-3 py-2 text-right tabular-nums type-caption">{fmt(line.dos)}</td>
        </>
      )}
      <td className="px-3 py-2 text-right tabular-nums type-caption text-muted-foreground">{line.suggestedQty}</td>
      <td className={`px-3 py-2 text-right tabular-nums type-body font-semibold ${isOverridden ? "text-warning" : ""}`}>
        {editing ? (
          <div className="flex items-center justify-end gap-1">
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={editValue}
              onChange={(e) => onEditValueChange?.(e.target.value)}
              aria-label={`Final qty for ${line.itemDescription}`}
              className="h-12 min-h-12 w-[8ch] px-2 py-1 text-right tabular-nums type-data"
            />
            {isOverridden && <span className="text-xs">*</span>}
          </div>
        ) : (
          <>
            {line.finalQty}
            {isOverridden && <span className="ml-1 text-xs">*</span>}
          </>
        )}
      </td>
    </tr>
  );
}

interface RunLinesTableProps {
  pos: ReplenishmentRunPoDetail[];
  isStockout: boolean;
  draftQtys?: Record<number, string>;
  onQtyChange?: (lineId: number, value: string) => void;
}

function RunLinesTable({ pos, isStockout, draftQtys, onQtyChange }: RunLinesTableProps) {
  // Total column count for the full-width sub-group header rows.
  const colCount = isStockout ? 8 : 10;
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left type-label">Code</th>
              <th className="px-3 py-2 text-left type-label">Item</th>
              <th className="px-3 py-2 text-left type-label">Unit</th>
              {isStockout ? (
                <>
                  <th className="px-3 py-2 text-right type-label">Last Sold</th>
                  <th className="px-3 py-2 text-right type-label">30d Rate</th>
                  <th className="px-3 py-2 text-right type-label">Window Units</th>
                </>
              ) : (
                <>
                  <th className="px-3 py-2 text-right type-label">Sales Rate</th>
                  <th className="px-3 py-2 text-right type-label">Shelf Demand</th>
                  <th className="px-3 py-2 text-right type-label">Effective Stock</th>
                  <th className="px-3 py-2 text-right type-label">Selling-Area On-hand</th>
                  <th className="px-3 py-2 text-right type-label">DOS</th>
                </>
              )}
              <th className="px-3 py-2 text-right type-label">Suggested</th>
              <th className="px-3 py-2 text-right type-label">Final Qty</th>
            </tr>
          </thead>
          <tbody>
            {pos.map((po) => (
              <Fragment key={po.id}>
                <tr className="bg-muted">
                  <td colSpan={colCount} className="px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="type-data font-semibold">{po.poCode}</span>
                        <span>·</span>
                        <span className="type-caption text-muted-foreground">{po.supplierName}</span>
                        <span>·</span>
                        <span className="type-caption text-muted-foreground">{po.manufacturerName ?? "No Brand"}</span>
                      </div>
                    </div>
                  </td>
                </tr>
                {po.lines.map((line) => (
                  <LineRow
                    key={line.id}
                    line={line}
                    isStockout={isStockout}
                    editValue={draftQtys?.[line.id]}
                    onEditValueChange={onQtyChange ? (value) => onQtyChange(line.id, value) : undefined}
                  />
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function poSubtotal(po: ReplenishmentRunPoDetail): number {
  return po.lines.reduce((sum, l) => sum + l.finalQty, 0);
}

// Shared fixed column widths so every per-PO print table aligns. The Item
// column is left auto (no width) so it absorbs identical leftover space in
// each table. Kept in sync with the <th> order below.
function PrintColgroup({ isStockout }: { isStockout: boolean }) {
  return (
    <colgroup>
      {/* Code */}
      <col style={{ width: "12%" }} />
      {/* Item — auto */}
      <col />
      {/* Unit */}
      <col style={{ width: "8%" }} />
      {isStockout ? (
        <>
          {/* Last Sold */}
          <col style={{ width: "14%" }} />
          {/* 30d Rate */}
          <col style={{ width: "12%" }} />
          {/* Window Units */}
          <col style={{ width: "13%" }} />
        </>
      ) : (
        <>
          {/* Sales Rate */}
          <col style={{ width: "10%" }} />
          {/* Shelf Demand */}
          <col style={{ width: "10%" }} />
          {/* Effective Stock */}
          <col style={{ width: "9%" }} />
          {/* Selling-Area On-hand */}
          <col style={{ width: "9%" }} />
          {/* DOS */}
          <col style={{ width: "7%" }} />
        </>
      )}
      {/* Suggested */}
      <col style={{ width: "8%" }} />
      {/* Final Qty */}
      <col style={{ width: "8%" }} />
    </colgroup>
  );
}

interface PrintReportProps {
  run: ReplenishmentRunDetail;
  companyName: string;
  printedByName: string;
}

function PrintReport({ run, companyName, printedByName }: PrintReportProps) {
  const isStockout = run.path === "stockout";
  const pathLabel = isStockout ? "Stockout" : "Standard";
  const totalLines = run.pos.reduce((sum, po) => sum + po.lines.length, 0);
  const totalFinalQty = run.pos.reduce((sum, po) => sum + poSubtotal(po), 0);
  const overriddenCount = run.pos.reduce(
    (sum, po) => sum + po.lines.filter((l) => l.finalQty !== l.suggestedQty).length,
    0,
  );
  const hasOverrides = overriddenCount > 0;

  const docHeader = (
    <div className="print-doc-header">
      <div className="print-doc-title">Replenishment Run Report — {pathLabel}</div>
      <div className="print-company-name">{companyName}</div>
      <div className="print-run-ref">Run #{run.id}</div>
      <div className="print-meta-grid">
        <span><strong>Location:</strong> {run.locationName}</span>
        <span><strong>Run date:</strong> {toManilaDatetime(run.createdAt)}</span>
        <span><strong>Created by:</strong> {run.createdByName}</span>
        <span><strong>Rounding:</strong> {run.rounding === "up" ? "Round up" : "Round down"}</span>
        {!isStockout && run.salesRangeFrom && (
          <span>
            <strong>Sales range:</strong>{" "}
            {toManilaDate(run.salesRangeFrom)} → {run.salesRangeTo ? toManilaDate(run.salesRangeTo) : ""}
          </span>
        )}
        <span><strong>POs:</strong> {run.pos.length}</span>
      </div>
      <div className="print-printed-line">
        Printed by {printedByName}
      </div>
    </div>
  );

  return (
    <div className="hidden print:block print-report">
      {run.pos.length === 0 && (
        <div>
          {docHeader}
          <p className="print-empty">No lines in this run.</p>
        </div>
      )}
      {run.pos.map((po, poIndex) => (
        <div key={poIndex} className="print-page">
          <div className="print-doc-header">
            <div className="print-doc-title">Replenishment Run Report — {pathLabel}</div>
            <div className="print-company-name">{companyName}</div>
            <div className="print-run-ref">Run #{run.id}</div>
            <div className="print-meta-grid">
              <span><strong>Location:</strong> {run.locationName}</span>
              <span><strong>Run date:</strong> {toManilaDatetime(run.createdAt)}</span>
              <span><strong>Created by:</strong> {run.createdByName}</span>
              <span><strong>Rounding:</strong> {run.rounding === "up" ? "Round up" : "Round down"}</span>
              {!isStockout && run.salesRangeFrom && (
                <span>
                  <strong>Sales range:</strong>{" "}
                  {toManilaDate(run.salesRangeFrom)} → {run.salesRangeTo ? toManilaDate(run.salesRangeTo) : ""}
                </span>
              )}
              <span><strong>POs:</strong> {run.pos.length}</span>
              <span><strong>Supplier:</strong> {po.supplierName}</span>
              <span><strong>PO:</strong> {po.poCode}</span>
              <span><strong>Manufacturer:</strong> {po.manufacturerName ?? "No Brand"}</span>
            </div>
            <div className="print-printed-line">
              Printed by {printedByName}
            </div>
          </div>
          <table className="print-table">
            <PrintColgroup isStockout={isStockout} />
            <thead>
              <tr>
                <th className="print-th-left">Code</th>
                <th className="print-th-left">Item</th>
                <th className="print-th-left">Unit</th>
                {isStockout ? (
                  <>
                    <th className="print-th-right">Last Sold</th>
                    <th className="print-th-right">30d Rate</th>
                    <th className="print-th-right">Window Units</th>
                  </>
                ) : (
                  <>
                    <th className="print-th-right">Sales Rate</th>
                    <th className="print-th-right">Shelf Demand</th>
                    <th className="print-th-right">Effective Stock</th>
                    <th className="print-th-right">Selling-Area On-hand</th>
                    <th className="print-th-right">DOS</th>
                  </>
                )}
                <th className="print-th-right">Suggested</th>
                <th className="print-th-right">Final Qty</th>
              </tr>
            </thead>
            <tbody>
              {po.lines.map((line) => {
                const isOverridden = line.finalQty !== line.suggestedQty;
                return (
                  <tr key={line.id} className="print-line-row">
                    <td className="print-td-mono">{line.itemCode ?? "—"}</td>
                    <td className="print-td-left">{line.itemDescription}{line.orderedPerPiece ? " [per pc]" : ""}</td>
                    <td className="print-td-mono">{line.unitSymbol}</td>
                    {isStockout ? (
                      <>
                        <td className="print-td-right">{safeManilaDate(line.lastSoldDate)}</td>
                        <td className="print-td-right">{fmt(line.stockoutDailyRate)}</td>
                        <td className="print-td-right">{fmt(line.stockoutWindowUnits)}</td>
                      </>
                    ) : (
                      <>
                        <td className="print-td-right">{fmt(line.salesRate)}</td>
                        <td className="print-td-right">{fmt(line.sellingAreaDemand)}</td>
                        <td className="print-td-right">{fmt(line.effectiveAvailable)}</td>
                        <td className="print-td-right">{fmt(line.shelfOnHand)}</td>
                        <td className="print-td-right">{fmt(line.dos)}</td>
                      </>
                    )}
                    <td className="print-td-right print-suggested">{line.suggestedQty}</td>
                    <td className={`print-td-right print-final-qty${isOverridden ? " print-overridden" : ""}`}>
                      {line.finalQty}{isOverridden ? "*" : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="print-subtotal-row">
                <td colSpan={isStockout ? 7 : 9} className="print-td-left print-subtotal-label">
                  Subtotal
                </td>
                <td className="print-td-right print-subtotal-qty">{poSubtotal(po)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ))}

      {run.pos.length > 0 && (
        <div className="print-page">
          <div className="print-grand-total">
            <div>Total lines: {totalLines}</div>
            <div>Total final qty: {totalFinalQty}</div>
            <div>Overridden lines: {overriddenCount}</div>
            {hasOverrides && (
              <div className="print-footnote">* overridden from system suggestion</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Safe date formatter that handles invalid/missing dates
function safeManilaDate(dateStr: string | null | undefined): string {
  if (!dateStr || dateStr === "—") return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", {
    year: "numeric", month: "short", day: "numeric",
    timeZone: "Asia/Manila",
  });
}

export default function Page({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = use(params);
  const [run, setRun] = useState<ReplenishmentRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("Operations Hub");
  const [printedByName, setPrintedByName] = useState("");
  const [printedAt, setPrintedAt] = useState<Date | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [permissions, setPermissions] = useState<readonly string[]>([]);
  const [draftQtys, setDraftQtys] = useState<Record<number, string>>({});
  const [savingQtys, setSavingQtys] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printTemplate, setPrintTemplate] = useState<"replenishment" | "purchase-order">("purchase-order");
  const [showPrintAfterApprove, setShowPrintAfterApprove] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/history/replenishment/api/${runId}`);
      if (res.status === 404) { setError("Run not found."); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? `Request failed (${res.status}).`);
        return;
      }
      setRun(await res.json());
    } catch (e) {
      console.error("Failed to load run details", e);
      setError("Failed to load run details.");
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/login/api")
      .then((r) => r.json())
      .then((data) => { if (data.companyName?.trim()) setCompanyName(data.companyName.trim()); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    getSession().then((session) => {
      if (session?.user?.name) setPrintedByName(session.user.name);
      if (session?.user?.permissions) setPermissions(session.user.permissions);
    });
  }, []);

  useEffect(() => {
    const handler = () => setPrintedAt(new Date());
    window.addEventListener("beforeprint", handler);
    return () => window.removeEventListener("beforeprint", handler);
  }, []);

  useEffect(() => {
    if (!run || run.status !== "draft") {
      setDraftQtys({});
      return;
    }
    const initial: Record<number, string> = {};
    for (const po of run.pos) {
      for (const line of po.lines) initial[line.id] = String(line.finalQty);
    }
    setDraftQtys(initial);
  }, [run]);

  // Show print modal after approval
  useEffect(() => {
    if (showPrintAfterApprove) {
      setPrintTemplate("purchase-order");
      setPrintModalOpen(true);
      setShowPrintAfterApprove(false);
    }
  }, [showPrintAfterApprove]);

  const isStockout = run?.path === "stockout";
  const canEditDraft = run?.status === "draft" && permissions.includes("history.edit_draft");

  let hasDirtyLines = false;
  let hasInvalidQty = false;
  if (run && canEditDraft) {
    for (const po of run.pos) {
      for (const line of po.lines) {
        const raw = draftQtys[line.id]?.trim() ?? "";
        if (!/^\d+$/.test(raw)) {
          if (raw !== "") hasInvalidQty = true;
          continue;
        }
        if (Number(raw) !== line.finalQty) hasDirtyLines = true;
      }
    }
  }

  function handleQtyChange(lineId: number, value: string) {
    setDraftQtys((prev) => ({ ...prev, [lineId]: value }));
  }

  function handlePrint() {
    setPrintTemplate("purchase-order");
    setPrintModalOpen(true);
  }

  function handlePrintFromModal() {
    setPrintedAt(new Date());
    if (printTemplate === "purchase-order") {
      // For purchase order template, we print each PO individually
      // The POPrintReport component handles this
      window.print();
    } else {
      window.print();
    }
    setPrintModalOpen(false);
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/history/replenishment/api/${runId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to delete run.");
        return;
      }
      setRun((prev) => prev ? { ...prev, status: "deleted" } : prev);
    } catch {
      setError("Failed to delete run.");
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  }

  async function handleApprove() {
    setApproving(true);
    setError(null);
    try {
      const res = await fetch(`/history/replenishment/api/${runId}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to approve draft.");
        return;
      }
      await load();
      // Show print modal after successful approval
      setShowPrintAfterApprove(true);
    } catch {
      setError("Failed to approve draft.");
    } finally {
      setApproving(false);
    }
  }

  async function handleSaveQuantities() {
    if (!run) return;
    const changed: DraftLineQtyUpdate[] = [];
    for (const po of run.pos) {
      for (const line of po.lines) {
        const raw = draftQtys[line.id]?.trim() ?? "";
        if (!/^\d+$/.test(raw)) continue;
        const qty = Number(raw);
        if (qty !== line.finalQty) changed.push({ lineId: line.id, finalQty: qty });
      }
    }
    if (changed.length === 0) return;
    setSavingQtys(true);
    setError(null);
    try {
      const res = await fetch(`/history/replenishment/api/${runId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: changed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save quantity changes.");
        return;
      }
      await load();
    } catch {
      setError("Failed to save quantity changes.");
    } finally {
      setSavingQtys(false);
    }
  }

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 12mm 12mm 14mm;
          }

          /* Hide all non-report content */
          body > * { display: none !important; }
          body > *:has(.print-report) { display: block !important; }
          .print-report { display: block !important; }

          /* Each PO on its own page */
          .print-page {
            break-before: page;
          }
          .print-page:first-child {
            break-before: auto;
          }

          .print-report {
            color: #000;
            background: #fff;
          }

          .print-report * {
            color: #000 !important;
            background: transparent !important;
          }

          /* Document header */
          .print-doc-header {
            margin-bottom: 6mm;
          }
          .print-doc-title {
            font-size: 13pt;
            font-weight: bold;
            margin-bottom: 1mm;
          }
          .print-company-name {
            font-size: 9pt;
            margin-bottom: 1mm;
          }
          .print-run-ref {
            font-size: 16pt;
            font-weight: bold;
            margin-bottom: 3mm;
            font-family: var(--font-mono), ui-monospace, monospace;
          }
          .print-meta-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 2mm 8mm;
            font-size: 8pt;
            margin-bottom: 2mm;
          }
          .print-printed-line {
            font-size: 7pt;
            color: #444;
            margin-top: 2mm;
          }

          /* PO sections */
          .print-po {
            margin-top: 5mm;
            break-inside: auto;
          }
          .print-po-inline-header {
            font-size: 8pt;
            font-weight: bold;
            background: #f5f5f5;
            padding: 1.5mm 2mm;
            border-bottom: 1px solid #000;
          }
          .print-po-inline-header .print-po-code {
            font-family: var(--font-mono), ui-monospace, monospace;
          }

          /* Tables — fixed layout + a shared colgroup give every per-PO
             section identical column widths so they align down the page. */
          .print-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: 8pt;
          }
          .print-table thead {
            display: table-header-group;
          }
          .print-table tr,
          .print-table tfoot {
            break-inside: avoid;
          }
          .print-th-left,
          .print-th-right {
            border-bottom: 1px solid #000;
            padding: 1mm 2mm;
            font-weight: bold;
            font-size: 7.5pt;
          }
          .print-th-left { text-align: left; }
          .print-th-right { text-align: right; }

          .print-td-left,
          .print-td-right,
          .print-td-mono {
            border-bottom: 1px solid #ccc;
            padding: 1mm 2mm;
            font-size: 8pt;
            overflow-wrap: break-word;
          }
          .print-td-left { text-align: left; }
          .print-td-right,
          .print-td-mono { text-align: right; font-family: var(--font-mono), ui-monospace, monospace; }
          .print-td-mono { text-align: left; }

          .print-suggested { color: #666 !important; }
          .print-final-qty { font-weight: bold; }
          /* Asterisk + bold only — no color */
          .print-overridden { font-weight: bold; }

          /* PO subtotal */
          .print-subtotal-row {
            break-before: avoid;
          }
          .print-subtotal-label {
            text-align: right;
            font-weight: bold;
            font-size: 8pt;
            padding: 1mm 2mm;
            border-top: 1px solid #000;
          }
          .print-subtotal-qty {
            font-weight: bold;
            font-size: 8pt;
            text-align: right;
            font-family: var(--font-mono), ui-monospace, monospace;
            padding: 1mm 2mm;
            border-top: 1px solid #000;
          }

          /* Grand totals */
          .print-grand-total {
            margin-top: 6mm;
            padding-top: 3mm;
            border-top: 2px solid #000;
            font-size: 8.5pt;
            font-weight: bold;
            display: flex;
            flex-wrap: wrap;
            gap: 2mm 8mm;
          }
          .print-footnote {
            width: 100%;
            font-weight: normal;
            font-size: 7.5pt;
            margin-top: 1mm;
          }

          .print-empty {
            margin-top: 6mm;
            font-size: 9pt;
          }
        }
      `}</style>

      <main className="mx-auto max-w-screen-lg space-y-4 p-4 pb-28 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/history/replenishment" className="type-body text-muted-foreground transition-colors hover:text-foreground">
            ← Replenishment History
          </Link>
        </div>

        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
        )}

        {!loading && error && (
          <div className="py-10 text-center">
            <p className="type-body text-destructive">{error}</p>
            <Button variant="link" size="sm" onClick={load}>Retry</Button>
          </div>
        )}

        {!loading && !error && run && (
          <>
            {/* Run header */}
            <div className="rounded-lg border border-border bg-card p-4 space-y-2">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="type-page-title">{run.locationName}</h1>
                  <Badge variant={isStockout ? "warning" : "incoming"}>
                    {isStockout ? "Stockout" : "Standard"}
                  </Badge>
                  {run.status === "draft" && (
                    <Badge variant="neutral">Draft</Badge>
                  )}
                  {run.status === "deleted" && (
                    <Badge variant="neutral">Deleted</Badge>
                  )}
                </div>
                <p className="type-caption text-muted-foreground mt-1">
                  {toManilaDatetime(run.createdAt)} · {run.createdByName}
                </p>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-1 type-caption text-muted-foreground">
                <span>Rounding: <strong className="text-foreground">{run.rounding === "up" ? "Round up" : "Round down"}</strong></span>
                {!isStockout && run.salesRangeFrom && (
                  <span>Sales range: <strong className="text-foreground">{toManilaDate(run.salesRangeFrom)} → {run.salesRangeTo ? toManilaDate(run.salesRangeTo) : ""}</strong></span>
                )}
                <span>{run.pos.length} {run.pos.length === 1 ? "PO" : "POs"}</span>
              </div>
            </div>

            {/* PO sections */}
            {run.pos.length === 0 && (
              <p className="py-8 text-center type-body text-muted-foreground">No lines in this run.</p>
            )}
            {run.pos.length > 0 && (
              <RunLinesTable
                pos={run.pos}
                isStockout={isStockout}
                draftQtys={canEditDraft ? draftQtys : undefined}
                onQtyChange={canEditDraft ? handleQtyChange : undefined}
              />
            )}

            {run.pos.some((po) => po.lines.some((l) => l.finalQty !== l.suggestedQty)) && (
              <p className="type-caption text-muted-foreground">* Lines marked with * were overridden from the system suggestion.</p>
            )}

            <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background p-4">
              <div className="mx-auto flex max-w-screen-lg flex-wrap items-center justify-between gap-3 px-4">
                <div className="type-caption text-muted-foreground">
                  {canEditDraft && hasInvalidQty
                    ? "Some quantities are invalid."
                    : canEditDraft && hasDirtyLines
                      ? "Unsaved quantity changes."
                      : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={handlePrint}>Print</Button>
                  <Button variant="secondary" onClick={() => exportCsv(run)}>Export CSV</Button>
                  {canEditDraft && hasDirtyLines && (
                    <Button variant="secondary" onClick={handleSaveQuantities} disabled={savingQtys || hasInvalidQty}>
                      {savingQtys ? "Saving…" : "Save Quantities"}
                    </Button>
                  )}
                  {run.status === "draft" && permissions.includes("replenishment.approve") && (
                    <Button onClick={handleApprove} disabled={approving}>
                      {approving ? "Approving…" : "Approve"}
                    </Button>
                  )}
                  {run.status === "draft" && permissions.includes("history.delete_draft") && (
                    <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)} disabled={deleting}>
                      {deleting ? "Deleting…" : "Delete Draft"}
                    </Button>
                  )}
                  {run.status !== "draft" && run.status !== "deleted" && permissions.includes("history.delete_run") && (
                    <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)} disabled={deleting}>
                      {deleting ? "Deleting…" : "Delete Run"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title={run?.status === "draft" ? "Delete Draft Replenishment Run" : "Delete Replenishment Run"}
          description={run?.status === "draft"
            ? "Permanently delete this draft? This cannot be undone."
            : "This will cancel all associated ActiveOne purchase orders. Runs with delivered POs cannot be deleted. This action cannot be undone."}
          confirmLabel={run?.status === "draft" ? "Delete Draft" : "Delete Run"}
          destructive
          onConfirm={handleDelete}
        />

        {/* Print Template Selection Modal */}
        <Dialog open={printModalOpen} onOpenChange={(open) => { if (!open) setPrintModalOpen(false); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Print Report</DialogTitle>
              <DialogDescription>
                Choose a template to print.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid gap-1.5">
                <Label className="type-label">Template</Label>
                <Select value={printTemplate} onValueChange={(v) => setPrintTemplate(v as "replenishment" | "purchase-order")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="purchase-order">Purchase Order</SelectItem>
                    <SelectItem value="replenishment">Replenishment Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => setPrintModalOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handlePrintFromModal}>
                <Printer className="size-4 mr-1.5" />
                Print
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>

      {run && (
        <>
          {printTemplate === "replenishment" ? (
            <PrintReport
              run={run}
              companyName={companyName}
              printedByName={printedByName}
            />
          ) : (
            <POPrintReport
              pos={run.pos.map((po) => ({
                poCode: po.poCode,
                supplierName: po.supplierName,
                manufacturerName: po.manufacturerName,
                lines: po.lines.map((l) => ({
                  itemCode: l.itemCode,
                  itemDescription: l.itemDescription,
                  unitSymbol: l.unitSymbol,
                  finalQty: l.finalQty,
                  pieceQty: 0,
                  orderedPerPiece: l.orderedPerPiece,
                  baseUnitSymbol: l.unitSymbol,
                })),
              }))}
              companyName={companyName}
              printedByName={printedByName}
              printedAt={printedAt}
              poDate={run.createdAt.split("T")[0]}
              locationName={run.locationName}
            />
          )}
        </>
      )}
    </>
  );
}
