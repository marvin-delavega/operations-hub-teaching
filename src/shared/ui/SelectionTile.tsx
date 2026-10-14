"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/shared/ui/utils";

interface SelectionTileProps {
  onSelect: () => void;
  /** Multi-select selected state. Omit for single-select (tap → navigate) tiles. */
  selected?: boolean;
  /** Render the corner check affordance (multi-select). */
  showCheck?: boolean;
  /** Muted treatment for de-emphasized tiles (e.g. hidden locations). */
  muted?: boolean;
  /** Disabled: non-interactive, visually distinct (e.g. selling-area locations in replenishment). */
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function SelectionTile({
  onSelect,
  selected = false,
  showCheck = false,
  muted = false,
  disabled = false,
  className,
  children,
}: SelectionTileProps) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onSelect}
      disabled={disabled}
      aria-pressed={showCheck ? selected : undefined}
      className={cn(
        "relative min-h-12 rounded-lg border p-5 text-left transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        disabled
          ? "cursor-not-allowed border-border bg-muted/30 text-muted-foreground/50"
          : selected
            ? "border-primary bg-accent text-accent-foreground"
            : muted
              ? "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
              : "border-border bg-card text-foreground hover:border-accent hover:bg-accent hover:text-accent-foreground",
        className
      )}
    >
      {showCheck && selected && (
        <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-3.5" strokeWidth={3} />
        </span>
      )}
      {children}
    </button>
  );
}
