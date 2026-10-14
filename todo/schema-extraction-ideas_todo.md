# Schema Extraction (App Tables Out of ActiveOne DB) -- Feature Ideas

Captured 2026-08-13. Not yet scoped -- each Tier 1 item likely warrants its own
PRD before implementation.

Context: Operations Hub currently stores its app-owned tables (`users`, `delivery`,
`supplier_schedule`, `item_sales_daily`, RBAC tables, etc. — `scripts/create-app-tables.sql`)
inside the **same MySQL schema as ActiveOne ERP**, connected via a single swappable pool
(`app/shared/infrastructure/db.ts` + `dbConfig.ts`). The driver is **ownership / vendor
isolation** — keep ActiveOne vendor updates/replication away from our data and vice versa.
Target is **same server, two schemas** (`activeone` + an app schema like `ops_hub`), which
preserves cross-schema SQL JOINs and single InnoDB transactions (both lost on a separate server).

## Tier 1 -- Highest value

- [ ] **Second connection pool + dual-schema config** -- two named pools (ActiveOne + app) driven by a config holding two DB names; `dbConfig.json`, `/connect`, and the admin Database tab grow a second schema field, with `reconfigurePool` hot-swapping both.
- [ ] **Schema-qualify all mixed SQL** -- every query that touches both app and ActiveOne tables gets explicit `activeone.*` / `ops_hub.*` names; single-schema queries route through the correct pool.
- [ ] **Migration + backfill for existing installs** -- detect co-located installs, create the app schema, move existing app rows out of the ActiveOne DB, and keep `create-app-tables.sql` idempotent against the new schema (its `DATABASE()` checks must run pointed at the app schema).

## Tier 2 -- Strong, moderate effort

- [ ] **One-time backfill/verification script** -- a CLI (mirroring the existing rollup backfill) that copies app tables, validates row parity, and is safe to re-run.
- [ ] **Transaction-safety audit** -- confirm every commit that spans app snapshots + ActiveOne write-backs (delivery supersede, counting, replenishment PO) still runs in one server-scoped transaction after the split.

## Tier 3 -- Convenience / workflow

- [ ] **Co-located → split fallback mode** -- if only one schema is configured, keep today's single-schema behavior for existing/degraded installs rather than hard-failing.
- [ ] **Documentation of the two-connection contract** -- note in CLAUDE.md that cross-schema joins are allowed but only via qualified names, and that the app schema must live on the same server.

## Suggested starting point

Start with the **dual-pool + dual-schema config** (Tier 1, first item) — it's the foundation
everything else hangs off and unblocks the schema-qualification work. Defer the backfill script
until the code paths can address both schemas, so the migration has a target shape.
