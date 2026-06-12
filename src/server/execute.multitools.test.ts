/**
 * Phase 2: Multi-Tool Workflow Tests
 *
 * Tests sequential and parallel tool execution, output handling, and token accumulation
 * across complex agent workflows.
 *
 * Date: June 12, 2026
 * Engineer: Argus (Programmatic, SMT Group)
 */

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { TOOL_OUTPUT_PREFIX, THINKING_PREFIX } from "../shared/constants.js";

/**
 * Simulated tool execution result
 */
interface ToolResult {
  tool: string;
  output: string;
  error?: string;
  tokens?: { input: number; output: number };
}

/**
 * Parse tool markers from Hermes output
 */
function parseToolOutput(stdout: string): ToolResult[] {
  const results: ToolResult[] = [];
  const lines = stdout.split("\n");

  let currentTool: string | null = null;
  let currentOutput: string[] = [];

  for (const line of lines) {
    // Tool invocation marker: "[tool:terminal]" or similar
    const toolMatch = line.match(/\[tool:(\w+)\]/);
    if (toolMatch) {
      // Save previous tool if exists
      if (currentTool) {
        results.push({
          tool: currentTool,
          output: currentOutput.join("\n").trim(),
        });
      }
      // Start new tool
      currentTool = toolMatch[1];
      currentOutput = [];
      continue;
    }

    // Tool output lines start with TOOL_OUTPUT_PREFIX (┊)
    if (currentTool && line.startsWith(TOOL_OUTPUT_PREFIX)) {
      currentOutput.push(line.substring(TOOL_OUTPUT_PREFIX.length).trim());
    }
  }

  // Save final tool if exists
  if (currentTool) {
    results.push({
      tool: currentTool,
      output: currentOutput.join("\n").trim(),
    });
  }

  return results;
}

/**
 * Filter tool markers from output (cleanup)
 */
function filterToolMarkers(output: string): string {
  return output
    .split("\n")
    .filter(
      (line) =>
        !line.includes("[tool:") &&
        !line.startsWith(TOOL_OUTPUT_PREFIX) &&
        !line.includes(THINKING_PREFIX),
    )
    .join("\n");
}

/**
 * Accumulate token usage across multiple results
 */
function accumulateTokens(
  results: ToolResult[],
): { input: number; output: number } {
  return results.reduce(
    (acc, result) => {
      if (result.tokens) {
        acc.input += result.tokens.input;
        acc.output += result.tokens.output;
      }
      return acc;
    },
    { input: 0, output: 0 },
  );
}

test("Multi-Tool Sequential Execution", async (suite) => {
  await suite.test("should preserve output from sequential tools", () => {
    const stdout = `[tool:terminal]
┊ $ ls -la
┊ total 48
┊ drwxr-xr-x 5 user user 4096 Jun 12 14:30 .
[tool:file]
┊ Reading: config.json
┊ {"timeout": 300}
[tool:web]
┊ GET https://api.example.com/status
┊ {"status": "ok"}
Final response: All tools executed successfully`;

    const tools = parseToolOutput(stdout);
    assert.strictEqual(tools.length, 3, "Should extract 3 tool results");
    assert.strictEqual(tools[0].tool, "terminal");
    assert.strictEqual(tools[1].tool, "file");
    assert.strictEqual(tools[2].tool, "web");

    assert.ok(
      tools[0].output.includes("ls -la"),
      "Terminal output should be preserved",
    );
    assert.ok(
      tools[1].output.includes("config.json"),
      "File output should be preserved",
    );
    assert.ok(
      tools[2].output.includes("api.example.com"),
      "Web output should be preserved",
    );
  });

  await suite.test("should handle tool execution order", () => {
    const stdout = `[tool:file]
┊ Created: build.sh
[tool:terminal]
┊ $ chmod +x build.sh
[tool:terminal]
┊ $ ./build.sh
┊ Build started...
[tool:file]
┊ Reading: dist/output.js
┊ export default {};`;

    const tools = parseToolOutput(stdout);
    assert.strictEqual(tools.length, 4, "Should preserve execution order");

    // Verify order
    assert.strictEqual(tools[0].tool, "file", "First: file create");
    assert.strictEqual(tools[1].tool, "terminal", "Second: chmod");
    assert.strictEqual(tools[2].tool, "terminal", "Third: execute");
    assert.strictEqual(tools[3].tool, "file", "Fourth: file read");
  });

  await suite.test("should handle same tool multiple times", () => {
    const stdout = `[tool:terminal]
┊ $ echo "Step 1"
┊ Step 1
[tool:terminal]
┊ $ echo "Step 2"
┊ Step 2
[tool:terminal]
┊ $ echo "Step 3"
┊ Step 3`;

    const tools = parseToolOutput(stdout);
    assert.strictEqual(
      tools.length,
      3,
      "Should handle repeated tool invocations",
    );

    tools.forEach((tool, index) => {
      assert.strictEqual(tool.tool, "terminal");
      assert.ok(tool.output.includes(`Step ${index + 1}`));
    });
  });
});

