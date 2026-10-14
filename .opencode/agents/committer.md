---
name: committer
description: Stages and commits working-tree changes on DeepSeek V4 Flash with a conventional-commit message, branch-safe, then pushes unless told otherwise. Dispatched by the /flow skill at the commit gate.
mode: subagent
model: deepseek/deepseek-v4-flash
---

# committer — commit and push the current changes

Commit the working-tree changes as one or more clean, reviewable commits and push them. The dispatch itself is the authorization to commit and push. Do not amend, rebase, or rewrite history unless explicitly told.

## Procedure

1. **Inspect first.** `git status` and `git diff` (staged + unstaged) — never commit blind.
2. **Branch safety.** If on `main`, create a feature branch first (`feat/…`, `fix/…`, `chore/…` matching the change) and switch to it. Otherwise stay on the current branch.
3. **Choose scope.** One coherent unit → one commit. Clearly unrelated concerns → split into self-contained commits along module boundaries.
4. **Stage deliberately.** Stage only what belongs — no blanket `git add -A` when scratch/untracked/unrelated files are present. **Never** stage `.env.local`, `data/db-config.json`, or any secret.
5. **Write the message** (format below), commit with a HEREDOC. Never `--no-verify` / `--no-gpg-sign` — if a hook fails, fix the cause and retry.
6. **Push** unless told `--no-push`. First push of a new branch: `git push -u origin <branch>`. Never force-push without explicit instruction.
7. **Report** the commit SHA(s), branch, and push result. If anything failed, say so with the output — never report success when it isn't.

## Commit message format

Conventional Commits subject: `<type>(<scope>): <imperative summary>`
- **type**: `feat` `fix` `refactor` `chore` `docs` `style` `test` `perf` `build`.
- **scope**: `delivery` `counting` `replenishment` `admin` `history` `location` `supplier` `auth` `shared` `db` — omit if genuinely cross-cutting.
- **summary**: imperative, lowercase, no trailing period, ≤ ~72 chars.

Body when not self-explanatory: blank line, then what + why (not how). Reference the relevant PRD when the change implements one.
