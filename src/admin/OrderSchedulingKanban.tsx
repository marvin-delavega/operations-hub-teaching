"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { cn } from "@/shared/ui/utils";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/ui/dialog";
import type { ScheduleType, SupplierScheduleData } from "@/shared/domain/SupplierSchedule";
import { isUnscheduled } from "@/shared/domain/SupplierSchedule";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const COLUMNS: { type: ScheduleType; label: string }[] = [
  { type: "weekly", label: "Weekly" },
  { type: "monthly", label: "Monthly" },
  { type: "lead_time", label: "Lead-time" },
];

/** Suppliers without weekly/monthly default to the Lead-time column (FR-3). */
function effectiveColumn(supplier: SupplierScheduleData): ScheduleType {
  if (supplier.scheduleType === "weekly") return "weekly";
  if (supplier.scheduleType === "monthly") return "monthly";
  return "lead_time";
}

function DraggableCard({
  supplierId,
  children,
}: {
  supplierId: number;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: supplierId });
  return (
    <div
      ref={setNodeRef}
      className={cn("rounded-lg border border-border bg-card p-3", isDragging && "opacity-40")}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="-ml-1 mt-0.5 cursor-grab touch-none rounded p-1 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Drag to reschedule"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

function DroppableColumn({
  type,
  label,
  count,
  children,
}: {
  type: ScheduleType;
  label: string;
  count: number;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: type });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-40 flex-col gap-2 rounded-lg border p-3 transition-colors",
        isOver ? "border-primary bg-accent" : "border-border bg-muted/40"
      )}
    >
      <div className="flex items-center justify-between">
        <h3 className="type-label uppercase tracking-wide text-muted-foreground">{label}</h3>
        <Badge variant="neutral" className="rounded-full">{count}</Badge>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

interface PendingPrompt {
  supplierId: number;
  type: "weekly" | "monthly";
}

interface PendingMinimum {
  supplierId: number;
  supplierName: string;
  minOrderValue: number | null;
  minOrderQuantity: number | null;
}

