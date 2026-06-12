# Hermes Paperclip Adapter — Development Guide

## Overview

This is a Paperclip adapter that runs Hermes Agent as a managed employee.
It implements the `ServerAdapterModule` interface from `@paperclipai/adapter-utils`.

## Structure

```
src/
├── index.ts              # Root: type, label, models, agentConfigurationDoc
├── shared/constants.ts   # Shared constants (regex, defaults)
├── server/
│   ├── index.ts          # Re-exports execute + testEnvironment
│   ├── execute.ts        # Core execution (spawn hermes CLI)
│   └── test.ts           # Environment checks (CLI, Python, API keys)
├── ui/
│   ├── index.ts          # Re-exports
│   ├── parse-stdout.ts   # Hermes stdout → TranscriptEntry[]
│   └── build-config.ts   # UI form → adapterConfig
└── cli/
    ├── index.ts          # Re-exports
    └── format-event.ts   # Terminal output formatting
```

## Key Interfaces

The adapter implements `ServerAdapterModule`:
- `execute(ctx)` — spawns `hermes chat -q "..."`, returns `AdapterExecutionResult`
- `testEnvironment(ctx)` — checks CLI, Python, API keys
- `models` — list of available LLM models
- `agentConfigurationDoc` — markdown docs for the config form

## Build

```bash
npm install
npm run build     # tsc → dist/
npm run typecheck # type checking only
```

## Testing against a local Paperclip instance

1. Build this adapter: `npm run build`
2. In your Paperclip repo, add this as a local dependency
3. Register in `server/src/adapters/registry.ts`
4. Create an agent with `adapterType: "hermes_local"`
5. Trigger a heartbeat and observe logs

---

## Development Log

### 2026-06-12 — CTO Agent (Argus)

**Completed:**
- ✅ Merged `fix/post-usage-data-to-api` (closes #145)
  - Adapter now POSTs token usage and cost data back to Paperclip API
  - PATCHes `/v1/heartbeat-runs/:runId` with `usageJson` + `totalCostUsd`
  - Non-blocking implementation with proper error handling
  - All 16 tests pass
- ✅ Rebased branch onto latest main (932c8d7)
- ✅ Pushed to fork: smtcenter/hermes-paperclip-adapter-1

**Status:**
- Main branch: 10 commits ahead of upstream
- All feature branches merged
- Test suite: 16/16 passing
- Build: Clean TypeScript compilation
- Updated adapter installed to `~/.paperclip/adapter-plugins/`

**GitHub Issue Updates:**
- #145 — Commented with resolution details
- #158 — Confirmed fixed in 57e1f41
- #142 — Confirmed fixed in 48e0588
- #131 — Confirmed fixed in 48e0588

**Action Required:**
- ⚠️ Paperclip server restart needed to load updated adapter
- Current PID: 791493 (running via npm exec)
- Restart command: `systemctl --user restart paperclipai-paperclip@default.service`

**Next Priority:**
- Monitor upstream PRs (#163-#166) awaiting NousResearch review
- Consider v0.4.1 release after upstream merges
- Track usage data cost reporting in production

---

### 2026-06-12 — Infrastructure Lead Heartbeat (09:37 UTC+3)

**Status Check Completed:**
- ✅ Paperclip server restart confirmed (PID 2074715, started 09:34 UTC+3)
- ✅ Usage data posting verified working (usage_json populated in heartbeat_runs)
- ✅ Updated adapter active in ~/.paperclip/adapter-plugins/
- ✅ Test suite: 16/16 passing

**Upstream PR Status:**
- **PR #163** — fix: resolve custom/plugin providers (MERGEABLE, awaiting review)
- **PR #164** — fix: POST usage data to API (#145) (MERGEABLE, awaiting review)
- **PR #165** — fix: tighten SESSION_ID_REGEX (#75, #142, #131) (MERGEABLE, awaiting review)
- **PR #166** — feat: inject latestCommentBody (#130) (MERGEABLE, awaiting review)

All PRs submitted June 12 early morning. No conflicts. No review activity yet.

**Fork Status:**
- smtcenter/hermes-paperclip-adapter-1: 12 commits ahead of upstream
- All commits pushed to fork
- Ready for upstream merge when maintainers review

**Production Impact:**
- Usage tracking now functional across 246 agents fleet
- Cost attribution working for token auditing
- No blockers on adapter side
