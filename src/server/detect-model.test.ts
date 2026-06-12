/**
 * Phase 1: Provider Detection and Resolution Tests
 * 
 * Test coverage:
 * 1. Model string parser: extract provider from "anthropic/claude-sonnet-4"
 * 2. Explicit provider override: model="anthropic/..." but provider="openrouter" wins
 * 3. Provider fallback chain: config > ~/.hermes/config.yaml > DEFAULT_PROVIDER
 * 4. Invalid provider rejection (VALID_PROVIDERS whitelist enforcement)
 * 5. Edge cases: model-only, provider-only, empty strings
 */

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { resolveProvider } from "./detect-model.js";

// ---------------------------------------------------------------------------
// Test: Model string parsing
// ---------------------------------------------------------------------------

test("Provider Resolution: Model name inference", async (suite) => {
  await suite.test("should infer anthropic from claude model name", () => {
    const result = resolveProvider({
      model: "claude-sonnet-4",
    });
    
    assert.equal(result.provider, "anthropic");
    assert.equal(result.resolvedFrom, "modelInference");
  });

  await suite.test("should infer from model with provider/ prefix", () => {
    const result = resolveProvider({
      model: "anthropic/claude-3.5-sonnet",
    });
    
    // inferProviderFromModel() strips prefix and matches "claude"
    assert.equal(result.provider, "anthropic");
    assert.equal(result.resolvedFrom, "modelInference");
  });

  await suite.test("should infer openai-codex from gpt-4 prefix", () => {
    const result = resolveProvider({
      model: "gpt-4o",
    });
    
    assert.equal(result.provider, "openai-codex");
    assert.equal(result.resolvedFrom, "modelInference");
  });

  await suite.test("should infer copilot from gpt-5 prefix", () => {
    const result = resolveProvider({
      model: "gpt-5.4",
    });
    
    assert.equal(result.provider, "copilot");
    assert.equal(result.resolvedFrom, "modelInference");
  });

  await suite.test("should infer nous from hermes- prefix", () => {
    const result = resolveProvider({
      model: "hermes-3-llama-3.1-405b",
    });
    
    assert.equal(result.provider, "nous");
    assert.equal(result.resolvedFrom, "modelInference");
  });

  await suite.test("should infer zai from glm- prefix", () => {
    const result = resolveProvider({
      model: "glm-5-turbo",
    });
    
    assert.equal(result.provider, "zai");
    assert.equal(result.resolvedFrom, "modelInference");
  });

  await suite.test("should fall back to auto when no hint matches", () => {
    const result = resolveProvider({
      model: "random-unknown-model",
    });
    
    // No MODEL_PREFIX_PROVIDER_HINTS match → "auto"
    assert.equal(result.provider, "auto");
    assert.equal(result.resolvedFrom, "auto");
  });

  await suite.test("should handle empty model string", () => {
    const result = resolveProvider({
      model: "",
    });
    
    assert.equal(result.provider, "auto");
    assert.equal(result.resolvedFrom, "auto");
  });
});

// ---------------------------------------------------------------------------
// Test: Explicit provider override
// ---------------------------------------------------------------------------

test("Provider Resolution: Explicit provider override", async (suite) => {
  await suite.test("should use explicitProvider when valid", () => {
    const result = resolveProvider({
      explicitProvider: "openrouter",
      model: "anthropic/claude-sonnet-4",
    });
    
    assert.equal(result.provider, "openrouter");
    assert.equal(result.resolvedFrom, "adapterConfig");
  });

  await suite.test("should override with explicitProvider even if detectedProvider exists", () => {
    const result = resolveProvider({
      explicitProvider: "nous",
      detectedProvider: "anthropic",
      detectedModel: "anthropic/claude-sonnet-4",
      model: "anthropic/claude-sonnet-4",
    });
    
    assert.equal(result.provider, "nous");
    assert.equal(result.resolvedFrom, "adapterConfig");
  });

  await suite.test("should accept explicitProvider=auto", () => {
    const result = resolveProvider({
      explicitProvider: "auto",
      model: "claude-sonnet-4",
    });
    
    assert.equal(result.provider, "auto");
    assert.equal(result.resolvedFrom, "adapterConfig");
  });

  await suite.test("should reject invalid explicitProvider and fall back", () => {
    const result = resolveProvider({
      explicitProvider: "invalid-provider",
      model: "claude-sonnet-4",
    });
    
    // Invalid provider → falls to priority 2 (detectedProvider) then 3 (model inference)
    assert.equal(result.provider, "anthropic"); // from claude inference
    assert.equal(result.resolvedFrom, "modelInference");
  });
});

// ---------------------------------------------------------------------------
// Test: Provider fallback chain
// ---------------------------------------------------------------------------

