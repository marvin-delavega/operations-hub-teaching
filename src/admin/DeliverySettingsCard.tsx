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

export function DeliverySettingsCard({ onDirtyChange }: Props) {
  const { loading, saving, message, load, save, reportDirty } = useSettingsSection(onDirtyChange);
  const [continuousScanning, setContinuousScanning] = useState(true);
  const [blindDelivery, setBlindDelivery] = useState(false);
  const [saved, setSaved] = useState({ continuousScanning: true, blindDelivery: false });

  useEffect(() => {
    let cancelled = false;
    load().then((settings) => {
      if (!settings || cancelled) return;
      const nextSaved = {
        continuousScanning: settings.delivery_continuous_scanning !== false,
        blindDelivery: settings.delivery_blind_delivery === true,
      };
      setContinuousScanning(nextSaved.continuousScanning);
      setBlindDelivery(nextSaved.blindDelivery);
      setSaved(nextSaved);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const dirty =
    continuousScanning !== saved.continuousScanning || blindDelivery !== saved.blindDelivery;

  useEffect(() => {
    reportDirty(dirty);
  }, [dirty, reportDirty]);

  async function handleSave() {
    const ok = await save({
      delivery_continuous_scanning: continuousScanning,
      delivery_blind_delivery: blindDelivery,
    });
    if (ok) setSaved({ continuousScanning, blindDelivery });
  }

  function handleDiscard() {
    setContinuousScanning(saved.continuousScanning);
    setBlindDelivery(saved.blindDelivery);
  }

  if (loading) {
    return (
      <Card className="space-y-4 p-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </Card>
    );
  }

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor="continuous-scanning" className="text-foreground">Continuous Scanning</Label>
          <p className="type-caption">On: each scan adds +1. Off: each scan prompts for a quantity to add.</p>
        </div>
        <Switch
          id="continuous-scanning"
          checked={continuousScanning}
          onCheckedChange={setContinuousScanning}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor="blind-delivery" className="text-foreground">Blind Delivery</Label>
          <p className="type-caption">On: hide ordered quantities and Exact/Over/Under status from receiving staff.</p>
        </div>
        <Switch
          id="blind-delivery"
          checked={blindDelivery}
          onCheckedChange={setBlindDelivery}
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
