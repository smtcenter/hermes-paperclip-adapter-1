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
- Coordinate push to upstream NousResearch repo (10 commits)
- Consider preparing v0.4.1 release with usage-posting fix
- Test usage data POSTing after server restart
