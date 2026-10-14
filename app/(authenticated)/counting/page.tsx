"use client";

import { Suspense, useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Undo2, ScanLine, RotateCcw, ClipboardList } from "lucide-react";
import { useScanner } from "@/shared/ui/useScanner";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Label } from "@/shared/ui/label";
import { Skeleton } from "@/shared/ui/skeleton";

interface CountableItem {
  code: string;
  itemId: number;
  description: string;
  unitSymbol: string;
}

interface CountLine {
  key: string;
  code: string;
  itemId: number;
  description: string;
  unitSymbol: string;
  quantity: number;
}

interface CountResult {
  code: string;
  inventoryCountId: number;
  itemCount: number;
  totalUnits: number;
}

type Screen = "counting" | "review" | "success";

const DEFAULT_SCAN_BATCH_DELAY_MS = 2000;
const LOCATION_ENTRY = "/location?module=counting&returnTo=%2Fcounting";

function storageKey(locationId: number): string {
  return `counting:location:${locationId}`;
}

function pendingKey(locationId: number): string {
  return `counting:location:${locationId}:pending`;
}

function applyScans(
  lines: CountLine[],
  codes: string[],
  itemsByCode: Map<string, CountableItem>,
): { next: CountLine[]; lastKey: string | null; unknown: string[] } {
  if (codes.length === 0) return { next: lines, lastKey: null, unknown: [] };

  const counts = new Map<string, number>();
  const unknown: string[] = [];
  let lastKey: string | null = null;
  for (const code of codes) {
    if (!itemsByCode.has(code)) {
      unknown.push(code);
      continue;
    }
    counts.set(code, (counts.get(code) ?? 0) + 1);
    lastKey = code;
  }
  if (counts.size === 0) return { next: lines, lastKey: null, unknown };

  const next = lines.map((l) => ({ ...l }));
  const indexByCode = new Map<string, number>();
  next.forEach((l, i) => indexByCode.set(l.code, i));

  for (const [code, increment] of counts) {
    const i = indexByCode.get(code);
    if (i !== undefined) {
      next[i].quantity += increment;
    } else {
      const item = itemsByCode.get(code)!;
      indexByCode.set(code, next.length);
      next.push({
        key: code,
        code,
        itemId: item.itemId,
        description: item.description,
        unitSymbol: item.unitSymbol,
        quantity: increment,
      });
    }
  }
  return { next, lastKey, unknown };
}

