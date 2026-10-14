---
name: plan
description: plan
invokable: true
---

Turn a PRD into a concrete implementation plan. Plan only — write no application code.

## Process
1. Read the full PRD first.
2. Re-read CLAUDE.md — all "Never/Always/must" are hard constraints.
3. Study the code the PRD touches: modules, layers, existing entities/use cases/repos, container.ts, shared code, DB tables/columns, create-app-tables.sql changes, analogous patterns.
4. Resolve decisions: decide anything determined by PRD/CLAUDE.md/patterns (note rationale). Ask only for genuine unresolved forks with real trade-offs (batch ≤4).
5. Write the plan as markdown beside the PRD (same dir, `{prd-name}-plan.md`).

## Plan structure
```markdown
# Implementation Plan: {Title}
Source PRD: {link}
Date: {today}

## Summary
2–4 sentences

## Affected Areas
Modules/layers, shared code, DB tables, container.ts

## Decisions
Resolved by AI / Resolved by developer / Assumptions

## Implementation Steps
Ordered by clean-architecture layering. Each step: file path + symbols, key logic/contract, mirrored pattern.

## Risks & Open Questions
```

## Hard rules
- No application code — plan markdown only
- Be specific: real files, symbols, tables, columns — no "TBD"
- Don't over-ask — sensible default = take it and note it
- YAGNI — plan what the PRD asks for
