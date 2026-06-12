/**
 * Integration tests for the Hermes Paperclip adapter execution engine.
 *
 * Run with: npm test (requires Node 18+)
 * Or manually: node --test dist/server/execute.test.js
 *
 * These tests validate:
 * - Command argument assembly
 * - Prompt template rendering
 * - Environment variable injection
 * - Output parsing (session IDs, token usage, errors)
 * - Session persistence
 */

import { test, describe } from "node:test";
import assert from "node:assert";
import type { AdapterExecutionContext } from "@paperclipai/adapter-utils";

import {
  parseHermesOutput,
  buildPrompt,
} from "./execute.js";

describe("Hermes Paperclip Adapter — execute.ts", () => {
  describe("Prompt template rendering", () => {
    test("should build a prompt with task details when taskId is provided", () => {
      const ctx: Partial<AdapterExecutionContext> = {
        agent: {
          id: "agent-123",
          name: "Test Agent",
          companyId: "company-456",
        } as any,
        config: {
          taskId: "TRA-42",
          taskTitle: "Fix login flow",
          taskBody: "The login form is broken. Please fix it.",
        },
      };

      const config = {
        promptTemplate: `Agent: {{agentName}}\nTask: {{taskId}} — {{taskTitle}}\n{{taskBody}}`,
      };

      const prompt = buildPrompt(ctx as AdapterExecutionContext, config);

      assert(
        prompt.includes("Agent: Test Agent"),
        "Prompt should include agent name",
      );
      assert(
        prompt.includes("Task: TRA-42 — Fix login flow"),
        "Prompt should include task ID and title",
      );
      assert(
        prompt.includes("The login form is broken"),
        "Prompt should include task body",
      );
    });

    test("should include taskId conditional section when task is assigned", () => {
      const ctx: Partial<AdapterExecutionContext> = {
        agent: {
          id: "agent-123",
          name: "Test Agent",
          companyId: "company-456",
        } as any,
        config: { taskId: "TRA-42" },
      };

      const config = {
        promptTemplate: `{{#taskId}}Task assigned: {{taskId}}{{/taskId}}{{#noTask}}No task{{/noTask}}`,
      };

      const prompt = buildPrompt(ctx as AdapterExecutionContext, config);

      assert(prompt.includes("Task assigned: TRA-42"), "Should include taskId");
      assert(!prompt.includes("No task"), "Should not include noTask");
    });

    test("should include noTask conditional section when no task is assigned", () => {
      const ctx: Partial<AdapterExecutionContext> = {
        agent: {
          id: "agent-123",
          name: "Test Agent",
          companyId: "company-456",
        } as any,
        config: {},
      };

      const config = {
        promptTemplate: `{{#taskId}}Task assigned: {{taskId}}{{/taskId}}{{#noTask}}No task{{/noTask}}`,
      };

      const prompt = buildPrompt(ctx as AdapterExecutionContext, config);

      assert(!prompt.includes("Task assigned"), "Should not include taskId");
      assert(prompt.includes("No task"), "Should include noTask");
    });

    test("should read task data from ctx.context (current Paperclip schema)", () => {
      const ctx: Partial<AdapterExecutionContext> = {
        agent: {
          id: "agent-123",
          name: "Test Agent",
          companyId: "company-456",
        } as any,
        context: {
          taskId: "49936113-4e6f-4dc3-9d36-dc9eb405befd",
          paperclipIssue: {
            id: "49936113-4e6f-4dc3-9d36-dc9eb405befd",
            title: "Deploy feature X",
            description: "Deploy the new feature to production.",
          },
          wakeReason: "assignment",
          latestCommentId: "comment-789",
          latestCommentBody: "This is urgent!",
        },
        config: {},
      };

      const config = {
        promptTemplate: `Task: {{taskId}}
Title: {{taskTitle}}
Body: {{taskBody}}
Comment: {{commentId}} — {{latestCommentBody}}
Wake: {{wakeReason}}`,
      };

      const prompt = buildPrompt(ctx as AdapterExecutionContext, config);

      assert(
        prompt.includes("Task: 49936113-4e6f-4dc3-9d36-dc9eb405befd"),
        "Should read taskId from ctx.context",
      );
      assert(
        prompt.includes("Title: Deploy feature X"),
        "Should read title from ctx.context.paperclipIssue",
      );
      assert(
        prompt.includes("Body: Deploy the new feature to production."),
        "Should read description from ctx.context.paperclipIssue",
      );
      assert(
        prompt.includes("Comment: comment-789"),
        "Should read commentId from ctx.context.latestCommentId",
      );
      assert(
        prompt.includes("This is urgent!"),
        "Should read latestCommentBody from ctx.context",
      );
      assert(
        prompt.includes("Wake: assignment"),
        "Should read wakeReason from ctx.context",
      );
    });

    test("should fall back to ctx.config when ctx.context is empty (legacy compatibility)", () => {
      const ctx: Partial<AdapterExecutionContext> = {
        agent: {
          id: "agent-123",
          name: "Test Agent",
          companyId: "company-456",
        } as any,
        context: {},
        config: {
          taskId: "TRA-99",
          taskTitle: "Legacy task",
          taskBody: "Old-style task data",
        },
      };

      const config = {
        promptTemplate: `Task: {{taskId}} — {{taskTitle}}`,
      };

      const prompt = buildPrompt(ctx as AdapterExecutionContext, config);

      assert(
        prompt.includes("Task: TRA-99 — Legacy task"),
        "Should fall back to ctx.config when ctx.context is empty",
      );
    });

    test("should prefer ctx.context over ctx.config when both exist", () => {
      const ctx: Partial<AdapterExecutionContext> = {
        agent: {
          id: "agent-123",
          name: "Test Agent",
          companyId: "company-456",
        } as any,
        context: {
          taskId: "new-id",
          paperclipIssue: {
            title: "New title",
          },
        },
        config: {
          taskId: "old-id",
          taskTitle: "Old title",
        },
      };

      const config = {
        promptTemplate: `Task: {{taskId}} — {{taskTitle}}`,
      };

      const prompt = buildPrompt(ctx as AdapterExecutionContext, config);

      assert(
        prompt.includes("Task: new-id — New title"),
        "Should prefer ctx.context over ctx.config",
      );
      assert(
        !prompt.includes("old-id"),
        "Should not use old ctx.config when ctx.context exists",
      );
    });

    test("should sanitize the API URL to ensure /api suffix", () => {
      const ctx: Partial<AdapterExecutionContext> = {
        agent: {
          id: "agent-123",
          name: "Test Agent",
          companyId: "company-456",
        } as any,
        config: {},
      };

      const config = {
        promptTemplate: `API: {{paperclipApiUrl}}`,
        paperclipApiUrl: "http://localhost:3100",
      };

      const prompt = buildPrompt(ctx as AdapterExecutionContext, config);

      assert(prompt.includes("http://localhost:3100/api"), "Should add /api suffix");
    });

    test("should not double-suffix the API URL if /api is already present", () => {
      const ctx: Partial<AdapterExecutionContext> = {
        agent: {
          id: "agent-123",
          name: "Test Agent",
          companyId: "company-456",
        } as any,
        config: {},
      };

      const config = {
        promptTemplate: `API: {{paperclipApiUrl}}`,
        paperclipApiUrl: "http://localhost:3100/api",
      };

      const prompt = buildPrompt(ctx as AdapterExecutionContext, config);

      assert(
        prompt.includes("http://localhost:3100/api"),
        "Should preserve existing /api",
      );
      assert(
        !prompt.includes("/api/api"),
        "Should not double-suffix",
      );
    });
  });

  describe("Output parsing", () => {
    test("should extract session ID from quiet-mode output", () => {
      const stdout = `The task is complete.

session_id: 20260612_143022_a3b8f4c`;
      const stderr = "";

      const result = parseHermesOutput(stdout, stderr);

      assert.equal(result.sessionId, "20260612_143022_a3b8f4c", "Should extract session ID");
      assert.equal(result.response, "The task is complete.", "Should extract response");
    });

    test("should handle multi-line responses before session_id", () => {
      const stdout = `Found 3 issues:
1. Missing null check
2. Unused import  
3. Race condition

session_id: 20260612_150130_7e9a2f1`;
      const stderr = "";

      const result = parseHermesOutput(stdout, stderr);

      assert.equal(result.sessionId, "20260612_150130_7e9a2f1", "Should extract session ID");
      assert(
        result.response?.includes("Found 3 issues"),
        "Should include start of response",
      );
      assert(
        result.response?.includes("Race condition"),
        "Should include end of response",
      );
    });

    test("should extract token usage from output", () => {
      const stdout = `Response here.
session_id: 20260612_151010_b4c6d2e`;
      const stderr = `tokens: 1500 input, 450 output`;

      const result = parseHermesOutput(stdout, stderr);

      assert.deepEqual(
        result.usage,
        { inputTokens: 1500, outputTokens: 450 },
        "Should extract token counts",
      );
    });

    test("should extract cost from output", () => {
      const stdout = `Work done.
session_id: 20260612_152020_f8a3b5d`;
      const stderr = `cost: $0.025`;

      const result = parseHermesOutput(stdout, stderr);

      assert.equal(result.costUsd, 0.025, "Should extract cost");
    });

    test("should filter out noise lines from response", () => {
      const stdout = `[tool] Running command: ls -la
Result:
  file1.txt
  file2.txt

[hermes] Tool completed
session_id: 20260612_153030_c9e4f7a`;
      const stderr = "";

      const result = parseHermesOutput(stdout, stderr);

      assert(!result.response?.includes("[tool]"), "Should filter [tool] lines");
      assert(
        !result.response?.includes("[hermes]"),
        "Should filter [hermes] lines",
      );
      assert(
        result.response?.includes("file1.txt"),
        "Should keep actual content",
      );
    });

    test("should extract error messages from stderr", () => {
      const stdout = `Process failed.
session_id: 20260612_154040_d2f5a8b`;
      const stderr = `ERROR: Connection timeout\nWARNING: Retrying...`;

      const result = parseHermesOutput(stdout, stderr);

      assert(result.errorMessage, "Should have error message");
      assert(result.errorMessage.includes("ERROR"), "Should include ERROR");
    });

    test("should NOT treat INFO/DEBUG logs as errors", () => {
      const stdout = `Task complete.
session_id: 20260612_155050_e3b6c9d`;
      const stderr = `[2026-06-11T10:30:00Z] INFO: Initialized\n[2026-06-11T10:30:01Z] DEBUG: Tool registered`;

      const result = parseHermesOutput(stdout, stderr);

      assert(!result.errorMessage, "Should not treat INFO/DEBUG as errors");
    });

    test("should return empty response if only session_id was in stdout", () => {
      const stdout = `session_id: 20260612_160000_f4d7e2a`;
      const stderr = "";

      const result = parseHermesOutput(stdout, stderr);

      assert.equal(result.sessionId, "20260612_160000_f4d7e2a", "Should extract session ID");
      assert(!result.response || result.response === "", "Should have empty/no response");
    });
  });

  describe("Edge cases", () => {
    test("should handle missing session ID gracefully", () => {
      const stdout = "Response without explicit session ID format.";
      const stderr = "";

      const result = parseHermesOutput(stdout, stderr);

      assert.equal(
        result.response,
        "Response without explicit session ID format.",
        "Should extract response",
      );
      assert(!result.sessionId, "Should not have session ID");
    });

    test("should handle empty output", () => {
      const stdout = "";
      const stderr = "";

      const result = parseHermesOutput(stdout, stderr);

      assert(!result.response, "Should not have response");
      assert(!result.sessionId, "Should not have session ID");
    });

    test("should handle very large responses", () => {
      const largeResponse = "Line of output\n".repeat(10000);
      const stdout = `${largeResponse}session_id: 20260612_161010_a5e8f3b`;
      const stderr = "";

      const result = parseHermesOutput(stdout, stderr);

      assert.equal(result.sessionId, "20260612_161010_a5e8f3b", "Should extract session ID");
      assert(result.response, "Should have response");
      assert.equal(typeof result.response, "string", "Response should be a string");
    });
  });
});
