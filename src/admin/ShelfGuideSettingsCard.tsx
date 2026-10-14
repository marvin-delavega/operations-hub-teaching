"use client";

import { useEffect, useState } from "react";
import { cn } from "@/shared/ui/utils";
import { Card } from "@/shared/ui/card";
import { Label } from "@/shared/ui/label";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { useSettingsSection } from "./useSettingsSection";

const SELECT_CLASS =
  "h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

interface LocationOption {
  id: number;
  name: string;
}

interface Props {
  onDirtyChange?: (dirty: boolean) => void;
}

export function ShelfGuideSettingsCard({ onDirtyChange }: Props) {
  const { saving, message, load, save, fail, reportDirty } = useSettingsSection(onDirtyChange);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [selected, setSelected] = useState("");
  const [savedSelected, setSavedSelected] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/location/api?module=shelfguide&showAll=true").then((r) => r.json()),
      load(),
    ])
      .then(([locData, settings]: [{ locations: LocationOption[] }, Record<string, unknown> | null]) => {
        if (cancelled) return;
        if (!settings) {
          fail("Failed to load settings.");
          return;
        }
        setLocations(locData.locations ?? []);
        const current = settings.shelfguide_default_location_id;
        const value = current != null ? String(current) : "";
        setSelected(value);
        setSavedSelected(value);
      })
      .catch(() => {
        if (!cancelled) fail("Failed to load settings.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load, fail]);

  const dirty = selected !== savedSelected;

  useEffect(() => {
    reportDirty(dirty);
  }, [dirty, reportDirty]);

  async function handleSave() {
    const ok = await save({
      shelfguide_default_location_id: selected === "" ? null : Number(selected),
    });
    if (ok) setSavedSelected(selected);
  }

  function handleDiscard() {
    setSelected(savedSelected);
  }

  if (loading) {
    return (
      <Card className="space-y-4 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-32" />
      </Card>
    );
  }

  return (
    <Card className="space-y-4 p-4">
      <div className="space-y-1">
        <Label htmlFor="shelfguide-default-location" className="text-foreground">
          Default location
        </Label>
        <p className="type-caption">
          The location the Shelf Guide opens on (typically a selling area / storefront). Staff can
          still switch to any other location on the screen.
        </p>
      </div>

      <select
        id="shelfguide-default-location"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className={cn(SELECT_CLASS, "max-w-sm")}
      >
        <option value="">No default (first location)</option>
        {locations.map((loc) => (
          <option key={loc.id} value={loc.id}>{loc.name}</option>
        ))}
      </select>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={handleSave} disabled={!dirty || loading || saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        {dirty && (
          <Button variant="ghost" onClick={handleDiscard} disabled={saving}>
            Discard
          </Button>
        )}
      </div>

      {message && (
        <p
          className={cn(
            "type-body",
            message.type === "success" ? "text-success" : "text-destructive",
          )}
        >
          {message.text}
        </p>
      )}
    </Card>
  );
}
