"use client";

import { useEffect, useState } from "react";
import { cn } from "@/shared/ui/utils";
import { Card } from "@/shared/ui/card";
import { Label } from "@/shared/ui/label";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { useSettingsSection } from "./useSettingsSection";

type SafetyStockMode = "off" | "percentage" | "dynamic" | "days";
type DefaultDatePreset = "week" | "2weeks" | "month";

interface Snapshot {
  showAllItems: boolean;
  showIncoming: boolean;
  requireApproval: boolean;
  safetyStockMode: SafetyStockMode;
  safetyStockLevel: number;
  safetyStockMaxLevel: number;
  safetyStockDays: number;
  defaultDatePreset: DefaultDatePreset;
}

interface Props {
  onDirtyChange?: (dirty: boolean) => void;
}

const DEFAULT_SNAPSHOT: Snapshot = {
  showAllItems: false,
  showIncoming: true,
  requireApproval: false,
  safetyStockMode: "off",
  safetyStockLevel: 90,
  safetyStockMaxLevel: 99,
  safetyStockDays: 7,
  defaultDatePreset: "month",
};

export function ReplenishmentSettingsCard({ onDirtyChange }: Props) {
  const { loading, saving, message, load, save, fail, reportDirty } =
    useSettingsSection(onDirtyChange);
  const [values, setValues] = useState<Snapshot>(DEFAULT_SNAPSHOT);
  const [saved, setSaved] = useState<Snapshot>(DEFAULT_SNAPSHOT);

  useEffect(() => {
    let cancelled = false;
    load().then((settings) => {
      if (!settings || cancelled) return;
      const mode = settings.replenishment_safety_stock_mode;
      const safetyStockMode: SafetyStockMode =
        mode === "percentage" || mode === "dynamic" || mode === "days" || mode === "off"
          ? mode
          : "off";
      const preset = settings.replenishment_default_date_preset;
      const defaultDatePreset: DefaultDatePreset =
        preset === "week" || preset === "2weeks" || preset === "month" ? preset : "month";
      const next: Snapshot = {
        showAllItems: settings.replenishment_show_all_items !== false,
        showIncoming: settings.replenishment_show_incoming !== false,
        requireApproval: settings.replenishment_require_approval === true,
        safetyStockMode,
        safetyStockLevel: numberOrDefault(settings.replenishment_safety_stock_level, 90),
        safetyStockMaxLevel: numberOrDefault(settings.replenishment_safety_stock_max_level, 99),
        safetyStockDays: numberOrDefault(settings.replenishment_safety_stock_days, 7),
        defaultDatePreset,
      };
      setValues(next);
      setSaved(next);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const dirty =
    values.showAllItems !== saved.showAllItems ||
    values.showIncoming !== saved.showIncoming ||
    values.requireApproval !== saved.requireApproval ||
    values.safetyStockMode !== saved.safetyStockMode ||
    values.safetyStockLevel !== saved.safetyStockLevel ||
    values.safetyStockMaxLevel !== saved.safetyStockMaxLevel ||
    values.safetyStockDays !== saved.safetyStockDays ||
    values.defaultDatePreset !== saved.defaultDatePreset;

  useEffect(() => {
    reportDirty(dirty);
  }, [dirty, reportDirty]);

  const levelValid = Number.isInteger(values.safetyStockLevel) && values.safetyStockLevel >= 1 && values.safetyStockLevel <= 100;
  const maxLevelValid = Number.isFinite(values.safetyStockMaxLevel) && values.safetyStockMaxLevel >= 1 && values.safetyStockMaxLevel <= 99.99;
  const daysValid = Number.isInteger(values.safetyStockDays) && values.safetyStockDays >= 1 && values.safetyStockDays <= 30;

  // All three numeric keys ride in the one PUT, so any out-of-range numeric — even one hidden
  // by a mode switch — blocks Save (a hidden value was still user-typed while shown).
  const validationError = !levelValid
    ? "Service level must be a whole number from 1 to 100."
    : !maxLevelValid
      ? "Max service level must be from 1 to 99.99."
      : !daysValid
        ? "Safety stock days must be a whole number from 1 to 30."
        : null;

  function handleSave() {
    if (validationError) {
      fail(validationError);
      return;
    }
    save({
      replenishment_show_all_items: values.showAllItems,
      replenishment_show_incoming: values.showIncoming,
      replenishment_require_approval: values.requireApproval,
      replenishment_safety_stock_mode: values.safetyStockMode,
      replenishment_safety_stock_level: values.safetyStockLevel,
      replenishment_safety_stock_max_level: values.safetyStockMaxLevel,
      replenishment_safety_stock_days: values.safetyStockDays,
      replenishment_default_date_preset: values.defaultDatePreset,
    }).then((ok) => {
      if (ok) setSaved(values);
    });
  }

  function handleDiscard() {
    setValues(saved);
  }

  function setField<K extends keyof Snapshot>(key: K, next: Snapshot[K]) {
    setValues((prev) => ({ ...prev, [key]: next }));
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
          <Label htmlFor="show-all-items" className="text-foreground">Show all items</Label>
          <p className="type-caption">
            On: items with sufficient stock (suggested qty = 0) are shown on the Standard replenishment
            list, unchecked by default. Off: only items with a positive suggested order appear.
          </p>
        </div>
        <Switch
          id="show-all-items"
          checked={values.showAllItems}
          onCheckedChange={(next) => setField("showAllItems", next)}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor="show-incoming" className="text-foreground">Show incoming</Label>
          <p className="type-caption">
            On: undelivered open-PO quantities are shown in the Incoming column and added to total
            stock. Off: the Incoming column is hidden and total stock counts on-hand only.
          </p>
        </div>
        <Switch
          id="show-incoming"
          checked={values.showIncoming}
          onCheckedChange={(next) => setField("showIncoming", next)}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor="require-approval" className="text-foreground">Require Approval</Label>
          <p className="type-caption">
            On: the Submit PO button is hidden on the Review screen — replenishment runs must be saved
            as drafts and approved by a user with the Approve Replenishment permission.
          </p>
        </div>
        <Switch
          id="require-approval"
          checked={values.requireApproval}
          onCheckedChange={(next) => setField("requireApproval", next)}
        />
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-foreground">Safety stock</Label>
          <p className="type-caption">
            Off: no safety buffer. Percentage: a constant service-level Z-score buffer. Dynamic: a per-item
            Z-score derived from each item&apos;s own sales history, capped at the max service level. Days: adds
            the configured number of days of sales to the suggested order.
          </p>
        </div>

        <div className="inline-flex rounded-lg bg-muted p-0.5">
          {(["off", "percentage", "dynamic", "days"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setField("safetyStockMode", mode)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                values.safetyStockMode === mode
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {mode === "off" ? "Off" : mode === "percentage" ? "Percentage" : mode === "dynamic" ? "Dynamic" : "Days"}
            </button>
          ))}
        </div>

        {values.safetyStockMode === "percentage" && (
          <div className="space-y-1">
            <span className="type-label text-muted-foreground">Service level (%)</span>
            <Input
              id="safety-stock-level"
              type="number"
              min={1}
              max={100}
              value={values.safetyStockLevel}
              onChange={(e) => setField("safetyStockLevel", Number(e.target.value))}
              className="w-24"
            />
          </div>
        )}

        {values.safetyStockMode === "dynamic" && (
          <div className="space-y-1">
            <span className="type-label text-muted-foreground">Max service level (%)</span>
            <Input
              id="safety-stock-max-level"
              type="number"
              min={1}
              max={99.99}
              step={0.01}
              value={values.safetyStockMaxLevel}
              onChange={(e) => setField("safetyStockMaxLevel", Number(e.target.value))}
              className="w-24"
            />
          </div>
        )}

        {values.safetyStockMode === "days" && (
          <div className="space-y-1">
            <span className="type-label text-muted-foreground">Days of safety stock</span>
            <Input
              id="safety-stock-days"
              type="number"
              min={1}
              max={30}
              value={values.safetyStockDays}
              onChange={(e) => setField("safetyStockDays", Number(e.target.value))}
              className="w-24"
            />
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-foreground">Default date range</Label>
          <p className="type-caption">
            The preset applied on first load of the Replenishment screen. Users can still pick custom dates.
          </p>
        </div>

        <div className="inline-flex rounded-lg bg-muted p-0.5">
          {(["week", "2weeks", "month"] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setField("defaultDatePreset", preset)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                values.defaultDatePreset === preset
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {preset === "week" ? "Past Week" : preset === "2weeks" ? "Past 2 Weeks" : "Past Month"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          onClick={handleSave}
          disabled={!dirty || loading || saving || validationError !== null}
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
      {!message && dirty && validationError && (
        <p className="type-body text-destructive">{validationError}</p>
      )}
    </Card>
  );
}

function numberOrDefault(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
