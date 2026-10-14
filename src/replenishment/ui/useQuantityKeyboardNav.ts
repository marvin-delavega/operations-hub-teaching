"use client";

import { useRef, useMemo, useCallback } from "react";

interface ReviewLine {
  sku: string;
  orderedPerPiece: boolean;
  canSplit: boolean;
}

interface MfgGroup {
  manufacturerId: number | null;
  lines: ReviewLine[];
}

interface ReviewGroup {
  supplierId: string;
  mfgGroups: MfgGroup[];
}

function mfgKey(supplierId: string, manufacturerId: number | null): string {
  return `${supplierId}:${manufacturerId ?? "nb"}`;
}

interface UseQuantityKeyboardNavOptions {
  reviewGroups: ReviewGroup[];
  expandedReviewSuppliers: Set<string>;
  expandedReviewMfgs: Set<string>;
  onSplit: (sku: string, orderedPerPiece: boolean) => void;
}

function useQuantityKeyboardNav({
  reviewGroups,
  expandedReviewSuppliers,
  expandedReviewMfgs,
  onSplit,
}: UseQuantityKeyboardNavOptions) {
  const inputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());

  const orderedKeys = useMemo(() => {
    const keys: string[] = [];
    for (const group of reviewGroups) {
      if (!expandedReviewSuppliers.has(group.supplierId)) continue;
      for (const mfg of group.mfgGroups) {
        const mk = mfgKey(group.supplierId, mfg.manufacturerId);
        if (!expandedReviewMfgs.has(mk)) continue;
        for (const line of mfg.lines) {
          keys.push(`case:${line.sku}`);
          if (line.orderedPerPiece) {
            keys.push(`piece:${line.sku}`);
          }
        }
      }
    }
    return keys;
  }, [reviewGroups, expandedReviewSuppliers, expandedReviewMfgs]);

  const registerInput = useCallback((key: string) => (el: HTMLInputElement | null) => {
    if (el) inputRefs.current.set(key, el);
    else inputRefs.current.delete(key);
  }, []);

  const createNavHandlers = useCallback((key: string) => {
    const sku = key.split(":")[1];
    return {
      onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "ArrowUp" && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          const idx = orderedKeys.indexOf(key);
          if (idx === -1) return;
          const prevIdx = idx === 0 ? orderedKeys.length - 1 : idx - 1;
          inputRefs.current.get(orderedKeys[prevIdx])?.focus();
        }
        if (e.key === "ArrowDown" && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          const idx = orderedKeys.indexOf(key);
          if (idx === -1) return;
          const nextIdx = idx === orderedKeys.length - 1 ? 0 : idx + 1;
          inputRefs.current.get(orderedKeys[nextIdx])?.focus();
        }
        if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
          if (key.startsWith("case:")) {
            for (const group of reviewGroups) {
              for (const mfg of group.mfgGroups) {
                const line = mfg.lines.find((l) => l.sku === sku);
                if (line && line.canSplit && !line.orderedPerPiece) {
                  e.preventDefault();
                  onSplit(sku, true);
                  // Focus the piece input after split
                  setTimeout(() => {
                    inputRefs.current.get(`piece:${sku}`)?.focus();
                  }, 0);
                  return;
                }
              }
            }
          }
        }
      },
      onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.select();
        e.target.scrollIntoView({ block: "center" });
      },
    };
  }, [orderedKeys, reviewGroups, onSplit]);

  return { registerInput, createNavHandlers };
}

export { useQuantityKeyboardNav };
