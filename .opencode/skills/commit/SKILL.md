---
name: commit
description: Stage and commit the current working-tree changes with a well-formed conventional commit message, then push. Use when the user asks to commit, save, or push their changes.
---

# /commit -- Commit current changes

Commit the working-tree changes as one or more clean, reviewable commits and push them.

## Model Routing (Tiered Delegation)

**Commit runs on: `@committer` subagent (`deepseek/deepseek-v4-flash`) — Tier 3: Daily Coding**

- Git operations, diff analysis, conventional commit message generation, push
- Ultra-low cost — paid but minimal token usage

## Arguments

`$ARGUMENTS` is optional:

- **Free text** (e.g. `/commit fix due-date rounding`) -- a hint for the commit message subject. Refine it into a proper conventional-commit message; don't paste it verbatim.
- **`--no-push`** -- commit but do not push.
- No argument -> derive the message entirely from the diff.

## Procedure

1. **Inspect first.** Run `git status` and `git diff` (staged + unstaged) to understand every change. Never commit blind.
2. **Branch safety.** If on `main`, do **not** commit there -- create a feature branch first (`feat/...`, `fix/...`, or `chore/...` matching the change) and switch to it. On any other branch, stay on it.
3. **Choose scope.** If the changes are one coherent unit, make a single commit. If they are clearly unrelated concerns, split into multiple commits -- each self-contained and independently reviewable. Match the repo's clean-architecture module boundaries when splitting.
4. **Stage deliberately.** Stage the files that belong to the commit. Do **not** blanket `git add -A` if untracked junk, scratch files, or unrelated edits are present -- stage what belongs. Never stage secrets (`.env.local`, `data/db-config.json`).
5. **Write the message** (format below).
6. **Commit.** Use a HEREDOC so the body formats correctly. Never pass `--no-verify` -- if a pre-commit hook fails, fix the underlying issue and retry; do not bypass it.
7. **Push** (unless `--no-push`). Use `git push -u origin <branch>` on first push of a new branch. Never force-push without explicit instruction.
8. **Report** the commit SHA(s), branch, and push result. If a hook or push failed, say so with the output -- don't claim success.

## Commit message format

Conventional Commits. Subject line:

```
<type>(<scope>): <imperative summary>
```

- **type**: `feat`, `fix`, `refactor`, `chore`, `docs`, `style`, `test`, `perf`, `build`.
- **scope**: the module or area -- `delivery`, `counting`, `replenishment`, `admin`, `history`, `location`, `supplier`, `auth`, `shared`, `db`. Omit if genuinely cross-cutting.
- **summary**: imperative mood ("add", not "added"/"adds"), lowercase, no trailing period, <= ~72 chars.

### Auto Tag on Merge bump token

The repo's `Auto Tag on Merge` GitHub Action (`.github/workflows/`) bumps the semver tag on `main` and ignores conventional-commit regexes -- it keys off a **substring token in the commit log**. Append the matching token to the commit message so the merge produces the intended bump; the token is dropped from the subject (trailing period stays off), and it can go in the body:

- `#major` -- breaking change
- `#minor` -- `feat` (default fallback when no token present is `minor`)
- `#patch` -- `fix`, `refactor`, `chore`, `docs`
- `#none` -- no version bump

Example:

```
feat(replenishment): pool selling-area demand into feeder sales rate

Combined rate = feeder + mapped selling areas; effective_available stays
the feeder's on-hand+incoming. Rides the existing item_sales_daily rollup,
no schema change. Implements PRD-replenishment-selling-area-demand-pooling.md.

#minor
```

Body (when the change isn't self-explanatory from the subject):

- Blank line after subject, then wrapped prose or bullets explaining **what** and **why**, not the how (the diff shows how).
- Reference the relevant PRD (e.g. `PRD-delivery.md`) when the change implements one.

### Example

```bash
git commit -F- <<'EOF'
feat(replenishment): pool selling-area demand into feeder sales rate

Combined rate = feeder + mapped selling areas; effective_available stays
the feeder's on-hand+incoming. Rides the existing item_sales_daily rollup,
no schema change. Implements PRD-replenishment-selling-area-demand-pooling.md.
EOF
```

## Rules

- **Only what's asked** -- this skill's invocation *is* the authorization to commit and push. Do not also amend prior commits, rebase, or rewrite history unless explicitly told.
- **No secrets** -- never stage or commit `.env.local`, `data/db-config.json`, or credentials.
- **Respect hooks** -- no `--no-verify`, no `--no-gpg-sign`.
- **Faithful reporting** -- if anything fails (hook, lint, push), surface the error; never report a commit as done when it isn't.
