# PRD: Replenishment Continuous Ordering

Status: Draft
Date: 2026-08-26

## Problem

After submitting POs, the success summary's only exit ("Done") resets to the run
screen with the **same** location/supplier/manufacturer URL params. To order for
a *different* supplier — or fix a wrong selection — staff must leave the module
via Home and redo the entire location → supplier → manufacturer selection
chain. On batch ordering days this round-trip repeats per supplier.

## Goal

A continuous ordering session: finish one supplier's POs, immediately start the
next, and correct selections mid-run — never touching Home.

## Scope

Standard and Stockout paths alike (both share the `/replenishment` URL params
and the selection chain).

### FR-1 — Post-submit continuation actions (success summary)

On the "Purchase Orders Created" summary screen, alongside the existing
**Done** button:

- **"Order for different suppliers"** (secondary action): navigates to
  `/supplier?returnTo=%2Freplenishment%3FlocationId%3D{id}` — keeps the current
  location (skips the location step); `supplierIds`/`manufacturerIds` omitted so
  the next run starts fresh (absent = all, per existing convention).
- **Done** keeps its current behavior: reset to the run screen with unchanged
  params and a fresh fetch (it already serves as "new run, same selection").

### FR-2 — In-run selection switch controls (main run screen)

On the main run screen header (the row showing "Replenishment — {location
name}"), add two text links styled identically to the existing Manufacturers
"Change" link (`type-label text-primary hover:underline`):

- **"Change suppliers"** → `/supplier?returnTo=%2Freplenishment%3FlocationId%3D{id}`
  (keeps location; supplier + manufacturer selection start fresh).
- **"Change location"** → `/location?module=replenishment&returnTo=` +
  encoded `/replenishment?supplierIds={current}` (keeps the selected suppliers;
  the chosen location is appended on return; manufacturer filter dropped —
  absent = all).

These links render **only on the main run screen** — not on Review or Summary —
so in-progress review work is never silently discarded by navigation.

## Non-goals

- Supplier queue/worklist sequencing (deferred idea).
- Draft resume prompts on return (drafts remain saved via the existing draft API).
- Any backend/API/schema change — pure client-side navigation wiring.

## Acceptance criteria

1. Submit POs → summary offers a way to select new suppliers without visiting Home.
2. From the main run screen, staff can swap the supplier set or the location in place.
3. All returned URLs satisfy each shared selection module's required-param contract.
4. Existing flows (first entry via chain, draft modal "Plan another run", Manufacturers Change link) unchanged.
