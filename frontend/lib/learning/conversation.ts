"use client";
import { z } from "zod";
import { learningHref, type LearningCatalogue } from "./contracts";

const shortId = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
const sourceId = z.string().regex(/^[a-z][a-z0-9-]{0,63}@v[1-9]\d{0,8}$/);
const answerSchema = z.object({
  kind: z.enum(["answer", "clarification", "unavailable", "human"]),
  answer: z.string().min(1).max(2400),
  steps: z.array(z.string().max(400)).max(6),
  caveat: z.string().max(500).nullable(),
  sourceIds: z.array(sourceId).max(4),
  actionIds: z.array(z.string().max(120)).max(3),
  sources: z
    .array(
      z.object({
        id: sourceId,
        articleId: shortId,
        version: z.number().int().positive(),
        title: z.string().max(2400),
        href: z.string().max(240),
      }),
    )
    .max(4),
  actions: z
    .array(
      z.object({
        id: z.string().max(120),
        kind: z.enum(["article", "guide", "practice", "navigate", "human"]),
        label: z.string().max(2400),
        href: z.string().max(240),
        sourceId: sourceId.nullable(),
      }),
    )
    .max(3),
});
export const conversationSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  audience: z.enum(["public", "customer", "work"]),
  expiresAt: z.iso.datetime(),
  messages: z
    .array(
      z.object({
        operationId: z.uuid(),
        question: z.string().max(1200),
        answer: answerSchema,
      }),
    )
    .max(6),
  historyReset: z.boolean(),
  pending: z
    .object({ operationId: z.uuid(), state: z.enum(["pending", "interrupted"]) })
    .nullable(),
});
const resultSchema = z.object({
  replayed: z.boolean(),
  conversation: conversationSchema,
});
export const conversationListSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.uuid(),
        createdAt: z.iso.datetime(),
        expiresAt: z.iso.datetime(),
      }),
    )
    .max(3),
});
export type AllieConversation = z.infer<typeof conversationSchema>;
export type AllieRecent = z.infer<typeof conversationListSchema>["items"];
export class AllieClientError extends Error {
  constructor(
    readonly status: number,
    readonly code = "REQUEST_FAILED",
  ) {
    super("Allie could not verify this request.");
  }
}

// Catalogue references come from the authenticated server's canonical public read,
// not model URLs. Bind the only permitted destination to that exact source ID.
function publicCatalogueReference(
  source: AllieConversation["messages"][number]["answer"]["sources"][number],
) {
  const match =
    /^(service|product|vehicle)-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.exec(
      source.articleId,
    );
  return (
    !!match &&
    source.id === `${source.articleId}@v${source.version}` &&
    source.href ===
      `/${match[1] === "service" ? "services" : match[1] === "product" ? "parts" : "vehicles"}/${match[2]}`
  );
}
// Current catalogue metadata, never model text, determines usable links/modes.
export function validateConversation(value: unknown, data: LearningCatalogue) {
  const conversation = conversationSchema.parse(value);
  if (conversation.audience !== data.audience) throw new AllieClientError(409);
  for (const message of conversation.messages) {
    for (const source of message.answer.sources) {
      const article = data.articles.find(
        (a) => a.id === source.articleId && a.version === source.version,
      );
      if (publicCatalogueReference(source)) continue;
      if (
        !article ||
        source.id !== `${article.id}@v${article.version}` ||
        source.href !== `/learn?article=${article.id}` ||
        source.title !== article.title
      )
        throw new AllieClientError(409);
    }
    if (
      message.answer.sourceIds.some(
        (id) => !message.answer.sources.some((s) => s.id === id),
      )
    )
      throw new AllieClientError(502);
    for (const action of message.answer.actions) {
      const source = message.answer.sources.find((s) => s.id === action.sourceId);
      const article = source && data.articles.find((a) => a.id === source.articleId);
      const valid =
        action.kind === "human"
          ? data.audience !== "work" &&
            action.id === "human:care" &&
            action.href ===
              (data.audience === "customer" ? "/dashboard/support" : "/contact")
          : source && publicCatalogueReference(source)
            ? action.kind === "navigate" &&
              action.id === `open:${source.articleId}` &&
              action.href === source.href &&
              message.answer.sourceIds.includes(source.id)
            : !!article &&
              ((action.kind === "article" &&
                action.id === `read:${article.id}` &&
                action.href === source!.href) ||
                (action.kind === "navigate" &&
                  action.id === `open:${article.id}` &&
                  learningHref.safeParse(action.href).success &&
                  action.href === article.href) ||
                (action.kind === "guide" &&
                  data.flags.guides &&
                  data.guides.some(
                    (g) =>
                      g.articleId === article.id &&
                      action.id === `guide:${g.id}` &&
                      action.href === `${g.href}#learn=${g.id}`,
                  )) ||
                (action.kind === "practice" &&
                  data.flags.practice &&
                  data.scenarios.some(
                    (s) =>
                      s.articleId === article.id &&
                      action.id === `practice:${s.id}` &&
                      action.href === `/learn/practice/${s.id}`,
                  )));
      if (!valid || !message.answer.actionIds.includes(action.id))
        throw new AllieClientError(502);
    }
  }
  return conversation;
}

