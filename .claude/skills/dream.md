---
name: dream
description: Make CLAUDE.md leaner and more AI-readable. Trims to ~200 lines, simplifies prose, improves scannable formatting, and drops narrowly module-specific detail while preserving all cross-cutting rules. Use when the user asks to slim down, condense, prune, or "dream" the CLAUDE.md.
---

# /dream — Lean the CLAUDE.md

Rewrite `CLAUDE.md` so an AI can scan it fast. **Compress the wording, not the knowledge.**

## Arguments

`$ARGUMENTS` is optional:

- A **number** (e.g. `/dream 150`) overrides the target line count.
- A **path** (e.g. `/dream PRD-delivery.md`) leans that file instead of `CLAUDE.md`.
- Both may be given in any order. With no argument, default to `CLAUDE.md` at ~200 lines.

Throughout this skill, "the file" means the resolved target (default `CLAUDE.md`).

## Target

- Aim for **~200 lines** (or the count given in `$ARGUMENTS`). Going modestly over (say up to ~15%) is fine when staying under would drop context an AI genuinely needs.
- Optimize for **AI readability**, not human prose. Terse, structured, scannable.

## What to do

1. **Read the whole `CLAUDE.md` first.** Understand every rule before cutting anything.
2. **Simplify sentences.** Strip filler, hedging, and restated motivation. Keep the rule, drop the explanation of why it's obvious. One idea per line.
3. **Improve formatting for scanning:**
   - Prefer tight bullet lists and tables over paragraphs.
   - Lead each bullet with the key noun/rule, not preamble.
   - Use bold sparingly for the actual constraint ("**Never** ...", "**Always** ...").
   - Group related rules under clear headings; collapse redundant headings.
   - Keep code/command blocks that carry exact syntax.
4. **Cut narrowly module-specific detail.** Remove lines that only ever apply to one specific process or one screen's edge case. A module can keep a short block, but trim its blow-by-blow procedural detail down to the durable decisions.
5. **Preserve everything cross-cutting.** Keep rules that apply across all modules: architecture/layer rules, naming conventions, the module layout contract, auth/middleware invariants, the DB/ERP integration facts (no API, no receiving step), design-system tokens, and coding principles. When unsure whether a rule is global, **keep it**.

## Hard rules

- **Do not invent or change facts.** Only condense what's already there. If two lines conflict, keep both meanings or ask — never silently pick one.
- **Do not drop a constraint to save space.** Merge or shorten it instead. Losing a "Never do X" rule is a failure even if the line count is great.
- Preserve exact identifiers verbatim: table/column names, route paths, env var names, file paths, token names, commands.
- Keep the app name conventions and the page-title format exactly.

## Process

1. **Read the file** and note its current line count.
2. **Draft** the lean version section by section, applying the rules above.
3. **Constraint self-check** — list every "Never/Always/must" rule from the original and confirm each survives in the draft (possibly merged). Fix any that fell out.
4. **Identifier self-check** — collect every exact identifier from the original (table/column names, route paths, env var names, file paths, token names, commands) and confirm each still appears verbatim in the draft. If one is gone, restore it.
5. **Propose, then write.** Present the cut/merge summary plus old → projected line count and wait for the user's go-ahead. Do **not** overwrite first.
   - This repo has no git, so an overwrite is irreversible. Before writing, copy the original to `<file>.bak` (e.g. `CLAUDE.md.bak`), overwriting any prior backup.
   - Then write the new file.
6. **Report** the final old → new line count and where the backup was saved.
