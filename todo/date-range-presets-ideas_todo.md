# Replenishment Date Range Presets -- Feature Ideas

Captured 2026-08-30. Not yet scoped -- each Tier 1 item likely warrants its own PRD before implementation.

Context: The replenishment screen currently uses manual date pickers for "From" and "To" dates, defaulting to the last 30 days. Users frequently need to switch between common ranges (Past Week, Past 2 Weeks, Past Month). Adding preset buttons with a configurable default would speed up workflow.

## Tier 1 -- Highest value
- [ ] **Preset buttons in controls bar** -- Add "Past Week", "Past 2 Weeks", "Past Month" quick-select buttons next to the date pickers that auto-fill both From/To fields; removes manual calendar interaction for the most common ranges.
- [ ] **Configurable default preset** -- Add a new app setting `replenishment_default_date_preset` (values: `week` | `2weeks` | `month`) configured in Admin → Replenishment tab; on first load, initialize From/To from this preset instead of hardcoded 30 days.

## Tier 2 -- Strong, moderate effort
- [ ] **Persist last-used preset per user** -- Store the user's last selected preset in localStorage so it survives page refreshes without requiring admin config change; separate from the admin default.

## Tier 3 -- Convenience / workflow
- [ ] **Custom range indicator** -- When From/To don't match any preset, show a small "Custom" badge so users know they're on a non-standard range.

## Suggested starting point
Start with Tier 1: the preset buttons + configurable default preset. This is a self-contained UI enhancement (client-only for the buttons, one new setting for the default) that follows the existing pattern of `replenishment_show_all_items` / `replenishment_show_incoming` settings. The admin UI already has a ReplenishmentSettingsCard where the new setting fits naturally.