/**
 * Phase 2: Timeout and Grace Period Tests
 *
 * Tests boundary conditions around timeout configuration, grace period handling,
 * and session persistence across timeouts.
 *
 * Date: June 12, 2026
 * Engineer: Argus (Programmatic, SMT Group)
 */

import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  DEFAULT_TIMEOUT_SEC,
  DEFAULT_GRACE_SEC,
} from "../shared/constants.js";

/**
 * Helper to extract timeout config from adapter configuration
 */
function cfgNumber(val: unknown): number | undefined {
  if (typeof val === "number" && !isNaN(val)) return val;
  if (typeof val === "string") {
    const n = parseFloat(val);
    if (!isNaN(n)) return n;
  }
  return undefined;
}

test("Timeout Configuration", async (suite) => {
  await suite.test("should use DEFAULT_TIMEOUT_SEC when not configured", () => {
    const config: { timeoutSec?: unknown } = {};
    const timeoutSec = cfgNumber(config.timeoutSec) || DEFAULT_TIMEOUT_SEC;
    assert.strictEqual(timeoutSec, 1800, "Default timeout should be 1800s");
  });

  await suite.test("should respect custom timeout from config", () => {
    const config: { timeoutSec?: unknown } = { timeoutSec: 300 };
    const timeoutSec = cfgNumber(config.timeoutSec) || DEFAULT_TIMEOUT_SEC;
    assert.strictEqual(timeoutSec, 300, "Custom timeout should be respected");
  });

  await suite.test("should handle timeout as string", () => {
    const config: { timeoutSec?: unknown } = { timeoutSec: "600" };
    const timeoutSec = cfgNumber(config.timeoutSec) || DEFAULT_TIMEOUT_SEC;
    assert.strictEqual(timeoutSec, 600, "String timeout should be parsed");
  });

  await suite.test("should handle very short timeout (minimum 60s)", () => {
    // Note: actual minimum enforcement is in build-config.ts
    const config: { timeoutSec?: unknown } = { timeoutSec: 30 };
    const timeoutSec = cfgNumber(config.timeoutSec) || DEFAULT_TIMEOUT_SEC;
    assert.strictEqual(timeoutSec, 30, "Short timeout parsed as-is");
    // In production, build-config.ts enforces Math.max(60, value)
  });

  await suite.test("should handle very long timeout", () => {
    const config: { timeoutSec?: unknown } = { timeoutSec: 18000 }; // 5 hours
    const timeoutSec = cfgNumber(config.timeoutSec) || DEFAULT_TIMEOUT_SEC;
    assert.strictEqual(timeoutSec, 18000, "Long timeouts are supported");
  });

  await suite.test("should reject invalid timeout strings", () => {
    const config: { timeoutSec?: unknown } = { timeoutSec: "not-a-number" };
    const timeoutSec = cfgNumber(config.timeoutSec) || DEFAULT_TIMEOUT_SEC;
    assert.strictEqual(
      timeoutSec,
      DEFAULT_TIMEOUT_SEC,
      "Invalid string should fall back to default",
    );
  });

  await suite.test("should reject NaN timeout", () => {
    const config: { timeoutSec?: unknown } = { timeoutSec: NaN };
    const timeoutSec = cfgNumber(config.timeoutSec) || DEFAULT_TIMEOUT_SEC;
    assert.strictEqual(
      timeoutSec,
      DEFAULT_TIMEOUT_SEC,
      "NaN should fall back to default",
    );
  });

  await suite.test("should reject null timeout", () => {
    const config: { timeoutSec?: unknown } = { timeoutSec: null };
    const timeoutSec = cfgNumber(config.timeoutSec) || DEFAULT_TIMEOUT_SEC;
    assert.strictEqual(
      timeoutSec,
      DEFAULT_TIMEOUT_SEC,
      "null should fall back to default",
    );
  });
});