function restoreLines(locationId: number): CountLine[] {
  try {
    const raw = localStorage.getItem(storageKey(locationId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { lines?: CountLine[] };
    return Array.isArray(parsed.lines) ? parsed.lines : [];
  } catch {
    return [];
  }
}

function CountingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const locationIdParam = searchParams.get("locationId");
  const locationId = locationIdParam ? Number(locationIdParam) : null;

  const [screen, setScreen] = useState<Screen>("counting");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Map<string, CountableItem>>(new Map());
  const [continuousScanning, setContinuousScanning] = useState(true);
  const [scanBatchDelayMs, setScanBatchDelayMs] = useState(DEFAULT_SCAN_BATCH_DELAY_MS);
  const [canSave, setCanSave] = useState(false);
  const [gateReason, setGateReason] = useState<string | null>(null);
  const [canAdjustLines, setCanAdjustLines] = useState(false);

  const [lines, setLines] = useState<CountLine[]>([]);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<CountResult | null>(null);

  useEffect(() => {
    if (!locationId || !Number.isInteger(locationId) || locationId <= 0) {
      router.replace(LOCATION_ENTRY);
    }
  }, [locationId, router]);

  useEffect(() => {
    if (!locationId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/counting/api?locationId=${locationId}`).then((r) => {
        if (!r.ok) throw new Error();
        return r.json() as Promise<{ items: CountableItem[]; canSave: boolean; gateReason: string | null; canAdjustLines: boolean }>;
      }),
      fetch("/admin/api/settings")
        .then((r) => r.json())
        .catch(() => null),
    ])
      .then(([data, settings]) => {
        setItems(new Map(data.items.map((i) => [i.code, i])));
        setCanSave(data.canSave);
        setGateReason(data.gateReason);
        setCanAdjustLines(data.canAdjustLines);
        setLines(restoreLines(locationId));
        const s = (settings as { settings?: { counting_continuous_scanning?: boolean; scan_batch_delay_ms?: number } } | null)?.settings;
        setContinuousScanning(s?.counting_continuous_scanning ?? true);
        const delay = Number(s?.scan_batch_delay_ms);
        if (Number.isFinite(delay) && delay > 0) setScanBatchDelayMs(delay);
      })
      .catch(() => setError("Failed to load items for this location. Please try again."))
      .finally(() => setLoading(false));
  }, [locationId]);

  function resetAll() {
    if (locationId) {
      localStorage.removeItem(storageKey(locationId));
      localStorage.removeItem(pendingKey(locationId));
    }
    setLines([]);
    setNote("");
    setResult(null);
    setScreen("counting");
  }

  if (!locationId) {
    return (
      <main className="p-4">
        <div className="py-16 text-center type-body text-muted-foreground">Redirecting…</div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-screen-md space-y-4 p-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="type-body text-muted-foreground transition-colors hover:text-foreground">← Home</Link>
          <h1 className="type-page-title">Counting</h1>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-screen-md space-y-4 p-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="type-body text-muted-foreground transition-colors hover:text-foreground">← Home</Link>
          <h1 className="type-page-title">Counting</h1>
        </div>
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="type-body text-destructive">{error}</p>
          <Button variant="link" size="sm" onClick={() => location.reload()}>Retry</Button>
        </div>
      </main>
    );
  }

  if (screen === "success" && result) {
    return <SuccessScreen result={result} onDone={resetAll} />;
  }

  return (
    <CountingScreen
      locationId={locationId}
      items={items}
      continuousScanning={continuousScanning}
      scanBatchDelayMs={scanBatchDelayMs}
      canSave={canSave}
      gateReason={gateReason}
      canAdjustLines={canAdjustLines}
      lines={lines}
      setLines={setLines}
      note={note}
      setNote={setNote}
      reviewMode={screen === "review"}
      onReview={() => setScreen("review")}
      onBackToCounting={() => setScreen("counting")}
      onSaved={(r) => {
        localStorage.removeItem(storageKey(locationId));
        localStorage.removeItem(pendingKey(locationId));
        setResult(r);
        setScreen("success");
      }}
    />
  );
}

function CountingScreen({
  locationId,
  items,
  continuousScanning,
  scanBatchDelayMs,
  canSave,
  gateReason,
  canAdjustLines,
  lines,
  setLines,
  note,
  setNote,
  reviewMode,
  onReview,
  onBackToCounting,
  onSaved,
}: {
  locationId: number;
  items: Map<string, CountableItem>;
  continuousScanning: boolean;
  scanBatchDelayMs: number;
  canSave: boolean;
  gateReason: string | null;
  canAdjustLines: boolean;
  lines: CountLine[];
  setLines: React.Dispatch<React.SetStateAction<CountLine[]>>;
  note: string;
  setNote: React.Dispatch<React.SetStateAction<string>>;
  reviewMode: boolean;
  onReview: () => void;
  onBackToCounting: () => void;
  onSaved: (result: CountResult) => void;
}) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [offModalCode, setOffModalCode] = useState<string | null>(null);
  const [lastScannedKey, setLastScannedKey] = useState<string | null>(null);
  const [lastOffEntry, setLastOffEntry] = useState<{ key: string; amount: number } | null>(null);
  const [rejected, setRejected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const pendingRef = useRef<string[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countElRef = useRef<HTMLSpanElement>(null);
  const [buffering, setBuffering] = useState(false);

  // Persist draft on every change.
  useEffect(() => {
    localStorage.setItem(storageKey(locationId), JSON.stringify({ lines }));
  }, [locationId, lines]);

  const flushScans = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    const batch = pendingRef.current;
    pendingRef.current = [];
    localStorage.removeItem(pendingKey(locationId));
    setBuffering(false);
    if (batch.length === 0) return;

    setLines((prev) => {
      const { next, lastKey, unknown } = applyScans(prev, batch, items);
      if (unknown.length > 0) setRejected(unknown[unknown.length - 1]);
      if (lastKey) setLastScannedKey(lastKey);
      return next;
    });
  }, [locationId, items, setLines]);

  const handleScan = useCallback(
    (barcode: string) => {
      const code = barcode.trim();
      if (!code) return;
      setRejected(null);

      if (!continuousScanning) {
        if (offModalCode !== null) return; // swallow scans while modal open (FR-8)
        if (!items.has(code)) {
          setRejected(code);
          return;
        }
        setOffModalCode(code);
        return;
      }

      const wasEmpty = pendingRef.current.length === 0;
      pendingRef.current.push(code);
      localStorage.setItem(pendingKey(locationId), JSON.stringify(pendingRef.current));
      if (countElRef.current) countElRef.current.textContent = String(pendingRef.current.length);
      if (wasEmpty) setBuffering(true);
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = setTimeout(flushScans, scanBatchDelayMs);
    },
    [continuousScanning, offModalCode, items, locationId, flushScans, scanBatchDelayMs],
  );

  useScanner({ onScan: handleScan, enabled: !reviewMode && editingKey === null && offModalCode === null });

  useEffect(() => () => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
  }, []);

  function confirmOffEntry(quantity: number) {
    const code = offModalCode!;
    setLines((prev) => applyScans(prev, Array(quantity).fill(code), items).next);
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
          .map((l) => (l.key === key ? { ...l, quantity: Math.max(0, l.quantity - amount) } : l))
          .filter((l) => l.quantity > 0),
      );
      setLastOffEntry(null);
      return;
    }
    if (!lastScannedKey) return;
    setLines((prev) =>
      prev
        .map((l) => (l.key === lastScannedKey ? { ...l, quantity: Math.max(0, l.quantity - 1) } : l))
        .filter((l) => l.quantity > 0),
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
    localStorage.removeItem(pendingKey(locationId));
    setLastScannedKey(null);
    setLastOffEntry(null);
    setLines([]);
  }

  function applyEdit(key: string, value: number) {
    const qty = Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, quantity: qty } : l)).filter((l) => l.quantity > 0),
    );
    setEditingKey(null);
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/counting/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          note: note.trim() || null,
          continuousScanning,
          lines: lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? "Failed to save count.");
        return;
      }
      onSaved(data as CountResult);
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const totalUnits = useMemo(() => lines.reduce((sum, l) => sum + l.quantity, 0), [lines]);
  const undoDisabled = continuousScanning ? !lastScannedKey : !lastOffEntry;

  return (
    <main className="mx-auto max-w-screen-md space-y-4 p-4 pb-28">
      <div className="flex items-center gap-3">
        {reviewMode ? (
          <button
            type="button"
            onClick={onBackToCounting}
            className="type-body text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back to scanning
          </button>
        ) : (
          <Link href="/" className="type-body text-muted-foreground transition-colors hover:text-foreground">
            ← Home
          </Link>
        )}
        <h1 className="type-page-title">{reviewMode ? "Review Count" : "Counting"}</h1>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 type-caption text-muted-foreground">
          <ClipboardList className="size-3.5" /> {items.size.toLocaleString()} items
        </span>
      </div>

      <Card className="flex items-center justify-between gap-3 p-4">
        <div className="type-caption font-medium text-primary">
          {lines.length} {lines.length === 1 ? "item" : "items"} · {totalUnits} units counted
        </div>
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
      </Card>

      {!reviewMode && items.size === 0 && (
        <Card className="border-warning p-3">
          <p className="type-caption text-warning">
            No items are loaded for scanning. An admin needs to refresh the item cache in Admin → General → Item Masterlist Cache.
          </p>
        </Card>
      )}

      {!reviewMode && rejected && (
        <Card className="border-destructive p-3">
          <p className="type-caption text-destructive">
            Unknown barcode <span className="type-data">{rejected}</span> — not in the item list. Nothing was counted.
          </p>
        </Card>
      )}

      {!reviewMode && (
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={undoLastScan} disabled={undoDisabled}>
            <Undo2 className="size-4" /> Undo last scan
          </Button>
          <Button variant="secondary" className="flex-1" onClick={restart} disabled={lines.length === 0 && !buffering}>
            <RotateCcw className="size-4" /> Restart
          </Button>
        </div>
      )}

      {reviewMode && (
        <div className="space-y-1">
          <Label htmlFor="count-note">Note (optional)</Label>
          <Input
            id="count-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={255}
            placeholder="e.g. section, brand, or reason"
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        {lines.length === 0 && !buffering && (
          <div className="py-12 text-center type-body text-muted-foreground">
            Scan an item to begin counting.
          </div>
        )}
        {lines.map((line) => (
          <Card key={line.key} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <span className="type-body block truncate font-medium">{line.description}</span>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 type-caption">
                <span className="type-data">{line.code}</span>
                {line.unitSymbol && <span className="type-data">{line.unitSymbol}</span>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {editingKey === line.key ? (
                <InlineQtyEditor
                  initial={line.quantity}
                  onSave={(value) => applyEdit(line.key, value)}
                  onCancel={() => setEditingKey(null)}
                />
              ) : (
                <>
                  <span className="type-data w-10 text-right text-lg font-semibold tabular-nums">{line.quantity}</span>
                  {reviewMode && canAdjustLines && (
                    <>
                      <Button
                        variant="ghost"
                        size="compact"
                        onClick={() => setEditingKey(line.key)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="compact"
                        onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          </Card>
        ))}
      </div>

      {reviewMode && !canSave && gateReason && (
        <Card className="border-warning p-3">
          <p className="type-caption text-warning">{gateReason}</p>
        </Card>
      )}
      {saveError && <p className="type-body text-destructive">{saveError}</p>}

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background p-4">
        <div className="mx-auto flex max-w-screen-md gap-3">
          {reviewMode ? (
            <Button className="w-full" onClick={save} disabled={saving || !canSave || lines.length === 0}>
              {saving ? "Saving…" : "Save Count"}
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={() => { flushScans(); onReview(); }}
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
          description={items.get(offModalCode)?.description ?? offModalCode}
          onConfirm={confirmOffEntry}
          onCancel={() => setOffModalCode(null)}
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
        min={1}
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

function QuantityModal({
  code,
  description,
  onConfirm,
  onCancel,
}: {
  code: string;
  description: string;
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
          <p className="type-body font-medium truncate">{description}</p>
          <p className="type-data text-muted-foreground">{code}</p>
        </div>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <Label htmlFor="off-qty">Quantity counted</Label>
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
            <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={!valid}>Add</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function SuccessScreen({ result, onDone }: { result: CountResult; onDone: () => void }) {
  return (
    <main className="mx-auto max-w-screen-md space-y-5 p-4">
      <h1 className="type-page-title">Count saved</h1>
      <Card className="space-y-3 p-5">
        <div className="space-y-1">
          <span className="type-caption">Inventory count</span>
          <p className="type-data text-lg font-semibold text-success">{result.code}</p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 type-caption text-muted-foreground">
          <span>{result.itemCount} {result.itemCount === 1 ? "item" : "items"} counted</span>
          <span>{result.totalUnits} units total</span>
        </div>
      </Card>
      <Button className="w-full" onClick={onDone}>Start a new count</Button>
    </main>
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
      <CountingPage />
    </Suspense>
  );
}