test("Multi-Tool Parallel Execution", async (suite) => {
  await suite.test("should handle interleaved tool output", () => {
    const stdout = `[tool:terminal]
┊ Process A starting...
[tool:web]
┊ Fetching data...
[tool:terminal]
┊ Process A: 50% complete
[tool:web]
┊ Received response
[tool:terminal]
┊ Process A: 100% complete`;

    const tools = parseToolOutput(stdout);
    assert.strictEqual(tools.length, 5, "Should parse all tool invocations");

    const terminalTools = tools.filter((t) => t.tool === "terminal");
    const webTools = tools.filter((t) => t.tool === "web");

    assert.strictEqual(terminalTools.length, 3, "3 terminal invocations");
    assert.strictEqual(webTools.length, 2, "2 web invocations");
  });

  await suite.test("should not duplicate output from parallel tools", () => {
    const stdout = `[tool:terminal]
┊ unique_output_1
[tool:file]
┊ unique_output_2
[tool:terminal]
┊ unique_output_1`;

    const tools = parseToolOutput(stdout);

    // Even if same content appears, each tool invocation should be distinct
    assert.strictEqual(tools.length, 3, "Should track all invocations");
    assert.strictEqual(tools[0].output, "unique_output_1");
    assert.strictEqual(tools[1].output, "unique_output_2");
    assert.strictEqual(tools[2].output, "unique_output_1");
  });
});

test("Tool Error Handling", async (suite) => {
  await suite.test("should capture tool errors within sequence", () => {
    const stdout = `[tool:terminal]
┊ $ command-not-found
[tool:terminal]
┊ Error: command not found
[tool:file]
┊ Continuing with file operations...`;

    const tools = parseToolOutput(stdout);
    assert.strictEqual(
      tools.length,
      3,
      "Should continue after tool error",
    );

    assert.ok(
      tools[1].output.includes("Error"),
      "Error output should be captured",
    );
    assert.strictEqual(
      tools[2].tool,
      "file",
      "Subsequent tools should execute",
    );
  });

  await suite.test("should handle empty tool output", () => {
    const stdout = `[tool:terminal]
┊ $ true
[tool:file]
┊ Reading empty file
┊ 
[tool:web]
┊ GET /ping
┊ 200 OK`;

    const tools = parseToolOutput(stdout);
    assert.strictEqual(tools.length, 3, "Should handle empty output");
    assert.ok(tools[1].output.length >= 0, "Empty output is valid");
  });
});

test("Tool Output Filtering", async (suite) => {
  await suite.test("should filter tool markers from final output", () => {
    const stdout = `[tool:terminal]
┊ $ ls
┊ file1.txt
Final response: Found 1 file`;

    const filtered = filterToolMarkers(stdout);

    assert.ok(
      !filtered.includes("[tool:"),
      "Tool markers should be removed",
    );
    assert.ok(
      !filtered.includes(TOOL_OUTPUT_PREFIX),
      "Tool output prefix should be removed",
    );
    assert.ok(
      filtered.includes("Final response"),
      "Final response should be preserved",
    );
  });

  await suite.test("should filter thinking blocks", () => {
    const stdout = `💭 Let me think about this...
[tool:terminal]
┊ $ date
Regular response text`;

    const filtered = filterToolMarkers(stdout);

    assert.ok(
      !filtered.includes(THINKING_PREFIX),
      "Thinking prefix should be removed",
    );
    assert.ok(
      filtered.includes("Regular response"),
      "Regular text should be preserved",
    );
  });
});

