"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSession } from "next-auth/react";
import { ChevronDown, ChevronLeft, ChevronRight, Printer, RefreshCw } from "lucide-react";
import { cn } from "@/shared/ui/utils";
import { Card } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/ui/dialog";
import type { ShelfGuideOverview, ShelfGuideDetail, PriorityTier } from "@/shelfguide/domain/ShelfGuide";

interface LocationOption {
  id: number;
  name: string;
}

interface LocationsResponse {
  locations: { id: number; name: string }[];
}

const SUPPLIERS_PER_PAGE = 20;

const PRIORITY_ORDER: PriorityTier[] = ["high", "medium", "low"];

const PRIORITY_LABEL: Record<PriorityTier, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PRIORITY_VARIANT: Record<PriorityTier, "success" | "warning" | "neutral"> = {
  high: "success",
  medium: "warning",
  low: "neutral",
};

function toDateString(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function defaultRange(): { from: string; to: string } {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 30);
  return { from: toDateString(from), to: toDateString(today) };
}

function formatManilaDatetime(d: Date): string {
  return d.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Manila",
  });
}

function ShareBar({ percent }: { percent: number }) {
  return (
    <div className="h-2 w-full min-w-[80px] overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${Math.min(100, percent)}%` }}
      />
    </div>
  );
}

