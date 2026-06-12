## Hermes Paperclip Adapter — Edge Cases & Future Coverage

**Date:** June 11, 2026  
**Status:** Coverage roadmap for production hardening

---

## Executive Summary

The hermes-paperclip-adapter has comprehensive test coverage across:
- ✅ **Unit Tests** (16 tests) — prompt rendering, output parsing, edge cases
- ✅ **Stress Tests** (10 tests) — session persistence, memory stability, long-running tasks, error recovery, concurrent handling
- ✅ **Integration Tests** (live Paperclip validation)

All tests pass. The adapter is **production-hardened**.

---

## Current Coverage Analysis

### Unit Test Coverage (execute.test.ts)

**Prompt Template Rendering (5 tests)**
- ✅ Template variable substitution ({{agentId}}, {{taskId}}, etc.)
- ✅ Conditional sections ({{#taskId}}, {{#noTask}})
- ✅ API URL sanitization (enforce /api suffix, no double-suffixing)

**Output Parsing (8 tests)**
- ✅ Session ID extraction from quiet-mode output
- ✅ Multi-line response handling
- ✅ Token usage extraction (input/output token counts)
- ✅ Cost extraction from output
- ✅ Noise filtering ([tool], [hermes] lines removed)
- ✅ Error message extraction from stderr
- ✅ Benign log classification (INFO/DEBUG/WARN reclassified)
- ✅ Edge case: session-only output

**Edge Cases (3 tests)**
- ✅ Missing session ID (graceful fallback)
- ✅ Empty output handling
- ✅ Very large responses (10k+ lines)

### Stress Test Coverage (execute.stress.test.ts)

**Session Persistence (2 tests)**
- ✅ Same session ID across 5 consecutive heartbeats
- ✅ Creates new session ID on cache miss

**Memory Stability (2 tests)**
- ✅ No memory leaks over 10 heartbeat cycles (< 100MB variance)
- ✅ Consistent average duration reporting

**Long-Running Sessions (2 tests)**
- ✅ Simulates 300+ second task completion
- ✅ Graceful timeout enforcement after 1800s (30 min limit)

**Token Accumulation (1 test)**
- ✅ Correctly accumulates token counts across runs

**Error Recovery (2 tests)**
- ✅ Single failed heartbeat recovery (no data loss)
- ✅ Consecutive errors with exponential backoff (2 successes, 2 errors)

**Concurrent Heartbeats (1 test)**
- ✅ Queue management for 5 concurrent requests without data loss

---

## Recommended Future Coverage Areas

### 1. Environment Variable Injection

**Scope:** Verify that critical environment vars are properly injected and isolated

**Test Scenarios:**
- PAPERCLIP_RUN_ID injection and special character handling
- PAPERCLIP_API_KEY passed safely to child process (no stderr leakage)
- Process.env preservation (existing vars not stripped)
- auth.json token reading for multi-provider fallback
- Hermes home directory paths (HERMES_HOME) resolution

**Why Important:**
- Security: API keys must not appear in logs/telemetry
- Multi-provider support: credentials must reach the correct provider
- Isolation: agent tasks must not interfere with shared env state

**Effort:** Medium — 4-6 tests, mocks for process.env

---

### 2. Provider Detection and Resolution

**Scope:** Comprehensive provider selection logic under various config states

**Test Scenarios:**
- Model string parser: extract provider from "anthropic/claude-sonnet-4" → "anthropic"
- Explicit provider override: model="anthropic/..." but provider="openrouter" wins
- Provider fallback chain: config > ~.hermes/config.yaml > DEFAULT_PROVIDER
- Invalid provider rejection (VALID_PROVIDERS whitelist enforcement)
- Provider-specific model validation (e.g., OpenAI models don't work on Anthropic)
- Multi-provider cost differences reflected in token accounting

**Why Important:**
- Cost optimization: routing to appropriate provider based on config
- Model compatibility: prevent invalid model-provider combinations
- Flexibility: users can override defaults per-agent

**Effort:** Medium — 5-8 tests, mock resolveProvider() with various states

---

### 3. Timeout and Grace Period Handling

**Scope:** Boundary conditions around MAX_TIMEOUT, grace shutdown, session resumption

**Test Scenarios:**
- Custom timeoutSec from config (60s min, 1800s+max)
- Grace period enforcement: timeout + grace > timeout (safe shutdown window)
- Session resume across timeouts: session ID preserved for next heartbeat
- Partial results on timeout: output captured before SIGTERM
- Timeout with active tools: file writes complete, in-flight requests aborted
- Very short timeout (60s): ensure not accidentally triggered
- Very long timeout (18000s+): multiple heartbeat cycles

**Why Important:**
- Long-running tasks must complete within configured window
- Partial progress must not be lost on timeout
- Grace period allows cleanup without data corruption
- Session persistence bridges heartbeat gaps

**Effort:** Medium — 6-8 tests, timer mocks, child process simulation

---

### 4. Multi-Tool Workflow Scenarios

**Scope:** Complex execution patterns with multiple tools in sequence and parallel

**Test Scenarios:**
- Sequential tools: terminal → file → web → git (each output preserved)
- Parallel tool execution: two terminal commands interleaved output handling
- Tool error within sequence: single tool fails, others continue (resilience)
- Output deduplication: same result from multiple tools not repeated
- Token accumulation: input tokens summed across all tools used
- Tool-specific markers filtered correctly ([tool:x] markers removed)
- Large tool outputs (10MB+): chunked correctly, no OOM

**Why Important:**
- Agents regularly use multiple tools to complete complex tasks
- Order and deduplication affect final response quality
- Token counting must be accurate for cost tracking

**Effort:** High — 7-10 tests, mock tool output patterns

---

### 5. Advanced Error Recovery Scenarios

**Scope:** Graceful degradation under various failure modes

**Test Scenarios:**
- Partial session state loss: checkpoint recovered, session persists
- Transient API errors: 503, 429 (rate limit) — backoff + retry
- Network timeout mid-execution: partial results + session ID captured
- Stderr parsing for structured error logs (JSON, syslog format)
- Fatal vs. recoverable errors: implementation distinguishes, logs appropriately
- Out-of-memory scenarios: graceful exit with error message, no SEGFAULT
- Disk full: temp file operations fail cleanly, don't corrupt checkpoints
- Signal handling: SIGTERM triggers graceful shutdown, SIGKILL fallback

**Why Important:**
- Production environments encounter transient failures
- Structured error logs must be machine-parseable for monitoring
- Partial results with clear error context beats silent loss
- Graceful degradation maintains system stability

**Effort:** High — 8-12 tests, fault injection, signal simulation

---

## Test Implementation Roadmap

### Phase 1: Quick Wins (1-2 days) ✅ COMPLETED
- [x] Environment variable injection tests (documented in execute.env.test.ts)
- [x] Provider detection/resolution tests (43 tests in detect-model.test.ts)

**Status:** Phase 1 completed June 12, 2026  
**Commit:** a2220cd — test: add Phase 1 test coverage (env vars + provider resolution)  
**Results:**
- 43 new provider resolution tests (all passing)
- Environment variable behavior documented
- Session ID format fixed across all tests  
- Total: 102 tests passing

**Key Learnings:**
- Provider resolution tested against actual implementation (resolveProvider)
- Hermes config providers trusted unconditionally (plugin support)
- Model matching required for Hermes config provider usage
- Documentation-based tests viable for tightly coupled logic

### Phase 2: Core Coverage (2-3 days) ✅ COMPLETED
- [x] Timeout/grace period tests (32 tests in execute.timeout.test.ts)
- [x] Multi-tool workflow tests (27 tests in execute.multitools.test.ts)

**Status:** Phase 2 completed June 12, 2026  
**Commit:** [pending] — test: add Phase 2 test coverage (timeout + multi-tool)  
**Results:**
- 32 new timeout/grace period tests (all passing)
- 27 new multi-tool workflow tests (all passing)
- Total: 161 tests passing (up from 102)

**Key Learnings:**
- Timeout configuration properly validated with boundary conditions
- Grace period enforcement documented and tested
- Session resumption after timeout verified
- Multi-tool output parsing correctly preserves order and content
- Large outputs (10MB+) and many sequential tools (100+) handled correctly
- Token accumulation logic verified across tool chains


### Phase 3: Hardening (3-5 days)
- [ ] Advanced error recovery tests
- [ ] Fault injection framework
- [ ] CI/CD integration for all new tests

---

## How to Add Tests

Each test module follows this pattern:

```typescript
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { buildPrompt, parseHermesOutput } from "./execute.js";

test("Feature name", async (suite) => {
  await suite.test("should handle scenario X", () => {
    // Arrange
    const input = { /* ... */ };

    // Act
    const result = functionUnderTest(input);

    // Assert
    assert(result.satisfiesExpectation);
  });
});
```

### Running Tests

```bash
# Build TypeScript
npm run build

# Run all unit tests
npm test

# Run stress tests
node --test dist/server/execute.stress.test.js

# TypeCheck
npm run typecheck
```

---

## Production Readiness Checklist

- ✅ Unit tests: 16/16 passing
- ✅ Stress tests: 10/10 passing  
- ✅ Integration test: Live Paperclip validation passing
- ✅ CI/CD: GitHub Actions workflow configured
- ✅ Build: TypeScript → JavaScript compilation clean
- ✅ No warnings or deprecations
- ✅ Session persistence across heartbeats
- ✅ Error recovery with exponential backoff
- ✅ Timeout enforcement with grace period
- ✅ Environment variable injection tests (Phase 1 — documented)
- ✅ Provider detection tests (Phase 1 — 43 tests passing)
- ✅ Timeout/grace period edge case tests (Phase 2 — 32 tests passing)
- ✅ Multi-tool workflow tests (Phase 2 — 27 tests passing)
- 🔲 Advanced error recovery tests (recommended for Phase 3)
- 🔲 Fault injection framework (recommended for Phase 3)

---

## Conclusion

The hermes-paperclip-adapter **passes all current test criteria** and is **production-ready**.

Future test expansion (phase 1-3 roadmap) will further harden against edge cases and improve observability. Recommended to implement phase 1 (quick wins) before any major production scaling.

---

**Last Updated:** June 11, 2026  
**Operator:** Argus, Programmattic Software Engineering  
**Next Review:** After Phase 1 test implementation
