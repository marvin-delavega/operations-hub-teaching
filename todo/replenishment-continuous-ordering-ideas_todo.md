# Replenishment Continuous Ordering -- Feature Ideas

Captured 2026-08-26. Not yet scoped -- each Tier 1 item likely warrants its own
PRD before implementation.

Context: After submitting POs, the summary screen's only exit is "Done", which
resets to the run screen with the same location/supplier/manufacturer URL
params. To order for a *different* supplier (or re-select anything), staff must
leave the module via home and redo the whole location -> supplier ->
manufacturer selection chain. The goal is a continuous ordering session:
finish one supplier's POs, immediately start the next, never touching Home.

## Tier 1 -- Highest value
- [ ] **Post-submit "Order another supplier" action** -- On the success summary,
      add buttons alongside "Done": e.g. "Next supplier" (-> `/supplier` with
      `returnTo=/replenishment&locationId={id}`, skipping the location step) and
      optionally "Same suppliers, new run" (re-runs with identical params but a
      fresh fetch). Kills the home round-trip at exactly the moment staff finish
      an order. Lowest effort, highest direct value.
- [ ] **In-run supplier/location switch controls** -- Persistent header links on
      the main run screen ("Change suppliers", "Change location") that navigate
      into the shared selection chain pre-filled with current params, so
      re-selection happens mid-session without leaving the module. Mirrors the
      existing "Select a different location" link pattern.

## Tier 2 -- Strong, moderate effort
- [ ] **Supplier queue within one visit** -- Since `/supplier` is already
      multi-select, treat the selected set as a worklist: after each submit, the
      summary offers "Next: {remaining supplier}" or shows which selected
      suppliers still have unsubmitted suggestions. Turns batch ordering days
      into a guided sequence.
- [ ] **Draft-aware switching** -- Guarantee that navigating away to change
      supplier/location preserves the in-progress run draft (server-side draft
      save already exists) and surfaces "resume draft?" on return, so in-run
      navigation never loses review-stage work.

## Tier 3 -- Convenience / workflow
- [ ] **"Repeat last order setup" shortcut** -- From the Replenishment entry,
      one tap restores the most recent location + supplier + manufacturer combo
      (persisted client-side), collapsing the whole chain for repeat visits.
- [ ] **Recent-runs quick re-entry** -- Surface the last few committed runs
      (from history data) as "order again for these suppliers" shortcuts.

## Suggested starting point

Start with both Tier 1 items as one small PRD: they share the same mechanism
(navigating into the selection chain with preserved params) and together cover
the full "never go back home" loop -- post-submit continuation plus mid-run
re-selection. Tier 2's supplier queue is the natural follow-up once the
navigation plumbing exists, since it builds directly on the "Next supplier"
action.
