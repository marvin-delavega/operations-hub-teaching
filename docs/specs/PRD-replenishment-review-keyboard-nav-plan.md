# Implementation Plan: Replenishment Review Keyboard Navigation
Source: Direct user request (no formal PRD)
Date: 2026-08-03

## Summary
Add Arrow Up/Down keyboard navigation to cycle through quantity input fields on the PO Review screen in replenishment. When a field receives focus, select its value so typing immediately replaces it. This is a purely client-side UI enhancement — no API, domain, or infrastructure changes.

## Affected Areas
- **`app/(authenticated)/replenishment/page.tsx`** — the PO review table's quantity `<Input>` elements (lines 1717-1736 cases, 1782-1796 pieces)
- **New: `app/(authenticated)/replenishment/ui/useQuantityKeyboardNav.ts`** — custom hook encapsulating keyboard nav logic
- **`app/shared/ui/input.tsx`** — no changes needed; already passes through `ref`, `onKeyDown`, and `onFocus` via `{...props}`

## Decisions
- Resolved by AI: Hook in module-local `ui/` folder (not shared) — only the replenishment review needs this; YAGNI dictates keeping it module-scoped until another screen adopts it
- Resolved by AI: Arrow keys cycle (wrap from last to first and vice versa) — user said "cycle up down" which implies wrapping
- Resolved by AI: Collapsed groups' inputs are excluded from navigation — they aren't visible; including them would be disorienting
- Resolved by AI: `onFocus` selects all via `e.target.select()` — the standard, simple approach for "replace on type"
- Resolved by AI: Navigation respects split mode — each line contributes 1 (cases-only) or 2 (cases + pieces) inputs to the ordered list
- Resolved by AI: Only unmodified ArrowUp/ArrowDown trigger navigation — prevents interference when Shift+Arrow is used for text selection

## Implementation Steps

### Step 1: Create `useQuantityKeyboardNav` hook
**File:** `app/(authenticated)/replenishment/ui/useQuantityKeyboardNav.ts`

**Contract:**
- **Inputs:** `reviewGroups` array (from `page.tsx`), `expandedReviewSuppliers` (`Set<string>`), `expandedReviewMfgs` (`Set<string>`)
- **Outputs:** `registerInput(key: string)` callback ref, `createNavHandlers(key: string)` returning `{ onKeyDown, onFocus }`

**Logic:**
```typescript
function useQuantityKeyboardNav(
  reviewGroups: ReviewGroup[],
  expandedReviewSuppliers: Set<string>,
  expandedReviewMfgs: Set<string>,
) {
  const inputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  
  // Build flat ordered list of input keys for only expanded groups
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
  
  const createNavHandlers = useCallback((key: string) => ({
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
    },
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      e.target.select();
    },
  }), [orderedKeys]);
  
  return { registerInput, createNavHandlers };
}
```

**Existing pattern:** Follows the structure of `useScanner.ts` (custom hook exporting handlers), but scoped to the module rather than shared.

### Step 2: Integrate hook in `page.tsx`

**At top of component** (near existing `useState` declarations, around line 592):
- Import `useQuantityKeyboardNav` from `./ui/useQuantityKeyboardNav`
- Call the hook passing `reviewGroups`, `expandedReviewSuppliers`, `expandedReviewMfgs`
- Destructure `{ registerInput, createNavHandlers }`

**On the Cases quantity `<Input>`** (line 1719):
- Add `ref={registerInput(`case:${line.sku}`)}`
- Spread `...createNavHandlers(`case:${line.sku}`)` or attach handlers individually  
  Actually, cleaner to spread: `{...createNavHandlers(`case:${line.sku}`)}` — but `Input` uses `{...props}`, so `onKeyDown` and `onFocus` will pass through.
  Wait — `Input` uses `React.ComponentProps<"input">` spread, so any extra props like `ref`, `onKeyDown`, `onFocus` pass through correctly since they're valid `<input>` props. Good.

**On the Pieces quantity `<Input>`** (line 1784):
- Same pattern with key `piece:${line.sku}`

**Props merging** on each Input:
```tsx
<Input
  ref={registerInput(`case:${line.sku}`)}
  type="number"
  min={0}
  step={1}
  value={line.quantity}
  onChange={(e) => updateLineQuantity(line.sku, Math.max(0, Math.trunc(Number(e.target.value)) || 0))}
  className="h-9 min-h-9 w-20 px-2 py-1 text-right tabular-nums"
  {...createNavHandlers(`case:${line.sku}`)}
/>
```

And similarly for the pieces input with `piece:${line.sku}`.

### Step 3: Verify

- `npx tsc --noEmit` — type-check the new hook and page changes
- `npm run lint` — ESLint must pass

## Risks & Open Questions
- None identified. The enhancement is additive — existing mouse/tap workflows are unaffected. Keyboard nav only activates on unmodified ArrowUp/ArrowDown and only when a quantity input is already focused.
