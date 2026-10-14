---
name: plan
description: Turn a PRD into a concrete implementation plan. Reads the PRD, studies the parts of the codebase it will touch, asks the developer only about genuine decision points (with options), and writes a {prd-name}-plan.md beside the PRD. Use when the user wants to plan, scope, or break down a PRD before coding.
---

# /plan -- PRD to Implementation Plan

Read a PRD, study the code it touches, and write an implementation plan beside it. **Plan only -- write no application code.** The single artifact this skill produces is the plan markdown file.

## Model Routing (Tiered Delegation)

**Plan runs on: `nvidia/nemotron-3-ultra-550b-a55b:free` (planner agent) — Tier 2: Free Orchestrator**

- PRD analysis, codebase study, decision point identification, implementation plan generation
- **$0.00 cost** — free tier for all planning

## Arguments

`$ARGUMENTS` is the path to the PRD file (e.g. `/plan docs/specs/PRD-delivery.md`).

- If a bare name is given (e.g. `PRD-delivery.md` or `delivery`), resolve it under `docs/specs/`.
- If no PRD is given, list the PRDs in `docs/specs/` and ask which one to plan. Do not guess.

Throughout, "the PRD" means the resolved target file.

## Output

- File name: the PRD's name with a `-plan` suffix before `.md` -- `PRD-delivery.md` -> `PRD-delivery-plan.md`.
- Location: **beside the PRD** (same directory).
- If a plan file already exists, copy it to `<name>-plan.md.bak` (overwriting any prior backup) before overwriting.

## Process

1. **Read the whole PRD first.** Understand every requirement, data-model change, API contract, edge case, and open question before touching code.

2. **Read `CLAUDE.md`.** The plan must obey the project's architecture, layer rules, naming, design-system tokens, and DB/ERP facts. Treat every "Never/Always/must" in `CLAUDE.md` as a hard constraint on the plan.

3. **Study the code the PRD touches.** Inspect code rather than reading whole files. Identify, concretely:
   - The module(s) and the four layers (`domain/`, `application/`, `infrastructure/`, `page.tsx`, `api/route.ts`) the work lands in.
   - Existing entities, use cases, repositories, and adapters to reuse or extend (don't invent parallel ones).
   - `container.ts` factories to add or change.
   - Shared code in `src/shared/` to reuse vs. new shared code to add.
   - DB tables/columns referenced (ActiveOne and our own tables) and any `create-app-tables.sql` changes.
   - Existing patterns to copy (an analogous module already does something similar -- name it).

4. **Resolve decisions.**
   - **You decide** anything determined by the PRD, by `CLAUDE.md` conventions, or by an obvious existing pattern. Record the choice in the plan with a one-line rationale; do not ask.
   - **Ask the developer** only for genuine forks the PRD leaves open *and* that materially change the implementation -- unresolved Open Questions with real trade-offs, conflicts between the PRD and the codebase, or missing facts you can't derive. Use the `question` tool with concrete options (recommended option first, labeled "(Recommended)"). Batch related questions. Don't ask about anything you can reasonably default.

5. **Write the plan.** Use the structure below. Be concrete: name real files (as clickable links), symbols, tables, and columns -- not vague phases. Sequence the steps so each builds on the last (domain -> application -> infrastructure -> container -> api -> page). Keep it actionable for an implementer (the `/implement` command should be able to follow it without re-deriving the PRD).

6. **Report** where the plan was written and summarize any decisions the developer made and any assumptions you defaulted.

## Plan file structure

```markdown
# Implementation Plan: {Title}
Source PRD: {link to the PRD}
Date: {today}

## Summary
2-4 sentences: what's being built and the overall approach.

## Affected Areas
- Modules / layers touched (with file links)
- Shared code reused or added
- DB tables/columns (ActiveOne + our own), and create-app-tables.sql changes
- container.ts factories added/changed

## Decisions
- Resolved by AI: choice -- one-line rationale (PRD/CLAUDE.md/pattern it follows)
- Resolved by developer: question -> chosen option (only if question tool was used)
- Assumptions: anything defaulted that the implementer should know

## Implementation Steps
Ordered, concrete steps following clean-architecture layering. Each step:
- What to create/change (file path link + symbol names)
- Key logic or contract (inputs/outputs, SQL shape, port interface)
- The existing pattern it mirrors, if any

## Risks & Open Questions
- Remaining unknowns, risky areas, or things to verify against live data
```

## Hard rules

- **Plan only -- never write or edit application code, SQL, or config.** The only file you create is the `-plan.md` (plus its `.bak`).
- **Obey `CLAUDE.md`.** A plan that violates a layer rule, naming rule, the module layout contract, or a DB/ERP fact is wrong -- fix the plan, don't propose the violation.
- **Be specific.** Reference real files, symbols, tables, and columns verbatim. No placeholder "TBD" steps where the PRD already answers the question.
- **Don't over-ask.** Every question to the developer costs them. Ask only for decisions that are genuinely theirs and that change the implementation. When a sensible default exists, take it and note it under Assumptions.
- **Don't invent requirements.** Plan what the PRD asks for (YAGNI). If the PRD is silent and a default is needed, choose the minimal one and record it.