function LocationPicker({
  locations,
  value,
  onChange,
  loading,
}: {
  locations: LocationOption[];
  value: string;
  onChange: (id: string) => void;
  loading: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  if (loading) return <Skeleton className="h-12 w-full" />;

  const selected = locations.find((l) => String(l.id) === value);
  const q = query.trim().toLowerCase();
  const matches = q ? locations.filter((l) => l.name.toLowerCase().includes(q)) : locations;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => !prev);
          setQuery("");
        }}
        className="flex h-12 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className={cn("truncate type-body", selected ? "text-foreground" : "text-muted-foreground")}>
          {selected ? selected.name : "Select location…"}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md">
          <Input
            autoFocus
            placeholder="Search locations…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {matches.length === 0 && <p className="px-2 py-2 type-caption">No locations found</p>}
          {matches.map((l) => (
            <button
              key={l.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(String(l.id));
                setQuery("");
                setOpen(false);
              }}
              className="flex min-h-12 w-full items-center rounded-sm px-2 py-2 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <span>{l.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supplierIdParam = searchParams.get("supplierId");
  const supplierId = supplierIdParam ? Number(supplierIdParam) : null;
  const isDetail = supplierId !== null;

  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);

  const initial = defaultRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [appliedFrom, setAppliedFrom] = useState(initial.from);
  const [appliedTo, setAppliedTo] = useState(initial.to);
  const [locationId, setLocationId] = useState("");
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<PriorityTier | null>(null);

  const [overview, setOverview] = useState<ShelfGuideOverview | null>(null);
  const [detail, setDetail] = useState<ShelfGuideDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [pendingPrint, setPendingPrint] = useState(false);
  const [printedByName, setPrintedByName] = useState("");
  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    fetch("/location/api?module=shelfguide&showAll=true")
      .then((r) => r.json())
      .then((data: LocationsResponse) => setLocations(data.locations))
      .catch(() => setLocations([]))
      .finally(() => setLocationsLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/shelfguide/api/default-location")
      .then((r) => r.json())
      .then((data: { locationId: number | null }) => {
        if (!cancelled && data.locationId != null) {
          setLocationId((prev) => (prev === "" ? String(data.locationId) : prev));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ from: appliedFrom, to: appliedTo });
      if (locationId) params.set("locationId", locationId);
      try {
        if (supplierId !== null) {
          const res = await fetch(`/shelfguide/api/${supplierId}?${params.toString()}`);
          if (res.status === 404) {
            if (!cancelled) setDetail(null);
          } else if (!res.ok) {
            throw new Error("load failed");
          } else {
            const data = (await res.json()) as ShelfGuideDetail;
            if (!cancelled) {
              setDetail(data);
              if (!locationId && data.locationId != null) {
                setLocationId(String(data.locationId));
              }
            }
          }
        } else {
          const res = await fetch(`/shelfguide/api?${params.toString()}`);
          if (!res.ok) throw new Error("load failed");
          const data = (await res.json()) as ShelfGuideOverview;
          if (!cancelled) {
            setOverview(data);
            if (!locationId && data.locationId != null) {
              setLocationId(String(data.locationId));
            }
          }
        }
      } catch {
        if (!cancelled) setError("Failed to load the shelf guide. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [appliedFrom, appliedTo, locationId, supplierId]);

  function applyDates() {
    setAppliedFrom(from);
    setAppliedTo(to);
  }

  const activeLocationName = useMemo(() => {
    const id = locationId || (detail?.locationId != null ? String(detail.locationId) : "");
    if (!id) return null;
    return locations.find((l) => String(l.id) === id)?.name ?? null;
  }, [locations, locationId, detail]);

  const filteredSuppliers = useMemo(() => {
    if (!overview) return [];
    const q = search.trim().toLowerCase();
    if (!q) return overview.suppliers;
    return overview.suppliers.filter((s) => s.name.toLowerCase().includes(q));
  }, [overview, search]);

  useEffect(() => {
    setPage(1);
  }, [search, overview]);

  const totalPages = Math.max(1, Math.ceil(filteredSuppliers.length / SUPPLIERS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageSuppliers = filteredSuppliers.slice(
    (currentPage - 1) * SUPPLIERS_PER_PAGE,
    currentPage * SUPPLIERS_PER_PAGE,
  );

  const filteredItems = useMemo(() => {
    if (!detail) return [];
    const q = search.trim().toLowerCase();
    return detail.items.filter((i) => {
      if (priorityFilter && i.priority !== priorityFilter) return false;
      if (!q) return true;
      return i.code.toLowerCase().includes(q) || i.description.toLowerCase().includes(q);
    });
  }, [detail, search, priorityFilter]);

  const priorityCounts = useMemo(() => {
    const counts: Record<PriorityTier, number> = { high: 0, medium: 0, low: 0 };
    if (detail) for (const item of detail.items) counts[item.priority] += 1;
    return counts;
  }, [detail]);

  useEffect(() => {
    if (!pendingPrint || !detail) return;
    const raf = requestAnimationFrame(() => {
      window.print();
      setPendingPrint(false);
      setPrintModalOpen(false);
    });
    return () => cancelAnimationFrame(raf);
  }, [pendingPrint, detail]);

  return (
    <>
      <main className="mx-auto max-w-screen-xl space-y-6 p-4 sm:p-6 print:hidden">
      <div className="flex items-center gap-3">
        <Link href="/" className="type-body text-muted-foreground transition-colors hover:text-foreground">
          ← Home
        </Link>
        <h1 className="type-page-title">Shelf Guide</h1>
      </div>

      {/* Controls bar */}
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-muted/50 p-4">
        <div className="flex w-full flex-col gap-1 sm:w-64">
          <label className="type-label text-muted-foreground" htmlFor="shelfguide-location">
            Location
          </label>
          <LocationPicker
            locations={locations}
            value={locationId}
            onChange={setLocationId}
            loading={locationsLoading}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="type-label text-muted-foreground">From</label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            onClick={(e) => (e.target as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
            className="w-auto cursor-pointer"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="type-label text-muted-foreground">To</label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            onClick={(e) => (e.target as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
            className="w-auto cursor-pointer"
          />
        </div>

        <div className="flex w-full flex-col gap-1 sm:w-64">
          <label className="type-label text-muted-foreground" htmlFor="shelfguide-search">
            {isDetail ? "Search items" : "Search suppliers"}
          </label>
          <Input
            id="shelfguide-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isDetail ? "Code or description…" : "Supplier name…"}
          />
        </div>

        <Button type="button" variant="secondary" onClick={applyDates} disabled={loading} className="ml-auto gap-2">
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </div>

      {error && <p className="type-body text-destructive">{error}</p>}

      {isDetail ? (
        detail === null && !loading ? (
          <Card className="p-8 text-center">
            <p className="type-body font-semibold">Supplier not found</p>
            <p className="type-caption mt-1">This supplier had no sales in the selected period.</p>
          </Card>
        ) : detail ? (
          <DetailView
            detail={detail}
            items={filteredItems}
            priorityCounts={priorityCounts}
            priorityFilter={priorityFilter}
            onPriorityFilter={setPriorityFilter}
            onBack={() => router.push("/shelfguide")}
            onPrint={() => setPrintModalOpen(true)}
          />
        ) : (
          <Skeleton className="h-64 w-full" />
        )
      ) : loading && overview === null ? (
        <Skeleton className="h-64 w-full" />
      ) : overview && overview.suppliers.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="type-body font-semibold">No sales in this period</p>
          <p className="type-caption mt-1">Try a different location or date range.</p>
        </Card>
      ) : overview ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="type-caption text-muted-foreground">
              {filteredSuppliers.length.toLocaleString()}{" "}
              {filteredSuppliers.length === 1 ? "supplier" : "suppliers"}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="compact"
                  onClick={() => setPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="min-w-24 text-center tabular-nums type-data text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="compact"
                  onClick={() => setPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  aria-label="Next page"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </div>
          {pageSuppliers.map((supplier) => (
            <button
              key={supplier.supplierId}
              onClick={() => router.push(`/shelfguide?supplierId=${supplier.supplierId}`)}
              className="block w-full rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50 motion-safe:active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="type-body font-semibold">{supplier.name}</span>
                    <Badge variant="neutral" className="rounded-full">
                      {supplier.itemCount} {supplier.itemCount === 1 ? "item" : "items"}
                    </Badge>
                  </div>
                  <p className="type-caption mt-1 truncate text-muted-foreground">
                    Top: <span className="type-data">{supplier.topItem.code}</span> · {supplier.topItem.description}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="type-data font-semibold">{supplier.sharePercent}%</span>
                  <p className="type-caption text-muted-foreground">
                    {supplier.totalSold.toLocaleString()} pcs
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <ShareBar percent={supplier.sharePercent} />
              </div>
            </button>
          ))}
        </div>
      ) : null}

      <Dialog open={printModalOpen} onOpenChange={(open) => { if (!open) setPrintModalOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Print Shelf Allocation Report</DialogTitle>
            <DialogDescription>
              Prints the allocation guide for {detail?.name ?? "this supplier"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="type-body">Total items</span>
              <span className="type-body font-medium">
                {detail ? detail.items.length.toLocaleString() : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="type-body">Page size</span>
              <span className="type-body text-muted-foreground">Letter — 8.5″ × 11″ (Landscape)</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPrintModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => setPendingPrint(true)}
              disabled={!detail}
            >
              <Printer className="size-4" />
              Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      </main>

      {detail && (
        <ShelfAllocationReport
          detail={detail}
          locationName={activeLocationName}
          from={appliedFrom}
          to={appliedTo}
          companyName={companyName}
          printedByName={printedByName}
        />
      )}
    </>
  );
}

function DetailView({
  detail,
  items,
  priorityCounts,
  priorityFilter,
  onPriorityFilter,
  onBack,
  onPrint,
}: {
  detail: ShelfGuideDetail;
  items: ShelfGuideDetail["items"];
  priorityCounts: Record<PriorityTier, number>;
  priorityFilter: PriorityTier | null;
  onPriorityFilter: (tier: PriorityTier | null) => void;
  onBack: () => void;
  onPrint: () => void;
}) {
  const totalItems = detail.items.length;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <button onClick={onBack} className="type-body text-muted-foreground transition-colors hover:text-foreground">
          ← Back to suppliers
        </button>
        <Button variant="secondary" size="sm" onClick={onPrint} className="gap-2">
          <Printer className="size-4" />
          Print
        </Button>
      </div>

      {/* Dashboard header */}
      <Card className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="type-section-title">{detail.name}</h2>
            <p className="type-caption text-muted-foreground">
              Allocation of total sales:{" "}
              <span className="type-data font-semibold text-foreground">{detail.sharePercent}%</span>
            </p>
          </div>
          <div className="text-right">
            <p className="type-label uppercase tracking-wide text-muted-foreground">Top seller</p>
            <p className="type-data font-semibold">{detail.topItem.code}</p>
            <p className="type-caption max-w-[220px] text-muted-foreground">{detail.topItem.description}</p>
            <p className="type-caption text-muted-foreground">{detail.topItem.totalSold.toLocaleString()} pcs</p>
          </div>
        </div>

        <div>
          <p className="type-label uppercase tracking-wide text-muted-foreground">Allocation priority</p>
          <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-muted">
            {PRIORITY_ORDER.map((tier) =>
              totalItems > 0 && priorityCounts[tier] > 0 ? (
                <button
                  key={tier}
                  type="button"
                  aria-label={`Filter to ${PRIORITY_LABEL[tier]} priority`}
                  title={`Filter to ${PRIORITY_LABEL[tier]} priority`}
                  onClick={() => onPriorityFilter(priorityFilter === tier ? null : tier)}
                  className={cn(
                    "h-full transition-opacity",
                    tier === "high" ? "bg-success" : tier === "medium" ? "bg-warning" : "bg-muted-foreground/40",
                    priorityFilter && priorityFilter !== tier ? "opacity-30" : "opacity-100",
                  )}
                  style={{ width: `${(priorityCounts[tier] / totalItems) * 100}%` }}
                />
              ) : null,
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {PRIORITY_ORDER.map((tier) => (
              <Badge key={tier} variant={PRIORITY_VARIANT[tier]} className="rounded-full">
                {PRIORITY_LABEL[tier]}: {priorityCounts[tier]}
              </Badge>
            ))}
            {priorityFilter && (
              <button
                type="button"
                onClick={() => onPriorityFilter(null)}
                className="type-label text-primary hover:underline"
              >
                Show all
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Item table */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left type-label text-muted-foreground">Code</th>
              <th className="px-3 py-2 text-left type-label text-muted-foreground">Item</th>
              <th className="px-3 py-2 text-left type-label text-muted-foreground">Priority</th>
              <th className="px-3 py-2 text-right type-label text-muted-foreground">Daily rate (pcs)</th>
              <th className="px-3 py-2 text-right type-label text-muted-foreground">On display</th>
              <th className="px-3 py-2 text-left type-label text-muted-foreground">Allocation</th>
              <th className="px-3 py-2 text-right type-label text-muted-foreground">Total sold</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.code} className="border-b border-border last:border-0">
                <td className="px-3 py-2 type-data whitespace-nowrap">{item.code}</td>
                <td className="px-3 py-2 type-body">{item.description}</td>
                <td className="px-3 py-2">
                  <Badge variant={PRIORITY_VARIANT[item.priority]} className="rounded-full">
                    {PRIORITY_LABEL[item.priority]}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-right tabular-nums type-data">{item.dailyRate}</td>
                <td className="px-3 py-2 text-right tabular-nums type-data">
                  {item.onDisplay.toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <ShareBar percent={item.allocationPercent} />
                    <span className="w-14 shrink-0 text-right tabular-nums type-data text-muted-foreground">
                      {item.allocationPercent}%
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums type-data">
                  {item.totalSold.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ShelfAllocationReport({
  detail,
  locationName,
  from,
  to,
  companyName,
  printedByName,
}: {
  detail: ShelfGuideDetail;
  locationName: string | null;
  from: string;
  to: string;
  companyName: string;
  printedByName: string;
}) {
  const printedAt = new Date();
  return (
    <>
      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 20mm 12mm 16mm;
          }

          body > * { display: none !important; }
          body > *:has(.print-report) { display: block !important; }
          .print-report { display: block !important; }

          .print-running-header {
            position: fixed;
            top: -15mm;
            left: 0;
            right: 0;
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            border-bottom: 1px solid #000;
            padding-bottom: 3mm;
            font-size: 8pt;
            color: #000;
          }

          .print-running-footer {
            position: fixed;
            bottom: -11mm;
            left: 0;
            right: 0;
            display: flex;
            justify-content: flex-end;
            border-top: 1px solid #000;
            padding-top: 2mm;
            font-size: 7pt;
            color: #000;
          }

          .print-report {
            color: #000;
            background: #fff;
          }
          .print-report * {
            color: #000 !important;
            background: transparent !important;
          }

          .print-doc-header { margin-bottom: 6mm; }
          .print-doc-title {
            font-size: 13pt;
            font-weight: bold;
            margin-bottom: 1mm;
          }
          .print-company-name {
            font-size: 9pt;
            margin-bottom: 1mm;
          }
          .print-supplier-ref {
            font-size: 16pt;
            font-weight: bold;
            margin-bottom: 3mm;
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

          .print-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: 8pt;
          }
          .print-table thead { display: table-header-group; }
          .print-table tr { break-inside: avoid; }
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
          .print-td-right {
            border-bottom: 1px solid #ccc;
            padding: 1.5mm 2mm;
            font-size: 8pt;
            overflow-wrap: break-word;
          }
          .print-td-left { text-align: left; }
          .print-td-right { text-align: right; }
          .print-td-code { white-space: nowrap; font-weight: bold; }
          .print-td-desc { font-weight: bold; }
        }
      `}</style>

      <div className="hidden print:block print-report">
        <div className="print-running-header">
          <span>Shelf Allocation Report — {detail.name}</span>
          <span>{locationName ?? ""}</span>
        </div>
        <div className="print-running-footer">
          <span>{detail.name}</span>
        </div>

        <div className="print-doc-header">
          <div className="print-doc-title">Shelf Allocation Report</div>
          <div className="print-company-name">{companyName || "Operations Hub"}</div>
          <div className="print-supplier-ref">{detail.name}</div>
          <div className="print-meta-grid">
            <span><strong>Location:</strong> {locationName ?? "—"}</span>
            <span><strong>Sales range:</strong> {from} → {to}</span>
            <span><strong>Share of total sales:</strong> {detail.sharePercent}%</span>
          </div>
          <div className="print-printed-line">
            Printed on {formatManilaDatetime(printedAt)} by {printedByName}
          </div>
        </div>

        <table className="print-table">
          <colgroup>
            <col style={{ width: "10%" }} />
            <col />
            <col style={{ width: "8%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "9%" }} />
          </colgroup>
          <thead>
            <tr>
              <th className="print-th-left">Code</th>
              <th className="print-th-left">Item</th>
              <th className="print-th-left">Priority</th>
              <th className="print-th-right">Daily rate (pcs)</th>
              <th className="print-th-right">On display</th>
              <th className="print-th-right">Allocation %</th>
              <th className="print-th-right">Total sold</th>
            </tr>
          </thead>
          <tbody>
            {detail.items.map((item) => (
              <tr key={item.code}>
                <td className="print-td-left print-td-code">{item.code}</td>
                <td className="print-td-left print-td-desc">{item.description}</td>
                <td className="print-td-left">{PRIORITY_LABEL[item.priority]}</td>
                <td className="print-td-right">{item.dailyRate}</td>
                <td className="print-td-right">{item.onDisplay.toLocaleString()}</td>
                <td className="print-td-right">{item.allocationPercent}%</td>
                <td className="print-td-right">{item.totalSold.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
