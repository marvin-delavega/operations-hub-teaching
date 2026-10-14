"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { SelectionTile } from "@/shared/ui/SelectionTile";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";

type DueStatus = "due_today" | "due_tomorrow" | "other" | "unscheduled";

interface Supplier {
  id: number;
  name: string;
  nextOrderDate: string | null;
  dueStatus: DueStatus;
}

function formatOrderDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SkeletonTiles() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-[68px]" />
      ))}
    </div>
  );
}

function SupplierSelector() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const returnTo = searchParams.get("returnTo");
  const supplierIdsParam = searchParams.get("supplierIds");

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSuppliers = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/supplier/api")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data: { suppliers: Supplier[] }) => {
        setSuppliers(data.suppliers ?? []);
        if (supplierIdsParam) {
          const preSelected = new Set(
            supplierIdsParam.split(",").map(Number).filter(Boolean)
          );
          setSelectedIds(preSelected);
        }
      })
      .catch(() => setError("Failed to load suppliers. Please try again."))
      .finally(() => setLoading(false));
  }, [supplierIdsParam]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  if (!returnTo) {
    return (
      <div className="py-16 text-center type-body text-destructive">
        Invalid navigation — missing destination.
      </div>
    );
  }

  function toggleSupplier(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleContinue() {
    const ids = Array.from(selectedIds).join(",");
    const base = returnTo!;
    const separator = base.includes("?") ? "&" : "?";
    const extra = Array.from(searchParams.entries())
      .filter(([key]) => key !== "returnTo" && key !== "supplierIds")
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join("&");
    const suffix = extra ? `&${extra}` : "";
    router.push(`${base}${separator}supplierIds=${ids}${suffix}`);
  }

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const dueToday = filtered
    .filter((s) => s.dueStatus === "due_today")
    .sort((a, b) => {
      const dateCompare = (a.nextOrderDate ?? "").localeCompare(b.nextOrderDate ?? "");
      return dateCompare !== 0 ? dateCompare : a.name.localeCompare(b.name);
    });
  const dueTomorrow = filtered
    .filter((s) => s.dueStatus === "due_tomorrow")
    .sort((a, b) => a.name.localeCompare(b.name));
  const others = filtered
    .filter((s) => s.dueStatus === "other" || s.dueStatus === "unscheduled")
    .sort((a, b) => a.name.localeCompare(b.name));

  const sections: { key: string; label: string; items: Supplier[] }[] = [
    { key: "due_today", label: "Due Today", items: dueToday },
    { key: "due_tomorrow", label: "Due Tomorrow", items: dueTomorrow },
    { key: "others", label: "Others", items: others },
  ];

  const selectedCount = selectedIds.size;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="type-body text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Home
        </Link>
        <h1 className="type-page-title">Select Suppliers</h1>
      </div>

      <Input
        type="search"
        placeholder="Search suppliers…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading && <SkeletonTiles />}

      {!loading && error && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="type-body text-destructive">{error}</p>
          <Button variant="link" size="sm" onClick={fetchSuppliers}>
            Retry
          </Button>
        </div>
      )}

      {!loading && !error && suppliers.length === 0 && (
        <div className="py-16 text-center type-body text-muted-foreground">
          No suppliers available.
        </div>
      )}

      {!loading && !error && suppliers.length > 0 && filtered.length === 0 && (
        <div className="py-16 text-center type-body text-muted-foreground">
          No suppliers found.
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="flex flex-col gap-5">
          {sections
            .filter((section) => section.items.length > 0)
            .map((section) => (
              <div key={section.key} className="flex flex-col gap-3">
                <h2 className="type-label uppercase tracking-wide text-muted-foreground">
                  {section.label}
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {section.items.map((supplier) => (
                    <SelectionTile
                      key={supplier.id}
                      onSelect={() => toggleSupplier(supplier.id)}
                      selected={selectedIds.has(supplier.id)}
                      showCheck
                    >
                      <span className="type-body block pr-6 font-medium">{supplier.name}</span>
                      {supplier.nextOrderDate && (
                        <span className="type-caption mt-0.5 block">
                          Next order: {formatOrderDate(supplier.nextOrderDate)}
                        </span>
                      )}
                    </SelectionTile>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      <div className="sticky bottom-0 bg-background pb-4 pt-2">
        <Button
          className="w-full"
          onClick={handleContinue}
          disabled={selectedCount === 0}
        >
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
        <SupplierSelector />
      </Suspense>
    </main>
  );
}
