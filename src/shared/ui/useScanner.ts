"use client";

import { useEffect, useRef, useCallback } from "react";

const SCAN_THRESHOLD_MS = 50;
const MIN_BARCODE_LENGTH = 3;

interface UseScannerOptions {
  onScan: (barcode: string) => void;
  enabled?: boolean;
}

export function useScanner({ onScan, enabled = true }: UseScannerOptions) {
  const bufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      const now = Date.now();
      const timeDelta = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (timeDelta > SCAN_THRESHOLD_MS && bufferRef.current.length > 0) {
        bufferRef.current = "";
      }

      if (e.key === "Enter") {
        const barcode = bufferRef.current.trim();
        bufferRef.current = "";
        if (barcode.length >= MIN_BARCODE_LENGTH) {
          onScan(barcode);
        }
        return;
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    },
    [enabled, onScan]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
