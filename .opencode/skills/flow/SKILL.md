# Skill: flow

# /flow — gated brainstorm → plan → recommend → implement → commit

Run `$ARGUMENTS` (the topic) through five gates. At each boundary, ask the developer with the `question` tool before advancing. Skip this entire skill for trivial questions, chit-chat, quick lookups, status checks, or continuing a step already in progress.

## Model Routing (Tiered Delegation)

| Phase | Model | Tier | Purpose |
|---|---|---|---|
| **Brainstorm** | `nvidia/nemotron-3-ultra-550b-a55b:free` (planner agent) | Tier 2: Free Orchestrator | Multi-step agent planning, repo indexing, execution blueprints, documentation drafts |
| **Plan** | `nvidia/nemotron-3-ultra-550b-a55b:free` (planner agent) | Tier 2: Free Orchestrator | PRD → implementation plan, decision point identification |
| **Recommendation** | Main loop (Opus) | — | Judgment calls, implementation forks, verification strategy |
| **Implement** | `deepseek/deepseek-v4-flash` (coder agent) | Tier 3: Daily Coding | Core coding, function implementation, refactoring, inline edits |
| **Commit** | `deepseek/deepseek-v4-flash` (committer agent) | Tier 3: Daily Coding | Staging, conventional commit message, push |

**Escalation:** If Flash fails a test or hits an ambiguous bug, invoke `deepseek/deepseek-v4-pro` for that specific turn via in-session model switcher (`/model deepseek/deepseek-v4-pro`).

## Gates

1. **Entry** — ask: **Brainstorm** · **Plan** · **Just go straight to it**.
   - Brainstorm → load the `brainstorm` skill (Q&A → idea capture). Runs on **Nemotron 3 Ultra (Free)**.
   - Plan → load the `plan` skill (PRD → implementation plan). Runs on **Nemotron 3 Ultra (Free)**.
2. **After brainstorm** — ask: **Plan** · **Recommend + Implement** · **Implement directly** · **Stop here**.
3. **After plan** — ask: **Recommendation round** · **Implement directly** · **Leave as-is**.
4. **Recommendation round** (before any implement) — present your implementation recommendations, then ask: **Proceed with recommendations** · **Adjust (tell me what to change)** · **Back to plan**.
   - Study codebase areas the PRD/plan touches; present up to 5 concrete recommendations with one-line rationale.
   - Cover: approach choice when plan left fork open, execution order/riskiest first, reuse existing shared primitives vs new code, edge cases plan under-specifies, verification strategy (`npx tsc --noEmit` + `npm run lint`; no build — see CLAUDE.md).
   - Mark **(Recommended)** in `question` tool where you have a clear pick; free-form via custom answers.
   - If no meaningful recommendations (plan fully fork-free and low-risk), say so in one line and skip to implement gate.
5. **Implement mode** (after recommendation round) — ask: **Implement directly (main loop)** · **Dispatch to @coder subagent**.
   - "Implement directly" → you code in this session (current behavior).
   - "Dispatch to @coder subagent" → resolve any remaining forks, then dispatch via `task` tool with `subagent_type: "coder"` (DeepSeek V4 Flash).
6. **After implement** — ask: **Commit** · **Leave as-is**.

## Routing

| Phase | Where it runs | Tool | Model |
|---|---|---|---|
| Brainstorm | main loop (this session) | `skill` tool → `brainstorm` | Nemotron 3 Ultra (Free) |
| Plan | main loop (this session) | `skill` tool → `plan` | Nemotron 3 Ultra (Free) |
| Recommendation round | main loop (this session) | `question` tool | Main loop (Opus) |
| Implement (direct) | main loop (this session) | direct edits | Main loop (Opus) |
| Implement (subagent) | **@coder subagent** | `task` tool with `subagent_type: "coder"` | DeepSeek V4 Flash (coder) |
| Commit | **@committer subagent** | `task` tool with `subagent_type: "committer"` | DeepSeek V4 Flash |

For **Implement (subagent)**: resolve any remaining open implementation forks with the developer first using `question`, then dispatch to `@coder` subagent via `task` tool with `subagent_type: "coder"` with a fork-free brief containing the PRD/plan path, the recommendation-round outcomes, and resolved decisions. Relay the subagent's summary back to the user.

For **Commit**: dispatch to the `@committer` subagent via `task` tool with `subagent_type: "committer"`, passing any `--no-push` preference from the developer. Relay the commit SHA(s), branch, and push result back to the user.

## Reads

Prefer `read` with limited offsets and `grep` over reading whole files. Use `glob` for file discovery.

Base directory for this skill: E:\Github\GreatwallScanningApp\.opencode\skills\flow
Relative paths in this skill (e.g., scripts/, reference/) are relative to this base directory.
Note: file list is sampled.

<skill_files>

</skill_files>