// Each mounted conversation client owns its guest token in memory. There is no
// account-to-public fallback, browser transcript storage or automatic turn retry.
export function createConversationClient(data: LearningCatalogue) {
  const guest = data.audience === "public",
    prefix = guest ? "/public/learning/assistant" : "/learning/assistant";
  let guestCsrf: string | undefined;
  async function request(
    path: string,
    signal: AbortSignal,
    method = "GET",
    body?: unknown,
  ): Promise<unknown> {
    signal.throwIfAborted();
    if (!guest) {
      const { apiRequest } = await import("../api/client");
      signal.throwIfAborted();
      const result = await apiRequest(prefix + path, {
        signal,
        method,
        ...(body === undefined ? {} : { body }),
        csrf: method !== "GET",
        timeoutMs: 35000,
      });
      return result.data;
    }
    const response = await fetch("/api/v1" + prefix + path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.any([signal, AbortSignal.timeout(35000)]),
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(method === "GET" || !guestCsrf ? {} : { "X-CSRF-Token": guestCsrf }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const packet: unknown = await response.json().catch(() => null);
    signal.throwIfAborted();
    if (!response.ok) {
      const error = z
        .object({ error: z.object({ code: z.string().max(80) }) })
        .safeParse(packet);
      if (error.success && error.data.error.code === "CSRF_INVALID")
        guestCsrf = undefined;
      throw new AllieClientError(
        response.status,
        error.success ? error.data.error.code : undefined,
      );
    }
    return z.object({ success: z.literal(true), data: z.unknown() }).parse(packet).data;
  }
  async function prepare(signal: AbortSignal) {
    if (!guest || guestCsrf) return;
    const session = z
      .object({ csrfToken: z.string().min(32).max(256), expiresAt: z.iso.datetime() })
      .parse(await request("/session", signal, "POST", {}));
    guestCsrf = session.csrfToken;
  }
  const path = (id: string) => "/conversations/" + z.uuid().parse(id);
  return {
    list: async (signal: AbortSignal) =>
      conversationListSchema.parse(await request("/conversations", signal)).items,
    read: async (id: string, signal: AbortSignal) =>
      validateConversation(await request(path(id), signal), data),
    create: async (operationId: string, signal: AbortSignal) => {
      await prepare(signal);
      return validateConversation(
        resultSchema.parse(
          await request("/conversations", signal, "POST", { operationId }),
        ).conversation,
        data,
      );
    },
    turn: async (
      id: string,
      input: {
        operationId: string;
        expectedVersion: number;
        question: string;
        page: string;
      },
      signal: AbortSignal,
    ) => {
      await prepare(signal);
      return validateConversation(
        resultSchema.parse(await request(path(id) + "/turns", signal, "POST", input))
          .conversation,
        data,
      );
    },
    cancel: async (id: string, operationId: string, signal: AbortSignal) => {
      await prepare(signal);
      return z
        .object({
          cancelled: z.boolean(),
          status: z.enum(["PENDING", "COMPLETED", "FAILED", "CANCELLED"]),
        })
        .parse(await request(path(id) + "/cancel", signal, "POST", { operationId }));
    },
    clear: async (id: string, signal: AbortSignal) => {
      await prepare(signal);
      return z
        .object({ cleared: z.literal(true) })
        .parse(await request(path(id), signal, "DELETE", {}));
    },
  };
}
export type ConversationClient = ReturnType<typeof createConversationClient>;
