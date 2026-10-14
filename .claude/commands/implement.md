---
description: Implement a PRD file strictly, following project conventions from CLAUDE.md.
model: claude-sonnet-4-6
---

# /implement

Implement a PRD file strictly, following project conventions from CLAUDE.md.

## Step 1 — Locate the PRD

Check for a PRD in this priority order:

1. **Currently opened file** — look for an `ide_opened_file` tag in the conversation context. If it points to a `.md` file, treat it as the PRD.
2. **Active selection** — look for an `ide_selection` context with a file path referencing a `.md` file.
3. **User-provided path** — if the user passed a file path as an argument to `/implement`, use it.
4. **Ask** — if none of the above, ask:

> "Which PRD file should I implement? Please provide the file path."

Read the full PRD before doing anything else.

## Step 2 — Audit against CLAUDE.md

Before writing a single line of code, re-read `CLAUDE.md` in full. Then map every PRD requirement to the architectural constraints it implies:

- Which module(s) are needed? Do they exist already or must they be created?
- Which clean-architecture layers does each requirement touch (`domain/`, `application/`, `infrastructure/`, `page.tsx`, `api/route.ts`)?
- Does any requirement involve shared code that should live in `src/shared/`?
- Does any requirement touch `container.ts` (new use-case wiring)?

If the PRD describes something that conflicts with CLAUDE.md (e.g. a route pattern that violates the resource-first URL convention, or business logic in an API handler), note the conflict explicitly and follow CLAUDE.md — not the PRD wording.

## Step 3 — Clarify ambiguous forks

Before implementing, scan the PRD for sections where multiple valid implementation paths exist and the PRD is silent on the choice. For **each such fork**, ask the developer a focused question using `AskUserQuestion`. Do not guess or pick arbitrarily.

Examples of forks worth clarifying:
- The PRD mentions a UI component without specifying whether it should be a new shadcn component or a custom one.
- The PRD describes a data fetch but doesn't specify whether it should be server-side (in the API route) or client-side (SWR / fetch in `page.tsx`).
- The PRD names a field but doesn't specify its DB column or type.
- Two valid module boundaries exist and the PRD doesn't say which module owns the logic.

Do **not** ask about things CLAUDE.md already answers.

Batch all questions into a single `AskUserQuestion` call (up to 4). If more than 4 forks exist, group related ones and pick the most consequential 4 to ask first; make reasonable calls on the rest and note them in the final summary.

Wait for answers before proceeding.

## Step 4 — Plan silently, then implement

Derive a file-by-file implementation plan from the PRD + answers + CLAUDE.md. Do not output the plan — go straight to implementation.

Implement in this order to avoid forward-reference errors:
1. Domain types and repository interfaces (`domain/`)
2. Use-case interfaces and application logic (`application/`)
3. Infrastructure adapters, DB queries (`infrastructure/`)
4. `container.ts` wiring
5. API route (`api/route.ts`)
6. Page component (`page.tsx`)
7. Any shared code (`src/shared/`) if extracted during implementation

Rules while implementing:
- Follow every CLAUDE.md coding principle (Clean Code, DRY, SOLID, YAGNI, naming conventions, layer import rules).
- No comments unless the WHY is non-obvious (hidden constraint, subtle invariant, a specific bug workaround).
- No re-export wrapper files.
- No business logic in `api/route.ts` or `page.tsx`.
- No `/api/{module}` URL patterns — always `/{module}/api`.
- Raw SQL via `pool.execute()` — no ORM.
- shadcn/ui + Tailwind CSS v4 for UI; lucide-react for icons.
- Page titles follow: `{Company Name} · Ops Hub · {Module Name}` using a middle dot `·`.

Use `TodoWrite` to track implementation tasks. Mark each task done immediately after completing it.

## Step 5 — Final summary

After all files are written, output the following. Do not add any other prose.

---

### Implementation complete

**Files added**
- [path/to/new/file.ts](path/to/new/file.ts)
- ... (one bullet per new file)

**Files changed**
- [path/to/changed/file.ts](path/to/changed/file.ts)
- ... (one bullet per changed file)

**Judgment calls made without asking**
(List any ambiguous forks you resolved on your own, with a one-sentence rationale each. Omit if none.)

**Potential tech debt / risk**
(List any implementation choices that could break or become tech debt — naming these as risks so the developer can review or revisit. Omit if none.)

---

Do not add anything after the summary.