test("Provider Resolution: Fallback chain", async (suite) => {
  await suite.test("priority 1: explicit provider from config", () => {
    const result = resolveProvider({
      explicitProvider: "openrouter",
      detectedProvider: "anthropic",
      detectedModel: "anthropic/claude-sonnet-4",
      model: "nous/hermes-3",
    });
    
    // Explicit wins over all others
    assert.equal(result.provider, "openrouter");
    assert.equal(result.resolvedFrom, "adapterConfig");
  });

  await suite.test("priority 2: detected provider from Hermes config (when models match)", () => {
    const result = resolveProvider({
      detectedProvider: "anthropic",
      detectedModel: "anthropic/claude-sonnet-4",
      model: "anthropic/claude-sonnet-4", // exact match
    });
    
    // Hermes config provider used when model matches
    assert.equal(result.provider, "anthropic");
    assert.equal(result.resolvedFrom, "hermesConfig");
  });

  await suite.test("priority 2: detected provider ignored when models differ", () => {
    const result = resolveProvider({
      detectedProvider: "anthropic",
      detectedModel: "anthropic/claude-sonnet-4",
      model: "gpt-4o", // different model
    });
    
    // Model mismatch → skip Hermes config, fall to model inference
    assert.equal(result.provider, "openai-codex"); // from gpt-4 inference
    assert.equal(result.resolvedFrom, "modelInference");
  });

  await suite.test("priority 2: case-insensitive model matching for Hermes config", () => {
    const result = resolveProvider({
      detectedProvider: "anthropic",
      detectedModel: "Anthropic/Claude-Sonnet-4",
      model: "anthropic/claude-sonnet-4", // different case
    });
    
    // Case-insensitive match → Hermes config used
    assert.equal(result.provider, "anthropic");
    assert.equal(result.resolvedFrom, "hermesConfig");
  });

  await suite.test("priority 3: provider inferred from model name", () => {
    const result = resolveProvider({
      model: "claude-sonnet-4",
    });
    
    assert.equal(result.provider, "anthropic");
    assert.equal(result.resolvedFrom, "modelInference");
  });

  await suite.test("priority 4: default to auto", () => {
    const result = resolveProvider({
      model: "unknown-model-xyz",
    });
    
    assert.equal(result.provider, "auto");
    assert.equal(result.resolvedFrom, "auto");
  });

  await suite.test("should ignore empty detectedProvider", () => {
    const result = resolveProvider({
      detectedProvider: "",
      model: "claude-sonnet-4",
    });
    
    // Empty provider → fall through to model inference
    assert.equal(result.provider, "anthropic");
    assert.equal(result.resolvedFrom, "modelInference");
  });

  await suite.test("should trust ANY provider from Hermes config (no VALID_PROVIDERS check)", () => {
    const result = resolveProvider({
      detectedProvider: "ollama-launch", // not in VALID_PROVIDERS
      detectedModel: "llama3:70b",
      model: "llama3:70b",
    });
    
    // Hermes config providers are trusted unconditionally (for plugin support)
    assert.equal(result.provider, "ollama-launch");
    assert.equal(result.resolvedFrom, "hermesConfig");
  });
});

// ---------------------------------------------------------------------------
// Test: Invalid provider handling
// ---------------------------------------------------------------------------

test("Provider Resolution: Invalid provider handling", async (suite) => {
  await suite.test("should reject invalid explicit provider", () => {
    const result = resolveProvider({
      explicitProvider: "invalid-provider",
      model: "claude-sonnet-4",
    });
    
    // Invalid explicit → falls to priority 2-3-4
    assert.equal(result.provider, "anthropic"); // from model inference
    assert.equal(result.resolvedFrom, "modelInference");
  });

  await suite.test("should allow plugin providers from Hermes config even if not in VALID_PROVIDERS", () => {
    const result = resolveProvider({
      detectedProvider: "my-custom-plugin",
      detectedModel: "custom-model",
      model: "custom-model",
    });
    
    // Hermes config is trusted unconditionally
    assert.equal(result.provider, "my-custom-plugin");
    assert.equal(result.resolvedFrom, "hermesConfig");
  });

  await suite.test("should fall back to auto when all sources fail", () => {
    const result = resolveProvider({
      explicitProvider: "invalid1",
      detectedProvider: "invalid2",
      detectedModel: "other-model",
      model: "no-matching-hints",
    });
    
    // Invalid explicit, model mismatch → skip Hermes, no hints → auto
    assert.equal(result.provider, "auto");
    assert.equal(result.resolvedFrom, "auto");
  });
});

// Note: Valid provider testing is covered in other test suites
// (Explicit provider override, Fallback chain, Real-world scenarios)

// ---------------------------------------------------------------------------
// Test: Edge cases
// ---------------------------------------------------------------------------

