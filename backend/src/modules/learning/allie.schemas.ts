import { z } from "zod";
import { alliePageSchema, allieQuestionSchema } from "./allie.contracts.js";
import { allieStateSchema } from "./allie.storage.js";
export const allieEmptySchema = z.strictObject({});
export const allieCreateSchema = z.strictObject({ operationId: z.uuid() });
export const allieConversationParams = z.strictObject({ conversationId: z.uuid() });
export const allieTurnSchema = allieCreateSchema.extend({
  expectedVersion: z.number().int().min(1).max(1000000),
  question: allieQuestionSchema,
  page: alliePageSchema,
});
export const allieConversationViewSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  audience: z.enum(["public", "customer", "work"]),
  expiresAt: z.iso.datetime(),
  messages: allieStateSchema.shape.messages,
  historyReset: z.boolean(),
  pending: z
    .object({ operationId: z.uuid(), state: z.enum(["pending", "interrupted"]) })
    .nullable(),
});
export const allieResultSchema = z.object({
  replayed: z.boolean(),
  conversation: allieConversationViewSchema,
});
export const allieResponseSchemas = {
  session: z.object({
    csrfToken: z.string().min(32).max(256),
    expiresAt: z.iso.datetime(),
  }),
  list: z.object({
    items: z
      .array(
        z.object({
          id: z.uuid(),
          createdAt: z.iso.datetime(),
          expiresAt: z.iso.datetime(),
        }),
      )
      .max(3),
  }),
  create: allieResultSchema,
  read: allieConversationViewSchema,
  turns: allieResultSchema,
  clear: z.object({ cleared: z.literal(true) }),
  cancel: z.object({
    cancelled: z.boolean(),
    status: z.enum(["PENDING", "COMPLETED", "FAILED", "CANCELLED"]),
  }),
};
