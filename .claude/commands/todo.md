---
description: Defer the next planned task to its own todo/{task_name}_todo.md file — only at a safe task boundary, never mid-task.
model: claude-sonnet-4-6
---

# /todo

Defer the **next** planned task so it can be picked up in a later session, without losing the context needed to resume it. This command captures that task as its own markdown file in the `todo/` folder, then stops cleanly.

This is meant to be invoked at the exact moment work pauses — when the just-finished task is complete and the developer chooses to skip the next one for later rather than continue now.

## Step 1 — Refuse if we are not at a safe boundary

Deferring must never corrupt in-progress work. Before doing anything else, confirm **all** of these are true:

- The most recently worked-on task is **fully complete** — no half-written file, no edit left unfinished, no function stubbed mid-implementation.
- There are **no pending tool calls** or unresolved errors from the last task (e.g. a failed edit, a build that was left broken).
- The session is at a **natural stopping point**, not interrupted mid-action.

If **any** of these fail, do **not** write to `todo/TODO.md`. Instead, stop and report:

> "Can't defer right now — the current task isn't at a safe stopping point ({one-line reason}). Finish or revert the in-progress change first, then run `/todo` again."

Preserving code integrity takes priority over capturing the todo.

## Step 2 — Identify the task to defer

Determine the specific next task being skipped:

- If the developer named it ("skip the PO edit module for later"), use that.
- Otherwise, use the next item from the active plan / `TodoWrite` list that has not been started.
- If there is **no** identifiable next task, treat the invocation as a request to **list** the existing `todo/*_todo.md` files (Step 5) instead of writing a new one.

If the next task is genuinely ambiguous, ask one focused question to pin it down before writing.

## Step 3 — Capture enough context to resume

Gather the minimum a future session needs to start cold:

- A short, specific title.
- Why it was deferred / what was just finished (so the resume point is clear).
- The concrete work to do.
- Relevant files and modules (use repo-relative paths).
- Any decisions already made, open questions, or constraints from `CLAUDE.md` that apply.

## Step 4 — Write todo/{task_name}_todo.md

Create the `todo/` folder if it does not exist. Write the deferred task to its own file:

- **File name:** `todo/{task_name}_todo.md`, where `{task_name}` is the task title lowercased and kebab/snake-cased to a short, filesystem-safe slug (letters, digits, underscores/hyphens only). Example: "Add PO edit module" → `todo/add_po_edit_module_todo.md`.
- If a file with that exact name already exists, append `-2`, `-3`, … before the `_todo` suffix rather than overwriting (e.g. `add_po_edit_module-2_todo.md`).

Write the file with this format, using today's date from context:

```markdown
# {Task title}

- **Status:** pending
- **Deferred:** {YYYY-MM-DD}
- **Skipped after:** {the task that was just completed, one line}

## What to do
{Concrete description of the next task.}

## Relevant files
- `path/to/file` — {note}

## Context & decisions
{Why it was deferred, decisions already made, open questions, applicable CLAUDE.md constraints.}
```

Never overwrite or delete an existing `_todo.md` file unless the developer explicitly asks.

## Step 5 — Confirm and stop

Output exactly this, then stop. Do not start the deferred task or any other work.

---

**Deferred:** {Task title} → `todo/{task_name}_todo.md`

{One sentence on what was captured.}

---

If invoked as a list request (no task to defer), instead list the existing `todo/*_todo.md` files as a short bulleted list (title + deferred date each), and stop.
