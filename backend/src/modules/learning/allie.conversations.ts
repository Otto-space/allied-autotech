import { randomUUID } from "node:crypto";
import type { HandoffExcerpts } from "../support/support-handoff.schemas.js";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import { AppError } from "../../common/errors/app-error.js";
import { verifyCsrfToken } from "../../common/security/csrf-tokens.js";
import { generateOpaqueToken, hashToken } from "../../common/security/session-tokens.js";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import { Prisma, type AssistantConversation } from "../../generated/prisma/client.js";
import { answerAllie } from "./allie.answer.js";
import {
  AllieFailure,
  alliePageSchema,
  allieQuestionSchema,
  type AllieCatalogue,
} from "./allie.contracts.js";
import { createAllieProvider } from "./allie.provider.js";
import {
  publicKnowledgeRevision,
  retrievePublicKnowledge,
} from "./allie.public-knowledge.js";
import { allieSourceSet } from "./allie.retrieval.js";
import { containsAllieSecret } from "./allie.safety.js";
import {
  decodeAllieState,
  encodeAllieState,
  type AllieStoredState,
} from "./allie.storage.js";
import {
  learningAccessInTransaction,
  learningCatalogue,
  learningUnavailable,
  publicLearningAccess,
} from "./learning.service.js";

type Tx = Prisma.TransactionClient;
export type AllieOwnerProof =
  | { kind: "account"; actor: AuthenticatedActor }
  | { kind: "guest"; token: string; csrf?: string };
type Owner = {
  key: string;
  catalogue: AllieCatalogue;
  audience: "PUBLIC" | "CUSTOMER" | "WORK";
  expiresAt: Date;
};
const idleMs = 15 * 60000,
  absoluteMs = 60 * 60000,
  reservedTokens = 32000;
