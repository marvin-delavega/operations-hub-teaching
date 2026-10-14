"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { Undo2, ScanLine, RotateCcw, EyeOff, ShieldAlert } from "lucide-react";
import { useScanner } from "@/shared/ui/useScanner";
import { SelectionTile } from "@/shared/ui/SelectionTile";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { Label } from "@/shared/ui/label";
import {
  classifyLine,
  flaggedFrom,
  type LineStatus,
  type StatusBreakdown,
  type FlaggedLine,
  type ReturnExcessEvent,
} from "@/delivery/domain/Delivery";

// Server-computed permission flags for the logged-in user, delivered in the GET responses.
// The server re-checks on commit, so these only drive control visibility.
interface Capabilities {
  canAdjustLines: boolean;
  canApproveDiscrepancies: boolean;
}

const NO_CAPABILITIES: Capabilities = { canAdjustLines: false, canApproveDiscrepancies: false };

interface OpenPurchaseOrder {
  poId: number;
  poCode: string;
  poDate: string;
  expectedDeliveryDate: string;
  supplierName: string;
  totalItems: number;
  totalQuantity: number;
}

interface PurchaseOrderForReceiving {
  poId: number;
  poCode: string;
  supplierId: number;
  supplierName: string;
  locationId: number;
  lines: {
    itemId: number | null;
    code: string | null;
    description: string;
    orderedQuantity: number;
    unitSymbol: string;
  }[];
}

interface ReceivingLine {
  key: string;
  code: string | null;
  description: string;
  itemId: number | null;
  orderedQuantity: number;
  receivedQuantity: number;
  inMasterlist: boolean;
  unitSymbol: string;
}

interface DeliveryResult {
  newPoCode: string;
  closedOriginalPoCode: string;
  statusBreakdown: StatusBreakdown;
}

type Screen = "select" | "receiving" | "review" | "success";

const STATUS_META: Record<LineStatus, { label: string; variant: "neutral" | "critical" | "success" | "warning" | "incoming" }> = {
  exact: { label: "Exact", variant: "success" },
  over_served: { label: "Over Served", variant: "warning" },
  under_served: { label: "Under Served", variant: "neutral" },
  not_ordered: { label: "Not Ordered", variant: "incoming" },
  new_item: { label: "New Item", variant: "critical" },
};

const DEFAULT_SCAN_BATCH_DELAY_MS = 2000;

function storageKey(poId: number): string {
  return `delivery:po:${poId}`;
}

function pendingKey(poId: number): string {
  return `delivery:po:${poId}:pending`;
}

function applyScans(
  lines: ReceivingLine[],
  codes: string[],
  masterlist: Map<string, string> | null,
  poLineByCode?: Map<string, { orderedQuantity: number; itemId: number | null; description: string; unitSymbol: string }>,
): ReceivingLine[] {
  if (codes.length === 0) return lines;

  const counts = new Map<string, number>();
  for (const code of codes) counts.set(code, (counts.get(code) ?? 0) + 1);

  const next = lines.map((l) => ({ ...l }));
  const indexByCode = new Map<string, number>();
  next.forEach((l, i) => { if (l.code !== null) indexByCode.set(l.code, i); });

  for (const [code, increment] of counts) {
    const i = indexByCode.get(code);
    if (i !== undefined) {
      next[i].receivedQuantity += increment;
    } else {
      const poLine = poLineByCode?.get(code);
      if (poLine) {
        indexByCode.set(code, next.length);
        next.push({
          key: code,
          code,
          description: poLine.description,
          itemId: poLine.itemId,
          orderedQuantity: poLine.orderedQuantity,
          receivedQuantity: increment,
          inMasterlist: true,
          unitSymbol: poLine.unitSymbol,
        });
      } else {
        const description = masterlist?.get(code) ?? null;
        indexByCode.set(code, next.length);
        next.push({
          key: code,
          code,
          description: description ?? "New Item",
          itemId: null,
          orderedQuantity: 0,
          receivedQuantity: increment,
          inMasterlist: description !== null,
          unitSymbol: "",
        });
      }
    }
  }
  return next;
}

