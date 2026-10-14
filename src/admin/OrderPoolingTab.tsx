"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, Plus, Trash2, Warehouse, Store } from "lucide-react";
import { cn } from "@/shared/ui/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Skeleton } from "@/shared/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
} from "@/shared/ui/sheet";

interface Mapping {
  sellingAreaLocationId: number;
  sellingAreaName: string | null;
  feederLocationId: number;
  feederName: string | null;
  stale: boolean;
}

interface Location {
  id: number;
  name: string;
  hidden: boolean;
}

interface SheetState {
  open: boolean;
  editing: Mapping | null;
}

export function OrderPoolingTab() {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState<SheetState>({ open: false, editing: null });
  const [allLocations, setAllLocations] = useState<Location[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [sellingAreaId, setSellingAreaId] = useState<number | "">("");
  const [feederId, setFeederId] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/admin/api/order-pooling")
      .then((r) => r.json())
      .then((data: { mappings: Mapping[] }) => setMappings(data.mappings ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function openSheet(editing: Mapping | null) {
    setSheetError(null);
    setSellingAreaId(editing?.sellingAreaLocationId ?? "");
    setFeederId(editing?.feederLocationId ?? "");
    setSheet({ open: true, editing });

    if (allLocations.length === 0) {
      setLocationsLoading(true);
      fetch("/location/api?module=admin&showAll=true")
        .then((r) => r.json())
        .then((data: { locations: Location[] }) => setAllLocations(data.locations ?? []))
        .finally(() => setLocationsLoading(false));
    }
  }

  function closeSheet() {
    setSheet({ open: false, editing: null });
  }

  async function save() {
    if (sellingAreaId === "" || feederId === "") {
      setSheetError("Both a selling area and a feeder must be selected.");
      return;
    }
    setSaving(true);
    setSheetError(null);
    try {
      const res = await fetch("/admin/api/order-pooling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellingAreaLocationId: sellingAreaId, feederLocationId: feederId }),
      });
      const data = (await res.json()) as { mapping?: Mapping; error?: string };
      if (!res.ok) {
        setSheetError(data.error ?? "Save failed.");
        return;
      }
      closeSheet();
      load();
    } catch {
      setSheetError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(sellingAreaLocationId: number) {
    setRemoving(sellingAreaLocationId);
    try {
      await fetch("/admin/api/order-pooling", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellingAreaLocationId }),
      });
      load();
    } finally {
      setRemoving(null);
    }
  }

  const filtered = search.trim()
    ? mappings.filter(
        (m) =>
          (m.sellingAreaName ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (m.feederName ?? "").toLowerCase().includes(search.toLowerCase()),
      )
    : mappings;

  // Group by feeder
  const byFeeder = new Map<number, { feederName: string | null; items: Mapping[] }>();
  for (const m of filtered) {
    if (!byFeeder.has(m.feederLocationId)) {
      byFeeder.set(m.feederLocationId, { feederName: m.feederName, items: [] });
    }
    byFeeder.get(m.feederLocationId)!.items.push(m);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search locations…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Button onClick={() => openSheet(null)}>
          <Plus className="mr-1.5 size-4" />
          Add selling area
        </Button>
      </div>

      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      )}

      {!loading && mappings.length === 0 && (
        <p className="type-body text-muted-foreground py-8 text-center">
          No selling areas configured. Add one to start pooling demand.
        </p>
      )}

      {!loading && mappings.length > 0 && filtered.length === 0 && (
        <p className="type-body text-muted-foreground py-8 text-center">
          No mappings match your search.
        </p>
      )}

      {!loading && byFeeder.size > 0 && (
        <div className="space-y-6">
          {Array.from(byFeeder.entries()).map(([fId, group]) => (
            <div key={fId}>
              {/* Feeder warehouse node — spine starts under icon center (ml-9 = 36px = px-4 + size-10/2) */}
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Warehouse className="size-5 text-primary" />
                </div>
                <div>
                  <p className="type-caption font-medium uppercase tracking-wider text-muted-foreground">
                    Feeder Warehouse
                  </p>
                  <p className="type-body font-semibold">
                    {group.feederName ?? `Location ${fId}`}
                  </p>
                </div>
              </div>

              {/* Dashed spine drops from the warehouse icon center; dots + arms connect to each selling area */}
              <div className="ml-9 border-l-2 border-dashed border-border">
                {group.items.map((m) => (
                  <div key={m.sellingAreaLocationId} className="relative flex items-center py-2">
                    {/* Dot centered on spine */}
                    <span className="absolute -left-[5px] top-1/2 size-2.5 -translate-y-[5px] rounded-full border-2 border-border bg-background" />
                    {/* Horizontal arm from spine to card */}
                    <div className="h-px w-5 shrink-0 bg-border" />
                    {/* Selling area card */}
                    <div
                      className={cn(
                        "flex flex-1 items-center gap-3 rounded-xl border border-border bg-background px-3.5 py-2.5",
                        m.stale && "border-warning/50",
                      )}
                    >
                      <Store
                        className={cn(
                          "size-4 shrink-0",
                          m.stale ? "text-warning" : "text-muted-foreground",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className={cn("type-body font-medium truncate", m.stale && "text-muted-foreground")}>
                          {m.sellingAreaName ?? `Location ${m.sellingAreaLocationId}`}
                        </p>
                        {m.stale && (
                          <p className="type-caption text-warning mt-0.5 flex items-center gap-1">
                            <AlertTriangle className="size-3 shrink-0" />
                            Inactive or removed in ActiveOne.
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button variant="secondary" size="sm" onClick={() => openSheet(m)}>
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => remove(m.sellingAreaLocationId)}
                          disabled={removing === m.sellingAreaLocationId}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet open={sheet.open} onOpenChange={(open) => { if (!open) closeSheet(); }}>
        <SheetContent className="space-y-4">
          <SheetHeader>
            <SheetTitle>
              {sheet.editing ? "Edit selling area" : "Add selling area"}
            </SheetTitle>
          </SheetHeader>

          {locationsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="selling-area-select">Selling area (the display floor)</Label>
                <select
                  id="selling-area-select"
                  value={sellingAreaId}
                  onChange={(e) => { setSellingAreaId(e.target.value === "" ? "" : Number(e.target.value)); setSheetError(null); }}
                  disabled={!!sheet.editing}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select a location…</option>
                  {allLocations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
                {sheet.editing && (
                  <p className="type-caption text-muted-foreground">
                    To change the selling area, remove this mapping and add a new one.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="feeder-select">Feeder warehouse</Label>
                <select
                  id="feeder-select"
                  value={feederId}
                  onChange={(e) => { setFeederId(e.target.value === "" ? "" : Number(e.target.value)); setSheetError(null); }}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select a location…</option>
                  {allLocations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>

              {sheetError && (
                <p className="type-body text-destructive">{sheetError}</p>
              )}
            </div>
          )}

          <SheetFooter className="gap-2">
            <SheetClose asChild>
              <Button variant="secondary" onClick={closeSheet}>Cancel</Button>
            </SheetClose>
            <Button onClick={save} disabled={saving || locationsLoading}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