const conflict = (message: string): never => {
  throw new AppError({ code: "CONFLICT", statusCode: 409, message });
};
const limited = (): never => {
  throw new AppError({
    code: "RATE_LIMITED",
    statusCode: 429,
    message:
      "Allie has reached a temporary usage limit. Reviewed help and Customer Care remain available.",
  });
};
export function requireAllieEnabled() {
  if (!env.HELP_LEARN_ENABLED || !env.HELP_LEARN_AI_ENABLED) throw learningUnavailable();
  if (
    !env.OPENAI_API_KEY ||
    !env.ALLIE_OPENAI_MODEL ||
    env.ALLIE_AI_DAILY_TOKEN_LIMIT < reservedTokens
  )
    throw new AllieFailure("not_configured");
}
async function now(tx: Tx) {
  const [row] = await tx.$queryRaw<
    { value: Date }[]
  >`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS "value"`;
  return row!.value;
}
const mutex = (tx: Tx) =>
  tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('assistant-state-v1', 0))`;
const binding = (conversation: AssistantConversation) =>
  JSON.stringify([conversation.id, conversation.ownerKey, conversation.audience]);
const empty = (owner: Owner): AllieStoredState => ({
  history: {
    accessKey: owner.catalogue.accessKey,
    sourceSet: allieSourceSet(owner.catalogue),
    turns: [],
  },
  messages: [],
});
function csrfForGuest(token: string) {
  return hashToken("csrf", "assistant:" + token);
}
async function take(
  tx: Tx,
  label: string,
  amount: number,
  limit: number,
  resetAt: Date,
  at: Date,
) {
  const key = hashToken("rate-limit", "assistant:" + label),
    current = await tx.rateLimitBucket.findUnique({ where: { key } });
  const hits = (current && current.resetAt > at ? current.hits : 0) + amount;
  if (hits > limit) limited();
  await tx.rateLimitBucket.upsert({
    where: { key },
    create: { key, hits, resetAt },
    update: { hits, resetAt },
  });
  return key;
}
async function resolveOwner(
  tx: Tx,
  proof: AllieOwnerProof,
  write: boolean,
): Promise<Owner> {
  if (proof.kind === "account") {
    const access = await learningAccessInTransaction(tx, proof.actor);
    const session = await tx.session.findUniqueOrThrow({
      where: { id: proof.actor.sessionId },
      select: { expiresAt: true, idleExpiresAt: true },
    });
    return {
      key: hashToken(
        "assistant-owner",
        JSON.stringify([proof.actor.userId, proof.actor.sessionId, proof.actor.role]),
      ),
      catalogue: {
        ...learningCatalogue(access),
        knowledgeRevision: await publicKnowledgeRevision(tx),
      },
      audience: access.role === "CUSTOMER" ? "CUSTOMER" : "WORK",
      expiresAt: new Date(
        Math.min(session.expiresAt.getTime(), session.idleExpiresAt.getTime()),
      ),
    };
  }
  if (!/^[a-zA-Z0-9_-]{32,256}$/.test(proof.token)) throw learningUnavailable();
  const tokenHash = hashToken("assistant-session", proof.token);
  await tx.$queryRaw`SELECT "id" FROM "AssistantGuestSession" WHERE "tokenHash" = ${tokenHash} FOR UPDATE`;
  const guest = await tx.assistantGuestSession.findUnique({ where: { tokenHash } });
  if (!guest || guest.expiresAt <= (await now(tx))) throw learningUnavailable();
  if (
    write &&
    (!proof.csrf ||
      proof.csrf.length > 256 ||
      !verifyCsrfToken(proof.csrf, guest.csrfHash))
  )
    throw new AppError({
      code: "CSRF_INVALID",
      statusCode: 403,
      message: "CSRF validation failed",
    });
  return {
    key: hashToken("assistant-owner", "guest:" + proof.token),
    catalogue: {
      ...learningCatalogue(publicLearningAccess),
      knowledgeRevision: await publicKnowledgeRevision(tx),
    },
    audience: "PUBLIC",
    expiresAt: guest.expiresAt,
  };
}
async function owned<T>(
  proof: AllieOwnerProof,
  write: boolean,
  work: (tx: Tx, owner: Owner, at: Date) => Promise<T>,
) {
  requireAllieEnabled();
  return prisma.$transaction(async (tx) => {
    const owner = await resolveOwner(tx, proof, write);
    await mutex(tx);
    return work(tx, owner, await now(tx));
  });
}
async function discard(tx: Tx, conversationId: string, at: Date) {
  await tx.assistantTurn.updateMany({
    where: { conversationId },
    data: { encryptedResult: Prisma.DbNull },
  });
  await tx.assistantTurn.updateMany({
    where: { conversationId, status: "PENDING" },
    data: { status: "CANCELLED", failureCode: "access_changed", completedAt: at },
  });
}
async function material(tx: Tx, owner: Owner, id: string, at: Date) {
  await tx.$queryRaw`SELECT "id" FROM "AssistantConversation" WHERE "id" = ${id}::uuid AND "ownerKey" = ${owner.key} FOR UPDATE`;
  let row = await tx.assistantConversation.findFirst({
    where: { id, ownerKey: owner.key, audience: owner.audience },
  });
  if (!row) throw learningUnavailable();
  if (
    row.closedAt ||
    row.expiresAt <= at ||
    row.absoluteExpiresAt <= at ||
    owner.expiresAt <= at
  ) {
    if (!row.closedAt) {
      await discard(tx, id, at);
      await tx.assistantConversation.update({
        where: { id },
        data: { closedAt: at, encryptedState: Prisma.DbNull, version: { increment: 1 } },
      });
    }
    return null; // Commit erasure before returning an unavailable response.
  }
  let state = empty(owner),
    reset =
      row.accessKey !== owner.catalogue.accessKey ||
      row.sourceSet !== allieSourceSet(owner.catalogue);
  if (!reset && row.encryptedState !== null) {
    try {
      state = decodeAllieState(row.encryptedState, binding(row));
    } catch {
      reset = true;
    }
    if (
      state.history.accessKey !== row.accessKey ||
      state.history.sourceSet !== row.sourceSet
    )
      reset = true;
  }
  if (reset) {
    state = empty(owner);
    await discard(tx, id, at);
    row = await tx.assistantConversation.update({
      where: { id },
      data: {
        accessKey: owner.catalogue.accessKey,
        sourceSet: allieSourceSet(owner.catalogue),
        encryptedState: Prisma.DbNull,
        version: { increment: 1 },
      },
    });
  }
  return { row, state, reset };
}
async function view(
  tx: Tx,
  value: NonNullable<Awaited<ReturnType<typeof material>>>,
  at: Date,
) {
  const pending = await tx.assistantTurn.findFirst({
    where: { conversationId: value.row.id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: { operationId: true, leaseExpiresAt: true },
  });
  return {
    id: value.row.id,
    version: value.row.version,
    audience: value.row.audience.toLowerCase(),
    expiresAt: value.row.expiresAt.toISOString(),
    messages: value.state.messages,
    historyReset: value.reset,
    pending: pending
      ? {
          operationId: pending.operationId,
          state:
            pending.leaseExpiresAt > at ? ("pending" as const) : ("interrupted" as const),
        }
      : null,
  };
}

/** Customer consent can export only explicitly selected, current owned help.
 * This path intentionally needs neither a provider key nor AI quota/enablement.
 * Ordinary support remains available during AI outages. Never accepts work/guest
 * conversation proofs or a client-supplied transcript.
 */
export async function customerHandoffExcerpts(
  tx: Tx,
  actor: AuthenticatedActor,
  input: HandoffExcerpts,
) {
  if (actor.role !== "CUSTOMER") throw learningUnavailable();
  const owner = await resolveOwner(tx, { kind: "account", actor }, false);
  if (owner.audience !== "CUSTOMER") throw learningUnavailable();
  await mutex(tx);
  const value = await material(tx, owner, input.conversationId, await now(tx));
  if (!value || value.reset) throw learningUnavailable();
  if (value.row.version !== input.expectedVersion)
    conflict("Your help conversation changed. Review the handoff again.");
  return input.selections.map((selection) => {
    const message = value.state.messages.find(
      (m) => m.operationId === selection.operationId,
    );
    if (!message) throw learningUnavailable();
    return selection.part === "QUESTION"
      ? `You (selected help question):\n${message.question}`
      : `Allie (AI-generated guidance; may be wrong):\n${[
          message.answer.answer,
          ...message.answer.steps.map((step, i) => `${i + 1}. ${step}`),
          ...(message.answer.caveat ? [message.answer.caveat] : []),
        ].join("\n")}`;
  });
}

/** Called only in the same successful support transaction after reviewed export.
 * The original AI context ends; separate AI help can be started deliberately.
 * Completion of an in-flight provider request cannot append to this closed context.
 */
export async function finishCustomerHandoffContext(
  tx: Tx,
  actor: AuthenticatedActor,
  input: HandoffExcerpts,
) {
  await customerHandoffExcerpts(tx, actor, input);
  const at = await now(tx);
  await discard(tx, input.conversationId, at);
  await tx.assistantConversation.update({
    where: { id: input.conversationId },
    data: { closedAt: at, encryptedState: Prisma.DbNull, version: { increment: 1 } },
  });
}

/** Explicit customer transition to human support closes only the chosen owned AI
 * context, without exporting it. Works while AI/help is disabled. A delayed provider
 * completion is rejected by the existing closed-context/version safeguards. */
export async function closeCustomerContextForSupport(
  tx: Tx,
  actor: AuthenticatedActor,
  input: { conversationId: string; expectedVersion: number },
) {
  if (actor.role !== "CUSTOMER") throw learningUnavailable();
  const access = await learningAccessInTransaction(tx, actor);
  if (!access.verified) throw learningUnavailable();
  await mutex(tx);
  const key = hashToken(
    "assistant-owner",
    JSON.stringify([actor.userId, actor.sessionId, actor.role]),
  );
  await tx.$queryRaw`SELECT "id" FROM "AssistantConversation" WHERE "id"=${input.conversationId}::uuid AND "ownerKey"=${key} FOR UPDATE`;
  const row = await tx.assistantConversation.findFirst({
    where: { id: input.conversationId, ownerKey: key, audience: "CUSTOMER" },
  });
  if (!row) throw learningUnavailable();
  if (row.version !== input.expectedVersion)
    conflict("Your help context changed. Review the transition to Customer Care again.");
  const at = await now(tx);
  await discard(tx, row.id, at);
  await tx.assistantConversation.update({
    where: { id: row.id },
    data: {
      closedAt: row.closedAt ?? at,
      encryptedState: Prisma.DbNull,
      version: { increment: 1 },
    },
  });
}
export async function bootstrapAllieGuest(ip: string, existingToken?: string) {
  requireAllieEnabled();
  return prisma.$transaction(async (tx) => {
    await mutex(tx);
    const at = await now(tx);
    if (existingToken && /^[a-zA-Z0-9_-]{32,256}$/.test(existingToken)) {
      const existing = await tx.assistantGuestSession.findUnique({
        where: { tokenHash: hashToken("assistant-session", existingToken) },
      });
      if (existing && existing.expiresAt > at)
        return {
          token: existingToken,
          csrfToken: csrfForGuest(existingToken),
          expiresAt: existing.expiresAt,
        };
    }
    await take(tx, "guest-create:" + ip, 1, 10, new Date(at.getTime() + absoluteMs), at);
    const token = generateOpaqueToken(),
      csrfToken = csrfForGuest(token),
      expiresAt = new Date(at.getTime() + absoluteMs);
    await tx.assistantGuestSession.create({
      data: {
        tokenHash: hashToken("assistant-session", token),
        csrfHash: hashToken("csrf", csrfToken),
        expiresAt,
      },
    });
    return { token, csrfToken, expiresAt };
  });
}
export async function createAllieConversation(
  proof: AllieOwnerProof,
  operationId: string,
) {
  const result = await owned(proof, true, async (tx, owner, at) => {
    const digest = hashToken(
      "assistant-idempotency",
      "conversation:" + owner.key + ":" + operationId,
    );
    const id = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
    const existing = await tx.assistantConversation.findUnique({
      where: { id },
      select: { id: true },
    });
    if (existing) {
      const value = await material(tx, owner, id, at);
      return value ? { replayed: true, conversation: await view(tx, value, at) } : null;
    }
    await take(
      tx,
      "conversation-create:" + owner.key,
      1,
      10,
      new Date(at.getTime() + absoluteMs),
      at,
    );
    if (
      (await tx.assistantConversation.count({
        where: { ownerKey: owner.key, closedAt: null, expiresAt: { gt: at } },
      })) >= 3
    )
      conflict("Clear an existing Allie conversation before starting another.");
    const absoluteExpiresAt = new Date(
      Math.min(at.getTime() + absoluteMs, owner.expiresAt.getTime()),
    );
    const row = await tx.assistantConversation.create({
      data: {
        id,
        ownerKey: owner.key,
        audience: owner.audience,
        accessKey: owner.catalogue.accessKey,
        sourceSet: allieSourceSet(owner.catalogue),
        expiresAt: new Date(Math.min(at.getTime() + idleMs, absoluteExpiresAt.getTime())),
        absoluteExpiresAt,
      },
    });
    return {
      replayed: false,
      conversation: await view(tx, { row, state: empty(owner), reset: false }, at),
    };
  });
  if (!result) throw learningUnavailable();
  return result;
}
export async function listAllieConversations(proof: AllieOwnerProof) {
  return owned(proof, false, (tx, owner, at) =>
    tx.assistantConversation.findMany({
      where: {
        ownerKey: owner.key,
        audience: owner.audience,
        closedAt: null,
        expiresAt: { gt: at },
        absoluteExpiresAt: { gt: at },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, createdAt: true, expiresAt: true },
    }),
  );
}
export async function readAllieConversation(proof: AllieOwnerProof, id: string) {
  const result = await owned(proof, false, async (tx, owner, at) => {
    const value = await material(tx, owner, id, at);
    return value ? view(tx, value, at) : null;
  });
  if (!result) throw learningUnavailable();
  return result;
}
export async function clearAllieConversation(proof: AllieOwnerProof, id: string) {
  const result = await owned(proof, true, async (tx, owner, at) => {
    const value = await material(tx, owner, id, at);
    if (!value) return false;
    await discard(tx, id, at);
    await tx.assistantConversation.update({
      where: { id },
      data: { closedAt: at, encryptedState: Prisma.DbNull, version: { increment: 1 } },
    });
    return true;
  });
  if (!result) throw learningUnavailable();
  return { cleared: true };
}
export async function cancelAllieTurn(
  proof: AllieOwnerProof,
  id: string,
  operationId: string,
) {
  const result = await owned(proof, true, async (tx, owner, at) => {
    const value = await material(tx, owner, id, at);
    if (!value) return false;
    const turn = await tx.assistantTurn.findUnique({
      where: { conversationId_operationId: { conversationId: id, operationId } },
    });
    if (!turn) throw learningUnavailable();
    const changed = await tx.assistantTurn.updateMany({
      where: { id: turn.id, status: "PENDING" },
      data: { status: "CANCELLED", completedAt: at, failureCode: "cancelled" },
    });
    if (changed.count)
      await tx.assistantConversation.update({
        where: { id },
        data: { version: { increment: 1 } },
      });
    return {
      cancelled: changed.count === 1,
      status: changed.count ? "CANCELLED" : turn.status,
    };
  });
  if (!result) throw learningUnavailable();
  return result;
}
export async function submitAllieTurn(
  proof: AllieOwnerProof,
  id: string,
  input: { operationId: string; expectedVersion: number; question: string; page: string },
  signal?: AbortSignal,
  riskAddress = "internal",
) {
  const question = allieQuestionSchema.safeParse(input.question),
    page = alliePageSchema.safeParse(input.page);
  if (!question.success || !page.success || page.data === "security")
    throw new AllieFailure("invalid_input");
  if (containsAllieSecret(question.data)) throw new AllieFailure("sensitive_input");
  const inputHash = hashToken(
    "assistant-idempotency",
    JSON.stringify([id, input.expectedVersion, page.data, question.data]),
  );
  const claim = await owned(proof, true, async (tx, owner, at) => {
    const value = await material(tx, owner, id, at);
    if (!value) return null;
    const existing = await tx.assistantTurn.findUnique({
      where: {
        conversationId_operationId: {
          conversationId: id,
          operationId: input.operationId,
        },
      },
    });
    if (existing) {
      if (existing.inputHash !== inputHash)
        conflict(
          "That operation belongs to a different question. Review before starting another turn.",
        );
      if (existing.status === "COMPLETED" && existing.encryptedResult !== null)
        return { replayed: true as const, conversation: await view(tx, value, at) };
      conflict(
        existing.status === "PENDING" && existing.leaseExpiresAt > at
          ? "This answer is still being prepared. Check the conversation before retrying."
          : "This turn did not produce an available answer. Review before starting a new turn.",
      );
    }
    if (value.row.version !== input.expectedVersion || value.reset)
      conflict(
        "The conversation changed. Refresh and review your question before sending.",
      );
    if (
      await tx.assistantTurn.count({
        where: {
          status: "PENDING",
          leaseExpiresAt: { gt: at },
          OR: [{ conversation: { ownerKey: owner.key } }, { conversationId: id }],
        },
      })
    )
      conflict(
        "Another answer is being prepared for this session. Check it before sending another question.",
      );
    if (
      (await tx.assistantTurn.count({
        where: { status: "PENDING", leaseExpiresAt: { gt: at } },
      })) >= env.ALLIE_AI_GLOBAL_CONCURRENCY
    )
      limited();
    const windowEnd = new Date(at.getTime() + 5 * 60000);
    await take(
      tx,
      "turn-risk:" + riskAddress,
      owner.audience === "PUBLIC" ? 3 : 1,
      60,
      windowEnd,
      at,
    );
    await take(
      tx,
      "turns:" + owner.key,
      1,
      owner.audience === "PUBLIC" ? 3 : 6,
      windowEnd,
      at,
    );
    const day = at.toISOString().slice(0, 10),
      resetAt = new Date(day + "T00:00:00.000Z");
    resetAt.setUTCDate(resetAt.getUTCDate() + 1);
    const quotaKey = await take(
      tx,
      "daily-reservation:" + day,
      reservedTokens,
      env.ALLIE_AI_DAILY_TOKEN_LIMIT,
      resetAt,
      at,
    );
    const turn = await tx.assistantTurn.create({
      data: {
        id: randomUUID(),
        conversationId: id,
        operationId: input.operationId,
        inputHash,
        quotaKey,
        reservedTokens,
        leaseExpiresAt: new Date(at.getTime() + 60000),
      },
    });
    const row = await tx.assistantConversation.update({
      where: { id },
      data: { version: { increment: 1 } },
    });
    return { replayed: false as const, owner, turn, value: { ...value, row } };
  });
  if (!claim) throw learningUnavailable();
  if (claim.replayed) return claim;
  const stop = new AbortController(),
    combined = signal ? AbortSignal.any([signal, stop.signal]) : stop.signal;
  let checking: Promise<void> | undefined,
    accessLost = false;
  const timer = setInterval(() => {
    if (checking || stop.signal.aborted) return;
    checking = owned(proof, false, async (tx, owner, at) => {
      const active = await tx.assistantTurn.findFirst({
        where: { id: claim.turn.id, status: "PENDING", leaseExpiresAt: { gt: at } },
        select: { id: true },
      });
      if (!active) stop.abort();
      if (
        owner.catalogue.accessKey !== claim.owner.catalogue.accessKey ||
        allieSourceSet(owner.catalogue) !== claim.value.row.sourceSet
      ) {
        accessLost = true;
        stop.abort();
      }
    })
      .catch(() => {
        accessLost = true;
        stop.abort();
      })
      .finally(() => {
        checking = undefined;
      });
  }, 1000);
  try {
    const result = await answerAllie({
      question: question.data,
      page: page.data,
      previous: claim.value.state.history,
      getCatalogue: async () =>
        owned(proof, false, async (tx, owner) => {
          if (
            owner.catalogue.accessKey !== claim.owner.catalogue.accessKey ||
            allieSourceSet(owner.catalogue) !== claim.value.row.sourceSet
          )
            throw new AllieFailure("access_changed");
          return {
            ...owner.catalogue,
            knowledge: await retrievePublicKnowledge(
              tx,
              question.data,
              claim.value.state.history,
            ),
          };
        }),
      provider: createAllieProvider({
        apiKey: env.OPENAI_API_KEY!,
        model: env.ALLIE_OPENAI_MODEL!,
      }),
      signal: combined,
    });
    clearInterval(timer);
    if (checking) await checking;
    const saved = await owned(proof, true, async (tx, owner, at) => {
      const value = await material(tx, owner, id, at);
      const active = await tx.assistantTurn.findUnique({ where: { id: claim.turn.id } });
      if (
        !value ||
        !active ||
        active.status !== "PENDING" ||
        active.leaseExpiresAt <= at ||
        value.row.version !== claim.value.row.version ||
        owner.catalogue.accessKey !== result.nextHistory.accessKey ||
        allieSourceSet(owner.catalogue) !== result.nextHistory.sourceSet ||
        combined.aborted
      )
        return null;
      const messages = [
        ...claim.value.state.messages,
        {
          operationId: input.operationId,
          question: question.data,
          answer: result.answer,
        },
      ].slice(-result.nextHistory.turns.length);
      const state: AllieStoredState = { history: result.nextHistory, messages };
      const encryptedState = encodeAllieState(state, binding(value.row));
      const row = await tx.assistantConversation.update({
        where: { id },
        data: {
          encryptedState,
          version: { increment: 1 },
          expiresAt: new Date(
            Math.min(
              at.getTime() + idleMs,
              value.row.absoluteExpiresAt.getTime(),
              owner.expiresAt.getTime(),
            ),
          ),
        },
      });
      await tx.assistantTurn.update({
        where: { id: claim.turn.id },
        data: {
          status: "COMPLETED",
          completedAt: at,
          encryptedResult: encryptedState,
          model: result.model,
          inputTokens: result.usage.input_tokens,
          outputTokens: result.usage.output_tokens,
          totalTokens: result.usage.total_tokens,
          durationMs: result.durationMs,
        },
      });
      return {
        replayed: false as const,
        conversation: await view(tx, { row, state, reset: result.historyReset }, at),
      };
    });
    if (!saved) throw new AllieFailure("access_changed");
    return saved;
  } catch (error) {
    await prisma.$transaction(async (tx) => {
      await mutex(tx);
      // A human-channel handoff can close and cancel this turn while the
      // provider response is in flight. Preserve the canonical conflict result
      // even if the provider reports a transport failure before polling notices.
      const [currentTurn, currentConversation] = await Promise.all([
        tx.assistantTurn.findUnique({ where: { id: claim.turn.id } }),
        tx.assistantConversation.findUnique({ where: { id } }),
      ]);
      if (
        (currentTurn?.status === "CANCELLED" &&
          currentTurn.failureCode === "access_changed") ||
        currentConversation?.closedAt
      )
        accessLost = true;
      const changed = await tx.assistantTurn.updateMany({
        where: { id: claim.turn.id, status: "PENDING" },
        data: {
          status: combined.aborted ? "CANCELLED" : "FAILED",
          failureCode: accessLost
            ? "access_changed"
            : error instanceof AllieFailure
              ? error.code
              : "provider_unavailable",
          completedAt: await now(tx),
        },
      });
      if (changed.count)
        await tx.assistantConversation.updateMany({
          where: { id, ownerKey: claim.owner.key },
          data: { version: { increment: 1 } },
        });
    });
    if (accessLost) throw new AllieFailure("access_changed");
    throw error;
  } finally {
    clearInterval(timer);
    stop.abort();
    if (checking) await checking;
  }
}
