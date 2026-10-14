"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Checkbox } from "@/shared/ui/checkbox";
import { Skeleton } from "@/shared/ui/skeleton";
import type { DeliverySessionSummary } from "@/history/domain/DeliverySessionSummary";

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

export default function Page() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [approvedOnly, setApprovedOnly] = useState(false);
  const [sessions, setSessions] = useState<DeliverySessionSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildParams = useCallback(
    (extra: Record<string, string> = {}): string => {
      const sp = new URLSearchParams();
      if (q) sp.set("q", q);
      if (from) sp.set("from", from);
      if (to) sp.set("to", to);
      if (approvedOnly) sp.set("approvedOnly", "1");
      Object.entries(extra).forEach(([k, v]) => sp.set(k, v));
      return sp.toString();
    },
    [q, from, to, approvedOnly],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/history/delivery/api?${buildParams()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setSessions(data.items ?? []);
      setCursor(data.nextCursor ?? null);
    } catch {
      setError("Failed to load delivery history.");
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
      const res = await fetch(`/history/delivery/api?${buildParams({ cursor })}`);
      const data = await res.json();
      if (!res.ok) throw new Error();
      setSessions((prev) => [...prev, ...(data.items ?? [])]);
      setCursor(data.nextCursor ?? null);
    } catch {
      // Silent; user can retry.
    } finally {
      setLoadingMore(false);
    }
  }

  const hasActiveFilters = q || from || to || approvedOnly;

  return (
    <main className="mx-auto max-w-screen-md space-y-4 p-4">
      <div className="flex items-center gap-3">
        <Link href="/history" className="type-body text-muted-foreground transition-colors hover:text-foreground">
          ← History
        </Link>
        <h1 className="type-page-title">Delivery History</h1>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          placeholder="Search PO code…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-48"
        />
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
        {/* Approved discrepancies filter (FR-32) */}
        <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-3 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <Checkbox
            checked={approvedOnly}
            onCheckedChange={(v) => setApprovedOnly(v === true)}
          />
          Approved discrepancies only
        </label>
        {hasActiveFilters && (
          <Button variant="secondary" size="sm" onClick={() => { setQ(""); setFrom(""); setTo(""); setApprovedOnly(false); }}>
            Clear
          </Button>
        )}
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

      {!loading && !error && sessions.length === 0 && (
        <div className="py-16 text-center type-body text-muted-foreground">
          No delivery sessions found.
        </div>
      )}

      {!loading && !error && sessions.length > 0 && (
        <div className="space-y-2">
          {sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => router.push(`/history/delivery/${s.id}`)}
              className="w-full rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-accent hover:bg-accent hover:text-accent-foreground motion-safe:active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="type-body font-semibold">{s.locationName ?? "Unknown location"}</p>
                  <p className="type-caption text-muted-foreground">{s.supplierName ?? "Unknown supplier"}</p>
                  <p className="type-caption mt-0.5 text-muted-foreground">
                    {toManilaDatetime(s.createdAt)} · {s.receiverName ?? "Unknown receiver"}
                  </p>
                </div>
                <div className="shrink-0 text-right space-y-1 min-w-[110px]">
                  <p className="type-data text-muted-foreground">{s.originalPoCode ?? "—"} → {s.newPoCode}</p>
                  {s.discrepancyApproved && (
                    <Badge variant="warning">Approved</Badge>
                  )}
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
