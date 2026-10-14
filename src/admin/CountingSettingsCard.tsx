"use client";

import { useEffect, useState } from "react";
import { cn } from "@/shared/ui/utils";
import { Card } from "@/shared/ui/card";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { useSettingsSection } from "./useSettingsSection";

interface Props {
  onDirtyChange?: (dirty: boolean) => void;
}

export function CountingSettingsCard({ onDirtyChange }: Props) {
  const { loading, saving, message, load, save, reportDirty } = useSettingsSection(onDirtyChange);
  const [continuousScanning, setContinuousScanning] = useState(true);
  const [savedContinuousScanning, setSavedContinuousScanning] = useState(true);

  useEffect(() => {
    let cancelled = false;
    load().then((settings) => {
      if (!settings || cancelled) return;
      const value = settings.counting_continuous_scanning !== false;
      setContinuousScanning(value);
      setSavedContinuousScanning(value);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const dirty = continuousScanning !== savedContinuousScanning;

  useEffect(() => {
    reportDirty(dirty);
  }, [dirty, reportDirty]);

  async function handleSave() {
    const ok = await save({ counting_continuous_scanning: continuousScanning });
    if (ok) setSavedContinuousScanning(continuousScanning);
  }

  function handleDiscard() {
    setContinuousScanning(savedContinuousScanning);
  }

  if (loading) {
    return (
      <Card className="space-y-4 p-4">
        <Skeleton className="h-12 w-full" />
      </Card>
    );
  }

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor="counting-continuous-scanning" className="text-foreground">Continuous Scanning</Label>
          <p className="type-caption">On: each scan adds +1. Off: each scan prompts for a quantity to add.</p>
        </div>
        <Switch
          id="counting-continuous-scanning"
          checked={continuousScanning}
          onCheckedChange={setContinuousScanning}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          onClick={handleSave}
          disabled={!dirty || loading || saving}
        >
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
