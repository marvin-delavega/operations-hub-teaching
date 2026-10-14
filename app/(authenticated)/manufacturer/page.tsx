"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { SelectionTile } from "@/shared/ui/SelectionTile";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { Checkbox } from "@/shared/ui/checkbox";
import type { SupplierManufacturers, Manufacturer } from "@/manufacturer/domain/Manufacturer";
import { manufacturerToken, parseManufacturerTokens } from "@/manufacturer/domain/manufacturerTokens";

function SkeletonSections() {
  return (
    <div className="flex flex-col gap-5">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-3">
          <Skeleton className="h-5 w-40" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, j) => (
              <Skeleton key={j} className="h-[52px]" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ManufacturerSelector() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const returnTo = searchParams.get("returnTo");
  const supplierIdsParam = searchParams.get("supplierIds");
  const manufacturerIdsParam = searchParams.get("manufacturerIds");

  const [suppliers, setSuppliers] = useState<SupplierManufacturers[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchManufacturers = useCallback(() => {
    if (!supplierIdsParam) return;
    setLoading(true);
    setError(null);
    fetch(`/manufacturer/api?supplierIds=${encodeURIComponent(supplierIdsParam)}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data: { suppliers: SupplierManufacturers[] }) => {
        const loaded = data.suppliers ?? [];
        setSuppliers(loaded);
        // FR-13: pre-select from an incoming manufacturerIds param (round-trip editing
        // via the run's "Change" link); absent → all checked (FR-9 default).
        const incomingPairs = parseManufacturerTokens(manufacturerIdsParam);
        if (incomingPairs) {
          setSelected(
            new Set(incomingPairs.map((p) => manufacturerToken(p.supplierId, p.manufacturerId)))
          );
        } else {
          setSelected(
            new Set(
              loaded.flatMap((s) =>
                s.manufacturers.map((m) => manufacturerToken(s.supplierId, m.manufacturerId))
              )
            )
          );
        }
      })
      .catch(() => setError("Failed to load manufacturers. Please try again."))
      .finally(() => setLoading(false));
  }, [supplierIdsParam, manufacturerIdsParam]);

  useEffect(() => {
    // FR-3 / edge case: missing returnTo or supplierIds → in-place error, no fetch.
    if (returnTo && supplierIdsParam) {
      fetchManufacturers();
    }
  }, [returnTo, supplierIdsParam, fetchManufacturers]);

  if (!returnTo) {
    return (
      <div className="py-16 text-center type-body text-destructive">
        Invalid navigation — missing destination.
      </div>
    );
  }

  if (!supplierIdsParam) {
    return (
      <div className="py-16 text-center type-body text-destructive">
        Invalid navigation — missing supplier selection.
      </div>
    );
  }

  function toggleTile(supplierId: number, manufacturerId: number | null) {
    const token = manufacturerToken(supplierId, manufacturerId);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(token)) next.delete(token);
      else next.add(token);
      return next;
    });
  }

  function toggleSupplierAll(supplierGroup: SupplierManufacturers, visible: Manufacturer[]) {
    const tokens = visible.map((m) => manufacturerToken(supplierGroup.supplierId, m.manufacturerId));
    const allChecked = tokens.length > 0 && tokens.every((t) => selected.has(t));
    setSelected((prev) => {
      const next = new Set(prev);
      tokens.forEach((t) => (allChecked ? next.delete(t) : next.add(t)));
      return next;
    });
  }

  function handleContinue() {
    // FR-15: only omit manufacturerIds when every tile across every supplier is checked.
    const totalTiles = suppliers.reduce((sum, s) => sum + s.manufacturers.length, 0);
    const allSelected = totalTiles > 0 && selected.size >= totalTiles;

    const base = returnTo!;
    const separator = base.includes("?") ? "&" : "?";

    // Preserve every incoming param except returnTo and manufacturerIds — unlike
    // /supplier, this screen keeps supplierIds (and locationId) intact (FR-4).
    const preserved = Array.from(searchParams.entries())
      .filter(([key]) => key !== "returnTo" && key !== "manufacturerIds")
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join("&");

    const manufacturerParam = allSelected
      ? ""
      : `manufacturerIds=${encodeURIComponent(Array.from(selected).join(","))}`;

    const query = [manufacturerParam, preserved].filter(Boolean).join("&");
    router.push(query ? `${base}${separator}${query}` : base);
  }

  const searchQuery = search.trim().toLowerCase();

  const sections = suppliers
    .map((supplierGroup) => {
      const visible = searchQuery
        ? supplierGroup.manufacturers.filter((m) =>
            (m.manufacturerName ?? "No Brand").toLowerCase().includes(searchQuery)
          )
        : supplierGroup.manufacturers;
      return { supplierGroup, visible };
    })
    .filter((s) => s.visible.length > 0);

  const allVisibleTokens = sections.flatMap(({ supplierGroup, visible }) =>
    visible.map((m) => manufacturerToken(supplierGroup.supplierId, m.manufacturerId))
  );
  const allVisibleSelected =
    allVisibleTokens.length > 0 && allVisibleTokens.every((t) => selected.has(t));

  function toggleSelectAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      allVisibleTokens.forEach((t) => (allVisibleSelected ? next.delete(t) : next.add(t)));
      return next;
    });
  }

  const selectedCount = selected.size;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="type-body text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Home
        </Link>
        <h1 className="type-page-title">Select Manufacturers</h1>
      </div>

      <Input
        type="search"
        placeholder="Search manufacturers…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {!loading && !error && suppliers.length > 0 && (
        <div className="flex items-center gap-2">
          <Button variant="link" size="sm" onClick={toggleSelectAllVisible}>
            {allVisibleSelected ? "Clear All" : "Select All"}
          </Button>
        </div>
      )}

      {loading && <SkeletonSections />}

      {!loading && error && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="type-body text-destructive">{error}</p>
          <Button variant="link" size="sm" onClick={fetchManufacturers}>
            Retry
          </Button>
        </div>
      )}

      {!loading && !error && suppliers.length === 0 && (
        <div className="py-16 text-center type-body text-muted-foreground">
          No manufacturers found for the selected suppliers.
        </div>
      )}

      {!loading && !error && suppliers.length > 0 && sections.length === 0 && (
        <div className="py-16 text-center type-body text-muted-foreground">
          No manufacturers found.
        </div>
      )}

      {!loading && !error && sections.length > 0 && (
        <div className="flex flex-col gap-6">
          {sections.map(({ supplierGroup, visible }) => {
            const tokens = visible.map((m) =>
              manufacturerToken(supplierGroup.supplierId, m.manufacturerId)
            );
            const checkedCount = tokens.filter((t) => selected.has(t)).length;
            const checked = checkedCount === tokens.length && tokens.length > 0;
            const indeterminate = checkedCount > 0 && checkedCount < tokens.length;

            return (
              <div key={supplierGroup.supplierId} className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={indeterminate ? "indeterminate" : checked}
                    onCheckedChange={() => toggleSupplierAll(supplierGroup, visible)}
                  />
                  <h2 className="type-label uppercase tracking-wide text-muted-foreground">
                    {supplierGroup.supplierName}
                  </h2>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {visible.map((m) => {
                    const token = manufacturerToken(supplierGroup.supplierId, m.manufacturerId);
                    return (
                      <SelectionTile
                        key={token}
                        onSelect={() => toggleTile(supplierGroup.supplierId, m.manufacturerId)}
                        selected={selected.has(token)}
                        showCheck
                      >
                        <span className="type-body block pr-6 font-medium">
                          {m.manufacturerName ?? "No Brand"}
                        </span>
                      </SelectionTile>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="sticky bottom-0 bg-background pb-4 pt-2">
        <Button className="w-full" onClick={handleContinue} disabled={selectedCount === 0}>
          Continue ({selectedCount} selected)
        </Button>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <main className="mx-auto max-w-screen-md p-4">
      <Suspense
        fallback={
          <div className="py-16 text-center type-body text-muted-foreground">
            Loading…
          </div>
        }
      >
        <ManufacturerSelector />
      </Suspense>
    </main>
  );
}
