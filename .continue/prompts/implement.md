---
name: implement
description: implement
invokable: true
---

Implement a PRD strictly following project conventions in CLAUDE.md.

## Step 1 — Locate the PRD
Check the currently opened file (if .md), user-provided path, or ask. Read the full PRD first.

## Step 2 — Audit against CLAUDE.md
Map every requirement to architecture: which modules, which layers (domain/application/infrastructure/page.tsx/api/route.ts), shared code in src/shared/, container.ts wiring. If PRD conflicts with CLAUDE.md, follow CLAUDE.md.

## Step 3 — Clarify forks
Ask about ambiguous forks (max 4). Don't ask about things CLAUDE.md already answers.

## Step 4 — Implement in order
1. Domain types and repository interfaces (domain/)
2. Use-case interfaces and application logic (application/)
3. Infrastructure adapters, DB queries (infrastructure/)
4. container.ts wiring
5. API route (api/route.ts)
6. Page component (page.tsx)
7. Shared code (src/shared/) if needed

### Rules
- Clean Code, DRY, SOLID, YAGNI, naming, layer import rules per CLAUDE.md
- No comments unless WHY is non-obvious
- No re-export wrapper files
- No business logic in api/route.ts or page.tsx
- No /api/{module} — always /{module}/api
- Raw SQL via pool.execute() — no ORM
- shadcn/ui + Tailwind CSS v4 + lucide-react for icons
- Page titles: "{Company Name} · Ops Hub · {Module Name}"

## Step 5 — Report
### Implementation complete
**Files added** / **Files changed** / **Judgment calls** / **Potential tech debt**
