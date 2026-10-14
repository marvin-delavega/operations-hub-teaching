---
name: commit
description: commit
invokable: true
---

Commit current changes with conventional commits, then push.

## Procedure
1. Run git status + git diff first. Never commit blind.
2. If on main, create a feature branch (feat/fix/chore/). Stay on other branches.
3. One coherent change = one commit. Unrelated concerns = split commits matching module boundaries.
4. Stage deliberately — no blanket git add -A. Never stage .env.local or data/db-config.json.
5. Write conventional commit message (format below).
6. Commit via heredoc. Never --no-verify.
7. Push (git push -u origin <branch> on first push). Never force-push without instruction.
8. Report SHA(s), branch, push result.

## Commit message format
```
<type>(<scope>): <imperative summary>
```
type: feat/fix/refactor/chore/docs/style/test/perf/build
scope: delivery/counting/replenishment/admin/history/location/supplier/auth/shared/db
summary: imperative mood, lowercase, no period, ≤72 chars

Body: blank line after subject, what + why (not how). Reference PRD if applicable.

Every commit ends with:
```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```
