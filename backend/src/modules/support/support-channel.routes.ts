import { Router, type Request } from "express";
import { z } from "zod";
import { authenticate } from "../../common/middleware/authenticate.js";
import { requireStaff } from "../../common/middleware/authorize.js";
import { requireCsrf } from "../../common/middleware/csrf.js";
import { createSensitiveRateLimit } from "../../common/middleware/rate-limits.js";
import { validate } from "../../common/middleware/validate.js";
import { successResponse } from "../../common/http/api-response.js";
import {
  supportChannelActionSchema,
  supportChannelHeadersSchema,
  supportChannelParamsSchema,
  supportChannelRequestSchema,
  supportChannelTargetSchema,
  supportChannelOperationSchema,
  supportChannelQueueSchema,
  supportChannelCandidatesSchema,
  supportChannelCancelSchema,
} from "./support-channel.schemas.js";
import {
  actOnSupportChannel,
  getSupportChannel,
  findSupportChannel,
  requestSupportChannel,
} from "./support-channel.js";
import {
  listSupportChannels,
  recoverSupportChannelOperation,
  supportChannelCandidates,
  cancelSupportChannelOperation,
} from "./support-channel-discovery.js";
const empty = z.strictObject({});
const context = (req: Request) => ({
  requestId: String(req.id),
  ipAddress: req.ip ?? null,
  userAgent: req.get("user-agent") ?? null,
});

/** Customer router is mounted under the existing authenticated owned-support boundary. */
export function customerSupportChannelRouter() {
  const router = Router();
  router.post(
    "/",
    requireCsrf,
    createSensitiveRateLimit(30, 60_000),
    validate({
      query: empty,
      body: supportChannelRequestSchema,
      headers: supportChannelHeadersSchema,
    }),
    async (req, res) =>
      res
        .status(201)
        .json(
          successResponse(
            "Customer Care channel request saved",
            req.id,
            await requestSupportChannel(
              req.actor!,
              supportChannelRequestSchema.parse(req.body),
              supportChannelHeadersSchema.parse(req.headers)["idempotency-key"],
              context(req),
            ),
          ),
        ),
  );
  registerDetail(router, "/:channelId");
  registerLookup(router, "/by-case/:kind/:id");
  registerOperation(router, "/operations/:action/:operationKey");
  return router;
}
export function workforceSupportChannelRouter() {
  const router = Router();
  router.use("/staff/workforce/support-chat/channels", authenticate(), requireStaff);
  router.use("/staff/workforce/support-chat/channels", (_req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    next();
  });
  router.get(
    "/staff/workforce/support-chat/channels",
    createSensitiveRateLimit(120, 60_000),
    validate({ query: supportChannelQueueSchema }),
    async (req, res) => {
      res.json(
        successResponse(
          "Current scoped Care conversations",
          req.id,
          await listSupportChannels(
            req.actor!,
            supportChannelQueueSchema.parse(req.query),
            context(req),
          ),
        ),
      );
    },
  );
  router.get(
    "/staff/workforce/support-chat/channels/:channelId/assignees",
    createSensitiveRateLimit(60, 60_000),
    validate({
      query: supportChannelCandidatesSchema,
      params: supportChannelParamsSchema,
    }),
    async (req, res) => {
      res.json(
        successResponse(
          "Currently eligible live representatives",
          req.id,
          await supportChannelCandidates(
            req.actor!,
            supportChannelParamsSchema.parse(req.params).channelId,
            supportChannelCandidatesSchema.parse(req.query),
          ),
        ),
      );
    },
  );
  registerDetail(router, "/staff/workforce/support-chat/channels/:channelId");
  registerLookup(router, "/staff/workforce/support-chat/channels/by-case/:kind/:id");
  registerOperation(
    router,
    "/staff/workforce/support-chat/channels/operations/:action/:operationKey",
  );
  return router;
}
function registerOperation(router: Router, path: string) {
  router.delete(
    path,
    requireCsrf,
    createSensitiveRateLimit(30, 60_000),
    validate({
      query: empty,
      params: supportChannelOperationSchema,
      body: supportChannelCancelSchema,
    }),
    async (req, res) => {
      res.set("Cache-Control", "private, no-store");
      res.json(
        successResponse(
          "Pending operation cancellation checked",
          req.id,
          await cancelSupportChannelOperation(
            req.actor!,
            supportChannelOperationSchema.parse(req.params),
            supportChannelCancelSchema.parse(req.body),
            context(req),
          ),
        ),
      );
    },
  );
  router.get(
    path,
    createSensitiveRateLimit(120, 60_000),
    validate({ query: empty, params: supportChannelOperationSchema }),
    async (req, res) => {
      res.set("Cache-Control", "private, no-store");
      res.json(
        successResponse(
          "Saved channel operation verified",
          req.id,
          await recoverSupportChannelOperation(
            req.actor!,
            supportChannelOperationSchema.parse(req.params),
            context(req),
          ),
        ),
      );
    },
  );
}
function registerLookup(router: Router, path: string) {
  router.get(
    path,
    createSensitiveRateLimit(240, 60_000),
    validate({ query: empty, params: supportChannelTargetSchema }),
    async (req, res) => {
      res.set("Cache-Control", "private, no-store");
      res.json(
        successResponse(
          "Canonical case channel checked",
          req.id,
          await findSupportChannel(
            req.actor!,
            supportChannelTargetSchema.parse(req.params),
            context(req),
          ),
        ),
      );
    },
  );
}
function registerDetail(router: Router, path: string) {
  router.get(
    path,
    createSensitiveRateLimit(240, 60_000),
    validate({ query: empty, params: supportChannelParamsSchema }),
    async (req, res) => {
      res.set("Cache-Control", "private, no-store");
      res.json(
        successResponse(
          "Current Customer Care channel state",
          req.id,
          await getSupportChannel(
            req.actor!,
            supportChannelParamsSchema.parse(req.params).channelId,
            context(req),
          ),
        ),
      );
    },
  );
  router.post(
    path + "/actions",
    requireCsrf,
    createSensitiveRateLimit(60, 60_000),
    validate({
      query: empty,
      params: supportChannelParamsSchema,
      body: supportChannelActionSchema,
      headers: supportChannelHeadersSchema,
    }),
    async (req, res) => {
      res.set("Cache-Control", "private, no-store");
      res.json(
        successResponse(
          "Customer Care channel action saved",
          req.id,
          await actOnSupportChannel(
            req.actor!,
            supportChannelParamsSchema.parse(req.params).channelId,
            supportChannelActionSchema.parse(req.body),
            supportChannelHeadersSchema.parse(req.headers)["idempotency-key"],
            context(req),
          ),
        ),
      );
    },
  );
}