test("Provider Resolution: Edge cases", async (suite) => {
  await suite.test("should handle undefined model", () => {
    const result = resolveProvider({
      model: undefined,
    });
    
    assert.equal(result.provider, "auto");
    assert.equal(result.resolvedFrom, "auto");
  });

  await suite.test("should strip provider prefix in model for inference", () => {
    const result = resolveProvider({
      model: "openrouter/anthropic/claude-3.5-sonnet",
    });
    
    // inferProviderFromModel strips prefix → left with "claude-3.5-sonnet"
    assert.equal(result.provider, "anthropic");
    assert.equal(result.resolvedFrom, "modelInference");
  });

  await suite.test("should handle model with trailing slash", () => {
    const result = resolveProvider({
      model: "anthropic/",
    });
    
    // After stripping, empty string → no match → auto
    assert.equal(result.provider, "auto");
    assert.equal(result.resolvedFrom, "auto");
  });

  await suite.test("should be case-sensitive for explicit provider names", () => {
    const result = resolveProvider({
      explicitProvider: "Anthropic", // uppercase
      model: "claude-sonnet-4",
    });
    
    // "Anthropic" not in VALID_PROVIDERS (lowercased) → invalid → falls back
    assert.equal(result.provider, "anthropic"); // from model inference
    assert.equal(result.resolvedFrom, "modelInference");
  });

  await suite.test("should handle whitespace in explicit provider", () => {
    // Current implementation doesn't trim. Test actual behavior
    const result = resolveProvider({
      explicitProvider: " anthropic ",
      model: "claude-sonnet-4",
    });
    
    // Space-padded not in VALID_PROVIDERS → invalid → falls back
    assert.equal(result.provider, "anthropic"); // from model inference
    assert.equal(result.resolvedFrom, "modelInference");
  });

  await suite.test("should handle all undefined inputs", () => {
    const result = resolveProvider({});
    
    assert.equal(result.provider, "auto");
    assert.equal(result.resolvedFrom, "auto");
  });

  await suite.test("should handle null explicitProvider", () => {
    const result = resolveProvider({
      explicitProvider: null,
      model: "claude-sonnet-4",
    });
    
    // null is explicitly passed → skip priority 1, fall to 3
    assert.equal(result.provider, "anthropic");
    assert.equal(result.resolvedFrom, "modelInference");
  });
});

// ---------------------------------------------------------------------------
// Test: Real-world scenarios
// ---------------------------------------------------------------------------

test("Provider Resolution: Real-world scenarios", async (suite) => {
  await suite.test("Scenario: User sets model in Hermes config", () => {
    // User has ~/.hermes/config.yaml with:
    //   model:
    //     default: anthropic/claude-sonnet-4
    //     provider: anthropic
    const result = resolveProvider({
      detectedProvider: "anthropic",
      detectedModel: "anthropic/claude-sonnet-4",
      model: "anthropic/claude-sonnet-4", // Same model requested
    });
    
    assert.equal(result.provider, "anthropic");
    assert.equal(result.resolvedFrom, "hermesConfig");
  });

  await suite.test("Scenario: Paperclip agent overrides provider with OpenRouter", () => {
    // User has Hermes config with anthropic, but agent config explicitly says openrouter
    const result = resolveProvider({
      explicitProvider: "openrouter",
      detectedProvider: "anthropic",
      detectedModel: "anthropic/claude-sonnet-4",
      model: "anthropic/claude-3.5-sonnet",
    });
    
    // Explicit always wins
    assert.equal(result.provider, "openrouter");
    assert.equal(result.resolvedFrom, "adapterConfig");
  });

  await suite.test("Scenario: Model-only config, no provider field", () => {
    // Agent config just has model: \"gpt-4o\", no provider field anywhere
    const result = resolveProvider({
      model: "gpt-4o",
    });
    
    assert.equal(result.provider, "openai-codex"); // inferred from gpt-4 prefix
    assert.equal(result.resolvedFrom, "modelInference");
  });

  await suite.test("Scenario: Using Nous provider for custom Hermes model", () => {
    // User has model: \"hermes-3-llama-3.1-405b\"
    const result = resolveProvider({
      model: "hermes-3-llama-3.1-405b",
    });
    
    assert.equal(result.provider, "nous"); // from hermes- prefix
    assert.equal(result.resolvedFrom, "modelInference");
  });

  await suite.test("Scenario: Hermes config model differs from requested model", () => {
    // Hermes has anthropic/claude-sonnet-4 configured,
    // but Paperclip agent requests gpt-4o
    const result = resolveProvider({
      detectedProvider: "anthropic",
      detectedModel: "anthropic/claude-sonnet-4",
      model: "gpt-4o", // Different!
    });
    
    // Model mismatch → skip Hermes config provider, infer from requested model
    assert.equal(result.provider, "openai-codex");
    assert.equal(result.resolvedFrom, "modelInference");
  });

  await suite.test("Scenario: Custom plugin provider in Hermes config", () => {
    // User has a custom Ollama plugin provider
    const result = resolveProvider({
      detectedProvider: "ollama-launch",
      detectedModel: "llama3:70b",
      model: "llama3:70b",
    });
    
    // Plugin provider accepted from Hermes config (model match)
    assert.equal(result.provider, "ollama-launch");
    assert.equal(result.resolvedFrom, "hermesConfig");
  });

  await suite.test("Scenario: No config anywhere, unknown model", () => {
    // Brand new agent, no Hermes config, model name has no hints
    const result = resolveProvider({
      model: "some-random-model-name",
    });
    
    // Falls all the way to auto
    assert.equal(result.provider, "auto");
    assert.equal(result.resolvedFrom, "auto");
  });
});