function restorePending(poId: number): string[] {
  try {
    const raw = localStorage.getItem(pendingKey(poId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === "string") : [];
  } catch {
    return [];
  }
}

function formatDate(date: string): string {
  const isBareDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const parsed = new Date(isBareDate ? `${date}T00:00:00` : date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function lineStatus(line: ReceivingLine): LineStatus {
  return classifyLine(line.orderedQuantity, line.receivedQuantity, line.inMasterlist);
}

function buildBreakdown(lines: ReceivingLine[]): StatusBreakdown {
  const breakdown: StatusBreakdown = { exact: 0, overServed: 0, underServed: 0, notOrdered: 0, newItem: 0 };
  for (const line of lines) {
    switch (lineStatus(line)) {
      case "exact": breakdown.exact++; break;
      case "over_served": breakdown.overServed++; break;
      case "under_served": breakdown.underServed++; break;
      case "not_ordered": breakdown.notOrdered++; break;
      case "new_item": breakdown.newItem++; break;
    }
  }
  return breakdown;
}

export default function Page() {
  const [screen, setScreen] = useState<Screen>("select");
  const [activePo, setActivePo] = useState<PurchaseOrderForReceiving | null>(null);
  const [lines, setLines] = useState<ReceivingLine[]>([]);
  const [lastScannedKey, setLastScannedKey] = useState<string | null>(null);
  const [result, setResult] = useState<DeliveryResult | null>(null);
  const [scanBatchDelayMs, setScanBatchDelayMs] = useState(DEFAULT_SCAN_BATCH_DELAY_MS);
  const [continuousDefault, setContinuousDefault] = useState(true);
  const [blindDefault, setBlindDefault] = useState(false);
  const [sessionContinuous, setSessionContinuous] = useState(true);
  const [sessionBlind, setSessionBlind] = useState(false);
  const [successSnapshot, setSuccessSnapshot] = useState<{ items: number; units: number } | null>(null);
  const [capabilities, setCapabilities] = useState<Capabilities>(NO_CAPABILITIES);
  const masterlistRef = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    fetch("/admin/api/settings")
      .then((r) => r.json())
      .then((data: { settings: { scan_batch_delay_ms?: number; delivery_continuous_scanning?: boolean; delivery_blind_delivery?: boolean } }) => {
        const delay = Number(data.settings?.scan_batch_delay_ms);
        if (Number.isFinite(delay) && delay > 0) setScanBatchDelayMs(delay);
        setContinuousDefault(data.settings?.delivery_continuous_scanning ?? true);
        setBlindDefault(data.settings?.delivery_blind_delivery ?? false);
      })
      .catch(() => { /* keep defaults */ });
  }, []);

  function resetToSelect() {
    setActivePo(null);
    setLines([]);
    setLastScannedKey(null);
    setResult(null);
    setSuccessSnapshot(null);
    setScreen("select");
  }

  if (screen === "select" || !activePo) {
    return <SelectScreen
      continuousDefault={continuousDefault}
      blindDefault={blindDefault}
      onOpen={(po, restored, last, continuous, blind, caps) => {
        setActivePo(po);
        setLines(restored);
        setLastScannedKey(last);
        setSessionContinuous(continuous);
        setSessionBlind(blind);
        setCapabilities(caps);
        setScreen("receiving");
      }}
      masterlistRef={masterlistRef}
    />;
  }

  if (screen === "success" && result) {
    return <SuccessScreen
      po={activePo}
      result={result}
      blind={sessionBlind}
      snapshot={successSnapshot}
      onDone={resetToSelect}
    />;
  }

  return (
    <ReceivingScreen
      po={activePo}
      capabilities={capabilities}
      masterlistRef={masterlistRef}
      scanBatchDelayMs={scanBatchDelayMs}
      continuousScanning={sessionContinuous}
      blind={sessionBlind}
      lines={lines}
      setLines={setLines}
      lastScannedKey={lastScannedKey}
      setLastScannedKey={setLastScannedKey}
      reviewMode={screen === "review"}
      onReview={() => setScreen("review")}
      onBackToReceiving={() => setScreen("receiving")}
      onCancel={resetToSelect}
      onSaved={(r, snapshot) => {
        localStorage.removeItem(storageKey(activePo.poId));
        localStorage.removeItem(pendingKey(activePo.poId));
        setResult(r);
        setSuccessSnapshot(snapshot);
        setScreen("success");
      }}
    />
  );
}

function SelectScreen({
  continuousDefault,
  blindDefault,
  onOpen,
  masterlistRef,
}: {
  continuousDefault: boolean;
  blindDefault: boolean;
  onOpen: (po: PurchaseOrderForReceiving, lines: ReceivingLine[], lastScannedKey: string | null, continuousScanning: boolean, blindDelivery: boolean, capabilities: Capabilities) => void;
  masterlistRef: React.MutableRefObject<Map<string, string> | null>;
}) {
  const [pos, setPos] = useState<OpenPurchaseOrder[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/delivery/api")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data: { purchaseOrders: OpenPurchaseOrder[] }) => setPos(data.purchaseOrders ?? []))
      .catch(() => setError("Failed to load purchase orders. Please try again."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function ensureMasterlist(): Promise<Map<string, string>> {
    if (masterlistRef.current) return masterlistRef.current;
    const res = await fetch("/delivery/api/masterlist");
    const data: { items: { code: string; description: string }[] } = await res.json();
    const map = new Map(data.items.map((i) => [i.code, i.description]));
    masterlistRef.current = map;
    return map;
  }

  async function openPo(poId: number) {
    setOpening(poId);
    try {
      const [poRes, masterlist] = await Promise.all([
        fetch(`/delivery/api?poId=${poId}`).then((r) => {
          if (!r.ok) throw new Error();
          return r.json() as Promise<PurchaseOrderForReceiving & { capabilities?: Capabilities }>;
        }),
        ensureMasterlist(),
      ]);
      const capabilities = poRes.capabilities ?? NO_CAPABILITIES;

      const saved = restoreSession(poId);
      const hasInProgress = saved?.lines.some((l) => l.receivedQuantity > 0) ?? false;
      const continuous = hasInProgress ? (saved!.continuousScanning ?? continuousDefault) : continuousDefault;
      const blind = blindDefault;

      const poLineByCode: Map<string, { orderedQuantity: number; itemId: number | null; description: string; unitSymbol: string }> = new Map(
        poRes.lines
          .filter((l) => l.code !== null)
          .map((l) => [l.code as string, { orderedQuantity: l.orderedQuantity, itemId: l.itemId, description: l.description, unitSymbol: l.unitSymbol }])
      );

      let baseLines: ReceivingLine[];
      if (!saved || !hasInProgress) {
        baseLines = blind
          ? []
          : poRes.lines.map((l, index) => ({
              key: l.code ?? `ordered-${index}`,
              code: l.code,
              description: l.description,
              itemId: l.itemId,
              orderedQuantity: l.orderedQuantity,
              receivedQuantity: 0,
              inMasterlist: l.code !== null && masterlist.has(l.code),
              unitSymbol: l.unitSymbol,
            }));
      } else if (blind) {
        baseLines = saved.lines.filter((l) => l.receivedQuantity > 0);
      } else {
        const savedByCode = new Map(saved.lines.filter((l) => l.code !== null).map((l) => [l.code!, l]));
        const savedByKey = new Map(saved.lines.map((l) => [l.key, l]));
        baseLines = poRes.lines.map((l, index) => {
          const key = l.code ?? `ordered-${index}`;
          const savedLine = (l.code ? savedByCode.get(l.code) : null) ?? savedByKey.get(key) ?? null;
          return {
            key,
            code: l.code,
            description: l.description,
            itemId: l.itemId,
            orderedQuantity: l.orderedQuantity,
            receivedQuantity: savedLine?.receivedQuantity ?? 0,
            inMasterlist: l.code !== null && masterlist.has(l.code),
            unitSymbol: l.unitSymbol,
          };
        });
        const poCodeSet = new Set(poRes.lines.filter((l) => l.code !== null).map((l) => l.code!));
        for (const savedLine of saved.lines) {
          if (savedLine.code !== null && !poCodeSet.has(savedLine.code)) {
            baseLines.push(savedLine);
          }
        }
      }

      const pending = restorePending(poId);
      const mergedLines = applyScans(baseLines, pending, masterlist, blind ? poLineByCode : undefined);
      if (pending.length > 0) localStorage.removeItem(pendingKey(poId));
      const lastKey = pending.length > 0 ? pending[pending.length - 1] : saved?.lastScannedKey ?? null;
      onOpen(poRes, mergedLines, lastKey, continuous, blind, capabilities);
    } catch {
      setError("Failed to open that purchase order. Please try again.");
    } finally {
      setOpening(null);
    }
  }

  const filtered = pos.filter((p) => p.poCode.toLowerCase().includes(search.toLowerCase()));

  return (
    <main className="mx-auto max-w-screen-md space-y-4 p-4">
      <div className="flex items-center gap-3">
        <Link href="/" className="type-body text-muted-foreground transition-colors hover:text-foreground">
          ← Home
        </Link>
        <h1 className="type-page-title">Delivery</h1>
      </div>
      <p className="type-body text-muted-foreground">Select an open purchase order to receive against.</p>

      <Input
        type="search"
        placeholder="Search by PO number…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading && (
        <div className="grid grid-cols-1 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[92px]" />)}
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="type-body text-destructive">{error}</p>
          <Button variant="link" size="sm" onClick={load}>Retry</Button>
        </div>
      )}

      {!loading && !error && pos.length === 0 && (
        <div className="py-16 text-center type-body text-muted-foreground">
          No open purchase orders to receive.
        </div>
      )}

      {!loading && !error && pos.length > 0 && filtered.length === 0 && (
        <div className="py-16 text-center type-body text-muted-foreground">No purchase orders match your search.</div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map((po) => {
            const session = restoreSession(po.poId);
            const scannedItems = session?.lines.filter((l) => l.orderedQuantity > 0 && l.receivedQuantity > 0).length ?? 0;
            const receivedQty = session?.lines.filter((l) => l.orderedQuantity > 0).reduce((sum, l) => sum + l.receivedQuantity, 0) ?? 0;
            const hasProgress = session?.lines.some((l) => l.receivedQuantity > 0) ?? false;
            return (
              <SelectionTile key={po.poId} onSelect={() => openPo(po.poId)}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="type-data block font-semibold">{po.poCode}</span>
                    <span className="type-body mt-0.5 block">{po.supplierName}</span>
                  </div>
                  {opening === po.poId && (
                    <span className="type-caption">Opening…</span>
                  )}
                </div>
                <div className="type-caption mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  <span>PO date: {formatDate(po.poDate)}</span>
                  <span>Expected: {formatDate(po.expectedDeliveryDate)}</span>
                </div>
                {hasProgress && (
                  blindDefault ? (
                    <div className="mt-2 type-caption font-medium text-primary">
                      In progress · {scannedItems} {scannedItems === 1 ? "item" : "items"} · {receivedQty} units received
                    </div>
                  ) : (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between type-caption">
                        <span className="font-medium text-primary">{scannedItems} {scannedItems === 1 ? "item" : "items"} scanned</span>
                        <span className="text-muted-foreground">{receivedQty} / {po.totalQuantity} units</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${po.totalQuantity > 0 ? Math.min(100, (receivedQty / po.totalQuantity) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  )
                )}
              </SelectionTile>
            );
          })}
        </div>
      )}
    </main>
  );
}

interface SavedSession {
  lines: ReceivingLine[];
  lastScannedKey: string | null;
  continuousScanning: boolean;
}

function restoreSession(poId: number): SavedSession | null {
  try {
    const raw = localStorage.getItem(storageKey(poId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedSession;
    if (!Array.isArray(parsed.lines)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function ReceivingScreen({
  po,
  capabilities,
  masterlistRef,
  scanBatchDelayMs,
  continuousScanning,
  blind,
  lines,
  setLines,
  lastScannedKey,
  setLastScannedKey,
  reviewMode,
  onReview,
  onBackToReceiving,
  onCancel,
  onSaved,
}: {
  po: PurchaseOrderForReceiving;
  capabilities: Capabilities;
  masterlistRef: React.MutableRefObject<Map<string, string> | null>;
  scanBatchDelayMs: number;
  continuousScanning: boolean;
  blind: boolean;
  lines: ReceivingLine[];
  setLines: React.Dispatch<React.SetStateAction<ReceivingLine[]>>;
  lastScannedKey: string | null;
  setLastScannedKey: React.Dispatch<React.SetStateAction<string | null>>;
  reviewMode: boolean;
  onReview: () => void;
  onBackToReceiving: () => void;
  onCancel: () => void;
  onSaved: (result: DeliveryResult, snapshot: { items: number; units: number }) => void;
}) {
  // Manual line adjust/delete requires the "Adjust/Delete Delivery Lines" permission on the
  // logged-in user; blind-discrepancy approval requires "Approve Delivery Discrepancies".
  // No password step-up, no cross-user authorize-as — the server re-checks on commit.
  const { canAdjustLines, canApproveDiscrepancies } = capabilities;
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [offModalCode, setOffModalCode] = useState<string | null>(null);
  const [lastOffEntry, setLastOffEntry] = useState<{ key: string; amount: number } | null>(null);
  // Return-Excess events accumulated during this session.
  const [returnExcessEvents, setReturnExcessEvents] = useState<ReturnExcessEvent[]>([]);
  // Return-Excess confirm: which line is pending a snap-down.
  const [pendingReturnExcess, setPendingReturnExcess] = useState<ReceivingLine | null>(null);

  // Blind-mode derived state (Review screen only).
  const flagged: FlaggedLine[] = useMemo(() => {
    if (!blind || !reviewMode) return [];
    return flaggedFrom(lines.map((l) => ({
      code: l.code,
      orderedQuantity: l.orderedQuantity,
      receivedQuantity: l.receivedQuantity,
      inMasterlist: l.inMasterlist,
    })));
  }, [blind, reviewMode, lines]);

  const hasDiscrepancy = blind && flagged.length > 0;
  // Save is blocked in blind mode with discrepancies unless the committer can approve them.
  const canSave = !hasDiscrepancy || canApproveDiscrepancies;

  const poLineByCode = useMemo(
    () =>
      blind
        ? new Map(
            po.lines
              .filter((l) => l.code !== null)
              .map((l) => [
                l.code as string,
                { orderedQuantity: l.orderedQuantity, itemId: l.itemId, description: l.description, unitSymbol: l.unitSymbol },
              ])
          )
        : undefined,
    [po.lines, blind],
  );

  // Persist session on every change.
  useEffect(() => {
    localStorage.setItem(
      storageKey(po.poId),
      JSON.stringify({ lines, lastScannedKey, continuousScanning }),
    );
  }, [po.poId, lines, lastScannedKey, continuousScanning]);

  const pendingRef = useRef<string[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countElRef = useRef<HTMLSpanElement>(null);
  const [buffering, setBuffering] = useState(false);

  const flushScans = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    const batch = pendingRef.current;
    pendingRef.current = [];
    localStorage.removeItem(pendingKey(po.poId));
    setBuffering(false);
    if (batch.length === 0) return;

    setLines((prev) => applyScans(prev, batch, masterlistRef.current, poLineByCode));
    setLastScannedKey(batch[batch.length - 1]);
  }, [po.poId, setLines, setLastScannedKey, masterlistRef, poLineByCode]);

  const handleScan = useCallback(
    (barcode: string) => {
      const code = barcode.trim();
      if (!code) return;

      if (!continuousScanning) {
        if (offModalCode !== null) return;
        setOffModalCode(code);
        return;
      }

      const wasEmpty = pendingRef.current.length === 0;
      pendingRef.current.push(code);
      localStorage.setItem(pendingKey(po.poId), JSON.stringify(pendingRef.current));
      if (countElRef.current) countElRef.current.textContent = String(pendingRef.current.length);
      if (wasEmpty) setBuffering(true);
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = setTimeout(flushScans, scanBatchDelayMs);
    },
    [po.poId, flushScans, scanBatchDelayMs, continuousScanning, offModalCode],
  );

  useScanner({ onScan: handleScan, enabled: !reviewMode && editingKey === null });

  useEffect(() => () => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
  }, []);

  function confirmOffEntry(quantity: number) {
    const code = offModalCode!;
    setLines((prev) => applyScans(prev, Array(quantity).fill(code), masterlistRef.current, poLineByCode));
    setLastOffEntry({ key: code, amount: quantity });
    setLastScannedKey(null);
    setOffModalCode(null);
  }

  function undoLastScan() {
    if (!continuousScanning) {
      if (!lastOffEntry) return;
      const { key, amount } = lastOffEntry;
      setLines((prev) =>
        prev
          .map((l) => (l.key === key ? { ...l, receivedQuantity: Math.max(0, l.receivedQuantity - amount) } : l))
          .filter((l) => !(l.orderedQuantity === 0 && l.receivedQuantity === 0)),
      );
      setLastOffEntry(null);
      return;
    }
    if (!lastScannedKey) return;
    setLines((prev) =>
      prev
        .map((l) => (l.key === lastScannedKey ? { ...l, receivedQuantity: Math.max(0, l.receivedQuantity - 1) } : l))
        .filter((l) => !(l.orderedQuantity === 0 && l.receivedQuantity === 0)),
    );
    setLastScannedKey(null);
  }

  function restart() {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    pendingRef.current = [];
    if (countElRef.current) countElRef.current.textContent = "0";
    setBuffering(false);
    localStorage.removeItem(pendingKey(po.poId));
    setLastScannedKey(null);
    setLastOffEntry(null);

    if (blind) {
      setLines([]);
    } else {
      const masterlist = masterlistRef.current;
      setLines(
        po.lines.map((l, index) => ({
          key: l.code ?? `ordered-${index}`,
          code: l.code,
          description: l.description,
          itemId: l.itemId,
          orderedQuantity: l.orderedQuantity,
          receivedQuantity: 0,
          inMasterlist: l.code !== null && (masterlist?.has(l.code) ?? false),
          unitSymbol: l.unitSymbol,
        })),
      );
    }
  }

  // Restart/edit/delete are line adjustments — permitted only for holders of
  // "Adjust/Delete Delivery Lines". Controls are hidden/disabled otherwise (server re-checks).
  function requestRestart() {
    if (canAdjustLines) restart();
  }

  function requestEdit(line: ReceivingLine) {
    if (canAdjustLines) setEditingKey(line.key);
  }

  function requestDelete(line: ReceivingLine) {
    if (canAdjustLines) setLines((prev) => prev.filter((l) => l.key !== line.key));
  }

  function applyEdit(key: string, value: number) {
    const qty = Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
    setLines((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, receivedQuantity: qty } : l))
        .filter((l) => !(l.orderedQuantity === 0 && l.receivedQuantity === 0)),
    );
    setEditingKey(null);
  }

  function applyReturnExcess(line: ReceivingLine) {
    const returnedTo = line.orderedQuantity; // 0 for Not-Ordered
    const event: ReturnExcessEvent = {
      code: line.code!,
      receivedQuantity: line.receivedQuantity,
      returnedToQuantity: returnedTo,
    };
    setReturnExcessEvents((prev) => {
      const existing = prev.findIndex((e) => e.code === event.code);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = event;
        return next;
      }
      return [...prev, event];
    });
    if (returnedTo === 0) {
      // Not-Ordered line returned to 0 — drop from visible lines (kept in events for audit).
      setLines((prev) => prev.filter((l) => l.key !== line.key));
    } else {
      setLines((prev) =>
        prev.map((l) => (l.key === line.key ? { ...l, receivedQuantity: returnedTo } : l)),
      );
    }
    setPendingReturnExcess(null);
    setEditingKey(null);
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const snapshot = { items: lines.length, units: totalQuantity };
      const realLines = lines
        .filter((l) => l.code !== null && !(l.orderedQuantity === 0 && !l.inMasterlist))
        .map((l) => ({ code: l.code as string, receivedQuantity: l.receivedQuantity }));
      const newItems = lines
        .filter((l) => l.orderedQuantity === 0 && !l.inMasterlist && l.code !== null && l.receivedQuantity > 0)
        .map((l) => ({ code: l.code as string, quantity: l.receivedQuantity }));

      // Blind mode and discrepancy approval are NOT sent — the server resolves blind mode from
      // settings and re-checks the committer's approve permission, so neither can be bypassed.
      const body: Record<string, unknown> = {
        poId: po.poId,
        lines: realLines,
        newItems,
        continuousScanning,
        returnExcessEvents,
      };

      const res = await fetch("/delivery/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? "Failed to save delivery.");
        return;
      }
      onSaved(data as DeliveryResult, snapshot);
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const breakdown = useMemo(() => buildBreakdown(lines), [lines]);
  const totalQuantity = useMemo(() => lines.reduce((sum, l) => sum + l.receivedQuantity, 0), [lines]);
  const receivedOrderedQty = useMemo(
    () => lines.filter((l) => l.orderedQuantity > 0).reduce((sum, l) => sum + l.receivedQuantity, 0),
    [lines],
  );
  const totalOrderedQty = useMemo(
    () => po.lines.reduce((sum, l) => sum + l.orderedQuantity, 0),
    [po.lines],
  );
  const scannedOrderedCount = useMemo(
    () => lines.filter((l) => l.orderedQuantity > 0 && l.receivedQuantity > 0).length,
    [lines],
  );
  const scannedCount = useMemo(
    () => lines.filter((l) => l.receivedQuantity > 0).length,
    [lines],
  );

  const undoDisabled = continuousScanning ? !lastScannedKey : !lastOffEntry;
  // On Review, show full blind detail only to a user who can approve discrepancies.
  const showFullDetail = !blind || canApproveDiscrepancies;

  return (
    <main className="mx-auto max-w-screen-md space-y-4 p-4 pb-28">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={reviewMode ? onBackToReceiving : onCancel}
          className="type-body text-muted-foreground transition-colors hover:text-foreground"
        >
          ← {reviewMode ? "Back to scanning" : "Cancel"}
        </button>
        <h1 className="type-page-title">{reviewMode ? "Review Delivery" : "Receiving"}</h1>
        {blind && (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 type-caption text-muted-foreground">
            <EyeOff className="size-3.5" /> Blind
          </span>
        )}
      </div>

      <Card className="space-y-1 p-4">
        <div className="flex items-center justify-between">
          <span className="type-data font-semibold">{po.poCode}</span>
          {!reviewMode && (
            buffering ? (
              <span className="inline-flex items-center gap-1.5 type-caption text-primary motion-safe:animate-pulse">
                <ScanLine className="size-4" /> Receiving scans… <span ref={countElRef}>{pendingRef.current.length}</span> queued
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 type-caption text-primary">
                <ScanLine className="size-4" /> Scanner active
              </span>
            )
          )}
        </div>
        <span className="type-body block">{po.supplierName}</span>
        {showFullDetail ? (
          <>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="success">Exact {breakdown.exact}</Badge>
              <Badge variant="warning">Over {breakdown.overServed}</Badge>
              <Badge variant="neutral">Under {breakdown.underServed}</Badge>
              <Badge variant="incoming">Not Ordered {breakdown.notOrdered}</Badge>
              <Badge variant="critical">New {breakdown.newItem}</Badge>
            </div>
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between type-caption">
                <span className="font-medium text-primary">{scannedOrderedCount} {scannedOrderedCount === 1 ? "item" : "items"} scanned</span>
                <span className="text-muted-foreground">{receivedOrderedQty} / {totalOrderedQty} units</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${totalOrderedQty > 0 ? Math.min(100, (receivedOrderedQty / totalOrderedQty) * 100) : 0}%` }}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="mt-2 type-caption font-medium text-primary">
            In progress · {scannedCount} {scannedCount === 1 ? "item" : "items"} · {totalQuantity} units received
          </div>
        )}
      </Card>

      {!reviewMode && (
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={undoLastScan} disabled={undoDisabled}>
            <Undo2 className="size-4" /> Undo last scan
          </Button>
          {canAdjustLines && (
            <Button variant="secondary" className="flex-1" onClick={requestRestart}>
              <RotateCcw className="size-4" /> Restart
            </Button>
          )}
        </div>
      )}

      {/* Blind-mode discrepancy gate: user without the approve permission sees a neutral block */}
      {reviewMode && blind && hasDiscrepancy && !canApproveDiscrepancies && (
        <Card className="space-y-3 border-warning p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" />
            <div className="space-y-1">
              <p className="type-body font-medium">Approval required</p>
              <p className="type-caption text-muted-foreground">
                This delivery cannot be saved without approval. Please ask someone with the
                &ldquo;Approve Delivery Discrepancies&rdquo; permission to review and save it.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* When the committer can approve, discrepancies are revealed and recorded against them */}
      {reviewMode && blind && hasDiscrepancy && canApproveDiscrepancies && (
        <Card className="flex items-start gap-3 border-primary p-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-primary" />
          <p className="type-caption text-muted-foreground">
            This delivery has discrepancies. Saving records you as the approver.
          </p>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {lines.length === 0 && !buffering && (
          <div className="py-12 text-center type-body text-muted-foreground">
            Scan an item to begin receiving.
          </div>
        )}
        {lines.map((line) => {
          const status = lineStatus(line);
          const meta = STATUS_META[status];
          // In blind mode show status chips only to an approver, or for New Items (always visible).
          const showStatusChip = showFullDetail || status === "new_item";
          const isFlagged = status === "over_served" || status === "not_ordered";
          // Return Excess: visible to an approver in blind review for flagged lines.
          const showReturnExcess = reviewMode && blind && canApproveDiscrepancies && isFlagged && line.code !== null;
          return (
            <Card key={line.key} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <span className="type-body block truncate font-medium">{line.description}</span>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 type-caption">
                  {line.code && <span className="type-data">{line.code}</span>}
                  {line.unitSymbol && <span>{line.unitSymbol}</span>}
                  {showFullDetail && <span>Ordered {line.orderedQuantity}</span>}
                  {showStatusChip && <Badge variant={meta.variant}>{meta.label}</Badge>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {editingKey === line.key ? (
                  <InlineQtyEditor
                    initial={line.receivedQuantity}
                    onSave={(value) => applyEdit(line.key, value)}
                    onCancel={() => setEditingKey(null)}
                  />
                ) : (
                  <>
                    <span className="type-data w-10 text-right text-lg font-semibold tabular-nums">
                      {line.receivedQuantity}
                    </span>
                    {showReturnExcess && (
                      <Button variant="ghost" size="compact" onClick={() => setPendingReturnExcess(line)}>
                        Return
                      </Button>
                    )}
                    {canAdjustLines && (
                      <Button variant="ghost" size="compact" onClick={() => requestEdit(line)}>
                        Edit
                      </Button>
                    )}
                    {canAdjustLines && line.orderedQuantity === 0 && (
                      <Button variant="ghost" size="compact" onClick={() => requestDelete(line)}>
                        Delete
                      </Button>
                    )}
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {saveError && <p className="type-body text-destructive">{saveError}</p>}

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background p-4">
        <div className="mx-auto flex max-w-screen-md gap-3">
          {reviewMode ? (
            <Button className="w-full" onClick={save} disabled={saving || !canSave}>
              {saving ? "Saving…" : "Save Delivery"}
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={() => { if (continuousScanning) flushScans(); onReview(); }}
              disabled={lines.length === 0 && !buffering}
            >
              {buffering ? "Finishing scans…" : `Review (${lines.length})`}
            </Button>
          )}
        </div>
      </div>

      {offModalCode !== null && (
        <QuantityModal
          code={offModalCode}
          onConfirm={confirmOffEntry}
          onCancel={() => setOffModalCode(null)}
        />
      )}

      {pendingReturnExcess !== null && (
        <ReturnExcessModal
          line={pendingReturnExcess}
          onConfirm={() => applyReturnExcess(pendingReturnExcess)}
          onCancel={() => setPendingReturnExcess(null)}
        />
      )}
    </main>
  );
}

function InlineQtyEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: number;
  onSave: (value: number) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(String(initial));
  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        min={0}
        inputMode="numeric"
        value={value}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        className="h-10 w-20"
      />
      <Button size="compact" onClick={() => onSave(Number(value))}>Save</Button>
      <Button variant="ghost" size="compact" onClick={onCancel}>Cancel</Button>
    </div>
  );
}

/** Confirm dialog before snapping a line down to ordered qty (FR-15). */
function ReturnExcessModal({
  line,
  onConfirm,
  onCancel,
}: {
  line: ReceivingLine;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const returnedTo = line.orderedQuantity; // 0 for Not-Ordered
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <Card className="w-full max-w-sm space-y-4 p-5">
        <div className="space-y-1">
          <h2 className="type-section-title">Return excess?</h2>
          <p className="type-body font-medium truncate">{line.description}</p>
          <p className="type-caption text-muted-foreground">
            Received: {line.receivedQuantity} → {returnedTo === 0 ? "0 (remove)" : `${returnedTo} (ordered qty)`}.
            This discards the excess and cannot be undone without editing the quantity manually.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button className="flex-1" onClick={onConfirm}>Return excess</Button>
        </div>
      </Card>
    </div>
  );
}

function QuantityModal({
  code,
  onConfirm,
  onCancel,
}: {
  code: string;
  onConfirm: (quantity: number) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");

  const parsed = parseInt(value, 10);
  const valid = Number.isInteger(parsed) && parsed > 0 && String(parsed) === value.trim();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    onConfirm(parsed);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <Card className="w-full max-w-sm space-y-4 p-5">
        <div className="space-y-1">
          <h2 className="type-section-title">Enter quantity</h2>
          <p className="type-data text-muted-foreground">{code}</p>
        </div>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <Label htmlFor="off-qty">Quantity received</Label>
            <Input
              id="off-qty"
              type="number"
              min={1}
              step={1}
              value={value}
              autoFocus
              onChange={(e) => setValue(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={!valid}>
              Add
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function SuccessScreen({
  po,
  result,
  blind,
  snapshot,
  onDone,
}: {
  po: PurchaseOrderForReceiving;
  result: DeliveryResult;
  blind: boolean;
  snapshot: { items: number; units: number } | null;
  onDone: () => void;
}) {
  const b = result.statusBreakdown;
  return (
    <main className="mx-auto max-w-screen-md space-y-5 p-4">
      <h1 className="type-page-title">Delivery saved</h1>
      <Card className="space-y-3 p-5">
        <div className="space-y-1">
          <span className="type-caption">New purchase order</span>
          <p className="type-data text-lg font-semibold text-success">{result.newPoCode}</p>
        </div>
        <div className="space-y-1">
          <span className="type-caption">Superseded (closed) PO</span>
          <p className="type-data">{result.closedOriginalPoCode}</p>
        </div>
        <div className="space-y-1">
          <span className="type-caption">Supplier</span>
          <p className="type-body">{po.supplierName}</p>
        </div>
        {blind && snapshot ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 type-caption text-muted-foreground">
            <span>{snapshot.items} items received</span>
            <span>{snapshot.units} units total</span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="success">Exact {b.exact}</Badge>
            <Badge variant="warning">Over {b.overServed}</Badge>
            <Badge variant="neutral">Under {b.underServed}</Badge>
            <Badge variant="incoming">Not Ordered {b.notOrdered}</Badge>
            <Badge variant="critical">New {b.newItem}</Badge>
          </div>
        )}
      </Card>
      <Button className="w-full" onClick={onDone}>Back to purchase orders</Button>
    </main>
  );
}
