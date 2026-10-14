"use client";

import { useEffect, useState } from "react";
import { cn } from "@/shared/ui/utils";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Card } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { useSettingsSection } from "./useSettingsSection";

interface Props {
  onDirtyChange?: (dirty: boolean) => void;
}

export function ScannerSettingsCard({ onDirtyChange }: Props) {
  const { loading, saving, message, load, save, reportDirty } =
    useSettingsSection(onDirtyChange);
  const [scanBatchDelay, setScanBatchDelay] = useState("2000");
  const [savedDelay, setSavedDelay] = useState("2000");

  useEffect(() => {
    let cancelled = false;
    load().then((settings) => {
      if (!settings || cancelled) return;
      const value = String(settings.scan_batch_delay_ms ?? 2000);
      setScanBatchDelay(value);
      setSavedDelay(value);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const dirty = scanBatchDelay !== savedDelay;

  useEffect(() => {
    reportDirty(dirty);
  }, [dirty, reportDirty]);

  const delay = Number(scanBatchDelay);
  const invalid = !Number.isInteger(delay) || delay < 200 || delay > 10000;

  async function handleSave() {
    const ok = await save({ scan_batch_delay_ms: Number(scanBatchDelay) });
    if (ok) setSavedDelay(scanBatchDelay);
  }

  function handleDiscard() {
    setScanBatchDelay(savedDelay);
  }

  return (
    <Card className="space-y-3 p-4">
      <div className="space-y-1">
        <Label htmlFor="scan-batch-delay" className="text-foreground">
          Bulk scan delay (ms)
        </Label>
        <p className="type-caption">
          Idle time after the last barcode before a bulk-scan batch is processed in the Delivery
          module. Higher values better absorb fast Eyoyo dumps; lower feels more immediate. 200–10000 ms.
        </p>
      </div>

      {loading ? (
        <Skeleton className="h-12 w-32" />
      ) : (
        <Input
          id="scan-batch-delay"
          type="number"
          min={200}
          max={10000}
          step={100}
          value={scanBatchDelay}
          onChange={(e) => setScanBatchDelay(e.target.value)}
          className="w-32"
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          onClick={handleSave}
          disabled={!dirty || loading || saving || invalid}
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
      {!message && dirty && invalid && (
        <p className="type-body text-destructive">
          scan_batch_delay_ms must be an integer between 200 and 10000.
        </p>
      )}
    </Card>
  );
}
