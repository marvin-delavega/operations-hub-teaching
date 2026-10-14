"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { RefreshCw, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/ui/utils";

interface SummaryRow {
  locationId: number;
  locationName: string;
  supplierId: number;
  supplierName: string;
  itemsToOrder: number;
  computedAt: string;
}

type WidgetState =
  | { status: "loading" }
  | { status: "success"; rows: SummaryRow[]; lastFetchedAt: Date }
  | { status: "error" };

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Points to the fork screen; users choose Standard or Stockout from there.
const PLAN_HREF = "/replenishment";

export function ReplenishmentWidget({ className }: { className?: string }) {
  const [state, setState] = useState<WidgetState>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [dueTodayCount, setDueTodayCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/supplier/api")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((data: { suppliers: { dueStatus: string }[] }) => {
        setDueTodayCount(data.suppliers.filter((s) => s.dueStatus === "due_today").length);
      })
      .catch(() => setDueTodayCount(null));
  }, []);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch("/replenishment/summary/api");
      if (!res.ok) throw new Error();
      const data: { rows: SummaryRow[] } = await res.json();
      setState({ status: "success", rows: data.rows, lastFetchedAt: new Date() });
    } catch {
      setState((prev) => (prev.status === "loading" ? { status: "error" } : prev));
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshError(false);
    try {
      const res = await fetch("/replenishment/summary/api", { method: "POST" });
      if (!res.ok) throw new Error();
      // After recompute succeeds, re-fetch to get fresh rows and update timestamp
      const getRes = await fetch("/replenishment/summary/api");
      if (!getRes.ok) throw new Error();
      const data: { rows: SummaryRow[] } = await getRes.json();
      setState({ status: "success", rows: data.rows, lastFetchedAt: new Date() });
    } catch {
      setRefreshError(true);
    } finally {
      setRefreshing(false);
    }
  };

  if (state.status === "loading") {
    return (
      <Card className={cn("flex flex-col", className)}>
        <CardHeader>
          <CardTitle>Replenishment</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (state.status === "error") {
    return (
      <Card className={cn("flex flex-col", className)}>
        <CardHeader>
          <CardTitle>Replenishment</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
          <AlertCircle className="h-8 w-8 text-critical" />
          <p className="type-body text-muted-foreground">
            Could not load replenishment status.
          </p>
          <Button variant="secondary" size="sm" onClick={() => { setState({ status: "loading" }); fetchSummary(); }}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { rows, lastFetchedAt } = state;
  const allClear = rows.length === 0;

  const locationGroups = rows.reduce<
    { locationId: number; locationName: string; suppliers: SummaryRow[] }[]
  >((acc, row) => {
    const existing = acc.find((g) => g.locationId === row.locationId);
    if (existing) {
      existing.suppliers.push(row);
    } else {
      acc.push({ locationId: row.locationId, locationName: row.locationName, suppliers: [row] });
    }
    return acc;
  }, []);

  return (
    <Card className={cn("flex flex-col", allClear && "border-success/40 bg-success/5", className)}>
      <CardHeader className="flex-row items-start justify-between gap-2 pb-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <CardTitle>Replenishment</CardTitle>
            {dueTodayCount !== null && dueTodayCount > 0 && (
              <Badge variant="warning" className="rounded-full">
                {dueTodayCount} due today
              </Badge>
            )}
          </div>
          <p className="type-caption">
            Last updated: {formatTime(lastFetchedAt)}
            {refreshError && (
              <span className="ml-2 text-critical">· Refresh failed</span>
            )}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label="Refresh replenishment data"
          className="shrink-0 text-muted-foreground"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-0">
        {allClear ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <CheckCircle2 className="h-8 w-8 text-success" />
            <p className="type-body text-success">
              All clear — no items need replenishment.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {locationGroups.map((group) => (
              <li key={group.locationId}>
                <div className="px-4 py-2 type-caption font-semibold text-muted-foreground">
                  {group.locationName}
                </div>
                <ul>
                  {group.suppliers.map((row) => (
                    <li key={row.supplierId}>
                      <Link
                        href={`/replenishment?locationId=${row.locationId}&supplierIds=${row.supplierId}`}
                        className="flex min-h-12 items-center justify-between gap-3 py-3 pl-8 pr-4 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none motion-safe:active:scale-[0.99]"
                      >
                        <span className="type-body truncate">{row.supplierName}</span>
                        <Badge variant="warning" className="shrink-0">
                          {row.itemsToOrder}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <CardFooter className="pt-3">
        <Button asChild className="w-full" variant="secondary">
          <Link href={PLAN_HREF}>Plan Replenishment →</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
