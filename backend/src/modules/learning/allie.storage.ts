import { z } from "zod";
import {
  decryptAssistantContext,
  encryptAssistantContext,
} from "../../common/security/mfa-encryption.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { AllieFailure, allieOutputSchema } from "./allie.contracts.js";

const id = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
const sourceId = z.string().regex(/^[a-z][a-z0-9-]{0,63}@v[1-9]\d{0,8}$/);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const safeAnswer = allieOutputSchema.extend({
  sources: z
    .array(
      z.strictObject({
        id: sourceId,
        articleId: id,
        version: z.number().int().positive(),
        title: z.string().max(2400),
        href: z.string().max(240),
      }),
    )
    .max(4),
  actions: z
    .array(
      z.strictObject({
        id: z.string().max(120),
        kind: z.enum(["article", "guide", "practice", "navigate", "human"]),
        label: z.string().max(2400),
        href: z.string().max(240),
        sourceId: sourceId.nullable(),
      }),
    )
    .max(3),
});
export const allieStateSchema = z
  .strictObject({
    history: z.strictObject({
      accessKey: digest,
      sourceSet: digest,
      turns: z
        .array(
          z.strictObject({
            question: z.string().max(1200),
            answer: z.string().max(4000),
            sourceIds: z.array(sourceId).max(4),
          }),
        )
        .max(6),
    }),
    messages: z
      .array(
        z.strictObject({
          operationId: z.uuid(),
          question: z.string().max(1200),
          answer: safeAnswer,
        }),
      )
      .max(6),
  })
  .refine(
    (state) =>
      state.history.turns.length === state.messages.length &&
      state.history.turns.reduce(
        (sum, turn) => sum + turn.question.length + turn.answer.length,
        0,
      ) <= 8000,
  );
export type AllieStoredState = z.infer<typeof allieStateSchema>;
const envelope = z.strictObject({
  version: z.literal(1),
  keyId: z.string().min(1).max(120),
  iv: z.string().max(32),
  ciphertext: z.string().max(131072),
  tag: z.string().max(32),
});
export function encodeAllieState(
  value: AllieStoredState,
  binding: string,
): Prisma.InputJsonValue {
  const state = allieStateSchema.safeParse(value);
  if (!state.success) throw new AllieFailure("invalid_output");
  return { ...encryptAssistantContext(state.data, binding) };
}
export function decodeAllieState(value: unknown, binding: string): AllieStoredState {
  try {
    return allieStateSchema.parse(
      decryptAssistantContext(envelope.parse(value), binding),
    );
  } catch {
    throw new AllieFailure("access_changed");
  }
}
