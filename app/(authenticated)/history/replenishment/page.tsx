"use client";

import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/ui/utils";
import type { ReplenishmentRunSummary } from "@/history/domain/ReplenishmentRunSummary";

const MANILA_OFFSET = 8 * 60 * 60 * 1000;

interface Supplier {
  id: number;
  name: string;
  nextOrderDate: string | null;
  dueStatus: "due_today" | "due_tomorrow" | "other" | "unscheduled";
}

// Segmented-toggle segment, matching the replenishment controls-bar style.
function seg(active: boolean): string {
  return cn(
    "min-h-11 rounded-md px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active
      ? "bg-background text-foreground shadow-sm"
      : "text-muted-foreground hover:text-foreground"
  );
}

function toManilaDatetime(isoStr: string): string {
  const d = new Date(isoStr.endsWith("Z") ? isoStr : isoStr + "Z");
  const manila = new Date(d.getTime() + MANILA_OFFSET);
  return manila.toLocaleString("en-PH", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
    timeZone: "UTC", // already shifted
  });
}

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

// Renders `text` with every case-insensitive occurrence of `query` wrapped in a
// highlight. `query` is expected pre-lowercased (the search box lowercases once).
function Highlight({ text, query }: { text: string; query: string }): React.ReactNode {
  if (!query) return text;
  const safe = String(text ?? "");
  const lower = safe.toLowerCase();
  const parts: React.ReactNode[] = [];
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

// Downloads every run matching the current filters — not just loaded rows —
// by following the API's cursor until exhausted.
async function fetchAllRuns(buildParams: (extra: Record<string, string>) => string): Promise<ReplenishmentRunSummary[]> {
  const all: ReplenishmentRunSummary[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 100; page++) {
    const res: Response = await fetch(`/history/replenishment/api?${buildParams({ limit: "100", ...(cursor ? { cursor } : {}) })}`);
    const data = (await res.json()) as { items?: ReplenishmentRunSummary[]; nextCursor?: string | null; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Failed");
    all.push(...(data.items ?? []));
    cursor = data.nextCursor ?? null;
    if (!cursor) return all;
  }
  return all;
}

function exportListCsv(runs: ReplenishmentRunSummary[]) {
  const header = ["Run ID", "Date", "Path", "Status", "Location", "Created By", "Suppliers", "POs", "Lines", "Approved By"];
  const rows = runs.map((r) => [
    r.id,
    toManilaDatetime(r.createdAt),
    r.path === "standard" ? "Standard" : "Stockout",
    r.status,
    r.locationName,
    r.createdByName,
    r.supplierNames.join(", "),
    r.poCount,
    r.lineCount,
    r.approvedByUserName ?? "",
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "replenishment-history.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function SupplierDropdown({
  suppliers,
  selectedId,
  onChange,
}: {
  suppliers: Supplier[];
  selectedId: number | null;
  onChange: (id: number | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedSupplier = suppliers.find((s) => s.id === selectedId);

  // 1. Instant local array filtering eliminates the async "searching" timeout flash
  const filteredResults = suppliers.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase())
  );

  // 2. Clear click-outside listener replaces tricky input blur races
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (selectedId != null) {
  return (
    <div className="flex min-h-12 min-w-0 flex-1 items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-0">
      <span className="type-body text-foreground truncate">
        {selectedSupplier?.name ?? "Supplier"}
      </span>
      <button
        type="button"
        aria-label="Clear supplier filter"
        onClick={() => onChange(null)}
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}


  return (
    <div ref={dropdownRef} className="relative flex-1 min-w-0">
      <Input
        placeholder="Search suppliers…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
      />
      
      {open && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md">
          {filteredResults.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">No suppliers found</p>
          ) : (
            filteredResults.map((supplier) => (
              <button
                key={supplier.id}
                type="button"
                onClick={() => {
                  onChange(supplier.id);
                  setQuery("");
                  setOpen(false);
                }}
                className="flex min-h-12 w-full items-center justify-between gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <span className="truncate">{supplier.name}</span>
                {supplier.nextOrderDate && (
                  <Badge
                    variant={
                      supplier.dueStatus === "due_today" ? "critical" :
                      supplier.dueStatus === "due_tomorrow" ? "warning" :
                      "neutral"
                    }
                    className="text-[10px] px-1.5 py-0.5 flex-shrink-0"
                  >
                    {supplier.dueStatus === "due_today" ? "Today" :
                     supplier.dueStatus === "due_tomorrow" ? "Tomorrow" : "Other"}
                  </Badge>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}


export default function Page() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [draftsOnly, setDraftsOnly] = useState(false);
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [runs, setRuns] = useState<ReplenishmentRunSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch suppliers for dropdown
  useEffect(() => {
    fetch("/supplier/api")
      .then((r) => r.json())
      .then((data: { suppliers: Supplier[] }) => {
        setSuppliers(data.suppliers ?? []);
      })
      .catch(() => {});
  }, []);

  const buildParams = useCallback(
    (extra: Record<string, string> = {}): string => {
      const sp = new URLSearchParams();
      if (q) sp.set("q", q);
      if (from) sp.set("from", from);
      if (to) sp.set("to", to);
      if (supplierId) sp.set("supplierId", String(supplierId));
      if (draftsOnly) sp.set("status", "draft");
      Object.entries(extra).forEach(([k, v]) => sp.set(k, v));
      return sp.toString();
    },
    [q, from, to, supplierId, draftsOnly],
  );

  // Deep link from the home approval banner: /history/replenishment?status=draft
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("status") === "draft") {
      setDraftsOnly(true);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/history/replenishment/api?${buildParams()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setRuns(data.items ?? []);
      setCursor(data.nextCursor ?? null);
    } catch {
      setError("Failed to load replenishment history.");
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(load, q ? 300 : 0);
  }, [load, q]);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/history/replenishment/api?${buildParams({ cursor })}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setRuns((prev) => [...prev, ...(data.items ?? [])]);
      setCursor(data.nextCursor ?? null);
    } catch {
      // Silently; user can retry by scrolling again.
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleExportCsv() {
    setExporting(true);
    setError(null);
    try {
      const all = await fetchAllRuns(buildParams);
      if (all.length > 0) exportListCsv(all);
    } catch {
      setError("Failed to export replenishment history.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="mx-auto max-w-screen-md space-y-4 p-4">
      <div className="flex items-center gap-3">
        <Link href="/history" className="type-body text-muted-foreground transition-colors hover:text-foreground">
          ← History
        </Link>
        <h1 className="type-page-title">Replenishment History</h1>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        <div className="flex flex-1 items-center gap-2 w-full">
            <SupplierDropdown
              suppliers={suppliers}
              selectedId={supplierId}
              onChange={setSupplierId}
            />
            <Input
              type="search"
              placeholder="Search PO code…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-48"
            />
            {(q || from || to || supplierId) && (
              <Button variant="ghost" size="sm" onClick={() => { setQ(""); setFrom(""); setTo(""); setSupplierId(null); }}>
                Clear
              </Button>
            )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-40"
            aria-label="From date"
          />
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-40"
            aria-label="To date"
          />
          <div className="inline-flex rounded-lg bg-muted p-0.5">
            <button type="button" className={seg(!draftsOnly)} onClick={() => setDraftsOnly(false)}>
              All
            </button>
            <button type="button" className={seg(draftsOnly)} onClick={() => setDraftsOnly(true)}>
              Drafts
            </button>
          </div>
          <Button variant="secondary" size="sm" onClick={handleExportCsv} disabled={exporting}>
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
        </div>
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[80px] w-full rounded-lg" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="py-10 text-center">
          <p className="type-body text-destructive">{error}</p>
          <Button variant="link" size="sm" onClick={load}>Retry</Button>
        </div>
      )}

      {!loading && !error && runs.length === 0 && (
        <div className="py-16 text-center type-body text-muted-foreground">
          No replenishment runs found.
        </div>
      )}

      {!loading && !error && runs.length > 0 && (
        <div className="space-y-2">
          {runs.map((run) => (
            <button
              key={run.id}
              type="button"
              onClick={() => router.push(`/history/replenishment/${run.id}`)}
              className="w-full rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-accent hover:bg-accent hover:text-accent-foreground motion-safe:active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="type-body font-semibold">{run.locationName}</span>
                    <Badge variant={run.path === "standard" ? "incoming" : "warning"} className="text-xs">
                      {run.path === "standard" ? "Standard" : "Stockout"}
                    </Badge>
                    {run.status === "draft" && (
                      <Badge variant="neutral" className="text-xs">Draft</Badge>
                    )}
                    {run.status === "deleted" && (
                      <Badge variant="neutral" className="text-xs">Deleted</Badge>
                    )}
                  </div>
                  <p className="type-caption mt-0.5 text-muted-foreground">
                    {toManilaDatetime(run.createdAt)} · {run.createdByName}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="type-caption text-muted-foreground line-clamp-2" title={run.supplierNames.join(", ")}>
                    {run.supplierNames.length > 0 ? run.supplierNames.join(", ") : "—"}
                  </p>
                  {run.poCodes.length > 0 && (
                    <p className="type-caption text-muted-foreground line-clamp-1 type-data text-xs" title={run.poCodes.join(", ")}>
                      {run.poCodes.map((code, i) => (
                        <Fragment key={`${run.id}-po-${i}`}>
                          <Highlight text={code} query={q.toLowerCase()} />
                          {i < run.poCodes.length - 1 && ", "}
                        </Fragment>
                      ))}
                    </p>
                  )}
                  <p className="type-caption text-muted-foreground">
                    {run.poCount} {run.poCount === 1 ? "PO" : "POs"} / {run.lineCount} {run.lineCount === 1 ? "line" : "lines"}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {cursor && !loading && (
        <div className="flex justify-center pt-2">
          <Button variant="secondary" size="sm" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </main>
  );
}