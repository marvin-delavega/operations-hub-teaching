"use client";

import { useEffect, useState } from "react";
import { cn } from "@/shared/ui/utils";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Card } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { ConfirmDialog } from "./ConfirmDialog";
import { useSettingsSection } from "./useSettingsSection";

interface Props {
  onDirtyChange?: (dirty: boolean) => void;
}

export function PoCodeSettingsCard({ onDirtyChange }: Props) {
  const { loading, saving, message, load, save, fail, reportDirty } =
    useSettingsSection(onDirtyChange);

  const [poCodePrefix, setPoCodePrefix] = useState("OHPO");
  const [poCodeDisplayWidth, setPoCodeDisplayWidth] = useState("6");
  const [savedPrefix, setSavedPrefix] = useState("OHPO");
  const [savedWidth, setSavedWidth] = useState("6");
  const [headerReservedDigit, setHeaderReservedDigit] = useState("1");
  const [lineReservedDigit, setLineReservedDigit] = useState("1");
  const [savedHeaderDigit, setSavedHeaderDigit] = useState("1");
  const [savedLineDigit, setSavedLineDigit] = useState("1");

  // True when the saved prefix already has app PO history (counter row or matching
  // purchase_order codes) — drives the reset-dialog collision warning.
  const [poCodePrefixHasHistory, setPoCodePrefixHasHistory] = useState(false);

  const [poNumberResetOpen, setPoNumberResetOpen] = useState(false);
  const [poNumberResetSaving, setPoNumberResetSaving] = useState(false);
  const [poNumberResetMessage, setPoNumberResetMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [fixPoIdOpen, setFixPoIdOpen] = useState(false);
  const [fixPoIdSaving, setFixPoIdSaving] = useState(false);
  const [fixPoIdMessage, setFixPoIdMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function refreshRead() {
    const settings = await load();
    if (!settings) return;
    const prefix =
      typeof settings.po_code_prefix === "string" && settings.po_code_prefix
        ? settings.po_code_prefix
        : "OHPO";
    const width = String(
      typeof settings.po_code_display_width === "number"
        ? settings.po_code_display_width
        : 6,
    );
    setPoCodePrefix(prefix);
    setPoCodeDisplayWidth(width);
    setSavedPrefix(prefix);
    setSavedWidth(width);
    setPoCodePrefixHasHistory(Boolean(settings.po_code_prefix_has_app_history));
    const headerDigit = String(Number(settings.po_header_id_reserved_digit) || 1);
    const lineDigit = String(Number(settings.po_line_id_reserved_digit) || 1);
    setHeaderReservedDigit(headerDigit);
    setLineReservedDigit(lineDigit);
    setSavedHeaderDigit(headerDigit);
    setSavedLineDigit(lineDigit);
  }

  useEffect(() => {
    let cancelled = false;
    load().then((settings) => {
      if (!settings || cancelled) return;
      const prefix =
        typeof settings.po_code_prefix === "string" && settings.po_code_prefix
          ? settings.po_code_prefix
          : "OHPO";
      const width = String(
        typeof settings.po_code_display_width === "number"
          ? settings.po_code_display_width
          : 6,
      );
      setPoCodePrefix(prefix);
      setPoCodeDisplayWidth(width);
      setSavedPrefix(prefix);
      setSavedWidth(width);
      setPoCodePrefixHasHistory(Boolean(settings.po_code_prefix_has_app_history));
      const headerDigit = String(Number(settings.po_header_id_reserved_digit) || 1);
      const lineDigit = String(Number(settings.po_line_id_reserved_digit) || 1);
      setHeaderReservedDigit(headerDigit);
      setLineReservedDigit(lineDigit);
      setSavedHeaderDigit(headerDigit);
      setSavedLineDigit(lineDigit);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const dirty =
    poCodePrefix !== savedPrefix ||
    poCodeDisplayWidth !== savedWidth ||
    headerReservedDigit !== savedHeaderDigit ||
    lineReservedDigit !== savedLineDigit;

  useEffect(() => {
    reportDirty(dirty);
  }, [dirty, reportDirty]);

  const validationError = (() => {
    const prefixValue = poCodePrefix.trim().toUpperCase();
    if (!prefixValue) return "po_code_prefix is required";
    if (prefixValue.length > 8) return "po_code_prefix must be 8 characters or fewer";
    if (!/^[A-Z0-9]+$/.test(prefixValue)) return "po_code_prefix must contain only letters and numbers";
    const widthValue = Number(poCodeDisplayWidth);
    if (!Number.isInteger(widthValue) || widthValue < 0 || widthValue > 9) {
      return "po_code_display_width must be an integer between 0 and 9";
    }
    const headerDigitValue = Number(headerReservedDigit);
    if (!Number.isInteger(headerDigitValue) || headerDigitValue < 0 || headerDigitValue > 9) {
      return "PO header reserved digit must be an integer between 0 and 9";
    }
    const lineDigitValue = Number(lineReservedDigit);
    if (!Number.isInteger(lineDigitValue) || lineDigitValue < 0 || lineDigitValue > 9) {
      return "PO line reserved digit must be an integer between 0 and 9";
    }
    return null;
  })();

  async function handleSave() {
    if (validationError) {
      fail(validationError);
      return;
    }
    const ok = await save({
      po_code_prefix: poCodePrefix.trim().toUpperCase(),
      po_code_display_width: Number(poCodeDisplayWidth),
      po_header_id_reserved_digit: Number(headerReservedDigit),
      po_line_id_reserved_digit: Number(lineReservedDigit),
    });
    if (ok) {
      setSavedPrefix(poCodePrefix.trim().toUpperCase());
      setSavedWidth(poCodeDisplayWidth);
      setSavedHeaderDigit(headerReservedDigit);
      setSavedLineDigit(lineReservedDigit);
      refreshRead();
    }
  }

  function handleDiscard() {
    setPoCodePrefix(savedPrefix);
    setPoCodeDisplayWidth(savedWidth);
    setHeaderReservedDigit(savedHeaderDigit);
    setLineReservedDigit(savedLineDigit);
  }

  async function resetPoNumbering() {
    setPoNumberResetSaving(true);
    setPoNumberResetMessage(null);
    try {
      const res = await fetch("/admin/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset_po_numbering: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setPoNumberResetMessage({ type: "success", text: "PO numbering reset to 1." });
        setPoNumberResetOpen(false);
        refreshRead();
      } else {
        setPoNumberResetMessage({ type: "error", text: data.error ?? "Failed to reset." });
      }
    } catch {
      setPoNumberResetMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setPoNumberResetSaving(false);
    }
  }

  async function fixPoIdCounter() {
    setFixPoIdSaving(true);
    setFixPoIdMessage(null);
    try {
      const res = await fetch("/admin/api/po-id-counter/fix", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setFixPoIdMessage({
          type: "success",
          text: `ActiveOne PO ID counters fixed (next PO ${data.purchaseOrderNextId}, next line ${data.purchaseOrderLinesNextId}).`,
        });
        setFixPoIdOpen(false);
      } else {
        setFixPoIdMessage({ type: "error", text: data.error ?? "Failed to fix counters." });
      }
    } catch {
      setFixPoIdMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setFixPoIdSaving(false);
    }
  }

  return (
    <Card className="space-y-3 p-4">
      <div className="space-y-1">
        <Label htmlFor="po-code-prefix" className="text-foreground">
          PO Code Prefix
        </Label>
        <p className="type-caption">
          Prefix for generated purchase order codes (e.g. OHPO-000001). Codes are numbered
          from an app-owned series per prefix and stored minimal (OHPO-1); the display width
          below only changes how they appear. Must be 1–8 alphanumeric characters. Letters
          are stored uppercase. Default: OHPO.
        </p>
      </div>

      {loading ? (
        <Skeleton className="h-12 w-48" />
      ) : (
        <Input
          id="po-code-prefix"
          type="text"
          value={poCodePrefix}
          onChange={(e) => setPoCodePrefix(e.target.value.toUpperCase())}
          maxLength={8}
          className="w-48 type-data"
        />
      )}

      <div className="space-y-1">
        <Label htmlFor="po-code-display-width" className="text-foreground">
          PO Code Display Width
        </Label>
        <p className="type-caption">
          How many digits app PO codes are padded to when shown (e.g. 6 renders OHPO-1 as
          OHPO-000001). Stored codes stay minimal; native ActiveOne codes are never padded.
          Default: 6.
        </p>
      </div>

      {loading ? (
        <Skeleton className="h-12 w-32" />
      ) : (
        <Input
          id="po-code-display-width"
          type="number"
          min={0}
          max={9}
          step={1}
          value={poCodeDisplayWidth}
          onChange={(e) => setPoCodeDisplayWidth(e.target.value)}
          className="w-32 type-data"
        />
      )}

      <hr className="border-border" />

      <div className="space-y-1">
        <p className="type-body font-medium">Reserved PO ID digits</p>
        <p className="type-caption">
          Native ActiveOne&apos;s own PO saves continue its own ID stream, so an app PO ID
          minted contiguously can collide with it. Each app-minted PO ID instead forces its
          units digit to these reserved values (ActiveOne&apos;s stream never emits them),
          placing app POs in a disjoint sub-stream. The ActiveOne counter is still advanced so
          it continues past app rows. Default: 1.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <Label htmlFor="po-header-reserved-digit" className="text-foreground">
            PO header last digit
          </Label>
          {loading ? (
            <Skeleton className="h-12 w-20" />
          ) : (
            <Input
              id="po-header-reserved-digit"
              type="number"
              min={0}
              max={9}
              step={1}
              value={headerReservedDigit}
              onChange={(e) => setHeaderReservedDigit(e.target.value)}
              className="w-20 type-data"
            />
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="po-line-reserved-digit" className="text-foreground">
            PO line last digit
          </Label>
          {loading ? (
            <Skeleton className="h-12 w-20" />
          ) : (
            <Input
              id="po-line-reserved-digit"
              type="number"
              min={0}
              max={9}
              step={1}
              value={lineReservedDigit}
              onChange={(e) => setLineReservedDigit(e.target.value)}
              className="w-20 type-data"
            />
          )}
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

      <hr className="border-border" />

      <div className="space-y-1">
        <p className="type-body font-medium">Numbering series</p>
        <p className="type-caption">
          New app POs count up from the series&apos;s last number. &ldquo;Reset numbering to
          1&rdquo; restarts the counter for the saved prefix above — the next app PO becomes
          {` ${poCodePrefix || "OHPO"}-1`}. This only affects the saved prefix&apos;s series.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          onClick={() => {
            setPoNumberResetMessage(null);
            setPoNumberResetOpen(true);
          }}
          disabled={loading || saving || poNumberResetSaving || poNumberResetOpen}
        >
          Reset numbering to 1
        </Button>
        {poNumberResetMessage && (
          <p
            className={cn(
              "type-body",
              poNumberResetMessage.type === "success" ? "text-success" : "text-destructive",
            )}
          >
            {poNumberResetMessage.text}
          </p>
        )}
      </div>

      <div className="space-y-1 pt-2">
        <p className="type-caption">
          App PO saves keep ActiveOne&apos;s own PO ID allocator in step automatically. If
          native ActiveOne is showing a &ldquo;duplicate ID&rdquo; error when saving a PO,
          run &ldquo;Fix ActiveOne Next ID&rdquo; to realign it to the latest ID.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          onClick={() => {
            setFixPoIdMessage(null);
            setFixPoIdOpen(true);
          }}
          disabled={loading || saving || fixPoIdSaving || fixPoIdOpen}
        >
          Fix ActiveOne Next ID
        </Button>
        {fixPoIdMessage && (
          <p
            className={cn(
              "type-body",
              fixPoIdMessage.type === "success" ? "text-success" : "text-destructive",
            )}
          >
            {fixPoIdMessage.text}
          </p>
        )}
      </div>

      <ConfirmDialog
        open={fixPoIdOpen}
        onOpenChange={(open) => {
          setFixPoIdOpen(open);
          if (!open) setFixPoIdMessage(null);
        }}
        title="Fix ActiveOne PO ID counters?"
        description="Resets ActiveOne's next PO and PO-line ID counters to just past the latest existing IDs. Use this if native ActiveOne is failing to save a PO with a duplicate-ID error. App PO saves keep the counters in step automatically; this is a manual repair."
        confirmLabel="Fix counters"
        onConfirm={fixPoIdCounter}
      />

      {/* Warns when the saved prefix already has app history */}
      <ConfirmDialog
        open={poNumberResetOpen}
        onOpenChange={(open) => {
          setPoNumberResetOpen(open);
          if (!open) setPoNumberResetMessage(null);
        }}
        title="Reset PO numbering to 1?"
        description={
          poCodePrefixHasHistory
            ? `The saved prefix ${poCodePrefix || "OHPO"} already has app PO history, so numbering will eventually climb back into those existing codes. Only reset if this prefix is disjoint from any codes it could reuse (for example a fresh prefix with no history). The next app PO will be numbered ${poCodePrefix || "OHPO"}-1.`
            : `The next app PO will be numbered ${poCodePrefix || "OHPO"}-1 (display-formatted using the width above).`
        }
        confirmLabel="Reset to 1"
        destructive
        onConfirm={resetPoNumbering}
      />
    </Card>
  );
}
