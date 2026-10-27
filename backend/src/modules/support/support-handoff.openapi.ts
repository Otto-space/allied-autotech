import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  handoffDraftSchema,
  handoffSubmitSchema,
  handoffHeadersSchema,
  handoffReceiptParamsSchema,
  handoffPreviewSchema,
  handoffSavedSchema,
  handoffPreviewHeadersSchema,
  handoffRecoverySchema,
  handoffCancelledSchema,
} from "./support-handoff.schemas.js";

export function registerSupportHandoffOpenApi(registry: OpenAPIRegistry) {
  const envelope = (data: z.ZodType) =>
    z.object({
      success: z.boolean(),
      message: z.string(),
      data,
      meta: z.object({ requestId: z.string() }),
    });
  const content = (schema: z.ZodType) => ({ "application/json": { schema } });
  const csrf = z.object({ "x-csrf-token": z.string().min(32) });
  const failures = Object.fromEntries(
    [
      [401, "Current verified customer session required"],
      [403, "Customer identity, trusted origin or CSRF verification failed"],
      [404, "Owned current support/help resource unavailable; existence hidden"],
      [409, "Changed/expired review, closed case or mismatched/expired operation"],
      [422, "Strict bounded payload, consent or excerpt selection invalid"],
      [429, "Bounded handoff request limit reached; ordinary Customer Care retained"],
    ].map(([code, description]) => [code, { description: String(description) }]),
  );
  registry.registerPath({
    method: "post",
    path: "/customers/support/handoff/preview",
    tags: ["Support"],
    summary: "Prepare an exact review of an asynchronous Customer Care handoff",
    description:
      "No operational case/message is created. Customer identity comes from the session. Optional help excerpts must belong to the current customer session, remain eligible/unexpired, and be explicitly selected. Work/guest context is excluded. The keyed ten-minute review binds exact content, target/version, branch and session. No provider call, live availability or automatic transcript attachment.",
    security: [{ sessionCookie: [] }],
    request: {
      headers: csrf.extend(handoffPreviewHeadersSchema.shape),
      query: z.strictObject({}),
      body: { required: true, content: content(handoffDraftSchema) },
    },
    responses: {
      200: {
        description: "Exact customer-reviewed queued message; private/no-store",
        content: content(envelope(handoffPreviewSchema)),
      },
      ...failures,
    },
  });
  registry.registerPath({
    method: "post",
    path: "/customers/support/handoff",
    tags: ["Support"],
    summary: "Persist an explicitly reviewed customer handoff in canonical support",
    description:
      "Creates one General enquiry or adds one public customer message to the explicitly selected owned enquiry/complaint. Session-derived identity, active branch, expected version, current excerpts and exact review are revalidated transactionally. Selected AI context ends after success. Owner/payload-bound operation receipts prevent duplicates and permit replay after transient help expires. Queued/Saved does not establish email delivery or human reading. Requires compatible backend before frontend exposure; no new schema.",
    security: [{ sessionCookie: [] }],
    request: {
      headers: csrf.extend(handoffHeadersSchema.shape),
      query: z.strictObject({}),
      body: { required: true, content: content(handoffSubmitSchema) },
    },
    responses: {
      201: {
        description: "Canonical reference and replay status; private/no-store",
        content: content(envelope(handoffSavedSchema)),
      },
      ...failures,
    },
  });
  registry.registerPath({
    method: "get",
    path: "/customers/support/handoff/receipts/{operationKey}",
    tags: ["Support"],
    summary: "Recover an owned durable handoff reference without a transcript",
    description:
      "The operation key is a non-bearer random identifier. Current customer session and canonical ownership are required; another customer receives 404. Absence does not prove a failed submission. Recovery expires after twenty-four hours; inspect canonical support history afterward. Returns no summary, help transcript, internal note or credential.",
    security: [{ sessionCookie: [] }],
    request: { params: handoffReceiptParamsSchema, query: z.strictObject({}) },
    responses: {
      200: {
        description: "Saved owned reference verified; private/no-store",
        content: content(envelope(handoffSavedSchema)),
      },
      ...failures,
    },
  });
  registry.registerPath({
    method: "get",
    path: "/customers/support/handoff/drafts/{operationKey}",
    tags: ["Support"],
    summary: "Recover an encrypted short-lived handoff review after reload",
    description:
      "When preview included an operation key, its exact draft/review is encrypted for this customer session for at most fifteen minutes, with three active reviews allowed. Current identity and support/help access are rechecked. Stale help text is omitted; the editable summary remains with NEEDS_REVIEW. A saved canonical reference takes precedence. No transcript is stored in the browser or passed to the model.",
    security: [{ sessionCookie: [] }],
    request: { params: handoffReceiptParamsSchema, query: z.strictObject({}) },
    responses: {
      200: {
        description:
          "Current review, needs-review input, saved reference or cancelled operation; private/no-store",
        content: content(envelope(handoffRecoverySchema)),
      },
      ...failures,
    },
  });
  registry.registerPath({
    method: "delete",
    path: "/customers/support/handoff/drafts/{operationKey}",
    tags: ["Support"],
    summary: "Cancel an unsaved handoff operation without deleting a support record",
    description:
      "Serialises with submission, records a durable cancellation for the operation window and erases only this session's transient draft. A delayed original submission is then denied. If submission already committed, returns its owned saved reference instead; never deletes the canonical case/message. Explicitly cancel/check before creating a replacement review after uncertainty.",
    security: [{ sessionCookie: [] }],
    request: {
      params: handoffReceiptParamsSchema,
      headers: csrf,
      query: z.strictObject({}),
    },
    responses: {
      200: {
        description:
          "Durable cancellation or saved canonical reference; private/no-store",
        content: content(envelope(z.union([handoffSavedSchema, handoffCancelledSchema]))),
      },
      ...failures,
    },
  });
}