export function OrderSchedulingKanban() {
  const [schedules, setSchedules] = useState<SupplierScheduleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);

  const [pending, setPending] = useState<PendingPrompt | null>(null);
  const [weekDayChoice, setWeekDayChoice] = useState<number | null>(null);
  const [monthDayChoice, setMonthDayChoice] = useState("");

  // Minimum-order dialog state
  const [pendingMinimum, setPendingMinimum] = useState<PendingMinimum | null>(null);
  const [minValueInput, setMinValueInput] = useState("");
  const [minQtyInput, setMinQtyInput] = useState("");
  const [savingMinimum, setSavingMinimum] = useState(false);
  const [minimumError, setMinimumError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/admin/order-scheduling/api")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data: { schedules: SupplierScheduleData[] }) => setSchedules(data.schedules ?? []))
      .catch(() => setError("Failed to load supplier schedules."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const persist = useCallback(
    async (
      supplierId: number,
      scheduleType: ScheduleType,
      weekDay: number | null,
      monthDay: number | null,
      lastOrderedAt?: string | null,
    ) => {
      setSavingId(supplierId);
      setError(null);
      try {
        const res = await fetch("/admin/order-scheduling/api", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            supplierId,
            scheduleType,
            weekDay,
            monthDay,
            ...(lastOrderedAt !== undefined ? { lastOrderedAt } : {}),
          }),
        });
        if (!res.ok) throw new Error();
        const data: { lastOrderedAt: string | null } = await res.json();
        setSchedules((prev) =>
          prev.map((s) =>
            s.supplierId === supplierId
              ? { ...s, scheduleType, weekDay, monthDay, lastOrderedAt: data.lastOrderedAt }
              : s
          )
        );
      } catch {
        setError("Failed to save schedule. Please try again.");
      } finally {
        setSavingId(null);
      }
    },
    []
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(Number(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const target = event.over?.id as ScheduleType | undefined;
    if (!target) return;
    const supplierId = Number(event.active.id);
    const current = schedules.find((s) => s.supplierId === supplierId);
    if (!current) return;

    if (target === "weekly") {
      setWeekDayChoice(current.scheduleType === "weekly" ? current.weekDay : null);
      setPending({ supplierId, type: "weekly" });
    } else if (target === "monthly") {
      setMonthDayChoice(current.scheduleType === "monthly" && current.monthDay ? String(current.monthDay) : "");
      setPending({ supplierId, type: "monthly" });
    } else if (effectiveColumn(current) !== "lead_time") {
      persist(supplierId, "lead_time", null, null);
    }
  }

  async function confirmWeekly() {
    if (pending === null || weekDayChoice === null) return;
    await persist(pending.supplierId, "weekly", weekDayChoice, null);
    setPending(null);
  }

  async function confirmMonthly() {
    if (pending === null) return;
    const day = Number(monthDayChoice);
    if (!Number.isInteger(day) || day < 1 || day > 31) return;
    await persist(pending.supplierId, "monthly", null, day);
    setPending(null);
  }

  function openMinimumDialog(supplier: SupplierScheduleData) {
    setPendingMinimum({
      supplierId: supplier.supplierId,
      supplierName: supplier.name,
      minOrderValue: supplier.minOrderValue,
      minOrderQuantity: supplier.minOrderQuantity,
    });
    setMinValueInput(supplier.minOrderValue != null ? String(supplier.minOrderValue) : "");
    setMinQtyInput(supplier.minOrderQuantity != null ? String(supplier.minOrderQuantity) : "");
    setMinimumError(null);
  }

  async function saveMinimum() {
    if (pendingMinimum === null) return;
    setMinimumError(null);
    setSavingMinimum(true);
    try {
      const res = await fetch("/admin/order-scheduling/minimums/api", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: pendingMinimum.supplierId,
          minOrderValue: minValueInput.trim() === "" ? null : minValueInput.trim(),
          minOrderQuantity: minQtyInput.trim() === "" ? null : minQtyInput.trim(),
        }),
      });
      const data: { success?: boolean; error?: string } = await res.json();
      if (!res.ok || data.error) {
        setMinimumError(data.error ?? "Failed to save minimum.");
        return;
      }
      // Update local state so the card badge reflects the new values immediately.
      const newValue = minValueInput.trim() === "" ? null : Number(minValueInput.trim());
      const newQty = minQtyInput.trim() === "" ? null : Number(minQtyInput.trim());
      setSchedules((prev) =>
        prev.map((s) =>
          s.supplierId === pendingMinimum.supplierId
            ? { ...s, minOrderValue: newValue, minOrderQuantity: newQty }
            : s,
        ),
      );
      setPendingMinimum(null);
    } catch {
      setMinimumError("Failed to save minimum. Please try again.");
    } finally {
      setSavingMinimum(false);
    }
  }

  const term = search.trim().toLowerCase();
  const visible = term
    ? schedules.filter((s) => s.name.toLowerCase().includes(term))
    : schedules;
  const activeSupplier = activeId === null ? null : schedules.find((s) => s.supplierId === activeId);

  const monthDayValid = (() => {
    const day = Number(monthDayChoice);
    return Number.isInteger(day) && day >= 1 && day <= 31;
  })();

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {COLUMNS.map((c) => (
          <Skeleton key={c.type} className="h-40" />
        ))}
      </div>
    );
  }

  if (error && schedules.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="type-body text-destructive">{error}</p>
        <Button variant="secondary" size="sm" onClick={load}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Input
        type="search"
        placeholder="Search suppliers…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {error && <p className="type-body text-destructive">{error}</p>}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {COLUMNS.map((column) => {
            const cards = visible.filter((s) => effectiveColumn(s) === column.type);
            return (
              <DroppableColumn key={column.type} type={column.type} label={column.label} count={cards.length}>
                {cards.map((supplier) => (
                  <DraggableCard key={supplier.supplierId} supplierId={supplier.supplierId}>
                    <SupplierCardBody
                      supplier={supplier}
                      saving={savingId === supplier.supplierId}
                      onAnchorChange={(value) =>
                        persist(supplier.supplierId, "lead_time", null, null, value)
                      }
                      onSetMinimum={() => openMinimumDialog(supplier)}
                    />
                  </DraggableCard>
                ))}
                {cards.length === 0 && (
                  <p className="px-1 py-6 text-center type-caption">Drop suppliers here</p>
                )}
              </DroppableColumn>
            );
          })}
        </div>

        <DragOverlay>
          {activeSupplier && (
            <div className="rounded-lg border border-primary bg-card p-3 shadow-lg">
              <span className="type-body font-medium">{activeSupplier.name}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Minimum-order dialog */}
      <Dialog open={pendingMinimum !== null} onOpenChange={(open) => { if (!open) setPendingMinimum(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set minimum order — {pendingMinimum?.supplierName}</DialogTitle>
            <DialogDescription>
              Both fields are optional. Leave blank to clear (unset) that minimum.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="flex flex-col gap-1">
              <span className="type-label text-muted-foreground">Minimum ₱ value</span>
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="e.g. 5000.00"
                value={minValueInput}
                onChange={(e) => setMinValueInput(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="type-label text-muted-foreground">Minimum quantity (purchase units)</span>
              <Input
                type="number"
                min={0}
                step={1}
                placeholder="e.g. 10"
                value={minQtyInput}
                onChange={(e) => setMinQtyInput(e.target.value)}
              />
            </label>
            {minimumError && (
              <p className="type-caption text-destructive">{minimumError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPendingMinimum(null)}>Cancel</Button>
            <Button onClick={saveMinimum} disabled={savingMinimum}>
              {savingMinimum ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pending !== null} onOpenChange={(open) => { if (!open) setPending(null); }}>
        <DialogContent>
          {pending?.type === "weekly" ? (
            <>
              <DialogHeader>
                <DialogTitle>Weekly schedule</DialogTitle>
                <DialogDescription>Choose the day of the week to order on.</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-2">
                {WEEKDAYS.map((day, index) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setWeekDayChoice(index)}
                    className={cn(
                      "min-h-12 rounded-md border px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      weekDayChoice === index
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-card text-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    {day}
                  </button>
                ))}
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setPending(null)}>Cancel</Button>
                <Button onClick={confirmWeekly} disabled={weekDayChoice === null || savingId !== null}>
                  Confirm
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Monthly schedule</DialogTitle>
                <DialogDescription>
                  Enter the day of the month (1–31). Days past a month&apos;s length fall on its last day.
                </DialogDescription>
              </DialogHeader>
              <Input
                type="number"
                min={1}
                max={31}
                step={1}
                placeholder="Day of month"
                value={monthDayChoice}
                onChange={(e) => setMonthDayChoice(e.target.value)}
              />
              <DialogFooter>
                <Button variant="secondary" onClick={() => setPending(null)}>Cancel</Button>
                <Button onClick={confirmMonthly} disabled={!monthDayValid || savingId !== null}>
                  Confirm
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatPeso(value: number): string {
  return "₱" + value.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function SupplierCardBody({
  supplier,
  saving,
  onAnchorChange,
  onSetMinimum,
}: {
  supplier: SupplierScheduleData;
  saving: boolean;
  onAnchorChange: (value: string | null) => void;
  onSetMinimum: () => void;
}) {
  const column = effectiveColumn(supplier);
  const hasMinimum = supplier.minOrderValue != null || supplier.minOrderQuantity != null;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="type-body font-medium">{supplier.name}</span>
        {saving && <span className="type-caption">Saving…</span>}
      </div>
      {hasMinimum && (
        <div className="flex flex-wrap gap-1">
          {supplier.minOrderValue != null && (
            <Badge variant="neutral" className="text-xs">
              Min {formatPeso(supplier.minOrderValue)}
            </Badge>
          )}
          {supplier.minOrderQuantity != null && (
            <Badge variant="neutral" className="text-xs">
              Min {supplier.minOrderQuantity} units
            </Badge>
          )}
        </div>
      )}

      {column === "weekly" && supplier.weekDay !== null && (
        <span className="type-caption">Every {WEEKDAYS[supplier.weekDay]}</span>
      )}

      {column === "monthly" && supplier.monthDay !== null && (
        <span className="type-caption">Day {supplier.monthDay} each month</span>
      )}

      {column === "lead_time" && (
        isUnscheduled(supplier) ? (
          <div className="flex items-center gap-2">
            <Badge variant="warning">No lead time</Badge>
            <span className="type-caption">Unscheduled</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className="type-caption">Lead time: {supplier.leadTimeDays}d</span>
            <label className="flex flex-col gap-1">
              <span className="type-label text-muted-foreground">Last ordered</span>
              <Input
                type="date"
                value={supplier.lastOrderedAt ?? ""}
                onChange={(e) => onAnchorChange(e.target.value || null)}
                className="h-9 min-h-9 w-full px-2 py-1"
              />
            </label>
          </div>
        )
      )}
      <Button
        variant="ghost"
        size="sm"
        className="mt-1 h-8 self-start px-2 type-caption text-muted-foreground hover:text-foreground"
        onClick={onSetMinimum}
      >
        {hasMinimum ? "Edit minimum" : "Set minimum"}
      </Button>
    </div>
  );
}
