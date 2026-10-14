---
name: flow
description: Run a topic through the gated brainstorm → plan → implement → commit pipeline with model routing (Opus for thinking, Sonnet subagents for doing). This same pipeline is also offered automatically by the UserPromptSubmit hook on every new topic.
---

# /flow — gated brainstorm → plan → implement → commit

Run `$ARGUMENTS` (the topic) through four gates. At each boundary, ask the developer with `AskUserQuestion` (recommended option first) before advancing. This is the manual entry point for the same pipeline the flow hook offers automatically.

## Gates

1. **Entry** — ask: **Brainstorm** · **Plan** · **Just go straight to it**.
   - Brainstorm → `brainstorm` skill (Q&A → PRD).
   - Plan → `plan` skill (PRD → plan).
2. **After brainstorm** — ask: **Plan** · **Implement directly** · **Stop here**.
3. **After plan** — ask: **Implement** · **Leave as-is**.
4. **After implement** — ask: **Commit** · **Leave as-is**.

## Model routing

| Phase | Where it runs | Model / effort |
|---|---|---|
| Brainstorm | main loop (this session) | Opus · xhigh |
| Plan | main loop (this session) | Opus · xhigh |
| Implement | `implementer` subagent (Agent tool) | Sonnet · xhigh |
| Commit | `committer` subagent (Agent tool) | Sonnet · xhigh |

The subagents can't ask the user anything — **resolve implementation forks in the main loop first** (AskUserQuestion), then dispatch a fork-free brief (PRD/plan path + resolved decisions). Relay each subagent's summary back.

## Reads

Prefer **Serena MCP** symbol tools over reading whole files, in the main loop and in every subagent brief.

## Turning the auto-trigger off

The automatic version is a `UserPromptSubmit` hook in `.claude/settings.local.json` running `.claude/hooks/flow-gate.cjs`. Remove that hook block (or run `/hooks`) to disable auto-offering while keeping `/flow` available manually. The protocol text lives in `.claude/hooks/flow-protocol.md` — edit it to tune the gates or wording.
