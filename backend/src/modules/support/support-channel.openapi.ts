import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  supportChannelActionSchema,
  supportChannelHeadersSchema,
  supportChannelParamsSchema,
  supportChannelRequestSchema,
  supportChannelSchema,
  supportChannelTargetSchema,
  supportChannelOperationSchema,
  supportChannelQueueSchema,
  supportChannelQueuePageSchema,
  supportChannelCandidatesSchema,
  supportChannelCandidatesPageSchema,
  supportChannelCancelSchema,
  supportChannelOperationOutcomeSchema,
} from "./support-channel.schemas.js";
export function registerSupportChannelOpenApi(registry: OpenAPIRegistry) {
  const content = (schema: z.ZodType) => ({ "application/json": { schema } });
  const response = (mutating: boolean) => ({
    description: "Current private channel state; canonical case/messages retained",
    content: content(
      z.object({
        success: z.boolean(),
        message: z.string(),
        data: mutating
          ? supportChannelSchema.extend({ replayed: z.boolean() })
          : supportChannelSchema,
        meta: z.object({ requestId: z.string() }),
      }),
    ),
  });
  const failures = Object.fromEntries(
    [
      [401, "Current session required"],
      [403, "Current identity/MFA/action/CSRF denied"],
      [404, "Owned or currently scoped case/channel unavailable"],
      [409, "Changed state, routing, operation payload or expired recovery key"],
      [422, "Strict bounded input invalid"],
      [429, "Rate limit reached"],
      [503, "Fresh eligible availability/capacity unavailable; saved case retained"],
    ].map(([code, description]) => [code, { description: String(description) }]),
  );
  const envelope = (data: z.ZodType) =>
    z.object({
      success: z.boolean(),
      message: z.string(),
      data,
      meta: z.object({ requestId: z.string() }),
    });
  registry.registerPath({
    method: "get",
    path: "/staff/workforce/support-chat/channels",
    tags: ["Support"],
    summary: "Read a bounded current-responsibility Care channel queue",
    description:
      "Current session/MFA and case-view scope are required. Signed keyset cursors bind session, effective access and kind/state/branch filters. Oldest created channels first, up to 25 per page; per-channel waiting time is not a queue-position promise. State is reconciled before projection. No contact or transcript is returned. Default ACTIVE includes queued and joined channels. Empty/short pages may still have a next cursor after state or routing changes.",
    security: [{ sessionCookie: [] }],
    request: { query: supportChannelQueueSchema },
    responses: {
      200: {
        description: "Scoped current metadata, private/no-store",
        content: content(envelope(supportChannelQueuePageSchema)),
      },
      ...failures,
    },
  });
  registry.registerPath({
    method: "get",
    path: "/staff/workforce/support-chat/channels/{channelId}/assignees",
    tags: ["Support"],
    summary: "Find currently eligible transfer candidates for this scoped channel",
    description:
      "Requires the separate current case-assignment duty. Returns only staff profile IDs and display names for current-session, opted-in, eligible, in-hours candidates with capacity in this branch; excludes the current representative. A bounded scan may return a short page with a continuation. Signed cursors bind current operator access and channel version. Transfer rechecks every prerequisite; the business-case assignee is unchanged.",
    security: [{ sessionCookie: [] }],
    request: {
      params: supportChannelParamsSchema,
      query: supportChannelCandidatesSchema,
    },
    responses: {
      200: {
        description: "Bounded eligible candidates, private/no-store",
        content: content(envelope(supportChannelCandidatesPageSchema)),
      },
      ...failures,
    },
  });
  registry.registerPath({
    method: "post",
    path: "/customers/support/live/channels",
    tags: ["Support"],
    summary: "Request a queued human channel for one explicitly selected owned case",
    description:
      "Does not create another case or forward an AI transcript. An optional explicitly selected current-session AI context is cancelled/closed without exporting its text, including while AI is disabled. Ordinary queued requests work independently of live staffing. Original-key/body replay returns the current owned reference, never another request. Uses support-reply-v1 timestamp/UUID keys with a 24-hour reference-only recovery window.",
    security: [{ sessionCookie: [] }],
    request: {
      query: z.strictObject({}),
      headers: supportChannelHeadersSchema.extend({ "x-csrf-token": z.string().min(32) }),
      body: { required: true, content: content(supportChannelRequestSchema) },
    },
    responses: { 201: response(true), ...failures },
  });
  for (const prefix of [
    "/customers/support/live/channels",
    "/staff/workforce/support-chat/channels",
  ]) {
    registry.registerPath({
      method: "delete",
      path: prefix + "/operations/{action}/{operationKey}",
      tags: ["Support"],
      summary:
        "Durably stop an unsaved channel action or recover its already-saved outcome",
      description:
        "Requires current ownership/branch/action authority and CSRF. Serializes with the original command. If already saved, returns SAVED and current authorised state without undoing it. Otherwise stores a target-bound CANCELLED marker for the original recovery window; a delayed original command is then rejected. No case/message/channel is deleted. Used only after explicit cancellation review, never as an automatic retry.",
      security: [{ sessionCookie: [] }],
      request: {
        params: supportChannelOperationSchema,
        query: z.strictObject({}),
        headers: z.object({ "x-csrf-token": z.string().min(32) }),
        body: { required: true, content: content(supportChannelCancelSchema) },
      },
      responses: {
        200: {
          description:
            "Durable cancellation or preserved saved outcome, private/no-store",
          content: content(envelope(supportChannelOperationOutcomeSchema)),
        },
        ...failures,
      },
    });
    registry.registerPath({
      method: "get",
      path: prefix + "/operations/{action}/{operationKey}",
      tags: ["Support"],
      summary:
        "Recover an actor-owned saved channel action without its private request body",
      description:
        "The random timestamp/UUID key is a non-bearer identifier. Current actor/action scope and canonical ownership/permissions are required, including after reload or session changes. Returns SAVED plus current channel metadata, or a verified durable CANCELLED marker; never the transfer reason, assistant context or transcript. A 404 does not prove that an in-flight submission failed; do not create a replacement command automatically. Twenty-four-hour timestamp rules remain, including after receipt cleanup.",
      security: [{ sessionCookie: [] }],
      request: { params: supportChannelOperationSchema, query: z.strictObject({}) },
      responses: {
        200: {
          description: "Owned durable outcome and current state, private/no-store",
          content: content(envelope(supportChannelOperationOutcomeSchema)),
        },
        ...failures,
      },
    });
    registry.registerPath({
      method: "get",
      path: prefix + "/by-case/{kind}/{id}",
      tags: ["Support"],
      summary: "Recover a channel through its currently owned or scoped canonical case",
      description:
        "Rechecks canonical ownership/scope and session. Returns null when this authorised case has no channel, rather than inferring access from a browser-held UUID. Reconciles current eligibility and returns the case's resulting revision for a deliberate request. No transcript or contact details.",
      security: [{ sessionCookie: [] }],
      request: { query: z.strictObject({}), params: supportChannelTargetSchema },
      responses: {
        200: {
          description: "Current authorised case channel and revision",
          content: content(
            z.object({
              success: z.boolean(),
              message: z.string(),
              data: z.object({
                channel: supportChannelSchema.nullable(),
                caseVersion: z.number().int().nonnegative(),
                latestPublicMessageId: z.uuid().nullable(),
              }),
              meta: z.object({ requestId: z.string() }),
            }),
          ),
        },
        ...failures,
      },
    });
    registry.registerPath({
      method: "get",
      path: prefix + "/{channelId}",
      tags: ["Support"],
      summary: "Revalidate one owned/scoped channel and reconcile lost agent eligibility",
      description:
        "Bounded five-second polling, no bearer URL. Rechecks current session and case scope on every read; an expired/revoked/unavailable agent requeues the same canonical case with one generic system entry and an audited state change. Closed cases end the channel. No transcript, internal note or staff identity is returned. Existing canonical message APIs remain the authorised text/replay path.",
      security: [{ sessionCookie: [] }],
      request: { query: z.strictObject({}), params: supportChannelParamsSchema },
      responses: { 200: response(false), ...failures },
    });
    registry.registerPath({
      method: "post",
      path: prefix + "/{channelId}/actions",
      tags: ["Support"],
      summary: "Transactionally claim, transfer or end the canonical human channel",
      description:
        "Customer ownership permits ending their channel. Claim requires current same-branch live duties, explicit session-bound presence, hours and shared capacity. Transfer requires the separate current case-assignment duty and another eligible opted-in representative; it does not change the business-case assignee. Every new action checks channel revision. Actor/action/payload-bound reference receipts make original-key replay safe after lost acknowledgement; changed/expired keys conflict. System history/audit and state changes commit together. End preserves the case and ordinary follow-up. Live access cannot be inferred from account role.",
      security: [{ sessionCookie: [] }],
      request: {
        query: z.strictObject({}),
        params: supportChannelParamsSchema,
        headers: supportChannelHeadersSchema.extend({
          "x-csrf-token": z.string().min(32),
        }),
        body: { required: true, content: content(supportChannelActionSchema) },
      },
      responses: { 200: response(true), ...failures },
    });
  }
}