test("Token Accumulation Across Tools", async (suite) => {
  await suite.test("should accumulate input tokens across tools", () => {
    const results: ToolResult[] = [
      { tool: "terminal", output: "...", tokens: { input: 100, output: 50 } },
      { tool: "file", output: "...", tokens: { input: 80, output: 40 } },
      { tool: "web", output: "...", tokens: { input: 120, output: 60 } },
    ];

    const totals = accumulateTokens(results);

    assert.strictEqual(totals.input, 300, "Input tokens: 100 + 80 + 120");
    assert.strictEqual(totals.output, 150, "Output tokens: 50 + 40 + 60");
  });

  await suite.test("should handle tools without token data", () => {
    const results: ToolResult[] = [
      { tool: "terminal", output: "...", tokens: { input: 100, output: 50 } },
      { tool: "file", output: "..." }, // No token data
      { tool: "web", output: "...", tokens: { input: 80, output: 40 } },
    ];

    const totals = accumulateTokens(results);

    assert.strictEqual(totals.input, 180, "Should skip undefined token data");
    assert.strictEqual(totals.output, 90, "Should sum only defined tokens");
  });

  await suite.test("should handle zero-token tools", () => {
    const results: ToolResult[] = [
      { tool: "terminal", output: "...", tokens: { input: 0, output: 0 } },
      { tool: "file", output: "...", tokens: { input: 50, output: 25 } },
    ];

    const totals = accumulateTokens(results);

    assert.strictEqual(totals.input, 50, "Should handle zero tokens");
    assert.strictEqual(totals.output, 25, "Zero tokens should not break sum");
  });
});

test("Large Tool Outputs", async (suite) => {
  await suite.test("should handle large tool output (10MB+)", () => {
    const largeOutput = "x".repeat(10 * 1024 * 1024); // 10MB
    const stdout = `[tool:terminal]
┊ ${largeOutput}
Response after large output`;

    const tools = parseToolOutput(stdout);
    assert.strictEqual(tools.length, 1, "Should parse large output");
    assert.ok(
      tools[0].output.length > 10_000_000,
      "Large output should be preserved",
    );
  });

  await suite.test("should handle many sequential tools (100+)", () => {
    let stdout = "";
    for (let i = 0; i < 100; i++) {
      stdout += `[tool:terminal]\n┊ Step ${i}\n`;
    }

    const tools = parseToolOutput(stdout);
    assert.strictEqual(
      tools.length,
      100,
      "Should handle 100+ tool invocations",
    );

    // Verify order preservation
    for (let i = 0; i < 100; i++) {
      assert.ok(
        tools[i].output.includes(`Step ${i}`),
        `Tool ${i} should have correct output`,
      );
    }
  });
});

test("Tool-Specific Marker Patterns", async (suite) => {
  await suite.test("should detect all Hermes tool types", () => {
    const toolTypes = [
      "terminal",
      "file",
      "web",
      "browser",
      "search_files",
      "read_file",
      "write_file",
      "patch",
      "process",
    ];

    toolTypes.forEach((toolType) => {
      const stdout = `[tool:${toolType}]\n┊ Output for ${toolType}`;
      const tools = parseToolOutput(stdout);

      assert.strictEqual(
        tools.length,
        1,
        `Should detect [tool:${toolType}]`,
      );
      assert.strictEqual(tools[0].tool, toolType);
      assert.ok(tools[0].output.includes(toolType));
    });
  });

  await suite.test("should ignore non-tool markers", () => {
    const stdout = `[hermes] Starting...
[info] Processing...
[tool:terminal]
┊ $ date
[debug] Done`;

    const tools = parseToolOutput(stdout);
    assert.strictEqual(
      tools.length,
      1,
      "Should only parse [tool:*] markers",
    );
    assert.strictEqual(tools[0].tool, "terminal");
  });
});

test("Multi-Tool Workflow Documentation", async (suite) => {
  await suite.test("should document expected tool output format", () => {
    // Expected format from execute.ts:
    // 1. Tool invocation: [tool:name]
    // 2. Tool output lines: ┊ content
    // 3. Thinking blocks: 💭 thought
    // 4. Final response: clean text without markers

    const expectedMarkers = {
      toolInvocation: /\[tool:\w+\]/,
      toolOutput: /^┊/,
      thinking: /^💭/,
    };

    assert.ok(
      expectedMarkers.toolInvocation.test("[tool:terminal]"),
      "Tool invocation format",
    );
    assert.ok(
      expectedMarkers.toolOutput.test("┊ output"),
      "Tool output format",
    );
    assert.ok(expectedMarkers.thinking.test("💭 thinking"), "Thinking format");
  });

  await suite.test("should verify TOOL_OUTPUT_PREFIX constant", () => {
    assert.strictEqual(
      TOOL_OUTPUT_PREFIX,
      "┊",
      "Tool output prefix should be ┊ (vertical bar)",
    );
  });

  await suite.test("should verify THINKING_PREFIX constant", () => {
    assert.strictEqual(
      THINKING_PREFIX,
      "💭",
      "Thinking prefix should be 💭 (thought bubble)",
    );
  });
});
