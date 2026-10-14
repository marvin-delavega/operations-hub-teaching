---
name: brainstorm
description: Brainstorm and capture feature ideas, enhancements, or architectural changes that don't yet have a PRD. Outputs an idea-capture document in todo/ -- not a spec. Use when exploring potential improvements before scoping a PRD.
---

# /brainstorm -- Capture Feature Ideas

Brainstorm and capture feature ideas for the project.

## Model Routing (Tiered Delegation)

**Brainstorm runs on: `nvidia/nemotron-3-ultra-550b-a55b:free` (planner agent) — Tier 2: Free Orchestrator**

- Multi-step exploration, repo indexing, execution blueprints, documentation drafts
- **$0.00 cost** — free tier for all brainstorming

## STOPSIGN RULES (CRITICAL)
- DO NOT write, edit, or modify any application code, tests, or configuration files.
- The ONLY file creation allowed is the markdown file in the `todo/` directory.
- If you feel tempted to write implementation code, STOP and ask the developer a clarifying question instead.

## When to use
Use this when exploring potential enhancements, new features, or architectural changes that don't yet have a PRD. The output is an idea-capture document in `todo/` -- not a spec.

## Process
1. **Understand context only**: Read relevant existing code and CLAUDE.md constraints to understand structure. DO NOT modify them.
2. **Explore the space**: Discuss the problem space with the developer via terminal chat first. Ask 1-2 clarifying questions about pain points, gaps, or workflow improvements before generating the file.
3. **Structure ideas**: Group ideas in tiers by value/effort, with a one-sentence rationale each.
4. **Capture to markdown**: Create exactly one markdown file: `todo/{topic}-ideas_todo.md`. Stop execution immediately after writing this single file.

## Output format
```markdown
# {Topic} -- Feature Ideas

Captured {date}. Not yet scoped -- each Tier 1 item likely warrants its own
PRD before implementation.

Context: {2-3 sentences on the current state and why these ideas matter}

## Tier 1 -- Highest value
- [ ] **Idea** -- {one-sentence rationale}

## Tier 2 -- Strong, moderate effort
- [ ] **Idea** -- {rationale}

## Tier 3 -- Convenience / workflow
- [ ] **Idea** -- {rationale}

## Suggested starting point
{opinionated advice on which to tackle first and why}
```
