"use client";

import { useState, useEffect } from "react";
import { Card } from "@/shared/ui/card";
import { Switch } from "@/shared/ui/switch";

interface Location {
  id: number;
  name: string;
  hidden: boolean;
}

const MANAGED_MODULES: string[] = ["replenishment"];

export function LocationVisibilityManager() {
  const [locationsByModule, setLocationsByModule] = useState<Record<string, Location[]>>({});
  const [filtersByLocation, setFiltersByLocation] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      ...MANAGED_MODULES.map((module) =>
        fetch(`/location/api?module=${module}&showAll=true`)
          .then((r) => r.json())
          .then((data: { locations: Location[] }) => ({ module, locations: data.locations ?? [] }))
      ),
      fetch("/admin/api/location-presence-filter")
        .then((r) => r.json())
        .then((data: { filters?: Record<string, boolean> }) => {
          const map: Record<number, boolean> = {};
          for (const [id, enabled] of Object.entries(data.filters ?? {})) {
            map[Number(id)] = enabled;
          }
          return map;
        }),
    ])
      .then((results) => {
        const filterMap = results.pop() as Record<number, boolean>;
        setFiltersByLocation(filterMap);
        const map: Record<string, Location[]> = {};
        for (const result of results as { module: string; locations: Location[] }[]) {
          map[result.module] = result.locations;
        }
        setLocationsByModule(map);
      })
      .finally(() => setLoading(false));
  }, []);

  async function toggleVisibility(module: string, locationId: number, currentHidden: boolean) {
    const key = `${module}:${locationId}`;
    setSavingKey(key);
    try {
      const res = await fetch("/admin/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module, locationId, hidden: !currentHidden }),
      });
      if (res.ok) {
        setLocationsByModule((prev) => ({
          ...prev,
          [module]: (prev[module] ?? []).map((l) =>
            l.id === locationId ? { ...l, hidden: !currentHidden } : l
          ),
        }));
      }
    } finally {
      setSavingKey(null);
    }
  }

  async function togglePresenceFilter(module: string, locationId: number, currentEnabled: boolean) {
    const key = `${module}:presence:${locationId}`;
    setSavingKey(key);
    try {
      const res = await fetch("/admin/api/location-presence-filter", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, enabled: !currentEnabled }),
      });
      if (res.ok) {
        setFiltersByLocation((prev) => ({ ...prev, [locationId]: !currentEnabled }));
      }
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) {
    return <p className="type-body text-muted-foreground">Loading locations…</p>;
  }

  return (
    <div className="space-y-4">
      {MANAGED_MODULES.map((module) => {
        const locations = locationsByModule[module] ?? [];
        return (
          <Card key={module} className="overflow-hidden">
            <div className="border-b border-border bg-muted px-4 py-2.5">
              <span className="type-label uppercase tracking-wide text-muted-foreground">
                {module}
              </span>
            </div>

            {locations.length === 0 ? (
              <p className="px-4 py-4 type-body text-muted-foreground">
                No locations configured in ActiveOne.
              </p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    <th className="px-4 py-2 text-left type-label text-muted-foreground">Location</th>
                    <th className="px-4 py-2 text-right type-label text-muted-foreground">Visible</th>
                    {module === "replenishment" && (
                      <th className="px-4 py-2 text-right type-label text-muted-foreground">
                        Hide never-stocked items
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {locations.map((loc) => {
                    const key = `${module}:${loc.id}`;
                    const isSaving = savingKey === key;
                    const presenceKey = `${module}:presence:${loc.id}`;
                    const isPresenceSaving = savingKey === presenceKey;
                    return (
                      <tr key={loc.id}>
                        <td className="px-4 py-3 text-foreground">{loc.name}</td>
                        <td className="px-4 py-3 text-right">
                          <Switch
                            checked={!loc.hidden}
                            onCheckedChange={() => toggleVisibility(module, loc.id, loc.hidden)}
                            disabled={isSaving || isPresenceSaving}
                          />
                        </td>
                        {module === "replenishment" && (
                          <td className="px-4 py-3 text-right">
                            <Switch
                              checked={filtersByLocation[loc.id] ?? false}
                              onCheckedChange={() =>
                                togglePresenceFilter(module, loc.id, filtersByLocation[loc.id] ?? false)
                              }
                              disabled={isSaving || isPresenceSaving}
                            />
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        );
      })}
    </div>
  );
}
