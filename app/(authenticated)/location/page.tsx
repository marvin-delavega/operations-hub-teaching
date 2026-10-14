"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { SelectionTile } from "@/shared/ui/SelectionTile";
import { Checkbox } from "@/shared/ui/checkbox";
import { Label } from "@/shared/ui/label";
import { Skeleton } from "@/shared/ui/skeleton";

interface Location {
  id: number;
  name: string;
  hidden: boolean;
  fedByFeederName?: string | null;
}

function LocationSelector() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const moduleName = searchParams.get("module") ?? "";
  const returnTo = searchParams.get("returnTo") ?? "/";

  const [locations, setLocations] = useState<Location[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!moduleName) return;
    setLoading(true);
    const params = new URLSearchParams({ module: moduleName, showAll: String(showAll) });
    fetch(`/location/api?${params}`)
      .then((r) => r.json())
      .then((data: { locations: Location[] }) => setLocations(data.locations ?? []))
      .finally(() => setLoading(false));
  }, [moduleName, showAll]);

  function handleSelect(id: number) {
    const separator = returnTo.includes("?") ? "&" : "?";
    router.push(`${returnTo}${separator}locationId=${id}`);
  }

  if (!moduleName) {
    return (
      <div className="py-16 text-center type-body text-destructive">
        Missing required parameter: module
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="type-body text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Home
          </Link>
          <h1 className="type-page-title">Select Location</h1>
        </div>
        <Label className="flex min-h-12 cursor-pointer items-center gap-2 text-muted-foreground">
          <Checkbox
            checked={showAll}
            onCheckedChange={(v) => setShowAll(v === true)}
          />
          Show all locations
        </Label>
      </div>

      {loading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px]" />
          ))}
        </div>
      )}

      {!loading && locations.length === 0 && (
        <div className="py-16 text-center type-body text-muted-foreground">
          No locations available. Check hidden locations.
        </div>
      )}

      {!loading && locations.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {locations.map((loc) => (
            <SelectionTile
              key={loc.id}
              onSelect={() => handleSelect(loc.id)}
              muted={loc.hidden && !loc.fedByFeederName}
              disabled={!!loc.fedByFeederName}
            >
              <span className="type-body font-medium">{loc.name}</span>
              {loc.fedByFeederName ? (
                <span className="ml-2 type-caption">(via {loc.fedByFeederName})</span>
              ) : loc.hidden ? (
                <span className="ml-2 type-caption">(hidden)</span>
              ) : null}
            </SelectionTile>
          ))}
        </div>
      )}
    </>
  );
}

export default function Page() {
  return (
    <main className="mx-auto max-w-screen-md space-y-4 p-4">
      <Suspense
        fallback={
          <div className="py-16 text-center type-body text-muted-foreground">
            Loading…
          </div>
        }
      >
        <LocationSelector />
      </Suspense>
    </main>
  );
}
