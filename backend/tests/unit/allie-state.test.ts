import { describe, expect, it } from "vitest";
import { assertAllieEnvironment, env } from "../../src/config/env.js";
import {
  decryptIdentityPayload,
  type EncryptedEnvelope,
} from "../../src/common/security/mfa-encryption.js";
import {
  decodeAllieState,
  encodeAllieState,
  type AllieStoredState,
} from "../../src/modules/learning/allie.storage.js";

const state = (): AllieStoredState => ({
  history: {
    accessKey: "a".repeat(64),
    sourceSet: "b".repeat(64),
    turns: [
      {
        question: "Find compatible parts",
        answer: "Which part are you looking for?",
        sourceIds: [],
      },
    ],
  },
  messages: [
    {
      operationId: "f0000000-0000-4000-8000-000000000001",
      question: "Find compatible parts",
      answer: {
        kind: "clarification",
        answer: "Which part are you looking for?",
        steps: [],
        caveat: null,
        sourceIds: [],
        actionIds: [],
        sources: [],
        actions: [],
      },
    },
  ],
});
describe("assistant state binding and fail-closed configuration", () => {
  it("round-trips only in its owner/conversation binding and a separate encryption purpose", () => {
    const original = state(),
      encoded = encodeAllieState(original, "owner-one:conversation-one");
    expect(JSON.stringify(encoded).includes(original.messages[0]!.question)).toBe(false);
    expect(decodeAllieState(encoded, "owner-one:conversation-one")).toEqual(original);
    expect(() => decodeAllieState(encoded, "owner-two:conversation-one")).toThrow(
      expect.objectContaining({ code: "access_changed" }),
    );
    expect(() => decodeAllieState(encoded, "owner-one:conversation-two")).toThrow(
      expect.objectContaining({ code: "access_changed" }),
    );
    expect(() =>
      decryptIdentityPayload(encoded as unknown as EncryptedEnvelope),
    ).toThrow();
  });
  it("rejects modified envelopes and mismatched transcript/history windows without printing content", () => {
    const encoded = encodeAllieState(state(), "binding") as unknown as EncryptedEnvelope;
    expect(() =>
      decodeAllieState(
        { ...encoded, tag: Buffer.alloc(16).toString("base64") },
        "binding",
      ),
    ).toThrow(expect.objectContaining({ code: "access_changed" }));
    const invalid = state();
    invalid.messages = [];
    expect(() => encodeAllieState(invalid, "binding")).toThrow(
      expect.objectContaining({ code: "invalid_output" }),
    );
  });
  const configured = {
    ...env,
    HELP_LEARN_ENABLED: true,
    HELP_LEARN_AI_ENABLED: true,
    OPENAI_API_KEY: "synthetic-server-only-test-key",
    ALLIE_OPENAI_MODEL: "configured-test-model",
    ALLIE_AI_DAILY_TOKEN_LIMIT: 32000,
  };
  it("keeps default-disabled operation independent of provider credentials", () => {
    expect(() =>
      assertAllieEnvironment({
        ...configured,
        HELP_LEARN_AI_ENABLED: false,
        OPENAI_API_KEY: undefined,
        ALLIE_OPENAI_MODEL: undefined,
        ALLIE_AI_DAILY_TOKEN_LIMIT: 0,
      }),
    ).not.toThrow();
  });
  it.each([
    { HELP_LEARN_ENABLED: false },
    { OPENAI_API_KEY: undefined },
    { ALLIE_OPENAI_MODEL: undefined },
    { ALLIE_OPENAI_MODEL: "invalid model with spaces" },
    { ALLIE_AI_DAILY_TOKEN_LIMIT: 0 },
  ])(
    "refuses enabled AI without explicit reviewed-help/provider/budget configuration",
    (override) => {
      expect(() => assertAllieEnvironment({ ...configured, ...override })).toThrow();
    },
  );
  it("requires explicit production encryption/hash credentials instead of development fallbacks", () => {
    const production = { ...configured, NODE_ENV: "production" as const };
    expect(() => assertAllieEnvironment(production, {})).toThrow();
    expect(() =>
      assertAllieEnvironment(production, {
        OPENAI_API_KEY: configured.OPENAI_API_KEY,
        ALLIE_OPENAI_MODEL: configured.ALLIE_OPENAI_MODEL,
        ALLIE_AI_DAILY_TOKEN_LIMIT: "32000",
        OUTBOX_ENCRYPTION_KEY: env.OUTBOX_ENCRYPTION_KEY,
        TOKEN_HASH_KEY: env.TOKEN_HASH_KEY,
      }),
    ).not.toThrow();
  });
});