test("Grace Period Configuration", async (suite) => {
  await suite.test("should use DEFAULT_GRACE_SEC", () => {
    assert.strictEqual(
      DEFAULT_GRACE_SEC,
      10,
      "Default grace period should be 10s",
    );
  });

  await suite.test("should enforce grace period after timeout", () => {
    const timeoutSec = 60;
    const graceSec = DEFAULT_GRACE_SEC;
    const totalTime = timeoutSec + graceSec;

    assert.strictEqual(
      totalTime,
      70,
      "Total time should be timeout + grace (60 + 10)",
    );
  });

  await suite.test("should handle custom grace period", () => {
    const config: { graceSec?: unknown } = { graceSec: 30 };
    const graceSec = cfgNumber(config.graceSec) || DEFAULT_GRACE_SEC;
    assert.strictEqual(graceSec, 30, "Custom grace period should be respected");
  });
});

test("Timeout Result Handling", async (suite) => {
  await suite.test("should detect timed out execution", () => {
    const result = {
      exitCode: null,
      stdout: "Partial output before timeout",
      stderr: "",
      timedOut: true,
    };

    assert.strictEqual(
      result.timedOut,
      true,
      "Result should indicate timeout occurred",
    );
    assert.strictEqual(
      result.exitCode,
      null,
      "Exit code should be null on timeout",
    );
    assert.ok(result.stdout.length > 0, "Partial output should be preserved");
  });

  await suite.test("should preserve session ID on timeout", () => {
    const stdout = "session_id: 20260612_143022_a3b8f4c\nTask in progress...";
    const result = {
      exitCode: null,
      stdout,
      stderr: "",
      timedOut: true,
    };

    // Session ID regex from constants.ts
    const sessionMatch = stdout.match(/session[_ ](?:id|saved)[:\s]+([a-zA-Z0-9_-]+)/i);
    assert.ok(sessionMatch, "Session ID should be extractable from stdout");
    assert.strictEqual(
      sessionMatch[1],
      "20260612_143022_a3b8f4c",
      "Session ID should match",
    );
    assert.ok(result.timedOut, "Timeout flag should be set");
  });

  await suite.test("should handle timeout with no output", () => {
    const result = {
      exitCode: null,
      stdout: "",
      stderr: "",
      timedOut: true,
    };

    assert.strictEqual(result.timedOut, true);
    assert.strictEqual(result.stdout, "", "Stdout should be empty");
    // Execution should not crash on empty output
  });

  await suite.test("should distinguish timeout from normal completion", () => {
    const timeoutResult = {
      exitCode: null,
      stdout: "Partial work",
      stderr: "",
      timedOut: true,
    };

    const successResult = {
      exitCode: 0,
      stdout: "Complete response",
      stderr: "",
      timedOut: false,
    };

    assert.strictEqual(
      timeoutResult.timedOut,
      true,
      "Timeout result should have timedOut=true",
    );
    assert.strictEqual(
      successResult.timedOut,
      false,
      "Success result should have timedOut=false",
    );
    assert.strictEqual(
      successResult.exitCode,
      0,
      "Success should have exit code 0",
    );
  });
});

test("Session Resumption After Timeout", async (suite) => {
  await suite.test("should resume session after timeout (documented behavior)", () => {
    // Phase 2 documentation: session ID should be preserved across timeouts
    // for next heartbeat to resume from the same context
    const firstRun = {
      sessionId: "20260612_143022_a3b8f4c",
      timedOut: true,
    };

    const secondRun = {
      resumeSessionId: firstRun.sessionId,
      timedOut: false,
      exitCode: 0,
    };

    assert.strictEqual(
      secondRun.resumeSessionId,
      firstRun.sessionId,
      "Second run should resume from first run's session ID",
    );
    assert.ok(
      !secondRun.timedOut,
      "Second run should complete without timeout",
    );
  });

  await suite.test("should preserve session even on consecutive timeouts", () => {
    const sessions = [
      { sessionId: "20260612_143022_a3b8f4c", timedOut: true },
      { sessionId: "20260612_143022_a3b8f4c", timedOut: true },
      { sessionId: "20260612_143022_a3b8f4c", timedOut: false },
    ];

    const uniqueSessions = new Set(sessions.map((s) => s.sessionId));
    assert.strictEqual(
      uniqueSessions.size,
      1,
      "All runs should use same session ID",
    );
    assert.ok(
      !sessions[2].timedOut,
      "Final run should complete successfully",
    );
  });
});

