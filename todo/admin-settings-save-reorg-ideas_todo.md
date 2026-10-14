# Admin Settings Save Reorg -- Feature Ideas

Captured 2026-09-03. Not yet scoped -- this captures the confirmed refactor rules plus
brainstormed enhancements. The core refactor (rules 1+2) likely warrants its own PRD;
each Tier-1 enhancement is a candidate to fold into that same PRD or spin out.

Context: The `/admin` settings surface has drifted into three different save semantics
that all PUT to the same `/admin/api/settings` endpoint but with no shared pattern.
The Delivery / Counting / Replenishment settings cards **save immediately** on toggle
/ blur / segmented-click with **no Save button**. The General tab, by contrast, is a
sprawl of inline per-config state (PO prefix, display width, scanner delay) each with
its **own** Save button, and the PO Code Prefix card alone carries two Save buttons plus
a Reset action. Each card hand-rolls its own `loading / saving / message` boilerplate.
Result: the "save" interaction is unpredictable and the code is copy-pasted.

Confirmed rules (the refactor's core, not optional):
1. Each section of similar configurations has exactly **one** Save button.
2. Every config gets a Save button -- move away from onchange/immediate-save.
Resolved forks: **one card = one save** (footer button persists the whole card);
action-only buttons (Refresh item cache, Reset PO numbering, Reset setup) stay as
immediate actions, visually separated from Save; Save **disabled until dirty**, with a
discard/reset-to-saved affordance and an unsaved-changes warning on leave.

## Tier 1 -- Core refactor (already specified)

- [ ] **Uniform "one card = one save"** -- Delivery (2 switches), Counting (1 switch),
      and Replenishment (toggles + safety-stock block + default-date preset) cards lose
      their onchange / onBlur / segmented-click immediate saves and gain a single footer
      "Save" that PUTs the whole card's state in one patch.
- [ ] **General-tab consolidation** -- break the inline PO-prefix/display-width/scanner
      states out of the monolithic `page.tsx` into card components so each section
      (Company name, PO Code, Scanner, Item cache, First-run) holds one Save -- merging the
      current two-Save PO Code Prefix card into one Save.
- [ ] **Dirty-tracking + disabled-until-dirty Save** -- Save disabled until a real change;
      Reset/Discard to restore the persisted snapshot.
- [ ] **Unsaved-changes leave guard** -- confirm before switching admin tab / navigating
      away with a dirty card.

## Tier 2 -- Strong, moderate effort

- [ ] **Shared `SettingsCard`/`useSettingsForm` primitive in `app/shared/ui/`** -- capture
      the repeated load/save/message/dirty/saving state + section header + footer Save +
      status line, so future settings tabs stop re-deriving a fourth pattern. Removes the
      biggest cause of drift.
- [ ] **Visually separate "Config" vs "Action" sections** -- consistent treatment so Save
      buttons and action buttons (Refresh/Reset) read as different intents, removing the
      current ambiguity (PO Code Prefix card mixes Save + Reset).
- [ ] **Consistent status feedback** -- single success/error line per card (token-styled)
      instead of each card timing out its own toast/message independently.

## Tier 3 -- Convenience / workflow

- [ ] **Saving spinner + disabled inputs while a card save is in flight**, so rapid edits
      on a card can't race an in-flight PUT.
- [ ] **Read-only view by permission**: show a card's current values but disable Save when
      the viewer lacks the tab's edit permission (display gating only; server already
      enforces).

## Suggested starting point

Start with the **shared form primitive (Tier 2)** -- but only as an internal driver for the
Tier-1 refactor, not a separate deliverable. Build it behind the Delivery card first (smallest:
2 switches, currently immediate-save), convert Counting next (near-identical), then Replenishment
(most complex: mixed control types + conditionally-revealed fields), then rework the General tab's
inline PO-prefix/scanner sections. Roll the dirty/unsaved-leave guard in alongside, not after, so
cards aren't re-touched twice. Treat the Tier-3 read-only/saving-spinner as a light add-on once
the primitive exists.
