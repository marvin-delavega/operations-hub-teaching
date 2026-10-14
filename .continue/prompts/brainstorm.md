---
name: brainstorm
description: brainstorm
invokable: true
---

Brainstorm and capture feature ideas for the project.

## When to use
Use this when exploring potential enhancements, new features, or architectural changes that don't yet have a PRD. The output is an idea-capture document in `todo/` — not a spec.

## Process
1. Understand the current scope: read any relevant existing code, the current module structure, and CLAUDE.md constraints.
2. Explore the problem space with the developer — what pain points, what gaps in workflow, what adjacent features would unlock value.
3. Structure ideas in tiers by value/effort, with one-sentence rationale each.
4. Capture to a markdown file: `todo/{topic}-ideas_todo.md`

## Output format
```markdown
# {Topic} — Feature Ideas

Captured {date}. Not yet scoped — each Tier 1 item likely warrants its own
PRD before implementation.

Context: {2–3 sentences on the current state and why these ideas matter}

## Tier 1 — Highest value
- [ ] **Idea** — {one-sentence rationale}

## Tier 2 — Strong, moderate effort
- [ ] **Idea** — {rationale}

## Tier 3 — Convenience / workflow
- [ ] **Idea** — {rationale}

## Suggested starting point
{opinionated advice on which to tackle first and why}
```