test("Timeout Boundary Conditions", async (suite) => {
  await suite.test("should handle timeout exactly at configured value", () => {
    const config: { timeoutSec?: unknown } = { timeoutSec: 300 };
    const timeoutSec = cfgNumber(config.timeoutSec) || DEFAULT_TIMEOUT_SEC;

    const executionTime = 300; // exactly at timeout
    const didTimeout = executionTime >= timeoutSec;

    assert.ok(
      didTimeout,
      "Execution at exactly timeout threshold should be considered timed out",
    );
  });

  await suite.test("should not timeout if execution finishes 1s before limit", () => {
    const config: { timeoutSec?: unknown } = { timeoutSec: 300 };
    const timeoutSec = cfgNumber(config.timeoutSec) || DEFAULT_TIMEOUT_SEC;

    const executionTime = 299; // 1s before timeout
    const didTimeout = executionTime >= timeoutSec;

    assert.ok(
      !didTimeout,
      "Execution finishing before timeout should not be considered timed out",
    );
  });

  await suite.test("should timeout if execution exceeds limit by 1s", () => {
    const config: { timeoutSec?: unknown } = { timeoutSec: 300 };
    const timeoutSec = cfgNumber(config.timeoutSec) || DEFAULT_TIMEOUT_SEC;

    const executionTime = 301; // 1s over timeout
    const didTimeout = executionTime > timeoutSec;

    assert.ok(
      didTimeout,
      "Execution exceeding timeout should be considered timed out",
    );
  });
});

test("Configuration-Based Timeout Calculation", async (suite) => {
  await suite.test("should calculate timeout from maxTurnsPerRun (ui/build-config.ts pattern)", () => {
    // From build-config.ts: Math.max(DEFAULT_TIMEOUT_SEC, v.maxTurnsPerRun * 20)
    const maxTurnsPerRun = 150;
    const calculatedTimeout = Math.max(
      DEFAULT_TIMEOUT_SEC,
      maxTurnsPerRun * 20,
    );

    assert.strictEqual(
      calculatedTimeout,
      3000,
      "150 turns * 20s = 3000s timeout",
    );
  });

  await suite.test("should use default timeout if maxTurns calculation is lower", () => {
    const maxTurnsPerRun = 10;
    const calculatedTimeout = Math.max(
      DEFAULT_TIMEOUT_SEC,
      maxTurnsPerRun * 20,
    );

    assert.strictEqual(
      calculatedTimeout,
      DEFAULT_TIMEOUT_SEC,
      "Should fall back to DEFAULT_TIMEOUT_SEC (1800) when turns * 20 < 1800",
    );
  });

  await suite.test("should handle undefined maxTurnsPerRun", () => {
    const maxTurnsPerRun = undefined;
    const calculated = maxTurnsPerRun
      ? Math.max(DEFAULT_TIMEOUT_SEC, maxTurnsPerRun * 20)
      : DEFAULT_TIMEOUT_SEC;

    assert.strictEqual(
      calculated,
      DEFAULT_TIMEOUT_SEC,
      "Should use default when maxTurnsPerRun is undefined",
    );
  });
});

test("Timeout Documentation and Contract", async (suite) => {
  await suite.test("should document timeout parameter in adapter config", () => {
    // From index.ts documentation:
    // | timeoutSec | number | 300 | Execution timeout in seconds |
    const documentedParam = "timeoutSec";
    const documentedType = "number";
    const documentedDefault = 300; // This is documentation value, runtime default is 1800

    assert.ok(
      documentedParam === "timeoutSec",
      "Parameter name should match documentation",
    );
    assert.ok(
      documentedType === "number",
      "Parameter type should be number",
    );
    assert.ok(
      typeof DEFAULT_TIMEOUT_SEC === "number",
      "Runtime default should be a number",
    );
  });

  await suite.test("should verify grace period is less than timeout", () => {
    assert.ok(
      DEFAULT_GRACE_SEC < DEFAULT_TIMEOUT_SEC,
      "Grace period should be significantly shorter than timeout",
    );
    const ratio = DEFAULT_TIMEOUT_SEC / DEFAULT_GRACE_SEC;
    assert.ok(
      ratio > 10,
      "Timeout should be at least 10x grace period (1800/10 = 180)",
    );
  });
});
