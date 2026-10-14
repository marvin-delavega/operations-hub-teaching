# Agentic Flow Protocol

This applies when the user's message **starts or advances real work** — a feature, change, bug fix, refactor, or design topic. **Ignore it entirely** for trivial questions, chit-chat, quick lookups, status checks, or continuing a step already in progress. Never gate a one-line answer. When it does apply, run the work through five gates.

At each gate, use **AskUserQuestion** (recommended option first). Never skip a gate silently and never chain past one without asking.

**Gate 1 — Entry (new topic).** Ask: **Brainstorm** · **Plan** · **Just answer / go straight to it**.
- Brainstorm → invoke the `brainstorm` skill (structured Q&A → PRD).
- Plan → invoke the `plan` skill (PRD → implementation plan).

**Gate 2 — After brainstorm.** Ask: **Plan** · **Recommend + Implement** · **Implement directly** · **Stop here**.

**Gate 3 — After plan.** Ask: **Recommendation round** · **Implement directly** · **Leave as-is**.

**Gate 4 — Recommendation round (before any implement).** Study the codebase areas the plan touches, then present up to **5 concrete recommendations**, each with a one-line rationale — approach choices left open by the plan, execution order/riskiest-first, reuse of existing shared primitives vs new code, under-specified edge cases, and verification strategy (`npx tsc --noEmit` + `npm run lint`; no build — see CLAUDE.md). Do not re-litigate decisions already settled in the PRD or plan. If nothing meaningful to recommend, say so in one line and skip straight to Gate 5. Then ask: **Proceed with recommendations** · **Adjust (tell me what to change)** · **Back to plan**.

**Gate 5 — After implement.** Ask: **Commit** · **Leave as-is**.

## Model routing (do not deviate)

- **Brainstorm & Plan & the Recommendation round** run here in the **main loop (Opus, high reasoning)** — the *think* tier. Do them yourself.
- **Implement** → first resolve any remaining open implementation forks **with the user here** (AskUserQuestion), then **dispatch to the `implementer` subagent** (Sonnet) via the Agent tool, passing the PRD/plan path, the recommendation-round outcomes, and the resolved decisions. The subagent can't ask the user — hand it a fork-free brief. Relay its summary.
- **Commit** → **dispatch to the `committer` subagent** (Sonnet) via the Agent tool.

## Reads

Prefer **Serena MCP** symbol tools (`get_symbols_overview`, `find_symbol`, `find_referencing_symbols`) over reading whole files — in the main loop and in every subagent brief. Plain Read/Grep only for small or non-code files.
