"use client";

// Bump when the persisted payload shape changes; older snapshots are discarded
// instead of restored into a mismatched shape.
export const REVIEW_SESSION_VERSION = 1;

// Scope of the saved work: derived entirely from URL params, so a snapshot is
// only ever restored into the exact same run selection.
export interface ReviewSessionContext {
  supplierIds: string;
  manufacturerIds: string | null;
}

export interface ReviewSession<Line> {
  version: number;
  context: ReviewSessionContext;
  appliedFrom: string;
  appliedTo: string;
  globalRoundUp: boolean;
  savedAt: string;
  poLines: Line[];
}

function reviewSessionKey(locationId: number): string {
  return `replenishment:review:${locationId}`;
}

function saveReviewSession<Line>(locationId: number, session: ReviewSession<Line>): void {
  try {
    window.localStorage.setItem(reviewSessionKey(locationId), JSON.stringify(session));
  } catch {
    // Quota/private-mode failures must never break the review flow.
  }
}

function loadReviewSession<Line>(locationId: number): ReviewSession<Line> | null {
  try {
    const raw = window.localStorage.getItem(reviewSessionKey(locationId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReviewSession<Line> | null;
    if (!parsed || parsed.version !== REVIEW_SESSION_VERSION) return null;
    if (
      !parsed.context ||
      typeof parsed.context.supplierIds !== "string" ||
      (parsed.context.manufacturerIds !== null && typeof parsed.context.manufacturerIds !== "string")
    ) {
      return null;
    }
    if (typeof parsed.appliedFrom !== "string" || typeof parsed.appliedTo !== "string") return null;
    if (typeof parsed.globalRoundUp !== "boolean") return null;
    if (!Array.isArray(parsed.poLines) || parsed.poLines.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearReviewSession(locationId: number): void {
  try {
    window.localStorage.removeItem(reviewSessionKey(locationId));
  } catch {
    // Nothing to recover — removal failure only means a stale snapshot may restore.
  }
}

export { saveReviewSession, loadReviewSession, clearReviewSession };
